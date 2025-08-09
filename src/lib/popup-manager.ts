/**
 * COOP-Safe Popup Manager for OAuth Authentication
 * 
 * Handles Cross-Origin-Opener-Policy (COOP) restrictions that block window.close() calls
 * and popup.closed property access in cross-origin scenarios.
 * 
 * This utility provides a robust solution for OAuth popup management that works
 * consistently across different COOP policy configurations.
 */

export interface PopupManagerOptions {
  windowName?: string;
  windowFeatures?: string;
  timeout?: number;
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
  onTimeout?: () => void;
  onMessage?: (event: MessageEvent) => void;
  debug?: boolean;
}

export interface PopupManager {
  open: (url: string, options?: PopupManagerOptions) => Promise<Window | null>;
  close: () => void;
  isOpen: () => boolean;
  waitForMessage: (expectedOrigin?: string) => Promise<any>;
  cleanup: () => void;
}

/**
 * Creates a COOP-safe popup manager that handles OAuth flows robustly
 */
export function createPopupManager(): PopupManager {
  let popup: Window | null = null;
  let messageListener: ((event: MessageEvent) => void) | null = null;
  let timeoutId: NodeJS.Timeout | null = null;
  let cleanupCallbacks: (() => void)[] = [];

  /**
   * Safely close popup without throwing COOP errors
   */
  const safeClose = (contextName: string = 'popup'): void => {
    if (!popup) return;

    try {
      // Attempt to close the popup
      popup.close();
      console.debug(`✅ Successfully closed ${contextName}`);
    } catch (error) {
      // COOP policy may prevent closing - this is expected and safe
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        if (errorMessage.includes('cross-origin') || 
            errorMessage.includes('opener-policy') || 
            errorMessage.includes('coop')) {
          console.debug(`🔒 COOP policy prevented closing ${contextName} - this is expected behavior`);
        } else {
          console.warn(`⚠️ Unexpected error closing ${contextName}:`, error.message);
        }
      }
    }
  };

  /**
   * Safely check if popup is closed without triggering COOP errors
   */
  const safeIsClosed = (): boolean => {
    if (!popup) return true;

    try {
      return popup.closed;
    } catch (error) {
      // If we can't check due to COOP policy, assume popup is still open
      // This prevents premature cleanup and allows message-based detection
      // Note: COOP warnings are expected and handled gracefully
      return false;
    }
  };

  /**
   * Cleanup all resources and listeners
   */
  const cleanup = (): void => {
    // Clear timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    // Remove message listener
    if (messageListener) {
      window.removeEventListener('message', messageListener);
      messageListener = null;
    }

    // Run custom cleanup callbacks
    cleanupCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.warn('Error in cleanup callback:', error);
      }
    });
    cleanupCallbacks = [];

    // Close popup
    if (popup) {
      safeClose('cleanup');
      popup = null;
    }
  };

  /**
   * Open popup with comprehensive COOP handling
   */
  const open = async (url: string, options: PopupManagerOptions = {}): Promise<Window | null> => {
    // Cleanup any existing popup first
    cleanup();

    const {
      windowName = '_blank',
      windowFeatures = 'width=600,height=700,scrollbars=yes,resizable=yes,status=yes,location=yes',
      timeout = 120000, // 2 minutes default
      onSuccess,
      onError,
      onTimeout,
      onMessage,
      debug = false
    } = options;

    try {
      // Open the popup
      popup = window.open(url, windowName, windowFeatures);

      if (!popup) {
        const error = new Error('Failed to open popup - popup blocker may be active');
        if (onError) onError(error);
        throw error;
      }

      if (debug) {
        console.log('🚀 Popup opened successfully:', {
          url: url.substring(0, 100) + '...',
          windowName,
          features: windowFeatures
        });
      }

      // Set up timeout handling
      if (timeout > 0) {
        timeoutId = setTimeout(() => {
          if (debug) console.log('⏰ Popup timeout reached');
          if (onTimeout) onTimeout();
          cleanup();
        }, timeout);
      }

      // Set up message listener for cross-origin communication
      messageListener = (event: MessageEvent) => {
        if (debug) {
          console.log('📨 Received message from popup:', {
            origin: event.origin,
            type: event.data?.type,
            hasData: !!event.data
          });
        }

        // Call custom message handler if provided
        if (onMessage) {
          try {
            onMessage(event);
          } catch (error) {
            console.warn('Error in custom message handler:', error);
          }
        }

        // Handle OAuth success/error messages
        if (event.data?.type === 'oauth_success') {
          if (debug) console.log('✅ OAuth success detected');
          if (onSuccess) {
            // Extract domains from domainsDiscovered string and create proper result object
            const domainsDiscovered = event.data.domainsDiscovered || '';
            const domains = domainsDiscovered ? domainsDiscovered.split(',') : [];
            const result = {
              domains,
              adminEmail: event.data.adminEmail,
              sessionId: event.data.sessionId,
              authType: event.data.authType
            };
            onSuccess(result);
          }
          cleanup();
        } else if (event.data?.type === 'oauth_error') {
          if (debug) console.log('❌ OAuth error detected');
          const error = new Error(event.data.error || 'OAuth authentication failed');
          if (onError) onError(error);
          cleanup();
        }
      };

      window.addEventListener('message', messageListener);

      // Monitor popup closure using safe polling (fallback for browsers that support it)
      const monitorClosure = () => {
        if (!popup) return;

        if (safeIsClosed()) {
          if (debug) console.log('🔗 Popup closed detected');
          cleanup();
        } else {
          // Continue monitoring with reduced frequency to minimize COOP errors
          setTimeout(monitorClosure, 2000);
        }
      };

      // Start monitoring after a short delay
      setTimeout(monitorClosure, 1000);

      return popup;

    } catch (error) {
      cleanup();
      if (onError && error instanceof Error) onError(error);
      throw error;
    }
  };

  /**
   * Wait for a specific message from the popup
   */
  const waitForMessage = (expectedOrigin?: string): Promise<any> => {
    return new Promise((resolve, reject) => {
      const originalListener = messageListener;

      const enhancedListener = (event: MessageEvent) => {
        // Check origin if specified
        if (expectedOrigin && event.origin !== expectedOrigin) {
          console.debug('Message from unexpected origin:', event.origin, 'expected:', expectedOrigin);
          return;
        }

        // Call original listener if it exists
        if (originalListener) originalListener(event);

        // Resolve with the message data
        resolve(event.data);
      };

      if (messageListener) {
        window.removeEventListener('message', messageListener);
      }

      messageListener = enhancedListener;
      window.addEventListener('message', messageListener);

      // Set up timeout for message waiting
      const timeoutId = setTimeout(() => {
        reject(new Error('Timeout waiting for popup message'));
      }, 30000); // 30 second timeout for messages

      cleanupCallbacks.push(() => clearTimeout(timeoutId));
    });
  };

  return {
    open,
    close: () => safeClose('manual'),
    isOpen: () => !safeIsClosed(),
    waitForMessage,
    cleanup
  };
}

/**
 * Utility function to create a simple OAuth popup with common defaults
 */
export function createOAuthPopup(
  authUrl: string, 
  options: Omit<PopupManagerOptions, 'windowName' | 'windowFeatures'> & {
    windowName?: string;
    windowFeatures?: string;
  } = {}
): Promise<any> {
  const popupManager = createPopupManager();

  const defaultOptions: PopupManagerOptions = {
    windowName: 'oauth_popup',
    windowFeatures: 'width=600,height=700,scrollbars=yes,resizable=yes,status=yes,location=yes,menubar=no,toolbar=no',
    timeout: 300000, // 5 minutes for OAuth
    debug: process.env.NODE_ENV === 'development',
    ...options
  };

  return new Promise((resolve, reject) => {
    popupManager.open(authUrl, {
      ...defaultOptions,
      onSuccess: (data) => {
        popupManager.cleanup();
        resolve(data);
      },
      onError: (error) => {
        popupManager.cleanup();
        reject(error);
      },
      onTimeout: () => {
        popupManager.cleanup();
        reject(new Error('OAuth popup timeout - please try again'));
      }
    });
  });
}

/**
 * Hook for React components to use popup manager
 * Note: This is a simplified implementation. For production use,
 * prefer using the useOAuth hook from @/hooks/useOAuth.ts
 */
export function usePopupManager() {
  // Use dynamic import for React to avoid module resolution issues
  if (typeof window === 'undefined') {
    // Server-side rendering fallback
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const React = require('react');
    const popupManagerRef = React.useRef(null as PopupManager | null);

    // Initialize popup manager
    const getPopupManager = () => {
      if (!popupManagerRef.current) {
        popupManagerRef.current = createPopupManager();
      }
      return popupManagerRef.current;
    };

    // Cleanup on unmount
    React.useEffect(() => {
      return () => {
        if (popupManagerRef.current) {
          popupManagerRef.current.cleanup();
          popupManagerRef.current = null;
        }
      };
    }, []);

    return getPopupManager();
  } catch (error) {
    console.warn('React not available for usePopupManager hook:', error);
    return null;
  }
}

export default createPopupManager;
