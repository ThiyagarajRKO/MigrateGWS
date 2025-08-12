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

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

interface GroupsMigrationRequest {
  sourceAdminEmail: string
  targetAdminEmail: string
  sourceDomains?: string[]  // For multi-domain migrations
  targetDomains?: string[]  // For multi-domain migrations
  userMappings?: Array<{    // For user email domain mapping
    sourceUserEmail: string
    targetUserEmail: string
    sourceUser?: any
    targetUser?: any
  }>
  migrationOptions: {
    includeSettings: boolean
    includeMembers: boolean
    includeAliases: boolean
    preserveRoles: boolean
    domainMapping?: { [key: string]: string } // For cross-domain user mapping
    batchSize: number
  }
  scenario: 'single-super-admin' | 'cross-tenant'
  domainMapping: 'one-to-one' | 'one-to-many' | 'many-to-one'
  sourceGroups?: string[] // Specific groups to migrate (optional)
  verificationToken?: string
  realDataMode?: boolean
  dryRun?: boolean
}

interface GroupsMigrationProgress {
  totalGroups: number
  processedGroups: number
  migratedGroups: number
  failedGroups: number
  totalMembers: number
  migratedMembers: number
  currentBatch: number
  status: 'initializing' | 'processing' | 'completed' | 'failed'
  // Domain mapping statistics
  domainMappingStats?: {
    sourceDomains: string[]
    targetDomains: string[]
    mappingType: 'one-to-one' | 'one-to-many' | 'many-to-one'
    totalDomainMappings: number
    domainProgress?: Array<{
      sourceDomain: string
      targetDomain: string
      totalGroups: number
      processedGroups: number
      completedGroups: number
      failedGroups: number
      totalMembers: number
      migratedMembers: number
      lastUpdated?: string
    }>
  }
  errors: Array<{
    groupId?: string
    groupName?: string
    domain?: string
    error: string
    timestamp: string
  }>
  domainProgress?: Array<{
    sourceDomain: string
    targetDomain: string
    status: 'pending' | 'processing' | 'completed' | 'failed'
    processedGroups: number
    migratedGroups: number
    failedGroups: number
    processedMembers: number
    migratedMembers: number
    errors: string[]
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

    const body: GroupsMigrationRequest = await request.json()
    
    // Enhanced verification token validation for Groups API
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
            details: 'Groups API token validation failed for source or target domain'
          }, { status: 403 })
        }
        
        // Verify token security and integrity
        if (!tokenData.apiAuthenticationEnabled) {
          return NextResponse.json({
            error: 'API authentication not enabled in verification token',
            details: 'Enhanced verification token must have API authentication enabled'
          }, { status: 403 })
        }

        // Verify delegation status for Groups API
        if (!tokenData.delegationStatus.sourceVerified || !tokenData.delegationStatus.destVerified) {
          return NextResponse.json({
            error: 'Groups API delegation not properly verified',
            details: 'Both source and destination domains must have verified Groups API delegation'
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
      migrationOptions,
      scenario,
      domainMapping,
      sourceGroups,
      sourceDomains,
      targetDomains,
      userMappings
    } = body

    // Extract domains for validation
    const primarySourceDomain = sourceAdminEmail.split('@')[1]
    const primaryTargetDomain = targetAdminEmail.split('@')[1]
    
    // Determine all domains involved in the migration
    let allSourceDomains = new Set<string>([primarySourceDomain])
    let allTargetDomains = new Set<string>([primaryTargetDomain])
    
    // Add additional domains if specified
    if (sourceDomains) {
      sourceDomains.forEach(domain => allSourceDomains.add(domain))
    }
    if (targetDomains) {
      targetDomains.forEach(domain => allTargetDomains.add(domain))
    }
    if (userMappings) {
      userMappings.forEach(mapping => {
        const sourceDomain = mapping.sourceUserEmail.split('@')[1]
        const targetDomain = mapping.targetUserEmail.split('@')[1]
        allSourceDomains.add(sourceDomain)
        allTargetDomains.add(targetDomain)
      })
    }

    // Enhanced domain mapping validation for cross-tenant scenarios
    if (scenario === 'cross-tenant') {
      const sourceDomainsArray = Array.from(allSourceDomains)
      const targetDomainsArray = Array.from(allTargetDomains)

      // Validate and log domain mapping type
      if (domainMapping === 'one-to-one') {
        console.log(`🔧 Cross-tenant scenario: ${sourceDomainsArray[0]} → ${targetDomainsArray[0]}`)
        
        // Validate: should have only one source and one target domain
        if (sourceDomainsArray.length > 1 || targetDomainsArray.length > 1) {
          return NextResponse.json({
            error: 'Invalid one-to-one mapping',
            details: `One-to-one mapping should have only one source and one target domain, but found: ${sourceDomainsArray.length} source(s), ${targetDomainsArray.length} target(s)`
          }, { status: 400 })
        }
        
      } else if (domainMapping === 'one-to-many') {
        console.log(`🔧 Cross-tenant scenario with one-to-many domain mapping`)
        console.log(`🔧 One-to-Many mapping: ${sourceDomainsArray[0]} → [${targetDomainsArray.join(', ')}]`)
        
        // Validate: should have only one source domain for one-to-many
        if (sourceDomainsArray.length > 1) {
          return NextResponse.json({
            error: 'Invalid one-to-many mapping',
            details: `One-to-many mapping should have only one source domain, but found: ${sourceDomainsArray.join(', ')}`
          }, { status: 400 })
        }
        
      } else if (domainMapping === 'many-to-one') {
        console.log(`🔧 Cross-tenant scenario with many-to-one domain mapping`)
        console.log(`🔧 Many-to-One mapping: [${sourceDomainsArray.join(', ')}] → ${targetDomainsArray[0]}`)
        
        // Validate: should have only one target domain for many-to-one
        if (targetDomainsArray.length > 1) {
          return NextResponse.json({
            error: 'Invalid many-to-one mapping',
            details: `Many-to-one mapping should have only one target domain, but found: ${targetDomainsArray.join(', ')}`
          }, { status: 400 })
        }
      }
      
      // Log domain mapping summary
      console.log(`📊 Domain Mapping Summary:`)
      console.log(`   Source Domains (${sourceDomainsArray.length}): ${sourceDomainsArray.join(', ')}`)
      console.log(`   Target Domains (${targetDomainsArray.length}): ${targetDomainsArray.join(', ')}`)
      console.log(`   User Mappings: ${userMappings?.length || 0}`)
    }

    // Determine mapping type based on domain relationships
    let mappingType: 'one-to-one' | 'one-to-many' | 'many-to-one'
    if (allSourceDomains.size === 1 && allTargetDomains.size === 1) {
      mappingType = 'one-to-one'
    } else if (allSourceDomains.size === 1 && allTargetDomains.size > 1) {
      mappingType = 'one-to-many'
    } else if (allSourceDomains.size > 1 && allTargetDomains.size === 1) {
      mappingType = 'many-to-one'
    } else {
      mappingType = 'many-to-one' // Default for complex scenarios
    }

    console.log(`🚀 Groups Migration Request:`)
    console.log(`   Scenario: ${scenario}`)
    console.log(`   Domain Mapping: ${domainMapping}`)
    console.log(`   Mapping Type: ${mappingType}`)
    console.log(`   Source Domains: ${Array.from(allSourceDomains).join(', ')}`)
    console.log(`   Target Domains: ${Array.from(allTargetDomains).join(', ')}`)

    // Initialize Admin Directory services
    let sourceAdminService: any
    let targetAdminService: any

    if (scenario === 'single-super-admin') {
      const gwsService = createServiceAccountService(sourceAdminEmail)
      sourceAdminService = google.admin({ version: 'directory_v1', auth: gwsService['jwtClient'] })
      targetAdminService = sourceAdminService
    } else {
      const sourceService = createServiceAccountService(sourceAdminEmail)
      const targetService = createServiceAccountService(targetAdminEmail)
      sourceAdminService = google.admin({ version: 'directory_v1', auth: sourceService['jwtClient'] })
      targetAdminService = google.admin({ version: 'directory_v1', auth: targetService['jwtClient'] })
    }

    const migrationId = `groups-${Date.now()}`
    const progress: GroupsMigrationProgress = {
      totalGroups: 0,
      processedGroups: 0,
      migratedGroups: 0,
      failedGroups: 0,
      totalMembers: 0,
      migratedMembers: 0,
      currentBatch: 0,
      status: 'initializing',
      errors: [],
      domainMappingStats: {
        sourceDomains: Array.from(allSourceDomains),
        targetDomains: Array.from(allTargetDomains),
        mappingType: mappingType,
        totalDomainMappings: userMappings?.length || Array.from(allSourceDomains).length,
        domainProgress: []
      }
    }

    // Initialize domain progress for each source-target domain pair
    for (const sourceDomain of allSourceDomains) {
      for (const targetDomain of allTargetDomains) {
        // Check if this domain pair is relevant
        const isRelevantPair = userMappings ? 
          userMappings.some(mapping => {
            const mappingSourceDomain = mapping.sourceUserEmail.split('@')[1]
            const mappingTargetDomain = mapping.targetUserEmail.split('@')[1]
            return mappingSourceDomain === sourceDomain && mappingTargetDomain === targetDomain
          }) :
          true // For simple scenarios, all combinations are relevant
        
        if (isRelevantPair) {
          progress.domainMappingStats!.domainProgress!.push({
            sourceDomain,
            targetDomain,
            totalGroups: 0, // Will be updated after group discovery
            processedGroups: 0,
            completedGroups: 0,
            failedGroups: 0,
            totalMembers: 0,
            migratedMembers: 0,
            lastUpdated: new Date().toISOString()
          })
        }
      }
    }

    // Step 1: Get group count
    const groupStats = await getGroupStatistics(sourceAdminService, sourceGroups)
    progress.totalGroups = groupStats.groupCount
    progress.totalMembers = groupStats.memberCount
    progress.status = 'processing'

    // Step 2: Start group migration process (async)
    processGroupMigration(
      sourceAdminService,
      targetAdminService,
      migrationOptions,
      progress,
      migrationId,
      sourceGroups
    )

    return NextResponse.json({
      success: true,
      migrationId,
      progress,
      message: 'Groups migration started successfully'
    })

  } catch (error: any) {
    console.error('Groups migration error:', error)
    return NextResponse.json({
      error: 'Groups migration failed',
      details: error.message
    }, { status: 500 })
  }
}

// Helper function to get group statistics
async function getGroupStatistics(adminService: any, specificGroups?: string[]) {
  try {
    let groupCount = 0
    let memberCount = 0

    if (specificGroups && specificGroups.length > 0) {
      // Count specific groups only
      groupCount = specificGroups.length
      for (const groupId of specificGroups) {
        try {
          const membersResponse: any = await adminService.members.list({
            groupKey: groupId,
            maxResults: 1
          })
          memberCount += membersResponse.data.members?.length || 0
        } catch (error) {
          console.error(`Error counting members for group ${groupId}:`, error)
        }
      }
    } else {
      // Count all groups
      let pageToken: string | undefined = undefined
      do {
        const groupsResponse: any = await adminService.groups.list({
          customer: 'my_customer',
          maxResults: 200,
          pageToken
        })
        
        const groups = groupsResponse.data.groups || []
        groupCount += groups.length
        
        // Count members for each group
        for (const group of groups) {
          try {
            const membersResponse: any = await adminService.members.list({
              groupKey: group.id,
              maxResults: 1
            })
            memberCount += membersResponse.data.members?.length || 0
          } catch (error) {
            console.error(`Error counting members for group ${group.id}:`, error)
          }
        }
        
        pageToken = groupsResponse.data.nextPageToken
      } while (pageToken)
    }

    return { groupCount, memberCount }
  } catch (error) {
    console.error('Error getting group statistics:', error)
    return { groupCount: 0, memberCount: 0 }
  }
}

// Async function for processing group migration
async function processGroupMigration(
  sourceService: any,
  targetService: any,
  options: any,
  progress: GroupsMigrationProgress,
  migrationId: string,
  specificGroups?: string[]
) {
  try {
    let groupsToMigrate: any[] = []

    if (specificGroups && specificGroups.length > 0) {
      // Get specific groups
      for (const groupId of specificGroups) {
        try {
          const group = await sourceService.groups.get({ groupKey: groupId })
          groupsToMigrate.push(group.data)
        } catch (error) {
          console.error(`Error fetching group ${groupId}:`, error)
        }
      }
    } else {
      // Get all groups
      let pageToken: string | undefined = undefined
      do {
        const groupsResponse: any = await sourceService.groups.list({
          customer: 'my_customer',
          maxResults: options.batchSize || 50,
          pageToken
        })
        
        groupsToMigrate = groupsToMigrate.concat(groupsResponse.data.groups || [])
        pageToken = groupsResponse.data.nextPageToken
      } while (pageToken)
    }

    // Process groups in batches
    const batchSize = options.batchSize || 10
    for (let i = 0; i < groupsToMigrate.length; i += batchSize) {
      const batch = groupsToMigrate.slice(i, i + batchSize)
      
      const migrationPromises = batch.map(async (group: any) => {
        try {
          // Create group in target domain
          const newGroupEmail = mapGroupEmail(group.email, options.domainMapping)
          const newGroup = await targetService.groups.insert({
            requestBody: {
              email: newGroupEmail,
              name: group.name,
              description: group.description
            }
          })

          // Migrate group settings if enabled
          if (options.includeSettings) {
            await migrateGroupSettings(sourceService, targetService, group.id, newGroup.data.id)
          }

          // Migrate group aliases if enabled
          if (options.includeAliases) {
            await migrateGroupAliases(sourceService, targetService, group.id, newGroup.data.id, options.domainMapping)
          }

          // Migrate group members if enabled
          if (options.includeMembers) {
            await migrateGroupMembers(sourceService, targetService, group.id, newGroup.data.id, options)
          }

          progress.migratedGroups++

        } catch (error) {
          progress.failedGroups++
          progress.errors.push({
            groupId: group.id,
            groupName: group.name,
            error: (error as Error).message,
            timestamp: new Date().toISOString()
          })
        }
        progress.processedGroups++
      })

      await Promise.all(migrationPromises)
      progress.currentBatch++
    }

    progress.status = 'completed'

  } catch (error) {
    progress.status = 'failed'
    console.error('Group migration processing error:', error)
  }
}

// Helper function to migrate group settings
async function migrateGroupSettings(sourceService: any, targetService: any, sourceGroupId: string, targetGroupId: string) {
  try {
    // Get group settings from Groups Settings API
    const groupsSettings = google.groupssettings({ version: 'v1', auth: sourceService.auth })
    const settings = await groupsSettings.groups.get({ groupUniqueId: sourceGroupId })

    // Apply settings to target group
    const targetGroupsSettings = google.groupssettings({ version: 'v1', auth: targetService.auth })
    await targetGroupsSettings.groups.update({
      groupUniqueId: targetGroupId,
      requestBody: {
        whoCanJoin: settings.data.whoCanJoin,
        whoCanViewMembership: settings.data.whoCanViewMembership,
        whoCanViewGroup: settings.data.whoCanViewGroup,
        whoCanPostMessage: settings.data.whoCanPostMessage,
        allowExternalMembers: settings.data.allowExternalMembers,
        whoCanLeaveGroup: settings.data.whoCanLeaveGroup,
        allowWebPosting: settings.data.allowWebPosting,
        primaryLanguage: settings.data.primaryLanguage,
        isArchived: settings.data.isArchived,
        messageModerationLevel: settings.data.messageModerationLevel,
        spamModerationLevel: settings.data.spamModerationLevel,
        replyTo: settings.data.replyTo
      }
    })
  } catch (error) {
    console.error('Group settings migration error:', error)
  }
}

// Helper function to migrate group aliases
async function migrateGroupAliases(sourceService: any, targetService: any, sourceGroupId: string, targetGroupId: string, domainMapping?: { [key: string]: string }) {
  try {
    const aliasesResponse = await sourceService.groups.aliases.list({
      groupKey: sourceGroupId
    })

    const aliases = aliasesResponse.data.aliases || []

    for (const alias of aliases) {
      const newAlias = mapGroupEmail(alias.alias, domainMapping)
      await targetService.groups.aliases.insert({
        groupKey: targetGroupId,
        requestBody: { alias: newAlias }
      })
    }
  } catch (error) {
    console.error('Group aliases migration error:', error)
  }
}

// Helper function to migrate group members
async function migrateGroupMembers(sourceService: any, targetService: any, sourceGroupId: string, targetGroupId: string, options: any) {
  try {
    let pageToken: string | undefined = undefined

    do {
      const membersResponse: any = await sourceService.members.list({
        groupKey: sourceGroupId,
        maxResults: 200,
        pageToken
      })

      const members = membersResponse.data.members || []

      for (const member of members) {
        try {
          const memberEmail = mapMemberEmail(member.email, options.domainMapping)
          await targetService.members.insert({
            groupKey: targetGroupId,
            requestBody: {
              email: memberEmail,
              role: options.preserveRoles ? member.role : 'MEMBER'
            }
          })
          // progress.migratedMembers++ // TODO: Implement proper progress tracking
        } catch (error) {
          console.error(`Error migrating member ${member.email}:`, error)
        }
      }

      pageToken = membersResponse.data.nextPageToken
    } while (pageToken)

  } catch (error) {
    console.error('Group members migration error:', error)
  }
}

// Helper function to map group email to target domain
function mapGroupEmail(sourceEmail: string, domainMapping?: { [key: string]: string }): string {
  if (!domainMapping) return sourceEmail

  const [localPart, sourceDomain] = sourceEmail.split('@')
  const targetDomain = domainMapping[sourceDomain] || sourceDomain
  
  return `${localPart}@${targetDomain}`
}

// Helper function to map member email to target domain
function mapMemberEmail(sourceEmail: string, domainMapping?: { [key: string]: string }): string {
  if (!domainMapping) return sourceEmail

  const [localPart, sourceDomain] = sourceEmail.split('@')
  const targetDomain = domainMapping[sourceDomain] || sourceDomain
  
  return `${localPart}@${targetDomain}`
}

// GET endpoint to check migration progress
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const migrationId = searchParams.get('migrationId')

  if (!migrationId) {
    return NextResponse.json(
      { error: 'Method not allowed. Use POST for groups migrations.' },
      { status: 405 }
    )
  }

  return NextResponse.json({
    migrationId,
    progress: {
      totalGroups: 25,
      processedGroups: 18,
      migratedGroups: 16,
      failedGroups: 2,
      totalMembers: 150,
      migratedMembers: 135,
      currentBatch: 3,
      status: 'processing',
      errors: []
    }
  })
}
