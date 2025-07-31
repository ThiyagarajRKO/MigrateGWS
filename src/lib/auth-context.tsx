'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useSession, signIn, signOut } from 'next-auth/react'
import { ExtendedSession } from '@/app/api/auth/[...nextauth]/route'
import { AuthUser } from '@/types'

interface AuthContextType {
  user: AuthUser | null
  isLoading: boolean
  isAuthenticated: boolean
  error: string | null
  signInWithGoogle: () => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  clearError: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession() as { data: ExtendedSession | null, status: string }
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<AuthUser | null>(null)

  const isLoading = status === 'loading'
  const isAuthenticated = status === 'authenticated' && !!session

  useEffect(() => {
    if (session?.user && session.accessToken) {
      setUser({
        id: session.user.email || 'unknown',
        email: session.user.email || '',
        name: session.user.name || '',
        avatar: session.user.image || undefined,
        accessToken: session.accessToken,
        refreshToken: '', // Will be handled by NextAuth
        expiresAt: 0, // Will be handled by NextAuth
        provider: 'google',
      })
      setError(null)
    } else if (session?.error) {
      setError('Authentication session expired. Please sign in again.')
      setUser(null)
    } else if (status === 'unauthenticated') {
      setUser(null)
      setError(null)
    }
  }, [session, status])

  const signInWithGoogle = async () => {
    try {
      setError(null)
      await signIn('google', { 
        callbackUrl: '/dashboard',
        redirect: false 
      })
    } catch (err) {
      setError('Failed to sign in with Google. Please try again.')
    }
  }

  const signInWithEmail = async (email: string, password: string) => {
    try {
      setError(null)
      
      // Mock email/password authentication for demo
      if (email === 'admin@demo.com' && password === 'demo123') {
        // Create a mock user session
        setUser({
          id: 'demo-user-1',
          email: 'admin@demo.com',
          name: 'Demo Administrator',
          avatar: undefined,
          accessToken: 'demo-access-token',
          refreshToken: 'demo-refresh-token',
          expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
          provider: 'email',
        })
        
        // Redirect to dashboard
        window.location.href = '/dashboard'
      } else {
        throw new Error('Invalid credentials')
      }
    } catch (err) {
      setError('Invalid email or password. Try admin@demo.com / demo123')
    }
  }

  const handleSignOut = async () => {
    try {
      setError(null)
      setUser(null)
      await signOut({ callbackUrl: '/login' })
    } catch (err) {
      setError('Failed to sign out. Please try again.')
    }
  }

  const clearError = () => {
    setError(null)
  }

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    error,
    signInWithGoogle,
    signInWithEmail,
    signOut: handleSignOut,
    clearError,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Hook for accessing Google Workspace API
export function useGoogleWorkspace() {
  const { user, isAuthenticated } = useAuth()
  
  const isGoogleAuthenticated = isAuthenticated && user?.provider === 'google' && user?.accessToken
  
  return {
    isGoogleAuthenticated,
    accessToken: user?.accessToken,
    canAccessWorkspace: isGoogleAuthenticated,
  }
}
