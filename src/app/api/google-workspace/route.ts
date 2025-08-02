import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { createGoogleWorkspaceService, createServiceAccountService } from '@/lib/google-workspace'
import { ExtendedSession } from '@/lib/auth-options'

// Import the authOptions from NextAuth
import { authOptions } from '@/lib/auth-options'

// Enhanced in-memory cache for domains to improve performance
const domainsCache = new Map<string, { data: any, timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes for fresh cache
const STALE_CACHE_DURATION = 2 * 60 * 60 * 1000 // 2 hours for stale cache (longer for better UX)

function getCachedDomains(cacheKey: string) {
  const cached = domainsCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return { data: cached.data, fresh: true }
  }
  // Return stale data if available (better than no data)
  if (cached && Date.now() - cached.timestamp < STALE_CACHE_DURATION) {
    return { data: cached.data, fresh: false }
  }
  return null
}

function setCachedDomains(cacheKey: string, data: any) {
  domainsCache.set(cacheKey, { data, timestamp: Date.now() })
}

// Background refresh function
async function refreshDomainsCache(cacheKey: string, gwsService: any) {
  try {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Background refresh timeout')), 5000);
    });
    
    const domains = await Promise.race([gwsService.getDomains(), timeoutPromise]);
    setCachedDomains(cacheKey, domains);
    console.log('Background cache refreshed for key:', cacheKey);
  } catch (error) {
    console.warn('Background cache refresh failed:', error);
  }
}

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

      case 'test-connection':
        try {
          // Simple test to verify domain-wide delegation is working
          const testResult = await gwsService.testConnection(domain || undefined)
          
          return NextResponse.json({ 
            success: true,
            message: `Successfully connected to ${domain}`,
            details: [
              'Domain-wide delegation is properly configured',
              'Service account has the required permissions',
              'Admin email has sufficient privileges'
            ],
            domain: domain,
            adminEmail: adminEmail,
            timestamp: new Date().toISOString()
          })
        } catch (error: any) {
          console.error('Error testing connection:', error)
          
          // Return delegation configuration error details
          return NextResponse.json({
            error: 'Domain-wide delegation not configured',
            message: `Unable to connect to ${domain || 'the domain'}. This usually means:`,
            details: [
              `The service account is not configured for domain-wide delegation in ${domain || 'the target domain'}`,
              `The admin email ${adminEmail || 'provided'} does not have sufficient permissions for ${domain || 'the domain'}`,
              'Domain-wide delegation needs to be set up in the Google Admin Console',
              'Required OAuth scopes may not be granted'
            ],
            actionRequired: 'Please ensure domain-wide delegation is properly configured',
            domain: domain,
            adminEmail: adminEmail
          }, { status: 401 })
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
          // Create cache key based on admin email or session
          const cacheKey = adminEmail || session?.user?.email || 'default'
          
          // Check cache first
          const cachedResult = getCachedDomains(cacheKey)
          if (cachedResult?.fresh) {
            return NextResponse.json({ domains: cachedResult.data }, {
              headers: {
                'Cache-Control': 'private, max-age=600, s-maxage=600', // Longer cache for fresh data
                'X-Cache-Status': 'FRESH-HIT'
              }
            });
          }

          // If we have stale data, return it immediately and refresh in background
          if (cachedResult?.data) {
            // Return stale data immediately
            const staleResponse = NextResponse.json({ domains: cachedResult.data }, {
              headers: {
                'Cache-Control': 'private, max-age=60, s-maxage=60', // Shorter cache for stale data
                'X-Cache-Status': 'STALE-HIT'
              }
            });

            // Refresh cache in background (don't await)
            refreshDomainsCache(cacheKey, gwsService).catch(err => 
              console.warn('Background cache refresh failed:', err)
            );

            return staleResponse;
          }

          // No cache available, fetch with timeout
          const domainsPromise = gwsService.getDomains();
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Domain fetch timeout')), 5000); // Reduced to 5 seconds
          });
          
          const domains = await Promise.race([domainsPromise, timeoutPromise]);
          
          // Cache the result
          setCachedDomains(cacheKey, domains)
          
          return NextResponse.json({ domains }, {
            headers: {
              'Cache-Control': 'private, max-age=600, s-maxage=600',
              'X-Cache-Status': 'MISS'
            }
          });
        } catch (error: any) {
          console.error('Error fetching domains:', error);
          
          // Try to return stale cache as fallback
          const cacheKey = adminEmail || session?.user?.email || 'default'
          const staleCacheResult = getCachedDomains(cacheKey)
          if (staleCacheResult?.data) {
            console.log('Returning stale cache due to error')
            return NextResponse.json({ domains: staleCacheResult.data }, {
              headers: {
                'Cache-Control': 'private, max-age=60, s-maxage=60',
                'X-Cache-Status': 'ERROR-STALE'
              }
            });
          }
          
          // Return a more helpful error response
          if (error.message === 'Domain fetch timeout') {
            return NextResponse.json({
              error: 'Domain loading timed out',
              message: 'The request to fetch domains took too long. Using default domain extraction.',
              suggestion: 'Domains will be extracted from your email address.',
              domains: [] // Return empty array as fallback
            }, { 
              status: 408,
              headers: {
                'Cache-Control': 'private, max-age=60, s-maxage=60'
              }
            });
          }
          
          return NextResponse.json({
            error: 'Failed to fetch domains',
            message: error.message || 'Unknown error occurred',
            suggestion: 'Please ensure you have proper Google Workspace access and try again.',
            domains: [] // Return empty array as fallback
          }, { 
            status: 500,
            headers: {
              'Cache-Control': 'private, max-age=60, s-maxage=60'
            }
          });
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

      case 'create-user':
        try {
          const { domain, adminEmail, userData } = data;
          
          // Use service account authentication for user creation
          const gwsService = adminEmail 
            ? createServiceAccountService(adminEmail)
            : createGoogleWorkspaceService({ accessToken: session.accessToken });
          
          const newUser = await gwsService.createUser(userData);
          return NextResponse.json({ user: newUser, success: true });
        } catch (error: any) {
          console.error('Error creating user:', error);
          return NextResponse.json({
            error: 'Failed to create user',
            message: error.message || 'Unknown error occurred',
            details: error.details || []
          }, { status: 500 });
        }

      case 'check-user':
        try {
          const { email, domain, adminEmail } = data;
          
          const gwsService = adminEmail 
            ? createServiceAccountService(adminEmail)
            : createGoogleWorkspaceService({ accessToken: session.accessToken });
          
          const user = await gwsService.getUser(email);
          return NextResponse.json({ user, exists: !!user });
        } catch (error: any) {
          if (error.code === 404) {
            return NextResponse.json({ user: null, exists: false });
          }
          
          console.error('Error checking user:', error);
          return NextResponse.json({
            error: 'Failed to check user',
            message: error.message || 'Unknown error occurred'
          }, { status: 500 });
        }

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
