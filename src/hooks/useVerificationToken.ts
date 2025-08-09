import { useState, useEffect, useCallback } from 'react';

export interface UseVerificationTokenOptions {
  /** Token passed as prop (highest priority) */
  tokenProp?: string;
  /** Session storage key to read from (fallback) */
  storageKey?: string;
  /** Enable debug logging */
  debug?: boolean;
  /** Component name for debug logging */
  componentName?: string;
}

export interface UseVerificationTokenReturn {
  /** The effective verification token (from prop or storage) */
  token: string | null;
  /** Whether a token is available */
  hasToken: boolean;
  /** Source of the token: 'prop', 'storage', or 'none' */
  tokenSource: 'prop' | 'storage' | 'none';
  /** Store a token in session storage */
  storeToken: (token: string) => void;
  /** Clear token from session storage */
  clearToken: () => void;
  /** Refresh token from storage (useful when storage changes externally) */
  refreshFromStorage: () => void;
}

/**
 * Custom hook for managing verification tokens with prop/storage fallback
 * 
 * @param options Configuration options
 * @returns Token management interface
 */
export function useVerificationToken(options: UseVerificationTokenOptions = {}): UseVerificationTokenReturn {
  const {
    tokenProp,
    storageKey = 'dwd_verification_token',
    debug = false,
    componentName = 'Unknown'
  } = options;

  const [storageToken, setStorageToken] = useState<string | null>(null);

  // Load token from storage on mount and when storage key changes
  const loadFromStorage = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedToken = sessionStorage.getItem(storageKey);
        setStorageToken(storedToken);
        
        if (debug) {
          console.log(`[useVerificationToken:${componentName}] Loaded from storage:`, {
            storageKey,
            hasStoredToken: !!storedToken,
            tokenLength: storedToken?.length || 0
          });
        }
        
        return storedToken;
      } catch (error) {
        if (debug) {
          console.error(`[useVerificationToken:${componentName}] Storage load error:`, error);
        }
        return null;
      }
    }
    return null;
  }, [storageKey, debug, componentName]);

  // Load from storage on mount
  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  // Listen for storage changes (e.g., from other components)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === storageKey) {
        const newToken = e.newValue;
        setStorageToken(newToken);
        
        if (debug) {
          console.log(`[useVerificationToken:${componentName}] Storage changed:`, {
            newToken: newToken ? '***PRESENT***' : 'REMOVED',
            tokenLength: newToken?.length || 0
          });
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [storageKey, debug, componentName]);

  // Determine effective token (prop takes priority over storage)
  const effectiveToken = tokenProp || storageToken;
  const tokenSource: 'prop' | 'storage' | 'none' = tokenProp ? 'prop' : (storageToken ? 'storage' : 'none');

  // Store token in session storage
  const storeToken = useCallback((token: string) => {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(storageKey, token);
        setStorageToken(token);
        
        if (debug) {
          console.log(`[useVerificationToken:${componentName}] Token stored:`, {
            storageKey,
            tokenLength: token.length,
            tokenPreview: token.substring(0, 20) + '...'
          });
        }
      } catch (error) {
        if (debug) {
          console.error(`[useVerificationToken:${componentName}] Storage store error:`, error);
        }
      }
    }
  }, [storageKey, debug, componentName]);

  // Clear token from session storage
  const clearToken = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem(storageKey);
        setStorageToken(null);
        
        if (debug) {
          console.log(`[useVerificationToken:${componentName}] Token cleared from storage:`, {
            storageKey
          });
        }
      } catch (error) {
        if (debug) {
          console.error(`[useVerificationToken:${componentName}] Storage clear error:`, error);
        }
      }
    }
  }, [storageKey, debug, componentName]);

  // Refresh token from storage (useful when storage changes externally)
  const refreshFromStorage = useCallback(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  // Debug logging for token resolution
  useEffect(() => {
    if (debug) {
      console.log(`[useVerificationToken:${componentName}] Token resolution:`, {
        hasTokenProp: !!tokenProp,
        tokenPropLength: tokenProp?.length || 0,
        hasStorageToken: !!storageToken,
        storageTokenLength: storageToken?.length || 0,
        effectiveToken: effectiveToken ? '***PRESENT***' : 'MISSING',
        effectiveTokenLength: effectiveToken?.length || 0,
        tokenSource,
        storageKey
      });
    }
  }, [tokenProp, storageToken, effectiveToken, tokenSource, debug, componentName, storageKey]);

  return {
    token: effectiveToken,
    hasToken: !!effectiveToken,
    tokenSource,
    storeToken,
    clearToken,
    refreshFromStorage
  };
}
