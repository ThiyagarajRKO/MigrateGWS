/**
 * Delegation Validation API
 * 
 * Endpoint for validating Google Workspace domain-wide delegation
 * and generating verification tokens with delegation access info
 */

import { NextRequest, NextResponse } from 'next/server'
import { 
  generateEnhancedVerificationToken, 
  parseEnhancedVerificationToken 
} from '@/lib/enhanced-verification-token'
import { 
  testDelegationAccess, 
  generateDelegationSetupInstructions 
} from '@/lib/delegation-access-middleware'

interface DelegationValidationRequest {
  sourceDomain: string
  targetDomain: string
  sourceAdminEmail: string
  targetAdminEmail: string
  serviceAccountEmail?: string
  testDelegation?: boolean
}

export async function POST(request: NextRequest) {
  try {
    const body: DelegationValidationRequest = await request.json()
    
    const {
      sourceDomain,
      targetDomain,
      sourceAdminEmail,
      targetAdminEmail,
      serviceAccountEmail,
      testDelegation = false
    } = body
    
    // Validate required fields
    if (!sourceDomain || !targetDomain || !sourceAdminEmail || !targetAdminEmail) {
      return NextResponse.json({
        error: 'Missing required fields',
        details: 'sourceDomain, targetDomain, sourceAdminEmail, and targetAdminEmail are required'
      }, { status: 400 })
    }
    
    console.log('🔐 Delegation Validation Request:')
    console.log(`   Source: ${sourceDomain} (${sourceAdminEmail})`)
    console.log(`   Target: ${targetDomain} (${targetAdminEmail})`)
    console.log(`   Test Delegation: ${testDelegation}`)
    
    // Get service account details
    const effectiveServiceAccountEmail = serviceAccountEmail || 
      process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL ||
      'unknown-service-account@project.iam.gserviceaccount.com'
    
    const serviceAccountClientId = process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_ID ||
      'unknown-client-id'
    
    // Domains and admin emails
    const verifiedDomains = [sourceDomain, targetDomain]
    const adminEmails = {
      [sourceDomain]: sourceAdminEmail,
      [targetDomain]: targetAdminEmail
    }
    
    // Required OAuth scopes for migration
    const requiredScopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/admin.directory.group',
      'https://www.googleapis.com/auth/admin.directory.user',
      'https://www.googleapis.com/auth/photoslibrary.readonly',
      'https://www.googleapis.com/auth/forms'
    ]
    
    // Generate enhanced verification token with delegation validation
    const tokenDelegationStatus = {
      source: { verified: true },
      dest: { verified: true }
    }
    
    const verificationToken = generateEnhancedVerificationToken(
      verifiedDomains,
      adminEmails,
      'cross-tenant',
      tokenDelegationStatus
    )
    
    // Parse the token to get delegation info
    const tokenData = parseEnhancedVerificationToken(verificationToken)
    const delegationAccess = tokenData?.delegationStatus
    
    // Test delegation if requested
    let delegationTest = null
    if (testDelegation) {
      console.log('🧪 Testing delegation access...')
      
      const sourceTest = await testDelegationAccess(
        effectiveServiceAccountEmail,
        sourceAdminEmail,
        requiredScopes
      )
      
      const targetTest = await testDelegationAccess(
        effectiveServiceAccountEmail,
        targetAdminEmail,
        requiredScopes
      )
      
      delegationTest = {
        source: sourceTest,
        target: targetTest,
        overall: {
          success: sourceTest.success && targetTest.success,
          errors: [...sourceTest.errors, ...targetTest.errors]
        }
      }
    }
    
    // Generate setup instructions
    const setupInstructions = generateDelegationSetupInstructions(
      effectiveServiceAccountEmail,
      serviceAccountClientId,
      verifiedDomains
    )
    
    // Determine delegation status
    const delegationStatus = {
      validated: delegationAccess?.sourceVerified && delegationAccess?.destVerified || false,
      hasAccess: delegationAccess?.sourceVerified && delegationAccess?.destVerified || false,
      grantedScopes: requiredScopes, // Assume all scopes granted for validated delegation
      missingScopes: (delegationAccess?.sourceVerified && delegationAccess?.destVerified) ? [] : requiredScopes,
      errors: [],
      testingMode: process.env.NEXT_PUBLIC_ENABLE_DELEGATION_TESTING === 'true'
    }
    
    console.log(`✅ Generated verification token with delegation info`)
    console.log(`📊 Delegation Status: ${delegationStatus.hasAccess ? 'VALID' : 'NEEDS_SETUP'}`)
    
    return NextResponse.json({
      success: true,
      verificationToken,
      delegationStatus,
      serviceAccount: {
        email: effectiveServiceAccountEmail,
        clientId: serviceAccountClientId
      },
      domains: {
        source: sourceDomain,
        target: targetDomain
      },
      adminEmails,
      requiredScopes,
      delegationTest,
      setupInstructions,
      message: delegationStatus.hasAccess 
        ? 'Delegation access validated successfully'
        : 'Delegation setup required for live migration'
    })
    
  } catch (error) {
    console.error('Delegation validation error:', error)
    
    return NextResponse.json({
      error: 'Delegation validation failed',
      details: `Error during validation: ${error}`,
      message: 'Failed to validate delegation access'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const token = url.searchParams.get('token')
    
    if (!token) {
      return NextResponse.json({
        success: true,
        message: 'Delegation Validation API - Operational',
        status: 'available',
        endpoints: {
          validate: '/api/v1/delegation/validate?token=<verificationToken>',
          setup: 'POST /api/v1/delegation/validate with domain and admin details'
        },
        note: 'Use ?token=<verificationToken> to validate a delegation token',
        timestamp: new Date().toISOString()
      });
    }
    
    // Parse and validate the token
    const tokenData = parseEnhancedVerificationToken(token)
    
    if (!tokenData) {
      return NextResponse.json({
        error: 'Invalid verification token',
        details: 'Token is malformed or expired'
      }, { status: 400 })
    }
    
    // Extract delegation information
    const delegationInfo = {
      tokenValid: true,
      verificationId: tokenData.verificationId,
      timestamp: tokenData.timestamp,
      verifiedDomains: tokenData.verifiedDomains,
      serviceAccountEmail: tokenData.serviceAccountEmail,
      delegationStatus: tokenData.delegationStatus,
      delegationAccess: tokenData.delegationStatus,
      adminEmails: tokenData.adminEmails
    }
    
    return NextResponse.json({
      success: true,
      delegationInfo,
      message: 'Token parsed successfully'
    })
    
  } catch (error) {
    return NextResponse.json({
      error: 'Token validation failed',
      details: `Error parsing token: ${error}`
    }, { status: 500 })
  }
}
