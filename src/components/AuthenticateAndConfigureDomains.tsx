'use client';

import { useState, useEffect, memo, useCallback } from 'react';
import { 
  Shield, 
  CheckCircle, 
  AlertCircle, 
  ExternalLink, 
  RefreshCw,
  User,
  Building,
  Clock,
  Info,
  X,
  ArrowRight,
  Globe,
  Settings
} from 'lucide-react';
import { MigrationScenario } from '@/types/migration-scenarios';
import { UserMappingRelationship } from '@/types';
import { multiAdminAuthManager, type AuthenticationSession } from '@/lib/multi-admin-auth-manager';
import { useCrossTenantAuth } from '@/lib/cross-tenant-auth-context';

interface AuthenticateAndConfigureDomainsProps {
  selectedScenario: MigrationScenario;
  sessionId: string;
  userMappingStrategy?: UserMappingRelationship;
  onConfigurationComplete: (config: DomainConfiguration) => void;
}

interface DomainConfiguration {
  sourceAuthenticated: boolean;
  targetAuthenticated: boolean;
  sourceDomains: string[];
  targetDomains: string[];
  domainMappings: Array<{
    source: string | string[]; // Support multiple sources for many-to-one
    target: string | string[]; // Support multiple targets for one-to-many
  }>;
}

interface AuthStatus {
  authenticated: boolean;
  domains: string[];
  error?: string;
}

export const AuthenticateAndConfigureDomains = memo(function AuthenticateAndConfigureDomains({
  selectedScenario,
  sessionId,
  userMappingStrategy,
  onConfigurationComplete
}: AuthenticateAndConfigureDomainsProps) {
  // Cross-tenant auth context
  const {
    setCurrentSessionId,
    isSourceAuthenticated,
    isTargetAuthenticated,
    isCrossTenantComplete,
    sourceTokens,
    targetTokens,
    sourceAdminEmail,
    targetAdminEmail
  } = useCrossTenantAuth();
  
  // Add defensive check for null scenario
  if (!selectedScenario) {
    return (
      <div className="text-red-600 p-4 bg-red-50 rounded-lg">
        Error: No migration scenario selected. Please go back and select a scenario first.
      </div>
    );
  }
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Verification notification state
  const [showVerificationNotification, setShowVerificationNotification] = useState(false);
  
  // Authentication states
  const [singleAuthStatus, setSingleAuthStatus] = useState<AuthStatus>({
    authenticated: false,
    domains: []
  });
  const [sourceAuthStatus, setSourceAuthStatus] = useState<AuthStatus>({
    authenticated: false,
    domains: []
  });
  const [targetAuthStatus, setTargetAuthStatus] = useState<AuthStatus>({
    authenticated: false,
    domains: []
  });
  
  // Domain mapping state
  const [domainMappings, setDomainMappings] = useState<Array<{
    source: string | string[];
    target: string | string[];
  }>>([]);
  
  const [showCrossTenantAuth, setShowCrossTenantAuth] = useState(false);
  const [currentAuthType, setCurrentAuthType] = useState<'source' | 'target' | null>(null);
  const [currentPopup, setCurrentPopup] = useState<Window | null>(null);
  const [authSession, setAuthSession] = useState<AuthenticationSession | null>(null);
  
  // Single super admin modal state
  const [showSingleAuthModal, setShowSingleAuthModal] = useState(false);

  // Initialize cross-tenant auth session
  useEffect(() => {
    if (selectedScenario === 'cross-tenant') {
      // Set the session ID in the context
      setCurrentSessionId(sessionId);
      
      const session = multiAdminAuthManager.createSession(sessionId, 'cross-tenant');
      setAuthSession(session);
      
      // Register callback for session updates
      const handleSessionUpdate = (updatedSession: AuthenticationSession) => {
        setAuthSession({ ...updatedSession });
        
        // Update local state based on session
        if (updatedSession.sourceCompleted && updatedSession.sourceDomains) {
          setSourceAuthStatus({
            authenticated: true,
            domains: updatedSession.sourceDomains,
            error: undefined
          });
        }
        
        if (updatedSession.targetCompleted && updatedSession.targetDomains) {
          setTargetAuthStatus({
            authenticated: true,
            domains: updatedSession.targetDomains,
            error: undefined
          });
        }
      };
      
      multiAdminAuthManager.registerCallback(sessionId, handleSessionUpdate);
      
      // Cleanup on unmount
      return () => {
        multiAdminAuthManager.unregisterCallback(sessionId);
      };
    }
  }, [selectedScenario, sessionId]); // Remove initiateCrossTenantOAuth from dependencies

  // Cleanup session when component unmounts
  useEffect(() => {
    return () => {
      if (selectedScenario === 'cross-tenant') {
        // Clear context session
        setCurrentSessionId(null);
        multiAdminAuthManager.cleanup(sessionId);
      }
    };
  }, [selectedScenario, sessionId, setCurrentSessionId]);

  // Add state change tracking for debugging
  useEffect(() => {
  }, [sourceAuthStatus]);

  useEffect(() => {
  }, [targetAuthStatus]);

  // Track when selectedScenario prop changes
  useEffect(() => {
  }, [selectedScenario]);

  // Define cross-tenant OAuth function with useCallback
  const initiateCrossTenantOAuth = useCallback(async (authType: 'source' | 'target') => {
    setCurrentAuthType(authType);
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/oauth/discover-domains', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          sessionId: `${sessionId}_${authType}`,
          authType 
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to initiate ${authType} OAuth`);
      }

      const data = await response.json();
      // Open popup window for OAuth - use same window name for cross-tenant flow
      const popup = window.open(
        data.authUrl,
        'oauth_cross_tenant_discovery', // Same window name for both source and target
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );

      if (!popup) {
        throw new Error('Popup blocked. Please allow popups for this site.');
      }
      // Store popup reference for potential manual closing
      setCurrentPopup(popup);

      // Monitor popup for completion with more frequent checks and better COOP handling
      const checkClosed = setInterval(() => {
        try {
          // Try to check popup status
          if (popup.closed) {
            clearInterval(checkClosed);
            setIsLoading(false);
            setCurrentAuthType(null);
            setCurrentPopup(null);
          }
        } catch (error) {
          // Handle case where we can't access popup.closed due to COOP policy
          // Don't log this error as it's expected with COOP
          // Instead, rely on postMessage communication and timeout
        }
      }, 500); // Check every 500ms instead of 1000ms

      // Enhanced timeout-based cleanup for COOP scenarios
      const enhancedTimeout = setTimeout(() => {
        clearInterval(checkClosed);
        // Clean up state regardless of popup status
        setIsLoading(false);
        setCurrentAuthType(null);
        // Try to close popup if still accessible
        try {
          if (popup && !popup.closed) {
            popup.close();
          }
        } catch (error) {
          // COOP policy prevents popup access, which is fine
        }
        setCurrentPopup(null);
      }, 30000); // 30 second timeout for better UX

      // Clean up on unmount
      return () => {
        clearInterval(checkClosed);
        clearTimeout(enhancedTimeout);
      };

    } catch (error) {
      console.error(`${authType} OAuth initiation error:`, error);
      setError(error instanceof Error ? error.message : `Failed to start ${authType} authentication`);
      setIsLoading(false);
      setCurrentAuthType(null);
    }
  }, [sessionId, isLoading, currentAuthType, sourceAuthStatus.authenticated, targetAuthStatus.authenticated]);

  // Function to discover domains after OAuth authentication
  const discoverDomainsForAuth = useCallback(async (domain: string, authType: string) => {
    console.log(`[discoverDomainsForAuth] Starting domain discovery for ${authType} with domain:`, domain);
    
    try {
      const response = await fetch('/api/auth/oauth/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          domain,
          type: authType 
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to discover domains for ${authType}`);
      }

      const data = await response.json();
      console.log(`[discoverDomainsForAuth] Domain discovery response for ${authType}:`, data);
      
      if (data.success && data.domains) {
        // Update the appropriate auth status based on auth type
        if (authType === 'source') {
          setSourceAuthStatus({
            authenticated: true,
            domains: data.domains,
            error: undefined
          });
        } else if (authType === 'target') {
          setTargetAuthStatus({
            authenticated: true,
            domains: data.domains,
            error: undefined
          });
        } else {
          // Single super admin case
          setSingleAuthStatus({
            authenticated: true,
            domains: data.domains,
            error: undefined
          });
        }
        
        console.log(`[discoverDomainsForAuth] Successfully updated ${authType} auth status with ${data.domains.length} domains`);
      } else {
        throw new Error(data.error || `Failed to discover domains for ${authType}`);
      }
    } catch (error) {
      console.error(`[discoverDomainsForAuth] Error discovering domains for ${authType}:`, error);
      const errorMessage = error instanceof Error ? error.message : `Failed to discover domains for ${authType}`;
      
      // Update the appropriate auth status with error
      if (authType === 'source') {
        setSourceAuthStatus(prev => ({
          ...prev,
          error: errorMessage
        }));
      } else if (authType === 'target') {
        setTargetAuthStatus(prev => ({
          ...prev,
          error: errorMessage
        }));
      } else {
        setSingleAuthStatus(prev => ({
          ...prev,
          error: errorMessage
        }));
      }
    }
  }, []);

  // Check if authentication is complete
  const isAuthenticationComplete = () => {
    if (selectedScenario === 'cross-tenant') {
      const result = sourceAuthStatus.authenticated && targetAuthStatus.authenticated;
      return result;
    }
    const result = singleAuthStatus.authenticated;
    return result;
  };

  // Debug function to check authentication status for Single Super Admin
  const checkSingleSuperAdminAuthStatus = () => {
    console.log('[Single Super Admin Auth Status]', {
      authenticated: singleAuthStatus.authenticated,
      domains: singleAuthStatus.domains,
      domainCount: singleAuthStatus.domains.length,
      error: singleAuthStatus.error,
      selectedScenario,
      sessionId,
      isAuthComplete: isAuthenticationComplete()
    });
    return {
      authenticated: singleAuthStatus.authenticated,
      domains: singleAuthStatus.domains,
      domainCount: singleAuthStatus.domains.length,
      hasError: !!singleAuthStatus.error,
      error: singleAuthStatus.error
    };
  };

  // Manual authentication verification function
  const verifyAuthentication = async () => {
    if (selectedScenario === 'single-super-admin' && singleAuthStatus.authenticated) {
      try {
        // Verify the authentication is still valid by making a test API call
        const response = await fetch('/api/auth/verify-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            sessionId,
            scenario: selectedScenario 
          })
        });

        if (response.ok) {
          const data = await response.json();
          console.log('[Auth Verification] Success:', data);
          return { verified: true, ...data };
        } else {
          console.log('[Auth Verification] Failed:', response.status);
          return { verified: false, error: 'Verification failed' };
        }
      } catch (error) {
        console.error('[Auth Verification] Error:', error);
        return { verified: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }
    return { verified: false, error: 'Not authenticated or wrong scenario' };
  };

  // Get all available domains
  const getAvailableDomains = () => {
    if (selectedScenario === 'cross-tenant') {
      return {
        source: sourceAuthStatus.domains,
        target: targetAuthStatus.domains
      };
    }
    
    // For single-super-admin scenario, ensure source and target domains don't overlap
    const allDomains = singleAuthStatus.domains;
    
    // Get currently selected source domains from domain mappings
    const selectedSourceDomains = domainMappings.flatMap(mapping => 
      Array.isArray(mapping.source) ? mapping.source : [mapping.source]
    ).filter(Boolean);
    
    // Get currently selected target domains from domain mappings  
    const selectedTargetDomains = domainMappings.flatMap(mapping =>
      Array.isArray(mapping.target) ? mapping.target : [mapping.target]
    ).filter(Boolean);
    
    return {
      source: allDomains.filter(domain => !selectedTargetDomains.includes(domain)),
      target: allDomains.filter(domain => !selectedSourceDomains.includes(domain))
    };
  };

  // Handle OAuth callback
  useEffect(() => {
    const handleOAuthCallback = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const oauthSuccess = urlParams.get('oauth_success');
      const domainsDiscovered = urlParams.get('domains_discovered');
      const sessionIdParam = urlParams.get('session_id');
      const authType = urlParams.get('auth_type');
      const adminEmail = urlParams.get('admin_email');

      if (oauthSuccess === 'true' && domainsDiscovered) {
        processOAuthSuccess(domainsDiscovered, sessionIdParam, authType, adminEmail);
      }
    };

    // Handle postMessage from OAuth popup
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return;
      }
      
      console.log('[OAuth] Received postMessage:', event.data);
      
      if (event.data.type === 'oauth_success') {
        console.log('[OAuth] Processing OAuth success from postMessage');
        
        // Clear loading state
        setIsLoading(false);
        setCurrentAuthType(null);
        
        // Close popup if we have reference
        if (currentPopup) {
          try {
            currentPopup.close();
          } catch (error) {
            // COOP policy may prevent closing, which is fine
          }
          setCurrentPopup(null);
        }
        
        // For domain admin authentication, discover domains
        if (event.data.domain && event.data.authType) {
          discoverDomainsForAuth(event.data.domain, event.data.authType);
        }
        
        // Legacy support for old format with domain discovery
        if (event.data.domainsDiscovered) {
          console.log('[OAuth] Processing domains discovered from postMessage:', event.data.domainsDiscovered);
          processOAuthSuccess(event.data.domainsDiscovered, event.data.sessionId, event.data.authType, event.data.adminEmail);
        }
      } else if (event.data.type === 'oauth_error') {
        console.error('[OAuth] Received OAuth error from postMessage:', event.data);
        
        // Clear loading state
        setIsLoading(false);
        setCurrentAuthType(null);
        
        // Close popup if we have reference
        if (currentPopup) {
          try {
            currentPopup.close();
          } catch (error) {
            // COOP policy may prevent closing, which is fine
          }
          setCurrentPopup(null);
        }
        
        // Show error to user
        const errorMessage = event.data.message || 'Authentication failed. Please try again.';
        setError(errorMessage);
      }
    };

    const processOAuthSuccess = (domainsDiscovered: string | null, sessionIdParam: string | null, authType: string | null, adminEmail?: string | null) => {
      if (!domainsDiscovered) {
        return;
      }
      
      const domains = domainsDiscovered.split(',').filter(Boolean);
      
      // Handle cross-tenant authentication using enhanced auth manager
      if (authType === 'source' && sessionIdParam === `${sessionId}_source`) {
        const result = multiAdminAuthManager.handleOAuthCallback(sessionIdParam, authType, domains, adminEmail || undefined);
        
        if (!result.success) {
          console.error('Failed to process source auth:', result.reason);
          return;
        }
        
        // For cross-tenant, ensure modal stays open for target auth
        if (selectedScenario === 'cross-tenant') {
          setShowCrossTenantAuth(true);
        }
      } else if (authType === 'target' && sessionIdParam === `${sessionId}_target`) {
        const result = multiAdminAuthManager.handleOAuthCallback(sessionIdParam, authType, domains, adminEmail || undefined);
        
        if (!result.success) {
          console.error('Failed to process target auth:', result.reason);
          return;
        }
        
        // For cross-tenant, modal will auto-close when both are complete
        if (selectedScenario === 'cross-tenant') {
          setShowCrossTenantAuth(true);
        }
      } else if (sessionIdParam === sessionId && (!authType || authType === 'single' || authType?.trim() === 'single')) {
        // Single super admin authentication
        setSingleAuthStatus({
          authenticated: true,
          domains,
          error: undefined
        });
      }

      // Clean up URL parameters
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
      
      // Clean up popup and loading state when OAuth succeeds
      setIsLoading(false);
      setCurrentAuthType(null);
      // Try to close popup if accessible (COOP-safe)
      if (currentPopup) {
        try {
          currentPopup.close();
        } catch (error) {
          // COOP policy may prevent closing, which is fine
        }
        setCurrentPopup(null);
      }
    };

    window.addEventListener('message', handleMessage);
    handleOAuthCallback();
    
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [sessionId, selectedScenario]);

  // Auto-close popup when authentication is complete
  useEffect(() => {
    if (selectedScenario === 'cross-tenant') {
      // For cross-tenant: close only when BOTH source AND target are authenticated
      if (sourceAuthStatus.authenticated && 
          targetAuthStatus.authenticated && 
          showCrossTenantAuth) {
        const timer = setTimeout(() => {
          setShowCrossTenantAuth(false);
        }, 1500);
        return () => clearTimeout(timer);
      }
    } else {
      // For single super admin: close immediately when authenticated
      if (singleAuthStatus.authenticated && showCrossTenantAuth) {
        const timer = setTimeout(() => {
          setShowCrossTenantAuth(false);
        }, 800);
        return () => clearTimeout(timer);
      }
    }
  }, [selectedScenario, sourceAuthStatus.authenticated, targetAuthStatus.authenticated, singleAuthStatus.authenticated, showCrossTenantAuth]);

  // Auto-trigger target authentication - simplified using auth manager
  // This replaces the complex trigger logic with a reliable manager-based approach
  useEffect(() => {
    if (selectedScenario === 'cross-tenant' && authSession) {
      // Auto-trigger target when source is complete (handled by auth manager callback)
      // Modal management based on session status
      if (authSession.status === 'source-complete' && !showCrossTenantAuth) {
        setShowCrossTenantAuth(true);
      }
      
      // Auto-close modal when both are complete
      if (authSession.status === 'complete' && showCrossTenantAuth) {
        setTimeout(() => {
          setShowCrossTenantAuth(false);
        }, 1500);
      }
    }
  }, [selectedScenario, authSession, showCrossTenantAuth, isLoading, currentAuthType]);

  // Auto-complete configuration for single super admin scenario - DISABLED FOR MANUAL MAPPING
  useEffect(() => {
    if (selectedScenario === 'single-super-admin' && 
        singleAuthStatus.authenticated && 
        singleAuthStatus.domains.length > 0) {
      
      // DISABLED: Auto-create default domain mappings - users must manually configure
      // if (domainMappings.length === 0) {
      //   if (userMappingStrategy === 'one-to-many') {
      //     // For one-to-many, create one mapping with first domain as source and all domains as targets
      //     const defaultMappings = [{
      //       source: singleAuthStatus.domains[0],
      //       target: singleAuthStatus.domains
      //     }];
      //     setDomainMappings(defaultMappings);
      //   } else if (userMappingStrategy === 'many-to-one') {
      //     // For many-to-one, create one mapping with all domains as sources and first domain as target
      //     const defaultMappings = [{
      //       source: singleAuthStatus.domains,
      //       target: singleAuthStatus.domains[0]
      //     }];
      //     setDomainMappings(defaultMappings);
      //   } else {
      //     // Default one-to-one mapping
      //     const defaultMappings = singleAuthStatus.domains.map(domain => ({
      //       source: domain,
      //       target: domain
      //     }));
      //     setDomainMappings(defaultMappings);
      //   }
      // }
      
      // For single super admin, don't auto-complete - let user configure domain mappings
      // This allows users to set up different mapping strategies (one-to-one, one-to-many, etc.)
      console.log('[AuthenticateAndConfigureDomains] Manual domain mapping required for single super admin scenario');
    }
  }, [selectedScenario, singleAuthStatus.authenticated, singleAuthStatus.domains, domainMappings.length, userMappingStrategy]);

  // Periodic authentication status check for Single Super Admin
  useEffect(() => {
    if (selectedScenario === 'single-super-admin' && singleAuthStatus.authenticated) {
      const statusCheck = setInterval(() => {
        checkSingleSuperAdminAuthStatus();
      }, 30000); // Check every 30 seconds

      return () => clearInterval(statusCheck);
    }
  }, [selectedScenario, singleAuthStatus.authenticated]);

  // Auto-open cross-tenant modal if in cross-tenant mode and source is authenticated but target is not
  useEffect(() => {
    if (selectedScenario === 'cross-tenant' && 
        sourceAuthStatus.authenticated && 
        !targetAuthStatus.authenticated &&
        !showCrossTenantAuth) {
      setShowCrossTenantAuth(true);
    }
  }, [selectedScenario, sourceAuthStatus.authenticated, targetAuthStatus.authenticated, showCrossTenantAuth]);

  // Close popup when both cross-tenant authentications are complete
  useEffect(() => {
    if (selectedScenario === 'cross-tenant' && 
        sourceAuthStatus.authenticated && 
        targetAuthStatus.authenticated &&
        currentPopup) {
      // Both authentications complete - close the popup
      setTimeout(() => {
        try {
          if (currentPopup && !currentPopup.closed) {
            currentPopup.close();
            setCurrentPopup(null);
          }
        } catch (error) {
          // Handle case where we can't access popup.closed due to COOP policy
          console.log('Cannot check popup.closed due to COOP policy in cross-tenant cleanup');
          try {
            if (currentPopup) {
              currentPopup.close();
              setCurrentPopup(null);
            }
          } catch (closeError) {
            console.log('Cannot close popup due to COOP policy');
            setCurrentPopup(null);
          }
        }
      }, 1000); // Small delay to show success message
    }
  }, [selectedScenario, sourceAuthStatus.authenticated, targetAuthStatus.authenticated, currentPopup]);

  const initiateOAuth = async () => {
    if (selectedScenario === 'cross-tenant') {
      setShowCrossTenantAuth(true);
    } else {
      // For single super admin, show modal first
      setShowSingleAuthModal(true);
    }
  };

  // Handle authentication from single auth modal
  const handleSingleAuthFromModal = async () => {
    setShowSingleAuthModal(false); // Close modal immediately
    await initiateSingleSuperAdminOAuth();
  };

  const initiateSingleSuperAdminOAuth = async () => {
    if (isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/oauth/discover-domains', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId })
      });

      if (!response.ok) {
        throw new Error('Failed to initiate OAuth');
      }

      const data = await response.json();

      // Open popup window for OAuth
      const popup = window.open(
        data.authUrl,
        'oauth_domain_discovery',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );

      if (!popup) {
        throw new Error('Popup blocked. Please allow popups for this site.');
      }
      
      // Store popup reference for potential manual closing
      setCurrentPopup(popup);

      // Monitor popup for completion with enhanced COOP handling
      const checkClosed = setInterval(() => {
        try {
          // Try to check popup status, but don't rely on it exclusively
          if (popup.closed) {
            clearInterval(checkClosed);
            setIsLoading(false);
            setCurrentPopup(null);
          }
        } catch (error) {
          // Handle case where we can't access popup.closed due to COOP policy
          // Don't log this error as it's expected with COOP
          // Instead, rely on postMessage communication and timeout
        }
      }, 500); // Check every 500ms instead of 1000ms

      // Enhanced timeout-based cleanup for COOP scenarios
      const enhancedTimeout = setTimeout(() => {
        clearInterval(checkClosed);
        // Clean up state regardless of popup status
        setIsLoading(false);
        // Try to close popup if still accessible
        try {
          if (popup && !popup.closed) {
            popup.close();
          }
        } catch (error) {
          // COOP policy prevents popup access, which is fine
        }
        setCurrentPopup(null);
      }, 30000); // 30 second timeout for better UX

      // Clean up on unmount
      return () => {
        clearInterval(checkClosed);
        clearTimeout(enhancedTimeout);
      };

    } catch (error) {
      console.error('OAuth initiation error:', error);
      setError(error instanceof Error ? error.message : 'Failed to start authentication');
      setIsLoading(false);
    }
  };

  const addDomainMapping = () => {
    const domains = getAvailableDomains();
    if (domains.source.length > 0 && domains.target.length > 0) {
      // Create mapping based on user mapping strategy
      if (userMappingStrategy === 'one-to-many') {
        // For one-to-many, one source domain maps to multiple target domains
        setDomainMappings([...domainMappings, {
          source: domains.source[0],
          target: domains.target[0] // Start with first target, user can add more
        }]);
      } else if (userMappingStrategy === 'many-to-one') {
        // For many-to-one, multiple source domains map to one target domain
        setDomainMappings([...domainMappings, {
          source: domains.source[0], // Start with first source, user can add more
          target: domains.target[0]
        }]);
      } else {
        // Default one-to-one mapping
        setDomainMappings([...domainMappings, {
          source: domains.source[0],
          target: domains.target[0]
        }]);
      }
    }
  };

  const removeDomainMapping = (index: number) => {
    setDomainMappings(domainMappings.filter((_, i) => i !== index));
  };

  const updateDomainMapping = (index: number, field: 'source' | 'target', value: string | string[]) => {
    const updated = [...domainMappings];
    updated[index][field] = value;
    setDomainMappings(updated);
  };

  const addTargetToDomainMapping = (index: number, target: string) => {
    const updated = [...domainMappings];
    const currentTargets = Array.isArray(updated[index].target) 
      ? updated[index].target as string[]
      : [updated[index].target as string];
    
    if (!currentTargets.includes(target)) {
      updated[index].target = [...currentTargets, target];
      setDomainMappings(updated);
    }
  };

  const removeTargetFromDomainMapping = (index: number, target: string) => {
    const updated = [...domainMappings];
    const currentTargets = Array.isArray(updated[index].target) 
      ? updated[index].target as string[]
      : [updated[index].target as string];
    
    const filteredTargets = currentTargets.filter(t => t !== target);
    updated[index].target = filteredTargets.length === 1 ? filteredTargets[0] : filteredTargets;
    setDomainMappings(updated);
  };

  const addSourceToDomainMapping = (index: number, source: string) => {
    const updated = [...domainMappings];
    const currentSources = Array.isArray(updated[index].source) 
      ? updated[index].source as string[]
      : [updated[index].source as string];
    
    if (!currentSources.includes(source)) {
      updated[index].source = [...currentSources, source];
      setDomainMappings(updated);
    }
  };

  const removeSourceFromDomainMapping = (index: number, source: string) => {
    const updated = [...domainMappings];
    const currentSources = Array.isArray(updated[index].source) 
      ? updated[index].source as string[]
      : [updated[index].source as string];
    
    const filteredSources = currentSources.filter(s => s !== source);
    updated[index].source = filteredSources.length === 1 ? filteredSources[0] : filteredSources;
    setDomainMappings(updated);
  };

  const renderDomainMapping = (mapping: { source: string | string[]; target: string | string[] }, index: number) => {
    const sources = Array.isArray(mapping.source) ? mapping.source : [mapping.source];
    const targets = Array.isArray(mapping.target) ? mapping.target : [mapping.target];

    if (userMappingStrategy === 'one-to-many') {
      return (
        <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-start space-x-4">
            {/* Single Source */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                Source Domain
              </label>
              <select
                value={sources[0]}
                onChange={(e) => updateDomainMapping(index, 'source', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Array.from(new Set([...getAvailableDomains().source, ...sources])).map((domain) => (
                  <option key={domain} value={domain}>{domain}</option>
                ))}
              </select>
            </div>
            
            <ArrowRight className="h-5 w-5 text-gray-400 mt-8" />
            
            {/* Multiple Targets */}
            <div className="flex-2">
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                Target Domains
              </label>
              <div className="space-y-2">
                {targets.map((target, targetIndex) => (
                  <div key={targetIndex} className="flex items-center space-x-2">
                    <select
                      value={target}
                      onChange={(e) => {
                        const newTargets = [...targets];
                        newTargets[targetIndex] = e.target.value;
                        updateDomainMapping(index, 'target', newTargets);
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {Array.from(new Set([...getAvailableDomains().target, ...targets])).map((domain) => (
                        <option key={domain} value={domain}>{domain}</option>
                      ))}
                    </select>
                    {targets.length > 1 && (
                      <button
                        onClick={() => removeTargetFromDomainMapping(index, target)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => {
                    const availableTargets = getAvailableDomains().target.filter(domain => !targets.includes(domain));
                    if (availableTargets.length > 0) {
                      addTargetToDomainMapping(index, availableTargets[0]);
                    }
                  }}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  + Add Target Domain
                </button>
              </div>
            </div>
            
            <button
              onClick={() => removeDomainMapping(index)}
              className="text-red-600 hover:text-red-700 mt-8"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      );
    } else if (userMappingStrategy === 'many-to-one') {
      return (
        <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-start space-x-4">
            {/* Multiple Sources */}
            <div className="flex-2">
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                Source Domains
              </label>
              <div className="space-y-2">
                {sources.map((source, sourceIndex) => (
                  <div key={sourceIndex} className="flex items-center space-x-2">
                    <select
                      value={source}
                      onChange={(e) => {
                        const newSources = [...sources];
                        newSources[sourceIndex] = e.target.value;
                        updateDomainMapping(index, 'source', newSources);
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {Array.from(new Set([...getAvailableDomains().source, ...sources])).map((domain) => (
                        <option key={domain} value={domain}>{domain}</option>
                      ))}
                    </select>
                    {sources.length > 1 && (
                      <button
                        onClick={() => removeSourceFromDomainMapping(index, source)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => {
                    const availableSources = getAvailableDomains().source.filter(domain => !sources.includes(domain));
                    if (availableSources.length > 0) {
                      addSourceToDomainMapping(index, availableSources[0]);
                    }
                  }}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  + Add Source Domain
                </button>
              </div>
            </div>
            
            <ArrowRight className="h-5 w-5 text-gray-400 mt-8" />
            
            {/* Single Target */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                Target Domain
              </label>
              <select
                value={targets[0]}
                onChange={(e) => updateDomainMapping(index, 'target', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Array.from(new Set([...getAvailableDomains().target, ...targets])).map((domain) => (
                  <option key={domain} value={domain}>{domain}</option>
                ))}
              </select>
            </div>
            
            <button
              onClick={() => removeDomainMapping(index)}
              className="text-red-600 hover:text-red-700 mt-8"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      );
    } else {
      // Default one-to-one mapping
      return (
        <div key={index} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
              <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
              Source
            </label>
            <select
              value={sources[0]}
              onChange={(e) => updateDomainMapping(index, 'source', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Array.from(new Set([...getAvailableDomains().source, ...sources])).map((domain) => (
                <option key={domain} value={domain}>{domain}</option>
              ))}
            </select>
          </div>
          
          <ArrowRight className="h-5 w-5 text-gray-400 mt-6" />
          
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              Target
            </label>
            <select
              value={targets[0]}
              onChange={(e) => updateDomainMapping(index, 'target', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Array.from(new Set([...getAvailableDomains().target, ...targets])).map((domain) => (
                <option key={domain} value={domain}>{domain}</option>
              ))}
            </select>
          </div>
          
          <button
            onClick={() => removeDomainMapping(index)}
            className="text-red-600 hover:text-red-700 mt-6"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      );
    }
  };

  // Validation function to check for domain overlap
  const validateDomainMappings = () => {
    if (selectedScenario === 'cross-tenant') {
      // Cross-tenant scenario - different auth domains, no overlap possible
      return { isValid: true, conflicts: [] };
    }
    
    // For single-super-admin scenario, check for domain conflicts
    const sourceDomainsUsed = new Set<string>();
    const targetDomainsUsed = new Set<string>();
    const conflicts: string[] = [];
    
    domainMappings.forEach((mapping, index) => {
      const sources = Array.isArray(mapping.source) ? mapping.source : [mapping.source];
      const targets = Array.isArray(mapping.target) ? mapping.target : [mapping.target];
      
      sources.forEach(sourceDomain => {
        if (sourceDomain) {
          sourceDomainsUsed.add(sourceDomain);
          // Check if this source domain is also used as a target
          if (targetDomainsUsed.has(sourceDomain)) {
            conflicts.push(`Domain "${sourceDomain}" is used as both source and target`);
          }
        }
      });
      
      targets.forEach(targetDomain => {
        if (targetDomain) {
          targetDomainsUsed.add(targetDomain);
          // Check if this target domain is also used as a source
          if (sourceDomainsUsed.has(targetDomain)) {
            conflicts.push(`Domain "${targetDomain}" is used as both source and target`);
          }
        }
      });
    });
    
    return { isValid: conflicts.length === 0, conflicts };
  };

  const handleConfigurationComplete = () => {
    // Validate domain mappings before proceeding
    const validation = validateDomainMappings();
    if (!validation.isValid) {
      alert(`Cannot proceed with conflicting domain assignments:\n\n${validation.conflicts.join('\n')}\n\nPlease ensure each domain is used either as source OR target, not both.`);
      return;
    }
    
    let sourceDomains: string[];
    let targetDomains: string[];
    
    if (selectedScenario === 'cross-tenant') {
      sourceDomains = sourceAuthStatus.domains;
      targetDomains = targetAuthStatus.domains;
    } else {
      // For single-super-admin, extract actual selected domains from mappings
      const sourceDomainsSet = new Set<string>();
      const targetDomainsSet = new Set<string>();
      
      domainMappings.forEach(mapping => {
        const sources = Array.isArray(mapping.source) ? mapping.source : [mapping.source];
        const targets = Array.isArray(mapping.target) ? mapping.target : [mapping.target];
        
        sources.forEach(domain => domain && sourceDomainsSet.add(domain));
        targets.forEach(domain => domain && targetDomainsSet.add(domain));
      });
      
      sourceDomains = Array.from(sourceDomainsSet);
      targetDomains = Array.from(targetDomainsSet);
    }
    
    const config: DomainConfiguration = {
      sourceAuthenticated: selectedScenario === 'cross-tenant' ? sourceAuthStatus.authenticated : singleAuthStatus.authenticated,
      targetAuthenticated: selectedScenario === 'cross-tenant' ? targetAuthStatus.authenticated : singleAuthStatus.authenticated,
      sourceDomains,
      targetDomains,
      domainMappings
    };
    
    onConfigurationComplete(config);
  };

  return (
    <div className="space-y-6">
      {/* Header with Compact Authentication Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            Authenticate & Configure Domains
          </h2>
          <p className="text-gray-600 max-w-2xl">
            {selectedScenario === 'cross-tenant' 
              ? 'Authenticate with both source and target Google Workspace domains to discover and configure domain mappings.'
              : 'Authenticate with your Google Workspace to discover available domains and configure migration settings.'
            }
          </p>
        </div>
        
        {/* Compact Authentication Button */}
        <div className="flex-shrink-0">
          {isAuthenticationComplete() ? (
            <div className="flex items-center space-x-2 text-green-600 bg-green-50 px-4 py-2 rounded-lg border border-green-200">
              <CheckCircle className="h-5 w-5" />
              <span className="text-sm font-medium">Authenticated</span>
            </div>
          ) : (
            <button
              onClick={initiateOAuth}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center space-x-2"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4" />
                  <span>
                    {selectedScenario === 'cross-tenant' 
                      ? 'Authenticate Domains' 
                      : 'Authenticate'
                    }
                  </span>
                  <ExternalLink className="h-3 w-3" />
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <span className="text-red-700">{error}</span>
          </div>
        </div>
      )}

      {/* Authentication Status & Domain Configuration */}
      {isAuthenticationComplete() ? (
        <div className="space-y-6">
          {/* Authenticated Domains Display */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Source Domains */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-medium text-blue-900 mb-4">
                Source Domains
              </h3>
              <div className="space-y-2">
                {getAvailableDomains().source.map((domain) => (
                  <div key={domain} className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-blue-700">{domain}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Target Domains */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <h3 className="text-lg font-medium text-green-900 mb-4">
                Target Domains
              </h3>
              <div className="space-y-2">
                {getAvailableDomains().target.map((domain) => (
                  <div key={domain} className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-green-700">{domain}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Domain Mappings */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Domain Mappings</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedScenario === 'single-super-admin' 
                    ? userMappingStrategy === 'one-to-many'
                      ? 'Configure how one source domain maps to multiple target domains'
                      : userMappingStrategy === 'many-to-one'
                      ? 'Configure how multiple source domains map to one target domain'
                      : 'Configure one-to-one domain mappings for your migration'
                    : 'Configure how source domains map to target domains for cross-tenant migration'
                  }
                </p>
                {userMappingStrategy && (
                  <div className="mt-2 inline-flex items-center px-3 py-1 bg-blue-100 border border-blue-200 text-blue-800 text-xs font-medium rounded-full">
                    <Settings className="h-3 w-3 mr-1" />
                    Strategy: {userMappingStrategy === 'one-to-many' ? 'One-To-Many' : 
                              userMappingStrategy === 'many-to-one' ? 'Many-To-One' : 
                              'One-To-One'}
                  </div>
                )}
              </div>
              <button
                onClick={addDomainMapping}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Add Mapping
              </button>
            </div>

            {domainMappings.length === 0 ? (
              <div className="text-center py-8">
                <Globe className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-700 font-medium">Manual domain mapping required.</p>
                <p className="text-gray-500 text-sm mb-3">
                  Automatic domain generation has been disabled. You must manually configure your domain mappings.
                </p>
                <p className="text-gray-400 text-sm">
                  {selectedScenario === 'single-super-admin' 
                    ? `Click "Add Mapping" to manually configure your ${userMappingStrategy || 'one-to-one'} domain migration strategy.`
                    : 'Click "Add Mapping" to manually set up your cross-tenant domain mappings.'
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {domainMappings.map((mapping, index) => renderDomainMapping(mapping, index))}
              </div>
            )}
          </div>

          {/* Continue Button */}
          <div className="flex justify-end">
            <button
              onClick={handleConfigurationComplete}
              disabled={domainMappings.length === 0}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium flex items-center space-x-2"
            >
              <span>Complete Configuration</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        /* Authentication Required State*/
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="text-center">
            <User className="h-8 w-8 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Authentication Required
            </h3>
            <p className="text-gray-600 text-sm">
              {selectedScenario === 'cross-tenant' 
                ? 'Please authenticate with both source and target Google Workspace domains to discover available domains.'
                : 'Please authenticate with Google Workspace to discover available domains.'
              }
            </p>
          </div>
        </div>
      )}

      {/* Cross-Tenant Authentication Popup */}
      {showCrossTenantAuth && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Google Workspace Authentication
                </h3>
                <button
                  onClick={() => setShowCrossTenantAuth(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <p className="text-gray-600 mb-6">
                For cross-tenant migration, you need to authenticate with both source and target domains separately.
              </p>

              <div className="space-y-4">
                {/* Source Domain Authentication */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <h4 className="font-medium text-gray-900">Source Domain</h4>
                    </div>
                    {sourceAuthStatus.authenticated ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <div className="w-5 h-5 border-2 border-gray-300 rounded-full"></div>
                    )}
                  </div>
                  
                  {sourceAuthStatus.authenticated ? (
                    <div>
                      <p className="text-sm text-green-600 mb-2">✓ Authenticated successfully</p>
                      <p className="text-xs text-gray-500">
                        Discovered {sourceAuthStatus.domains.length} domain(s)
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-gray-600 mb-3">
                        Authenticate with the source Google Workspace domain
                      </p>
                      <button
                        onClick={() => initiateCrossTenantOAuth('source')}
                        disabled={isLoading && currentAuthType === 'source'}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center justify-center space-x-2"
                      >
                        {isLoading && currentAuthType === 'source' ? (
                          <>
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            <span>Authenticating...</span>
                          </>
                        ) : (
                          <>
                            <Shield className="h-4 w-4" />
                            <span>Authenticate Source</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Target Domain Authentication */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <h4 className="font-medium text-gray-900">Target Domain</h4>
                    </div>
                    {targetAuthStatus.authenticated ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <div className="w-5 h-5 border-2 border-gray-300 rounded-full"></div>
                    )}
                  </div>
                  
                  {targetAuthStatus.authenticated ? (
                    <div>
                      <p className="text-sm text-green-600 mb-2">✓ Authenticated successfully</p>
                      <p className="text-xs text-gray-500">
                        Discovered {targetAuthStatus.domains.length} domain(s)
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-gray-600 mb-3">
                        Authenticate with the target Google Workspace domain
                      </p>
                      <button
                        onClick={() => initiateCrossTenantOAuth('target')}
                        disabled={isLoading && currentAuthType === 'target'}
                        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center justify-center space-x-2"
                      >
                        {isLoading && currentAuthType === 'target' ? (
                          <>
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            <span>Authenticating...</span>
                          </>
                        ) : (
                          <>
                            <Shield className="h-4 w-4" />
                            <span>Authenticate Target</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex items-center space-x-2">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <span className="text-sm text-red-700">{error}</span>
                    </div>
                  </div>
                )}
              </div>

              {sourceAuthStatus.authenticated && targetAuthStatus.authenticated && (
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <div className="flex items-center space-x-2 text-green-600">
                    <CheckCircle className="h-5 w-5" />
                    <span className="text-sm font-medium">
                      Both domains authenticated successfully! Proceeding to domain configuration...
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Single Super Admin Authentication Modal */}
      {showSingleAuthModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Google Workspace Authentication
                </h3>
                <button
                  onClick={() => setShowSingleAuthModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <p className="text-gray-600 mb-6">
                Authenticate with your Google Workspace account to discover available domains and configure migration settings.
              </p>

              <div className="space-y-4">
                {/* Single Authentication Section - Matching Cross-Tenant Design */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <h4 className="font-medium text-gray-900">Google Workspace</h4>
                    </div>
                    {singleAuthStatus.authenticated ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <div className="w-5 h-5 border-2 border-gray-300 rounded-full"></div>
                    )}
                  </div>
                  
                  {singleAuthStatus.authenticated ? (
                    <div>
                      <p className="text-sm text-green-600 mb-2">✓ Authenticated successfully</p>
                      <p className="text-xs text-gray-500">
                        Discovered {singleAuthStatus.domains.length} domain(s)
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-gray-600 mb-3">
                        Authenticate with your Google Workspace account to discover domains
                      </p>
                      <button
                        onClick={handleSingleAuthFromModal}
                        disabled={isLoading}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center justify-center space-x-2"
                      >
                        {isLoading ? (
                          <>
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            <span>Authenticating...</span>
                          </>
                        ) : (
                          <>
                            <Shield className="h-4 w-4" />
                            <span>Authenticate</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex items-center space-x-2">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <span className="text-sm text-red-700">{error}</span>
                    </div>
                  </div>
                )}
              </div>

              {singleAuthStatus.authenticated && (
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <div className="flex items-center space-x-2 text-green-600">
                    <CheckCircle className="h-5 w-5" />
                    <span className="text-sm font-medium">
                      Authentication successful! Proceeding to domain configuration...
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
