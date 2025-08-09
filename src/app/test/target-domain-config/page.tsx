'use client';

import React, { useState } from 'react';
import TargetDomainAdminConfig from '@/components/TargetDomainAdminConfig';
import { getDefaultTargetAdminEmails, validateTargetDomainConfig, type TargetDomainConfig } from '@/utils/targetDomainConfig';

export default function TargetDomainConfigTestPage() {
  const [targetDomains] = useState<string[]>([
    'sample.arakutourism.net',
    'migrate.arakutourism.net'
  ]);
  
  const [targetAdminEmails, setTargetAdminEmails] = useState<TargetDomainConfig>({});
  const [migrationScenario, setMigrationScenario] = useState<'single-super-admin' | 'cross-tenant'>('cross-tenant');

  const handleConfigChange = (emails: TargetDomainConfig) => {
    setTargetAdminEmails(emails);
    console.log('Target admin emails updated:', emails);
  };

  const handleLoadDefaults = () => {
    const defaults = getDefaultTargetAdminEmails();
    setTargetAdminEmails(defaults);
  };

  const handleExportConfig = () => {
    const config = {
      targetDomains,
      targetAdminEmails,
      migrationScenario,
      timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'target-domain-config.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const validation = validateTargetDomainConfig(targetDomains, targetAdminEmails);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Target Domain Admin Configuration
          </h1>
          <p className="text-gray-600">
            Configure admin emails for target Google Workspace domains to enable service account authentication.
          </p>
        </div>

        {/* Migration Scenario Selector */}
        <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Migration Scenario</h3>
          <div className="flex space-x-4">
            <label className="flex items-center">
              <input
                type="radio"
                value="cross-tenant"
                checked={migrationScenario === 'cross-tenant'}
                onChange={(e) => setMigrationScenario(e.target.value as 'cross-tenant')}
                className="mr-2"
              />
              <span>Cross-Tenant (Individual admin emails per domain)</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="single-super-admin"
                checked={migrationScenario === 'single-super-admin'}
                onChange={(e) => setMigrationScenario(e.target.value as 'single-super-admin')}
                className="mr-2"
              />
              <span>Single Super Admin</span>
            </label>
          </div>
        </div>

        {/* Configuration Component */}
        <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
          <TargetDomainAdminConfig
            targetDomains={targetDomains}
            targetAdminEmails={targetAdminEmails}
            onConfigChange={handleConfigChange}
            migrationScenario={migrationScenario}
          />
        </div>

        {/* Actions */}
        <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Actions</h3>
          <div className="flex space-x-4">
            <button
              onClick={handleLoadDefaults}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Load Default Configuration
            </button>
            <button
              onClick={handleExportConfig}
              disabled={!validation.isValid}
              className={`px-4 py-2 rounded-lg transition-colors ${
                validation.isValid
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Export Configuration
            </button>
          </div>
        </div>

        {/* Current Configuration Display */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Current Configuration</h3>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Target Domains:</h4>
              <div className="space-y-1">
                {targetDomains.map(domain => (
                  <div key={domain} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="font-mono text-sm">{domain}</span>
                    <span className={`text-sm ${
                      targetAdminEmails[domain] ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {targetAdminEmails[domain] || 'Not configured'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Validation Status:</h4>
              <div className={`p-3 rounded-lg ${
                validation.isValid ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
              }`}>
                {validation.isValid ? (
                  '✅ All target domains have admin emails configured'
                ) : (
                  <>
                    ❌ {validation.message}
                    {validation.missingDomains.length > 0 && (
                      <div className="mt-2">
                        <strong>Missing domains:</strong> {validation.missingDomains.join(', ')}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Configuration JSON:</h4>
              <pre className="bg-gray-50 p-3 rounded-lg text-xs overflow-x-auto">
                {JSON.stringify({ targetAdminEmails }, null, 2)}
              </pre>
            </div>
          </div>
        </div>

        {/* Help Section */}
        <div className="bg-blue-50 p-6 rounded-lg mt-6">
          <h3 className="text-lg font-medium text-blue-900 mb-4">Next Steps</h3>
          <ol className="list-decimal list-inside space-y-2 text-blue-800">
            <li>Configure the admin email addresses for each target domain above</li>
            <li>Ensure each admin has domain-wide delegation configured for your service account</li>
            <li>Copy the configuration JSON to your migration wizard</li>
            <li>Proceed with "Get Target users by service account authentication"</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
