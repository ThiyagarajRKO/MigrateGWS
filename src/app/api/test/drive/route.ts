import { NextRequest, NextResponse } from 'next/server'
import { createDriveServiceForUser, createServiceAccountService } from '@/lib/google-workspace'
import { google } from 'googleapis'

export async function POST(request: NextRequest) {
  try {
    const { adminEmail, testUserEmail } = await request.json()
    
    if (!adminEmail) {
      return NextResponse.json(
        { error: 'Admin email is required' },
        { status: 400 }
      )
    }

    console.log(`[Drive API Test] Testing Drive service for admin: ${adminEmail}`)

    // Test 1: Create Drive service for user
    console.log('[Drive API Test] Creating Drive service...')
    const driveService = createDriveServiceForUser(adminEmail, testUserEmail)
    
    console.log('[Drive API Test] Drive service created successfully:', {
      userEmail: driveService.userEmail,
      hasService: !!driveService.service,
      hasDriveClient: !!driveService.drive
    })

    // Test 2: Test service account connection
    console.log('[Drive API Test] Testing service account connection...')
    const connectionTest = await driveService.service.testConnection()
    console.log('[Drive API Test] Connection test result:', connectionTest)

    // Test 3: List Drive files (basic test)
    console.log('[Drive API Test] Testing Drive files list...')
    try {
      const filesResponse = await driveService.drive.files.list({
        pageSize: 5,
        fields: 'nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, owners)',
        q: testUserEmail ? `'${testUserEmail}' in owners` : undefined,
      })

      const files = filesResponse.data.files || []
      console.log(`[Drive API Test] Successfully retrieved ${files.length} files`)

      // Test 4: Get Drive quotas/about info
      console.log('[Drive API Test] Testing Drive about/quota info...')
      const aboutResponse = await driveService.drive.about.get({
        fields: 'storageQuota, user'
      })

      const storageQuota = aboutResponse.data.storageQuota
      const user = aboutResponse.data.user

      console.log('[Drive API Test] Drive quota info retrieved:', {
        hasStorageQuota: !!storageQuota,
        hasUserInfo: !!user
      })

      // Test 5: Test service-specific method from GoogleWorkspaceService
      console.log('[Drive API Test] Testing GoogleWorkspaceService Drive method...')
      const serviceFiles = await driveService.service.getDriveFiles(testUserEmail, 5)
      console.log(`[Drive API Test] Service method retrieved ${serviceFiles.length} files`)

      return NextResponse.json({
        success: true,
        message: 'Drive API test completed successfully',
        results: {
          connectionTest: connectionTest,
          filesCount: files.length,
          sampleFiles: files.slice(0, 3).map(file => ({
            id: file.id,
            name: file.name,
            mimeType: file.mimeType,
            size: file.size
          })),
          storageQuota: storageQuota ? {
            limit: storageQuota.limit,
            usage: storageQuota.usage,
            usageInDrive: storageQuota.usageInDrive
          } : null,
          userInfo: user ? {
            displayName: user.displayName,
            emailAddress: user.emailAddress
          } : null,
          serviceFilesCount: serviceFiles.length
        },
        testDetails: {
          adminEmail,
          testUserEmail: testUserEmail || adminEmail,
          serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL,
          timestamp: new Date().toISOString()
        }
      })

    } catch (driveError: any) {
      console.error('[Drive API Test] Drive API error:', driveError)
      
      let errorMessage = 'Drive API access failed'
      let details = driveError.message

      if (driveError.code === 403) {
        errorMessage = 'Drive API access denied'
        details = 'Service account may not have Drive API permissions or domain-wide delegation for Drive is not configured'
      } else if (driveError.code === 401) {
        errorMessage = 'Drive API authentication failed'
        details = 'Service account authentication issue with Drive API'
      }

      return NextResponse.json({
        success: false,
        error: errorMessage,
        details: details,
        driveApiError: {
          code: driveError.code,
          message: driveError.message,
          status: driveError.status
        },
        testDetails: {
          adminEmail,
          testUserEmail: testUserEmail || adminEmail,
          timestamp: new Date().toISOString()
        }
      }, { status: 500 })
    }

  } catch (error: any) {
    console.error('[Drive API Test] Test failed:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Drive API test failed',
      details: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Drive API Test Endpoint',
    usage: 'Send POST request with { "adminEmail": "admin@domain.com", "testUserEmail": "user@domain.com" }',
    availableScopes: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/drive.metadata'
    ]
  })
}
