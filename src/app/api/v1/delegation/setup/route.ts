import { NextRequest, NextResponse } from 'next/server'

// Mock service account generation - in production, this would integrate with Google Cloud APIs
const generateServiceAccount = (domain: string) => {
  // This would typically create a real service account via Google Cloud APIs
  const projectId = 'gws-migration-' + domain.replace(/\./g, '-')
  const serviceAccountName = 'gws-migration-service'
  const clientId = `${Date.now()}${Math.floor(Math.random() * 1000)}`
  
  return {
    clientId: clientId,
    email: `${serviceAccountName}@${projectId}.iam.gserviceaccount.com`,
    projectId: projectId,
    domain: domain
  }
}

// Required OAuth scopes for Google Workspace migration
const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/admin.directory.user',
  'https://www.googleapis.com/auth/admin.directory.domain',
  'https://www.googleapis.com/auth/admin.directory.group',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/contacts.readonly'
]

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sourceAdminEmail, destAdminEmail } = body

    if (!sourceAdminEmail || !destAdminEmail) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Both sourceAdminEmail and destAdminEmail are required' 
        },
        { status: 400 }
      )
    }

    // Extract domains from email addresses
    const sourceDomain = sourceAdminEmail.split('@')[1]
    const destDomain = destAdminEmail.split('@')[1]

    if (!sourceDomain || !destDomain) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid email addresses provided' 
        },
        { status: 400 }
      )
    }

    // Generate service accounts for both domains
    const sourceServiceAccount = generateServiceAccount(sourceDomain)
    const destServiceAccount = generateServiceAccount(destDomain)

    // Prepare response
    const response = {
      success: true,
      source: {
        clientId: sourceServiceAccount.clientId,
        email: sourceServiceAccount.email,
        projectId: sourceServiceAccount.projectId,
        domain: sourceDomain,
        adminEmail: sourceAdminEmail
      },
      destination: {
        clientId: destServiceAccount.clientId,
        email: destServiceAccount.email,
        projectId: destServiceAccount.projectId,
        domain: destDomain,
        adminEmail: destAdminEmail
      },
      scopes: REQUIRED_SCOPES,
      setupInstructions: {
        source: {
          title: `Source Domain Setup (${sourceDomain})`,
          clientId: sourceServiceAccount.clientId,
          scopes: REQUIRED_SCOPES,
          adminConsoleUrl: 'https://admin.google.com/ac/owl/domainwidedelegation',
          domain: sourceDomain,
          adminEmail: sourceAdminEmail,
          steps: [
            '1. Open the Google Admin Console for your source domain',
            '2. Navigate to Security → API Controls → Domain-wide Delegation',
            '3. Click "Add new" to add a new client',
            '4. Paste the Client ID provided above',
            '5. Paste the OAuth scopes provided above',
            '6. Click "Authorize" to complete the setup'
          ]
        },
        destination: {
          title: `Destination Domain Setup (${destDomain})`,
          clientId: destServiceAccount.clientId,
          scopes: REQUIRED_SCOPES,
          adminConsoleUrl: 'https://admin.google.com/ac/owl/domainwidedelegation',
          domain: destDomain,
          adminEmail: destAdminEmail,
          steps: [
            '1. Open the Google Admin Console for your destination domain',
            '2. Navigate to Security → API Controls → Domain-wide Delegation',
            '3. Click "Add new" to add a new client',
            '4. Paste the Client ID provided above',
            '5. Paste the OAuth scopes provided above',
            '6. Click "Authorize" to complete the setup'
          ]
        }
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Delegation setup error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error during delegation setup',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Domain-wide Delegation Setup API',
    endpoints: {
      setup: 'POST /api/v1/delegation/setup',
      verify: 'POST /api/v1/delegation/verify'
    },
    requiredFields: {
      setup: ['sourceAdminEmail', 'destAdminEmail'],
      verify: ['sourceAdminEmail', 'destAdminEmail', 'sourceEmail', 'destEmail']
    }
  })
}
