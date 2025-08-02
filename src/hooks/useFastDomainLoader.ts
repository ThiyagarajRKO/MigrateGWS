'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export interface Domain {
  domainName: string;
  isPrimary: boolean;
  verified: boolean;
  creationTime: string;
  aliases?: string[];
}

interface LoadingMetrics {
  startTime: number;
  connectionTime?: number;
  fetchTime?: number;
  totalTime?: number;
  retryCount: number;
  cacheHit: boolean;
}

interface UseFastDomainLoaderOptions {
  timeout?: number;
  maxRetries?: number;
  cacheTimeout?: number;
  enableMetrics?: boolean;
}

// Enhanced cache with better performance tracking
const domainCache = {
  data: null as Domain[] | null,
  timestamp: 0,
  expiryTime: 90 * 1000, // 90 seconds for faster updates
  loading: false,
  retryCount: 0,
};

export function useFastDomainLoader(options: UseFastDomainLoaderOptions = {}) {
  const {
    timeout = 12000,
    maxRetries = 2,
    cacheTimeout = 90000,
    enableMetrics = true,
  } = options;

  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingStage, setLoadingStage] = useState<'idle' | 'connecting' | 'fetching' | 'complete'>('idle');
  const [metrics, setMetrics] = useState<LoadingMetrics | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimeouts = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const loadDomains = useCallback(async (retryCount = 0): Promise<void> => {
    const startTime = Date.now();
    
    // Check cache first
    const now = Date.now();
    if (domainCache.data && (now - domainCache.timestamp) < cacheTimeout) {
      setDomains(domainCache.data);
      setLoadingStage('complete');
      if (enableMetrics) {
        setMetrics({
          startTime,
          totalTime: Date.now() - startTime,
          retryCount: 0,
          cacheHit: true,
        });
      }
      return;
    }

    // Prevent multiple simultaneous requests
    if (domainCache.loading) {
      return;
    }

    domainCache.loading = true;
    setLoading(true);
    setError(null);
    setLoadingStage('connecting');

    try {
      // Clear any existing timeouts/controllers
      clearTimeouts();

      // Set up new abort controller and timeout
      abortControllerRef.current = new AbortController();
      
      // Overall timeout
      timeoutRef.current = setTimeout(() => {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        setError('Request timed out. Please try again.');
        setLoadingStage('complete');
      }, timeout);

      // Short delay for better UX
      await new Promise(resolve => setTimeout(resolve, 100));
      setLoadingStage('fetching');

      const connectionTime = Date.now();

      const response = await fetch('/api/google-workspace?action=domains', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
        signal: abortControllerRef.current.signal,
      });

      const fetchTime = Date.now();

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.domains && Array.isArray(data.domains)) {
        // Update cache
        domainCache.data = data.domains;
        domainCache.timestamp = now;
        domainCache.retryCount = retryCount;
        
        setDomains(data.domains);
        setLoadingStage('complete');
        
        if (enableMetrics) {
          setMetrics({
            startTime,
            connectionTime: connectionTime - startTime,
            fetchTime: fetchTime - connectionTime,
            totalTime: Date.now() - startTime,
            retryCount,
            cacheHit: false,
          });
        }
      } else {
        throw new Error('Invalid response: No domains found');
      }
    } catch (err: any) {
      console.error(`Domain loading attempt ${retryCount + 1} failed:`, err);
      
      // Handle specific error types
      if (err.name === 'AbortError') {
        if (!timeoutRef.current) {
          // User cancelled, not timeout
          return;
        }
        setError('Request timed out. Please check your connection.');
      } else if (err.message?.includes('timeout')) {
        setError('Loading timed out. Please try again.');
      } else if (err.message?.includes('401') || err.message?.includes('unauthorized')) {
        setError('Authentication failed. Please sign in again.');
      } else if (err.message?.includes('403') || err.message?.includes('forbidden')) {
        setError('Access denied. Please check your permissions.');
      } else if (err.message?.includes('network') || err.message?.includes('fetch')) {
        setError('Network error. Please check your connection.');
      } else {
        setError(err.message || 'Failed to load domains');
      }

      // Retry logic
      if (retryCount < maxRetries && err.name !== 'AbortError') {
        setTimeout(() => {
          loadDomains(retryCount + 1);
        }, Math.min(1000 * (retryCount + 1), 3000)); // Exponential backoff, max 3s
        return;
      }

      setLoadingStage('complete');
    } finally {
      domainCache.loading = false;
      setLoading(false);
      clearTimeouts();
    }
  }, [timeout, maxRetries, cacheTimeout, enableMetrics, clearTimeouts]);

  // Clear cache function
  const clearCache = useCallback(() => {
    domainCache.data = null;
    domainCache.timestamp = 0;
    domainCache.retryCount = 0;
  }, []);

  // Refresh function
  const refresh = useCallback(() => {
    clearCache();
    loadDomains();
  }, [loadDomains, clearCache]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimeouts();
      domainCache.loading = false;
    };
  }, [clearTimeouts]);

  return {
    domains,
    loading,
    error,
    loadingStage,
    metrics,
    loadDomains,
    refresh,
    clearCache,
  };
}
