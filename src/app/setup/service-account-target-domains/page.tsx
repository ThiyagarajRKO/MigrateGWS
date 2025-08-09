'use client';

import React, { useState, useEffect } from 'react';
import ServiceAccountTargetSetup from '@/components/ServiceAccountTargetSetup';
import { autoConfigureTargetDomains, type TargetDomainConfig } from '@/utils/targetDomainConfig';
import { CheckCircle, ArrowRight, Copy } from 'lucide-react';

export default function ServiceAccountSetupPage() {
  const [targetDomains] = useState<string[]>([
    'sample.arakutourism.net',
    'migrate.arakutourism.net'
  ]);
  
  const [configuredAdminEmails, setConfiguredAdminEmails] = useState<TargetDomainConfig>({});
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    // Check if we already have configuration
    const autoConfig = autoConfigureTargetDomains();
    if (Object.keys(autoConfig).length > 0) {
      setConfiguredAdminEmails(autoConfig);
    }
  }, []);

  const handleConfigurationComplete = (config: TargetDomainConfig) => {
    setConfiguredAdminEmails(config);
    setIsConfigured(true);
    
    // Log the configuration for debugging
    console.log('Target domain configuration completed:', config);
    
    // Store in localStorage for persistence
    localStorage.setItem('targetDomainAdminEmails', JSON.stringify(config));
  };

  const handleCopyConfiguration = () => {
    const configText = JSON.stringify(configuredAdminEmails, null, 2);
    navigator.clipboard.writeText(configText);
    alert('Configuration copied to clipboard!');
  };

  const handleApplyToMigrationWizard = () => {
    // Store configuration in sessionStorage for the migration wizard
    sessionStorage.setItem('targetAdminEmails', JSON.stringify(configuredAdminEmails));
    
    // Navigate to migration wizard
    window.location.href = '/migrations/new#user-management';
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Service Account Target Domain Setup
          </h1>
          <p className="text-gray-600">
            Configure admin emails for target domains using service account authentication.
            This will resolve the "Target Domain Configuration Required" error.
          </p>
        </div>

        {/* Error Context */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-medium text-red-900 mb-2">Current Issue</h3>
          <div className="text-sm text-red-800">
            <p className="mb-2">Target domain admin configuration required for:</p>
            <ul className="list-disc list-inside space-y-1">
              {targetDomains.map(domain => (
                <li key={domain} className="font-mono">{domain}</li>
              ))}
            </ul>
            <p className="mt-2">
              <strong>For Cross-Tenant scenario:</strong> Configure individual admin emails for each target domain in the delegation setup step.
            </p>
          </div>
        </div>

        {/* Service Account Setup Component */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <ServiceAccountTargetSetup
            targetDomains={targetDomains}
            onConfigurationComplete={handleConfigurationComplete}
          />
        </div>

        {/* Configuration Result */}
        {isConfigured && Object.keys(configuredAdminEmails).length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
            <div className="flex items-center space-x-2 mb-4">
              <CheckCircle className="h-6 w-6 text-green-600" />
              <h3 className="text-lg font-medium text-green-900">Configuration Complete</h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-green-900 mb-2">Configured Admin Emails:</h4>
                <div className="bg-white rounded p-3 space-y-2">
                  {Object.entries(configuredAdminEmails).map(([domain, email]) => (
                    <div key={domain} className="flex items-center justify-between text-sm">
                      <span className="font-mono text-gray-900">{domain}</span>
                      <ArrowRight className="h-4 w-4 text-gray-400" />
                      <span className="font-mono text-blue-600">{email}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={handleCopyConfiguration}
                  className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Configuration
                </button>
                
                <button
                  onClick={handleApplyToMigrationWizard}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Apply to Migration Wizard
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Configuration JSON Display */}
        {Object.keys(configuredAdminEmails).length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Configuration JSON</h3>
            <pre className="bg-gray-50 p-4 rounded-lg text-sm overflow-x-auto">
              {JSON.stringify(configuredAdminEmails, null, 2)}
            </pre>
          </div>
        )}

        {/* Next Steps */}
        <div className="bg-blue-50 rounded-lg p-6 mt-6">
          <h3 className="text-lg font-medium text-blue-900 mb-4">Next Steps</h3>
          <div className="space-y-3 text-sm text-blue-800">
            <div className="flex items-start space-x-2">
              <span className="bg-blue-200 text-blue-900 rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium mt-0.5">1</span>
              <p>Click "Auto-Configure Target Domains" to set up the admin email configuration</p>
            </div>
            <div className="flex items-start space-x-2">
              <span className="bg-blue-200 text-blue-900 rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium mt-0.5">2</span>
              <p>Ensure domain-wide delegation is configured for your service account in each target domain's Google Admin Console</p>
            </div>
            <div className="flex items-start space-x-2">
              <span className="bg-blue-200 text-blue-900 rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium mt-0.5">3</span>
              <p>Click "Apply to Migration Wizard" to use the configuration in your migration process</p>
            </div>
            <div className="flex items-start space-x-2">
              <span className="bg-blue-200 text-blue-900 rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium mt-0.5">4</span>
              <p>Proceed with "Get Target users by service account authentication" in the migration wizard</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
