import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'

// Load the actual service account from the JSON file
const loadServiceAccount = () => {
  try {
    const serviceAccountPath = path.join(process.cwd(), 'source-service-account-key.json')
    const serviceAccountData = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))
    return serviceAccountData
  } catch (error) {
    console.error('Failed to load service account:', error)
    // Fallback to mock data if file is not found
    return {
      client_id: '114333598950671892438',
      client_email: 'gws-permission@gws-migration-463208.iam.gserviceaccount.com',
      project_id: 'gws-migration-463208',
      type: 'service_account'
    }
  }
}

// Generate service account configuration for domain-wide delegation
const generateServiceAccount = (domain: string) => {
  const serviceAccount = loadServiceAccount()
  
  return {
    clientId: serviceAccount.client_id,
    email: serviceAccount.client_email,
    projectId: serviceAccount.project_id,
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
    const { sourceAdminEmail, destAdminEmail, adminEmail, migrationScenario } = body

    // Handle Single Super Admin scenario
    if (migrationScenario === 'single-super-admin' || (!sourceAdminEmail && !destAdminEmail && adminEmail)) {
      if (!adminEmail) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'adminEmail is required for single super admin scenario' 
          },
          { status: 400 }
        )
      }

      const domain = adminEmail.split('@')[1]
      if (!domain) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Invalid email address provided' 
          },
          { status: 400 }
        )
      }

      const serviceAccount = generateServiceAccount(domain)

      // Prepare response for single domain scenario
      const response = {
        success: true,
        migrationScenario: 'single-super-admin',
        domain: {
          clientId: serviceAccount.clientId,
          email: serviceAccount.email,
          projectId: serviceAccount.projectId,
          domain: domain,
          adminEmail: adminEmail
        },
        scopes: REQUIRED_SCOPES,
        setupInstructions: {
          domain: {
            title: `Domain Setup (${domain})`,
            clientId: serviceAccount.clientId,
            scopes: REQUIRED_SCOPES,
            adminConsoleUrl: 'https://admin.google.com/ac/owl/domainwidedelegation',
            domain: domain,
            adminEmail: adminEmail,
            steps: [
              '1. Open the Google Admin Console for your domain',
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
    }

    // Handle Cross-Tenant scenario (existing logic)
    if (!sourceAdminEmail || !destAdminEmail) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Both sourceAdminEmail and destAdminEmail are required for cross-tenant migration' 
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

    // Prepare response for cross-tenant scenario
    const response = {
      success: true,
      migrationScenario: 'cross-tenant',
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
    migrationScenarios: {
      'single-super-admin': {
        description: 'Single domain with super admin access',
        requiredFields: ['adminEmail'],
        optionalFields: ['migrationScenario'],
        example: {
          adminEmail: 'superadmin@company.com',
          migrationScenario: 'single-super-admin'
        }
      },
      'cross-tenant': {
        description: 'Cross-tenant migration between two different domains',
        requiredFields: ['sourceAdminEmail', 'destAdminEmail'],
        optionalFields: ['migrationScenario'],
        example: {
          sourceAdminEmail: 'admin@source.com',
          destAdminEmail: 'admin@destination.com',
          migrationScenario: 'cross-tenant'
        }
      }
    }
  })
}
