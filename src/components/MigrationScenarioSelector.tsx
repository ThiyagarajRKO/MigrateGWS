import React, { useState, useCallback } from 'react';
import DomainWideDelegationSetup from './DomainWideDelegationSetup';
import type { DomainMappingConfig } from '../types/migration-scenarios';

// Example configurations for different scenarios
export const DOMAIN_MAPPING_EXAMPLES = {
  // Your current configuration (from the image)
  oneToMany: {
    type: 'one-to-many' as const,
    sourceDomains: ['rrgokuldham.com'],
    targetDomains: ['sample.arakutourism.net', 'migrate.arakutourism.net'],
    multiTargetConfig: [
      {
        domain: 'sample.arakutourism.net',
        conflictResolution: 'prefix' as const,
        preserveGroups: true,
        emailForwarding: false,
        userMappings: []
      },
      {
        domain: 'migrate.arakutourism.net',
        conflictResolution: 'prefix' as const,
        preserveGroups: true,
        emailForwarding: false,
        userMappings: []
      }
    ],
    userMappingStrategy: 'manual' as const,
    distributionStrategy: 'round-robin' as const,
    preserveSourceAsAlias: true,
    allowCrossTenant: false,
    preserveStructure: true,
    description: 'One source to multiple targets'
  },

  // Simple one-to-one scenario
  oneToOne: {
    type: 'one-to-one' as const,
    sourceDomains: ['company-old.com'],
    targetDomains: ['company-new.com'],
    userMappingStrategy: 'manual' as const,
    preserveSourceAsAlias: true,
    allowCrossTenant: false,
    preserveStructure: true,
    description: 'Direct domain migration'
  },

  // Cross-tenant one-to-many
  crossTenantOneToMany: {
    type: 'cross-tenant-multi-target' as const,
    sourceDomains: ['source-company.com'],
    targetDomains: ['target1.com', 'target2.com'],
    multiTargetConfig: [
      {
        domain: 'target1.com',
        conflictResolution: 'prefix' as const,
        preserveGroups: true,
        emailForwarding: true,
        userMappings: []
      },
      {
        domain: 'target2.com',
        conflictResolution: 'suffix' as const,
        preserveGroups: true,
        emailForwarding: true,
        userMappings: []
      }
    ],
    userMappingStrategy: 'manual' as const,
    distributionStrategy: 'by-department' as const,
    preserveSourceAsAlias: false,
    allowCrossTenant: true,
    preserveStructure: false,
    description: 'Cross-tenant with dept distribution'
  }
};

interface MigrationScenarioSelectorProps {
  onComplete?: () => void;
}

export const MigrationScenarioSelector: React.FC<MigrationScenarioSelectorProps> = ({ onComplete }) => {
  const [selectedScenario, setSelectedScenario] = useState<keyof typeof DOMAIN_MAPPING_EXAMPLES>('oneToMany');
  const [migrationScenario, setMigrationScenario] = useState<'single-super-admin' | 'cross-tenant'>('single-super-admin');
  const [verificationStatus, setVerificationStatus] = useState<boolean>(false);
  const [adminEmails, setAdminEmails] = useState<{[key: string]: string}>({});

  // Get the current domain mapping configuration
  const currentDomainMapping = DOMAIN_MAPPING_EXAMPLES[selectedScenario];

  // Handle scenario change
  const handleScenarioChange = useCallback((scenario: keyof typeof DOMAIN_MAPPING_EXAMPLES) => {
    setSelectedScenario(scenario);
    setVerificationStatus(false);
    setAdminEmails({});
    
    // Auto-adjust migration scenario based on domain mapping type
    if (scenario === 'crossTenantOneToMany' || currentDomainMapping.allowCrossTenant) {
      setMigrationScenario('cross-tenant');
    } else {
      setMigrationScenario('single-super-admin');
    }
  }, [currentDomainMapping]);

  // Handle verification status changes
  const handleVerificationStatusChange = useCallback((status: boolean) => {
    console.log('[MigrationScenarioSelector] Verification status changed:', status);
    setVerificationStatus(status);
  }, []);

  // Handle admin email changes
  const handleAdminEmailChange = useCallback((email: string) => {
    console.log('[MigrationScenarioSelector] Admin email changed:', email);
    setAdminEmails(prev => ({ ...prev, admin: email }));
  }, []);

  // Handle source admin emails changes
  const handleSourceAdminEmailsChange = useCallback((emails: {[domain: string]: string}) => {
    console.log('[MigrationScenarioSelector] Source admin emails changed:', emails);
    setAdminEmails(prev => ({ ...prev, ...emails }));
  }, []);

  // Handle destination admin emails changes
  const handleDestAdminEmailsChange = useCallback((emails: {[domain: string]: string}) => {
    console.log('[MigrationScenarioSelector] Dest admin emails changed:', emails);
    setAdminEmails(prev => ({ ...prev, ...emails }));
  }, []);

  // Handle user discovery ready
  const handleUserDiscoveryReady = useCallback((data: {
    sourceDomains: string[];
    targetDomains: string[];
    adminEmails: { [domain: string]: string };
    scenario: 'single-super-admin' | 'cross-tenant';
    verificationToken?: string;
    domainMapping: any;
  }) => {
    console.log('[MigrationScenarioSelector] User discovery ready:', data);

    // Show success message with details
    const message = `🎉 Setup Complete!

Type: ${data.domainMapping?.type ?? currentDomainMapping.type}
Sources: ${data.sourceDomains.join(', ')}
Targets: ${data.targetDomains.join(', ')}
Ready for user discovery.`;

    alert(message);
  }, [currentDomainMapping.type]);

  // Handle completion
  const handleComplete = useCallback(() => {
    console.log('[MigrationScenarioSelector] Domain-wide delegation setup completed');
    onComplete?.();
  }, [onComplete]);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Scenario Selector */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">
              Migration Scenario
            </h1>
            <div className="flex items-center space-x-6 text-sm">
              <div className="flex items-center space-x-2">
                <span className="text-gray-600">Scenario:</span>
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded font-medium">
                  {migrationScenario === 'single-super-admin' ? 'Single Admin' : 'Cross-Tenant'}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-gray-600">Strategy:</span>
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded font-medium">
                  {currentDomainMapping.userMappingStrategy}
                </span>
              </div>
            </div>
          </div>
          <div className="text-right text-sm text-gray-500">
            <div>{currentDomainMapping.type.replace('-', ' ')}</div>
            <div className="text-xs mt-1">
              {currentDomainMapping.sourceDomains.length} → {currentDomainMapping.targetDomains?.length || 0}
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {Object.entries(DOMAIN_MAPPING_EXAMPLES).map(([key, config]) => (
            <button
              key={key}
              onClick={() => handleScenarioChange(key as keyof typeof DOMAIN_MAPPING_EXAMPLES)}
              className={`p-4 rounded-lg border-2 transition-all ${
                selectedScenario === key
                  ? 'border-blue-500 bg-blue-50 text-blue-900'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="font-semibold mb-2">{config.type.replace('-', ' ').toUpperCase()}</div>
              <div className="text-sm opacity-75">{config.description}</div>
            </button>
          ))}
        </div>

        {/* Migration Scenario Toggle */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Auth Method</h3>
          <div className="flex space-x-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="migrationScenario"
                value="single-super-admin"
                checked={migrationScenario === 'single-super-admin'}
                onChange={(e) => setMigrationScenario(e.target.value as 'single-super-admin')}
                className="mr-2"
              />
              Single Admin
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="migrationScenario"
                value="cross-tenant"
                checked={migrationScenario === 'cross-tenant'}
                onChange={(e) => setMigrationScenario(e.target.value as 'cross-tenant')}
                className="mr-2"
              />
              Cross-Tenant
            </label>
          </div>
        </div>
      </div>

      {/* Current Configuration Display */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Configuration</h2>
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center space-x-2">
                <span className="text-gray-600">Status:</span>
                <span className={`px-2 py-1 rounded font-medium ${
                  verificationStatus 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {verificationStatus ? '✓ Ready' : '⚠ Setup Required'}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-gray-600">Admins:</span>
                <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded font-medium">
                  {Object.keys(adminEmails).length} configured
                </span>
              </div>
            </div>
          </div>
          <div className="text-right text-sm text-gray-500">
            <div className="font-medium">{currentDomainMapping.type}</div>
            <div className="text-xs mt-1">
              Cross-tenant: {currentDomainMapping.allowCrossTenant ? 'Yes' : 'No'}
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
          <div className="p-3 bg-blue-50 rounded-lg">
            <div className="font-medium text-blue-900">Type</div>
            <div className="text-blue-700 text-sm">{currentDomainMapping.type}</div>
          </div>
          <div className="p-3 bg-purple-50 rounded-lg">
            <div className="font-medium text-purple-900">Distribution</div>
            <div className="text-purple-700 text-sm">{'distributionStrategy' in currentDomainMapping && currentDomainMapping.distributionStrategy ? currentDomainMapping.distributionStrategy : 'Default'}</div>
          </div>
          <div className="p-3 bg-amber-50 rounded-lg">
            <div className="font-medium text-amber-900">Preserve</div>
            <div className="text-amber-700 text-sm">{currentDomainMapping.preserveStructure ? 'Structure' : 'Minimal'}</div>
          </div>
        </div>

        {/* Domain Lists */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Sources</h4>
            <div className="space-y-1">
              {currentDomainMapping.sourceDomains.map((domain) => (
                <div key={domain} className="px-3 py-2 bg-blue-100 text-blue-800 rounded text-sm">
                  📤 {domain}
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Targets</h4>
            <div className="space-y-1">
              {currentDomainMapping.targetDomains?.map((domain) => (
                <div key={domain} className="px-3 py-2 bg-green-100 text-green-800 rounded text-sm">
                  📥 {domain}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Domain-Wide Delegation Setup Component */}
        <DomainWideDelegationSetup
          migrationScenario={migrationScenario}
          domainMapping={currentDomainMapping}
          onComplete={handleComplete}
          onVerificationStatusChange={handleVerificationStatusChange}
          onAdminEmailChange={handleAdminEmailChange}
          onsourceAdminEmailsChange={handleSourceAdminEmailsChange}
          ondestAdminEmailsChange={handleDestAdminEmailsChange}
          onUserDiscoveryReady={handleUserDiscoveryReady}
          className="w-full"
        />
      </div>

      {/* Debug Information */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Debug Information</h3>
        <pre className="text-xs bg-white p-3 rounded border overflow-auto">
          {JSON.stringify({
            selectedScenario,
            migrationScenario,
            verificationStatus,
            adminEmails,
            domainMapping: currentDomainMapping
          }, null, 2)}
        </pre>
      </div>
    </div>
  );
};

export default MigrationScenarioSelector;
