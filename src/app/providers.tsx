'use client'

import { SessionProvider } from 'next-auth/react'
import { AuthProvider } from '@/lib/auth-context'
import { CrossTenantAuthProvider } from '@/lib/cross-tenant-auth-context'
import ErrorBoundary from '@/components/ErrorBoundary'
import ClientOnly from '@/components/ClientOnly'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <ClientOnly fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>}>
        <SessionProvider 
          basePath="/api/auth"
          refetchInterval={30 * 60} // Refetch session every 30 minutes instead of 5
          refetchOnWindowFocus={false} // Don't refetch on window focus to avoid interruptions
          refetchWhenOffline={false}
        >
          <AuthProvider>
            <CrossTenantAuthProvider>
              {children}
            </CrossTenantAuthProvider>
          </AuthProvider>
        </SessionProvider>
      </ClientOnly>
    </ErrorBoundary>
  )
}
