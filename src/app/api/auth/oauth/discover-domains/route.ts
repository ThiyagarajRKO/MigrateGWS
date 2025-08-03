import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }

    const tokenKey = `discovery_${sessionId}`
    const tokenData = globalThis.domainDiscoveryTokens?.[tokenKey]

    if (!tokenData) {
      return NextResponse.json({ 
        authenticated: false,
        discoveredDomains: []
      })
    }

    // Check if token is still valid
    const isExpired = tokenData.expiresAt && tokenData.expiresAt < Date.now()
    
    return NextResponse.json({
      authenticated: !isExpired,
      discoveredDomains: tokenData.discoveredDomains || [],
      expiresAt: tokenData.expiresAt,
      createdAt: tokenData.createdAt
    })

  } catch (error) {
    console.error('Error checking domain discovery status:', error)
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('=== POST /api/auth/oauth/discover-domains ===')
    const body = await request.json()
    console.log('Request body:', body)
    
    const { sessionId, authType, step } = body

    if (!sessionId) {
      console.log('❌ Missing sessionId')
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }

    console.log('✅ Processing request for:', { sessionId, authType, step })
    
    // Check environment variables
    if (!process.env.GOOGLE_CLIENT_ID) {
      console.log('❌ Missing GOOGLE_CLIENT_ID')
      return NextResponse.json({ error: 'OAuth not configured - missing client ID' }, { status: 500 })
    }
    
    if (!process.env.NEXTAUTH_URL) {
      console.log('❌ Missing NEXTAUTH_URL')
      return NextResponse.json({ error: 'OAuth not configured - missing base URL' }, { status: 500 })
    }

    console.log('✅ Environment variables present')
    console.log('- GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID?.substring(0, 10) + '...')
    console.log('- NEXTAUTH_URL:', process.env.NEXTAUTH_URL)

    // Generate OAuth URL for incremental authorization
    const state = JSON.stringify({
      sessionId,
      authType: authType || 'single', // 'single', 'source', or 'target'
      purpose: 'domain-discovery',
      step: step || 'initial', // 'initial', 'drive', 'calendar', 'gmail', etc.
      timestamp: Date.now()
    })

    // Incremental authorization: Start with minimal scopes and add more as needed
    const scopeGroups = {
      initial: [
        'https://www.googleapis.com/auth/admin.directory.domain.readonly',
        'https://www.googleapis.com/auth/admin.directory.user.readonly',
        'https://www.googleapis.com/auth/userinfo.email'
      ],
      gmail: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.modify'
      ],
      drive: [
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/drive.file'
      ],
      calendar: [
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/calendar'
      ],
      contacts: [
        'https://www.googleapis.com/auth/contacts.readonly',
        'https://www.googleapis.com/auth/contacts'
      ]
    }

    // Get scopes for the current step
    const currentScopes = scopeGroups[step as keyof typeof scopeGroups] || scopeGroups.initial

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    authUrl.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID!)
    authUrl.searchParams.set('redirect_uri', `${process.env.NEXTAUTH_URL}/api/auth/oauth/callback/discovery`)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', currentScopes.join(' '))
    authUrl.searchParams.set('state', state)
    authUrl.searchParams.set('access_type', 'offline')
    
    console.log('✅ Generated OAuth URL')
    console.log('- Redirect URI:', `${process.env.NEXTAUTH_URL}/api/auth/oauth/callback/discovery`)
    console.log('- Scopes:', currentScopes.join(' '))
    console.log('- State:', state)
    
    // For incremental authorization
    if (step && step !== 'initial') {
      authUrl.searchParams.set('include_granted_scopes', 'true')
      authUrl.searchParams.set('prompt', 'consent') // Only prompt for new scopes
    } else {
      authUrl.searchParams.set('prompt', 'consent')
    }

    const response = {
      authUrl: authUrl.toString(),
      scopes: currentScopes,
      step: step || 'initial'
    }
    
    console.log('✅ Returning successful response')
    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Error initiating domain discovery OAuth:', error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json({ 
      error: 'Failed to initiate OAuth',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
