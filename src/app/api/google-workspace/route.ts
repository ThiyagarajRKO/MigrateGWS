import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { createGoogleWorkspaceService, createServiceAccountService } from '@/lib/google-workspace'
import { ExtendedSession } from '@/lib/auth-options'

// Import the authOptions from NextAuth
import { authOptions } from '@/lib/auth-options'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const action = searchParams.get('action')

    // Handle service account info without authentication
    if (action === 'service-account-info') {
      const { getServiceAccountClientId } = await import('@/lib/google-workspace')
      const clientId = getServiceAccountClientId()
      return NextResponse.json({ 
        clientId, 
        email: process.env.SERVICE_ACCOUNT_EMAIL,
        available: !!process.env.SERVICE_ACCOUNT_EMAIL 
      }, { 
        headers: { 
          'Cache-Control': 'public, max-age=300, s-maxage=300',
          'X-Cache-Status': 'STATIC'
        } 
      })
    }

    const session = await getServerSession(authOptions) as ExtendedSession | null
    const domain = searchParams.get('domain')
    const adminEmail = searchParams.get('adminEmail')

    // Try service account authentication first, fallback to OAuth
    let gwsService
    
    if (adminEmail && process.env.SERVICE_ACCOUNT_EMAIL) {
      try {
        gwsService = createServiceAccountService(adminEmail)
        console.log('Using service account authentication for admin:', adminEmail)
      } catch (serviceAccountError) {
        console.warn('Service account authentication failed, falling back to OAuth:', serviceAccountError)
        if (!session?.accessToken) {
          return NextResponse.json({ 
            error: 'Authentication required. Please provide adminEmail for service account auth or sign in with OAuth.' 
          }, { status: 401 })
        }
        gwsService = createGoogleWorkspaceService({
          accessToken: session.accessToken,
        })
      }
    } else {
      if (!session?.accessToken) {
        return NextResponse.json({ 
          error: 'Not authenticated. Please sign in or provide adminEmail parameter for service account authentication.' 
        }, { status: 401 })
      }
      gwsService = createGoogleWorkspaceService({
        accessToken: session.accessToken,
      })
    }

    switch (action) {
      case 'users':
        const users = await gwsService.getUsers(domain || undefined, 50)
        return NextResponse.json({ users, count: users.length })

      case 'domains':
        const domains = await gwsService.getDomains()
        return NextResponse.json({ domains })

      case 'organization':
        const orgInfo = await gwsService.getOrganizationInfo()
        return NextResponse.json(orgInfo)

      case 'validate':
        const isValid = await gwsService.validateAccess()
        return NextResponse.json({ valid: isValid })

      case 'gmail':
        const userId = searchParams.get('userId') || 'me'
        const messages = await gwsService.getGmailMessages(userId, 10)
        return NextResponse.json({ messages, count: messages.length })

      case 'drive':
        const driveFiles = await gwsService.getDriveFiles(undefined, 20)
        return NextResponse.json({ files: driveFiles, count: driveFiles.length })

      case 'calendars':
        const calendars = await gwsService.getCalendars()
        return NextResponse.json({ calendars, count: calendars.length })

      case 'contacts':
        const contacts = await gwsService.getContacts(20)
        return NextResponse.json({ contacts, count: contacts.length })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Google Workspace API error:', error)
    return NextResponse.json(
      { error: 'Failed to access Google Workspace API', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession | null
    
    if (!session?.accessToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { action, data } = body

    const gwsService = createGoogleWorkspaceService({
      accessToken: session.accessToken,
    })

    switch (action) {
      case 'test-migration':
        // This would be where we implement actual migration logic
        const testResult = {
          migrationId: `test-${Date.now()}`,
          status: 'initiated',
          sourceDomain: data.sourceDomain,
          targetDomain: data.targetDomain,
          services: data.services,
          userCount: data.userMappings?.length || 0,
          estimatedDuration: '2-4 hours',
        }
        return NextResponse.json(testResult)

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Google Workspace API error:', error)
    return NextResponse.json(
      { error: 'Failed to process request', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
