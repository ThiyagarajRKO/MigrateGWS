import { useState, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'

interface UseGoogleWorkspaceAPIResult<T> {
  data: T | null
  loading: boolean
  error: string | null
  execute: (...args: any[]) => Promise<T | null>
  reset: () => void
}

export function useGoogleWorkspaceAPI<T = any>(): UseGoogleWorkspaceAPIResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { isAuthenticated } = useAuth()

  const execute = useCallback(async (endpoint: string, options: RequestInit = {}): Promise<T | null> => {
    if (!isAuthenticated) {
      setError('Not authenticated')
      return null
    }

    setLoading(true)
    setError(null)

    try {
      // Add timeout to prevent long waits (increased for slow connections)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch(`/api/google-workspace${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
        ...options,
      })

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const result = await response.json()
      setData(result)
      return result
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        const errorMessage = 'Request timed out. Please check your Google Workspace configuration.'
        setError(errorMessage)
      } else {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
        setError(errorMessage)
      }
      return null
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  const reset = useCallback(() => {
    setData(null)
    setError(null)
    setLoading(false)
  }, [])

  return { data, loading, error, execute, reset }
}

// Specific hooks for common operations
export function useGetUsers() {
  const api = useGoogleWorkspaceAPI()
  
  const getUsers = useCallback(async (domain?: string) => {
    const query = domain ? `?action=users&domain=${encodeURIComponent(domain)}` : '?action=users'
    return await api.execute(query)
  }, [api])

  return { ...api, getUsers }
}

export function useGetDomains() {
  const api = useGoogleWorkspaceAPI()
  
  const getDomains = useCallback(async () => {
    return await api.execute('?action=domains')
  }, [api])

  return { ...api, getDomains }
}

export function useValidateAccess() {
  const api = useGoogleWorkspaceAPI()
  
  const validateAccess = useCallback(async () => {
    return await api.execute('?action=validate')
  }, [api])

  return { ...api, validateAccess }
}

export function useGetOrganization() {
  const api = useGoogleWorkspaceAPI()
  
  const getOrganization = useCallback(async () => {
    return await api.execute('?action=organization')
  }, [api])

  return { ...api, getOrganization }
}

export function useTestMigration() {
  const api = useGoogleWorkspaceAPI()
  
  const testMigration = useCallback(async (migrationData: any) => {
    return await api.execute('', {
      method: 'POST',
      body: JSON.stringify({
        action: 'test-migration',
        data: migrationData,
      }),
    })
  }, [api])

  return { ...api, testMigration }
}
