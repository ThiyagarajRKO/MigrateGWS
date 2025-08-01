import { NextRequest, NextResponse } from 'next/server'

// Mock verification function - in production, this would test actual API calls
const verifyDomainAccess = async (domain: string, clientId: string, adminEmail: string) => {
  // This would typically make actual Google API calls to verify delegation
  // For now, we'll simulate the verification process
  
  try {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Mock verification logic
    const isConfigured = clientId && clientId !== 'your-service-account-client-id'
    const isVerified = isConfigured && adminEmail.includes(domain)
    
    return {
      domain,
      clientId,
      adminEmail,
      configured: isConfigured,
      verified: isVerified,
      testResults: [{
        test: 'Directory API Access',
        status: isVerified ? 'success' : 'failed',
        message: isVerified 
          ? 'Successfully accessed Admin Directory API' 
          : 'Failed to access Admin Directory API - check delegation configuration',
        error: isVerified ? null : 'Insufficient permissions or delegation not configured'
      }],
      lastChecked: new Date().toISOString()
    }
  } catch (error) {
    return {
      domain,
      clientId,
      adminEmail,
      configured: false,
      verified: false,
      testResults: [{
        test: 'Directory API Access',
        status: 'error',
        message: 'Error during verification',
        error: error instanceof Error ? error.message : 'Unknown error'
      }],
      lastChecked: new Date().toISOString()
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sourceAdminEmail, destAdminEmail, sourceEmail, destEmail } = body

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

    // Mock client IDs - in production, these would be retrieved from your service account configuration
    const sourceClientId = process.env.NEXT_PUBLIC_SERVICE_ACCOUNT_CLIENT_ID || `mock-client-id-${sourceDomain.replace(/\./g, '-')}`
    const destClientId = process.env.NEXT_PUBLIC_SERVICE_ACCOUNT_CLIENT_ID || `mock-client-id-${destDomain.replace(/\./g, '-')}`

    // Verify both domains
    const [sourceVerification, destVerification] = await Promise.all([
      verifyDomainAccess(sourceDomain, sourceClientId, sourceAdminEmail),
      verifyDomainAccess(destDomain, destClientId, destAdminEmail)
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
    optionalFields: ['sourceEmail', 'destEmail'],
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
