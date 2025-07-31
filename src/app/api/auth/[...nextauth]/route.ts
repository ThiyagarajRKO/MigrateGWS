import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { JWT } from 'next-auth/jwt'
import { Session } from 'next-auth'

export interface ExtendedToken extends JWT {
  accessToken?: string
  refreshToken?: string
  expiresAt?: number
  error?: string
}

export interface ExtendedSession extends Session {
  accessToken?: string
  error?: string
}

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: [
            'openid',
            'email',
            'profile',
            // Google Workspace Admin SDK scopes
            'https://www.googleapis.com/auth/admin.directory.user',
            'https://www.googleapis.com/auth/admin.directory.domain',
            'https://www.googleapis.com/auth/admin.directory.group',
            // Gmail API scopes
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/gmail.modify',
            // Google Drive API scopes
            'https://www.googleapis.com/auth/drive',
            'https://www.googleapis.com/auth/drive.file',
            // Calendar API scopes
            'https://www.googleapis.com/auth/calendar',
            // Contacts API scopes
            'https://www.googleapis.com/auth/contacts',
          ].join(' '),
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, user }) {
      // Initial sign in
      if (account && user) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at,
        } as ExtendedToken
      }

      // Return previous token if the access token has not expired yet
      const extendedToken = token as ExtendedToken
      if (extendedToken.expiresAt && Date.now() < extendedToken.expiresAt * 1000) {
        return extendedToken
      }

      // Access token has expired, try to update it
      return await refreshAccessToken(extendedToken)
    },
    async session({ session, token }) {
      const extendedToken = token as ExtendedToken
      const extendedSession = session as ExtendedSession
      
      extendedSession.accessToken = extendedToken.accessToken
      extendedSession.error = extendedToken.error

      return extendedSession
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
  },
})

async function refreshAccessToken(token: ExtendedToken): Promise<ExtendedToken> {
  try {
    const url = 'https://oauth2.googleapis.com/token'
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      method: 'POST',
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken!,
      }),
    })

    const tokens = await response.json()

    if (!response.ok) {
      throw tokens
    }

    return {
      ...token,
      accessToken: tokens.access_token,
      expiresAt: Math.floor(Date.now() / 1000 + tokens.expires_in),
      refreshToken: tokens.refresh_token ?? token.refreshToken,
    }
  } catch (error) {
    console.error('Error refreshing access token:', error)

    return {
      ...token,
      error: 'RefreshAccessTokenError',
    }
  }
}

export { handler as GET, handler as POST }
