'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useDomainLoadingPerformance } from './useDomainLoadingPerformance';
import cacheManager from '@/lib/cache-manager';

export interface Domain {
  domainName: string;
  isPrimary: boolean;
  verified: boolean;
  creationTime: string;
  aliases?: string[];
}

export function useDomains() {
  const { user } = useAuth();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { metrics, markStart, markSuccess, markError } = useDomainLoadingPerformance();

  const fetchDomains = async () => {
    if (!user) {
      setError('User not authenticated');
      return;
    }

    const userEmail = user.email;
    const loadingKey = `domains_${userEmail}`;
    
    // Check cache first
    const cached = cacheManager.getDomains(userEmail);
    if (cached.exists && cached.data) {
      setDomains(cached.data);
      if (!cached.isStale) {
        // Fresh cache, no need to fetch
        return;
      }
      // Stale cache, continue to fetch in background
    }

    // Prevent multiple simultaneous requests
    if (cacheManager.isLoading(loadingKey)) {
      return;
    }

    // Cancel any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    cacheManager.setLoading(loadingKey, true);
    setLoading(true);
    setError(null);
    markStart();

    try {
      const response = await fetch('/api/google-workspace?action=domains', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        signal: abortControllerRef.current.signal,
        // Add timeout for faster failure detection
        ...(AbortSignal.timeout ? { signal: AbortSignal.timeout(15000) } : {}), // 15 second timeout
      });
      
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch domains');
      }

      if (data.domains) {
        // Update cache with new data
        cacheManager.setDomains(userEmail, data.domains);
        setDomains(data.domains);
        markSuccess();
        console.log(`[Domains] Cached ${data.domains.length} domains for ${userEmail}`);
      } else {
        const errorMessage = 'No domains found in response';
        setError(errorMessage);
        markError(errorMessage);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Request was cancelled, don't update state
        return;
      }
      if (err.name === 'TimeoutError') {
        const timeoutMessage = 'Domain loading timed out. Please try again.';
        setError(timeoutMessage);
        markError(timeoutMessage);
        return;
      }
      console.error('Error fetching domains:', err);
      const errorMessage = err.message || 'Failed to fetch domains';
      setError(errorMessage);
      markError(errorMessage);
    } finally {
      cacheManager.setLoading(loadingKey, false);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchDomains();
    }

    // Cleanup function to abort any pending requests
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const clearCache = useCallback(() => {
    if (user) {
      cacheManager.invalidateDomains(user.email);
      console.log(`[Domains] Cleared cache for ${user.email}`);
    }
  }, [user]);

  const getCacheStats = useCallback(() => {
    return cacheManager.getStats();
  }, []);

  return {
    domains,
    loading,
    error,
    refetch: fetchDomains,
    metrics,
    clearCache,
    getCacheStats
  };
}

export function useUsers(domain?: string) {
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async (targetDomain?: string) => {
    if (!user) {
      setError('User not authenticated');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const url = targetDomain 
        ? `/api/google-workspace?action=users&domain=${encodeURIComponent(targetDomain)}`
        : '/api/google-workspace?action=users';
      
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch users');
      }

      if (data.users) {
        setUsers(data.users);
      } else {
        setError('No users found in response');
      }
    } catch (err: any) {
      console.error('Error fetching users:', err);
      setError(err.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && domain) {
      fetchUsers(domain);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, domain]);

  return {
    users,
    loading,
    error,
    refetch: fetchUsers
  };
}
