'use client';

import { useState, useEffect, memo } from 'react';
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
  X
} from 'lucide-react';
import { MigrationScenario } from '@/types/migration-scenarios';

interface OAuthAuthenticationStepProps {
  selectedScenario: MigrationScenario;
  sessionId: string;
  onDomainsDiscovered: (domains: string[]) => void;
  isAuthenticated: boolean;
  discoveredDomains: string[];
  onAuthenticationStart: () => void;
  onRefreshStatus: () => void;
  // Enhanced for cross-tenant scenarios
  sourceAuthStatus?: {
    authenticated: boolean;
    domains: string[];
    error?: string;
  };
  targetAuthStatus?: {
    authenticated: boolean;
    domains: string[];
    error?: string;
  };
  onSourceAuthComplete?: (domains: string[]) => void;
  onTargetAuthComplete?: (domains: string[]) => void;
}

export const OAuthAuthenticationStep = memo(function OAuthAuthenticationStep({
  selectedScenario,
  sessionId,
  onDomainsDiscovered,
  isAuthenticated,
  discoveredDomains,
  onAuthenticationStart,
  onRefreshStatus,
  sourceAuthStatus,
  targetAuthStatus,
  onSourceAuthComplete,
  onTargetAuthComplete
}: OAuthAuthenticationStepProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCrossTenantPopup, setShowCrossTenantPopup] = useState(false);
  const [currentAuthType, setCurrentAuthType] = useState<'source' | 'target' | null>(null);

  const initiateOAuth = async () => {
    if (selectedScenario === 'cross-tenant') {
      setShowCrossTenantPopup(true);
    } else {
      // Single super admin - use the existing flow
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
      setAuthUrl(data.authUrl);

      // Open popup window for OAuth
      const popup = window.open(
        data.authUrl,
        'oauth_domain_discovery',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );

      if (!popup) {
        throw new Error('Popup blocked. Please allow popups for this site.');
      }

      // Monitor popup for completion
      const checkClosed = setInterval(() => {
        try {
          if (popup.closed) {
            clearInterval(checkClosed);
            onRefreshStatus();
            setIsLoading(false);
          }
        } catch (error) {
          // Handle case where we can't access popup.closed due to COOP policy
          console.log('Cannot check popup.closed due to COOP policy, refreshing status anyway');
          clearInterval(checkClosed);
          onRefreshStatus();
          setIsLoading(false);
        }
      }, 1000);

      onAuthenticationStart();

    } catch (error) {
      console.error('OAuth initiation error:', error);
      setError(error instanceof Error ? error.message : 'Failed to start authentication');
      setIsLoading(false);
    }
  };

  const initiateCrossTenantOAuth = async (authType: 'source' | 'target') => {
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
        throw new Error('Failed to initiate OAuth');
      }

      const data = await response.json();

      // Open popup window for OAuth
      const popup = window.open(
        data.authUrl,
        `oauth_${authType}_domain_discovery`,
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );

      if (!popup) {
        throw new Error('Popup blocked. Please allow popups for this site.');
      }

      // Monitor popup for completion
      const checkClosed = setInterval(() => {
        try {
          if (popup.closed) {
            clearInterval(checkClosed);
            // Check authentication status for this specific auth type
            checkCrossTenantAuthStatus(authType);
            setIsLoading(false);
            setCurrentAuthType(null);
          }
        } catch (error) {
          // Handle case where we can't access popup.closed due to COOP policy
          console.log('Cannot check popup.closed due to COOP policy, checking auth status anyway');
          clearInterval(checkClosed);
          checkCrossTenantAuthStatus(authType);
          setIsLoading(false);
          setCurrentAuthType(null);
        }
      }, 1000);

      onAuthenticationStart();

    } catch (error) {
      console.error(`${authType} OAuth initiation error:`, error);
      setError(error instanceof Error ? error.message : `Failed to start ${authType} authentication`);
      setIsLoading(false);
      setCurrentAuthType(null);
    }
  };

  const checkCrossTenantAuthStatus = async (authType: 'source' | 'target') => {
    try {
      const response = await fetch(`/api/auth/oauth/discover-domains?sessionId=${sessionId}_${authType}`);
      if (response.ok) {
        const data = await response.json();
        if (data.authenticated && data.discoveredDomains) {
          if (authType === 'source' && onSourceAuthComplete) {
            onSourceAuthComplete(data.discoveredDomains);
          } else if (authType === 'target' && onTargetAuthComplete) {
            onTargetAuthComplete(data.discoveredDomains);
          }
        }
      }
    } catch (error) {
      console.error(`Error checking ${authType} auth status:`, error);
    }
  };

  const getScenarioDescription = () => {
    switch (selectedScenario) {
      case 'single-super-admin':
        return 'Authenticate with your Google Workspace to discover available domains and configure migration settings.';
      case 'cross-tenant':
        return 'Authenticate with both source and target Google Workspace domains to discover available domains for cross-tenant migration.';
      default:
        return 'Authenticate with Google Workspace to proceed with domain discovery.';
    }
  };

  const isAuthenticationComplete = () => {
    if (selectedScenario === 'cross-tenant') {
      return sourceAuthStatus?.authenticated && targetAuthStatus?.authenticated;
    }
    return isAuthenticated;
  };

  const getAllDiscoveredDomains = () => {
    if (selectedScenario === 'cross-tenant') {
      const sourceDomains = sourceAuthStatus?.domains || [];
      const targetDomains = targetAuthStatus?.domains || [];
      return [...sourceDomains, ...targetDomains];
    }
    return discoveredDomains;
  };

  const getRequiredPermissions = () => {
    return [
      'Admin Directory (Domain & User Read)',
      'Gmail Read Access',
      'Google Drive Read Access', 
      'Calendar Read Access',
      'Contacts Read Access'
    ];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
          <Shield className="h-8 w-8 text-blue-600" />
        </div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          Authenticate Domains
        </h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          {getScenarioDescription()}
        </p>
      </div>

      {/* Status Display */}
      {isAuthenticationComplete() ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-start space-x-3">
            <CheckCircle className="h-6 w-6 text-green-600 mt-1" />
            <div className="flex-1">
              <h3 className="text-lg font-medium text-green-900 mb-2">
                Authentication Successful
              </h3>
              <p className="text-green-700 mb-4">
                {selectedScenario === 'cross-tenant' 
                  ? `Successfully authenticated with both source and target domains. Discovered ${getAllDiscoveredDomains().length} domain(s) total.`
                  : `Successfully authenticated and discovered ${getAllDiscoveredDomains().length} domain(s).`
                }
              </p>
              
              {selectedScenario === 'cross-tenant' ? (
                <div className="space-y-4">
                  {/* Source Domains */}
                  {sourceAuthStatus?.domains && sourceAuthStatus.domains.length > 0 && (
                    <div>
                      <h4 className="font-medium text-green-900 mb-2">Source Domains:</h4>
                      <div className="flex flex-wrap gap-2">
                        {sourceAuthStatus.domains.map((domain) => (
                          <span
                            key={domain}
                            className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                          >
                            <Building className="h-4 w-4 mr-1" />
                            {domain}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Target Domains */}
                  {targetAuthStatus?.domains && targetAuthStatus.domains.length > 0 && (
                    <div>
                      <h4 className="font-medium text-green-900 mb-2">Target Domains:</h4>
                      <div className="flex flex-wrap gap-2">
                        {targetAuthStatus.domains.map((domain) => (
                          <span
                            key={domain}
                            className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800"
                          >
                            <Building className="h-4 w-4 mr-1" />
                            {domain}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                getAllDiscoveredDomains().length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-green-900">Discovered Domains:</h4>
                    <div className="flex flex-wrap gap-2">
                      {getAllDiscoveredDomains().map((domain) => (
                        <span
                          key={domain}
                          className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800"
                        >
                          <Building className="h-4 w-4 mr-1" />
                          {domain}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="text-center">
            <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Authentication Required
            </h3>
            <p className="text-gray-600 mb-6">
              {selectedScenario === 'cross-tenant' 
                ? 'Click the button below to authenticate with both source and target Google Workspace domains.'
                : 'Click the button below to authenticate with Google Workspace and discover available domains.'
              }
            </p>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <span className="text-red-700">{error}</span>
                </div>
              </div>
            )}

            <button
              onClick={initiateOAuth}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 flex items-center space-x-2 mx-auto"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <Shield className="h-5 w-5" />
                  <span>
                    {selectedScenario === 'cross-tenant' 
                      ? 'Authenticate Source & Target Domains' 
                      : 'Authenticate with Google'
                    }
                  </span>
                  <ExternalLink className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Required Permissions Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start space-x-3">
          <Info className="h-6 w-6 text-blue-600 mt-1" />
          <div className="flex-1">
            <h3 className="text-lg font-medium text-blue-900 mb-2">
              Required Permissions
            </h3>
            <p className="text-blue-700 mb-4">
              This migration tool requires the following Google Workspace permissions:
            </p>
            <ul className="space-y-2">
              {getRequiredPermissions().map((permission) => (
                <li key={permission} className="flex items-center space-x-2 text-blue-700">
                  <CheckCircle className="h-4 w-4 text-blue-600" />
                  <span>{permission}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Refresh Status Button */}
      {!isAuthenticationComplete() && (
        <div className="text-center">
          <button
            onClick={onRefreshStatus}
            className="text-blue-600 hover:text-blue-700 font-medium flex items-center space-x-2 mx-auto"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Refresh Authentication Status</span>
          </button>
        </div>
      )}

      {/* Cross-Tenant Authentication Popup */}
      {showCrossTenantPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Cross-Tenant Authentication
                </h3>
                <button
                  onClick={() => setShowCrossTenantPopup(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <p className="text-gray-600 mb-6">
                For cross-tenant migration, you need to authenticate with both source and target domains separately to discover available domains.
              </p>

              <div className="space-y-4">
                {/* Source Domain Authentication */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <h4 className="font-medium text-gray-900">Source Domain</h4>
                    </div>
                    {sourceAuthStatus?.authenticated ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <div className="w-5 h-5 border-2 border-gray-300 rounded-full"></div>
                    )}
                  </div>
                  
                  {sourceAuthStatus?.authenticated ? (
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
                    {targetAuthStatus?.authenticated ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <div className="w-5 h-5 border-2 border-gray-300 rounded-full"></div>
                    )}
                  </div>
                  
                  {targetAuthStatus?.authenticated ? (
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

              {sourceAuthStatus?.authenticated && targetAuthStatus?.authenticated && (
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <div className="flex items-center space-x-2 text-green-600">
                    <CheckCircle className="h-5 w-5" />
                    <span className="text-sm font-medium">
                      Both domains authenticated successfully!
                    </span>
                  </div>
                  <button
                    onClick={() => setShowCrossTenantPopup(false)}
                    className="mt-3 w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                  >
                    Continue to Domain Mapping
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
