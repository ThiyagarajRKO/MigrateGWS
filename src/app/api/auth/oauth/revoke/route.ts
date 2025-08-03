import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { google } from 'googleapis'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { domain, type } = body

    if (!domain || !type) {
      return NextResponse.json({ error: 'Domain and type are required' }, { status: 400 })
    }

    const tokens = globalThis.oauthTokens || {}
    
    // Find and remove matching token
    const tokenKeys = Object.keys(tokens).filter(key => {
      const token = tokens[key]
      return token.domain === domain && token.type === type
    })

    if (tokenKeys.length === 0) {
      return NextResponse.json({ error: 'No token found for this domain/type' }, { status: 404 })
    }

    // Revoke token with Google
    for (const tokenKey of tokenKeys) {
      const token = tokens[tokenKey]
      
      try {
        // Revoke the token with Google
        const oauth2Client = new google.auth.OAuth2()
        oauth2Client.setCredentials({
          access_token: token.accessToken,
          refresh_token: token.refreshToken
        })
        
        await oauth2Client.revokeCredentials()
      } catch (error) {
        console.error('Error revoking token with Google:', error)
        // Continue with local cleanup even if Google revocation fails
      }

      // Remove from local storage
      delete tokens[tokenKey]
    }

    return NextResponse.json({
      success: true,
      message: `OAuth token revoked for ${domain} (${type})`
    })

  } catch (error: any) {
    console.error('OAuth revocation error:', error)
    return NextResponse.json({
      error: 'Failed to revoke OAuth token',
      details: error.message
    }, { status: 500 })
  }
}
