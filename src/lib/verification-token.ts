/**
 * Verification Token Utilities
 * 
 * Handles generation and validation of verification tokens for 
 * Google Workspace API authentication in cross-tenant migrations.
 */

export interface VerificationTokenData {
  verificationId: string;
  timestamp: string;
  verifiedDomains: string[];
  serviceAccountEmail: string;
  migrationScenario: 'single-super-admin' | 'cross-tenant';
  adminEmails: { [domain: string]: string };
  delegationStatus: {
    sourceVerified: boolean;
    destVerified: boolean;
    delegationCheckedAt?: string;
    scopes?: string[];
    errors?: string[];
  };
  apiAuthenticationEnabled: boolean;
  generatedBy: string;
  sessionId: string;
  delegationAccess?: {
    validated: boolean;
    validatedAt: string;
    grantedScopes: string[];
    missingScopes: string[];
    delegationErrors: string[];
  };
}

export interface DelegationStatus {
  source: { verified: boolean };
  dest: { verified: boolean };
}

export interface DelegationAccessInfo {
  validated: boolean;
  validatedAt: string;
  grantedScopes: string[];
  missingScopes: string[];
  delegationErrors: string[];
}

/**
 * Generate verification token for authenticated API operations with delegation access validation
 * 
 * @param verifiedDomains List of domains that have been verified for delegation
 * @param adminEmails Mapping of domain to admin email
 * @param migrationScenario Type of migration scenario
 * @param delegationStatus Current delegation verification status
 * @param delegationAccess Optional delegation access validation info
 * @returns Base64-encoded verification token
 */
export function generateVerificationToken(
  verifiedDomains: string[],
  adminEmails: { [domain: string]: string },
  migrationScenario: 'single-super-admin' | 'cross-tenant',
  delegationStatus: DelegationStatus,
  delegationAccess?: DelegationAccessInfo
): string {
  // Get service account email from environment
  const serviceAccountEmail = 
    process.env.NEXT_PUBLIC_GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL || 
    process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL || 
    process.env.SERVICE_ACCOUNT_EMAIL ||
    'unknown-service-account@project.iam.gserviceaccount.com';

  const tokenData: VerificationTokenData = {
    verificationId: `dwd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    verifiedDomains,
    serviceAccountEmail,
    migrationScenario,
    adminEmails,
    delegationStatus: {
      sourceVerified: delegationStatus.source.verified,
      destVerified: delegationStatus.dest.verified,
      delegationCheckedAt: new Date().toISOString(),
      scopes: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/admin.directory.group',
        'https://www.googleapis.com/auth/admin.directory.user'
      ]
    },
    apiAuthenticationEnabled: true,
    generatedBy: 'VerificationTokenUtility',
    sessionId: typeof window !== 'undefined' ? sessionStorage.getItem('migration_session_id') || 'unknown' : 'ssr',
    delegationAccess: delegationAccess || {
      validated: false,
      validatedAt: new Date().toISOString(),
      grantedScopes: [],
      missingScopes: [],
      delegationErrors: []
    }
  };

  // Base64 encode the token data
  return btoa(JSON.stringify(tokenData));
}

/**
 * Parse and validate a verification token
 * 
 * @param token Base64-encoded verification token
 * @returns Parsed token data or null if invalid
 */
export function parseVerificationToken(token: string): VerificationTokenData | null {
  try {
    const decoded = atob(token);
    const data = JSON.parse(decoded) as VerificationTokenData;
    
    // Basic validation
    if (!data.verificationId || !data.timestamp || !data.verifiedDomains) {
      console.warn('Invalid verification token: missing required fields');
      return null;
    }
    
    // Check if token is expired (24 hours)
    const tokenAge = Date.now() - new Date(data.timestamp).getTime();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    
    if (tokenAge > maxAge) {
      console.warn('Verification token expired');
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Failed to parse verification token:', error);
    return null;
  }
}

/**
 * Check if a verification token is valid for a specific domain
 * 
 * @param token Base64-encoded verification token
 * @param domain Domain to check
 * @returns Whether the token is valid for the domain
 */
export function isTokenValidForDomain(token: string, domain: string): boolean {
  const data = parseVerificationToken(token);
  if (!data) return false;
  
  return data.verifiedDomains.includes(domain) && 
         data.delegationStatus.sourceVerified && 
         data.delegationStatus.destVerified;
}

/**
 * Get admin email for a domain from verification token
 * 
 * @param token Base64-encoded verification token
 * @param domain Domain to get admin email for
 * @returns Admin email or null if not found
 */
export function getAdminEmailFromToken(token: string, domain: string): string | null {
  const data = parseVerificationToken(token);
  if (!data) return null;
  
  return data.adminEmails[domain] || null;
}

/**
 * Validate delegation access for service account
 * 
 * @param serviceAccountEmail Service account email
 * @param domains List of domains to validate
 * @param requiredScopes List of required OAuth scopes
 * @returns Delegation access validation info
 */
export async function validateDelegationAccess(
  serviceAccountEmail: string,
  domains: string[],
  requiredScopes: string[]
): Promise<DelegationAccessInfo> {
  const validationResult: DelegationAccessInfo = {
    validated: false,
    validatedAt: new Date().toISOString(),
    grantedScopes: [],
    missingScopes: [...requiredScopes],
    delegationErrors: []
  };

  try {
    // In a real implementation, this would make actual API calls to verify delegation
    // For now, we'll simulate the validation based on environment settings
    
    const delegationTestingEnabled = process.env.NEXT_PUBLIC_ENABLE_DELEGATION_TESTING === 'true';
    
    if (delegationTestingEnabled) {
      // Simulate successful delegation for testing
      validationResult.validated = true;
      validationResult.grantedScopes = [...requiredScopes];
      validationResult.missingScopes = [];
      validationResult.delegationErrors = [];
    } else {
      // Simulate delegation check failure (realistic for development)
      validationResult.validated = false;
      validationResult.grantedScopes = [];
      validationResult.missingScopes = [...requiredScopes];
      validationResult.delegationErrors = [
        `Domain-wide delegation not configured for ${serviceAccountEmail}`,
        'Required scopes not granted in Google Admin Console',
        'Service account may not have proper permissions'
      ];
    }
    
  } catch (error) {
    validationResult.delegationErrors.push(`Validation error: ${error}`);
  }
  
  return validationResult;
}

/**
 * Generate verification token with delegation access validation
 * 
 * @param verifiedDomains List of domains
 * @param adminEmails Admin email mappings
 * @param migrationScenario Migration type
 * @param serviceAccountEmail Service account email
 * @returns Promise resolving to verification token with delegation info
 */
export async function generateVerificationTokenWithDelegation(
  verifiedDomains: string[],
  adminEmails: { [domain: string]: string },
  migrationScenario: 'single-super-admin' | 'cross-tenant',
  serviceAccountEmail?: string
): Promise<string> {
  // Default required scopes for Google Workspace migration
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
  
  // Get service account email
  const effectiveServiceAccountEmail = serviceAccountEmail || 
    process.env.NEXT_PUBLIC_GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL || 
    process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL || 
    process.env.SERVICE_ACCOUNT_EMAIL ||
    'unknown-service-account@project.iam.gserviceaccount.com';
  
  // Validate delegation access
  const delegationAccess = await validateDelegationAccess(
    effectiveServiceAccountEmail,
    verifiedDomains,
    requiredScopes
  );
  
  // Create delegation status based on validation
  const delegationStatus: DelegationStatus = {
    source: { verified: delegationAccess.validated },
    dest: { verified: delegationAccess.validated }
  };
  
  // Generate token with delegation access info
  return generateVerificationToken(
    verifiedDomains,
    adminEmails,
    migrationScenario,
    delegationStatus,
    delegationAccess
  );
}

/**
 * Check if token has valid delegation access
 * 
 * @param token Base64-encoded verification token
 * @returns Whether delegation access is valid
 */
export function hasValidDelegationAccess(token: string): boolean {
  const data = parseVerificationToken(token);
  if (!data || !data.delegationAccess) return false;
  
  return data.delegationAccess.validated && 
         data.delegationAccess.delegationErrors.length === 0;
}

/**
 * Get delegation errors from token
 * 
 * @param token Base64-encoded verification token
 * @returns Array of delegation errors
 */
export function getDelegationErrors(token: string): string[] {
  const data = parseVerificationToken(token);
  if (!data || !data.delegationAccess) return ['Token missing delegation access info'];
  
  return data.delegationAccess.delegationErrors;
}

/**
 * Get missing scopes from token
 * 
 * @param token Base64-encoded verification token
 * @returns Array of missing OAuth scopes
 */
export function getMissingScopes(token: string): string[] {
  const data = parseVerificationToken(token);
  if (!data || !data.delegationAccess) return [];
  
  return data.delegationAccess.missingScopes;
}
