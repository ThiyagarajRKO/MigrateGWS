import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { createServiceAccountService } from '@/lib/google-workspace'
import { authOptions } from '@/lib/auth-options'
import { google } from 'googleapis'

// Helper function to get OAuth token
function getOAuthToken(domain: string, type: 'source' | 'target') {
  const tokens = globalThis.oauthTokens || {}
  return Object.values(tokens).find(token => 
    token.domain === domain && token.type === type
  )
}

interface GmailMigrationRequest {
  sourceAdminEmail: string
  targetAdminEmail: string
  sourceUserEmail: string
  targetUserEmail: string
  migrationOptions: {
    includeLabels: boolean
    includeFilters: boolean
    includeSignature: boolean
    dateRange?: {
      after?: string
      before?: string
    }
    batchSize: number
  }
  scenario: 'single-super-admin' | 'cross-tenant'
  domainMapping: 'one-to-one' | 'one-to-many' | 'many-to-one'
}

interface GmailMigrationProgress {
  totalMessages: number
  processedMessages: number
  migratedMessages: number
  failedMessages: number
  currentBatch: number
  status: 'initializing' | 'processing' | 'completed' | 'failed'
  errors: Array<{
    messageId: string
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

    const body: GmailMigrationRequest = await request.json()
    const {
      sourceAdminEmail,
      targetAdminEmail,
      sourceUserEmail,
      targetUserEmail,
      migrationOptions,
      scenario,
      domainMapping
    } = body

    // Initialize Gmail services based on scenario
    let sourceGmailService: any
    let targetGmailService: any

    if (scenario === 'single-super-admin') {
      // Single admin manages both domains
      const gwsService = createServiceAccountService(sourceAdminEmail)
      sourceGmailService = google.gmail({ version: 'v1', auth: gwsService['jwtClient'] })
      targetGmailService = sourceGmailService
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
        
        sourceGmailService = google.gmail({ version: 'v1', auth: sourceAuth })
        targetGmailService = google.gmail({ version: 'v1', auth: targetAuth })
      } else {
        // Fallback to service accounts
        const sourceService = createServiceAccountService(sourceAdminEmail)
        const targetService = createServiceAccountService(targetAdminEmail)
        sourceGmailService = google.gmail({ version: 'v1', auth: sourceService['jwtClient'] })
        targetGmailService = google.gmail({ version: 'v1', auth: targetService['jwtClient'] })
      }
    }

    // Start Gmail migration process
    const migrationId = `gmail-${Date.now()}-${sourceUserEmail}`
    const progress: GmailMigrationProgress = {
      totalMessages: 0,
      processedMessages: 0,
      migratedMessages: 0,
      failedMessages: 0,
      currentBatch: 0,
      status: 'initializing',
      errors: []
    }

    // Step 1: Get total message count
    const messageListResponse = await sourceGmailService.users.messages.list({
      userId: sourceUserEmail,
      maxResults: 1
    })
    
    progress.totalMessages = messageListResponse.data.resultSizeEstimate || 0
    progress.status = 'processing'

    // Step 2: Migrate labels first (if enabled)
    if (migrationOptions.includeLabels) {
      await migrateLabels(sourceGmailService, targetGmailService, sourceUserEmail, targetUserEmail)
    }

    // Step 3: Migrate filters (if enabled)
    if (migrationOptions.includeFilters) {
      await migrateFilters(sourceGmailService, targetGmailService, sourceUserEmail, targetUserEmail)
    }

    // Step 4: Migrate signature (if enabled)
    if (migrationOptions.includeSignature) {
      await migrateSignature(sourceGmailService, targetGmailService, sourceUserEmail, targetUserEmail)
    }

    // Step 5: Start batch message migration (async process)
    processMessageMigration(
      sourceGmailService,
      targetGmailService,
      sourceUserEmail,
      targetUserEmail,
      migrationOptions,
      progress,
      migrationId
    )

    return NextResponse.json({
      success: true,
      migrationId,
      progress,
      message: 'Gmail migration started successfully'
    })

  } catch (error: any) {
    console.error('Gmail migration error:', error)
    return NextResponse.json({
      error: 'Gmail migration failed',
      details: error.message
    }, { status: 500 })
  }
}

// Helper function to migrate labels
async function migrateLabels(sourceService: any, targetService: any, sourceEmail: string, targetEmail: string) {
  try {
    const labelsResponse = await sourceService.users.labels.list({ userId: sourceEmail })
    const sourceLabels = labelsResponse.data.labels || []

    // Get existing target labels to avoid duplicates
    const targetLabelsResponse = await targetService.users.labels.list({ userId: targetEmail })
    const existingLabels = new Set(targetLabelsResponse.data.labels?.map((l: any) => l.name) || [])

    for (const label of sourceLabels) {
      // Skip system labels and existing labels
      if (label.type === 'system' || existingLabels.has(label.name)) continue

      await targetService.users.labels.create({
        userId: targetEmail,
        requestBody: {
          name: label.name,
          labelListVisibility: label.labelListVisibility,
          messageListVisibility: label.messageListVisibility,
          color: label.color
        }
      })
    }
  } catch (error) {
    console.error('Label migration error:', error)
    throw new Error('Failed to migrate Gmail labels')
  }
}

// Helper function to migrate filters
async function migrateFilters(sourceService: any, targetService: any, sourceEmail: string, targetEmail: string) {
  try {
    const filtersResponse = await sourceService.users.settings.filters.list({ userId: sourceEmail })
    const sourceFilters = filtersResponse.data.filter || []

    for (const filter of sourceFilters) {
      await targetService.users.settings.filters.create({
        userId: targetEmail,
        requestBody: {
          criteria: filter.criteria,
          action: filter.action
        }
      })
    }
  } catch (error) {
    console.error('Filter migration error:', error)
    throw new Error('Failed to migrate Gmail filters')
  }
}

// Helper function to migrate signature
async function migrateSignature(sourceService: any, targetService: any, sourceEmail: string, targetEmail: string) {
  try {
    const settingsResponse = await sourceService.users.settings.sendAs.list({ userId: sourceEmail })
    const sendAsSettings = settingsResponse.data.sendAs || []

    for (const setting of sendAsSettings) {
      if (setting.signature) {
        await targetService.users.settings.sendAs.patch({
          userId: targetEmail,
          sendAsEmail: targetEmail,
          requestBody: {
            signature: setting.signature
          }
        })
      }
    }
  } catch (error) {
    console.error('Signature migration error:', error)
    throw new Error('Failed to migrate Gmail signature')
  }
}

// Async function for processing message migration in batches
async function processMessageMigration(
  sourceService: any,
  targetService: any,
  sourceEmail: string,
  targetEmail: string,
  options: any,
  progress: GmailMigrationProgress,
  migrationId: string
) {
  try {
    let pageToken: string | undefined = undefined
    const batchSize = options.batchSize || 100

    do {
      const messagesResponse: any = await sourceService.users.messages.list({
        userId: sourceEmail,
        maxResults: batchSize,
        pageToken,
        q: buildSearchQuery(options.dateRange)
      })

      const messages = messagesResponse.data.messages || []
      pageToken = messagesResponse.data.nextPageToken

      // Process messages in parallel batches
      const migrationPromises = messages.map(async (message: any) => {
        try {
          // Get full message
          const fullMessage = await sourceService.users.messages.get({
            userId: sourceEmail,
            id: message.id,
            format: 'raw'
          })

          // Import to target account
          await targetService.users.messages.import({
            userId: targetEmail,
            requestBody: {
              raw: fullMessage.data.raw
            }
          })

          progress.migratedMessages++
        } catch (error) {
          progress.failedMessages++
          progress.errors.push({
            messageId: message.id,
            error: (error as Error).message,
            timestamp: new Date().toISOString()
          })
        }
        progress.processedMessages++
      })

      await Promise.all(migrationPromises)
      progress.currentBatch++

    } while (pageToken)

    progress.status = 'completed'

  } catch (error) {
    progress.status = 'failed'
    console.error('Message migration processing error:', error)
  }
}

// Helper to build search query from date range
function buildSearchQuery(dateRange?: { after?: string; before?: string }): string | undefined {
  if (!dateRange) return undefined
  
  const queries = []
  if (dateRange.after) queries.push(`after:${dateRange.after}`)
  if (dateRange.before) queries.push(`before:${dateRange.before}`)
  
  return queries.length > 0 ? queries.join(' ') : undefined
}

// GET endpoint to check migration progress
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const migrationId = searchParams.get('migrationId')

  if (!migrationId) {
    return NextResponse.json({ error: 'Migration ID required' }, { status: 400 })
  }

  // In production, this would fetch from a database/cache
  // For now, return a mock response
  return NextResponse.json({
    migrationId,
    progress: {
      totalMessages: 1000,
      processedMessages: 750,
      migratedMessages: 700,
      failedMessages: 50,
      currentBatch: 8,
      status: 'processing',
      errors: []
    }
  })
}
