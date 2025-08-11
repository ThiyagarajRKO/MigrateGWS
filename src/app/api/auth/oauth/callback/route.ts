import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

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

    // Create a response that will close the popup and notify parent window
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Authentication Complete</title>
          <script>
            // Send success message to parent window
            if (window.opener) {
              window.opener.postMessage({
                type: 'oauth_success',
                domain: '${domain}',
                authType: '${type}',
                success: true
              }, window.location.origin);
              
              // Close popup after a short delay
              setTimeout(() => {
                window.close();
              }, 1000);
            } else {
              // Fallback: redirect to main page
              window.location.href = '/migrations/new?oauth_success=true&domain=${domain}&type=${type}';
            }
          </script>
        </head>
        <body>
          <div style="text-align: center; padding: 20px; font-family: Arial, sans-serif;">
            <h2>✅ Authentication Successful</h2>
            <p>Authenticated as ${type} admin for domain: <strong>${domain}</strong></p>
            <p>This window will close automatically...</p>
          </div>
        </body>
      </html>
    `;

    const response = new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
        'Cross-Origin-Embedder-Policy': 'unsafe-none'
      }
    });

    return response;

  } catch (error: any) {
    console.error('OAuth callback error:', error)
    
    // Create an error response that will close the popup and notify parent window
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Authentication Error</title>
          <script>
            // Send error message to parent window
            if (window.opener) {
              window.opener.postMessage({
                type: 'oauth_error',
                error: 'callback_failed',
                message: 'Authentication failed. Please try again.',
                success: false
              }, window.location.origin);
              
              // Close popup after a short delay
              setTimeout(() => {
                window.close();
              }, 2000);
            } else {
              // Fallback: redirect to main page
              window.location.href = '/migrations/new?oauth_error=callback_failed';
            }
          </script>
        </head>
        <body>
          <div style="text-align: center; padding: 20px; font-family: Arial, sans-serif;">
            <h2>❌ Authentication Failed</h2>
            <p>There was an error during authentication. Please try again.</p>
            <p>This window will close automatically...</p>
          </div>
        </body>
      </html>
    `;

    const response = new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
        'Cross-Origin-Embedder-Policy': 'unsafe-none'
      }
    });

    return response;
  }
}
