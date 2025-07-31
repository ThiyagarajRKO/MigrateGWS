import { google } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'

export interface GoogleWorkspaceCredentials {
  accessToken: string
  refreshToken?: string
  expiryDate?: number
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
  private oauth2Client: OAuth2Client
  private accessToken: string

  constructor(credentials: GoogleWorkspaceCredentials) {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.NEXTAUTH_URL + '/api/auth/callback/google'
    )
    
    this.oauth2Client.setCredentials({
      access_token: credentials.accessToken,
      refresh_token: credentials.refreshToken,
      expiry_date: credentials.expiryDate,
    })
    
    this.accessToken = credentials.accessToken
  }

  // Admin Directory API - Users
  async getUsers(domain?: string, maxResults: number = 100): Promise<GWSUser[]> {
    try {
      const admin = google.admin({ version: 'directory_v1', auth: this.oauth2Client })
      
      const response = await admin.users.list({
        domain,
        maxResults,
        orderBy: 'email',
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
    } catch (error) {
      console.error('Error fetching users:', error)
      throw new Error('Failed to fetch users from Google Workspace')
    }
  }

  async getUser(userKey: string): Promise<GWSUser | null> {
    try {
      const admin = google.admin({ version: 'directory_v1', auth: this.oauth2Client })
      
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

  // Admin Directory API - Domains
  async getDomains(): Promise<GWSDomain[]> {
    try {
      const admin = google.admin({ version: 'directory_v1', auth: this.oauth2Client })
      
      const response = await admin.domains.list({
        customer: 'my_customer',
      })

      return response.data.domains?.map(domain => ({
        domainName: domain.domainName!,
        isPrimary: domain.isPrimary || false,
        verified: domain.verified || false,
        creationTime: domain.creationTime!,
      })) || []
    } catch (error) {
      console.error('Error fetching domains:', error)
      throw new Error('Failed to fetch domains from Google Workspace')
    }
  }

  // Gmail API
  async getGmailMessages(userId: string, maxResults: number = 10) {
    try {
      const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client })
      
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
      const drive = google.drive({ version: 'v3', auth: this.oauth2Client })
      
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
      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client })
      
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
      const people = google.people({ version: 'v1', auth: this.oauth2Client })
      
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
  async validateAccess(): Promise<boolean> {
    try {
      const admin = google.admin({ version: 'directory_v1', auth: this.oauth2Client })
      await admin.users.list({ maxResults: 1 })
      return true
    } catch (error) {
      console.error('Access validation failed:', error)
      return false
    }
  }

  // Get organization info
  async getOrganizationInfo() {
    try {
      const admin = google.admin({ version: 'directory_v1', auth: this.oauth2Client })
      
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
