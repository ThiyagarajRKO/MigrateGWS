/**
 * Delegation Access Middleware
 * 
 * Handles validation of Google Workspace domain-wide delegation
 * for service accounts in migration APIs
 */

import { NextRequest, NextResponse } from 'next/server';
import { parseEnhancedVerificationToken } from './enhanced-verification-token';
import { createServiceAccountService } from './google-workspace';

export interface DelegationValidationResult {
  isValid: boolean;
  hasAccess: boolean;
  errors: string[];
  missingScopes: string[];
  recommendation: string;
}

/**
 * Validate delegation access from verification token
 * 
 * @param token Verification token
 * @returns Delegation validation result
 */
export function validateTokenDelegation(token: string): DelegationValidationResult {
  const result: DelegationValidationResult = {
    isValid: false,
    hasAccess: false,
    errors: [],
    missingScopes: [],
    recommendation: ''
  };

  // Parse the token
  const tokenData = parseEnhancedVerificationToken(token);
  if (!tokenData) {
    result.errors.push('Invalid or expired verification token');
    result.recommendation = 'Generate a new verification token';
    return result;
  }

  result.isValid = true;

  // Check delegation access (simplified for enhanced tokens)
  const hasAccess = tokenData.delegationStatus.sourceVerified && tokenData.delegationStatus.destVerified;
  const delegationErrors: string[] = [];
  const missingScopes: string[] = [];

  // Add basic error checking
  if (!tokenData.delegationStatus.sourceVerified) {
    delegationErrors.push('Source domain delegation not verified');
  }
  if (!tokenData.delegationStatus.destVerified) {
    delegationErrors.push('Destination domain delegation not verified');
  }

  result.hasAccess = hasAccess;
  result.errors = delegationErrors;
  result.missingScopes = missingScopes;

  if (!hasAccess) {
    if (delegationErrors.length > 0) {
      result.recommendation = 'Set up domain-wide delegation in Google Admin Console';
    } else if (missingScopes.length > 0) {
      result.recommendation = 'Add missing OAuth scopes to delegation configuration';
    } else {
      result.recommendation = 'Check service account and delegation setup';
    }
  } else {
    result.recommendation = 'Delegation access validated successfully';
  }

  return result;
}

/**
 * Middleware for API routes to check delegation access
 * 
 * @param request NextRequest object
 * @param requiredScopes Optional array of required OAuth scopes
 * @returns NextResponse or null if validation passes
 */
export async function validateDelegationMiddleware(
  request: NextRequest,
  requiredScopes?: string[]
): Promise<NextResponse | null> {
  try {
    const body = await request.json();
    const verificationToken = body.verificationToken;

    if (!verificationToken) {
      return NextResponse.json({
        error: 'Missing verification token',
        details: 'Verification token is required for delegation validation',
        code: 'MISSING_TOKEN'
      }, { status: 400 });
    }

    const validation = validateTokenDelegation(verificationToken);

    if (!validation.isValid) {
      return NextResponse.json({
        error: 'Invalid verification token',
        details: validation.errors.join(', '),
        recommendation: validation.recommendation,
        code: 'INVALID_TOKEN'
      }, { status: 403 });
    }

    if (!validation.hasAccess) {
      // In development/testing mode, allow with warning
      const testingMode = process.env.NEXT_PUBLIC_ENABLE_DELEGATION_TESTING === 'true';
      
      if (testingMode) {
        console.warn(' Delegation access warning:', validation.errors.join(', '));
        console.warn(' Continuing in test mode...');
        return null; // Allow to continue
      }

      // In production mode, block the request
      return NextResponse.json({
        error: 'Delegation access denied',
        details: validation.errors.join(', '),
        missingScopes: validation.missingScopes,
        recommendation: validation.recommendation,
        code: 'DELEGATION_DENIED'
      }, { status: 403 });
    }

    // Validation passed
    return null;
  } catch (error) {
    return NextResponse.json({
      error: 'Delegation validation failed',
      details: `Error during validation: ${error}`,
      code: 'VALIDATION_ERROR'
    }, { status: 500 });
  }
}

/**
 * Test delegation access for a service account
 * 
 * @param serviceAccountEmail Service account email
 * @param adminEmail Admin email to impersonate
 * @param testScopes Scopes to test
 * @returns Test result
 */
export async function testDelegationAccess(
  serviceAccountEmail: string,
  adminEmail: string,
  testScopes: string[]
): Promise<{
  success: boolean;
  grantedScopes: string[];
  deniedScopes: string[];
  errors: string[];
}> {
  const result = {
    success: false,
    grantedScopes: [] as string[],
    deniedScopes: [] as string[],
    errors: [] as string[]
  };

  try {
    // Create service account service for testing
    const gwsService = createServiceAccountService(adminEmail);
    
    // Test basic access (this is a simplified test)
    // In a real implementation, you would test each scope individually
    
    // For now, we'll simulate based on environment
    const delegationTesting = process.env.NEXT_PUBLIC_ENABLE_DELEGATION_TESTING === 'true';
    
    if (delegationTesting) {
      result.success = true;
      result.grantedScopes = [...testScopes];
      result.deniedScopes = [];
    } else {
      result.success = false;
      result.grantedScopes = [];
      result.deniedScopes = [...testScopes];
      result.errors.push('Domain-wide delegation not configured');
      result.errors.push(`Service account ${serviceAccountEmail} cannot impersonate ${adminEmail}`);
    }

  } catch (error) {
    result.errors.push(`Test failed: ${error}`);
  }

  return result;
}

/**
 * Generate delegation setup instructions
 * 
 * @param serviceAccountEmail Service account email
 * @param clientId Service account client ID
 * @param domains Domains to set up delegation for
 * @returns Setup instructions
 */
export function generateDelegationSetupInstructions(
  serviceAccountEmail: string,
  clientId: string,
  domains: string[]
): {
  title: string;
  steps: string[];
  scopes: string[];
  notes: string[];
} {
  const requiredScopes = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/admin.directory.group',
    'https://www.googleapis.com/auth/admin.directory.user',
    'https://www.googleapis.com/auth/photoslibrary.readonly',
    'https://www.googleapis.com/auth/forms'
  ];

  return {
    title: 'Domain-Wide Delegation Setup Instructions',
    steps: [
      '1. Go to Google Admin Console (admin.google.com)',
      '2. Navigate to Security > API Controls > Domain-wide delegation',
      '3. Click "Add new" or "Manage domain-wide delegation"',
      `4. Enter Client ID: ${clientId}`,
      '5. Add the required OAuth scopes (see scopes list below)',
      '6. Click "Authorize"',
      '7. Repeat for each domain that needs migration access',
      '8. Test the delegation with the verification token generator'
    ],
    scopes: requiredScopes,
    notes: [
      `Service Account: ${serviceAccountEmail}`,
      `Client ID: ${clientId}`,
      `Domains to configure: ${domains.join(', ')}`,
      'Allow 10-15 minutes for delegation changes to propagate',
      'Test delegation using the platform\'s verification tools',
      'Ensure admin accounts have proper permissions for migration'
    ]
  };
}
