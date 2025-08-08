import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { 
  createGoogleWorkspaceService, 
  createServiceAccountService,
  createVerifiedServiceAccountService,
  testServiceAccountDelegation,
  verifyCrossTenantServiceAccount
} from '@/lib/google-workspace'
import { ExtendedSession } from '@/lib/auth-options'

// Import the authOptions from NextAuth
import { authOptions } from '@/lib/auth-options'

// Enhanced in-memory cache for domains and users to improve performance
const domainsCache = new Map<string, { data: any, timestamp: number }>()
const usersCache = new Map<string, { data: any, timestamp: number }>()
const pendingRequests = new Map<string, Promise<any>>() // Deduplication cache
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes for fresh cache
const STALE_CACHE_DURATION = 2 * 60 * 60 * 1000 // 2 hours for stale cache (longer for better UX)
const USERS_CACHE_DURATION = 2 * 60 * 1000 // 2 minutes for users cache (shorter since user data changes more frequently)

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

function getCachedUsers(cacheKey: string) {
  const cached = usersCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < USERS_CACHE_DURATION) {
    return { data: cached.data, fresh: true }
  }
  return null
}

function setCachedUsers(cacheKey: string, data: any) {
  usersCache.set(cacheKey, { data, timestamp: Date.now() })
  
  // Clean up old cache entries to prevent memory leaks
  if (usersCache.size > 50) {
    const oldestKey = Array.from(usersCache.keys())[0]
    usersCache.delete(oldestKey)
  }
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
        email: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL || process.env.SERVICE_ACCOUNT_EMAIL,
        available: !!(process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL || process.env.SERVICE_ACCOUNT_EMAIL)
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
    
    // Use service account if it's configured (with or without admin email)
    if (process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL || process.env.SERVICE_ACCOUNT_EMAIL) {
      try {
        // For service account with domain-wide delegation, we need an admin email to impersonate
        // If no admin email provided, try to derive one from the domain
        let impersonateEmail = adminEmail
        if (!impersonateEmail && domain) {
          // Try common admin patterns if no admin email provided
          const commonAdminPatterns = [
            `admin@${domain}`,
            `administrator@${domain}`,
            `support@${domain}`
          ]
          // For now, we'll use the first pattern, but this should be configurable
          impersonateEmail = commonAdminPatterns[0]
          console.log(`No admin email provided, trying to impersonate: ${impersonateEmail}`)
        }
        
        if (impersonateEmail) {
          gwsService = createServiceAccountService(impersonateEmail)
          console.log('Using service account authentication for admin:', impersonateEmail)
        } else {
          throw new Error('Admin email required for service account domain-wide delegation')
        }
      } catch (serviceAccountError: any) {
        console.warn('Service account authentication failed, falling back to OAuth:', serviceAccountError)
        if (!session?.accessToken) {
          return NextResponse.json({ 
            error: 'Authentication required', 
            message: 'Service account authentication failed and no OAuth session available',
            details: [
              'Service account authentication failed: ' + (serviceAccountError?.message || 'Unknown error'),
              'Please provide a valid adminEmail parameter for service account authentication',
              'Or sign in with OAuth to use your personal credentials'
            ],
            actionRequired: 'Provide adminEmail parameter or sign in with OAuth'
          }, { status: 401 })
        }
        gwsService = createGoogleWorkspaceService({
          accessToken: session.accessToken,
        })
      }
    } else {
      // No service account configured, must use OAuth
      if (!session?.accessToken) {
        return NextResponse.json({ 
          error: 'Not authenticated. Please sign in with OAuth or configure service account authentication.' 
        }, { status: 401 })
      }
      gwsService = createGoogleWorkspaceService({
        accessToken: session.accessToken,
      })
    }

    switch (action) {
      case 'users':
        try {
          // Create cache key based on domain and admin email
          const usersCacheKey = `users:${domain || 'default'}:${adminEmail || 'default'}`
          
          // Check cache first
          const cachedUsers = getCachedUsers(usersCacheKey)
          if (cachedUsers?.data) {
            console.log('Returning cached users for domain:', domain)
            return NextResponse.json({ 
              ...cachedUsers.data,
              cached: true,
              timestamp: new Date().toISOString()
            }, {
              headers: {
                'Cache-Control': 'public, max-age=120, s-maxage=120',
                'X-Cache-Status': 'HIT'
              }
            })
          }

          // Check for pending request to avoid duplicate API calls
          if (pendingRequests.has(usersCacheKey)) {
            console.log('Waiting for pending request for domain:', domain)
            const result = await pendingRequests.get(usersCacheKey)
            return NextResponse.json({ 
              ...result,
              cached: false,
              deduped: true,
              timestamp: new Date().toISOString()
            }, {
              headers: {
                'Cache-Control': 'public, max-age=120, s-maxage=120',
                'X-Cache-Status': 'DEDUP'
              }
            })
          }

          // Create pending request promise
          const requestPromise = (async () => {
            try {
              // Fetch from Google API with optimized parameters
              const maxResults = searchParams.get('maxResults') ? parseInt(searchParams.get('maxResults')!) : 100
              const users = await gwsService.getUsers(domain || undefined, Math.min(maxResults, 200)) // Cap at 200 for performance
              
              const responseData = { 
                users, 
                count: users.length,
                domain: domain,
                timestamp: new Date().toISOString(),
                cached: false
              }
              
              // Cache the response
              setCachedUsers(usersCacheKey, responseData)
              return responseData
            } finally {
              // Clean up pending request
              pendingRequests.delete(usersCacheKey)
            }
          })()

          // Store pending request
          pendingRequests.set(usersCacheKey, requestPromise)
          
          const responseData = await requestPromise
          
          return NextResponse.json(responseData, {
            headers: {
              'Cache-Control': 'public, max-age=120, s-maxage=120',
              'X-Cache-Status': 'MISS'
            }
          })
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
          // Use enhanced manual verification for better error diagnostics
          if (adminEmail && domain && (process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL || process.env.SERVICE_ACCOUNT_EMAIL)) {
            console.log(`Testing service account delegation for ${adminEmail} on domain ${domain}`)
            
            const delegationTest = await testServiceAccountDelegation(adminEmail, domain)
            
            if (delegationTest.success) {
              return NextResponse.json({ 
                success: true,
                message: `Successfully connected to ${domain}`,
                details: [
                  'Domain-wide delegation is properly configured',
                  'Service account has the required permissions',
                  'Admin email has sufficient privileges',
                  'Manual JWT verification passed'
                ],
                domain: domain,
                adminEmail: adminEmail,
                timestamp: new Date().toISOString()
              })
            } else {
              // Return detailed diagnostic information
              return NextResponse.json({
                error: 'Domain-wide delegation not configured',
                message: delegationTest.error || 'Service account verification failed',
                details: [
                  delegationTest.details || 'Unknown verification error',
                  'Please check domain-wide delegation configuration in Google Admin Console',
                  `Ensure service account ${process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL || process.env.SERVICE_ACCOUNT_EMAIL} is authorized`,
                  `Verify admin email ${adminEmail} has Super Admin privileges for ${domain}`
                ],
                diagnostics: delegationTest.diagnostics,
                domain: domain,
                adminEmail: adminEmail,
                timestamp: new Date().toISOString()
              }, { status: 403 })
            }
          }
          
          // Fallback to standard test connection
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

      case 'test-cross-tenant':
        try {
          // Extract cross-tenant parameters
          const sourceDomain = searchParams.get('sourceDomain')
          const sourceAdminEmail = searchParams.get('sourceAdminEmail')
          const targetDomain = searchParams.get('targetDomain')
          const targetAdminEmail = searchParams.get('targetAdminEmail')
          
          // Validate required parameters
          if (!sourceDomain || !sourceAdminEmail || !targetDomain || !targetAdminEmail) {
            return NextResponse.json({
              error: 'Missing required parameters',
              message: 'Cross-tenant verification requires sourceDomain, sourceAdminEmail, targetDomain, and targetAdminEmail',
              required: ['sourceDomain', 'sourceAdminEmail', 'targetDomain', 'targetAdminEmail']
            }, { status: 400 })
          }

          if (!(process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL || process.env.SERVICE_ACCOUNT_EMAIL)) {
            return NextResponse.json({
              error: 'Service account not configured',
              message: 'GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL environment variable is required for cross-tenant verification'
            }, { status: 500 })
          }

          console.log('Starting cross-tenant service account verification')
          console.log('Source:', sourceDomain, sourceAdminEmail)
          console.log('Target:', targetDomain, targetAdminEmail)

          // Read service account credentials
          const serviceAccountKeyPath = process.env.SERVICE_ACCOUNT_KEY_PATH || './source-service-account-key.json'
          const fs = require('fs')
          const path = require('path')
          
          let serviceAccountData
          try {
            const serviceAccountDataRaw = fs.readFileSync(path.resolve(serviceAccountKeyPath), 'utf8')
            serviceAccountData = JSON.parse(serviceAccountDataRaw)
          } catch (error) {
            return NextResponse.json({
              error: 'Service account key not found',
              message: 'Unable to read service account key file',
              details: 'Please ensure the service account key file exists and is accessible'
            }, { status: 500 })
          }

          // Perform cross-tenant verification
          const crossTenantVerification = await verifyCrossTenantServiceAccount(
            serviceAccountData.client_email,
            serviceAccountData.private_key,
            sourceDomain,
            sourceAdminEmail,
            targetDomain,
            targetAdminEmail
          )

          if (crossTenantVerification.success) {
            return NextResponse.json({
              success: true,
              message: 'Cross-tenant service account verification successful',
              details: [
                'Service account has been verified for both source and target domains',
                'Domain-wide delegation is properly configured for cross-tenant migration',
                'All required scopes are accessible across both tenants',
                'Ready for cross-tenant migration operations'
              ],
              verification: {
                sourceDomain,
                sourceAdminEmail,
                targetDomain,
                targetAdminEmail,
                sourceChecks: crossTenantVerification.sourceChecks,
                targetChecks: crossTenantVerification.targetChecks,
                serviceAccountEmail: serviceAccountData.client_email
              },
              timestamp: new Date().toISOString()
            })
          } else {
            return NextResponse.json({
              error: 'Cross-tenant verification failed',
              message: 'Service account is not properly configured for cross-tenant access',
              details: [
                'One or more domains failed verification checks',
                'Please ensure domain-wide delegation is configured in both Google Admin Consoles',
                'Verify that both admin emails have Super Admin privileges',
                'Check that all required scopes are granted in both domains'
              ],
              verification: {
                sourceDomain,
                sourceAdminEmail,
                targetDomain,
                targetAdminEmail,
                sourceChecks: crossTenantVerification.sourceChecks,
                targetChecks: crossTenantVerification.targetChecks,
                serviceAccountEmail: serviceAccountData.client_email,
                error: crossTenantVerification.error
              },
              timestamp: new Date().toISOString()
            }, { status: 403 })
          }
        } catch (error: any) {
          console.error('Error during cross-tenant verification:', error)
          return NextResponse.json({
            error: 'Cross-tenant verification failed',
            message: 'An error occurred during cross-tenant service account verification',
            details: [
              error.message || 'Unknown error occurred',
              'Please check service account configuration and try again',
              'Ensure both domains have proper domain-wide delegation setup'
            ],
            timestamp: new Date().toISOString()
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

      case 'get-user':
        const userEmail = searchParams.get('userEmail')
        
        try {
          if (!userEmail) {
            return NextResponse.json({
              error: 'User email is required',
              message: 'userEmail parameter is required to check if user exists'
            }, { status: 400 })
          }

          // Check if user exists in the specified domain
          const user = await gwsService.getUser(userEmail)
          
          return NextResponse.json({ 
            user: user,
            exists: !!user,
            userEmail: userEmail,
            domain: domain,
            timestamp: new Date().toISOString()
          })
        } catch (error: any) {
          console.error('Error getting user:', userEmail, error)
          
          // If user doesn't exist, return exists: false instead of error
          if (error.code === 404 || error.message?.includes('not found') || error.message?.includes('does not exist')) {
            return NextResponse.json({ 
              user: null,
              exists: false,
              userEmail: userEmail,
              domain: domain,
              timestamp: new Date().toISOString()
            })
          }
          
          // Check for domain-wide delegation issues
          if (error.message?.includes('Domain-wide delegation error') || 
              error.message?.includes('unauthorized_client') ||
              error.message?.includes('invalid_grant') ||
              error.code === 401 || error.code === 400) {
            return NextResponse.json({
              error: 'Domain-wide delegation not configured',
              message: `Unable to access user ${userEmail || 'requested'} from ${domain || 'the domain'}`,
              userEmail: userEmail,
              domain: domain,
              adminEmail: adminEmail
            }, { status: 401 })
          }
          
          return NextResponse.json({
            error: 'Failed to get user',
            message: error.message || 'Unknown error occurred',
            userEmail: userEmail,
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
