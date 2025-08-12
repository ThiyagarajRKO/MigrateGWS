/**
 * Migration API Enhanced Token Integration
 * Provides middleware for enhanced verification tokens in migration APIs
 */

import { NextRequest } from 'next/server'
import { 
  parseEnhancedVerificationToken, 
  isEnhancedTokenValidForDomains,
  getAdminEmailFromEnhancedToken 
} from './enhanced-verification-token'
import { migrationLogger } from './migration-websocket-logger'

export interface TokenValidationResult {
  isValid: boolean
  tokenData?: any
  adminEmail?: string
  errorMessage?: string
  tokenType: 'basic' | 'enhanced' | 'invalid'
}

/**
 * Validate verification token with support for both basic and enhanced tokens
 * 
 * @param token Verification token from request
 * @param domains Domains to validate against
 * @returns Token validation result
 */
export function validateVerificationToken(
  token: string,
  domains: string[]
): TokenValidationResult {
  migrationLogger.delegation('Starting token validation', { 
    domains, 
    tokenLength: token?.length 
  })

  if (!token) {
    migrationLogger.delegationError('No verification token provided')
    return {
      isValid: false,
      errorMessage: 'No verification token provided',
      tokenType: 'invalid'
    }
  }

  // First try enhanced token validation
  try {
    migrationLogger.delegation('Attempting enhanced token validation')
    
    const enhancedData = parseEnhancedVerificationToken(token, {
      enableSigning: process.env.VERIFICATION_TOKEN_SIGNING_ENABLED === 'true',
      enableEncryption: process.env.VERIFICATION_TOKEN_ENCRYPTION_ENABLED === 'true'
    })

    if (enhancedData) {
      migrationLogger.delegation('Enhanced token parsed successfully', { tokenData: enhancedData })
      
      const isValid = isEnhancedTokenValidForDomains(token, domains, {
        enableSigning: process.env.VERIFICATION_TOKEN_SIGNING_ENABLED === 'true',
        enableEncryption: process.env.VERIFICATION_TOKEN_ENCRYPTION_ENABLED === 'true'
      })

      if (isValid) {
        const adminEmail = domains.length > 0 ? getAdminEmailFromEnhancedToken(token, domains[0], {
          enableSigning: process.env.VERIFICATION_TOKEN_SIGNING_ENABLED === 'true',
          enableEncryption: process.env.VERIFICATION_TOKEN_ENCRYPTION_ENABLED === 'true'
        }) : null

        migrationLogger.delegationSuccess('Enhanced token validation successful', {
          adminEmail,
          domains
        })

        return {
          isValid: true,
          tokenData: enhancedData,
          adminEmail: adminEmail || undefined,
          tokenType: 'enhanced'
        }
      } else {
        migrationLogger.delegationError('Enhanced token validation failed for domains', { domains })
        return {
          isValid: false,
          errorMessage: 'Enhanced token validation failed for domains',
          tokenType: 'enhanced'
        }
      }
    }
  } catch (enhancedError) {
    migrationLogger.delegation('Enhanced token validation failed, trying basic token...', enhancedError)
  }

  // Fallback to basic token validation for backward compatibility
  try {
    migrationLogger.delegation('Attempting basic token validation')
    
    const basicData = parseEnhancedVerificationToken(token)
    
    if (basicData) {
      migrationLogger.delegation('Basic token parsed successfully', { tokenData: basicData })
      
      // For enhanced tokens, validate using the enhanced validation function
      const allDomainsValid = isEnhancedTokenValidForDomains(token, domains)
      
      if (allDomainsValid) {
        const adminEmail = domains.length > 0 ? basicData.adminEmails?.[domains[0]] : null

        return {
          isValid: true,
          tokenData: basicData,
          adminEmail: adminEmail || undefined,
          tokenType: 'basic'
        }
      } else {
        return {
          isValid: false,
          errorMessage: 'Basic token validation failed for domains',
          tokenType: 'basic'
        }
      }
    }
  } catch (basicError) {
    console.log('Basic token validation also failed', basicError)
  }

  return {
    isValid: false,
    errorMessage: 'Token validation failed - invalid token format or expired',
    tokenType: 'invalid'
  }
}

/**
 * Extract domains from migration request
 */
export function extractDomainsFromRequest(request: NextRequest): string[] {
  const url = new URL(request.url)
  const sourceDomain = url.searchParams.get('sourceDomain')
  const targetDomain = url.searchParams.get('targetDomain')
  const domain = url.searchParams.get('domain')
  
  const domains: string[] = []
  if (sourceDomain) domains.push(sourceDomain)
  if (targetDomain) domains.push(targetDomain)
  if (domain) domains.push(domain)
  
  return domains.filter(Boolean)
}

/**
 * Common verification token middleware for migration APIs
 */
export function createTokenValidationMiddleware() {
  return async (request: NextRequest) => {
    // Get verification token from request
    const url = new URL(request.url)
    const verificationToken = url.searchParams.get('verificationToken')
    
    // Check for test mode bypass
    const isTestMode = process.env.NODE_ENV === 'development' && 
                      url.searchParams.get('testMode') === 'true'
    
    if (isTestMode) {
      console.log('🧪 Test mode enabled - bypassing token validation')
      return {
        isValid: true,
        tokenType: 'test-mode' as const,
        adminEmail: 'test@example.com'
      }
    }
    
    if (!verificationToken) {
      return {
        isValid: false,
        errorMessage: 'Missing verification token',
        tokenType: 'invalid' as const
      }
    }
    
    // Extract domains for validation
    const domains = extractDomainsFromRequest(request)
    
    // Validate token
    const validation = validateVerificationToken(verificationToken, domains)
    
    return validation
  }
}

/**
 * Create standardized error response for token validation failures
 */
export function createTokenValidationErrorResponse(validation: TokenValidationResult) {
  return new Response(
    JSON.stringify({
      success: false,
      error: 'Invalid verification token',
      message: validation.errorMessage,
      tokenType: validation.tokenType,
      code: 'INVALID_VERIFICATION_TOKEN'
    }),
    {
      status: 403,
      headers: {
        'Content-Type': 'application/json'
      }
    }
  )
}
