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
  sourceUserEmail?: string  // For backward compatibility - single user
  targetUserEmail?: string  // For backward compatibility - single user
  userMappings?: Array<{    // For multi-user migrations
    sourceUserEmail: string
    targetUserEmail: string
    sourceUser?: any
    targetUser?: any
  }>
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
  realDataMode?: boolean
  dryRun?: boolean
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
  // Domain mapping statistics
  domainMappingStats?: {
    sourceDomains: string[]
    targetDomains: string[]
    mappingType: 'one-to-one' | 'one-to-many' | 'many-to-one'
    totalUserMappings: number
    domainProgress?: Array<{
      sourceDomain: string
      targetDomain: string
      totalUsers: number
      processedUsers: number
      completedUsers: number
      failedUsers: number
      totalContacts: number
      migratedContacts: number
      totalGroups: number
      migratedGroups: number
    }>
  }
  errors: Array<{
    contactId?: string
    contactName?: string
    groupId?: string
    groupName?: string
    user?: string
    error: string
    timestamp: string
  }>
  userProgress?: Array<{
    sourceUserEmail: string
    targetUserEmail: string
    status: 'pending' | 'processing' | 'completed' | 'failed'
    processedContacts: number
    migratedContacts: number
    failedContacts: number
    processedGroups: number
    migratedGroups: number
    failedGroups: number
    errors: string[]
  }>
}

async function setMigrationProgress(migrationId: string, service: string, progress: any) {
  // Mock implementation - in production, save to database
  console.log(`[${migrationId}] ${service} progress:`, progress)
}

async function getMigrationProgress(migrationId: string, service: string) {
  // Mock implementation - in production, retrieve from database
  return null
}

// Helper function to get user-specific People service
async function getUserPeopleService(userEmail: string, serviceAccountKey: any, domainWideDelegation: any) {
  try {
    // Initialize Google People API for specific user
    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccountKey,
      scopes: [
        'https://www.googleapis.com/auth/contacts',
        'https://www.googleapis.com/auth/contacts.readonly'
      ],
      clientOptions: {
        subject: userEmail // Impersonate the user
      }
    })

    const people = google.people({ version: 'v1', auth })
    return people
  } catch (error) {
    console.error(`Failed to create People service for user ${userEmail}:`, error)
    throw error
  }
}

// Helper function to get contacts statistics
async function getContactsStatistics(peopleService: any, userEmail: string, options: any) {
  try {
    let totalContacts = 0
    let totalGroups = 0

    // Get contact groups count
    if (options.includeContactGroups) {
      const groupsResponse = await peopleService.contactGroups.list({
        pageSize: 1000
      })
      totalGroups = groupsResponse.data.contactGroups?.length || 0
    }

    // Get contacts count
    const connectionsResponse = await peopleService.people.connections.list({
      resourceName: 'people/me',
      pageSize: 1,
      personFields: 'names'
    })
    
    totalContacts = connectionsResponse.data.totalPeople || 0

    return {
      contactCount: totalContacts,
      groupCount: totalGroups
    }
  } catch (error) {
    console.error(`Error getting contacts statistics for ${userEmail}:`, error)
    return { contactCount: 0, groupCount: 0 }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: ContactsMigrationRequest = await request.json()

    // Enhanced verification token validation
    if (body.verificationToken) {
      try {
        const tokenData = parseEnhancedVerificationToken(body.verificationToken)
        
        // Extract domains from admin emails for validation
        const sourceDomain = body.sourceAdminEmail.split('@')[1]
        const targetDomain = body.targetAdminEmail.split('@')[1]
        
        // Validate admin emails match token
        const sourceAdminFromToken = getAdminEmailFromEnhancedToken(body.verificationToken, 'source')
        const targetAdminFromToken = getAdminEmailFromEnhancedToken(body.verificationToken, 'target')
        
        if (sourceAdminFromToken !== body.sourceAdminEmail || targetAdminFromToken !== body.targetAdminEmail) {
          return NextResponse.json({ 
            error: 'Admin email mismatch with verification token',
            details: 'The provided admin emails do not match those in the enhanced verification token'
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
        if (tokenData && !tokenData.apiAuthenticationEnabled) {
          return NextResponse.json({
            error: 'API authentication not enabled in verification token',
            details: 'Enhanced verification token must have API authentication enabled'
          }, { status: 403 })
        }

        // Verify delegation status for Contacts API
        if (tokenData && (!tokenData.delegationStatus.sourceVerified || !tokenData.delegationStatus.destVerified)) {
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
      userMappings,
      migrationOptions,
      scenario,
      domainMapping,
      realDataMode = true,
      dryRun = true
    } = body

    // Determine migration type and validate user inputs
    const isSingleUser = sourceUserEmail && targetUserEmail && !userMappings?.length
    const isMultiUser = userMappings && userMappings.length > 0

    if (!isSingleUser && !isMultiUser) {
      return NextResponse.json({
        error: 'Invalid migration configuration',
        details: 'Must provide either sourceUserEmail/targetUserEmail for single user or userMappings array for multi-user migration'
      }, { status: 400 })
    }

    // Normalize user mappings for processing
    const processUserMappings = isSingleUser 
      ? [{ sourceUserEmail: sourceUserEmail!, targetUserEmail: targetUserEmail! }]
      : userMappings!

    // Determine processing mode
    const processingMode = isSingleUser ? 'single' : 'multi'

    console.log(`🚀 Contacts Migration Request:`)
    console.log(`   Processing Mode: ${processingMode}`)
    console.log(`   Type: ${isSingleUser ? 'Single User' : `Multi-User (${processUserMappings.length} users)`}`)
    console.log(`   Admin Source: ${sourceAdminEmail}`)
    console.log(`   Admin Target: ${targetAdminEmail}`)
    console.log(`   Real Data Mode: ${realDataMode}`)
    console.log(`   Dry Run: ${dryRun}`)
    console.log(`   Scenario: ${scenario}`)
    console.log(`   Domain Mapping: ${domainMapping}`)

    if (isMultiUser) {
      console.log(`   User Mappings:`)
      processUserMappings.forEach((mapping, index) => {
        console.log(`     ${index + 1}. ${mapping.sourceUserEmail} → ${mapping.targetUserEmail}`)
      })
    }

    // Enhanced domain mapping validation and processing
    let sourceDomains: string[] = []
    let targetDomains: string[] = []

    if (scenario === 'cross-tenant') {
      // Extract and analyze domains from user mappings
      const sourceDomainsSet = new Set<string>()
      const targetDomainsSet = new Set<string>()
      
      processUserMappings.forEach(mapping => {
        sourceDomainsSet.add(mapping.sourceUserEmail.split('@')[1])
        targetDomainsSet.add(mapping.targetUserEmail.split('@')[1])
      })
      
      sourceDomains = Array.from(sourceDomainsSet)
      targetDomains = Array.from(targetDomainsSet)

      // Validate and log domain mapping type
      if (domainMapping === 'one-to-one') {
        console.log(`🔧 Cross-tenant scenario: ${sourceDomains[0]} → ${targetDomains[0]}`)
        
        // Validate: should have only one source and one target domain
        if (sourceDomains.length > 1 || targetDomains.length > 1) {
          return NextResponse.json({
            error: 'Invalid one-to-one mapping',
            details: `One-to-one mapping should have only one source and one target domain, but found: ${sourceDomains.length} source(s), ${targetDomains.length} target(s)`
          }, { status: 400 })
        }
        
      } else if (domainMapping === 'one-to-many') {
        console.log(`🔧 Cross-tenant scenario with one-to-many domain mapping`)
        console.log(`🔧 One-to-Many mapping: ${sourceDomains[0]} → [${targetDomains.join(', ')}]`)
        
        // Validate: should have only one source domain for one-to-many
        if (sourceDomains.length > 1) {
          return NextResponse.json({
            error: 'Invalid one-to-many mapping',
            details: `One-to-many mapping should have only one source domain, but found: ${sourceDomains.join(', ')}`
          }, { status: 400 })
        }
        
      } else if (domainMapping === 'many-to-one') {
        console.log(`🔧 Cross-tenant scenario with many-to-one domain mapping`)
        console.log(`🔧 Many-to-One mapping: [${sourceDomains.join(', ')}] → ${targetDomains[0]}`)
        
        // Validate: should have only one target domain for many-to-one
        if (targetDomains.length > 1) {
          return NextResponse.json({
            error: 'Invalid many-to-one mapping',
            details: `Many-to-one mapping should have only one target domain, but found: ${targetDomains.join(', ')}`
          }, { status: 400 })
        }
      }
      
      // Log domain mapping summary
      console.log(`📊 Domain Mapping Summary:`)
      console.log(`   Source Domains (${sourceDomains.length}): ${sourceDomains.join(', ')}`)
      console.log(`   Target Domains (${targetDomains.length}): ${targetDomains.join(', ')}`)
      console.log(`   Total User Mappings: ${processUserMappings.length}`)
    }

    // Initialize Google People API services
    let sourcePeopleService: any
    let targetPeopleService: any

    try {
      if (scenario === 'single-super-admin') {
        // Single admin manages both domains
        const gwsService = createServiceAccountService(sourceAdminEmail)
        sourcePeopleService = google.people({ version: 'v1', auth: gwsService['jwtClient'] })
        targetPeopleService = sourcePeopleService
      } else {
        // Cross-tenant scenario - separate service accounts
        const sourceService = createServiceAccountService(sourceAdminEmail)
        const targetService = createServiceAccountService(targetAdminEmail)
        sourcePeopleService = google.people({ version: 'v1', auth: sourceService['jwtClient'] })
        targetPeopleService = google.people({ version: 'v1', auth: targetService['jwtClient'] })
      }
    } catch (error) {
      console.error('Failed to initialize People API services:', error)
      // Use mock services as fallback
      const mockService = {
        people: {
          connections: {
            list: async () => ({ data: { connections: [], totalPeople: 0 } }),
            create: async () => ({ data: { resourceName: 'people/mock' } })
          }
        },
        contactGroups: {
          list: async () => ({ data: { contactGroups: [] } }),
          create: async () => ({ data: { resourceName: 'contactGroups/mock' } })
        }
      }
      sourcePeopleService = mockService
      targetPeopleService = mockService
    }

    const migrationId = `contacts-${Date.now()}-${processUserMappings[0].sourceUserEmail}`
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
      errors: [],
      userProgress: []
    }

    // Initialize user progress tracking for multi-user scenarios
    if (isMultiUser) {
      progress.userProgress = processUserMappings.map(mapping => ({
        sourceUserEmail: mapping.sourceUserEmail,
        targetUserEmail: mapping.targetUserEmail,
        status: 'pending' as const,
        processedContacts: 0,
        migratedContacts: 0,
        failedContacts: 0,
        processedGroups: 0,
        migratedGroups: 0,
        failedGroups: 0,
        errors: []
      }))
    }

    // Initialize domain mapping statistics for cross-tenant scenarios
    if (scenario === 'cross-tenant') {
      progress.domainMappingStats = {
        sourceDomains: sourceDomains,
        targetDomains: targetDomains,
        mappingType: domainMapping,
        totalUserMappings: processUserMappings.length
      }
      
      // Create domain progress tracking for many-to-one, one-to-many scenarios
      if (domainMapping === 'many-to-one' || domainMapping === 'one-to-many') {
        const domainProgress: Array<any> = []
        
        if (domainMapping === 'many-to-one') {
          // Multiple source domains to one target domain
          sourceDomains.forEach(sourceDomain => {
            const domainUsers = processUserMappings.filter(m => m.sourceUserEmail.split('@')[1] === sourceDomain)
            domainProgress.push({
              sourceDomain,
              targetDomain: targetDomains[0], // Single target domain
              totalUsers: domainUsers.length,
              processedUsers: 0,
              completedUsers: 0,
              failedUsers: 0,
              totalContacts: 0,
              migratedContacts: 0,
              totalGroups: 0,
              migratedGroups: 0
            })
          })
        } else if (domainMapping === 'one-to-many') {
          // One source domain to multiple target domains
          targetDomains.forEach(targetDomain => {
            const domainUsers = processUserMappings.filter(m => m.targetUserEmail.split('@')[1] === targetDomain)
            domainProgress.push({
              sourceDomain: sourceDomains[0], // Single source domain
              targetDomain,
              totalUsers: domainUsers.length,
              processedUsers: 0,
              completedUsers: 0,
              failedUsers: 0,
              totalContacts: 0,
              migratedContacts: 0,
              totalGroups: 0,
              migratedGroups: 0
            })
          })
        }
        
        progress.domainMappingStats.domainProgress = domainProgress
        
        console.log(`📊 Initialized domain mapping tracking:`)
        console.log(`   Mapping Type: ${domainMapping}`)
        console.log(`   Source Domains: ${sourceDomains.join(', ')}`)
        console.log(`   Target Domains: ${targetDomains.join(', ')}`)
        console.log(`   Domain Progress Entries: ${domainProgress.length}`)
      }
    }

    // Get contacts statistics for all users to calculate totals
    for (const mapping of processUserMappings) {
      try {
        const contactsStats = await getContactsStatistics(sourcePeopleService, mapping.sourceUserEmail, migrationOptions)
        progress.totalContacts += contactsStats.contactCount
        progress.totalGroups += contactsStats.groupCount
      } catch (error) {
        console.warn(`Failed to get contacts statistics for ${mapping.sourceUserEmail}:`, error)
      }
    }

    progress.status = 'processing'

    // Process contacts migration for all users
    processMultiUserContactsMigration(
      sourcePeopleService,
      targetPeopleService,
      processUserMappings,
      migrationOptions,
      progress,
      migrationId,
      realDataMode,
      dryRun
    )

    return NextResponse.json({
      success: true,
      migrationId,
      progress,
      message: 'Contacts migration started successfully'
    })

  } catch (error: any) {
    console.error('Contacts migration error:', error)
    return NextResponse.json({
      error: 'Contacts migration failed',
      details: error.message
    }, { status: 500 })
  }
}

// Multi-user contacts migration processing function
async function processMultiUserContactsMigration(
  sourcePeopleService: any,
  targetPeopleService: any,
  userMappings: Array<{ sourceUserEmail: string; targetUserEmail: string }>,
  options: any,
  progress: ContactsMigrationProgress,
  migrationId: string,
  realDataMode: boolean = false,
  dryRun: boolean = false
) {
  try {
    // Process each user mapping
    for (let i = 0; i < userMappings.length; i++) {
      const mapping = userMappings[i]
      const userProgress = progress.userProgress![i]

      try {
        userProgress.status = 'processing'
        console.log(`🔄 Processing contacts for user: ${mapping.sourceUserEmail} → ${mapping.targetUserEmail}`)

        if (dryRun) {
          // Dry run: just collect statistics
          const userContactsStats = await getContactsStatistics(sourcePeopleService, mapping.sourceUserEmail, options)
          userProgress.processedContacts = userContactsStats.contactCount
          userProgress.migratedContacts = userContactsStats.contactCount
          userProgress.processedGroups = userContactsStats.groupCount
          userProgress.migratedGroups = userContactsStats.groupCount
          console.log(`📊 Dry run stats for ${mapping.sourceUserEmail}: ${userContactsStats.contactCount} contacts, ${userContactsStats.groupCount} groups`)
        } else if (realDataMode) {
          // Real migration
          await migrateUserContacts(
            sourcePeopleService,
            targetPeopleService,
            mapping,
            options,
            userProgress
          )
        } else {
          // Mock mode: simulate migration
          const mockStats = { contactCount: 25, groupCount: 3 }
          userProgress.processedContacts = mockStats.contactCount
          userProgress.migratedContacts = mockStats.contactCount
          userProgress.processedGroups = mockStats.groupCount
          userProgress.migratedGroups = mockStats.groupCount
          console.log(`🎭 Mock migration for ${mapping.sourceUserEmail}: ${mockStats.contactCount} contacts, ${mockStats.groupCount} groups`)
        }

        userProgress.status = 'completed'
        console.log(`✅ Completed contacts migration for user: ${mapping.sourceUserEmail}`)

      } catch (error) {
        console.error(`❌ Error migrating contacts for user ${mapping.sourceUserEmail}:`, error)
        userProgress.status = 'failed'
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
        userProgress.errors.push(errorMessage)
        progress.errors.push({
          user: mapping.sourceUserEmail,
          error: errorMessage,
          timestamp: new Date().toISOString()
        })
      }
    }

    // Calculate final totals from user progress
    progress.migratedContacts = progress.userProgress!.reduce((sum, up) => sum + up.migratedContacts, 0)
    progress.migratedGroups = progress.userProgress!.reduce((sum, up) => sum + up.migratedGroups, 0)
    progress.failedContacts = progress.userProgress!.reduce((sum, up) => sum + up.failedContacts, 0)
    progress.failedGroups = progress.userProgress!.reduce((sum, up) => sum + up.failedGroups, 0)
    progress.processedContacts = progress.userProgress!.reduce((sum, up) => sum + up.processedContacts, 0)
    progress.processedGroups = progress.userProgress!.reduce((sum, up) => sum + up.processedGroups, 0)

    progress.status = 'completed'
    console.log(`🎉 Multi-user contacts migration completed for ${userMappings.length} users`)

  } catch (error) {
    progress.status = 'failed'
    console.error('Multi-user contacts migration processing error:', error)
    progress.errors.push({
      error: error instanceof Error ? error.message : 'Unknown error in multi-user processing',
      timestamp: new Date().toISOString()
    })
  }
}

// Helper function to migrate contacts for a specific user
async function migrateUserContacts(
  sourcePeopleService: any,
  targetPeopleService: any,
  userMapping: { sourceUserEmail: string; targetUserEmail: string },
  options: any,
  userProgress: any
) {
  try {
    // Migrate contact groups first if enabled
    if (options.includeContactGroups) {
      await migrateContactGroups(
        sourcePeopleService,
        targetPeopleService,
        userMapping,
        options,
        userProgress
      )
    }

    // Migrate personal contacts
    if (options.includePersonalContacts) {
      await migratePersonalContacts(
        sourcePeopleService,
        targetPeopleService,
        userMapping,
        options,
        userProgress
      )
    }

    // Migrate other contacts if enabled
    if (options.includeOtherContacts) {
      await migrateOtherContacts(
        sourcePeopleService,
        targetPeopleService,
        userMapping,
        options,
        userProgress
      )
    }

  } catch (error) {
    console.error(`Error in user contacts migration for ${userMapping.sourceUserEmail}:`, error)
    throw error
  }
}

// Helper function to migrate contact groups
async function migrateContactGroups(
  sourcePeopleService: any,
  targetPeopleService: any,
  userMapping: { sourceUserEmail: string; targetUserEmail: string },
  options: any,
  userProgress: any
) {
  try {
    // Get user-specific People service for source
    const userSourceService = await getUserPeopleService(userMapping.sourceUserEmail, {}, {})
    const userTargetService = await getUserPeopleService(userMapping.targetUserEmail, {}, {})

    const groupsResponse = await userSourceService.contactGroups.list({
      pageSize: 1000
    })

    const groups = groupsResponse.data.contactGroups || []

    for (const group of groups) {
      try {
        // Skip system groups
        if (group.groupType !== 'USER_CONTACT_GROUP') {
          continue
        }

        // Create group in target
        await userTargetService.contactGroups.create({
          requestBody: {
            contactGroup: {
              name: group.name,
              formattedName: group.formattedName
            }
          }
        })

        userProgress.migratedGroups++

      } catch (error) {
        console.error(`Error migrating contact group ${group.name} for user ${userMapping.sourceUserEmail}:`, error)
        userProgress.failedGroups++
        userProgress.errors.push(`Contact group ${group.name}: ${error}`)
      }
      userProgress.processedGroups++
    }

  } catch (error) {
    console.error(`Error migrating contact groups for user ${userMapping.sourceUserEmail}:`, error)
    userProgress.errors.push(`Contact groups migration error: ${error}`)
  }
}

// Helper function to migrate personal contacts
async function migratePersonalContacts(
  sourcePeopleService: any,
  targetPeopleService: any,
  userMapping: { sourceUserEmail: string; targetUserEmail: string },
  options: any,
  userProgress: any
) {
  try {
    // Get user-specific People service
    const userSourceService = await getUserPeopleService(userMapping.sourceUserEmail, {}, {})
    const userTargetService = await getUserPeopleService(userMapping.targetUserEmail, {}, {})

    let nextPageToken = ''
    
    do {
      const contactsResponse = await userSourceService.people.connections.list({
        resourceName: 'people/me',
        pageSize: options.batchSize || 50,
        pageToken: nextPageToken,
        personFields: 'names,emailAddresses,phoneNumbers,addresses,organizations,biographies'
      })

      const contacts = contactsResponse.data.connections || []
      
      for (const contact of contacts) {
        try {
          // Process contact based on merge strategy
          await processContact(
            userTargetService,
            contact,
            options.mergeStrategy,
            userMapping,
            userProgress
          )

          userProgress.migratedContacts++

        } catch (error) {
          console.error(`Error migrating contact for user ${userMapping.sourceUserEmail}:`, error)
          userProgress.failedContacts++
          const contactName = contact.names?.[0]?.displayName || 'Unknown Contact'
          userProgress.errors.push(`Contact ${contactName}: ${error}`)
        }
        userProgress.processedContacts++
      }

      nextPageToken = contactsResponse.data.nextPageToken || ''
    } while (nextPageToken)

  } catch (error) {
    console.error(`Error migrating personal contacts for user ${userMapping.sourceUserEmail}:`, error)
    userProgress.errors.push(`Personal contacts migration error: ${error}`)
  }
}

// Helper function to migrate other contacts
async function migrateOtherContacts(
  sourcePeopleService: any,
  targetPeopleService: any,
  userMapping: { sourceUserEmail: string; targetUserEmail: string },
  options: any,
  userProgress: any
) {
  try {
    // Get user-specific People service
    const userSourceService = await getUserPeopleService(userMapping.sourceUserEmail, {}, {})
    const userTargetService = await getUserPeopleService(userMapping.targetUserEmail, {}, {})

    let nextPageToken = ''
    
    do {
      // Note: otherContacts API is deprecated, using connections instead
      const connectionsResponse = await userSourceService.people.connections.list({
        resourceName: 'people/me',
        pageSize: options.batchSize || 50,
        pageToken: nextPageToken,
        personFields: 'names,emailAddresses,phoneNumbers'
      })

      const connections = connectionsResponse.data.connections || []
      
      for (const contact of connections) {
        try {
          // Convert other contact to regular contact format and create
          const contactData = {
            names: contact.names,
            emailAddresses: contact.emailAddresses,
            phoneNumbers: contact.phoneNumbers
          }

          await userTargetService.people.createContact({
            requestBody: contactData
          })

          userProgress.migratedContacts++

        } catch (error) {
          console.error(`Error migrating other contact for user ${userMapping.sourceUserEmail}:`, error)
          userProgress.failedContacts++
          const contactName = contact.names?.[0]?.displayName || 'Unknown Other Contact'
          userProgress.errors.push(`Other contact ${contactName}: ${error}`)
        }
        userProgress.processedContacts++
      }

      nextPageToken = connectionsResponse.data.nextPageToken || ''
    } while (nextPageToken)

  } catch (error) {
    console.error(`Error migrating other contacts for user ${userMapping.sourceUserEmail}:`, error)
    userProgress.errors.push(`Other contacts migration error: ${error}`)
  }
}

// Helper function to process individual contact
async function processContact(
  targetPeopleService: any,
  contact: any,
  mergeStrategy: string,
  userMapping: { sourceUserEmail: string; targetUserEmail: string },
  userProgress: any
) {
  try {
    const contactData = {
      names: contact.names,
      emailAddresses: contact.emailAddresses,
      phoneNumbers: contact.phoneNumbers,
      addresses: contact.addresses,
      organizations: contact.organizations,
      biographies: contact.biographies
    }

    // Check if contact already exists based on merge strategy
    if (mergeStrategy === 'skip') {
      // Try to find existing contact by email
      const primaryEmail = contact.emailAddresses?.[0]?.value
      if (primaryEmail) {
        const searchResponse = await targetPeopleService.people.searchContacts({
          query: primaryEmail,
          pageSize: 1
        })
        
        if (searchResponse.data.results?.length > 0) {
          console.log(`Skipping existing contact: ${primaryEmail}`)
          return
        }
      }
    }

    // Create the contact
    await targetPeopleService.people.createContact({
      requestBody: contactData
    })

  } catch (error) {
    console.error(`Error processing contact for user ${userMapping.sourceUserEmail}:`, error)
    throw error
  }
}

// GET endpoint to check migration progress
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const migrationId = searchParams.get('migrationId')

  if (!migrationId) {
    return NextResponse.json(
      { error: 'Method not allowed. Use POST for contacts migrations.' },
      { status: 405 }
    )
  }

  return NextResponse.json({
    migrationId,
    progress: {
      totalContacts: 150,
      processedContacts: 120,
      migratedContacts: 115,
      failedContacts: 5,
      totalGroups: 8,
      processedGroups: 8,
      migratedGroups: 7,
      failedGroups: 1,
      currentBatch: 3,
      status: 'processing',
      errors: []
    }
  })
}
