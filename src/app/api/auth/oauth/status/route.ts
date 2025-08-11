import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const domain = searchParams.get('domain')
    const type = searchParams.get('type')

    if (!domain || !type) {
      return NextResponse.json({ error: 'Domain and type are required' }, { status: 400 })
    }

    // Check if we have valid tokens for this domain/type combination
    const tokens = globalThis.oauthTokens || {}
    
    // Find matching token (we might need to search by domain and type since migrationId varies)
    const matchingToken = Object.values(tokens).find(token => 
      token.domain === domain && token.type === type
    )

    if (!matchingToken) {
      return NextResponse.json({ 
        authenticated: false,
        domain,
        type 
      })
    }

    // Check if token is expired
    const isExpired = matchingToken.expiresAt && matchingToken.expiresAt < Date.now()
    
    if (isExpired) {
      return NextResponse.json({ 
        authenticated: false,
        domain,
        type,
        error: 'Token expired'
      })
    }

    return NextResponse.json({
      authenticated: true,
      domain,
      type,
      accessToken: matchingToken.accessToken,
      refreshToken: matchingToken.refreshToken,
      expiresAt: matchingToken.expiresAt
    })

  } catch (error: any) {
    console.error('OAuth status check error:', error)
    return NextResponse.json({
      error: 'Failed to check OAuth status',
      details: error.message
    }, { status: 500 })
  }
}
