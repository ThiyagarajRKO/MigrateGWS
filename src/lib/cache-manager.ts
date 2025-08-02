'use client'

import { GWSUser } from '@/types'
import { Domain } from '@/hooks/useGoogleWorkspaceDomains'

// Cache interface for type safety
interface CacheEntry<T> {
  data: T
  timestamp: number
  expiryTime: number
  key: string
}

interface UserCacheEntry extends CacheEntry<GWSUser[]> {
  domain?: string
  adminEmail?: string
  count: number
  metadata?: any
}

interface DomainCacheEntry extends CacheEntry<Domain[]> {
  userEmail?: string
}

// Cache durations (in milliseconds)
const CACHE_DURATIONS = {
  DOMAINS: 5 * 60 * 1000, // 5 minutes
  USERS: 10 * 60 * 1000, // 10 minutes
  STALE_DOMAINS: 30 * 60 * 1000, // 30 minutes for stale cache
  STALE_USERS: 60 * 60 * 1000, // 1 hour for stale cache
} as const

// Global cache storage
class CacheManager {
  private domainsCache = new Map<string, DomainCacheEntry>()
  private usersCache = new Map<string, UserCacheEntry>()
  private loadingStates = new Map<string, boolean>()

  // Domain caching
  getDomains(userEmail: string): { data: Domain[] | null; isStale: boolean; exists: boolean } {
    const key = `domains_${userEmail}`
    const cached = this.domainsCache.get(key)
    
    if (!cached) {
      return { data: null, isStale: false, exists: false }
    }

    const now = Date.now()
    const age = now - cached.timestamp
    
    // Check if cache is still fresh
    if (age < cached.expiryTime) {
      return { data: cached.data, isStale: false, exists: true }
    }
    
    // Check if cache is stale but still usable
    if (age < CACHE_DURATIONS.STALE_DOMAINS) {
      return { data: cached.data, isStale: true, exists: true }
    }
    
    // Cache is too old, remove it
    this.domainsCache.delete(key)
    return { data: null, isStale: false, exists: false }
  }

  setDomains(userEmail: string, domains: Domain[], customExpiryTime?: number): void {
    const key = `domains_${userEmail}`
    const expiryTime = customExpiryTime || CACHE_DURATIONS.DOMAINS
    
    this.domainsCache.set(key, {
      data: domains,
      timestamp: Date.now(),
      expiryTime,
      key,
      userEmail
    })
  }

  // User caching
  getUsers(domain: string, adminEmail?: string): { data: GWSUser[] | null; isStale: boolean; exists: boolean; metadata?: any } {
    const key = `users_${domain}_${adminEmail || 'default'}`
    const cached = this.usersCache.get(key)
    
    if (!cached) {
      return { data: null, isStale: false, exists: false }
    }

    const now = Date.now()
    const age = now - cached.timestamp
    
    // Check if cache is still fresh
    if (age < cached.expiryTime) {
      return { 
        data: cached.data, 
        isStale: false, 
        exists: true,
        metadata: { ...cached.metadata, count: cached.count, fromCache: true }
      }
    }
    
    // Check if cache is stale but still usable
    if (age < CACHE_DURATIONS.STALE_USERS) {
      return { 
        data: cached.data, 
        isStale: true, 
        exists: true,
        metadata: { ...cached.metadata, count: cached.count, fromCache: true, stale: true }
      }
    }
    
    // Cache is too old, remove it
    this.usersCache.delete(key)
    return { data: null, isStale: false, exists: false }
  }

  setUsers(domain: string, users: GWSUser[], adminEmail?: string, metadata?: any, customExpiryTime?: number): void {
    const key = `users_${domain}_${adminEmail || 'default'}`
    const expiryTime = customExpiryTime || CACHE_DURATIONS.USERS
    
    this.usersCache.set(key, {
      data: users,
      timestamp: Date.now(),
      expiryTime,
      key,
      domain,
      adminEmail,
      count: users.length,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
        cacheKey: key
      }
    })
  }

  // Loading state management
  isLoading(key: string): boolean {
    return this.loadingStates.get(key) || false
  }

  setLoading(key: string, loading: boolean): void {
    if (loading) {
      this.loadingStates.set(key, true)
    } else {
      this.loadingStates.delete(key)
    }
  }

  // Cache invalidation methods
  invalidateDomains(userEmail?: string): void {
    if (userEmail) {
      const key = `domains_${userEmail}`
      this.domainsCache.delete(key)
      this.setLoading(key, false)
    } else {
      // Clear all domain caches
      this.domainsCache.clear()
    }
  }

  invalidateUsers(domain?: string, adminEmail?: string): void {
    if (domain) {
      const key = `users_${domain}_${adminEmail || 'default'}`
      this.usersCache.delete(key)
      this.setLoading(key, false)
    } else {
      // Clear all user caches
      this.usersCache.clear()
    }
  }

  // Clear all caches (useful for logout)
  clearAll(): void {
    this.domainsCache.clear()
    this.usersCache.clear()
    this.loadingStates.clear()
    console.log('[CacheManager] All caches cleared')
  }

  // Get cache statistics
  getStats(): {
    domains: { count: number; keys: string[] }
    users: { count: number; keys: string[] }
    loading: { count: number; keys: string[] }
  } {
    return {
      domains: {
        count: this.domainsCache.size,
        keys: Array.from(this.domainsCache.keys())
      },
      users: {
        count: this.usersCache.size,
        keys: Array.from(this.usersCache.keys())
      },
      loading: {
        count: this.loadingStates.size,
        keys: Array.from(this.loadingStates.keys())
      }
    }
  }

  // Cleanup expired entries
  cleanup(): void {
    const now = Date.now()
    
    // Cleanup domains
    this.domainsCache.forEach((entry, key) => {
      if (now - entry.timestamp > CACHE_DURATIONS.STALE_DOMAINS) {
        this.domainsCache.delete(key)
      }
    })
    
    // Cleanup users
    this.usersCache.forEach((entry, key) => {
      if (now - entry.timestamp > CACHE_DURATIONS.STALE_USERS) {
        this.usersCache.delete(key)
      }
    })
  }
}

// Singleton instance
const cacheManager = new CacheManager()

// Auto cleanup every 15 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    cacheManager.cleanup()
  }, 15 * 60 * 1000)
}

export default cacheManager
export { CACHE_DURATIONS }
export type { CacheEntry, UserCacheEntry, DomainCacheEntry }
