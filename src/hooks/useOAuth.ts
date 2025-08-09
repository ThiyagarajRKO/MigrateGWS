/**
 * Custom React Hook for OAuth Authentication with COOP-Safe Popup Management
 * 
 * This hook provides a clean interface for OAuth authentication flows while
 * handling Cross-Origin-Opener-Policy (COOP) restrictions automatically.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { createPopupManager, PopupManager, PopupManagerOptions } from '@/lib/popup-manager';

export interface OAuthConfig {
  clientId: string;
  redirectUri: string;
  scope: string;
  responseType?: string;
  accessType?: string;
  prompt?: string;
  state?: string;
}

export interface OAuthResult {
  success: boolean;
  data?: any;
  error?: string;
  code?: string;
  accessToken?: string;
  state?: string;
}

export interface UseOAuthOptions {
  onSuccess?: (result: OAuthResult) => void;
  onError?: (error: Error) => void;
  debug?: boolean;
  timeout?: number;
  autoCleanup?: boolean;
}

export interface UseOAuthReturn {
  authenticate: (config: OAuthConfig, options?: PopupManagerOptions) => Promise<OAuthResult>;
  isLoading: boolean;
  error: string | null;
  isPopupOpen: boolean;
  closePopup: () => void;
  clearError: () => void;
}

/**
 * Custom hook for OAuth authentication with COOP-safe popup management
 */
export function useOAuth(options: UseOAuthOptions = {}): UseOAuthReturn {
  const {
    onSuccess,
    onError,
    debug = process.env.NODE_ENV === 'development',
    timeout = 300000, // 5 minutes
    autoCleanup = true
  } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  
  const popupManagerRef = useRef<PopupManager | null>(null);

  // Initialize popup manager
  const getPopupManager = useCallback(() => {
    if (!popupManagerRef.current) {
      popupManagerRef.current = createPopupManager();
    }
    return popupManagerRef.current;
  }, []);

  // Cleanup popup manager
  const cleanup = useCallback(() => {
    if (popupManagerRef.current) {
      popupManagerRef.current.cleanup();
      popupManagerRef.current = null;
    }
    setIsPopupOpen(false);
    setIsLoading(false);
  }, []);

  // Auto cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoCleanup) {
        cleanup();
      }
    };
  }, [cleanup, autoCleanup]);

  /**
   * Build Google OAuth URL
   */
  const buildGoogleOAuthUrl = useCallback((config: OAuthConfig): string => {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: config.scope,
      response_type: config.responseType || 'code',
      access_type: config.accessType || 'offline',
      prompt: config.prompt || 'consent',
      ...(config.state && { state: config.state })
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }, []);

  /**
   * Parse OAuth callback URL
   */
  const parseOAuthCallback = useCallback((url: string): OAuthResult => {
    try {
      const urlObj = new URL(url);
      const params = new URLSearchParams(urlObj.search);
      const hash = new URLSearchParams(urlObj.hash.substring(1));

      // Check for error first
      const error = params.get('error') || hash.get('error');
      if (error) {
        return {
          success: false,
          error: error,
          data: {
            error,
            error_description: params.get('error_description') || hash.get('error_description'),
            error_uri: params.get('error_uri') || hash.get('error_uri')
          }
        };
      }

      // Get authorization code or access token
      const code = params.get('code') || hash.get('code');
      const accessToken = params.get('access_token') || hash.get('access_token');
      const state = params.get('state') || hash.get('state');

      if (!code && !accessToken) {
        return {
          success: false,
          error: 'No authorization code or access token received'
        };
      }

      return {
        success: true,
        code: code || undefined,
        accessToken: accessToken || undefined,
        state: state || undefined,
        data: {
          code,
          accessToken,
          state,
          tokenType: params.get('token_type') || hash.get('token_type'),
          expiresIn: params.get('expires_in') || hash.get('expires_in'),
          scope: params.get('scope') || hash.get('scope')
        }
      };
    } catch (parseError) {
      return {
        success: false,
        error: `Failed to parse OAuth callback: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`
      };
    }
  }, []);

  /**
   * Start OAuth authentication flow
   */
  const authenticate = useCallback(async (
    config: OAuthConfig, 
    popupOptions?: PopupManagerOptions
  ): Promise<OAuthResult> => {
    setIsLoading(true);
    setError(null);
    setIsPopupOpen(true);

    try {
      const authUrl = buildGoogleOAuthUrl(config);
      const popupManager = getPopupManager();

      if (debug) {
        console.log('🚀 Starting OAuth flow:', {
          clientId: config.clientId,
          scope: config.scope,
          redirectUri: config.redirectUri
        });
      }

      return new Promise<OAuthResult>((resolve, reject) => {
        popupManager.open(authUrl, {
          windowName: 'google_oauth',
          windowFeatures: 'width=600,height=700,scrollbars=yes,resizable=yes,status=yes,location=yes',
          timeout,
          debug,
          ...popupOptions,
          onSuccess: (data) => {
            if (debug) console.log('✅ OAuth popup success:', data);
            const result: OAuthResult = { success: true, data };
            if (onSuccess) onSuccess(result);
            cleanup();
            resolve(result);
          },
          onError: (popupError) => {
            if (debug) console.log('❌ OAuth popup error:', popupError.message);
            const result: OAuthResult = { 
              success: false, 
              error: popupError.message 
            };
            setError(popupError.message);
            if (onError) onError(popupError);
            cleanup();
            reject(popupError);
          },
          onTimeout: () => {
            const timeoutError = new Error('OAuth authentication timeout');
            if (debug) console.log('⏰ OAuth popup timeout');
            setError('Authentication timeout - please try again');
            if (onError) onError(timeoutError);
            cleanup();
            reject(timeoutError);
          },
          onMessage: (event) => {
            if (debug) {
              console.log('📨 OAuth popup message:', {
                origin: event.origin,
                data: event.data
              });
            }

            // Handle OAuth callback messages
            if (event.data?.type === 'oauth_callback' && event.data?.url) {
              const result = parseOAuthCallback(event.data.url);
              
              if (result.success) {
                if (debug) console.log('✅ OAuth callback success:', result);
                if (onSuccess) onSuccess(result);
                cleanup();
                resolve(result);
              } else {
                if (debug) console.log('❌ OAuth callback error:', result.error);
                const callbackError = new Error(result.error || 'OAuth callback failed');
                setError(result.error || 'Authentication failed');
                if (onError) onError(callbackError);
                cleanup();
                reject(callbackError);
              }
            }
          }
        });
      });

    } catch (authError) {
      const errorMessage = authError instanceof Error ? authError.message : 'Authentication failed';
      setError(errorMessage);
      setIsLoading(false);
      setIsPopupOpen(false);
      
      if (onError && authError instanceof Error) {
        onError(authError);
      }
      
      throw authError;
    }
  }, [buildGoogleOAuthUrl, getPopupManager, parseOAuthCallback, cleanup, onSuccess, onError, debug, timeout]);

  /**
   * Close popup manually
   */
  const closePopup = useCallback(() => {
    if (popupManagerRef.current) {
      popupManagerRef.current.close();
    }
    cleanup();
  }, [cleanup]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    authenticate,
    isLoading,
    error,
    isPopupOpen,
    closePopup,
    clearError
  };
}

/**
 * Utility function for simple Google OAuth authentication
 */
export async function authenticateWithGoogle(
  config: OAuthConfig,
  options?: UseOAuthOptions & PopupManagerOptions
): Promise<OAuthResult> {
  const popupManager = createPopupManager();
  
  try {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: config.scope,
      response_type: config.responseType || 'code',
      access_type: config.accessType || 'offline',
      prompt: config.prompt || 'consent',
      ...(config.state && { state: config.state })
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    return new Promise<OAuthResult>((resolve, reject) => {
      popupManager.open(authUrl, {
        windowName: 'google_oauth',
        windowFeatures: 'width=600,height=700,scrollbars=yes,resizable=yes,status=yes,location=yes',
        timeout: options?.timeout || 300000,
        debug: options?.debug || process.env.NODE_ENV === 'development',
        ...options,
        onSuccess: (data) => resolve({ success: true, data }),
        onError: (error) => reject(error),
        onTimeout: () => reject(new Error('OAuth authentication timeout'))
      });
    });
  } finally {
    popupManager.cleanup();
  }
}

export default useOAuth;
