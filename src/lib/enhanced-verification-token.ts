/**
 * Enhanced Verification Token Utilities with Security Features
 * 
 * Provides secure verification tokens with signing and optional encryption
 * for Google Workspace API authentication in cross-tenant migrations.
 */

import crypto from 'crypto'

export interface EnhancedVerificationTokenData {
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
  // Security fields
  signature?: string;
  nonce: string;
  issuer: string;
  audience: string[];
}

export interface DelegationStatus {
  source: { verified: boolean };
  dest: { verified: boolean };
}

export interface TokenSecurityOptions {
  enableSigning: boolean;
  enableEncryption: boolean;
  secretKey?: string;
  encryptionKey?: string;
  issuer?: string;
  expirationMinutes?: number;
}

// Default security configuration
const DEFAULT_SECURITY_OPTIONS: TokenSecurityOptions = {
  enableSigning: true,
  enableEncryption: false,
  secretKey: process.env.VERIFICATION_TOKEN_SECRET || 'default-secret-key-change-in-production',
  encryptionKey: process.env.VERIFICATION_TOKEN_ENCRYPTION_KEY || 'default-encryption-key-32-bytes!!',
  issuer: 'GWS-Migration-Platform',
  expirationMinutes: 1440 // 24 hours
}

/**
 * Generate a cryptographically secure nonce
 */
function generateNonce(): string {
  return crypto.randomBytes(16).toString('hex')
}

/**
 * Sign token data using HMAC-SHA256
 */
function signTokenData(data: string, secretKey: string): string {
  return crypto.createHmac('sha256', secretKey).update(data).digest('hex')
}

/**
 * Verify token signature
 */
function verifyTokenSignature(data: string, signature: string, secretKey: string): boolean {
  const expectedSignature = signTokenData(data, secretKey)
  return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'))
}

/**
 * Encrypt token data using AES-256-GCM
 */
function encryptTokenData(data: string, encryptionKey: string): { encrypted: string; iv: string; tag: string } {
  const iv = crypto.randomBytes(12) // 96-bit IV for GCM
  const cipher = crypto.createCipher('aes-256-gcm', encryptionKey.slice(0, 32))
  
  let encrypted = cipher.update(data, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  // For compatibility, we'll use a simple tag approach
  const tag = crypto.createHmac('sha256', encryptionKey).update(encrypted).digest('hex').slice(0, 32)
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    tag
  }
}

/**
 * Decrypt token data using AES-256-GCM
 */
function decryptTokenData(encryptedData: { encrypted: string; iv: string; tag: string }, encryptionKey: string): string {
  // Verify tag first
  const expectedTag = crypto.createHmac('sha256', encryptionKey).update(encryptedData.encrypted).digest('hex').slice(0, 32)
  if (!crypto.timingSafeEqual(Buffer.from(encryptedData.tag, 'hex'), Buffer.from(expectedTag, 'hex'))) {
    throw new Error('Authentication tag verification failed')
  }
  
  const decipher = crypto.createDecipher('aes-256-gcm', encryptionKey.slice(0, 32))
  
  let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  
  return decrypted
}

/**
 * Generate enhanced verification token with security features
 * 
 * @param verifiedDomains List of domains that have been verified for delegation
 * @param adminEmails Mapping of domain to admin email
 * @param migrationScenario Type of migration scenario
 * @param delegationStatus Current delegation verification status
 * @param securityOptions Security configuration options
 * @returns Secure verification token
 */
export function generateEnhancedVerificationToken(
  verifiedDomains: string[],
  adminEmails: { [domain: string]: string },
  migrationScenario: 'single-super-admin' | 'cross-tenant',
  delegationStatus: DelegationStatus,
  securityOptions: Partial<TokenSecurityOptions> = {}
): string {
  const options = { ...DEFAULT_SECURITY_OPTIONS, ...securityOptions }
  
  // Get service account email from environment
  const serviceAccountEmail = 
    process.env.NEXT_PUBLIC_GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL || 
    process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL || 
    process.env.SERVICE_ACCOUNT_EMAIL ||
    'unknown-service-account@project.iam.gserviceaccount.com';

  const expirationTime = new Date()
  expirationTime.setMinutes(expirationTime.getMinutes() + (options.expirationMinutes || 1440))

  const tokenData: EnhancedVerificationTokenData = {
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
    generatedBy: 'EnhancedVerificationTokenUtility',
    sessionId: typeof window !== 'undefined' ? sessionStorage.getItem('migration_session_id') || 'unknown' : 'ssr',
    nonce: generateNonce(),
    issuer: options.issuer || 'GWS-Migration-Platform',
    audience: verifiedDomains
  };

  // Serialize token data
  let tokenString = JSON.stringify(tokenData)

  // Add signature if enabled
  if (options.enableSigning && options.secretKey) {
    const signature = signTokenData(tokenString, options.secretKey)
    const signedData = { ...tokenData, signature }
    tokenString = JSON.stringify(signedData)
  }

  // Encrypt if enabled
  if (options.enableEncryption && options.encryptionKey) {
    const encryptedData = encryptTokenData(tokenString, options.encryptionKey)
    tokenString = JSON.stringify(encryptedData)
  }

  // Base64 encode the final token
  return Buffer.from(tokenString).toString('base64')
}

/**
 * Parse and validate an enhanced verification token
 * 
 * @param token Base64-encoded verification token
 * @param securityOptions Security configuration options
 * @returns Parsed token data or null if invalid
 */
export function parseEnhancedVerificationToken(
  token: string, 
  securityOptions: Partial<TokenSecurityOptions> = {}
): EnhancedVerificationTokenData | null {
  try {
    const options = { ...DEFAULT_SECURITY_OPTIONS, ...securityOptions }
    
    // Base64 decode
    let tokenString = Buffer.from(token, 'base64').toString('utf8')
    
    // Decrypt if encryption was enabled
    if (options.enableEncryption && options.encryptionKey) {
      try {
        const encryptedData = JSON.parse(tokenString)
        tokenString = decryptTokenData(encryptedData, options.encryptionKey)
      } catch (decryptError) {
        console.warn('Failed to decrypt token:', decryptError)
        return null
      }
    }

    // Parse token data
    const data = JSON.parse(tokenString) as EnhancedVerificationTokenData
    
    // Verify signature if signing was enabled
    if (options.enableSigning && options.secretKey) {
      if (!data.signature) {
        console.warn('Token missing required signature')
        return null
      }
      
      // Remove signature for verification
      const { signature, ...tokenDataForVerification } = data
      const tokenDataString = JSON.stringify(tokenDataForVerification)
      
      if (!verifyTokenSignature(tokenDataString, signature, options.secretKey)) {
        console.warn('Token signature verification failed')
        return null
      }
    }
    
    // Basic validation
    if (!data.verificationId || !data.timestamp || !data.verifiedDomains || !data.nonce) {
      console.warn('Invalid token: missing required fields')
      return null
    }
    
    // Check if token is expired
    const tokenAge = Date.now() - new Date(data.timestamp).getTime()
    const maxAge = (options.expirationMinutes || 1440) * 60 * 1000 // Convert to milliseconds
    
    if (tokenAge > maxAge) {
      console.warn('Token expired')
      return null
    }
    
    // Verify issuer
    if (data.issuer !== (options.issuer || 'GWS-Migration-Platform')) {
      console.warn('Token issuer mismatch')
      return null
    }
    
    return data
  } catch (error) {
    console.error('Failed to parse enhanced verification token:', error)
    return null
  }
}

/**
 * Check if an enhanced verification token is valid for specific domains
 * 
 * @param token Base64-encoded verification token
 * @param domains Domains to check
 * @param securityOptions Security configuration options
 * @returns Whether the token is valid for the domains
 */
export function isEnhancedTokenValidForDomains(
  token: string, 
  domains: string[], 
  securityOptions: Partial<TokenSecurityOptions> = {}
): boolean {
  const data = parseEnhancedVerificationToken(token, securityOptions)
  if (!data) return false
  
  // Check if all requested domains are in the token's verified domains
  return domains.every(domain => data.verifiedDomains.includes(domain)) && 
         data.delegationStatus.sourceVerified && 
         data.delegationStatus.destVerified
}

/**
 * Get admin email for a domain from enhanced verification token
 * 
 * @param token Base64-encoded verification token
 * @param domain Domain to get admin email for
 * @param securityOptions Security configuration options
 * @returns Admin email or null if not found
 */
export function getAdminEmailFromEnhancedToken(
  token: string, 
  domain: string, 
  securityOptions: Partial<TokenSecurityOptions> = {}
): string | null {
  const data = parseEnhancedVerificationToken(token, securityOptions)
  if (!data) return null
  
  return data.adminEmails[domain] || null
}

/**
 * Revoke a verification token by adding it to a blacklist
 * (In production, this would store the token ID in a database/cache)
 */
const revokedTokens = new Set<string>()

export function revokeVerificationToken(token: string): void {
  const data = parseEnhancedVerificationToken(token)
  if (data) {
    revokedTokens.add(data.verificationId)
  }
}

export function isTokenRevoked(token: string): boolean {
  const data = parseEnhancedVerificationToken(token)
  return data ? revokedTokens.has(data.verificationId) : true
}

/**
 * Generate a verification token for testing with enhanced security
 */
export function generateTestVerificationToken(
  domains: string[] = ['test-source.com', 'test-target.com'],
  scenario: 'single-super-admin' | 'cross-tenant' = 'cross-tenant'
): string {
  const adminEmails = {
    [domains[0]]: `admin@${domains[0]}`,
    [domains[1]]: `admin@${domains[1]}`
  }
  
  return generateEnhancedVerificationToken(
    domains,
    adminEmails,
    scenario,
    { source: { verified: true }, dest: { verified: true } },
    { enableSigning: true, enableEncryption: false } // Signing only for tests
  )
}
