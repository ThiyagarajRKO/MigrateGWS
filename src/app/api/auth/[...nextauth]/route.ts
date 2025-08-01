import NextAuth from 'next-auth'
import { authOptions } from '../../../../lib/auth-options'

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }

// Re-export the types for other files to use
export type { ExtendedToken, ExtendedSession } from '@/lib/auth-options'
