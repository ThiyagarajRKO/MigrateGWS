'use client';

import React, { useState, useEffect } from 'react';
import { Shield, CheckCircle, AlertCircle, RefreshCw, Settings, Key } from 'lucide-react';
import { 
  autoConfigureTargetDomains,
  validateTargetDomainConfig,
  type TargetDomainConfig,
  type ServiceAccountConfig 
} from '@/types/targetDomainConfig';

// Server-side function that needs to be called via API
async function setupTargetDomainsWithServiceAccount(
  targetDomains: string[],
  serviceAccountConfig: ServiceAccountConfig,
  customAdminEmails?: TargetDomainConfig
): Promise<{
  success: boolean;
  configuredDomains: string[];
  errors: string[];
  targetAdminEmails: TargetDomainConfig;
}> {
  try {
    const response = await fetch('/api/target-domain-config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        targetDomains,
        serviceAccountConfig,
        customAdminEmails
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to setup target domains: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error setting up target domains:', error);
    return {
      success: false,
      configuredDomains: [],
      errors: [error instanceof Error ? error.message : 'Unknown error'],
      targetAdminEmails: {}
    };
  }
}

interface ServiceAccountTargetSetupProps {
  targetDomains: string[];
  onConfigurationComplete: (config: TargetDomainConfig) => void;
  className?: string;
}

export const ServiceAccountTargetSetup: React.FC<ServiceAccountTargetSetupProps> = ({
  targetDomains,
  onConfigurationComplete,
  className = ''
}) => {
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [configurationStatus, setConfigurationStatus] = useState<{
    success: boolean;
    configuredDomains: string[];
    errors: string[];
    targetAdminEmails: TargetDomainConfig;
  } | null>(null);
  const [serviceAccountConfig, setServiceAccountConfig] = useState<ServiceAccountConfig>({
    credentialsPath: '',
    scopes: [
      'https://www.googleapis.com/auth/admin.directory.user',
      'https://www.googleapis.com/auth/admin.directory.group',
      'https://www.googleapis.com/auth/admin.directory.domain'
    ],
    delegatedAdminEmail: '',
    clientEmail: '',
    privateKey: '',
    clientId: ''
  });
  const [targetUsers, setTargetUsers] = useState<{[domain: string]: any[]}>({});
  const [isDiscoveringUsers, setIsDiscoveringUsers] = useState(false);
  const [discoveryResults, setDiscoveryResults] = useState<any>(null);

  // Auto-load service account configuration from environment
  useEffect(() => {
    const loadServiceAccountConfig = () => {
      const config: ServiceAccountConfig = {
        credentialsPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || '',
        scopes: [
          'https://www.googleapis.com/auth/admin.directory.user',
          'https://www.googleapis.com/auth/admin.directory.group',
          'https://www.googleapis.com/auth/admin.directory.domain'
        ],
        delegatedAdminEmail: process.env.GOOGLE_ADMIN_EMAIL || '',
        clientEmail: process.env.NEXT_PUBLIC_GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL || 
                    process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL || 
                    'gws-permission@gws-migration-463208.iam.gserviceaccount.com',
        privateKey: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '',
        clientId: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_ID || '114333598950671892438'
      };
      setServiceAccountConfig(config);
    };

    loadServiceAccountConfig();
  }, []);

  const handleAutoConfiguration = async () => {
    setIsConfiguring(true);
    
    try {
      // For the specific domains mentioned in the error, use auto-configuration
      const autoConfig = autoConfigureTargetDomains();
      
      // Validate the configuration
      const validation = validateTargetDomainConfig(targetDomains, autoConfig);
      
      if (validation.isValid) {
        const result = {
          success: true,
          configuredDomains: targetDomains,
          errors: [],
          targetAdminEmails: autoConfig
        };
        
        setConfigurationStatus(result);
        onConfigurationComplete(autoConfig);
      } else {
        throw new Error(validation.message || 'Configuration validation failed');
      }
    } catch (error) {
      setConfigurationStatus({
        success: false,
        configuredDomains: [],
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        targetAdminEmails: {}
      });
    } finally {
      setIsConfiguring(false);
    }
  };

  const handleServiceAccountSetup = async () => {
    setIsConfiguring(true);
    
    try {
      const result = await setupTargetDomainsWithServiceAccount(
        targetDomains,
        serviceAccountConfig
      );
      
      setConfigurationStatus(result);
      
      if (result.success) {
        onConfigurationComplete(result.targetAdminEmails);
      }
    } catch (error) {
      setConfigurationStatus({
        success: false,
        configuredDomains: [],
        errors: [error instanceof Error ? error.message : 'Setup failed'],
        targetAdminEmails: {}
      });
    } finally {
      setIsConfiguring(false);
    }
  };

  const handleDiscoverTargetUsers = async () => {
    if (!configurationStatus?.success) {
      alert('Please configure target domains first');
      return;
    }

    setIsDiscoveringUsers(true);
    setDiscoveryResults(null);

    try {
      const response = await fetch('/api/target-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'discover-all',
          targetDomains,
          targetAdminEmails: configurationStatus.targetAdminEmails,
          options: {
            includeSuspended: false,
            maxResults: 100
          }
        })
      });

      const result = await response.json();
      setDiscoveryResults(result);

      if (result.success) {
        setTargetUsers(result.usersByDomain);
        console.log('Target users discovered:', result);
      }
    } catch (error) {
      console.error('Error discovering target users:', error);
      setDiscoveryResults({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsDiscoveringUsers(false);
    }
  };

  const hasServiceAccountConfig = serviceAccountConfig.clientEmail && serviceAccountConfig.clientId;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center space-x-2">
        <Shield className="h-6 w-6 text-blue-600" />
        <h2 className="text-xl font-semibold text-gray-900">
          Service Account Target Domain Setup
        </h2>
      </div>

      {/* Service Account Status */}
      <div className="p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-900">Service Account Configuration</h3>
          <div className={`flex items-center space-x-1 ${
            hasServiceAccountConfig ? 'text-green-600' : 'text-yellow-600'
          }`}>
            {hasServiceAccountConfig ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <span className="text-xs font-medium">
              {hasServiceAccountConfig ? 'Configured' : 'Incomplete'}
            </span>
          </div>
        </div>
        
        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex justify-between">
            <span>Client Email:</span>
            <span className="font-mono text-xs">
              {serviceAccountConfig.clientEmail ? 
                `${serviceAccountConfig.clientEmail.substring(0, 20)}...` : 
                'Not configured'
              }
            </span>
          </div>
          <div className="flex justify-between">
            <span>Client ID:</span>
            <span className="font-mono text-xs">
              {serviceAccountConfig.clientId || 'Not configured'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Private Key:</span>
            <span className="text-xs">
              {serviceAccountConfig.privateKey ? 'Configured' : 'Not configured'}
            </span>
          </div>
        </div>
      </div>

      {/* Target Domains */}
      <div className="p-4 bg-blue-50 rounded-lg">
        <h3 className="text-sm font-medium text-blue-900 mb-2">Target Domains to Configure</h3>
        <div className="space-y-1">
          {targetDomains.map(domain => (
            <div key={domain} className="flex items-center justify-between text-sm">
              <span className="font-mono text-blue-800">{domain}</span>
              <span className="text-blue-600">→ admin@{domain}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-4">
        <button
          onClick={handleAutoConfiguration}
          disabled={isConfiguring}
          className="flex-1 flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isConfiguring ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Settings className="h-4 w-4 mr-2" />
          )}
          Auto-Configure Target Domains
        </button>

        {hasServiceAccountConfig && (
          <button
            onClick={handleServiceAccountSetup}
            disabled={isConfiguring}
            className="flex-1 flex items-center justify-center px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isConfiguring ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Key className="h-4 w-4 mr-2" />
            )}
            Setup with Service Account
          </button>
        )}
      </div>

      {/* Target User Discovery Button */}
      {configurationStatus?.success && (
        <div className="flex justify-center">
          <button
            onClick={handleDiscoverTargetUsers}
            disabled={isDiscoveringUsers}
            className="flex items-center justify-center px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isDiscoveringUsers ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            Get Target Users by Service Account Authentication
          </button>
        </div>
      )}

      {/* Configuration Status */}
      {configurationStatus && (
        <div className={`p-4 rounded-lg ${
          configurationStatus.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
        }`}>
          <div className="flex items-start space-x-3">
            {configurationStatus.success ? (
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            )}
            <div className="flex-1">
              <h4 className={`font-medium ${
                configurationStatus.success ? 'text-green-900' : 'text-red-900'
              }`}>
                {configurationStatus.success ? 'Configuration Successful' : 'Configuration Failed'}
              </h4>
              
              {configurationStatus.success ? (
                <div className="mt-2">
                  <p className="text-sm text-green-800">
                    Successfully configured {configurationStatus.configuredDomains.length} target domain(s):
                  </p>
                  <ul className="mt-1 list-disc list-inside text-sm text-green-700">
                    {configurationStatus.configuredDomains.map(domain => (
                      <li key={domain}>
                        {domain} → {configurationStatus.targetAdminEmails[domain]}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="mt-2">
                  <p className="text-sm text-red-800">Configuration errors:</p>
                  <ul className="mt-1 list-disc list-inside text-sm text-red-700">
                    {configurationStatus.errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Target User Discovery Results */}
      {discoveryResults && (
        <div className={`p-4 rounded-lg ${
          discoveryResults.success ? 'bg-blue-50 border border-blue-200' : 'bg-red-50 border border-red-200'
        }`}>
          <div className="flex items-start space-x-3">
            {discoveryResults.success ? (
              <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            )}
            <div className="flex-1">
              <h4 className={`font-medium ${
                discoveryResults.success ? 'text-blue-900' : 'text-red-900'
              }`}>
                {discoveryResults.success ? 'Target User Discovery Successful' : 'Target User Discovery Failed'}
              </h4>
              <p className={`text-sm mt-1 ${
                discoveryResults.success ? 'text-blue-800' : 'text-red-800'
              }`}>
                {discoveryResults.message}
              </p>

              {discoveryResults.success && discoveryResults.usersByDomain && (
                <div className="mt-3">
                  <h5 className="text-sm font-medium text-blue-900 mb-2">Discovered Users by Domain:</h5>
                  <div className="space-y-2">
                    {Object.entries(discoveryResults.usersByDomain).map(([domain, users]) => {
                      const userList = users as any[];
                      return (
                        <div key={domain} className="bg-white p-3 rounded border">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-mono text-sm text-blue-800">{domain}</span>
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                              {userList.length} users
                            </span>
                          </div>
                          <div className="text-xs text-gray-600 max-h-20 overflow-y-auto">
                            {userList.slice(0, 5).map((user, index) => (
                              <div key={index} className="truncate">
                                {user.primaryEmail} ({user.name?.fullName || 'No name'})
                              </div>
                            ))}
                            {userList.length > 5 && (
                              <div className="text-gray-500 italic">
                                ... and {userList.length - 5} more users
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {discoveryResults.errors && Object.keys(discoveryResults.errors).length > 0 && (
                <div className="mt-3">
                  <h5 className="text-sm font-medium text-red-900 mb-2">Errors by Domain:</h5>
                  <ul className="list-disc list-inside text-sm text-red-700">
                    {Object.entries(discoveryResults.errors).map(([domain, error]) => (
                      <li key={domain}>{domain}: {error as string}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="p-4 bg-yellow-50 rounded-lg">
        <h4 className="text-sm font-medium text-yellow-900 mb-2">Important Notes:</h4>
        <div className="text-xs text-yellow-800 space-y-1">
          <p>1. Ensure your service account has domain-wide delegation configured in Google Admin Console</p>
          <p>2. Each target domain admin must grant domain-wide delegation to your service account</p>
          <p>3. The service account must have the following scopes:</p>
          <ul className="list-disc list-inside ml-4 mt-1">
            <li>https://www.googleapis.com/auth/admin.directory.user</li>
            <li>https://www.googleapis.com/auth/admin.directory.group</li>
          </ul>
          <p>4. After configuration, you can proceed with "Get Target users by service account authentication"</p>
        </div>
      </div>
    </div>
  );
};

export default ServiceAccountTargetSetup;
