import { useState, useCallback } from 'react'
import { GWSUser } from '@/types'

interface UserEnumerationOptions {
  domain?: string
  adminEmail?: string
  includeSuspended?: boolean
  includeArchived?: boolean
  orgUnitPath?: string
}

interface UserEnumerationResult {
  users: GWSUser[]
  count: number
  metadata?: {
    domain?: string
    includeSuspended: boolean
    includeArchived: boolean
    orgUnitPath?: string
    timestamp: string
  }
}

interface UserEnumerationError {
  error: string
  message: string
  details?: string[]
  actionRequired?: string
  domain?: string
  adminEmail?: string
}

export function useUserEnumeration() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<UserEnumerationError | null>(null)
  const [progress, setProgress] = useState(0)
  const [currentBatch, setCurrentBatch] = useState(0)

  const enumerateUsers = useCallback(async (
    options: UserEnumerationOptions,
    onProgress?: (users: GWSUser[], totalFetched: number) => void
  ): Promise<UserEnumerationResult | null> => {
    setLoading(true)
    setError(null)
    setProgress(0)
    setCurrentBatch(0)

    try {
      const searchParams = new URLSearchParams({
        action: 'all-users',
        ...(options.domain && { domain: options.domain }),
        ...(options.adminEmail && { adminEmail: options.adminEmail }),
        ...(options.includeSuspended !== undefined && { includeSuspended: options.includeSuspended.toString() }),
        ...(options.includeArchived !== undefined && { includeArchived: options.includeArchived.toString() }),
        ...(options.orgUnitPath && { orgUnitPath: options.orgUnitPath }),
      })

      const response = await fetch(`/api/google-workspace?${searchParams.toString()}`)
      const data = await response.json()

      if (!response.ok) {
        setError(data)
        return null
      }

      // Simulate progress for UI feedback
      if (onProgress && data.users) {
        const batchSize = Math.max(1, Math.ceil(data.users.length / 10))
        for (let i = 0; i < data.users.length; i += batchSize) {
          const batch = data.users.slice(i, i + batchSize)
          setCurrentBatch(Math.floor(i / batchSize) + 1)
          setProgress(Math.min(100, Math.round(((i + batch.length) / data.users.length) * 100)))
          onProgress(batch, i + batch.length)
          
          // Small delay for UI feedback
          if (i + batchSize < data.users.length) {
            await new Promise(resolve => setTimeout(resolve, 50))
          }
        }
      }

      setProgress(100)
      return data as UserEnumerationResult

    } catch (err: any) {
      setError({
        error: 'Network Error',
        message: err.message || 'Failed to enumerate users',
        details: ['Check your network connection', 'Verify the server is running']
      })
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const enumerateUsersInBatches = useCallback(async (
    options: UserEnumerationOptions,
    batchSize: number = 100,
    onBatch?: (batch: GWSUser[], batchNumber: number, totalFetched: number) => void
  ): Promise<UserEnumerationResult | null> => {
    // For now, use the all-users endpoint and simulate batching
    // In production, you might want to implement server-side batching
    const result = await enumerateUsers(options, (users, totalFetched) => {
      if (onBatch) {
        const batchNumber = Math.ceil(totalFetched / batchSize)
        onBatch(users, batchNumber, totalFetched)
      }
    })

    return result
  }, [enumerateUsers])

  const reset = useCallback(() => {
    setError(null)
    setProgress(0)
    setCurrentBatch(0)
  }, [])

  return {
    enumerateUsers,
    enumerateUsersInBatches,
    loading,
    error,
    progress,
    currentBatch,
    reset
  }
}
