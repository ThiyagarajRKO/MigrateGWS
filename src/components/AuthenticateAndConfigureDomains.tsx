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

      // Monitor popup for completion with more frequent checks
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          setIsLoading(false);
          setCurrentAuthType(null);
          setCurrentPopup(null);
        }
      }, 500); // Check every 500ms instead of 1000ms

      // Also add a safety timeout to prevent infinite loading
      const safetyTimeout = setTimeout(() => {
        if (!popup.closed) {
          popup.close();
        }
        clearInterval(checkClosed);
        setIsLoading(false);
        setCurrentAuthType(null);
      }, 60000); // 60 second timeout

      // Clean up on unmount
      return () => {
        clearInterval(checkClosed);
        clearTimeout(safetyTimeout);
      };

    } catch (error) {
      console.error(`${authType} OAuth initiation error:`, error);
      setError(error instanceof Error ? error.message : `Failed to start ${authType} authentication`);
      setIsLoading(false);
      setCurrentAuthType(null);
    }
  }, [sessionId, isLoading, currentAuthType, sourceAuthStatus.authenticated, targetAuthStatus.authenticated]);

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
    return {
      source: singleAuthStatus.domains,
      target: singleAuthStatus.domains
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
      
      if (event.data.type === 'oauth_success') {
        processOAuthSuccess(event.data.domainsDiscovered, event.data.sessionId, event.data.authType, event.data.adminEmail);
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

  // Auto-complete configuration for single super admin scenario
  useEffect(() => {
    if (selectedScenario === 'single-super-admin' && 
        singleAuthStatus.authenticated && 
        singleAuthStatus.domains.length > 0) {
      
      // Auto-create default domain mappings for single super admin if none exist
      if (domainMappings.length === 0) {
        if (userMappingStrategy === 'one-to-many') {
          // For one-to-many, create one mapping with first domain as source and all domains as targets
          const defaultMappings = [{
            source: singleAuthStatus.domains[0],
            target: singleAuthStatus.domains
          }];
          setDomainMappings(defaultMappings);
        } else if (userMappingStrategy === 'many-to-one') {
          // For many-to-one, create one mapping with all domains as sources and first domain as target
          const defaultMappings = [{
            source: singleAuthStatus.domains,
            target: singleAuthStatus.domains[0]
          }];
          setDomainMappings(defaultMappings);
        } else {
          // Default one-to-one mapping
          const defaultMappings = singleAuthStatus.domains.map(domain => ({
            source: domain,
            target: domain
          }));
          setDomainMappings(defaultMappings);
        }
      }
      
      // For single super admin, don't auto-complete - let user configure domain mappings
      // This allows users to set up different mapping strategies (one-to-one, one-to-many, etc.)
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
        currentPopup && !currentPopup.closed) {
      // Both authentications complete - close the popup
      setTimeout(() => {
        if (currentPopup && !currentPopup.closed) {
          currentPopup.close();
          setCurrentPopup(null);
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

      // Monitor popup for completion with more frequent checks
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          setIsLoading(false);
        }
      }, 500); // Check every 500ms instead of 1000ms

      // Also add a safety timeout to prevent infinite loading
      const safetyTimeout = setTimeout(() => {
        if (!popup.closed) {
          popup.close();
        }
        clearInterval(checkClosed);
        setIsLoading(false);
      }, 60000); // 60 second timeout

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
        <div key={index} className="p-4 bg-gray-50 rounded-lg border">
          <div className="flex items-start space-x-4">
            {/* Single Source */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Source Domain</label>
              <select
                value={sources[0]}
                onChange={(e) => updateDomainMapping(index, 'source', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {getAvailableDomains().source.map((domain) => (
                  <option key={domain} value={domain}>{domain}</option>
                ))}
              </select>
            </div>
            
            <ArrowRight className="h-5 w-5 text-gray-400 mt-8" />
            
            {/* Multiple Targets */}
            <div className="flex-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Target Domains</label>
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
                      {getAvailableDomains().target.map((domain) => (
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
        <div key={index} className="p-4 bg-gray-50 rounded-lg border">
          <div className="flex items-start space-x-4">
            {/* Multiple Sources */}
            <div className="flex-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Source Domains</label>
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
                      {getAvailableDomains().source.map((domain) => (
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Target Domain</label>
              <select
                value={targets[0]}
                onChange={(e) => updateDomainMapping(index, 'target', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {getAvailableDomains().target.map((domain) => (
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
        <div key={index} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
            <select
              value={sources[0]}
              onChange={(e) => updateDomainMapping(index, 'source', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {getAvailableDomains().source.map((domain) => (
                <option key={domain} value={domain}>{domain}</option>
              ))}
            </select>
          </div>
          
          <ArrowRight className="h-5 w-5 text-gray-400 mt-6" />
          
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Target</label>
            <select
              value={targets[0]}
              onChange={(e) => updateDomainMapping(index, 'target', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {getAvailableDomains().target.map((domain) => (
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

  const handleConfigurationComplete = () => {
    const config: DomainConfiguration = {
      sourceAuthenticated: selectedScenario === 'cross-tenant' ? sourceAuthStatus.authenticated : singleAuthStatus.authenticated,
      targetAuthenticated: selectedScenario === 'cross-tenant' ? targetAuthStatus.authenticated : singleAuthStatus.authenticated,
      sourceDomains: selectedScenario === 'cross-tenant' ? sourceAuthStatus.domains : singleAuthStatus.domains,
      targetDomains: selectedScenario === 'cross-tenant' ? targetAuthStatus.domains : singleAuthStatus.domains,
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
                      ? 'Configure how one source domain maps to multiple target domains (one-to-many strategy)'
                      : userMappingStrategy === 'many-to-one'
                      ? 'Configure how multiple source domains map to one target domain (many-to-one strategy)'
                      : 'Configure how your domains should be mapped based on your migration strategy (one-to-one)'
                    : 'Configure how source domains map to target domains for cross-tenant migration'
                  }
                </p>
                {userMappingStrategy && (
                  <div className="mt-2 inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                    Strategy: {userMappingStrategy.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
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
                <p className="text-gray-500">No domain mappings configured yet.</p>
                <p className="text-gray-400 text-sm">
                  {selectedScenario === 'single-super-admin' 
                    ? `Click "Add Mapping" to configure your ${userMappingStrategy || 'one-to-one'} domain migration strategy.`
                    : 'Click "Add Mapping" to get started.'
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
        /* Authentication Required State - More Compact */
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
                  Cross-Tenant Authentication
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
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Authenticate Google Workspace
              </h3>
              <button
                onClick={() => setShowSingleAuthModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
                <Shield className="h-6 w-6 text-blue-600" />
                <div>
                  <h4 className="font-medium text-blue-900">Secure Authentication Required</h4>
                  <p className="text-sm text-blue-700">
                    Authenticate with your Google Workspace account to discover available domains
                  </p>
                </div>
              </div>
              
              <div className="text-sm text-gray-600 space-y-2">
                <p>This will:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Open a secure Google authentication window</li>
                  <li>Discover all available domains in your workspace</li>
                  <li>Generate verification tokens for migration setup</li>
                  <li>Redirect you to domain mapping configuration</li>
                </ul>
              </div>
              
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <span className="text-sm text-red-700">{error}</span>
                  </div>
                </div>
              )}
              
              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => setShowSingleAuthModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSingleAuthFromModal}
                  disabled={isLoading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center justify-center space-x-2"
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
