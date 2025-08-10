'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useSession, signIn, signOut } from 'next-auth/react'
import { ExtendedSession } from '@/lib/auth-options'
import { AuthUser } from '@/types'
import cacheManager from '@/lib/cache-manager'

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
  const { data: session, status, error: sessionError } = useSession() as { 
    data: ExtendedSession | null, 
    status: string,
    error?: string 
  }
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<AuthUser | null>(null)

  const isLoading = status === 'loading'
  const isAuthenticated = status === 'authenticated' && !!session

  useEffect(() => {
    // Handle session errors
    if (sessionError) {
      console.warn('NextAuth session error:', sessionError)
      setError('Authentication service temporarily unavailable. Please try again.')
      setUser(null)
      return
    }

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
  }, [session, status, sessionError])

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
      
      // Clear all cached data AND persistent domain authentication tokens on explicit logout
      // Note: Domain authentication tokens are kept in localStorage during normal session
      // to persist until user explicitly logs out or closes browser session
      cacheManager.clearAll()
      
      // Clear domain authentication tokens from localStorage
      if (typeof window !== 'undefined') {
        const keysToRemove = []
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key && (
            key.startsWith('dwd_verification_token') ||
            key.startsWith('gws-verification-status') ||
            key.startsWith('gws-admin-tokens') ||
            key.startsWith('gws-admin-info')
          )) {
            keysToRemove.push(key)
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key))
        console.log('[Auth] Cleared persistent domain authentication tokens on logout:', keysToRemove)
      }
      
      console.log('[Auth] Cleared all caches and persistent tokens on logout')
      
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
