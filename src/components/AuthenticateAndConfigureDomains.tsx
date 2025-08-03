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
import { multiAdminAuthManager, type AuthenticationSession } from '@/lib/multi-admin-auth-manager';
import { useCrossTenantAuth } from '@/lib/cross-tenant-auth-context';

interface AuthenticateAndConfigureDomainsProps {
  selectedScenario: MigrationScenario;
  sessionId: string;
  onConfigurationComplete: (config: DomainConfiguration) => void;
}

interface DomainConfiguration {
  sourceAuthenticated: boolean;
  targetAuthenticated: boolean;
  sourceDomains: string[];
  targetDomains: string[];
  domainMappings: Array<{
    source: string;
    target: string;
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
    source: string;
    target: string;
  }>>([]);
  
  const [showCrossTenantAuth, setShowCrossTenantAuth] = useState(false);
  const [currentAuthType, setCurrentAuthType] = useState<'source' | 'target' | null>(null);
  const [currentPopup, setCurrentPopup] = useState<Window | null>(null);
  const [authSession, setAuthSession] = useState<AuthenticationSession | null>(null);

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
      } else if (sessionIdParam === sessionId && !authType) {
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
      await initiateSingleSuperAdminOAuth();
    }
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
      setDomainMappings([...domainMappings, {
        source: domains.source[0],
        target: domains.target[0]
      }]);
    }
  };

  const removeDomainMapping = (index: number) => {
    setDomainMappings(domainMappings.filter((_, i) => i !== index));
  };

  const updateDomainMapping = (index: number, field: 'source' | 'target', value: string) => {
    const updated = [...domainMappings];
    updated[index][field] = value;
    setDomainMappings(updated);
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
              <h3 className="text-lg font-medium text-gray-900">Domain Mappings</h3>
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
                <p className="text-gray-400 text-sm">Click "Add Mapping" to get started.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {domainMappings.map((mapping, index) => (
                  <div key={index} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                      <select
                        value={mapping.source}
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
                        value={mapping.target}
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
                ))}
              </div>
            )}
          </div>

          {/* Continue Button */}
          <div className="flex justify-end">
            <button
              onClick={handleConfigurationComplete}
              disabled={domainMappings.length === 0}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium"
            >
              Complete Configuration
              <ArrowRight className="h-4 w-4 ml-2 inline" />
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
    </div>
  );
});
