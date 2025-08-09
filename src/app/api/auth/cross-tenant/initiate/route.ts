import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, authType } = body;

    if (!sessionId || !authType) {
      return NextResponse.json(
        { error: 'Missing required parameters: sessionId and authType' },
        { status: 400 }
      );
    }

    // Validate authType
    if (!['source', 'target'].includes(authType)) {
      return NextResponse.json(
        { error: 'authType must be either "source" or "target"' },
        { status: 400 }
      );
    }

    // Check for required environment variables
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.NEXTAUTH_URL) {
      console.error('Missing required environment variables for OAuth');
      return NextResponse.json(
        { error: 'OAuth configuration incomplete' },
        { status: 500 }
      );
    }

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXTAUTH_URL}/api/auth/oauth/callback`
    );

    // Define OAuth scopes for Google Workspace migration
    const scopes = [
      'https://www.googleapis.com/auth/admin.directory.user',
      'https://www.googleapis.com/auth/admin.directory.domain',
      'https://www.googleapis.com/auth/admin.directory.group',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/contacts.readonly',
      'openid',
      'email',
      'profile'
    ];

    // Create state parameter with session and auth type info
    const state = JSON.stringify({
      sessionId,
      authType,
      timestamp: Date.now()
    });

    // Generate authorization URL
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: state,
      prompt: 'consent', // Force consent to ensure refresh token
      include_granted_scopes: true
    });

    console.log(`✅ Generated OAuth URL for ${authType} authentication (session: ${sessionId})`);

    return NextResponse.json({
      success: true,
      authUrl,
      sessionId,
      authType
    });

  } catch (error) {
    console.error('❌ Error initiating cross-tenant OAuth:', error);
    return NextResponse.json(
      { 
        error: 'Failed to initiate OAuth flow',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
