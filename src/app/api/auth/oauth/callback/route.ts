import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

// Extend global type to include our oauth tokens
declare global {
  var oauthTokens: Record<string, {
    domain: string
    type: string
    accessToken: string
    refreshToken?: string
    expiresAt?: number
    createdAt: number
  }> | undefined
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error) {
      console.error('OAuth error:', error)
      return NextResponse.redirect(new URL('/migrations/new?oauth_error=' + error, request.url))
    }

    if (!code || !state) {
      return NextResponse.redirect(new URL('/migrations/new?oauth_error=missing_params', request.url))
    }

    // Parse state to get domain and type information
    const stateData = JSON.parse(state)
    const { domain, type, migrationId } = stateData

    // Exchange authorization code for tokens
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXTAUTH_URL}/api/auth/oauth/callback`
    )

    const { tokens } = await oauth2Client.getToken(code)
    
    // Store tokens securely (in a real app, use database or secure session storage)
    // For now, we'll use a simple in-memory store
    const tokenKey = `oauth_${type}_${domain}_${migrationId}`
    
    // In production, store in database or encrypted session
    globalThis.oauthTokens = globalThis.oauthTokens || {}
    globalThis.oauthTokens[tokenKey] = {
      domain,
      type,
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token || undefined,
      expiresAt: tokens.expiry_date || undefined,
      createdAt: Date.now()
    }

    // Redirect back to the migration setup with success
    const redirectUrl = new URL('/migrations/new', request.url)
    redirectUrl.searchParams.set('oauth_success', 'true')
    redirectUrl.searchParams.set('domain', domain)
    redirectUrl.searchParams.set('type', type)
    
    return NextResponse.redirect(redirectUrl)

  } catch (error: any) {
    console.error('OAuth callback error:', error)
    return NextResponse.redirect(new URL('/migrations/new?oauth_error=callback_failed', request.url))
  }
}
