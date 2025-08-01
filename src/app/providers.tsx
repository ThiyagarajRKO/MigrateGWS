'use client'

import { SessionProvider } from 'next-auth/react'
import { AuthProvider } from '@/lib/auth-context'
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
          refetchInterval={5 * 60} // Refetch session every 5 minutes
          refetchOnWindowFocus={true}
        >
          <AuthProvider>
            {children}
          </AuthProvider>
        </SessionProvider>
      </ClientOnly>
    </ErrorBoundary>
  )
}
