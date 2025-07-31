'use client'

import { useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { Database } from 'lucide-react'

interface ProtectedRouteProps {
  children: React.ReactNode
  requireGoogle?: boolean
}

export function ProtectedRoute({ children, requireGoogle = false }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = '/login'
    }
  }, [isAuthenticated, isLoading])

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Database className="h-12 w-12 text-blue-600 mx-auto mb-4 animate-pulse" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading...</h2>
          <p className="text-gray-600">Checking authentication status</p>
        </div>
      </div>
    )
  }

  // Redirect if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Database className="h-12 w-12 text-blue-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Redirecting...</h2>
          <p className="text-gray-600">Please wait while we redirect you to sign in</p>
        </div>
      </div>
    )
  }

  // Check if Google Workspace authentication is required
  if (requireGoogle && user?.provider !== 'google') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <Database className="h-12 w-12 text-blue-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Google Workspace Required</h2>
          <p className="text-gray-600 mb-6">
            This feature requires Google Workspace authentication to access Google APIs. 
            Please sign in with your Google Workspace account.
          </p>
          <button
            onClick={() => window.location.href = '/login'}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium"
          >
            Sign in with Google Workspace
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

// Higher-order component version
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  requireGoogle = false
) {
  return function AuthenticatedComponent(props: P) {
    return (
      <ProtectedRoute requireGoogle={requireGoogle}>
        <Component {...props} />
      </ProtectedRoute>
    )
  }
}
