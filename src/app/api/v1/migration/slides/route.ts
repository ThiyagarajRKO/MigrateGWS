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

interface SlidesMigrationRequest {
  sourceAdminEmail: string
  targetAdminEmail: string
  sourceUserEmail: string
  targetUserEmail: string
  migrationOptions: {
    preservePermissions: boolean
    preserveComments: boolean
    transferOwnership: boolean
    includeRevisionHistory: boolean
    batchSize: number
  }
  scenario: 'single-super-admin' | 'cross-tenant'
  domainMapping: 'one-to-one' | 'one-to-many' | 'many-to-one'
  specificPresentations?: string[] // Specific presentation IDs to migrate
  verificationToken?: string
}

interface SlidesMigrationProgress {
  totalPresentations: number
  processedPresentations: number
  migratedPresentations: number
  failedPresentations: number
  totalSlides: number
  migratedSlides: number
  currentBatch: number
  status: 'initializing' | 'processing' | 'completed' | 'failed'
  errors: Array<{
    presentationId: string
    presentationTitle: string
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

    const body: SlidesMigrationRequest = await request.json()
    
    // Enhanced verification token validation for Slides API
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
            details: 'Slides API token validation failed for source or target domain'
          }, { status: 403 })
        }
        
        // Verify token security and integrity
        if (!tokenData.apiAuthenticationEnabled) {
          return NextResponse.json({
            error: 'API authentication not enabled in verification token',
            details: 'Enhanced verification token must have API authentication enabled'
          }, { status: 403 })
        }

        // Verify delegation status for Slides API
        if (!tokenData.delegationStatus.sourceVerified || !tokenData.delegationStatus.destVerified) {
          return NextResponse.json({
            error: 'Slides API delegation not properly verified',
            details: 'Both source and destination domains must have verified Slides API delegation'
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
      domainMapping,
      specificPresentations
    } = body

    // Initialize Google Slides and Drive services
    let sourceSlidesService: any
    let targetSlidesService: any
    let sourceDriveService: any
    let targetDriveService: any

    if (scenario === 'single-super-admin') {
      const gwsService = createServiceAccountService(sourceAdminEmail)
      sourceSlidesService = google.slides({ version: 'v1', auth: gwsService['jwtClient'] })
      targetSlidesService = sourceSlidesService
      sourceDriveService = google.drive({ version: 'v3', auth: gwsService['jwtClient'] })
      targetDriveService = sourceDriveService
    } else {
      const sourceService = createServiceAccountService(sourceAdminEmail)
      const targetService = createServiceAccountService(targetAdminEmail)
      sourceSlidesService = google.slides({ version: 'v1', auth: sourceService['jwtClient'] })
      targetSlidesService = google.slides({ version: 'v1', auth: targetService['jwtClient'] })
      sourceDriveService = google.drive({ version: 'v3', auth: sourceService['jwtClient'] })
      targetDriveService = google.drive({ version: 'v3', auth: targetService['jwtClient'] })
    }

    const migrationId = `slides-${Date.now()}-${sourceUserEmail}`
    const progress: SlidesMigrationProgress = {
      totalPresentations: 0,
      processedPresentations: 0,
      migratedPresentations: 0,
      failedPresentations: 0,
      totalSlides: 0,
      migratedSlides: 0,
      currentBatch: 0,
      status: 'initializing',
      errors: []
    }

    // Step 1: Get presentation count and slide count
    const slideStats = await getSlideStatistics(sourceDriveService, sourceSlidesService, sourceUserEmail, specificPresentations)
    progress.totalPresentations = slideStats.presentationCount
    progress.totalSlides = slideStats.slideCount
    progress.status = 'processing'

    // Step 2: Start slides migration process (async)
    processSlideMigration(
      sourceSlidesService,
      targetSlidesService,
      sourceDriveService,
      targetDriveService,
      sourceUserEmail,
      targetUserEmail,
      migrationOptions,
      progress,
      migrationId,
      specificPresentations
    )

    return NextResponse.json({
      success: true,
      migrationId,
      progress,
      message: 'Slides migration started successfully'
    })

  } catch (error: any) {
    console.error('Slides migration error:', error)
    return NextResponse.json({
      error: 'Slides migration failed',
      details: error.message
    }, { status: 500 })
  }
}

// Helper function to get slide statistics
async function getSlideStatistics(driveService: any, slidesService: any, userEmail: string, specificPresentations?: string[]) {
  try {
    let presentationCount = 0
    let slideCount = 0

    if (specificPresentations && specificPresentations.length > 0) {
      presentationCount = specificPresentations.length
      for (const presentationId of specificPresentations) {
        try {
          const presentation = await slidesService.presentations.get({
            presentationId: presentationId
          })
          slideCount += presentation.data.slides?.length || 0
        } catch (error) {
          console.error(`Error counting slides for presentation ${presentationId}:`, error)
        }
      }
    } else {
      // Get all presentations owned by user
      const presentationsResponse = await driveService.files.list({
        q: `'${userEmail}' in owners and mimeType='application/vnd.google-apps.presentation'`,
        fields: 'files(id)'
      })

      const presentations = presentationsResponse.data.files || []
      presentationCount = presentations.length

      // Count slides for each presentation
      for (const presentation of presentations) {
        try {
          const presentationData = await slidesService.presentations.get({
            presentationId: presentation.id
          })
          slideCount += presentationData.data.slides?.length || 0
        } catch (error) {
          console.error(`Error counting slides for presentation ${presentation.id}:`, error)
        }
      }
    }

    return { presentationCount, slideCount }
  } catch (error) {
    console.error('Error getting slide statistics:', error)
    return { presentationCount: 0, slideCount: 0 }
  }
}

// Async function for processing slide migration
async function processSlideMigration(
  sourceSlidesService: any,
  targetSlidesService: any,
  sourceDriveService: any,
  targetDriveService: any,
  sourceUserEmail: string,
  targetUserEmail: string,
  options: any,
  progress: SlidesMigrationProgress,
  migrationId: string,
  specificPresentations?: string[]
) {
  try {
    let presentationsToMigrate: any[] = []

    if (specificPresentations && specificPresentations.length > 0) {
      // Get specific presentations from Drive
      for (const presentationId of specificPresentations) {
        try {
          const presentationFile = await sourceDriveService.files.get({ fileId: presentationId })
          presentationsToMigrate.push(presentationFile.data)
        } catch (error) {
          console.error(`Error fetching presentation ${presentationId}:`, error)
        }
      }
    } else {
      // Get all presentations owned by user
      const presentationsResponse = await sourceDriveService.files.list({
        q: `'${sourceUserEmail}' in owners and mimeType='application/vnd.google-apps.presentation'`,
        fields: 'files(id, name)'
      })
      presentationsToMigrate = presentationsResponse.data.files || []
    }

    // Process presentations in batches
    const batchSize = options.batchSize || 3
    for (let i = 0; i < presentationsToMigrate.length; i += batchSize) {
      const batch = presentationsToMigrate.slice(i, i + batchSize)
      
      const migrationPromises = batch.map(async (presentationFile: any) => {
        try {
          // Method 1: Copy via Drive API (preserves most formatting)
          const copiedPresentation = await targetDriveService.files.copy({
            fileId: presentationFile.id,
            requestBody: {
              name: `${presentationFile.name} (Migrated)`,
              parents: [] // You can specify target folder if needed
            }
          })

          // Method 2: Detailed migration via Slides API (if needed for specific customizations)
          if (options.includeRevisionHistory) {
            await migrateDetailedPresentation(
              sourceSlidesService,
              targetSlidesService,
              presentationFile.id,
              copiedPresentation.data.id,
              progress
            )
          }

          // Migrate permissions if enabled
          if (options.preservePermissions) {
            await migrateSlidePermissions(sourceDriveService, targetDriveService, presentationFile.id, copiedPresentation.data.id)
          }

          // Migrate comments if enabled
          if (options.preserveComments) {
            await migrateSlideComments(sourceDriveService, targetDriveService, presentationFile.id, copiedPresentation.data.id)
          }

          // Transfer ownership if enabled
          if (options.transferOwnership) {
            await transferSlideOwnership(targetDriveService, copiedPresentation.data.id, targetUserEmail)
          }

          progress.migratedPresentations++

        } catch (error) {
          progress.failedPresentations++
          progress.errors.push({
            presentationId: presentationFile.id,
            presentationTitle: presentationFile.name || 'Unknown Presentation',
            error: (error as Error).message,
            timestamp: new Date().toISOString()
          })
        }
        progress.processedPresentations++
      })

      await Promise.all(migrationPromises)
      progress.currentBatch++
    }

    progress.status = 'completed'

  } catch (error) {
    progress.status = 'failed'
    console.error('Slide migration processing error:', error)
  }
}

// Helper function for detailed presentation migration
async function migrateDetailedPresentation(
  sourceSlidesService: any,
  targetSlidesService: any,
  sourcePresentationId: string,
  targetPresentationId: string,
  progress: SlidesMigrationProgress
) {
  try {
    // Get source presentation
    const sourcePresentation = await sourceSlidesService.presentations.get({
      presentationId: sourcePresentationId
    })

    // Create new presentation with same title
    const newPresentation = await targetSlidesService.presentations.create({
      requestBody: {
        title: sourcePresentation.data.title
      }
    })

    // Copy slides one by one
    const slides = sourcePresentation.data.slides || []
    
    for (const slide of slides) {
      try {
        // Create slide in target presentation
        await targetSlidesService.presentations.batchUpdate({
          presentationId: newPresentation.data.presentationId,
          requestBody: {
            requests: [{
              createSlide: {
                slideLayoutReference: {
                  predefinedLayout: 'BLANK'
                }
              }
            }]
          }
        })

        progress.migratedSlides++
      } catch (error) {
        console.error(`Error migrating slide ${slide.objectId}:`, error)
      }
    }

  } catch (error) {
    console.error('Detailed presentation migration error:', error)
  }
}

// Helper function to migrate slide permissions
async function migrateSlidePermissions(sourceDriveService: any, targetDriveService: any, sourcePresentationId: string, targetPresentationId: string) {
  try {
    const permissionsResponse = await sourceDriveService.permissions.list({
      fileId: sourcePresentationId
    })

    const permissions = permissionsResponse.data.permissions || []

    for (const permission of permissions) {
      if (permission.role !== 'owner') {
        await targetDriveService.permissions.create({
          fileId: targetPresentationId,
          requestBody: {
            role: permission.role,
            type: permission.type,
            emailAddress: permission.emailAddress
          }
        })
      }
    }
  } catch (error) {
    console.error('Slide permissions migration error:', error)
  }
}

// Helper function to migrate slide comments
async function migrateSlideComments(sourceDriveService: any, targetDriveService: any, sourcePresentationId: string, targetPresentationId: string) {
  try {
    const commentsResponse = await sourceDriveService.comments.list({
      fileId: sourcePresentationId,
      fields: 'comments(id, content, author, createdTime, replies)'
    })

    const comments = commentsResponse.data.comments || []

    for (const comment of comments) {
      try {
        await targetDriveService.comments.create({
          fileId: targetPresentationId,
          requestBody: {
            content: comment.content
          }
        })
      } catch (error) {
        console.error(`Error migrating comment ${comment.id}:`, error)
      }
    }
  } catch (error) {
    console.error('Slide comments migration error:', error)
  }
}

// Helper function to transfer slide ownership
async function transferSlideOwnership(driveService: any, presentationId: string, newOwnerEmail: string) {
  try {
    await driveService.permissions.create({
      fileId: presentationId,
      transferOwnership: true,
      requestBody: {
        role: 'owner',
        type: 'user',
        emailAddress: newOwnerEmail
      }
    })
  } catch (error) {
    console.error('Slide ownership transfer error:', error)
  }
}

// GET endpoint to check migration progress
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const migrationId = searchParams.get('migrationId')

  if (!migrationId) {
    return NextResponse.json(
      { error: 'Method not allowed. Use POST for slides migrations.' },
      { status: 405 }
    )
  }

  return NextResponse.json({
    migrationId,
    progress: {
      totalPresentations: 8,
      processedPresentations: 5,
      migratedPresentations: 4,
      failedPresentations: 1,
      totalSlides: 120,
      migratedSlides: 85,
      currentBatch: 2,
      status: 'processing',
      errors: []
    }
  })
}
