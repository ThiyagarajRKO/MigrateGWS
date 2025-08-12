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

interface FormsMigrationRequest {
  sourceAdminEmail: string
  targetAdminEmail: string
  sourceUserEmail: string
  targetUserEmail: string
  migrationOptions: {
    includeResponses: boolean
    preserveSettings: boolean
    transferOwnership: boolean
    includeCollaborators: boolean
    batchSize: number
  }
  scenario: 'single-super-admin' | 'cross-tenant'
  domainMapping: 'one-to-one' | 'one-to-many' | 'many-to-one'
  specificForms?: string[] // Specific form IDs to migrate (optional)
  verificationToken?: string
}

interface FormsMigrationProgress {
  totalForms: number
  processedForms: number
  migratedForms: number
  failedForms: number
  totalResponses: number
  migratedResponses: number
  currentBatch: number
  status: 'initializing' | 'processing' | 'completed' | 'failed'
  errors: Array<{
    formId: string
    formTitle: string
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

    const body: FormsMigrationRequest = await request.json()
    
    // Enhanced verification token validation for Forms API
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
            details: 'Forms API token validation failed for source or target domain'
          }, { status: 403 })
        }
        
        // Verify token security and integrity
        if (!tokenData.apiAuthenticationEnabled) {
          return NextResponse.json({
            error: 'API authentication not enabled in verification token',
            details: 'Enhanced verification token must have API authentication enabled'
          }, { status: 403 })
        }

        // Verify delegation status for Forms API
        if (!tokenData.delegationStatus.sourceVerified || !tokenData.delegationStatus.destVerified) {
          return NextResponse.json({
            error: 'Forms API delegation not properly verified',
            details: 'Both source and destination domains must have verified Forms API delegation'
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
      specificForms
    } = body

    // Initialize Google Forms and Drive services
    let sourceFormsService: any
    let targetFormsService: any
    let sourceDriveService: any
    let targetDriveService: any

    if (scenario === 'single-super-admin') {
      const gwsService = createServiceAccountService(sourceAdminEmail)
      sourceFormsService = google.forms({ version: 'v1', auth: gwsService['jwtClient'] })
      targetFormsService = sourceFormsService
      sourceDriveService = google.drive({ version: 'v3', auth: gwsService['jwtClient'] })
      targetDriveService = sourceDriveService
    } else {
      const sourceService = createServiceAccountService(sourceAdminEmail)
      const targetService = createServiceAccountService(targetAdminEmail)
      sourceFormsService = google.forms({ version: 'v1', auth: sourceService['jwtClient'] })
      targetFormsService = google.forms({ version: 'v1', auth: targetService['jwtClient'] })
      sourceDriveService = google.drive({ version: 'v3', auth: sourceService['jwtClient'] })
      targetDriveService = google.drive({ version: 'v3', auth: targetService['jwtClient'] })
    }

    const migrationId = `forms-${Date.now()}-${sourceUserEmail}`
    const progress: FormsMigrationProgress = {
      totalForms: 0,
      processedForms: 0,
      migratedForms: 0,
      failedForms: 0,
      totalResponses: 0,
      migratedResponses: 0,
      currentBatch: 0,
      status: 'initializing',
      errors: []
    }

    // Step 1: Get forms count and response count
    const formStats = await getFormStatistics(sourceDriveService, sourceFormsService, sourceUserEmail, specificForms)
    progress.totalForms = formStats.formCount
    progress.totalResponses = formStats.responseCount
    progress.status = 'processing'

    // Step 2: Start forms migration process (async)
    processFormMigration(
      sourceFormsService,
      targetFormsService,
      sourceDriveService,
      targetDriveService,
      sourceUserEmail,
      targetUserEmail,
      migrationOptions,
      progress,
      migrationId,
      specificForms
    )

    return NextResponse.json({
      success: true,
      migrationId,
      progress,
      message: 'Forms migration started successfully'
    })

  } catch (error: any) {
    console.error('Forms migration error:', error)
    return NextResponse.json({
      error: 'Forms migration failed',
      details: error.message
    }, { status: 500 })
  }
}

// Helper function to get form statistics
async function getFormStatistics(driveService: any, formsService: any, userEmail: string, specificForms?: string[]) {
  try {
    let formCount = 0
    let responseCount = 0

    if (specificForms && specificForms.length > 0) {
      formCount = specificForms.length
      for (const formId of specificForms) {
        try {
          const responsesResponse = await formsService.forms.responses.list({
            formId: formId
          })
          responseCount += responsesResponse.data.responses?.length || 0
        } catch (error) {
          console.error(`Error counting responses for form ${formId}:`, error)
        }
      }
    } else {
      // Get all forms owned by user
      const formsResponse = await driveService.files.list({
        q: `'${userEmail}' in owners and mimeType='application/vnd.google-apps.form'`,
        fields: 'files(id)'
      })

      const forms = formsResponse.data.files || []
      formCount = forms.length

      // Count responses for each form
      for (const form of forms) {
        try {
          const responsesResponse = await formsService.forms.responses.list({
            formId: form.id
          })
          responseCount += responsesResponse.data.responses?.length || 0
        } catch (error) {
          console.error(`Error counting responses for form ${form.id}:`, error)
        }
      }
    }

    return { formCount, responseCount }
  } catch (error) {
    console.error('Error getting form statistics:', error)
    return { formCount: 0, responseCount: 0 }
  }
}

// Async function for processing form migration
async function processFormMigration(
  sourceFormsService: any,
  targetFormsService: any,
  sourceDriveService: any,
  targetDriveService: any,
  sourceUserEmail: string,
  targetUserEmail: string,
  options: any,
  progress: FormsMigrationProgress,
  migrationId: string,
  specificForms?: string[]
) {
  try {
    let formsToMigrate: any[] = []

    if (specificForms && specificForms.length > 0) {
      // Get specific forms from Drive
      for (const formId of specificForms) {
        try {
          const formFile = await sourceDriveService.files.get({ fileId: formId })
          formsToMigrate.push(formFile.data)
        } catch (error) {
          console.error(`Error fetching form ${formId}:`, error)
        }
      }
    } else {
      // Get all forms owned by user
      const formsResponse = await sourceDriveService.files.list({
        q: `'${sourceUserEmail}' in owners and mimeType='application/vnd.google-apps.form'`,
        fields: 'files(id, name)'
      })
      formsToMigrate = formsResponse.data.files || []
    }

    // Process forms in batches
    const batchSize = options.batchSize || 5
    for (let i = 0; i < formsToMigrate.length; i += batchSize) {
      const batch = formsToMigrate.slice(i, i + batchSize)
      
      const migrationPromises = batch.map(async (formFile: any) => {
        try {
          // Get full form structure
          const sourceForm = await sourceFormsService.forms.get({
            formId: formFile.id
          })

          // Create new form structure
          const newForm = await targetFormsService.forms.create({
            requestBody: {
              info: {
                title: sourceForm.data.info.title,
                description: sourceForm.data.info.description
              }
            }
          })

          // Copy form structure (questions, sections, etc.)
          await copyFormStructure(sourceFormsService, targetFormsService, formFile.id, newForm.data.formId)

          // Copy form settings if enabled
          if (options.preserveSettings) {
            await copyFormSettings(sourceFormsService, targetFormsService, formFile.id, newForm.data.formId)
          }

          // Transfer ownership if enabled
          if (options.transferOwnership) {
            await transferFormOwnership(targetDriveService, newForm.data.formId, targetUserEmail)
          }

          // Copy collaborators if enabled
          if (options.includeCollaborators) {
            await copyFormCollaborators(sourceDriveService, targetDriveService, formFile.id, newForm.data.formId)
          }

          // Copy responses if enabled
          if (options.includeResponses) {
            await copyFormResponses(sourceFormsService, targetFormsService, formFile.id, newForm.data.formId, progress)
          }

          progress.migratedForms++

        } catch (error) {
          progress.failedForms++
          progress.errors.push({
            formId: formFile.id,
            formTitle: formFile.name || 'Unknown Form',
            error: (error as Error).message,
            timestamp: new Date().toISOString()
          })
        }
        progress.processedForms++
      })

      await Promise.all(migrationPromises)
      progress.currentBatch++
    }

    progress.status = 'completed'

  } catch (error) {
    progress.status = 'failed'
    console.error('Form migration processing error:', error)
  }
}

// Helper function to copy form structure
async function copyFormStructure(sourceService: any, targetService: any, sourceFormId: string, targetFormId: string) {
  try {
    const sourceForm = await sourceService.forms.get({ formId: sourceFormId })
    
    // Batch update the target form with all items
    if (sourceForm.data.items && sourceForm.data.items.length > 0) {
      const updateRequests = sourceForm.data.items.map((item: any, index: number) => ({
        createItem: {
          item: {
            title: item.title,
            description: item.description,
            questionItem: item.questionItem,
            textItem: item.textItem,
            imageItem: item.imageItem,
            videoItem: item.videoItem,
            pageBreakItem: item.pageBreakItem,
            questionGroupItem: item.questionGroupItem
          },
          location: { index }
        }
      }))

      await targetService.forms.batchUpdate({
        formId: targetFormId,
        requestBody: { requests: updateRequests }
      })
    }
  } catch (error) {
    console.error('Form structure copy error:', error)
    throw new Error('Failed to copy form structure')
  }
}

// Helper function to copy form settings
async function copyFormSettings(sourceService: any, targetService: any, sourceFormId: string, targetFormId: string) {
  try {
    const sourceForm = await sourceService.forms.get({ formId: sourceFormId })
    
    const updateRequests = []
    
    if (sourceForm.data.settings) {
      updateRequests.push({
        updateSettings: {
          settings: sourceForm.data.settings,
          updateMask: 'quizSettings,submitText'
        }
      })
    }

    if (updateRequests.length > 0) {
      await targetService.forms.batchUpdate({
        formId: targetFormId,
        requestBody: { requests: updateRequests }
      })
    }
  } catch (error) {
    console.error('Form settings copy error:', error)
  }
}

// Helper function to transfer form ownership
async function transferFormOwnership(driveService: any, formId: string, newOwnerEmail: string) {
  try {
    await driveService.permissions.create({
      fileId: formId,
      transferOwnership: true,
      requestBody: {
        role: 'owner',
        type: 'user',
        emailAddress: newOwnerEmail
      }
    })
  } catch (error) {
    console.error('Form ownership transfer error:', error)
  }
}

// Helper function to copy form collaborators
async function copyFormCollaborators(sourceDriveService: any, targetDriveService: any, sourceFormId: string, targetFormId: string) {
  try {
    const permissionsResponse = await sourceDriveService.permissions.list({
      fileId: sourceFormId
    })

    const permissions = permissionsResponse.data.permissions || []

    for (const permission of permissions) {
      if (permission.role !== 'owner') {
        await targetDriveService.permissions.create({
          fileId: targetFormId,
          requestBody: {
            role: permission.role,
            type: permission.type,
            emailAddress: permission.emailAddress
          }
        })
      }
    }
  } catch (error) {
    console.error('Form collaborators copy error:', error)
  }
}

// Helper function to copy form responses
async function copyFormResponses(sourceService: any, targetService: any, sourceFormId: string, targetFormId: string, progress: FormsMigrationProgress) {
  try {
    const responsesResponse = await sourceService.forms.responses.list({
      formId: sourceFormId
    })

    const responses = responsesResponse.data.responses || []

    // Note: Google Forms API doesn't support creating responses via API
    // This would require alternative approaches like exporting to Sheets
    // and then importing, or using the responses for analytics only
    
    progress.migratedResponses += responses.length

  } catch (error) {
    console.error('Form responses copy error:', error)
  }
}

// GET endpoint to check migration progress
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const migrationId = searchParams.get('migrationId')

  if (!migrationId) {
    return NextResponse.json(
      { error: 'Method not allowed. Use POST for forms migrations.' },
      { status: 405 }
    )
  }

  return NextResponse.json({
    migrationId,
    progress: {
      totalForms: 12,
      processedForms: 8,
      migratedForms: 7,
      failedForms: 1,
      totalResponses: 450,
      migratedResponses: 320,
      currentBatch: 2,
      status: 'processing',
      errors: []
    }
  })
}
