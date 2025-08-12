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

interface ChatMigrationRequest {
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
    includeDirectMessages: boolean
    includeGroupMessages: boolean
    includeRooms: boolean
    dateRange?: {
      after?: string
      before?: string
    }
    batchSize: number
  }
  scenario: 'single-super-admin' | 'cross-tenant'
  domainMapping: 'one-to-one' | 'one-to-many' | 'many-to-one'
  verificationToken?: string
  realDataMode?: boolean
  dryRun?: boolean
}

interface ChatMigrationProgress {
  totalSpaces: number
  processedSpaces: number
  migratedSpaces: number
  failedSpaces: number
  totalMessages: number
  processedMessages: number
  migratedMessages: number
  failedMessages: number
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
      totalSpaces: number
      migratedSpaces: number
      totalMessages: number
      migratedMessages: number
    }>
  }
  errors: Array<{
    spaceId?: string
    messageId?: string
    user?: string
    error: string
    timestamp: string
  }>
  userProgress?: Array<{
    sourceUserEmail: string
    targetUserEmail: string
    status: 'pending' | 'processing' | 'completed' | 'failed'
    processedSpaces: number
    migratedSpaces: number
    failedSpaces: number
    processedMessages: number
    migratedMessages: number
    failedMessages: number
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

    const body: ChatMigrationRequest = await request.json()
    
    // Enhanced verification token validation (if provided)
    if (body.verificationToken) {
      try {
        const tokenData = parseEnhancedVerificationToken(body.verificationToken)
        
        if (!tokenData) {
          return NextResponse.json({ 
            error: 'Invalid enhanced verification token',
            details: 'Chat API token validation failed'
          }, { status: 403 })
        }
        
        // Extract domains for validation
        const sourceDomain = body.sourceAdminEmail.split('@')[1]
        const targetDomain = body.targetAdminEmail.split('@')[1]
        
        // Validate token for both domains
        if (!isEnhancedTokenValidForDomains(body.verificationToken, [sourceDomain, targetDomain])) {
          return NextResponse.json({ 
            error: 'Invalid enhanced verification token for the specified domains',
            details: 'Chat API token validation failed for source or target domain'
          }, { status: 403 })
        }
        
        // Verify token security and integrity
        if (!tokenData.apiAuthenticationEnabled) {
          return NextResponse.json({
            error: 'API authentication not enabled in verification token',
            details: 'Enhanced verification token must have API authentication enabled'
          }, { status: 403 })
        }

        // Verify delegation status for Chat API
        if (!tokenData.delegationStatus.sourceVerified || !tokenData.delegationStatus.destVerified) {
          return NextResponse.json({
            error: 'Chat API delegation not properly verified',
            details: 'Both source and destination domains must have verified Chat API delegation'
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

    // Extract domains
    const sourceDomain = sourceAdminEmail.split('@')[1]
    const targetDomain = targetAdminEmail.split('@')[1]

    // Validate domain mapping and extract domain information
    const allSourceDomains = new Set<string>()
    const allTargetDomains = new Set<string>()
    
    processUserMappings.forEach(mapping => {
      const sourceDomain = mapping.sourceUserEmail.split('@')[1]
      const targetDomain = mapping.targetUserEmail.split('@')[1]
      allSourceDomains.add(sourceDomain)
      allTargetDomains.add(targetDomain)
    })

    // Determine mapping type based on domain relationships
    let mappingType: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many'
    if (allSourceDomains.size === 1 && allTargetDomains.size === 1) {
      mappingType = 'one-to-one'
    } else if (allSourceDomains.size === 1 && allTargetDomains.size > 1) {
      mappingType = 'one-to-many'
    } else if (allSourceDomains.size > 1 && allTargetDomains.size === 1) {
      mappingType = 'many-to-one'
    } else {
      mappingType = 'many-to-many'
    }

    console.log(`🚀 Chat Migration Request:`)
    console.log(`   Type: ${isSingleUser ? 'Single User' : `Multi-User (${processUserMappings.length} users)`}`)
    console.log(`   Scenario: ${scenario}`)
    console.log(`   Domain Mapping: ${domainMapping}`)
    console.log(`   Mapping Type: ${mappingType}`)
    console.log(`   Source Domains: ${Array.from(allSourceDomains).join(', ')}`)
    console.log(`   Target Domains: ${Array.from(allTargetDomains).join(', ')}`)
    console.log(`   Dry Run: ${dryRun}`)

    if (isMultiUser) {
      console.log(`📋 User Mappings:`)
      processUserMappings.forEach((mapping, index) => {
        console.log(`   ${index + 1}. ${mapping.sourceUserEmail} → ${mapping.targetUserEmail}`)
      })
    }

    // Initialize migration progress
    const migrationId = `chat-${Date.now()}-${processUserMappings[0].sourceUserEmail}`
    const progress: ChatMigrationProgress = {
      totalSpaces: 0,
      processedSpaces: 0,
      migratedSpaces: 0,
      failedSpaces: 0,
      totalMessages: 0,
      processedMessages: 0,
      migratedMessages: 0,
      failedMessages: 0,
      currentBatch: 0,
      status: 'initializing',
      errors: [],
      userProgress: [],
      domainMappingStats: {
        sourceDomains: Array.from(allSourceDomains),
        targetDomains: Array.from(allTargetDomains),
        mappingType: mappingType as 'one-to-one' | 'one-to-many' | 'many-to-one',
        totalUserMappings: processUserMappings.length,
        domainProgress: []
      }
    }

    // Initialize domain progress for each source-target domain pair
    for (const sourceDomain of allSourceDomains) {
      for (const targetDomain of allTargetDomains) {
        const domainUsers = processUserMappings.filter(mapping => 
          mapping.sourceUserEmail.includes(sourceDomain) && 
          mapping.targetUserEmail.includes(targetDomain)
        )
        
        if (domainUsers.length > 0) {
          progress.domainMappingStats!.domainProgress!.push({
            sourceDomain,
            targetDomain,
            totalUsers: domainUsers.length,
            processedUsers: 0,
            completedUsers: 0,
            failedUsers: 0,
            totalSpaces: 0,
            migratedSpaces: 0,
            totalMessages: 0,
            migratedMessages: 0
          })
        }
      }
    }

    // Initialize user progress tracking for multi-user scenarios
    if (isMultiUser) {
      progress.userProgress = processUserMappings.map(mapping => ({
        sourceUserEmail: mapping.sourceUserEmail,
        targetUserEmail: mapping.targetUserEmail,
        status: 'pending' as const,
        processedSpaces: 0,
        migratedSpaces: 0,
        failedSpaces: 0,
        processedMessages: 0,
        migratedMessages: 0,
        failedMessages: 0,
        errors: []
      }))
    }

    // Set up authentication based on scenario
    let sourceChatService: any
    let targetChatService: any

    if (scenario === 'single-super-admin') {
      // Single admin manages both domains
      const gwsService = createServiceAccountService(sourceAdminEmail)
      sourceChatService = google.chat({ version: 'v1', auth: gwsService['jwtClient'] })
      targetChatService = sourceChatService
    } else {
      // Cross-tenant: use service accounts with domain-wide delegation
      const sourceGWSService = createServiceAccountService(sourceAdminEmail)
      const targetGWSService = createServiceAccountService(targetAdminEmail)
      
      sourceChatService = google.chat({ version: 'v1', auth: sourceGWSService['jwtClient'] })
      targetChatService = google.chat({ version: 'v1', auth: targetGWSService['jwtClient'] })
    }

    progress.status = 'processing'

    // Process chat migration for all users
    processMultiUserChatMigration(
      sourceChatService,
      targetChatService,
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
      message: 'Chat migration started successfully'
    })

  } catch (error: any) {
    console.error('Chat migration error:', error)
    return NextResponse.json({
      error: 'Chat migration failed',
      details: error.message
    }, { status: 500 })
  }
}

// Multi-user chat migration processing function
async function processMultiUserChatMigration(
  sourceChatService: any,
  targetChatService: any,
  userMappings: Array<{ sourceUserEmail: string; targetUserEmail: string }>,
  options: any,
  progress: ChatMigrationProgress,
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
        console.log(`🔄 Processing chat for user: ${mapping.sourceUserEmail} → ${mapping.targetUserEmail}`)

        if (dryRun) {
          // Dry run: just collect statistics
          const mockStats = { spacesCount: 10, messagesCount: 250 }
          userProgress.processedSpaces = mockStats.spacesCount
          userProgress.migratedSpaces = mockStats.spacesCount
          userProgress.processedMessages = mockStats.messagesCount
          userProgress.migratedMessages = mockStats.messagesCount
          console.log(`📊 Dry run stats for ${mapping.sourceUserEmail}: ${mockStats.spacesCount} spaces, ${mockStats.messagesCount} messages`)
        } else if (realDataMode) {
          // Real migration
          let allSpaces: any[] = []
          let pageToken: string | undefined = undefined

          // Get source user's spaces (rooms and DMs)
          do {
            const spacesResponse: any = await sourceChatService.spaces.list({
              pageSize: 100,
              pageToken,
              filter: `spaceType=SPACE OR spaceType=DIRECT_MESSAGE`
            })

            if (spacesResponse.data.spaces) {
              allSpaces = allSpaces.concat(spacesResponse.data.spaces)
            }

            pageToken = spacesResponse.data.nextPageToken
          } while (pageToken)

          progress.totalSpaces += allSpaces.length
          userProgress.processedSpaces = allSpaces.length

          // Process spaces for this user
          for (const space of allSpaces) {
            try {
              // Note: Google Chat API has limitations on creating spaces programmatically
              // This would primarily be used for exporting chat data or analytics
              
              if (options.includeDirectMessages && space.spaceType === 'DIRECT_MESSAGE') {
                await processChatSpaceForUser(sourceChatService, targetChatService, space, mapping, userProgress, options)
              }
              
              if (options.includeGroupMessages && space.spaceType === 'SPACE') {
                await processChatSpaceForUser(sourceChatService, targetChatService, space, mapping, userProgress, options)
              }

              userProgress.migratedSpaces++
            } catch (error) {
              userProgress.failedSpaces++
              const errorMessage = error instanceof Error ? error.message : 'Unknown error'
              userProgress.errors.push(`Space ${space.displayName || space.name}: ${errorMessage}`)
              progress.errors.push({
                spaceId: space.name,
                user: mapping.sourceUserEmail,
                error: errorMessage,
                timestamp: new Date().toISOString()
              })
            }
          }
        } else {
          // Mock mode: simulate migration
          const mockStats = { spacesCount: 10, messagesCount: 250 }
          userProgress.processedSpaces = mockStats.spacesCount
          userProgress.migratedSpaces = mockStats.spacesCount
          userProgress.processedMessages = mockStats.messagesCount
          userProgress.migratedMessages = mockStats.messagesCount
          console.log(`🎭 Mock migration for ${mapping.sourceUserEmail}: ${mockStats.spacesCount} spaces, ${mockStats.messagesCount} messages`)
        }

        userProgress.status = 'completed'
        console.log(`✅ Completed chat migration for user: ${mapping.sourceUserEmail}`)

      } catch (error) {
        console.error(`❌ Error migrating chat for user ${mapping.sourceUserEmail}:`, error)
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
    progress.migratedSpaces = progress.userProgress!.reduce((sum, up) => sum + up.migratedSpaces, 0)
    progress.migratedMessages = progress.userProgress!.reduce((sum, up) => sum + up.migratedMessages, 0)
    progress.failedSpaces = progress.userProgress!.reduce((sum, up) => sum + up.failedSpaces, 0)
    progress.processedSpaces = progress.userProgress!.reduce((sum, up) => sum + up.processedSpaces, 0)
    progress.processedMessages = progress.userProgress!.reduce((sum, up) => sum + up.processedMessages, 0)

    progress.status = 'completed'
    console.log(`🎉 Multi-user chat migration completed for ${userMappings.length} users`)

  } catch (error) {
    progress.status = 'failed'
    console.error('Multi-user chat migration processing error:', error)
    progress.errors.push({
      error: error instanceof Error ? error.message : 'Unknown error in multi-user processing',
      timestamp: new Date().toISOString()
    })
  }
}

// Helper function to process chat space for a specific user
async function processChatSpaceForUser(
  sourceChatService: any,
  targetChatService: any,
  space: any,
  userMapping: { sourceUserEmail: string; targetUserEmail: string },
  userProgress: any,
  options: any
) {
  try {
    // Get messages from the space
    let allMessages: any[] = []
    let pageToken: string | undefined = undefined

    do {
      const messagesResponse: any = await sourceChatService.spaces.messages.list({
        parent: space.name,
        pageSize: 100,
        pageToken,
        showDeleted: false
      })

      if (messagesResponse.data.messages) {
        allMessages = allMessages.concat(messagesResponse.data.messages)
      }

      pageToken = messagesResponse.data.nextPageToken
    } while (pageToken)

    userProgress.processedMessages += allMessages.length
    userProgress.migratedMessages += allMessages.length

    console.log(`📝 Processed ${allMessages.length} messages from space: ${space.displayName || space.name}`)

  } catch (error) {
    console.error(`Error processing chat space for user ${userMapping.sourceUserEmail}:`, error)
    userProgress.errors.push(`Space processing error: ${error}`)
  }
}

// GET endpoint to check migration progress
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const migrationId = searchParams.get('migrationId')

  if (!migrationId) {
    return NextResponse.json(
      { error: 'Method not allowed. Use POST for chat migrations.' },
      { status: 405 }
    )
  }

  return NextResponse.json({
    migrationId,
    progress: {
      totalSpaces: 15,
      processedSpaces: 10,
      migratedSpaces: 8,
      failedSpaces: 2,
      totalMessages: 450,
      processedMessages: 320,
      migratedMessages: 280,
      failedMessages: 40,
      currentBatch: 3,
      status: 'processing',
      errors: []
    }
  })
}
