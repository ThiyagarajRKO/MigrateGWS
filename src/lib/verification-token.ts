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
  };
  apiAuthenticationEnabled: boolean;
  generatedBy: string;
  sessionId: string;
}

export interface DelegationStatus {
  source: { verified: boolean };
  dest: { verified: boolean };
}

/**
 * Generate verification token for authenticated API operations
 * 
 * @param verifiedDomains List of domains that have been verified for delegation
 * @param adminEmails Mapping of domain to admin email
 * @param migrationScenario Type of migration scenario
 * @param delegationStatus Current delegation verification status
 * @returns Base64-encoded verification token
 */
export function generateVerificationToken(
  verifiedDomains: string[],
  adminEmails: { [domain: string]: string },
  migrationScenario: 'single-super-admin' | 'cross-tenant',
  delegationStatus: DelegationStatus
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
      destVerified: delegationStatus.dest.verified
    },
    apiAuthenticationEnabled: true,
    generatedBy: 'VerificationTokenUtility',
    sessionId: typeof window !== 'undefined' ? sessionStorage.getItem('migration_session_id') || 'unknown' : 'ssr'
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
