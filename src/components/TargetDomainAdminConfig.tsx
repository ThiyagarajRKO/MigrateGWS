'use client';

import React, { useState, useEffect } from 'react';
import { Mail, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { 
  getDefaultTargetAdminEmails, 
  validateTargetDomainConfig,
  generateAdminEmailSuggestions,
  getTargetDomainStatus,
  validateAdminEmailFormat,
  type TargetDomainConfig 
} from '@/utils/targetDomainConfig';

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

  useEffect(() => {
    setLocalEmails(targetAdminEmails);
  }, [targetAdminEmails]);

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

  const handleUseDefaults = () => {
    const defaults = getDefaultTargetAdminEmails();
    const relevantDefaults = Object.fromEntries(
      Object.entries(defaults).filter(([domain]) => targetDomains.includes(domain))
    );
    const newEmails = {
      ...localEmails,
      ...relevantDefaults
    };
    setLocalEmails(newEmails);
    onConfigChange(newEmails);
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
            Target Domain Admin Configuration
          </h3>
        </div>
        
        {/* Quick Actions */}
        <div className="flex space-x-2">
          {!domainStatus.allConfigured && (
            <>
              <button
                type="button"
                onClick={handleAutoFill}
                className="px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors"
              >
                Auto-fill
              </button>
              {(targetDomains.includes('sample.arakutourism.net') || targetDomains.includes('migrate.arakutourism.net')) && (
                <button
                  type="button"
                  onClick={handleUseDefaults}
                  className="px-3 py-1 text-sm bg-green-50 text-green-700 rounded-md hover:bg-green-100 transition-colors"
                >
                  Use Defaults
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Status Overview */}
      {!validation.isValid && (
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

      {validation.isValid && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center space-x-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <h4 className="font-medium text-green-900">Configuration Complete</h4>
              <p className="text-sm text-green-800">All target domains have admin emails configured.</p>
            </div>
          </div>
        </div>
      )}

      {/* Domain Configuration Forms */}
      <div className="space-y-4">
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

      {/* Help Text */}
      <div className="p-3 bg-blue-50 rounded-lg">
        <h4 className="text-sm font-medium text-blue-900 mb-1">Setup Instructions:</h4>
        <div className="text-xs text-blue-800 space-y-1">
          <p>1. Enter the super admin email for each target Google Workspace domain</p>
          <p>2. Ensure each admin has domain-wide delegation configured for the service account</p>
          <p>3. The admin emails will be used for service account authentication during user creation</p>
        </div>
      </div>
    </div>
  );
};

export default TargetDomainAdminConfig;
