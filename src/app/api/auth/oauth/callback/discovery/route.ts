import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

// Extend global type to include domain discovery tokens
declare global {
  var domainDiscoveryTokens: Record<string, {
    accessToken: string
    refreshToken?: string
    expiresAt?: number
    createdAt: number
    discoveredDomains?: string[]
    adminEmail?: string
  }> | undefined
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error) {
      console.error('OAuth domain discovery error:', error)
      return NextResponse.redirect(new URL('/migrations/new?oauth_error=' + error, request.url))
    }

    if (!code || !state) {
      return NextResponse.redirect(new URL('/migrations/new?oauth_error=missing_params', request.url))
    }

    // Parse state to get session information
    const stateData = JSON.parse(state)
    const { sessionId, purpose, authType } = stateData

    if (purpose !== 'domain-discovery') {
      return NextResponse.redirect(new URL('/migrations/new?oauth_error=invalid_purpose', request.url))
    }

    // Exchange authorization code for tokens
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXTAUTH_URL}/api/auth/oauth/callback/discovery`
    )

    const { tokens } = await oauth2Client.getToken(code)
    
    // Set credentials for API calls
    oauth2Client.setCredentials(tokens)

    // Discover domains using Admin Directory API
    const admin = google.admin({ version: 'directory_v1', auth: oauth2Client })
    let discoveredDomains: string[] = []
    let adminEmail: string | undefined

    try {
      // Get the authenticated user's info first
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
      const userInfoResponse = await oauth2.userinfo.get()
      adminEmail = userInfoResponse.data.email || undefined
      console.log('Authenticated admin email:', adminEmail)

      // List domains in the organization
      const domainsResponse = await admin.domains.list({
        customer: 'my_customer'
      })

      discoveredDomains = domainsResponse.data.domains?.map(domain => domain.domainName).filter((name): name is string => Boolean(name)) || []
      console.log('Discovered domains:', discoveredDomains)
    } catch (domainError) {
      console.error('Error discovering domains or getting user info:', domainError)
      // Continue with empty domains list - authentication still succeeded
    }

    // Store tokens and discovered domains
    const tokenKey = `discovery_${sessionId}`
    
    globalThis.domainDiscoveryTokens = globalThis.domainDiscoveryTokens || {}
    globalThis.domainDiscoveryTokens[tokenKey] = {
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token || undefined,
      expiresAt: tokens.expiry_date || undefined,
      createdAt: Date.now(),
      discoveredDomains,
      adminEmail
    }

    // Store tokens in MultiAdminAuthManager for cross-tenant scenarios
    if (authType && adminEmail) {
      try {
        const { multiAdminAuthManager } = await import('@/lib/multi-admin-auth-manager');
        
        const adminTokens = {
          access_token: tokens.access_token!,
          refresh_token: tokens.refresh_token || undefined,
          expiry_date: tokens.expiry_date || undefined,
          scope: tokens.scope,
          token_type: tokens.token_type || 'Bearer',
          stored_at: new Date().toISOString()
        };

        // Store with role and session information
        multiAdminAuthManager.storeAdminTokens(
          adminEmail, 
          adminTokens, 
          authType as 'source' | 'target',
          sessionId
        );

        console.log(`Stored ${authType} admin tokens for:`, adminEmail);
      } catch (error) {
        console.error('Error storing admin tokens:', error);
      }
    }

    // Redirect to OAuth success page which will handle closing the popup
    const redirectUrl = new URL('/auth/callback/oauth-success', request.url)
    redirectUrl.searchParams.set('oauth_success', 'true')
    redirectUrl.searchParams.set('domains_discovered', discoveredDomains.join(','))
    redirectUrl.searchParams.set('session_id', sessionId)
    if (authType) {
      redirectUrl.searchParams.set('auth_type', authType)
    }
    if (adminEmail) {
      redirectUrl.searchParams.set('admin_email', adminEmail)
    }
    
    return NextResponse.redirect(redirectUrl)

  } catch (error: any) {
    console.error('OAuth domain discovery callback error:', error)
    return NextResponse.redirect(new URL('/migrations/new?oauth_error=discovery_failed', request.url))
  }
}
