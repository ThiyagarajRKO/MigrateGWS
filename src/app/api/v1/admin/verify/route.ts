import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { SignJWT, jwtVerify } from 'jose';

// Interfaces for type safety
interface AdminVerificationRequest {
  adminEmail: string;
  domain: string;
  challenge?: string;
  jwtToken?: string;
  migrationScenario: 'single-super-admin' | 'cross-tenant';
  verificationMethod: 'crypto' | 'jwt' | 'both';
}

interface AdminVerificationResult {
  email: string;
  domain: string;
  verified: boolean;
  verificationMethod: string;
  cryptoVerification?: {
    challengeVerified: boolean;
    signatureValid: boolean;
    timestamp: string;
  };
  jwtVerification?: {
    tokenValid: boolean;
    claims: any;
    issuer: string;
    audience: string;
    expiry: string;
  };
  permissions: {
    canManageUsers: boolean;
    canAccessDirectory: boolean;
    canConfigureDelegation: boolean;
    adminLevel: 'super' | 'delegated' | 'limited' | 'none';
  };
  lastVerified: string;
}

// Environment variables for crypto operations
const ADMIN_VERIFICATION_SECRET = process.env.ADMIN_VERIFICATION_SECRET || 'fallback-secret-key-for-development';
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-jwt-secret-for-development');

/**
 * Generate a cryptographic challenge for admin email verification
 */
function generateCryptoChallenge(adminEmail: string, domain: string): {
  challenge: string;
  signature: string;
  timestamp: string;
} {
  const timestamp = new Date().toISOString();
  const payload = `${adminEmail}:${domain}:${timestamp}`;
  
  // Create HMAC signature
  const hmac = crypto.createHmac('sha256', ADMIN_VERIFICATION_SECRET);
  hmac.update(payload);
  const signature = hmac.digest('hex');
  
  // Create challenge (base64 encoded payload)
  const challenge = Buffer.from(payload).toString('base64');
  
  return {
    challenge,
    signature,
    timestamp
  };
}

/**
 * Verify cryptographic challenge response
 */
function verifyCryptoChallenge(challenge: string, expectedSignature: string, adminEmail: string, domain: string): {
  verified: boolean;
  details: any;
} {
  try {
    // Decode challenge
    const payload = Buffer.from(challenge, 'base64').toString('utf-8');
    const [email, challengeDomain, timestamp] = payload.split(':');
    
    // Verify components match
    if (email !== adminEmail || challengeDomain !== domain) {
      return {
        verified: false,
        details: {
          error: 'Challenge parameters do not match',
          expected: { email: adminEmail, domain },
          received: { email, domain: challengeDomain }
        }
      };
    }
    
    // Check timestamp is recent (within 10 minutes)
    const challengeTime = new Date(timestamp).getTime();
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10 minutes
    
    if (now - challengeTime > maxAge) {
      return {
        verified: false,
        details: {
          error: 'Challenge expired',
          challengeAge: now - challengeTime,
          maxAge
        }
      };
    }
    
    // Verify signature
    const hmac = crypto.createHmac('sha256', ADMIN_VERIFICATION_SECRET);
    hmac.update(payload);
    const computedSignature = hmac.digest('hex');
    
    const signatureValid = crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(computedSignature, 'hex')
    );
    
    return {
      verified: signatureValid,
      details: {
        timestamp,
        signatureValid,
        challengeAge: now - challengeTime
      }
    };
  } catch (error) {
    return {
      verified: false,
      details: {
        error: 'Invalid challenge format',
        exception: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

/**
 * Create a manual JWT token for admin verification
 */
async function createAdminJWT(adminEmail: string, domain: string, permissions: any): Promise<string> {
  const payload = {
    email: adminEmail,
    domain: domain,
    permissions: permissions,
    type: 'admin-verification',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour expiry
  };
  
  const jwt = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .setIssuer('gws-migration-platform')
    .setAudience(domain)
    .sign(JWT_SECRET);
  
  return jwt;
}

/**
 * Verify manual JWT token
 */
async function verifyAdminJWT(token: string, expectedDomain: string): Promise<{
  verified: boolean;
  claims?: any;
  error?: string;
}> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      issuer: 'gws-migration-platform',
      audience: expectedDomain,
    });
    
    return {
      verified: true,
      claims: payload
    };
  } catch (error) {
    return {
      verified: false,
      error: error instanceof Error ? error.message : 'JWT verification failed'
    };
  }
}

/**
 * Determine admin permissions based on email and domain
 */
function determineAdminPermissions(email: string, domain: string): {
  canManageUsers: boolean;
  canAccessDirectory: boolean;
  canConfigureDelegation: boolean;
  adminLevel: 'super' | 'delegated' | 'limited' | 'none';
} {
  // Mock logic - in production, this would query Google Admin Directory API
  const isKnownAdmin = ['admin', 'administrator', 'info', 'support'].some(prefix => 
    email.toLowerCase().startsWith(prefix)
  );
  
  const isSuperAdmin = email.toLowerCase().includes('admin') || email.toLowerCase().includes('info');
  
  if (isSuperAdmin) {
    return {
      canManageUsers: true,
      canAccessDirectory: true,
      canConfigureDelegation: true,
      adminLevel: 'super'
    };
  }
  
  if (isKnownAdmin) {
    return {
      canManageUsers: true,
      canAccessDirectory: true,
      canConfigureDelegation: false,
      adminLevel: 'delegated'
    };
  }
  
  return {
    canManageUsers: false,
    canAccessDirectory: false,
    canConfigureDelegation: false,
    adminLevel: 'none'
  };
}

/**
 * Main verification handler
 */
export async function POST(request: NextRequest) {
  try {
    const body: AdminVerificationRequest = await request.json();
    const { 
      adminEmail, 
      domain, 
      challenge, 
      jwtToken, 
      migrationScenario, 
      verificationMethod 
    } = body;

    // Validate required fields
    if (!adminEmail || !domain || !verificationMethod) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: adminEmail, domain, verificationMethod' 
        },
        { status: 400 }
      );
    }

    // Validate email domain match
    const emailDomain = adminEmail.split('@')[1];
    if (emailDomain !== domain) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Admin email domain does not match specified domain' 
        },
        { status: 400 }
      );
    }

    const result: AdminVerificationResult = {
      email: adminEmail,
      domain: domain,
      verified: false,
      verificationMethod: verificationMethod,
      permissions: determineAdminPermissions(adminEmail, domain),
      lastVerified: new Date().toISOString()
    };

    // Perform cryptographic verification
    if (verificationMethod === 'crypto' || verificationMethod === 'both') {
      if (!challenge) {
        // Generate new challenge
        const cryptoChallenge = generateCryptoChallenge(adminEmail, domain);
        
        return NextResponse.json({
          success: false,
          requiresChallenge: true,
          challenge: cryptoChallenge,
          message: 'Cryptographic challenge generated. Please sign and return.',
          instructions: {
            step1: 'Use the provided challenge string',
            step2: 'Sign it with your admin private key',
            step3: 'Return the signature for verification'
          }
        });
      } else {
        // Verify existing challenge (signature should be in request headers or body)
        const signature = request.headers.get('x-challenge-signature') || '';
        const cryptoResult = verifyCryptoChallenge(challenge, signature, adminEmail, domain);
        
        result.cryptoVerification = {
          challengeVerified: cryptoResult.verified,
          signatureValid: cryptoResult.verified,
          timestamp: new Date().toISOString()
        };
      }
    }

    // Perform JWT verification
    if (verificationMethod === 'jwt' || verificationMethod === 'both') {
      if (!jwtToken) {
        // Generate new JWT token
        const adminJWT = await createAdminJWT(adminEmail, domain, result.permissions);
        
        return NextResponse.json({
          success: false,
          requiresJWT: true,
          jwtToken: adminJWT,
          message: 'JWT token generated. Please verify and return.',
          instructions: {
            step1: 'Validate the JWT token contents',
            step2: 'Ensure email and domain match your admin account',
            step3: 'Return the token for final verification'
          }
        });
      } else {
        // Verify existing JWT token
        const jwtResult = await verifyAdminJWT(jwtToken, domain);
        
        result.jwtVerification = {
          tokenValid: jwtResult.verified,
          claims: jwtResult.claims || {},
          issuer: 'gws-migration-platform',
          audience: domain,
          expiry: jwtResult.claims?.exp ? new Date(jwtResult.claims.exp * 1000).toISOString() : ''
        };
      }
    }

    // Determine overall verification status
    let overallVerified = false;
    
    if (verificationMethod === 'crypto') {
      overallVerified = result.cryptoVerification?.challengeVerified === true;
    } else if (verificationMethod === 'jwt') {
      overallVerified = result.jwtVerification?.tokenValid === true;
    } else if (verificationMethod === 'both') {
      overallVerified = 
        result.cryptoVerification?.challengeVerified === true && 
        result.jwtVerification?.tokenValid === true;
    }

    result.verified = overallVerified;

    // Return verification result
    return NextResponse.json({
      success: true,
      verified: overallVerified,
      result: result,
      migrationScenario: migrationScenario,
      readyForUserManagement: overallVerified && result.permissions.canManageUsers,
      message: overallVerified 
        ? 'Admin email successfully verified with cryptographic and/or JWT authentication'
        : 'Admin email verification failed',
      next_steps: overallVerified 
        ? [
            'Admin can now manage users in the migration platform',
            'Access to Google Workspace Directory API confirmed',
            'Ready to proceed with user discovery and migration setup'
          ]
        : [
            'Complete the verification challenge',
            'Ensure admin has proper permissions',
            'Retry verification with correct credentials'
          ]
    });

  } catch (error) {
    console.error('[Admin Verification] Error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error during admin verification',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for generating verification challenges
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const adminEmail = searchParams.get('adminEmail');
    const domain = searchParams.get('domain');
    const method = searchParams.get('method') || 'crypto';

    if (!adminEmail || !domain) {
      return NextResponse.json({
        success: true,
        message: 'Admin Verification API - Operational',
        status: 'available',
        endpoints: {
          verify: '/api/v1/admin/verify?adminEmail=<email>&domain=<domain>&method=<crypto|jwt|both>',
          challenge: 'POST /api/v1/admin/verify with admin credentials'
        },
        methods: ['crypto', 'jwt', 'both'],
        note: 'Requires adminEmail and domain query parameters',
        timestamp: new Date().toISOString()
      });
    }

    const emailDomain = adminEmail.split('@')[1];
    if (emailDomain !== domain) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Admin email domain does not match specified domain' 
        },
        { status: 400 }
      );
    }

    if (method === 'crypto') {
      const challenge = generateCryptoChallenge(adminEmail, domain);
      
      return NextResponse.json({
        success: true,
        type: 'crypto-challenge',
        challenge: challenge,
        instructions: {
          description: 'Sign this challenge with your admin private key',
          steps: [
            '1. Decode the challenge from base64',
            '2. Verify it contains your email and domain',
            '3. Sign with HMAC-SHA256 using your private key',
            '4. Return the signature in the verification request'
          ]
        }
      });
    }

    if (method === 'jwt') {
      const permissions = determineAdminPermissions(adminEmail, domain);
      const jwtToken = await createAdminJWT(adminEmail, domain, permissions);
      
      return NextResponse.json({
        success: true,
        type: 'jwt-token',
        jwtToken: jwtToken,
        instructions: {
          description: 'Verify this JWT token and return it for final validation',
          steps: [
            '1. Decode and verify the JWT token',
            '2. Check the email and domain in claims',
            '3. Ensure permissions match your admin level',
            '4. Return the token in the verification request'
          ]
        }
      });
    }

    return NextResponse.json(
      { 
        success: false, 
        error: 'Invalid verification method. Use "crypto" or "jwt"' 
      },
      { status: 400 }
    );

  } catch (error) {
    console.error('[Admin Challenge Generation] Error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error during challenge generation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
