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
        try {
          const users = await gwsService.getUsers(domain || undefined, 50)
          return NextResponse.json({ users, count: users.length })
        } catch (error: any) {
          console.error('Error fetching users:', error)
          
          // Check for domain-wide delegation issues
          if (error.message?.includes('Domain-wide delegation error') || 
              error.message?.includes('unauthorized_client') ||
              error.message?.includes('invalid_grant') ||
              error.code === 401 || error.code === 400) {
            return NextResponse.json({
              error: 'Domain-wide delegation not configured',
              message: `Unable to access users from ${domain || 'the domain'}. This usually means:`,
              details: [
                `The service account is not configured for domain-wide delegation in ${domain || 'the target domain'}`,
                `The admin email ${adminEmail || 'provided'} does not have sufficient permissions for ${domain || 'the domain'}`,
                'Domain-wide delegation needs to be set up in the Google Admin Console'
              ],
              actionRequired: 'Please ensure domain-wide delegation is properly configured for cross-domain access',
              domain: domain,
              adminEmail: adminEmail
            }, { status: 401 })
          }
          
          return NextResponse.json({
            error: 'Failed to fetch users',
            message: error.message || 'Unknown error occurred',
            domain: domain,
            adminEmail: adminEmail
          }, { status: 500 })
        }

      case 'all-users':
        try {
          const includeSuspended = searchParams.get('includeSuspended') === 'true'
          const includeArchived = searchParams.get('includeArchived') === 'true'
          const orgUnitPath = searchParams.get('orgUnitPath')
          
          const allUsers = await gwsService.getAllUsers(domain || undefined, {
            includeSuspended,
            includeArchived,
            orgUnitPath: orgUnitPath || undefined
          })
          
          return NextResponse.json({ 
            users: allUsers, 
            count: allUsers.length,
            metadata: {
              domain: domain,
              includeSuspended,
              includeArchived,
              orgUnitPath,
              timestamp: new Date().toISOString()
            }
          })
        } catch (error: any) {
          console.error('Error fetching all users:', error)
          
          // Check for domain-wide delegation issues
          if (error.message?.includes('Domain-wide delegation error') || 
              error.message?.includes('unauthorized_client') ||
              error.message?.includes('invalid_grant') ||
              error.code === 401 || error.code === 400) {
            return NextResponse.json({
              error: 'Domain-wide delegation not configured',
              message: `Unable to access all users from ${domain || 'the domain'}. This usually means:`,
              details: [
                `The service account is not configured for domain-wide delegation in ${domain || 'the target domain'}`,
                `The admin email ${adminEmail || 'provided'} does not have sufficient permissions for ${domain || 'the domain'}`,
                'Domain-wide delegation needs to be set up in the Google Admin Console'
              ],
              actionRequired: 'Please ensure domain-wide delegation is properly configured for cross-domain access',
              domain: domain,
              adminEmail: adminEmail
            }, { status: 401 })
          }
          
          return NextResponse.json({
            error: 'Failed to fetch all users',
            message: error.message || 'Unknown error occurred',
            domain: domain,
            adminEmail: adminEmail
          }, { status: 500 })
        }

      case 'domains':
        try {
          // Add timeout for domain fetching to prevent hanging requests
          const domainsPromise = gwsService.getDomains();
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Domain fetch timeout')), 12000); // 12 second timeout
          });
          
          const domains = await Promise.race([domainsPromise, timeoutPromise]);
          
          return NextResponse.json({ domains }, {
            headers: {
              'Cache-Control': 'private, max-age=120, s-maxage=120', // Reduced cache time for faster updates
              'X-Cache-Status': 'DYNAMIC'
            }
          });
        } catch (error: any) {
          console.error('Error fetching domains:', error);
          
          // Return a more helpful error response
          if (error.message === 'Domain fetch timeout') {
            return NextResponse.json({
              error: 'Domain loading timed out',
              message: 'The request to fetch domains took too long. This may indicate connectivity issues or authentication problems.',
              suggestion: 'Please check your Google Workspace connection and try again.'
            }, { status: 408 }); // Request Timeout
          }
          
          return NextResponse.json({
            error: 'Failed to fetch domains',
            message: error.message || 'Unknown error occurred',
            suggestion: 'Please ensure you have proper Google Workspace access and try again.'
          }, { status: 500 });
        }

      case 'organization':
        const orgInfo = await gwsService.getOrganizationInfo()
        return NextResponse.json(orgInfo)

      case 'validate':
        const validationResult = await gwsService.validateAccess()
        return NextResponse.json(validationResult)

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
