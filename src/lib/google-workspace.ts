import { google } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'
import { JWT } from 'google-auth-library'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'

export interface GoogleWorkspaceCredentials {
  accessToken: string
  refreshToken?: string
  expiryDate?: number
}

export interface ServiceAccountCredentials {
  clientEmail: string
  privateKey: string
  subjectEmail: string // The admin email to impersonate
}

export interface GWSUser {
  id: string
  primaryEmail: string
  name: {
    givenName: string
    familyName: string
    fullName: string
  }
  isAdmin: boolean
  isDelegatedAdmin: boolean
  lastLoginTime?: string
  creationTime: string
  suspended: boolean
  orgUnitPath: string
}

export interface GWSDomain {
  domainName: string
  isPrimary: boolean
  verified: boolean
  creationTime: string
  aliases?: string[]
}

// Manual JWT creation and verification functions
export interface JWTHeader {
  alg: string
  typ: string
}

export interface JWTPayload {
  iss: string // issuer (service account email)
  sub: string // subject (admin email to impersonate)
  aud: string // audience (Google's OAuth2 token endpoint)
  iat: number // issued at
  exp: number // expiration time
  scope: string // requested scopes
}

/**
 * Creates a manual JWT token for service account authentication
 * This bypasses the google-auth-library for better debugging and control
 */
export function createManualJWT(
  serviceAccountEmail: string,
  privateKey: string,
  subjectEmail: string,
  scopes: string[]
): string {
  const now = Math.floor(Date.now() / 1000)
  
  const header: JWTHeader = {
    alg: 'RS256',
    typ: 'JWT'
  }
  
  const payload: JWTPayload = {
    iss: serviceAccountEmail,
    sub: subjectEmail,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600, // 1 hour expiration
    scope: scopes.join(' ')
  }
  
  // Base64URL encode header and payload
  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  
  // Create signature
  const signingInput = `${encodedHeader}.${encodedPayload}`
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(signingInput)
    .sign(privateKey, 'base64')
  
  const encodedSignature = base64UrlEncode(Buffer.from(signature, 'base64'))
  
  return `${signingInput}.${encodedSignature}`
}

/**
 * Base64URL encoding (URL-safe base64 without padding)
 */
function base64UrlEncode(str: string | Buffer): string {
  const base64 = Buffer.from(str).toString('base64')
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

/**
 * Exchanges JWT for an access token
 */
export async function exchangeJWTForAccessToken(jwt: string): Promise<{
  access_token: string
  token_type: string
  expires_in: number
}> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token exchange failed: ${response.status} ${response.statusText} - ${error}`)
  }
  
  return response.json()
}

/**
 * Verifies service account email and delegation setup
 */
export async function verifyServiceAccountEmail(
  serviceAccountEmail: string,
  privateKey: string,
  adminEmail: string,
  domain?: string
): Promise<{
  verified: boolean
  error?: string
  details?: string
  accessToken?: string
}> {
  try {
    console.log(`Verifying service account ${serviceAccountEmail} for admin ${adminEmail} on domain ${domain}`)
    
    // Step 1: Create manual JWT
    const scopes = [
      'https://www.googleapis.com/auth/admin.directory.user',
      'https://www.googleapis.com/auth/admin.directory.domain'
    ]
    
    const jwt = createManualJWT(serviceAccountEmail, privateKey, adminEmail, scopes)
    console.log('Manual JWT created successfully')
    
    // Step 2: Exchange JWT for access token
    const tokenResponse = await exchangeJWTForAccessToken(jwt)
    console.log('Access token obtained successfully')
    
    // Step 3: Test the access token with a simple API call
    const testResponse = await fetch('https://admin.googleapis.com/admin/directory/v1/users?maxResults=1' + 
      (domain ? `&domain=${domain}` : '&customer=my_customer'), {
      headers: {
        'Authorization': `Bearer ${tokenResponse.access_token}`,
        'Content-Type': 'application/json',
      },
    })
    
    if (testResponse.ok) {
      console.log('Service account verification successful')
      return {
        verified: true,
        accessToken: tokenResponse.access_token
      }
    } else {
      const errorText = await testResponse.text()
      console.error('API test failed:', testResponse.status, errorText)
      
      let errorMessage = 'API access test failed'
      let details = ''
      
      if (testResponse.status === 401) {
        errorMessage = 'Authentication failed'
        details = 'The service account credentials are invalid or the JWT signature is incorrect'
      } else if (testResponse.status === 403) {
        errorMessage = 'Domain-wide delegation not configured'
        details = `The service account ${serviceAccountEmail} is not authorized to impersonate ${adminEmail}. Please configure domain-wide delegation in Google Admin Console.`
      } else if (testResponse.status === 404) {
        errorMessage = 'Domain not found or not accessible'
        details = `The domain ${domain} may not exist or the admin email ${adminEmail} may not have access to it`
      }
      
      return {
        verified: false,
        error: errorMessage,
        details: details
      }
    }
  } catch (error: any) {
    console.error('Service account verification failed:', error)
    
    let errorMessage = 'Service account verification failed'
    let details = error.message || 'Unknown error'
    
    if (error.message?.includes('Token exchange failed')) {
      errorMessage = 'JWT token exchange failed'
      details = 'The service account credentials may be invalid or the private key may be corrupted'
    } else if (error.message?.includes('privateKey')) {
      errorMessage = 'Private key error'
      details = 'The service account private key is invalid or corrupted'
    }
    
    return {
      verified: false,
      error: errorMessage,
      details: details
    }
  }
}

/**
 * Enhanced service account verification with detailed diagnostics
 */
export async function diagnoseServiceAccountSetup(
  serviceAccountEmail: string,
  privateKey: string,
  adminEmail: string,
  domain: string
): Promise<{
  success: boolean
  checks: Array<{
    name: string
    passed: boolean
    error?: string
    details?: string
  }>
}> {
  const checks: Array<{
    name: string
    passed: boolean
    error?: string
    details?: string
  }> = []
  
  // Check 1: Private key format
  try {
    const keyTest = crypto.createSign('RSA-SHA256')
    keyTest.update('test')
    keyTest.sign(privateKey, 'base64')
    checks.push({
      name: 'Private Key Format',
      passed: true
    })
  } catch (error: any) {
    checks.push({
      name: 'Private Key Format',
      passed: false,
      error: 'Invalid private key format',
      details: error.message
    })
  }
  
  // Check 2: JWT Creation
  try {
    const jwt = createManualJWT(serviceAccountEmail, privateKey, adminEmail, [
      'https://www.googleapis.com/auth/admin.directory.user'
    ])
    checks.push({
      name: 'JWT Creation',
      passed: true
    })
  } catch (error: any) {
    checks.push({
      name: 'JWT Creation',
      passed: false,
      error: 'Failed to create JWT',
      details: error.message
    })
    return { success: false, checks }
  }
  
  // Check 3: Token Exchange
  try {
    const jwt = createManualJWT(serviceAccountEmail, privateKey, adminEmail, [
      'https://www.googleapis.com/auth/admin.directory.user'
    ])
    const tokenResponse = await exchangeJWTForAccessToken(jwt)
    checks.push({
      name: 'Token Exchange',
      passed: true
    })
    
    // Check 4: API Access Test
    const apiTest = await fetch(`https://admin.googleapis.com/admin/directory/v1/users?maxResults=1&domain=${domain}`, {
      headers: {
        'Authorization': `Bearer ${tokenResponse.access_token}`,
        'Content-Type': 'application/json',
      },
    })
    
    if (apiTest.ok) {
      checks.push({
        name: 'API Access Test',
        passed: true
      })
    } else {
      const errorText = await apiTest.text()
      checks.push({
        name: 'API Access Test',
        passed: false,
        error: `HTTP ${apiTest.status}: ${apiTest.statusText}`,
        details: errorText
      })
    }
    
  } catch (error: any) {
    checks.push({
      name: 'Token Exchange',
      passed: false,
      error: 'Failed to exchange JWT for access token',
      details: error.message
    })
  }
  
  const allPassed = checks.every(check => check.passed)
  return { success: allPassed, checks }
}

// Cross-tenant service account verification
export async function verifyCrossTenantServiceAccount(
  serviceAccountEmail: string,
  privateKey: string,
  sourceDomain: string,
  sourceAdminEmail: string,
  targetDomain: string,
  targetAdminEmail: string
): Promise<{
  success: boolean
  sourceChecks: Array<{ name: string; passed: boolean; error?: string }>
  targetChecks: Array<{ name: string; passed: boolean; error?: string }>
  error?: string
}> {
  try {
    console.log('Starting cross-tenant service account verification')
    console.log('Source Domain:', sourceDomain, 'Admin:', sourceAdminEmail)
    console.log('Target Domain:', targetDomain, 'Admin:', targetAdminEmail)

    const sourceChecks: Array<{ name: string; passed: boolean; error?: string }> = []
    const targetChecks: Array<{ name: string; passed: boolean; error?: string }> = []

    // Verify source domain access
    console.log('Verifying source domain access...')
    try {
      const sourceJWT = createManualJWT(serviceAccountEmail, privateKey, sourceAdminEmail, [
        'https://www.googleapis.com/auth/admin.directory.user',
        'https://www.googleapis.com/auth/admin.directory.group',
        'https://www.googleapis.com/auth/admin.directory.orgunit',
        'https://www.googleapis.com/auth/admin.directory.resource.calendar',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/contacts.readonly',
        'https://www.googleapis.com/auth/contacts',
        'https://www.googleapis.com/auth/forms.body.readonly',
        'https://www.googleapis.com/auth/forms.responses.readonly',
        'https://www.googleapis.com/auth/chat.spaces.readonly',
        'https://www.googleapis.com/auth/chat.messages.readonly',
        'https://www.googleapis.com/auth/photoslibrary.readonly',
        'https://www.googleapis.com/auth/presentations.readonly',
        'https://www.googleapis.com/auth/spreadsheets.readonly'
      ])
      
      const sourceTokenResponse = await exchangeJWTForAccessToken(sourceJWT)
      sourceChecks.push({
        name: 'Source Token Exchange',
        passed: true
      })

      // Test source domain API access
      const sourceApiTest = await fetch(
        `https://admin.googleapis.com/admin/directory/v1/users?maxResults=1&domain=${sourceDomain}`,
        {
          headers: {
            'Authorization': `Bearer ${sourceTokenResponse.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (sourceApiTest.ok) {
        sourceChecks.push({
          name: 'Source API Access',
          passed: true
        })
      } else {
        const errorText = await sourceApiTest.text()
        sourceChecks.push({
          name: 'Source API Access',
          passed: false,
          error: `HTTP ${sourceApiTest.status}: ${errorText}`
        })
      }
    } catch (error) {
      sourceChecks.push({
        name: 'Source Domain Verification',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }

    // Verify target domain access
    console.log('Verifying target domain access...')
    try {
      const targetJWT = createManualJWT(serviceAccountEmail, privateKey, targetAdminEmail, [
        'https://www.googleapis.com/auth/admin.directory.user',
        'https://www.googleapis.com/auth/admin.directory.group',
        'https://www.googleapis.com/auth/admin.directory.orgunit',
        'https://www.googleapis.com/auth/admin.directory.resource.calendar',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/contacts.readonly',
        'https://www.googleapis.com/auth/contacts',
        'https://www.googleapis.com/auth/forms.body.readonly',
        'https://www.googleapis.com/auth/forms.responses.readonly',
        'https://www.googleapis.com/auth/chat.spaces.readonly',
        'https://www.googleapis.com/auth/chat.messages.readonly',
        'https://www.googleapis.com/auth/photoslibrary.readonly',
        'https://www.googleapis.com/auth/presentations.readonly',
        'https://www.googleapis.com/auth/spreadsheets.readonly'
      ])
      
      const targetTokenResponse = await exchangeJWTForAccessToken(targetJWT)
      targetChecks.push({
        name: 'Target Token Exchange',
        passed: true
      })

      // Test target domain API access
      const targetApiTest = await fetch(
        `https://admin.googleapis.com/admin/directory/v1/users?maxResults=1&domain=${targetDomain}`,
        {
          headers: {
            'Authorization': `Bearer ${targetTokenResponse.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (targetApiTest.ok) {
        targetChecks.push({
          name: 'Target API Access',
          passed: true
        })
      } else {
        const errorText = await targetApiTest.text()
        targetChecks.push({
          name: 'Target API Access',
          passed: false,
          error: `HTTP ${targetApiTest.status}: ${errorText}`
        })
      }
    } catch (error) {
      targetChecks.push({
        name: 'Target Domain Verification',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }

    const sourceSuccess = sourceChecks.every(check => check.passed)
    const targetSuccess = targetChecks.every(check => check.passed)
    const overallSuccess = sourceSuccess && targetSuccess

    console.log('Cross-tenant verification completed:', {
      sourceSuccess,
      targetSuccess,
      overallSuccess
    })

    return {
      success: overallSuccess,
      sourceChecks,
      targetChecks
    }

  } catch (error) {
    console.error('Cross-tenant verification error:', error)
    return {
      success: false,
      sourceChecks: [],
      targetChecks: [],
      error: error instanceof Error ? error.message : 'Unknown error during cross-tenant verification'
    }
  }
}

// Domain management functions
export async function listDomains(credentials: GoogleWorkspaceCredentials): Promise<{
  success: boolean
  domains: GWSDomain[]
  error?: string
}> {
  try {
    const auth = new google.auth.OAuth2()
    auth.setCredentials({
      access_token: credentials.accessToken,
      refresh_token: credentials.refreshToken
    })

    const admin = google.admin({ version: 'directory_v1', auth })
    
    const response = await admin.domains.list({
      customer: 'my_customer'
    })

    return {
      success: true,
      domains: response.data.domains?.map(domain => ({
        domainName: domain.domainName || '',
        verified: domain.verified || false,
        isPrimary: domain.isPrimary || false,
        creationTime: domain.creationTime || '',
        aliases: domain.domainAliases?.map(alias => alias.domainAliasName || '') || []
      })) || []
    }
  } catch (error: any) {
    console.error('Error listing domains:', error)
    return {
      success: false,
      error: error.message || 'Failed to list domains',
      domains: []
    }
  }
}

export class GoogleWorkspaceService {
  private jwtClient: JWT
  private accessToken: string

  constructor(credentials: GoogleWorkspaceCredentials | ServiceAccountCredentials, isServiceAccount: boolean = false) {
    if (isServiceAccount) {
      const serviceAccountCreds = credentials as ServiceAccountCredentials
      
      // Ensure we have all required fields
      if (!serviceAccountCreds.clientEmail || !serviceAccountCreds.privateKey || !serviceAccountCreds.subjectEmail) {
        throw new Error('Missing required service account credentials: clientEmail, privateKey, or subjectEmail')
      }
      
      console.log(`Creating service account JWT for subject: ${serviceAccountCreds.subjectEmail}`)
      
      this.jwtClient = new google.auth.JWT({
        email: serviceAccountCreds.clientEmail,
        key: serviceAccountCreds.privateKey.replace(/\\n/g, '\n'), // Ensure proper newline formatting
        scopes: [
          'https://www.googleapis.com/auth/admin.directory.user',
          'https://www.googleapis.com/auth/admin.directory.domain',
          'https://www.googleapis.com/auth/admin.directory.group',
          'https://www.googleapis.com/auth/admin.directory.resource.calendar',
          'https://www.googleapis.com/auth/admin.directory.orgunit',
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/gmail.modify',
          'https://www.googleapis.com/auth/drive.readonly',
          'https://www.googleapis.com/auth/drive.file',
          'https://www.googleapis.com/auth/calendar.readonly',
          'https://www.googleapis.com/auth/contacts.readonly'
        ],
        subject: serviceAccountCreds.subjectEmail // This is the admin email to impersonate
      })
      this.accessToken = ''
    } else {
      // Fallback to OAuth2 for backward compatibility
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.NEXTAUTH_URL + '/api/auth/callback/google'
      )
      
      const oauthCreds = credentials as GoogleWorkspaceCredentials
      oauth2Client.setCredentials({
        access_token: oauthCreds.accessToken,
        refresh_token: oauthCreds.refreshToken,
        expiry_date: oauthCreds.expiryDate,
      })
      
      this.jwtClient = oauth2Client as any
      this.accessToken = oauthCreds.accessToken
    }
  }

  // Test connection to verify domain-wide delegation is working
  async testConnection(domain?: string): Promise<boolean> {
    try {
      // For service account authentication, use manual verification
      if (this.jwtClient instanceof JWT && this.jwtClient.email && this.jwtClient.key && this.jwtClient.subject) {
        console.log(`Using manual JWT verification for service account ${this.jwtClient.email}`)
        
        const verification = await verifyServiceAccountEmail(
          this.jwtClient.email,
          this.jwtClient.key as string,
          this.jwtClient.subject,
          domain
        )
        
        if (verification.verified) {
          console.log('Manual JWT verification successful')
          return true
        } else {
          throw new Error(`${verification.error}: ${verification.details}`)
        }
      }
      
      // Fallback to standard Google Auth Library approach
      const admin = google.admin({ version: 'directory_v1', auth: this.jwtClient })
      
      // Try multiple approaches to test delegation
      
      // First, try to get domain info (lighter than user list)
      try {
        const domainResponse = await admin.domains.list({
          customer: 'my_customer'
        })
        console.log(`Successfully tested delegation via domains API for ${domain || 'customer'}`)
        return true
      } catch (domainError: any) {
        console.log('Domain API test failed, trying user API...', domainError.message)
      }
      
      // Fallback: try to get minimal user list
      const response = await admin.users.list({
        domain,
        maxResults: 1, // Just one user to test connection
        orderBy: 'email',
        projection: 'basic'
      })
      
      console.log(`Successfully tested delegation via users API for ${domain || 'customer'}`)
      // If we get here without error, delegation is working
      return true
    } catch (error: any) {
      console.error('Test connection failed:', error)
      
      // Provide more specific error messages based on error type
      let specificError = 'Domain-wide delegation error'
      if (error.code === 401) {
        specificError = 'Authentication failed - check service account configuration'
      } else if (error.code === 403) {
        specificError = 'Insufficient permissions - verify domain-wide delegation and scopes'
      } else if (error.code === 404) {
        specificError = 'Domain not found or not accessible'
      } else if (error.message?.includes('delegation')) {
        specificError = 'Domain-wide delegation not properly configured'
      }
      
      throw new Error(`${specificError}: ${error.message}`)
    }
  }

  // Admin Directory API - Users with optimized performance
  async getUsers(domain?: string, maxResults: number = 100): Promise<GWSUser[]> {
    try {
      const admin = google.admin({ version: 'directory_v1', auth: this.jwtClient })
      
      // Optimize API call with specific fields to reduce response size
      const response = await admin.users.list({
        domain,
        maxResults: Math.min(maxResults, 200), // Cap at 200 for performance
        orderBy: 'email',
        fields: 'users(id,primaryEmail,name(givenName,familyName,fullName),isAdmin,isDelegatedAdmin,lastLoginTime,creationTime,suspended,orgUnitPath),nextPageToken',
        projection: 'basic' // Use basic projection for faster response
      })

      return response.data.users?.map(user => ({
        id: user.id!,
        primaryEmail: user.primaryEmail!,
        name: {
          givenName: user.name?.givenName || '',
          familyName: user.name?.familyName || '',
          fullName: user.name?.fullName || '',
        },
        isAdmin: user.isAdmin || false,
        isDelegatedAdmin: user.isDelegatedAdmin || false,
        lastLoginTime: user.lastLoginTime || undefined,
        creationTime: user.creationTime!,
        suspended: user.suspended || false,
        orgUnitPath: user.orgUnitPath || '/',
      })) || []
    } catch (error: any) {
      console.error('Error fetching users:', error)
      
      // Preserve original error details for proper error handling upstream
      if (error?.response?.data?.error === 'unauthorized_client' || 
          error?.response?.data?.error === 'invalid_grant' ||
          error?.message?.includes('unauthorized_client') ||
          error?.message?.includes('invalid_grant') ||
          error?.code === 401 || error?.code === 400) {
        // Re-throw with original error information preserved
        const delegationError = new Error(`Domain-wide delegation error: ${error?.response?.data?.error || error?.message || 'unauthorized_client'}`)
        delegationError.cause = error
        throw delegationError
      }
      
      throw new Error('Failed to fetch users from Google Workspace')
    }
  }

  // Enhanced method for bulk user enumeration - ideal for migration automation
  async getAllUsers(domain?: string, options?: {
    includeSuspended?: boolean
    includeArchived?: boolean
    orgUnitPath?: string
    onProgress?: (users: GWSUser[], total: number) => void
  }): Promise<GWSUser[]> {
    try {
      const admin = google.admin({ version: 'directory_v1', auth: this.jwtClient })
      const allUsers: GWSUser[] = []
      let nextPageToken: string | undefined
      let totalFetched = 0

      do {
        const response = await admin.users.list({
          domain,
          maxResults: 500, // Maximum allowed by API
          orderBy: 'email',
          pageToken: nextPageToken,
          query: options?.orgUnitPath ? `orgUnitPath='${options.orgUnitPath}'` : undefined,
          showDeleted: options?.includeArchived ? 'true' : undefined,
        })

        const users = response.data.users?.map(user => ({
          id: user.id!,
          primaryEmail: user.primaryEmail!,
          name: {
            givenName: user.name?.givenName || '',
            familyName: user.name?.familyName || '',
            fullName: user.name?.fullName || '',
          },
          isAdmin: user.isAdmin || false,
          isDelegatedAdmin: user.isDelegatedAdmin || false,
          lastLoginTime: user.lastLoginTime || undefined,
          creationTime: user.creationTime!,
          suspended: user.suspended || false,
          orgUnitPath: user.orgUnitPath || '/',
        })) || []

        // Filter suspended users if not requested
        const filteredUsers = options?.includeSuspended 
          ? users 
          : users.filter(user => !user.suspended)

        allUsers.push(...filteredUsers)
        totalFetched += filteredUsers.length

        // Call progress callback if provided
        if (options?.onProgress) {
          options.onProgress(filteredUsers, totalFetched)
        }

        nextPageToken = response.data.nextPageToken || undefined

        // Small delay to avoid rate limiting
        if (nextPageToken) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }

      } while (nextPageToken)

      return allUsers
    } catch (error: any) {
      console.error('Error fetching all users:', error)
      
      // Preserve original error details for proper error handling upstream
      if (error?.response?.data?.error === 'unauthorized_client' || 
          error?.response?.data?.error === 'invalid_grant' ||
          error?.message?.includes('unauthorized_client') ||
          error?.message?.includes('invalid_grant') ||
          error?.code === 401 || error?.code === 400) {
        // Re-throw with original error information preserved
        const delegationError = new Error(`Domain-wide delegation error: ${error?.response?.data?.error || error?.message || 'unauthorized_client'}`)
        delegationError.cause = error
        throw delegationError
      }
      
      throw new Error('Failed to fetch all users from Google Workspace')
    }
  }

  async getUser(userKey: string): Promise<GWSUser | null> {
    try {
      const admin = google.admin({ version: 'directory_v1', auth: this.jwtClient })
      
      const response = await admin.users.get({ userKey })
      const user = response.data

      return {
        id: user.id!,
        primaryEmail: user.primaryEmail!,
        name: {
          givenName: user.name?.givenName || '',
          familyName: user.name?.familyName || '',
          fullName: user.name?.fullName || '',
        },
        isAdmin: user.isAdmin || false,
        isDelegatedAdmin: user.isDelegatedAdmin || false,
        lastLoginTime: user.lastLoginTime || undefined,
        creationTime: user.creationTime!,
        suspended: user.suspended || false,
        orgUnitPath: user.orgUnitPath || '/',
      }
    } catch (error) {
      console.error('Error fetching user:', error)
      return null
    }
  }

  // Create a new user in Google Workspace
  async createUser(userData: {
    primaryEmail: string;
    name: {
      givenName: string;
      familyName: string;
    };
    password: string;
    changePasswordAtNextLogin?: boolean;
    orgUnitPath?: string;
    suspended?: boolean;
  }): Promise<GWSUser> {
    try {
      const admin = google.admin({ version: 'directory_v1', auth: this.jwtClient })
      
      const response = await admin.users.insert({
        requestBody: {
          primaryEmail: userData.primaryEmail,
          name: {
            givenName: userData.name.givenName,
            familyName: userData.name.familyName,
            fullName: `${userData.name.givenName} ${userData.name.familyName}`.trim()
          },
          password: userData.password,
          changePasswordAtNextLogin: userData.changePasswordAtNextLogin !== undefined ? userData.changePasswordAtNextLogin : true,
          orgUnitPath: userData.orgUnitPath || '/',
          suspended: userData.suspended || false
        }
      })

      const user = response.data

      return {
        id: user.id!,
        primaryEmail: user.primaryEmail!,
        name: {
          givenName: user.name?.givenName || '',
          familyName: user.name?.familyName || '',
          fullName: user.name?.fullName || '',
        },
        isAdmin: user.isAdmin || false,
        isDelegatedAdmin: user.isDelegatedAdmin || false,
        lastLoginTime: user.lastLoginTime || undefined,
        creationTime: user.creationTime!,
        suspended: user.suspended || false,
        orgUnitPath: user.orgUnitPath || '/',
      }
    } catch (error: any) {
      console.error('Error creating user:', error)
      
      // Handle specific error cases
      if (error?.response?.data?.error?.errors) {
        const errors = error.response.data.error.errors
        const errorMessages = errors.map((err: any) => err.message || err.reason).join(', ')
        throw new Error(`Failed to create user: ${errorMessages}`)
      }
      
      throw new Error(`Failed to create user: ${error.message || 'Unknown error'}`)
    }
  }

  // Admin Directory API - Domains (with optimizations)
  async getDomains(): Promise<GWSDomain[]> {
    try {
      const admin = google.admin({ version: 'directory_v1', auth: this.jwtClient })
      
      // Add timeout to the request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      try {
        const response = await admin.domains.list({
          customer: 'my_customer',
          // Add request options for better performance
          fields: 'domains(domainName,isPrimary,verified,creationTime)', // Only fetch needed fields
        });
        
        clearTimeout(timeoutId);
        
        return response.data.domains?.map(domain => ({
          domainName: domain.domainName!,
          isPrimary: domain.isPrimary || false,
          verified: domain.verified || false,
          creationTime: domain.creationTime!,
        })) || []
      } catch (error: any) {
        clearTimeout(timeoutId);
        throw error;
      }
    } catch (error: any) {
      console.error('Error fetching domains:', error);
      
      // Provide more specific error messages
      if (error.code === 401) {
        throw new Error('Authentication failed. Please check your Google Workspace permissions.');
      } else if (error.code === 403) {
        throw new Error('Access denied. Please ensure you have domain administrator privileges.');
      } else if (error.name === 'AbortError') {
        throw new Error('Domain fetch request timed out. Please try again.');
      } else {
        throw new Error(`Failed to fetch domains: ${error.message || 'Unknown error'}`);
      }
    }
  }

  // Gmail API
  async getGmailMessages(userId: string, maxResults: number = 10) {
    try {
      const gmail = google.gmail({ version: 'v1', auth: this.jwtClient })
      
      const response = await gmail.users.messages.list({
        userId,
        maxResults,
        q: 'in:inbox',
      })

      return response.data.messages || []
    } catch (error) {
      console.error('Error fetching Gmail messages:', error)
      throw new Error('Failed to fetch Gmail messages')
    }
  }

  // Google Drive API
  async getDriveFiles(userId?: string, maxResults: number = 100) {
    try {
      const drive = google.drive({ version: 'v3', auth: this.jwtClient })
      
      const response = await drive.files.list({
        pageSize: maxResults,
        fields: 'nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, owners)',
        q: userId ? `'${userId}' in owners` : undefined,
      })

      return response.data.files || []
    } catch (error) {
      console.error('Error fetching Drive files:', error)
      throw new Error('Failed to fetch Google Drive files')
    }
  }

  // Google Calendar API
  async getCalendars() {
    try {
      const calendar = google.calendar({ version: 'v3', auth: this.jwtClient })
      
      const response = await calendar.calendarList.list()

      return response.data.items || []
    } catch (error) {
      console.error('Error fetching calendars:', error)
      throw new Error('Failed to fetch Google Calendars')
    }
  }

  // People API (Contacts)
  async getContacts(maxResults: number = 100) {
    try {
      const people = google.people({ version: 'v1', auth: this.jwtClient })
      
      const response = await people.people.connections.list({
        resourceName: 'people/me',
        pageSize: maxResults,
        personFields: 'names,emailAddresses,phoneNumbers',
      })

      return response.data.connections || []
    } catch (error) {
      console.error('Error fetching contacts:', error)
      throw new Error('Failed to fetch Google Contacts')
    }
  }

  // Validation and health check
  async validateAccess(): Promise<{ valid: boolean; error?: string; details?: string }> {
    try {
      const admin = google.admin({ version: 'directory_v1', auth: this.jwtClient })
      await admin.users.list({ maxResults: 1 })
      return { valid: true }
    } catch (error: any) {
      console.error('Access validation failed:', error)
      
      let errorMessage = 'Unknown error'
      let details = ''
      
      if (error.code === 400) {
        errorMessage = 'Bad Request - API access issue'
        details = 'This usually means the Google Workspace Admin SDK API is not enabled or the user lacks admin permissions'
      } else if (error.code === 401) {
        errorMessage = 'Unauthorized - Authentication issue'
        details = 'Please sign in with a Google Workspace Super Admin account'
      } else if (error.code === 403) {
        errorMessage = 'Forbidden - Insufficient permissions'
        details = 'Your account needs Super Admin privileges in Google Workspace'
      } else if (error.code === 404) {
        errorMessage = 'Not Found - Domain or API not available'
        details = 'Check if the Google Workspace domain is correctly configured'
      } else {
        errorMessage = error.message || 'API access failed'
        details = 'Please check your Google Workspace configuration and permissions'
      }
      
      return { valid: false, error: errorMessage, details }
    }
  }

  // Get organization info
  async getOrganizationInfo() {
    try {
      const admin = google.admin({ version: 'directory_v1', auth: this.jwtClient })
      
      const [domainsResponse, orgUnitsResponse] = await Promise.all([
        admin.domains.list({ customer: 'my_customer' }),
        admin.orgunits.list({ customerId: 'my_customer' }),
      ])

      return {
        domains: domainsResponse.data.domains || [],
        organizationUnits: orgUnitsResponse.data.organizationUnits || [],
      }
    } catch (error) {
      console.error('Error fetching organization info:', error)
      throw new Error('Failed to fetch organization information')
    }
  }
}

// Factory function to create service instance
export function createGoogleWorkspaceService(credentials: GoogleWorkspaceCredentials): GoogleWorkspaceService {
  return new GoogleWorkspaceService(credentials)
}

// Service account factory function for domain-wide delegation
export function createServiceAccountService(adminEmail: string): GoogleWorkspaceService {
  try {
    const serviceAccountKeyPath = process.env.SERVICE_ACCOUNT_KEY_PATH || './source-service-account-key.json'
    const serviceAccountDataRaw = fs.readFileSync(path.resolve(serviceAccountKeyPath), 'utf8')
    const serviceAccountData = JSON.parse(serviceAccountDataRaw)
    
    const serviceAccountCredentials: ServiceAccountCredentials = {
      clientEmail: serviceAccountData.client_email,
      privateKey: serviceAccountData.private_key,
      subjectEmail: adminEmail
    }
    
    return new GoogleWorkspaceService(serviceAccountCredentials, true)
  } catch (error) {
    console.error('Failed to create service account service:', error)
    throw new Error('Failed to initialize service account authentication')
  }
}

// Enhanced service account factory with manual verification
export async function createVerifiedServiceAccountService(
  adminEmail: string,
  domain?: string
): Promise<{
  service: GoogleWorkspaceService
  verification: {
    verified: boolean
    error?: string
    details?: string
    diagnostics?: any
  }
}> {
  try {
    const serviceAccountKeyPath = process.env.SERVICE_ACCOUNT_KEY_PATH || './source-service-account-key.json'
    const serviceAccountDataRaw = fs.readFileSync(path.resolve(serviceAccountKeyPath), 'utf8')
    const serviceAccountData = JSON.parse(serviceAccountDataRaw)
    
    // First, run manual verification
    const verification = await verifyServiceAccountEmail(
      serviceAccountData.client_email,
      serviceAccountData.private_key,
      adminEmail,
      domain
    )
    
    // Also run detailed diagnostics if verification fails
    let diagnostics
    if (!verification.verified && domain) {
      diagnostics = await diagnoseServiceAccountSetup(
        serviceAccountData.client_email,
        serviceAccountData.private_key,
        adminEmail,
        domain
      )
    }
    
    const serviceAccountCredentials: ServiceAccountCredentials = {
      clientEmail: serviceAccountData.client_email,
      privateKey: serviceAccountData.private_key,
      subjectEmail: adminEmail
    }
    
    const service = new GoogleWorkspaceService(serviceAccountCredentials, true)
    
    return {
      service,
      verification: {
        ...verification,
        diagnostics
      }
    }
  } catch (error: any) {
    console.error('Failed to create verified service account service:', error)
    return {
      service: createServiceAccountService(adminEmail), // Fallback to basic service
      verification: {
        verified: false,
        error: 'Failed to create service account',
        details: error.message
      }
    }
  }
}

// Helper to get service account client ID from key file
export function getServiceAccountClientId(): string {
  try {
    const serviceAccountKeyPath = process.env.SERVICE_ACCOUNT_KEY_PATH || './source-service-account-key.json'
    const serviceAccountDataRaw = fs.readFileSync(path.resolve(serviceAccountKeyPath), 'utf8')
    const serviceAccountData = JSON.parse(serviceAccountDataRaw)
    return serviceAccountData.client_id
  } catch (error) {
    console.error('Failed to read service account client ID:', error)
    return process.env.NEXT_PUBLIC_SERVICE_ACCOUNT_CLIENT_ID || ''
  }
}

// Direct test function for service account delegation
export async function testServiceAccountDelegation(
  adminEmail: string,
  domain: string
): Promise<{
  success: boolean
  error?: string
  details?: string
  diagnostics?: any
}> {
  try {
    const serviceAccountKeyPath = process.env.SERVICE_ACCOUNT_KEY_PATH || './source-service-account-key.json'
    const serviceAccountDataRaw = fs.readFileSync(path.resolve(serviceAccountKeyPath), 'utf8')
    const serviceAccountData = JSON.parse(serviceAccountDataRaw)
    
    console.log(`Testing service account delegation for ${adminEmail} on domain ${domain}`)
    
    // Run verification
    const verification = await verifyServiceAccountEmail(
      serviceAccountData.client_email,
      serviceAccountData.private_key,
      adminEmail,
      domain
    )
    
    if (verification.verified) {
      return {
        success: true
      }
    }
    
    // If verification failed, run diagnostics
    const diagnostics = await diagnoseServiceAccountSetup(
      serviceAccountData.client_email,
      serviceAccountData.private_key,
      adminEmail,
      domain
    )
    
    return {
      success: false,
      error: verification.error,
      details: verification.details,
      diagnostics
    }
  } catch (error: any) {
    console.error('Service account delegation test failed:', error)
    return {
      success: false,
      error: 'Test failed',
      details: error.message
    }
  }
}
