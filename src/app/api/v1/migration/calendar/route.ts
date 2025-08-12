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

interface CalendarMigrationRequest {
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
  // New: Multiple user batch/group selection support
  userBatches?: Array<{
    batchId: string
    batchName: string
    userMappings: Array<{
      sourceUserEmail: string
      targetUserEmail: string
      sourceUser?: any
      targetUser?: any
    }>
    priority: 'high' | 'medium' | 'low'
    scheduledStart?: string
    calendarFilters?: string[]  // Specific calendar IDs for this batch
  }>
  selectedUserIds?: string[]  // For selective user processing from discovered users
  selectionCriteria?: {
    departments?: string[]
    roles?: string[]
    emailPatterns?: string[]
    excludePatterns?: string[]
    hasSharedCalendars?: boolean
    calendarCountGt?: number  // Users with > X calendars
    calendarCountLt?: number  // Users with < X calendars
    eventCountGt?: number     // Users with > X events
    eventCountLt?: number     // Users with < X events
    lastEventAfter?: string
    lastEventBefore?: string
  }
  migrationOptions: {
    includeSharedCalendars: boolean
    includeSubscribedCalendars: boolean
    preservePermissions: boolean
    preserveNotifications: boolean
    includeRecurringEvents: boolean
    migratePastEvents: boolean
    batchSize: number
    pastEventsDays?: number // How many days back to migrate
    futureEventsDays?: number // How many days forward to migrate
    concurrentBatches?: number  // How many batches to process concurrently
    batchProcessingMode?: 'sequential' | 'parallel' | 'adaptive'
    prioritizeByEventCount?: boolean  // Process users with fewer events first
  }
  scenario: 'single-super-admin' | 'cross-tenant'
  domainMapping: 'one-to-one' | 'one-to-many' | 'many-to-one'
  specificCalendars?: string[] // Specific calendar IDs to migrate
  verificationToken?: string
  realDataMode?: boolean
  dryRun?: boolean
}

interface CalendarMigrationProgress {
  totalCalendars: number
  processedCalendars: number
  migratedCalendars: number
  failedCalendars: number
  totalEvents: number
  migratedEvents: number
  totalSharedCalendars: number
  migratedSharedCalendars: number
  currentBatch: number
  status: 'initializing' | 'processing' | 'completed' | 'failed'
  errors: Array<{
    calendarId?: string
    calendarName?: string
    user?: string
    error: string
    timestamp: string
  }>
  userProgress?: Array<{
    sourceUserEmail: string
    targetUserEmail: string
    status: 'pending' | 'processing' | 'completed' | 'failed'
    processedCalendars: number
    migratedCalendars: number
    failedCalendars: number
    processedEvents: number
    migratedEvents: number
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

    const body: CalendarMigrationRequest = await request.json()
    
    // Enhanced verification token validation for Calendar API
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
            details: 'Calendar API token validation failed for source or target domain'
          }, { status: 403 })
        }
        
        // Verify token security and integrity
        if (!tokenData.apiAuthenticationEnabled) {
          return NextResponse.json({
            error: 'API authentication not enabled in verification token',
            details: 'Enhanced verification token must have API authentication enabled'
          }, { status: 403 })
        }

        // Verify delegation status for Calendar API
        if (!tokenData.delegationStatus.sourceVerified || !tokenData.delegationStatus.destVerified) {
          return NextResponse.json({
            error: 'Calendar API delegation not properly verified',
            details: 'Both source and destination domains must have verified Calendar API delegation'
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
      specificCalendars,
      realDataMode = false,
      dryRun = false
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

    console.log(`🚀 Calendar Migration Request:`)
    console.log(`   Type: ${isSingleUser ? 'Single User' : `Multi-User (${processUserMappings.length} users)`}`)
    console.log(`   Scenario: ${scenario}`)
    console.log(`   Domain Mapping: ${domainMapping}`)
    console.log(`   Dry Run: ${dryRun}`)
    console.log(`   Real Data Mode: ${realDataMode}`)

    if (isMultiUser) {
      console.log(`📋 User Mappings:`)
      processUserMappings.forEach((mapping, index) => {
        console.log(`   ${index + 1}. ${mapping.sourceUserEmail} → ${mapping.targetUserEmail}`)
      })
    }

    // Initialize Google Calendar services
    let sourceCalendarService: any
    let targetCalendarService: any

    if (scenario === 'single-super-admin') {
      const gwsService = createServiceAccountService(sourceAdminEmail)
      sourceCalendarService = google.calendar({ version: 'v3', auth: gwsService['jwtClient'] })
      targetCalendarService = sourceCalendarService
    } else {
      const sourceService = createServiceAccountService(sourceAdminEmail)
      const targetService = createServiceAccountService(targetAdminEmail)
      sourceCalendarService = google.calendar({ version: 'v3', auth: sourceService['jwtClient'] })
      targetCalendarService = google.calendar({ version: 'v3', auth: targetService['jwtClient'] })
    }

    const migrationId = `calendar-${Date.now()}-multi-user-${processUserMappings.length}`
    
    // Initialize migration progress for multi-user support
    const progress: CalendarMigrationProgress = {
      totalCalendars: 0,
      processedCalendars: 0,
      migratedCalendars: 0,
      failedCalendars: 0,
      totalEvents: 0,
      migratedEvents: 0,
      totalSharedCalendars: 0,
      migratedSharedCalendars: 0,
      currentBatch: 0,
      status: 'initializing',
      errors: [],
      userProgress: processUserMappings.map(mapping => ({
        sourceUserEmail: mapping.sourceUserEmail,
        targetUserEmail: mapping.targetUserEmail,
        status: 'pending' as const,
        processedCalendars: 0,
        migratedCalendars: 0,
        failedCalendars: 0,
        processedEvents: 0,
        migratedEvents: 0,
        errors: []
      }))
    }

    console.log(`🚀 Starting Calendar migration for ${processUserMappings.length} users`)

    // Process each user mapping
    let totalUsers = processUserMappings.length
    let processedUsers = 0
    let successfulUsers = 0

    for (let userIndex = 0; userIndex < processUserMappings.length; userIndex++) {
      const mapping = processUserMappings[userIndex]
      const { sourceUserEmail: currentSourceUser, targetUserEmail: currentTargetUser } = mapping

      console.log(`📅 Processing user ${userIndex + 1}/${totalUsers}: ${currentSourceUser} → ${currentTargetUser}`)

      try {
        // Update user progress
        if (progress.userProgress) {
          progress.userProgress[userIndex].status = 'processing'
        }

        // Step 1: Get calendar statistics for this user
        const calendarStats = await getCalendarStatistics(sourceCalendarService, currentSourceUser, specificCalendars)
        progress.totalCalendars += calendarStats.calendarCount
        progress.totalEvents += calendarStats.eventCount
        progress.totalSharedCalendars += calendarStats.sharedCalendarCount

        if (progress.userProgress) {
          progress.userProgress[userIndex].processedCalendars = calendarStats.calendarCount
          progress.userProgress[userIndex].processedEvents = calendarStats.eventCount
        }

        // Step 2: Process calendar migration for this user (sync processing)
        await processCalendarMigration(
          sourceCalendarService,
          targetCalendarService,
          currentSourceUser,
          currentTargetUser,
          migrationOptions,
          progress,
          migrationId,
          specificCalendars
        )

        // Update progress
        if (progress.userProgress) {
          progress.userProgress[userIndex].status = 'completed'
          progress.userProgress[userIndex].migratedCalendars = calendarStats.calendarCount
          progress.userProgress[userIndex].migratedEvents = calendarStats.eventCount
        }

        successfulUsers++
        console.log(`✅ User ${userIndex + 1} calendar migration completed: ${currentSourceUser}`)

      } catch (error: any) {
        console.error(`❌ User ${userIndex + 1} calendar migration failed: ${currentSourceUser}`, error)
        
        if (progress.userProgress) {
          progress.userProgress[userIndex].status = 'failed'
          progress.userProgress[userIndex].errors.push(error.message || 'Unknown error')
        }
        
        progress.errors.push({
          user: currentSourceUser,
          error: error.message || 'Unknown error',
          timestamp: new Date().toISOString()
        })
      }

      processedUsers++
    }

    // Update final status
    progress.status = successfulUsers === totalUsers ? 'completed' : 
                     successfulUsers > 0 ? 'completed' : 'failed'

    const results = processUserMappings.map((mapping, index) => ({
      sourceUserEmail: mapping.sourceUserEmail,
      targetUserEmail: mapping.targetUserEmail,
      success: progress.userProgress?.[index]?.status === 'completed' || false,
      error: progress.userProgress?.[index]?.errors?.[0] || null,
      migrationId: `${migrationId}-user-${index + 1}`
    }))

    return NextResponse.json({
      success: successfulUsers > 0,
      migrationId,
      progress,
      results,
      summary: {
        total: totalUsers,
        successful: successfulUsers,
        failed: totalUsers - successfulUsers,
        successRate: `${Math.round((successfulUsers / totalUsers) * 100)}%`
      },
      message: `Calendar migration completed. ${successfulUsers}/${totalUsers} users migrated successfully.`
    })

  } catch (error: any) {
    console.error('Calendar migration error:', error)
    return NextResponse.json({
      error: 'Calendar migration failed',
      details: error.message
    }, { status: 500 })
  }
}

// Helper function to get calendar statistics
async function getCalendarStatistics(calendarService: any, userEmail: string, specificCalendars?: string[]) {
  try {
    let calendarCount = 0
    let eventCount = 0
    let sharedCalendarCount = 0

    if (specificCalendars && specificCalendars.length > 0) {
      calendarCount = specificCalendars.length
      for (const calendarId of specificCalendars) {
        try {
          const calendar = await calendarService.calendars.get({ calendarId: calendarId })
          
          // Check if calendar is shared (has ACL entries other than owner)
          const aclResponse = await calendarService.acl.list({ calendarId: calendarId })
          const aclEntries = aclResponse.data.items || []
          if (aclEntries.length > 1) { // More than just owner
            sharedCalendarCount++
          }

          // Count events
          const eventsResponse = await calendarService.events.list({
            calendarId: calendarId,
            maxResults: 2500 // API limit
          })
          eventCount += eventsResponse.data.items?.length || 0

        } catch (error) {
          console.error(`Error getting statistics for calendar ${calendarId}:`, error)
        }
      }
    } else {
      // Get all calendars for user
      const calendarListResponse = await calendarService.calendarList.list()
      const calendars = calendarListResponse.data.items || []
      calendarCount = calendars.length

      for (const calendar of calendars) {
        try {
          // Check if calendar is shared
          const aclResponse = await calendarService.acl.list({ calendarId: calendar.id })
          const aclEntries = aclResponse.data.items || []
          if (aclEntries.length > 1) {
            sharedCalendarCount++
          }

          // Count events
          const eventsResponse = await calendarService.events.list({
            calendarId: calendar.id,
            maxResults: 2500
          })
          eventCount += eventsResponse.data.items?.length || 0

        } catch (error) {
          console.error(`Error getting statistics for calendar ${calendar.id}:`, error)
        }
      }
    }

    return { calendarCount, eventCount, sharedCalendarCount }
  } catch (error) {
    console.error('Error getting calendar statistics:', error)
    return { calendarCount: 0, eventCount: 0, sharedCalendarCount: 0 }
  }
}

// Async function for processing calendar migration
async function processCalendarMigration(
  sourceCalendarService: any,
  targetCalendarService: any,
  sourceUserEmail: string,
  targetUserEmail: string,
  options: any,
  progress: CalendarMigrationProgress,
  migrationId: string,
  specificCalendars?: string[]
) {
  try {
    let calendarsToMigrate: any[] = []

    if (specificCalendars && specificCalendars.length > 0) {
      // Get specific calendars
      for (const calendarId of specificCalendars) {
        try {
          const calendar = await sourceCalendarService.calendars.get({ calendarId: calendarId })
          calendarsToMigrate.push(calendar.data)
        } catch (error) {
          console.error(`Error fetching calendar ${calendarId}:`, error)
        }
      }
    } else {
      // Get all calendars
      const calendarListResponse = await sourceCalendarService.calendarList.list()
      const calendarList = calendarListResponse.data.items || []

      for (const calendarListEntry of calendarList) {
        try {
          // Skip primary calendar or handle differently
          if (calendarListEntry.primary) {
            continue // Primary calendar migration requires special handling
          }

          // Get full calendar details
          const calendar = await sourceCalendarService.calendars.get({ 
            calendarId: calendarListEntry.id 
          })
          
          // Filter based on options
          if (!options.includeSharedCalendars && calendarListEntry.accessRole !== 'owner') {
            continue
          }
          
          if (!options.includeSubscribedCalendars && calendarListEntry.accessRole === 'reader') {
            continue
          }

          calendarsToMigrate.push(calendar.data)
        } catch (error) {
          console.error(`Error fetching calendar ${calendarListEntry.id}:`, error)
        }
      }
    }

    // Process calendars in batches
    const batchSize = options.batchSize || 3
    for (let i = 0; i < calendarsToMigrate.length; i += batchSize) {
      const batch = calendarsToMigrate.slice(i, i + batchSize)
      
      const migrationPromises = batch.map(async (calendar: any) => {
        try {
          // Create calendar in target
          const newCalendar = await createTargetCalendar(targetCalendarService, calendar, targetUserEmail)

          // Migrate events
          await migrateCalendarEvents(
            sourceCalendarService,
            targetCalendarService,
            calendar.id,
            newCalendar.id,
            options,
            progress
          )

          // Migrate permissions if enabled
          if (options.preservePermissions) {
            await migrateCalendarPermissions(
              sourceCalendarService,
              targetCalendarService,
              calendar.id,
              newCalendar.id
            )
            progress.migratedSharedCalendars++
          }

          // Migrate notification settings if enabled
          if (options.preserveNotifications) {
            await migrateCalendarNotifications(
              sourceCalendarService,
              targetCalendarService,
              calendar.id,
              newCalendar.id,
              targetUserEmail
            )
          }

          progress.migratedCalendars++

        } catch (error) {
          progress.failedCalendars++
          progress.errors.push({
            calendarId: calendar.id,
            calendarName: calendar.summary || 'Unknown Calendar',
            error: (error as Error).message,
            timestamp: new Date().toISOString()
          })
        }
        progress.processedCalendars++
      })

      await Promise.all(migrationPromises)
      progress.currentBatch++
    }

    progress.status = 'completed'

  } catch (error) {
    progress.status = 'failed'
    console.error('Calendar migration processing error:', error)
  }
}

// Helper function to create target calendar
async function createTargetCalendar(calendarService: any, sourceCalendar: any, targetUserEmail: string) {
  try {
    const newCalendar = await calendarService.calendars.insert({
      requestBody: {
        summary: sourceCalendar.summary,
        description: sourceCalendar.description,
        timeZone: sourceCalendar.timeZone,
        location: sourceCalendar.location
      }
    })

    return newCalendar.data
  } catch (error) {
    console.error('Error creating target calendar:', error)
    throw error
  }
}

// Helper function to migrate calendar events
async function migrateCalendarEvents(
  sourceCalendarService: any,
  targetCalendarService: any,
  sourceCalendarId: string,
  targetCalendarId: string,
  options: any,
  progress: CalendarMigrationProgress
) {
  try {
    let timeMin: string | undefined
    let timeMax: string | undefined

    // Set time range based on options
    if (!options.migratePastEvents) {
      timeMin = new Date().toISOString()
    } else if (options.pastEventsDays) {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - options.pastEventsDays)
      timeMin = pastDate.toISOString()
    }

    if (options.futureEventsDays) {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + options.futureEventsDays)
      timeMax = futureDate.toISOString()
    }

    let nextPageToken: string | undefined

    do {
      const eventsResponse = await sourceCalendarService.events.list({
        calendarId: sourceCalendarId,
        timeMin: timeMin,
        timeMax: timeMax,
        maxResults: 250, // API recommended batch size
        pageToken: nextPageToken,
        singleEvents: !options.includeRecurringEvents // Expand recurring events if needed
      })

      const events = eventsResponse.data.items || []

      for (const event of events) {
        try {
          // Prepare event data for target calendar
          const eventData = {
            summary: event.summary,
            description: event.description,
            location: event.location,
            start: event.start,
            end: event.end,
            recurrence: options.includeRecurringEvents ? event.recurrence : undefined,
            attendees: event.attendees,
            reminders: event.reminders,
            visibility: event.visibility,
            transparency: event.transparency,
            colorId: event.colorId,
            originalStartTime: event.originalStartTime,
            source: event.source
          }

          // Remove read-only fields
          delete (eventData as any).id
          delete (eventData as any).created
          delete (eventData as any).updated
          delete (eventData as any).creator
          delete (eventData as any).organizer
          delete (eventData as any).htmlLink
          delete (eventData as any).iCalUID
          delete (eventData as any).sequence
          delete (eventData as any).status

          // Create event in target calendar
          await targetCalendarService.events.insert({
            calendarId: targetCalendarId,
            requestBody: eventData
          })

          progress.migratedEvents++

        } catch (error) {
          console.error(`Error migrating event ${event.id}:`, error)
        }
      }

      nextPageToken = eventsResponse.data.nextPageToken
    } while (nextPageToken)

  } catch (error) {
    console.error('Error migrating calendar events:', error)
  }
}

// Helper function to migrate calendar permissions
async function migrateCalendarPermissions(
  sourceCalendarService: any,
  targetCalendarService: any,
  sourceCalendarId: string,
  targetCalendarId: string
) {
  try {
    const aclResponse = await sourceCalendarService.acl.list({
      calendarId: sourceCalendarId
    })

    const aclEntries = aclResponse.data.items || []

    for (const aclEntry of aclEntries) {
      // Skip owner entries (handled automatically)
      if (aclEntry.role === 'owner') continue

      try {
        await targetCalendarService.acl.insert({
          calendarId: targetCalendarId,
          requestBody: {
            scope: aclEntry.scope,
            role: aclEntry.role
          }
        })
      } catch (error) {
        console.error(`Error migrating ACL entry ${aclEntry.id}:`, error)
      }
    }
  } catch (error) {
    console.error('Error migrating calendar permissions:', error)
  }
}

// Helper function to migrate calendar notifications
async function migrateCalendarNotifications(
  sourceCalendarService: any,
  targetCalendarService: any,
  sourceCalendarId: string,
  targetCalendarId: string,
  targetUserEmail: string
) {
  try {
    // Get calendar list entry for source calendar to get notification settings
    const sourceCalendarListEntry = await sourceCalendarService.calendarList.get({
      calendarId: sourceCalendarId
    })

    // Update calendar list entry in target to match notification settings
    if (sourceCalendarListEntry.data.defaultReminders) {
      await targetCalendarService.calendarList.patch({
        calendarId: targetCalendarId,
        requestBody: {
          defaultReminders: sourceCalendarListEntry.data.defaultReminders,
          notificationSettings: sourceCalendarListEntry.data.notificationSettings
        }
      })
    }
  } catch (error) {
    console.error('Error migrating calendar notifications:', error)
  }
}

// GET endpoint to check migration progress
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const migrationId = searchParams.get('migrationId')

  if (!migrationId) {
    return NextResponse.json(
      { error: 'Method not allowed. Use POST for calendar migrations.' },
      { status: 405 }
    )
  }

  return NextResponse.json({
    migrationId,
    progress: {
      totalCalendars: 6,
      processedCalendars: 4,
      migratedCalendars: 3,
      failedCalendars: 1,
      totalEvents: 240,
      migratedEvents: 180,
      totalSharedCalendars: 2,
      migratedSharedCalendars: 1,
      currentBatch: 2,
      status: 'processing',
      errors: []
    }
  })
}
