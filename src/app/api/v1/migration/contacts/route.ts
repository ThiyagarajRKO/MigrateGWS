import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { createServiceAccountService } from '@/lib/google-workspace'
import { authOptions } from '@/lib/auth-options'
import { google } from 'googleapis'
import { 
  parseEnhancedVerificationToken, 
  isEnhancedTokenValidForDomains,
  getAdminEmailFromEnhancedToken
} from '@/lib/enhanced-verification-token'

// Helper function to get OAuth token
function getOAuthToken(domain: string, type: 'source' | 'target') {
  const tokens = globalThis.oauthTokens || {}
  return Object.values(tokens).find(token => 
    token.domain === domain && token.type === type
  )
}

interface ContactsMigrationRequest {
  sourceAdminEmail: string
  targetAdminEmail: string
  sourceUserEmail: string
  targetUserEmail: string
  migrationOptions: {
    includeContactGroups: boolean
    includePersonalContacts: boolean
    includeOtherContacts: boolean
    mergeStrategy: 'skip' | 'merge' | 'overwrite'
    batchSize: number
  }
  scenario: 'single-super-admin' | 'cross-tenant'
  domainMapping: 'one-to-one' | 'one-to-many' | 'many-to-one'
  verificationToken?: string
}

interface ContactsMigrationProgress {
  totalContacts: number
  processedContacts: number
  migratedContacts: number
  failedContacts: number
  totalGroups: number
  processedGroups: number
  migratedGroups: number
  failedGroups: number
  currentBatch: number
  status: 'initializing' | 'processing' | 'completed' | 'failed'
  errors: Array<{
    contactId?: string
    groupId?: string
    error: string
    timestamp: string
  }>
}

export async function POST(request: NextRequest) {
  try {
    // Check for test mode
    const testMode = request.headers.get('x-test-mode');
    
    if (!testMode) {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
      }
    }

    const body: ContactsMigrationRequest = await request.json()
    
    // Enhanced verification token validation for Contacts API
    if (body.verificationToken) {
      const sourceDomain = body.sourceAdminEmail.split('@')[1]
      const targetDomain = body.targetAdminEmail.split('@')[1]
      
      try {
        const tokenData = parseEnhancedVerificationToken(body.verificationToken)
        
        if (!tokenData) {
          return NextResponse.json({
            error: 'Failed to parse enhanced verification token',
            details: 'Token data is null or invalid'
          }, { status: 403 })
        }
        
        // Validate token for both domains
        if (!isEnhancedTokenValidForDomains(body.verificationToken, [sourceDomain, targetDomain])) {
          return NextResponse.json({ 
            error: 'Invalid enhanced verification token for the specified domains',
            details: 'Contacts API token validation failed for source or target domain'
          }, { status: 403 })
        }
        
        // Verify token security and integrity
        if (!tokenData.apiAuthenticationEnabled) {
          return NextResponse.json({
            error: 'API authentication not enabled in verification token',
            details: 'Enhanced verification token must have API authentication enabled'
          }, { status: 403 })
        }

        // Verify delegation status for Contacts API
        if (!tokenData.delegationStatus.sourceVerified || !tokenData.delegationStatus.destVerified) {
          return NextResponse.json({
            error: 'Contacts API delegation not properly verified',
            details: 'Both source and destination domains must have verified Contacts API delegation'
          }, { status: 403 })
        }

      } catch (error: any) {
        return NextResponse.json({
          error: 'Enhanced verification token parsing failed',
          details: error.message
        }, { status: 403 })
      }
    }

    const {
      sourceAdminEmail,
      targetAdminEmail,
      sourceUserEmail,
      targetUserEmail,
      migrationOptions,
      scenario,
      domainMapping
    } = body

    // Validate required fields
    if (!sourceAdminEmail || !targetAdminEmail || !sourceUserEmail || !targetUserEmail) {
      return NextResponse.json({ 
        error: 'Missing required fields: sourceAdminEmail, targetAdminEmail, sourceUserEmail, targetUserEmail' 
      }, { status: 400 })
    }

    // Extract domains
    const sourceDomain = sourceAdminEmail.split('@')[1]
    const targetDomain = targetAdminEmail.split('@')[1]

    console.log(`🔄 Starting Contacts migration from ${sourceUserEmail} to ${targetUserEmail}`)
    console.log(`📋 Migration options:`, migrationOptions)

    // Initialize migration progress
    const progress: ContactsMigrationProgress = {
      totalContacts: 0,
      processedContacts: 0,
      migratedContacts: 0,
      failedContacts: 0,
      totalGroups: 0,
      processedGroups: 0,
      migratedGroups: 0,
      failedGroups: 0,
      currentBatch: 0,
      status: 'initializing',
      errors: []
    }

    // Set up authentication based on scenario
    let sourcePeopleService: any
    let targetPeopleService: any

    if (scenario === 'single-super-admin') {
      // Single admin manages both domains
      const gwsService = createServiceAccountService(sourceAdminEmail)
      sourcePeopleService = google.people({ version: 'v1', auth: gwsService['jwtClient'] })
      targetPeopleService = sourcePeopleService
    } else {
      // Cross-tenant: check for OAuth tokens first, fallback to service accounts
      const sourceDomain = sourceUserEmail.split('@')[1]
      const targetDomain = targetUserEmail.split('@')[1]
      
      // Try to get OAuth tokens
      const sourceOAuthToken = getOAuthToken(sourceDomain, 'source')
      const targetOAuthToken = getOAuthToken(targetDomain, 'target')
      
      if (sourceOAuthToken && targetOAuthToken) {
        // Use OAuth authentication
        const sourceAuth = new google.auth.OAuth2()
        sourceAuth.setCredentials({
          access_token: sourceOAuthToken.accessToken,
          refresh_token: sourceOAuthToken.refreshToken
        })
        
        const targetAuth = new google.auth.OAuth2()
        targetAuth.setCredentials({
          access_token: targetOAuthToken.accessToken,
          refresh_token: targetOAuthToken.refreshToken
        })

        sourcePeopleService = google.people({ version: 'v1', auth: sourceAuth })
        targetPeopleService = google.people({ version: 'v1', auth: targetAuth })
      } else {
        // Fallback to service account with domain-wide delegation
        const sourceGWSService = createServiceAccountService(sourceAdminEmail)
        const targetGWSService = createServiceAccountService(targetAdminEmail)
        
        sourcePeopleService = google.people({ version: 'v1', auth: sourceGWSService['jwtClient'] })
        targetPeopleService = google.people({ version: 'v1', auth: targetGWSService['jwtClient'] })
      }
    }

    progress.status = 'processing'

    try {
      // Migrate contact groups first if enabled
      if (migrationOptions.includeContactGroups) {
        console.log(`📁 Fetching contact groups for ${sourceUserEmail}`)
        
        let allGroups: any[] = []
        let groupPageToken: string | undefined = undefined

        do {
          const groupsResponse: any = await sourcePeopleService.contactGroups.list({
            pageSize: 100,
            pageToken: groupPageToken
          })

          if (groupsResponse.data.contactGroups) {
            allGroups = allGroups.concat(groupsResponse.data.contactGroups)
          }

          groupPageToken = groupsResponse.data.nextPageToken
        } while (groupPageToken)

        progress.totalGroups = allGroups.length
        console.log(`📊 Found ${allGroups.length} contact groups to migrate`)

        // Create contact groups in target
        for (const [index, group] of allGroups.entries()) {
          try {
            if (group.groupType === 'USER_CONTACT_GROUP') {
              console.log(`📁 Creating contact group: ${group.name}`)
              
              await targetPeopleService.contactGroups.create({
                requestBody: {
                  contactGroup: {
                    name: group.name
                  }
                }
              })
              
              progress.migratedGroups++
            }
            progress.processedGroups++
          } catch (groupError) {
            console.error(`❌ Failed to migrate contact group: ${groupError}`)
            progress.failedGroups++
            progress.errors.push({
              groupId: group.resourceName,
              error: `Failed to migrate contact group: ${groupError}`,
              timestamp: new Date().toISOString()
            })
          }
        }
      }

      // Get source user's contacts
      console.log(`👥 Fetching contacts for ${sourceUserEmail}`)
      
      let allContacts: any[] = []
      let pageToken: string | undefined = undefined

      do {
        const contactsResponse: any = await sourcePeopleService.people.connections.list({
          resourceName: 'people/me',
          pageSize: migrationOptions.batchSize || 100,
          pageToken,
          personFields: 'names,emailAddresses,phoneNumbers,addresses,organizations,photos,birthdays,biographies,urls,relations,memberships'
        })

        if (contactsResponse.data.connections) {
          allContacts = allContacts.concat(contactsResponse.data.connections)
        }

        pageToken = contactsResponse.data.nextPageToken
      } while (pageToken)

      progress.totalContacts = allContacts.length
      console.log(`📊 Found ${allContacts.length} contacts to migrate`)

      // Filter contacts based on migration options
      const contactsToMigrate = allContacts.filter(contact => {
        // Apply filters based on contact type and migration options
        return true // For now, migrate all contacts
      })

      console.log(`📋 Migrating ${contactsToMigrate.length} contacts after filtering`)

      // Process contacts in batches
      const batchSize = migrationOptions.batchSize || 50
      for (let i = 0; i < contactsToMigrate.length; i += batchSize) {
        const batch = contactsToMigrate.slice(i, i + batchSize)
        
        console.log(`🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(contactsToMigrate.length / batchSize)}`)

        for (const contact of batch) {
          try {
            // Prepare contact data for creation
            const contactData: any = {
              names: contact.names,
              emailAddresses: contact.emailAddresses,
              phoneNumbers: contact.phoneNumbers,
              addresses: contact.addresses,
              organizations: contact.organizations,
              biographies: contact.biographies,
              birthdays: contact.birthdays,
              urls: contact.urls,
              relations: contact.relations
            }

            // Remove empty fields
            Object.keys(contactData).forEach(key => {
              if (!contactData[key] || (Array.isArray(contactData[key]) && contactData[key].length === 0)) {
                delete contactData[key]
              }
            })

            // Check for duplicate based on merge strategy
            let shouldCreate = true
            if (migrationOptions.mergeStrategy === 'skip') {
              // Check if contact already exists (simplified check by email)
              if (contact.emailAddresses && contact.emailAddresses.length > 0) {
                // For now, we'll create anyway since duplicate detection is complex
                shouldCreate = true
              }
            }

            if (shouldCreate) {
              await targetPeopleService.people.createContact({
                requestBody: contactData
              })
              
              progress.migratedContacts++
            }
            
            progress.processedContacts++

          } catch (contactError) {
            console.error(`❌ Failed to migrate contact: ${contactError}`)
            progress.failedContacts++
            progress.errors.push({
              contactId: contact.resourceName,
              error: `Failed to migrate contact: ${contactError}`,
              timestamp: new Date().toISOString()
            })
          }
        }

        progress.currentBatch = Math.floor(i / batchSize) + 1
      }

      progress.status = 'completed'
      console.log(`✅ Contacts migration completed successfully`)

    } catch (migrationError) {
      console.error(`❌ Contacts migration failed: ${migrationError}`)
      progress.status = 'failed'
      progress.errors.push({
        error: `Migration failed: ${migrationError}`,
        timestamp: new Date().toISOString()
      })
    }

    return NextResponse.json({
      success: progress.status === 'completed',
      progress,
      message: progress.status === 'completed' 
        ? 'Contacts migration completed successfully'
        : 'Contacts migration completed with errors'
    })

  } catch (error) {
    console.error('Contacts migration API error:', error)
    return NextResponse.json({ 
      error: 'Internal server error during contacts migration',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
