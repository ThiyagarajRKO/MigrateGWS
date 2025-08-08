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
    description: 'One-to-many migration from rrgokuldham.com to multiple target domains'
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
    description: 'Simple one-to-one domain migration'
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
    description: 'Cross-tenant one-to-many migration with department-based distribution'
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
    const message = `🎉 User Discovery Ready!

Migration Type: ${data.domainMapping?.type ?? currentDomainMapping.type}
Source Domains: ${data.sourceDomains.join(', ')}
Target Domains: ${data.targetDomains.join(', ')}
Configured Domains: ${Object.keys(data.adminEmails).length}
Verification Token: ${data.verificationToken ?? 'N/A'}

Next Step: User enumeration will begin for source domains.`;

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
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Migration Scenario Configuration
        </h1>
        
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
              <div className="font-semibold mb-2">{config.type.replace('-', ' to ').toUpperCase()}</div>
              <div className="text-sm opacity-75">{config.description}</div>
              <div className="text-xs mt-2 space-y-1">
                <div>Source: {config.sourceDomains.join(', ')}</div>
                <div>Target: {config.targetDomains?.join(', ')}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Migration Scenario Toggle */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Migration Scenario</h3>
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
              Single Super Admin
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
        <h2 className="text-xl font-bold text-gray-900 mb-4">Current Configuration</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <div className="p-3 bg-blue-50 rounded-lg">
            <div className="font-medium text-blue-900">Migration Type</div>
            <div className="text-blue-700">{currentDomainMapping.type}</div>
          </div>
          <div className="p-3 bg-green-50 rounded-lg">
            <div className="font-medium text-green-900">User Mapping</div>
            <div className="text-green-700">{currentDomainMapping.userMappingStrategy}</div>
          </div>
          <div className="p-3 bg-purple-50 rounded-lg">
            <div className="font-medium text-purple-900">Distribution</div>
            <div className="text-purple-700">{'distributionStrategy' in currentDomainMapping && currentDomainMapping.distributionStrategy ? currentDomainMapping.distributionStrategy : 'N/A'}</div>
          </div>
          <div className="p-3 bg-amber-50 rounded-lg">
            <div className="font-medium text-amber-900">Cross-Tenant</div>
            <div className="text-amber-700">{currentDomainMapping.allowCrossTenant ? 'Yes' : 'No'}</div>
          </div>
          <div className="p-3 bg-red-50 rounded-lg">
            <div className="font-medium text-red-900">Verification</div>
            <div className="text-red-700">{verificationStatus ? '✓ Verified' : '⚠ Pending'}</div>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="font-medium text-gray-900">Admin Emails</div>
            <div className="text-gray-700">{Object.keys(adminEmails).length} configured</div>
          </div>
        </div>

        {/* Domain Lists */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Source Domains</h4>
            <div className="space-y-1">
              {currentDomainMapping.sourceDomains.map((domain) => (
                <div key={domain} className="px-3 py-2 bg-blue-100 text-blue-800 rounded">
                  📤 {domain}
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Target Domains</h4>
            <div className="space-y-1">
              {currentDomainMapping.targetDomains?.map((domain) => (
                <div key={domain} className="px-3 py-2 bg-green-100 text-green-800 rounded">
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
