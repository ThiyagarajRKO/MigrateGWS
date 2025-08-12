import { NextRequest, NextResponse } from 'next/server'
import { testServiceAccountDelegation, getServiceAccountClientId } from '@/lib/google-workspace'

export async function POST(request: NextRequest) {
  try {
    const { adminEmail, domain } = await request.json()
    
    if (!adminEmail || !domain) {
      return NextResponse.json(
        { error: 'Admin email and domain are required' },
        { status: 400 }
      )
    }

    console.log(`[Domain Delegation Test] Testing for admin: ${adminEmail}, domain: ${domain}`)

    // Get service account client ID for instructions
    const clientId = getServiceAccountClientId()
    
    // Test delegation
    const testResult = await testServiceAccountDelegation(adminEmail, domain)
    
    if (testResult.success) {
      return NextResponse.json({
        success: true,
        message: 'Domain-wide delegation is working correctly',
        adminEmail,
        domain,
        serviceAccountClientId: clientId,
        timestamp: new Date().toISOString()
      })
    } else {
      return NextResponse.json({
        success: false,
        error: testResult.error,
        details: testResult.details,
        diagnostics: testResult.diagnostics,
        instructions: {
          title: 'Domain-Wide Delegation Setup Required',
          steps: [
            `1. Go to Google Admin Console for '${domain}': https://admin.google.com`,
            `2. Navigate to Security > Access and data control > API controls`,
            `3. Click "Manage Domain Wide Delegation"`,
            `4. Click "Add new" and enter:`,
            `   - Client ID: ${clientId}`,
            `   - OAuth Scopes: ${getAllRequiredScopes().join(', ')}`,
            `5. Click "Authorize"`,
            `6. Wait a few minutes for changes to propagate`,
            `7. Retry this test`
          ],
          notes: [
            `Service Account Client ID: ${clientId}`,
            `Target Domain: ${domain}`,
            `Admin Email: ${adminEmail}`,
            `This setup must be done by a super administrator of '${domain}'`
          ]
        },
        timestamp: new Date().toISOString()
      }, { status: 403 })
    }

  } catch (error: any) {
    console.error('[Domain Delegation Test] Test failed:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Domain delegation test failed',
      details: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export async function GET() {
  const clientId = getServiceAccountClientId()
  
  return NextResponse.json({
    message: 'Domain-Wide Delegation Test Endpoint',
    usage: 'Send POST request with { "adminEmail": "admin@domain.com", "domain": "domain.com" }',
    serviceAccountClientId: clientId,
    requiredScopes: getAllRequiredScopes(),
    instructions: {
      title: 'How to Configure Domain-Wide Delegation',
      steps: [
        'Go to Google Admin Console: https://admin.google.com',
        'Navigate to Security > Access and data control > API controls',
        'Click "Manage Domain Wide Delegation"',
        'Click "Add new"',
        `Enter Client ID: ${clientId}`,
        'Enter OAuth scopes (see requiredScopes above)',
        'Click "Authorize"',
        'Wait for changes to propagate (may take a few minutes)'
      ]
    }
  })
}

function getAllRequiredScopes(): string[] {
  return [
    // Admin Directory API - For user and domain management
    'https://www.googleapis.com/auth/admin.directory.user',
    'https://www.googleapis.com/auth/admin.directory.domain',
    'https://www.googleapis.com/auth/admin.directory.group',
    'https://www.googleapis.com/auth/admin.directory.resource.calendar',
    'https://www.googleapis.com/auth/admin.directory.orgunit',
    
    // Gmail API - For email migration
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.labels',
    'https://www.googleapis.com/auth/gmail.insert',
    
    // Drive API - For file migration
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/drive.metadata',
    
    // Calendar API - For calendar migration
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/calendar.readonly',
    
    // Contacts API - For contacts migration
    'https://www.googleapis.com/auth/contacts',
    'https://www.googleapis.com/auth/contacts.readonly',
    
    // Photos API - For photos migration
    'https://www.googleapis.com/auth/photoslibrary',
    'https://www.googleapis.com/auth/photoslibrary.readonly',
    
    // Chat API - For chat migration
    'https://www.googleapis.com/auth/chat.spaces',
    'https://www.googleapis.com/auth/chat.messages',
    'https://www.googleapis.com/auth/chat.spaces.readonly',
    'https://www.googleapis.com/auth/chat.messages.readonly',
    
    // Forms API - For forms migration
    'https://www.googleapis.com/auth/forms.body',
    'https://www.googleapis.com/auth/forms.responses.readonly',
    'https://www.googleapis.com/auth/forms.body.readonly',
    
    // Slides API - For slides migration
    'https://www.googleapis.com/auth/presentations',
    'https://www.googleapis.com/auth/presentations.readonly',
    
    // Sheets API - For sheets migration
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/spreadsheets.readonly'
  ]
}
