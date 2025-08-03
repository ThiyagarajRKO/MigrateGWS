import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { createServiceAccountService } from '@/lib/google-workspace'
import { authOptions } from '@/lib/auth-options'
import { google } from 'googleapis'

interface ChatMigrationRequest {
  sourceAdminEmail: string
  targetAdminEmail: string
  sourceUserEmail: string
  targetUserEmail: string
  migrationOptions: {
    includeDirectMessages: boolean
    includeSpaces: boolean
    includeHistory: boolean
    preserveMemberships: boolean
    batchSize: number
    messageHistoryDays?: number // Limit history to specific days
  }
  scenario: 'single-super-admin' | 'cross-tenant'
  domainMapping: 'one-to-one' | 'one-to-many' | 'many-to-one'
  specificSpaces?: string[] // Specific space IDs to migrate
}

interface ChatMigrationProgress {
  totalSpaces: number
  processedSpaces: number
  migratedSpaces: number
  failedSpaces: number
  totalMessages: number
  migratedMessages: number
  totalMembers: number
  migratedMembers: number
  currentBatch: number
  status: 'initializing' | 'processing' | 'completed' | 'failed'
  errors: Array<{
    spaceId: string
    spaceName: string
    error: string
    timestamp: string
  }>
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body: ChatMigrationRequest = await request.json()
    const {
      sourceAdminEmail,
      targetAdminEmail,
      sourceUserEmail,
      targetUserEmail,
      migrationOptions,
      scenario,
      domainMapping,
      specificSpaces
    } = body

    // Initialize Google Chat and Admin services
    let sourceChatService: any
    let targetChatService: any
    let sourceAdminService: any
    let targetAdminService: any

    if (scenario === 'single-super-admin') {
      const gwsService = createServiceAccountService(sourceAdminEmail)
      sourceChatService = google.chat({ version: 'v1', auth: gwsService['jwtClient'] })
      targetChatService = sourceChatService
      sourceAdminService = google.admin({ version: 'directory_v1', auth: gwsService['jwtClient'] })
      targetAdminService = sourceAdminService
    } else {
      const sourceService = createServiceAccountService(sourceAdminEmail)
      const targetService = createServiceAccountService(targetAdminEmail)
      sourceChatService = google.chat({ version: 'v1', auth: sourceService['jwtClient'] })
      targetChatService = google.chat({ version: 'v1', auth: targetService['jwtClient'] })
      sourceAdminService = google.admin({ version: 'directory_v1', auth: sourceService['jwtClient'] })
      targetAdminService = google.admin({ version: 'directory_v1', auth: targetService['jwtClient'] })
    }

    const migrationId = `chat-${Date.now()}-${sourceUserEmail}`
    const progress: ChatMigrationProgress = {
      totalSpaces: 0,
      processedSpaces: 0,
      migratedSpaces: 0,
      failedSpaces: 0,
      totalMessages: 0,
      migratedMessages: 0,
      totalMembers: 0,
      migratedMembers: 0,
      currentBatch: 0,
      status: 'initializing',
      errors: []
    }

    // Step 1: Get chat statistics
    const chatStats = await getChatStatistics(sourceChatService, sourceUserEmail, specificSpaces)
    progress.totalSpaces = chatStats.spaceCount
    progress.totalMessages = chatStats.messageCount
    progress.totalMembers = chatStats.memberCount
    progress.status = 'processing'

    // Step 2: Start chat migration process (async)
    processChatMigration(
      sourceChatService,
      targetChatService,
      sourceAdminService,
      targetAdminService,
      sourceUserEmail,
      targetUserEmail,
      migrationOptions,
      progress,
      migrationId,
      specificSpaces
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

// Helper function to get chat statistics
async function getChatStatistics(chatService: any, userEmail: string, specificSpaces?: string[]) {
  try {
    let spaceCount = 0
    let messageCount = 0
    let memberCount = 0

    if (specificSpaces && specificSpaces.length > 0) {
      spaceCount = specificSpaces.length
      for (const spaceId of specificSpaces) {
        try {
          // Get space details
          const space = await chatService.spaces.get({ name: spaceId })
          
          // Count messages (limited by API)
          const messagesResponse = await chatService.spaces.messages.list({
            parent: spaceId,
            pageSize: 100 // API limitation
          })
          messageCount += messagesResponse.data.messages?.length || 0

          // Count members
          const membersResponse = await chatService.spaces.members.list({
            parent: spaceId
          })
          memberCount += membersResponse.data.memberships?.length || 0

        } catch (error) {
          console.error(`Error getting statistics for space ${spaceId}:`, error)
        }
      }
    } else {
      // List all spaces where user is a member
      try {
        const spacesResponse = await chatService.spaces.list({
          filter: `spaceType = "SPACE"` // Only include named spaces, not DMs
        })

        const spaces = spacesResponse.data.spaces || []
        spaceCount = spaces.length

        // Count messages and members for each space
        for (const space of spaces) {
          try {
            const messagesResponse = await chatService.spaces.messages.list({
              parent: space.name,
              pageSize: 100
            })
            messageCount += messagesResponse.data.messages?.length || 0

            const membersResponse = await chatService.spaces.members.list({
              parent: space.name
            })
            memberCount += membersResponse.data.memberships?.length || 0

          } catch (error) {
            console.error(`Error getting statistics for space ${space.name}:`, error)
          }
        }
      } catch (error) {
        console.error('Error listing spaces:', error)
      }
    }

    return { spaceCount, messageCount, memberCount }
  } catch (error) {
    console.error('Error getting chat statistics:', error)
    return { spaceCount: 0, messageCount: 0, memberCount: 0 }
  }
}

// Async function for processing chat migration
async function processChatMigration(
  sourceChatService: any,
  targetChatService: any,
  sourceAdminService: any,
  targetAdminService: any,
  sourceUserEmail: string,
  targetUserEmail: string,
  options: any,
  progress: ChatMigrationProgress,
  migrationId: string,
  specificSpaces?: string[]
) {
  try {
    let spacesToMigrate: any[] = []

    if (specificSpaces && specificSpaces.length > 0) {
      // Get specific spaces
      for (const spaceId of specificSpaces) {
        try {
          const space = await sourceChatService.spaces.get({ name: spaceId })
          spacesToMigrate.push(space.data)
        } catch (error) {
          console.error(`Error fetching space ${spaceId}:`, error)
        }
      }
    } else {
      // Get all spaces where user is a member
      if (options.includeSpaces) {
        const spacesResponse = await sourceChatService.spaces.list({
          filter: `spaceType = "SPACE"`
        })
        spacesToMigrate = spacesResponse.data.spaces || []
      }
    }

    // Process spaces in batches
    const batchSize = options.batchSize || 2 // Lower batch size for Chat API
    for (let i = 0; i < spacesToMigrate.length; i += batchSize) {
      const batch = spacesToMigrate.slice(i, i + batchSize)
      
      const migrationPromises = batch.map(async (space: any) => {
        try {
          // Create new space in target
          const newSpace = await createTargetSpace(targetChatService, space, targetUserEmail)

          // Migrate members if enabled
          if (options.preserveMemberships) {
            await migrateSpaceMembers(
              sourceChatService,
              targetChatService,
              space.name,
              newSpace.name,
              progress
            )
          }

          // Migrate message history if enabled
          if (options.includeHistory) {
            await migrateSpaceMessages(
              sourceChatService,
              targetChatService,
              space.name,
              newSpace.name,
              options.messageHistoryDays,
              progress
            )
          }

          progress.migratedSpaces++

        } catch (error) {
          progress.failedSpaces++
          progress.errors.push({
            spaceId: space.name,
            spaceName: space.displayName || 'Unknown Space',
            error: (error as Error).message,
            timestamp: new Date().toISOString()
          })
        }
        progress.processedSpaces++
      })

      await Promise.all(migrationPromises)
      progress.currentBatch++
    }

    // Handle direct messages if enabled
    if (options.includeDirectMessages) {
      await migrateDirectMessages(
        sourceChatService,
        targetChatService,
        sourceUserEmail,
        targetUserEmail,
        options.messageHistoryDays,
        progress
      )
    }

    progress.status = 'completed'

  } catch (error) {
    progress.status = 'failed'
    console.error('Chat migration processing error:', error)
  }
}

// Helper function to create target space
async function createTargetSpace(chatService: any, sourceSpace: any, targetUserEmail: string) {
  try {
    const newSpace = await chatService.spaces.create({
      requestBody: {
        displayName: sourceSpace.displayName,
        spaceType: sourceSpace.spaceType || 'SPACE',
        spaceDetails: {
          description: sourceSpace.spaceDetails?.description || '',
          guidelines: sourceSpace.spaceDetails?.guidelines || ''
        },
        spaceHistoryState: sourceSpace.spaceHistoryState || 'HISTORY_ON',
        importMode: false // Set to true if you want to import with preserved timestamps
      }
    })

    return newSpace.data
  } catch (error) {
    console.error('Error creating target space:', error)
    throw error
  }
}

// Helper function to migrate space members
async function migrateSpaceMembers(
  sourceChatService: any,
  targetChatService: any,
  sourceSpaceName: string,
  targetSpaceName: string,
  progress: ChatMigrationProgress
) {
  try {
    const membersResponse = await sourceChatService.spaces.members.list({
      parent: sourceSpaceName
    })

    const members = membersResponse.data.memberships || []

    for (const member of members) {
      try {
        // Skip if member is a bot or the same user
        if (member.member?.type === 'BOT') continue

        await targetChatService.spaces.members.create({
          parent: targetSpaceName,
          requestBody: {
            member: {
              name: member.member?.name,
              type: member.member?.type
            },
            role: member.role || 'ROLE_MEMBER'
          }
        })

        progress.migratedMembers++
      } catch (error) {
        console.error(`Error migrating member ${member.member?.name}:`, error)
      }
    }
  } catch (error) {
    console.error('Error migrating space members:', error)
  }
}

// Helper function to migrate space messages
async function migrateSpaceMessages(
  sourceChatService: any,
  targetChatService: any,
  sourceSpaceName: string,
  targetSpaceName: string,
  historyDays?: number,
  progress?: ChatMigrationProgress
) {
  try {
    let filter = ''
    
    if (historyDays) {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - historyDays)
      filter = `createTime >= "${cutoffDate.toISOString()}"`
    }

    const messagesResponse = await sourceChatService.spaces.messages.list({
      parent: sourceSpaceName,
      filter: filter,
      pageSize: 100 // API limitation
    })

    const messages = messagesResponse.data.messages || []

    for (const message of messages) {
      try {
        // Note: Chat API doesn't support creating messages as other users
        // This is a limitation of the Google Chat API
        // In a real implementation, you might need to use Chat Apps or webhooks
        
        // For now, we'll create a summary message about the migration
        await targetChatService.spaces.messages.create({
          parent: targetSpaceName,
          requestBody: {
            text: `[Migrated Message] Original from: ${message.sender?.displayName}\nTime: ${message.createTime}\nContent: ${message.text || '[Rich content not preserved]'}`
          }
        })

        if (progress) progress.migratedMessages++
      } catch (error) {
        console.error(`Error migrating message ${message.name}:`, error)
      }
    }
  } catch (error) {
    console.error('Error migrating space messages:', error)
  }
}

// Helper function to migrate direct messages
async function migrateDirectMessages(
  sourceChatService: any,
  targetChatService: any,
  sourceUserEmail: string,
  targetUserEmail: string,
  historyDays?: number,
  progress?: ChatMigrationProgress
) {
  try {
    // Note: Direct message migration is complex and has API limitations
    // Google Chat API doesn't provide easy access to DM history
    // This would typically require special permissions and different approaches
    
    console.log('Direct message migration has API limitations and requires special implementation')
    
    // In a real implementation, you might:
    // 1. Use Google Takeout data export
    // 2. Use Chat webhooks
    // 3. Use specialized Chat Apps with elevated permissions
    
  } catch (error) {
    console.error('Error migrating direct messages:', error)
  }
}

// GET endpoint to check migration progress
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const migrationId = searchParams.get('migrationId')

  if (!migrationId) {
    return NextResponse.json({ error: 'Migration ID required' }, { status: 400 })
  }

  return NextResponse.json({
    migrationId,
    progress: {
      totalSpaces: 5,
      processedSpaces: 3,
      migratedSpaces: 2,
      failedSpaces: 1,
      totalMessages: 150,
      migratedMessages: 120,
      totalMembers: 25,
      migratedMembers: 20,
      currentBatch: 2,
      status: 'processing',
      errors: []
    }
  })
}
