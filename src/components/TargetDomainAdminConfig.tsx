'use client';

import React, { useState, useEffect } from 'react';
import { Mail, AlertCircle, CheckCircle, RefreshCw, Shield, Settings } from 'lucide-react';
import { 
  getDefaultTargetAdminEmails, 
  validateTargetDomainConfig,
  generateAdminEmailSuggestions,
  getTargetDomainStatus,
  validateAdminEmailFormat,
  type TargetDomainConfig 
} from '@/types/targetDomainConfig';

interface TargetDomainAdminConfigProps {
  targetDomains: string[];
  targetAdminEmails: TargetDomainConfig;
  onConfigChange: (emails: TargetDomainConfig) => void;
  migrationScenario?: 'single-super-admin' | 'cross-tenant';
  className?: string;
}

export const TargetDomainAdminConfig: React.FC<TargetDomainAdminConfigProps> = ({
  targetDomains,
  targetAdminEmails,
  onConfigChange,
  migrationScenario = 'cross-tenant',
  className = ''
}) => {
  const [localEmails, setLocalEmails] = useState<TargetDomainConfig>(targetAdminEmails);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [useServiceAccount, setUseServiceAccount] = useState(true);

  // Get service account email from environment
  const serviceAccountEmail = process.env.NEXT_PUBLIC_GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL || 
                              process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL;

  useEffect(() => {
    setLocalEmails(targetAdminEmails);
  }, [targetAdminEmails]);

  // Auto-configure with service account email when available
  useEffect(() => {
    if (useServiceAccount && serviceAccountEmail && targetDomains.length > 0) {
      const serviceAccountConfig = Object.fromEntries(
        targetDomains.map(domain => [domain, serviceAccountEmail])
      );
      setLocalEmails(serviceAccountConfig);
      onConfigChange(serviceAccountConfig);
    }
  }, [useServiceAccount, serviceAccountEmail, targetDomains, onConfigChange]);

  const domainStatus = getTargetDomainStatus(targetDomains, localEmails, migrationScenario);
  const validation = validateTargetDomainConfig(targetDomains, localEmails);

  const handleEmailChange = (domain: string, email: string) => {
    const newEmails = {
      ...localEmails,
      [domain]: email
    };
    setLocalEmails(newEmails);
    onConfigChange(newEmails);
  };

  const handleAutoFill = () => {
    const suggestions = generateAdminEmailSuggestions(targetDomains);
    const newEmails = {
      ...localEmails,
      ...suggestions
    };
    setLocalEmails(newEmails);
    onConfigChange(newEmails);
  };

  const handleUseServiceAccount = () => {
    if (serviceAccountEmail) {
      const serviceAccountConfig = Object.fromEntries(
        targetDomains.map(domain => [domain, serviceAccountEmail])
      );
      setLocalEmails(serviceAccountConfig);
      onConfigChange(serviceAccountConfig);
      setUseServiceAccount(true);
    }
  };

  const handleCustomConfig = () => {
    setUseServiceAccount(false);
  };

  if (targetDomains.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Mail className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-medium text-gray-900">
            Target Domain Authentication
          </h3>
        </div>
        
        {/* Authentication Mode Toggle */}
        <div className="flex items-center space-x-2">
          {serviceAccountEmail && (
            <div className="flex items-center space-x-3 bg-green-50 px-3 py-2 rounded-lg border border-green-200">
              <Shield className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-800">Service Account Ready</span>
            </div>
          )}
        </div>
      </div>

      {/* Service Account Configuration */}
      {serviceAccountEmail ? (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-blue-900">Service Account Authentication (Recommended)</h4>
                <p className="text-sm text-blue-800 mt-1">
                  Using service account with domain-wide delegation for all target domains
                </p>
                <div className="mt-2 p-2 bg-blue-100 rounded border font-mono text-xs text-blue-900">
                  {serviceAccountEmail}
                </div>
                <div className="mt-2 flex items-center space-x-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      checked={useServiceAccount}
                      onChange={() => handleUseServiceAccount()}
                      className="text-blue-600"
                    />
                    <span className="text-sm text-blue-800">Use service account for all domains</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      checked={!useServiceAccount}
                      onChange={() => handleCustomConfig()}
                      className="text-blue-600"
                    />
                    <span className="text-sm text-blue-800">Configure custom admin emails</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-yellow-900">Service Account Not Configured</h4>
              <p className="text-sm text-yellow-800 mt-1">
                Service account email not found in environment variables. Custom admin emails required.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Status Overview - Only show if not using service account or if there are validation issues */}
      {(!useServiceAccount || !serviceAccountEmail) && !validation.isValid && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-yellow-900">Configuration Required</h4>
              <p className="text-sm text-yellow-800 mt-1">{validation.message}</p>
              {domainStatus.missing.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm font-medium text-yellow-900">Missing admin emails for:</p>
                  <ul className="mt-1 list-disc list-inside text-sm text-yellow-800">
                    {domainStatus.missing.map(domain => (
                      <li key={domain}>{domain}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {((useServiceAccount && serviceAccountEmail) || validation.isValid) && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center space-x-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <h4 className="font-medium text-green-900">Authentication Configured</h4>
              <p className="text-sm text-green-800">
                {useServiceAccount && serviceAccountEmail 
                  ? 'Service account authentication is ready for all target domains.' 
                  : 'All target domains have admin emails configured.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Domain Configuration Forms - Only show if not using service account */}
      {!useServiceAccount && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-md font-medium text-gray-900">Custom Admin Email Configuration</h4>
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={handleAutoFill}
                className="px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors"
              >
                Auto-fill
              </button>
            </div>
          </div>
          
          {targetDomains.map((domain, index) => {
            const email = localEmails[domain] || '';
            const isValid = email ? validateAdminEmailFormat(email, domain) : false;
            const isEmpty = !email.trim();
            
            return (
              <div key={domain} className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-600">
                      Target Domain {index + 1}:
                    </span>
                    <span className="text-sm text-blue-600 font-mono bg-blue-50 px-2 py-1 rounded">
                      {domain}
                    </span>
                  </div>
                  
                  {/* Status Indicator */}
                  <div className="flex items-center space-x-1">
                    {isEmpty ? (
                      <AlertCircle className="h-4 w-4 text-yellow-500" />
                    ) : isValid ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className={`text-xs font-medium ${
                      isEmpty ? 'text-yellow-600' :
                      isValid ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {isEmpty ? 'Required' : isValid ? 'Valid' : 'Invalid'}
                    </span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Admin Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => handleEmailChange(domain, e.target.value)}
                    placeholder={`admin@${domain}`}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent ${
                      isEmpty ? 'border-yellow-300 focus:ring-yellow-500' :
                      isValid ? 'border-green-300 focus:ring-green-500' :
                      'border-red-300 focus:ring-red-500'
                    }`}
                  />
                  {!isEmpty && !isValid && (
                    <p className="text-xs text-red-600">
                      Admin email must be a valid email address from the domain {domain}
                    </p>
                  )}
                  <p className="text-xs text-gray-500">
                    Super admin email for the Google Workspace domain {domain}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Help Text */}
      <div className="p-3 bg-blue-50 rounded-lg">
        <h4 className="text-sm font-medium text-blue-900 mb-1">Authentication Methods:</h4>
        <div className="text-xs text-blue-800 space-y-1">
          {serviceAccountEmail ? (
            <>
              <p><strong>Service Account (Recommended):</strong> Uses domain-wide delegation to authenticate across all target domains automatically</p>
              <p><strong>Custom Admin Emails:</strong> Specify individual super admin emails for each target domain</p>
            </>
          ) : (
            <>
              <p>1. Enter the super admin email for each target Google Workspace domain</p>
              <p>2. Ensure each admin has domain-wide delegation configured for the service account</p>
              <p>3. The admin emails will be used for service account authentication during user creation</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TargetDomainAdminConfig;
