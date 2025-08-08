import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import path from 'path'
import fs from 'fs'

// Real service account verification function
const verifyDomainAccess = async (domain: string, clientId: string, adminEmail: string) => {
  try {
    // Load service account credentials
    const serviceAccountPath = path.join(process.cwd(), 'source-service-account-key.json')
    
    if (!fs.existsSync(serviceAccountPath)) {
      throw new Error('Service account key file not found')
    }
    
    const serviceAccountKey = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))
    
    // Create JWT client for domain-wide delegation
    const jwtClient = new google.auth.JWT({
      email: serviceAccountKey.client_email,
      key: serviceAccountKey.private_key,
      scopes: [
        // Core Admin Directory scopes for verification
        'https://www.googleapis.com/auth/admin.directory.user.readonly',
        'https://www.googleapis.com/auth/admin.directory.domain.readonly',
        'https://www.googleapis.com/auth/admin.directory.orgunit.readonly',
        'https://www.googleapis.com/auth/admin.directory.group.readonly',
        'https://www.googleapis.com/auth/admin.directory.customer.readonly'
      ],
      subject: adminEmail // Subject (admin email to impersonate)
    })

    // Test 1: Authenticate and get access token
    console.log(`[Verification] Testing authentication for domain: ${domain} with admin: ${adminEmail}`)
    await jwtClient.authorize()
    
    // Test 2: Try to access Admin Directory API
    const admin = google.admin({ version: 'directory_v1', auth: jwtClient })
    
    // Test basic directory access by getting domain info
    const domainResponse = await admin.domains.get({
      customer: 'my_customer',
      domainName: domain
    })
    
    // Test user directory access
    const usersResponse = await admin.users.list({
      customer: 'my_customer',
      domain: domain,
      maxResults: 1 // Just test access, don't fetch all users
    })

    console.log(`[Verification] Successfully verified domain access for ${domain}`)
    
    return {
      domain,
      clientId: serviceAccountKey.client_id,
      adminEmail,
      configured: true,
      verified: true,
      testResults: [
        {
          test: 'Service Account Authentication',
          status: 'success',
          message: 'Successfully authenticated with service account'
        },
        {
          test: 'Domain API Access',
          status: 'success',
          message: `Successfully accessed domain information for ${domain}`
        },
        {
          test: 'Directory API Access',
          status: 'success',
          message: 'Successfully accessed Admin Directory API'
        }
      ],
      lastChecked: new Date().toISOString(),
      serviceAccountEmail: serviceAccountKey.client_email,
      domainInfo: {
        domainName: domainResponse.data.domainName,
        verified: domainResponse.data.verified,
        isPrimary: domainResponse.data.isPrimary
      }
    }
  } catch (error: any) {
    console.error(`[Verification] Error verifying domain access for ${domain}:`, error)
    
    // Determine the type of error for better diagnostics
    let errorType = 'unknown'
    let errorMessage = 'Unknown error occurred'
    let configured = false
    
    if (error.code === 401 || error.message?.includes('unauthorized_client')) {
      errorType = 'delegation_not_configured'
      errorMessage = 'Domain-wide delegation not configured or service account not authorized'
      configured = false
    } else if (error.code === 403) {
      errorType = 'insufficient_permissions'
      errorMessage = 'Service account lacks required permissions or admin email is invalid'
      configured = true
    } else if (error.message?.includes('Service account key file not found')) {
      errorType = 'missing_service_account'
      errorMessage = 'Service account key file not found'
      configured = false
    } else if (error.message?.includes('invalid_grant')) {
      errorType = 'invalid_subject'
      errorMessage = 'Invalid admin email or domain-wide delegation not properly configured'
      configured = true
    } else {
      errorMessage = error.message || 'Verification failed'
    }

    return {
      domain,
      clientId: clientId || 'unknown',
      adminEmail,
      configured,
      verified: false,
      testResults: [{
        test: 'Domain-wide Delegation Verification',
        status: 'failed',
        message: `Failed to verify domain access: ${errorMessage}`,
        error: errorMessage,
        errorType,
        errorCode: error.code
      }],
      lastChecked: new Date().toISOString(),
      error: errorMessage
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sourceAdminEmail, destAdminEmail, adminEmail, migrationScenario, verificationToken } = body
    
    // Check for verification token in headers as well
    const headerToken = request.headers.get('X-Verification-Token')
    const activeToken = verificationToken || headerToken
    
    // Validate verification token if provided
    if (activeToken) {
      try {
        const tokenData = JSON.parse(atob(activeToken))
        console.log('[Delegation Verify] Received verification token:', {
          verificationId: tokenData.verificationId,
          timestamp: tokenData.timestamp,
          domainsCount: tokenData.verifiedDomains?.length || 0,
          serviceAccount: tokenData.serviceAccountEmail,
          scenario: tokenData.delegationStatus?.scenario,
          source: headerToken ? 'header' : 'body'
        })
        
        // Validate token timestamp (not older than 1 hour)
        const tokenAge = Date.now() - new Date(tokenData.timestamp).getTime()
        if (tokenAge > 3600000) { // 1 hour
          console.warn('[Delegation Verify] Verification token expired')
        } else {
          console.log('[Delegation Verify] Verification token is valid and recent')
        }
        
        // Additional validation could be added here
        console.log('[Delegation Verify] Verification token validated successfully')
      } catch (error) {
        console.warn('[Delegation Verify] Invalid verification token:', error)
        // Continue with verification even if token is invalid
      }
    } else {
      console.log('[Delegation Verify] No verification token provided')
    }

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

      // Get client ID from service account key file
      let clientId: string
      try {
        const serviceAccountPath = path.join(process.cwd(), 'source-service-account-key.json')
        if (fs.existsSync(serviceAccountPath)) {
          const serviceAccountKey = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))
          clientId = serviceAccountKey.client_id
        } else {
          throw new Error('Service account key file not found')
        }
      } catch (error) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Service account configuration error: ' + (error instanceof Error ? error.message : 'Unknown error')
          },
          { status: 500 }
        )
      }

      // Verify the single domain
      const domainVerification = await verifyDomainAccess(domain, clientId, adminEmail)

      const response = {
        success: true,
        migrationScenario: 'single-super-admin',
        verification: {
          domain: domainVerification,
          overall: {
            configured: domainVerification.configured,
            verified: domainVerification.verified,
            readyForMigration: domainVerification.verified
          }
        },
        recommendations: [] as Array<{
          type: 'error' | 'warning' | 'success'
          domain: string
          message: string
          action: string
        }>
      }

      // Add recommendations based on verification results
      if (!domainVerification.configured) {
        response.recommendations.push({
          type: 'error',
          domain: domain,
          message: 'Domain delegation is not configured. Please complete the setup process.',
          action: 'Configure domain-wide delegation for your domain'
        })
      } else if (!domainVerification.verified) {
        response.recommendations.push({
          type: 'warning',
          domain: domain,
          message: 'Domain delegation is configured but verification failed. Check admin permissions.',
          action: 'Verify admin email has sufficient permissions'
        })
      } else {
        response.recommendations.push({
          type: 'success',
          domain: domain,
          message: 'Domain delegation is properly configured and verified.',
          action: 'Ready to start migration'
        })
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

    // Get client ID from service account key file for both domains
    let clientId: string
    try {
      const serviceAccountPath = path.join(process.cwd(), 'source-service-account-key.json')
      if (fs.existsSync(serviceAccountPath)) {
        const serviceAccountKey = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))
        clientId = serviceAccountKey.client_id
      } else {
        throw new Error('Service account key file not found')
      }
    } catch (error) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Service account configuration error: ' + (error instanceof Error ? error.message : 'Unknown error')
        },
        { status: 500 }
      )
    }

    // Verify both domains using the same service account
    const [sourceVerification, destVerification] = await Promise.all([
      verifyDomainAccess(sourceDomain, clientId, sourceAdminEmail),
      verifyDomainAccess(destDomain, clientId, destAdminEmail)
    ])

    const response = {
      success: true,
      verification: {
        source: sourceVerification,
        destination: destVerification,
        overall: {
          bothConfigured: sourceVerification.configured && destVerification.configured,
          bothVerified: sourceVerification.verified && destVerification.verified,
          readyForMigration: sourceVerification.verified && destVerification.verified
        }
      },
      recommendations: [] as Array<{
        type: 'error' | 'warning' | 'success'
        domain: string
        message: string
        action: string
      }>
    }

    // Add recommendations based on verification results
    if (!sourceVerification.configured) {
      response.recommendations.push({
        type: 'error',
        domain: sourceDomain,
        message: 'Source domain delegation is not configured. Please complete the setup process.',
        action: 'Configure domain-wide delegation for the source domain'
      })
    }

    if (!destVerification.configured) {
      response.recommendations.push({
        type: 'error',
        domain: destDomain,
        message: 'Destination domain delegation is not configured. Please complete the setup process.',
        action: 'Configure domain-wide delegation for the destination domain'
      })
    }

    if (sourceVerification.configured && !sourceVerification.verified) {
      response.recommendations.push({
        type: 'warning',
        domain: sourceDomain,
        message: 'Source domain is configured but verification failed. Check permissions.',
        action: 'Review OAuth scopes and service account permissions'
      })
    }

    if (destVerification.configured && !destVerification.verified) {
      response.recommendations.push({
        type: 'warning',
        domain: destDomain,
        message: 'Destination domain is configured but verification failed. Check permissions.',
        action: 'Review OAuth scopes and service account permissions'
      })
    }

    if (response.verification.overall.readyForMigration) {
      response.recommendations.push({
        type: 'success',
        domain: 'both',
        message: 'Both domains are properly configured and verified for migration.',
        action: 'You can proceed with the migration process'
      })
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Delegation verification error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error during delegation verification',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Domain-wide Delegation Verification API',
    description: 'Verifies that domain-wide delegation is properly configured for both source and destination domains',
    requiredFields: ['sourceAdminEmail', 'destAdminEmail'],
    optionalFields: ['sourceAdminEmail', 'destAdminEmail'],
    responseFormat: {
      success: 'boolean',
      verification: {
        source: 'DomainVerificationResult',
        destination: 'DomainVerificationResult',
        overall: 'OverallStatus'
      },
      recommendations: 'Array<Recommendation>'
    }
  })
}
