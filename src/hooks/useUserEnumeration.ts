import { useState, useCallback } from 'react'
import { GWSUser } from '@/types'
import cacheManager from '@/lib/cache-manager'

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
    const { domain, adminEmail } = options;
    
    if (!domain) {
      setError({
        error: 'Missing Domain',
        message: 'Domain is required for user enumeration',
        details: ['Please specify a domain to enumerate users from']
      });
      return null;
    }

    const loadingKey = `users_${domain}_${adminEmail || 'default'}`;
    
    // Check cache first
    const cached = cacheManager.getUsers(domain, adminEmail);
    if (cached.exists && cached.data) {
      console.log(`[Users] Using cached data for ${domain} (${cached.data.length} users)`);
      
      // Simulate progress for cached data if callback provided
      if (onProgress) {
        const batchSize = Math.max(1, Math.ceil(cached.data.length / 10));
        for (let i = 0; i < cached.data.length; i += batchSize) {
          const batch = cached.data.slice(i, i + batchSize);
          setCurrentBatch(Math.floor(i / batchSize) + 1);
          setProgress(Math.min(100, Math.round(((i + batch.length) / cached.data.length) * 100)));
          onProgress(batch, i + batch.length);
          
          // Small delay for UI feedback
          if (i + batchSize < cached.data.length) {
            await new Promise(resolve => setTimeout(resolve, 25));
          }
        }
      }
      
      setProgress(100);
      return {
        users: cached.data,
        count: cached.data.length,
        metadata: cached.metadata
      };
    }

    // Prevent multiple simultaneous requests
    if (cacheManager.isLoading(loadingKey)) {
      return null;
    }

    cacheManager.setLoading(loadingKey, true);
    setLoading(true);
    setError(null);
    setProgress(0);
    setCurrentBatch(0);

    try {
      const searchParams = new URLSearchParams({
        action: 'all-users',
        domain,
        ...(adminEmail && { adminEmail }),
        ...(options.includeSuspended !== undefined && { includeSuspended: options.includeSuspended.toString() }),
        ...(options.includeArchived !== undefined && { includeArchived: options.includeArchived.toString() }),
        ...(options.orgUnitPath && { orgUnitPath: options.orgUnitPath }),
      });

      const response = await fetch(`/api/google-workspace?${searchParams.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data);
        return null;
      }

      const users = data.users || [];
      
      // Cache the users data
      const metadata = {
        domain,
        includeSuspended: options.includeSuspended || false,
        includeArchived: options.includeArchived || false,
        orgUnitPath: options.orgUnitPath,
        timestamp: new Date().toISOString(),
        fetchedAt: Date.now()
      };
      
      cacheManager.setUsers(domain, users, adminEmail, metadata);
      console.log(`[Users] Cached ${users.length} users for ${domain}`);

      // Simulate progress for UI feedback
      if (onProgress && users.length > 0) {
        const batchSize = Math.max(1, Math.ceil(users.length / 10));
        for (let i = 0; i < users.length; i += batchSize) {
          const batch = users.slice(i, i + batchSize);
          setCurrentBatch(Math.floor(i / batchSize) + 1);
          setProgress(Math.min(100, Math.round(((i + batch.length) / users.length) * 100)));
          onProgress(batch, i + batch.length);
          
          // Small delay for UI feedback
          if (i + batchSize < users.length) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        }
      }

      setProgress(100);
      
      return {
        users,
        count: users.length,
        metadata
      };

    } catch (err: any) {
      setError({
        error: 'Network Error',
        message: err.message || 'Failed to enumerate users',
        details: ['Check your network connection', 'Verify the server is running'],
        domain,
        adminEmail
      });
      return null;
    } finally {
      cacheManager.setLoading(loadingKey, false);
      setLoading(false);
    }
  }, []);

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

  const clearCache = useCallback((domain?: string, adminEmail?: string) => {
    if (domain) {
      cacheManager.invalidateUsers(domain, adminEmail)
      console.log(`[Users] Cleared cache for ${domain}${adminEmail ? ` (${adminEmail})` : ''}`)
    } else {
      cacheManager.invalidateUsers()
      console.log('[Users] Cleared all user caches')
    }
  }, [])

  const getCacheStats = useCallback(() => {
    return cacheManager.getStats()
  }, [])

  return {
    enumerateUsers,
    enumerateUsersInBatches,
    loading,
    error,
    progress,
    currentBatch,
    reset,
    clearCache,
    getCacheStats
  }
}
