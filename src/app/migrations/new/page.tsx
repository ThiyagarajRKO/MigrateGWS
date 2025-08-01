'use client';

import { useState, lazy, Suspense } from 'react';
import { useAuth } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { 
  MigrationScenario, 
  MigrationStatus,
  createMigrationScenario,
  SINGLE_SUPER_ADMIN_STEPS,
  CROSS_TENANT_STEPS,
  DomainMappingConfig
} from '@/types/migration-scenarios';
import { 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle, 
  Circle, 
  AlertCircle, 
  Clock, 
  Users, 
  Database, 
  Settings, 
  Shield, 
  Info, 
  Zap, 
  FileText, 
  Calendar, 
  Mail, 
  HardDrive, 
  MessageSquare, 
  Image, 
  Phone,
  PlayCircle,
  Eye,
  Cog,
  X,
  Loader2
} from 'lucide-react';

// Dynamic imports for heavy components
const ScenarioSelector = lazy(() => import('@/components/ScenarioSelector'));
const DomainMappingSelector = lazy(() => import('@/components/DomainMappingSelector'));
const DomainWideDelegationSetup = lazy(() => import('@/components/DomainWideDelegationSetup'));
const UserDiscovery = lazy(() => import('@/components/UserDiscovery'));
const MigrationProgress = lazy(() => import('@/components/MigrationProgress'));

// Loading component
const ComponentLoader = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
        <p className="text-gray-600">Loading component...</p>
      </div>
    </div>
  }>
    {children}
  </Suspense>
);

type WizardStep = 'scenario' | 'domain-mapping' | 'configuration' | 'review' | 'migration';

const SERVICE_ICONS = {
  'Gmail': Mail,
  'Drive': HardDrive,
  'Calendar': Calendar,
  'Contacts': Phone,
  'Photos': Image,
  'Chat': MessageSquare
} as const;

const STEP_CONFIG = {
  scenario: { icon: Users, title: 'Choose Migration Type', description: 'Select your migration scenario' },
  'domain-mapping': { icon: Database, title: 'Configure Domains', description: 'Set up domain relationships' },
  configuration: { icon: Cog, title: 'Migration Settings', description: 'Configure services and options' },
  review: { icon: Eye, title: 'Review & Confirm', description: 'Review your migration setup' },
  migration: { icon: PlayCircle, title: 'Migration in Progress', description: 'Monitoring your migration' }
} as const;

export default function NewMigration() {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState<WizardStep>('scenario');
  const [selectedScenario, setSelectedScenario] = useState<MigrationScenario | null>(null);
  const [domainMapping, setDomainMapping] = useState<DomainMappingConfig | null>(null);
  const [migrationConfig, setMigrationConfig] = useState({
    sourceDomain: '',
    targetDomain: '',
    services: [] as string[],
    userMappings: [] as Array<{ sourceEmail: string; targetEmail: string }>,
    migrationOptions: {
      preserveLabels: true,
      migrateFolderStructure: true,
      enableDeltaSync: false,
      migrateSharedDrives: true,
      maintainPermissions: true,
    }
  });

  // Domain-wide Delegation state
  const [dwdSetupComplete, setDwdSetupComplete] = useState(false);
  const [sourceAdminEmail, setSourceAdminEmail] = useState('');
  const [sourceAdminEmails, setSourceAdminEmails] = useState<{[domain: string]: string}>({});
  const [targetAdminEmail, setTargetAdminEmail] = useState('');
  const [targetAdminEmails, setTargetAdminEmails] = useState<{[domain: string]: string}>({});
  const [showDwdSetup, setShowDwdSetup] = useState(false);

  // User Discovery state
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);
  const [showUserDiscovery, setShowUserDiscovery] = useState(false);

  const [migrationStatus, setMigrationStatus] = useState<MigrationStatus | null>(null);

  const handleScenarioSelect = (scenario: MigrationScenario) => {
    setSelectedScenario(scenario);
    setCurrentStep('domain-mapping');
  };

  const handleDomainMappingSelect = (mapping: DomainMappingConfig) => {
    setDomainMapping(mapping);
    
    // Determine target domain for migration config
    let targetDomain = mapping.targetDomain;
    if (mapping.type === 'one-to-many' && mapping.multiTargetConfig && mapping.multiTargetConfig.length > 0) {
      targetDomain = mapping.multiTargetConfig[0].domain;
    }
    
    // Auto-populate source and target domains from mapping
    setMigrationConfig(prev => ({
      ...prev,
      sourceDomain: mapping.sourceDomains[0] || '',
      targetDomain: targetDomain
    }));
    
    // Initialize source admin emails for multiple source domains (cross-tenant only)
    if (selectedScenario === 'cross-tenant' && mapping.sourceDomains.length > 1) {
      const newSourceAdminEmails: {[domain: string]: string} = {};
      mapping.sourceDomains.forEach(domain => {
        newSourceAdminEmails[domain] = sourceAdminEmails[domain] || '';
      });
      setSourceAdminEmails(newSourceAdminEmails);
    }
    
    // Initialize target admin emails for multiple target domains
    if (mapping.type === 'one-to-many' && mapping.multiTargetConfig) {
      const newTargetAdminEmails: {[domain: string]: string} = {};
      mapping.multiTargetConfig.forEach(config => {
        newTargetAdminEmails[config.domain] = targetAdminEmails[config.domain] || '';
      });
      setTargetAdminEmails(newTargetAdminEmails);
    }
    
    setCurrentStep('configuration');
  };

  const handleServiceToggle = (service: string) => {
    setMigrationConfig(prev => ({
      ...prev,
      services: prev.services.includes(service)
        ? prev.services.filter(s => s !== service)
        : [...prev.services, service]
    }));
  };

  const handleNext = () => {
    switch (currentStep) {
      case 'scenario':
        setCurrentStep('domain-mapping');
        break;
      case 'domain-mapping':
        setCurrentStep('configuration');
        break;
      case 'configuration':
        setCurrentStep('review');
        break;
      case 'review':
        startMigration();
        break;
    }
  };

  const handleBack = () => {
    switch (currentStep) {
      case 'domain-mapping':
        setCurrentStep('scenario');
        break;
      case 'configuration':
        setCurrentStep('domain-mapping');
        break;
      case 'review':
        setCurrentStep('configuration');
        break;
      case 'migration':
        setCurrentStep('review');
        break;
    }
  };

  const startMigration = () => {
    if (!selectedScenario) return;

    const scenario = {
      type: selectedScenario,
      steps: selectedScenario === 'single-super-admin' 
        ? SINGLE_SUPER_ADMIN_STEPS 
        : CROSS_TENANT_STEPS
    };

    const status: MigrationStatus = {
      id: `migration-${Date.now()}`,
      scenarioType: selectedScenario,
      status: 'running',
      currentStep: scenario.steps[0].id,
      startTime: new Date().toISOString(),
      estimatedCompletion: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(), // 6 hours from now
      overallProgress: 0,
      errors: []
    };

    setMigrationStatus(status);
    setCurrentStep('migration');
  };

  // Handle Domain-wide Delegation setup completion
  const handleDwdSetupComplete = () => {
    setDwdSetupComplete(true);
    setShowDwdSetup(false);
  };

  // Get target domains for multi-target scenarios
  const getTargetDomains = (): string[] => {
    if (!domainMapping) return [migrationConfig.targetDomain].filter(Boolean);
    
    if (domainMapping.type === 'one-to-many' && domainMapping.multiTargetConfig) {
      return domainMapping.multiTargetConfig.map(config => config.domain).filter(Boolean);
    }
    
    return [domainMapping.targetDomain].filter(Boolean);
  };

  // Get source domains for multi-source scenarios
  const getSourceDomains = (): string[] => {
    if (!domainMapping) return [migrationConfig.sourceDomain].filter(Boolean);
    
    return domainMapping.sourceDomains.filter(Boolean);
  };

  // Check if all required admin emails are provided
  const areAllAdminEmailsProvided = (): boolean => {
    if (selectedScenario === 'single-super-admin') {
      if (!sourceAdminEmail) return false;
      
      // Check if target admin emails are needed for multiple targets
      const targetDomains = getTargetDomains();
      if (targetDomains.length <= 1) {
        return true; // Single target domain - sourceAdminEmail is sufficient
      } else {
        // Multiple target domains - check all have admin emails
        return targetDomains.every(domain => !!targetAdminEmails[domain]);
      }
    }
    
    // Cross-tenant scenario
    const sourceDomains = getSourceDomains();
    const targetDomains = getTargetDomains();
    
    // Check source domains
    if (sourceDomains.length <= 1) {
      if (!sourceAdminEmail) return false;
    } else {
      // Multiple source domains - check all have admin emails
      if (!sourceDomains.every(domain => !!sourceAdminEmails[domain])) return false;
    }
    
    // Check target domains
    if (targetDomains.length <= 1) {
      return !!targetAdminEmail;
    } else {
      // Multiple target domains - check all have admin emails
      return targetDomains.every(domain => !!targetAdminEmails[domain]);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'scenario':
        return (
          <div className="space-y-8">
            {/* Header */}
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl">
                  <Users className="h-8 w-8 text-blue-600" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                Choose Your Migration Scenario
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Select the migration type that best fits your organization's structure and requirements.
              </p>
            </div>

            {/* Scenario Selection */}
            <div className="max-w-4xl mx-auto">
              <ComponentLoader>
                <ScenarioSelector 
                  selectedScenario={selectedScenario} 
                  onScenarioSelect={handleScenarioSelect} 
                />
              </ComponentLoader>
            </div>

            {/* Info Panel */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
              <div className="flex items-start space-x-3">
                <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-medium text-blue-900 mb-2">Need Help Choosing?</h3>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• <strong>Single Super Admin:</strong> Best for organizations with multiple domains under one workspace</li>
                    <li>• <strong>Cross-Tenant:</strong> Ideal for mergers, acquisitions, or completely separate organizations</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        );

      case 'domain-mapping':
        if (!selectedScenario) return null;
        return (
          <div className="space-y-8">
            {/* Header */}
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-gradient-to-br from-emerald-100 to-green-100 rounded-xl">
                  <Database className="h-8 w-8 text-emerald-600" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                Configure Domain Mapping
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Define how your source domains will be mapped to target domains.
              </p>
            </div>

            {/* Selected Scenario Badge */}
            <div className="flex justify-center">
              <div className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                <CheckCircle className="h-4 w-4 mr-2" />
                {selectedScenario === 'single-super-admin' ? 'Single Super Admin Migration' : 'Cross-Tenant Migration'}
              </div>
            </div>

            {/* Domain Mapping Component */}
            <div className="max-w-4xl mx-auto">
              <ComponentLoader>
                <DomainMappingSelector
                  selectedScenario={selectedScenario}
                  selectedMapping={domainMapping}
                  onMappingSelect={handleDomainMappingSelect}
                />
              </ComponentLoader>
            </div>
          </div>
        );

      case 'configuration':
        return (
          <div className="space-y-8">
            {/* Header */}
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-xl">
                  <Cog className="h-8 w-8 text-purple-600" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                Configure Migration Settings
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Choose which services to migrate and configure advanced options.
              </p>
            </div>

            {/* Configuration Summary */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-blue-900 mb-2 flex items-center">
                    <Shield className="h-5 w-5 mr-2" />
                    Migration Type
                  </h3>
                  <p className="text-blue-800">
                    {selectedScenario === 'single-super-admin' ? 'Single Super Admin Migration' : 'Cross-Tenant Migration'}
                  </p>
                </div>
                {domainMapping && (
                  <div>
                    <h3 className="font-semibold text-blue-900 mb-2 flex items-center">
                      <Database className="h-5 w-5 mr-2" />
                      Domain Mapping
                    </h3>
                    <p className="text-blue-800">{domainMapping.description}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Domain-wide Delegation Setup */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Shield className="h-6 w-6 text-indigo-600" />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Domain-wide Delegation Setup
                    </h3>
                    <p className="text-sm text-gray-600">
                      Configure secure cross-domain access for migration
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {dwdSetupComplete ? (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="h-5 w-5" />
                      <span className="text-sm font-medium">Setup Complete</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-yellow-600">
                      <AlertCircle className="h-5 w-5" />
                      <span className="text-sm font-medium">Setup Required</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Admin Email Configuration */}
              <div className="mb-4">
                {selectedScenario === 'single-super-admin' ? (
                  // Single Super Admin - Source admin email + target admin emails if multiple targets
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Super Admin Email
                      </label>
                      <input
                        type="email"
                        value={sourceAdminEmail}
                        onChange={(e) => setSourceAdminEmail(e.target.value)}
                        placeholder="admin@your-domain.com"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Super admin email with access to both source and target domains
                      </p>
                    </div>

                    {/* Target Domain Admin Emails for Multiple Targets */}
                    {(() => {
                      const targetDomains = getTargetDomains();
                      
                      if (targetDomains.length > 1) {
                        return (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-3">
                              Target Domain Admin Emails
                            </label>
                            <div className="space-y-3">
                              {targetDomains.map((domain, index) => (
                                <div key={domain} className="flex items-center space-x-3">
                                  <div className="flex-1">
                                    <div className="flex items-center space-x-2 mb-1">
                                      <span className="text-sm font-medium text-gray-600">
                                        Target Domain {index + 1}:
                                      </span>
                                      <span className="text-sm text-blue-600 font-mono bg-blue-50 px-2 py-1 rounded">
                                        {domain}
                                      </span>
                                    </div>
                                    <input
                                      type="email"
                                      value={targetAdminEmails[domain] || ''}
                                      onChange={(e) => setTargetAdminEmails(prev => ({
                                        ...prev,
                                        [domain]: e.target.value
                                      }))}
                                      placeholder={`admin@${domain}`}
                                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                  </div>
                                </div>
                              ))}
                              <p className="text-xs text-gray-500 mt-2">
                                Admin email for each target Google Workspace domain (may be the same as super admin if cross-domain access is configured)
                              </p>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                ) : (
                  // Cross-Tenant - Source admin email + target admin emails
                  <div className="space-y-4">
                    {/* Source Domain Admin Email(s) */}
                    <div className="space-y-3">
                      {getSourceDomains().length > 1 ? (
                        // Multiple source domains
                        getSourceDomains().map((domain, index) => (
                          <div key={domain}>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              {index === 0 ? 'Primary ' : ''}Source Domain Admin Email {domain && `(${domain})`}
                            </label>
                            <input
                              type="email"
                              value={sourceAdminEmails[domain] || ''}
                              onChange={(e) => setSourceAdminEmails(prev => ({
                                ...prev,
                                [domain]: e.target.value
                              }))}
                              placeholder={`admin@${domain}`}
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Super admin email for {domain}
                            </p>
                          </div>
                        ))
                      ) : (
                        // Single source domain
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Source Domain Admin Email
                          </label>
                          <input
                            type="email"
                            value={sourceAdminEmail}
                            onChange={(e) => setSourceAdminEmail(e.target.value)}
                            placeholder="admin@source-domain.com"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Super admin email for the source Google Workspace domain
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Target Domain Admin Emails */}
                    {(() => {
                      const targetDomains = getTargetDomains();
                      
                      if (targetDomains.length <= 1) {
                        // Single target domain
                        return (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Target Domain Admin Email
                            </label>
                            <input
                              type="email"
                              value={targetAdminEmail}
                              onChange={(e) => setTargetAdminEmail(e.target.value)}
                              placeholder="admin@target-domain.com"
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Super admin email for the target Google Workspace domain
                            </p>
                          </div>
                        );
                      } else {
                        // Multiple target domains
                        return (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-3">
                              Target Domain Admin Emails
                            </label>
                            <div className="space-y-3">
                              {targetDomains.map((domain, index) => (
                                <div key={domain} className="flex items-center space-x-3">
                                  <div className="flex-1">
                                    <div className="flex items-center space-x-2 mb-1">
                                      <span className="text-sm font-medium text-gray-600">
                                        Domain {index + 1}:
                                      </span>
                                      <span className="text-sm text-blue-600 font-mono bg-blue-50 px-2 py-1 rounded">
                                        {domain}
                                      </span>
                                    </div>
                                    <input
                                      type="email"
                                      value={targetAdminEmails[domain] || ''}
                                      onChange={(e) => setTargetAdminEmails(prev => ({
                                        ...prev,
                                        [domain]: e.target.value
                                      }))}
                                      placeholder={`admin@${domain}`}
                                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                  </div>
                                </div>
                              ))}
                              <p className="text-xs text-gray-500 mt-2">
                                Super admin email for each target Google Workspace domain
                              </p>
                            </div>
                          </div>
                        );
                      }
                    })()}
                  </div>
                )}
              </div>

              {/* Setup Actions */}
              <div className="flex items-center gap-3 pt-3 border-t border-gray-200">
                {!dwdSetupComplete ? (
                  <button
                    onClick={() => setShowDwdSetup(true)}
                    disabled={!areAllAdminEmailsProvided()}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    <Settings className="h-4 w-4" />
                    Configure Domain-wide Delegation
                  </button>
                ) : (
                  <button
                    onClick={() => setShowDwdSetup(true)}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
                  >
                    <Settings className="h-4 w-4" />
                    Reconfigure Setup
                  </button>
                )}
                
                <div className="text-sm text-gray-500">
                  {areAllAdminEmailsProvided()
                    ? 'Ready to configure delegation' 
                    : selectedScenario === 'single-super-admin'
                      ? (() => {
                          if (!sourceAdminEmail) return 'Enter super admin email to begin setup';
                          
                          const targetDomains = getTargetDomains();
                          if (targetDomains.length > 1) {
                            const missingCount = targetDomains.length - targetDomains.filter(domain => targetAdminEmails[domain]).length;
                            if (missingCount > 0) return `Enter admin emails for ${missingCount} remaining target domain${missingCount > 1 ? 's' : ''}`;
                          }
                          
                          return 'Enter admin emails to begin setup';
                        })()
                      : (() => {
                          const sourceDomains = getSourceDomains();
                          const targetDomains = getTargetDomains();
                          
                          // Check source domains
                          if (sourceDomains.length <= 1) {
                            if (!sourceAdminEmail) return 'Enter source admin email to begin setup';
                          } else {
                            const missingSourceCount = sourceDomains.length - sourceDomains.filter(domain => sourceAdminEmails[domain]).length;
                            if (missingSourceCount > 0) return `Enter admin emails for ${missingSourceCount} remaining source domain${missingSourceCount > 1 ? 's' : ''}`;
                          }
                          
                          // Check target domains
                          if (targetDomains.length <= 1) {
                            if (!targetAdminEmail) return 'Enter target admin email to begin setup';
                          } else {
                            const missingTargetCount = targetDomains.length - targetDomains.filter(domain => targetAdminEmails[domain]).length;
                            if (missingTargetCount > 0) return `Enter admin emails for ${missingTargetCount} remaining target domain${missingTargetCount > 1 ? 's' : ''}`;
                          }
                          
                          return 'Enter admin emails to begin setup';
                        })()
                  }
                </div>
              </div>

              {/* DWD Setup Modal/Expanded View */}
              {showDwdSetup && (
                <div className="mt-6 p-6 bg-gray-50 border border-gray-200 rounded-xl">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-gray-900">
                      Domain-wide Delegation Configuration
                    </h4>
                    <button
                      onClick={() => setShowDwdSetup(false)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  
                  <ComponentLoader>
                    <DomainWideDelegationSetup
                      sourceAccount={sourceAdminEmail}
                      destAccount={getTargetDomains().length <= 1 ? targetAdminEmail : undefined}
                      destAccounts={getTargetDomains().length > 1 ? targetAdminEmails : undefined}
                      onComplete={handleDwdSetupComplete}
                      className="bg-white"
                    />
                  </ComponentLoader>
                </div>
              )}

              {/* User Discovery Modal */}
              {showUserDiscovery && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                  <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
                    <div className="flex items-center justify-between p-6 border-b border-gray-200">
                      <h4 className="text-xl font-semibold text-gray-900">
                        User Discovery - {migrationConfig.sourceDomain}
                      </h4>
                      <button
                        onClick={() => setShowUserDiscovery(false)}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                    
                    <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                      <ComponentLoader>
                        <UserDiscovery
                          sourceDomain={migrationConfig.sourceDomain}
                          targetDomain={migrationConfig.targetDomain}
                          onUsersSelected={setSelectedUsers}
                          onComplete={() => setShowUserDiscovery(false)}
                        />
                      </ComponentLoader>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
              {/* Domain Configuration */}
              <div className="space-y-6">
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Database className="h-5 w-5 mr-2 text-gray-600" />
                    Domain Configuration
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {getSourceDomains().length > 1 ? 'Primary Source Domain' : 'Source Domain'}
                      </label>
                      <input
                        type="text"
                        value={migrationConfig.sourceDomain}
                        onChange={(e) => setMigrationConfig(prev => ({ ...prev, sourceDomain: e.target.value }))}
                        placeholder="e.g., oldcompany.com"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                      {getSourceDomains().length > 1 && (
                        <p className="text-xs text-gray-500 mt-1">
                          Primary domain for migration. Total source domains: {getSourceDomains().length}
                        </p>
                      )}
                    </div>

                    {/* Multiple Source Domains Display */}
                    {getSourceDomains().length > 1 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          All Source Domains
                        </label>
                        <div className="space-y-2">
                          {getSourceDomains().map((domain, index) => (
                            <div key={domain} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                              <div className="flex items-center space-x-2">
                                <span className="text-sm text-gray-500">#{index + 1}</span>
                                <span className="font-mono text-sm text-gray-900">{domain}</span>
                                {index === 0 && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    Primary
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {getTargetDomains().length > 1 ? 'Primary Target Domain' : 'Target Domain'}
                      </label>
                      <input
                        type="text"
                        value={migrationConfig.targetDomain}
                        onChange={(e) => setMigrationConfig(prev => ({ ...prev, targetDomain: e.target.value }))}
                        placeholder="e.g., newcompany.com"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                      {getTargetDomains().length > 1 && (
                        <p className="text-xs text-gray-500 mt-1">
                          Primary domain for migration. Total target domains: {getTargetDomains().length}
                        </p>
                      )}
                    </div>
                    
                    {/* Multiple Target Domains Display */}
                    {getTargetDomains().length > 1 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          All Target Domains
                        </label>
                        <div className="space-y-2">
                          {getTargetDomains().map((domain, index) => (
                            <div key={domain} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                              <div className="flex items-center space-x-2">
                                <span className="text-sm text-gray-500">#{index + 1}</span>
                                <span className="font-mono text-sm text-gray-900">{domain}</span>
                                {index === 0 && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    Primary
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Migration Options */}
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Settings className="h-5 w-5 mr-2 text-gray-600" />
                    Advanced Options
                  </h3>
                  <div className="space-y-4">
                    {Object.entries(migrationConfig.migrationOptions).map(([key, value]) => (
                      <label key={key} className="flex items-start space-x-3">
                        <input
                          type="checkbox"
                          checked={value}
                          onChange={(e) => setMigrationConfig(prev => ({
                            ...prev,
                            migrationOptions: {
                              ...prev.migrationOptions,
                              [key]: e.target.checked
                            }
                          }))}
                          className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <div>
                          <span className="text-sm font-medium text-gray-900">
                            {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                          </span>
                          <p className="text-xs text-gray-500 mt-1">
                            {getOptionDescription(key)}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Services Selection */}
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Zap className="h-5 w-5 mr-2 text-gray-600" />
                  Services to Migrate
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {['Gmail', 'Drive', 'Calendar', 'Contacts', 'Photos', 'Chat'].map(service => {
                    const IconComponent = SERVICE_ICONS[service as keyof typeof SERVICE_ICONS];
                    const isSelected = migrationConfig.services.includes(service);
                    
                    return (
                      <label 
                        key={service} 
                        className={`relative flex flex-col items-center p-4 border-2 rounded-xl cursor-pointer transition-all ${
                          isSelected 
                            ? 'border-blue-500 bg-blue-50 text-blue-700' 
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleServiceToggle(service)}
                          className="sr-only"
                        />
                        <IconComponent className={`h-8 w-8 mb-2 ${isSelected ? 'text-blue-600' : 'text-gray-400'}`} />
                        <span className={`text-sm font-medium ${isSelected ? 'text-blue-900' : 'text-gray-700'}`}>
                          {service}
                        </span>
                        {isSelected && (
                          <CheckCircle className="absolute top-2 right-2 h-5 w-5 text-blue-600" />
                        )}
                      </label>
                    );
                  })}
                </div>
                
                {/* Service Summary */}
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Selected Services:</span>
                    <span className="font-medium text-gray-900">
                      {migrationConfig.services.length} of 6 services
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {migrationConfig.services.map(service => (
                      <span key={service} className="inline-flex items-center px-2 py-1 rounded-md bg-blue-100 text-blue-800 text-xs font-medium">
                        {service}
                      </span>
                    ))}
                  </div>
                  
                  {/* Discover Users Button */}
                  {migrationConfig.services.length > 0 && migrationConfig.sourceDomain && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <button
                        onClick={() => setShowUserDiscovery(true)}
                        className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
                      >
                        <Users className="h-5 w-5" />
                        <span>Discover Users in {migrationConfig.sourceDomain}</span>
                      </button>
                      
                      {selectedUsers.length > 0 && (
                        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                          <div className="flex items-center text-green-800">
                            <CheckCircle className="h-4 w-4 mr-2" />
                            <span className="text-sm font-medium">
                              {selectedUsers.length} users selected for migration
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );

      case 'review':
        return (
          <div className="space-y-8">
            {/* Header */}
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl">
                  <Eye className="h-8 w-8 text-green-600" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                Review Migration Configuration
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Please review all settings before starting the migration process.
              </p>
            </div>

            {/* Review Cards */}
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Migration Overview */}
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Shield className="h-5 w-5 mr-2 text-gray-600" />
                  Migration Overview
                </h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Migration Type</div>
                    <div className="font-medium text-gray-900">
                      {selectedScenario === 'single-super-admin' ? 'Single Super Admin Migration' : 'Cross-Tenant Migration'}
                    </div>
                  </div>
                  {domainMapping && (
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Domain Strategy</div>
                      <div className="font-medium text-gray-900">{domainMapping.description}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Domain Configuration */}
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Database className="h-5 w-5 mr-2 text-gray-600" />
                  Domain Configuration
                </h3>
                <div className="space-y-4">
                  {domainMapping && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="font-mono text-sm">
                        {domainMapping.type === 'one-to-many' ? (
                          <div>
                            <div className="text-gray-700 mb-2">Source Domains:</div>
                            <div className="ml-4 space-y-1">
                              {domainMapping.sourceDomains.map((domain, idx) => (
                                <div key={idx} className="text-blue-600">• {domain}</div>
                              ))}
                            </div>
                            <div className="text-gray-700 mt-3 mb-2">Target Domains:</div>
                            <div className="ml-4 space-y-1">
                              {domainMapping.targetDomains?.map((target, idx) => (
                                <div key={idx} className="text-green-600">→ {target}</div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center space-x-4">
                            <span className="text-blue-600 font-medium">
                              {domainMapping.sourceDomains.join(', ')}
                            </span>
                            <ArrowRight className="h-4 w-4 text-gray-400" />
                            <span className="text-green-600 font-medium">
                              {domainMapping.targetDomain}
                            </span>
                          </div>
                        )}
                        {domainMapping.preserveSourceAsAlias && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <span className="text-xs text-blue-600 font-medium">
                              ✓ Source domains will be preserved as aliases
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Source Domain</div>
                      <div className="font-medium text-gray-900">{migrationConfig.sourceDomain}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Target Domain</div>
                      <div className="font-medium text-gray-900">{migrationConfig.targetDomain}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Domain-wide Delegation Status */}
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Shield className="h-5 w-5 mr-2 text-gray-600" />
                  Domain-wide Delegation Setup
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <div>
                      <div className="font-medium text-green-800">Configuration Complete</div>
                      <div className="text-sm text-green-700">Domain-wide delegation has been configured for both domains</div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    {(() => {
                      const sourceDomains = getSourceDomains();
                      
                      if (selectedScenario === 'single-super-admin') {
                        return (
                          <div>
                            <div className="text-sm text-gray-600 mb-1">Super Admin Email</div>
                            <div className="font-medium text-gray-900">{sourceAdminEmail}</div>
                          </div>
                        );
                      } else if (sourceDomains.length <= 1) {
                        return (
                          <div>
                            <div className="text-sm text-gray-600 mb-1">Source Admin Email</div>
                            <div className="font-medium text-gray-900">{sourceAdminEmail}</div>
                          </div>
                        );
                      } else {
                        return (
                          <div>
                            <div className="text-sm text-gray-600 mb-2">Source Admin Emails</div>
                            <div className="space-y-2">
                              {sourceDomains.map((domain, index) => (
                                <div key={domain} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                                  <div className="flex items-center space-x-2">
                                    <span className="text-sm text-gray-500">Domain {index + 1}:</span>
                                    <span className="text-sm font-mono text-green-600 bg-green-50 px-2 py-1 rounded">
                                      {domain}
                                    </span>
                                  </div>
                                  <div className="font-medium text-gray-900">{sourceAdminEmails[domain]}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }
                    })()}
                    
                    {(() => {
                      const targetDomains = getTargetDomains();
                      
                      if (targetDomains.length <= 1) {
                        return selectedScenario === 'cross-tenant' ? (
                          <div>
                            <div className="text-sm text-gray-600 mb-1">Target Admin Email</div>
                            <div className="font-medium text-gray-900">{targetAdminEmail}</div>
                          </div>
                        ) : null; // For single super admin with single target, no separate target admin needed
                      } else {
                        return (
                          <div>
                            <div className="text-sm text-gray-600 mb-2">Target Admin Emails</div>
                            <div className="space-y-2">
                              {targetDomains.map((domain, index) => (
                                <div key={domain} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                                  <div className="flex items-center space-x-2">
                                    <span className="text-sm text-gray-500">Domain {index + 1}:</span>
                                    <span className="text-sm font-mono text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                      {domain}
                                    </span>
                                  </div>
                                  <div className="font-medium text-gray-900">{targetAdminEmails[domain]}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }
                    })()}
                  </div>
                </div>
              </div>

              {/* Services & Options */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Services */}
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Zap className="h-5 w-5 mr-2 text-gray-600" />
                    Services ({migrationConfig.services.length})
                  </h3>
                  <div className="space-y-2">
                    {migrationConfig.services.map(service => {
                      const IconComponent = SERVICE_ICONS[service as keyof typeof SERVICE_ICONS];
                      return (
                        <div key={service} className="flex items-center space-x-3">
                          <IconComponent className="h-5 w-5 text-blue-600" />
                          <span className="text-gray-900">{service}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Advanced Options */}
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Settings className="h-5 w-5 mr-2 text-gray-600" />
                    Advanced Options
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(migrationConfig.migrationOptions)
                      .filter(([_, value]) => value)
                      .map(([key]) => (
                        <div key={key} className="flex items-center space-x-3">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="text-gray-900 text-sm">
                            {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>

              {/* Selected Users */}
              {selectedUsers.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Users className="h-5 w-5 mr-2 text-gray-600" />
                    Selected Users ({selectedUsers.length})
                  </h3>
                  <div className="space-y-3">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-gray-600 mb-1">Total Users</div>
                        <div className="font-medium text-gray-900">{selectedUsers.length}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600 mb-1">Admin Users</div>
                        <div className="font-medium text-gray-900">
                          {selectedUsers.filter(user => user.isAdmin).length}
                        </div>
                      </div>
                    </div>
                    <div className="max-h-32 overflow-y-auto">
                      <div className="text-sm text-gray-600 mb-2">Users to migrate:</div>
                      <div className="space-y-1">
                        {selectedUsers.slice(0, 10).map(user => (
                          <div key={user.id} className="flex items-center space-x-2 text-sm">
                            <Mail className="h-3 w-3 text-gray-400" />
                            <span className="text-gray-900">{user.name.fullName}</span>
                            <span className="text-gray-500">({user.primaryEmail})</span>
                            {user.isAdmin && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                Admin
                              </span>
                            )}
                          </div>
                        ))}
                        {selectedUsers.length > 10 && (
                          <div className="text-sm text-gray-500 italic">
                            ...and {selectedUsers.length - 10} more users
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Warning */}
            <div className="max-w-4xl mx-auto">
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="h-6 w-6 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-yellow-900 mb-2">⚠️ Important Pre-Migration Checklist</h3>
                    <ul className="text-sm text-yellow-800 space-y-2">
                      <li className="flex items-start space-x-2">
                        <Circle className="h-3 w-3 mt-1 flex-shrink-0" />
                        <span>Ensure you have proper administrative access to both source and target domains</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <Circle className="h-3 w-3 mt-1 flex-shrink-0" />
                        <span>Verify all service accounts have been configured with domain-wide delegation</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <Circle className="h-3 w-3 mt-1 flex-shrink-0" />
                        <span>Users will be notified automatically about the migration process</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <Circle className="h-3 w-3 mt-1 flex-shrink-0" />
                        <span>This process cannot be easily reversed once started - ensure all settings are correct</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'migration':
        if (!selectedScenario || !migrationStatus) return null;
        
        const scenario = {
          type: selectedScenario,
          steps: selectedScenario === 'single-super-admin' 
            ? SINGLE_SUPER_ADMIN_STEPS 
            : CROSS_TENANT_STEPS
        };

        return (
          <div className="space-y-8">
            {/* Header */}
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl">
                  <PlayCircle className="h-8 w-8 text-green-600" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                Migration in Progress
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Your migration is now running. You can monitor the progress below.
              </p>
            </div>

            {/* Migration Progress Component */}
            <ComponentLoader>
              <MigrationProgress 
                migrationStatus={migrationStatus}
                steps={scenario.steps}
                onStepAction={(stepId, action) => {
                  console.log(`Step action: ${action} on step ${stepId}`);
                  // TODO: Implement step action handling
                }}
              />
            </ComponentLoader>
          </div>
        );

      default:
        return null;
    }
  };

  const getOptionDescription = (key: string): string => {
    const descriptions: Record<string, string> = {
      preserveLabels: 'Keep Gmail labels and folder organization intact',
      migrateFolderStructure: 'Maintain Drive folder hierarchy and structure',
      enableDeltaSync: 'Only migrate changes since last sync (for incremental migrations)',
      migrateSharedDrives: 'Include shared drives and team drives in migration',
      maintainPermissions: 'Preserve file and folder sharing permissions'
    };
    return descriptions[key] || 'Advanced migration option';
  };

  const getStepNumber = () => {
    switch (currentStep) {
      case 'scenario': return 1;
      case 'domain-mapping': return 2;
      case 'configuration': return 3;
      case 'review': return 4;
      case 'migration': return 5;
      default: return 1;
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'scenario':
        return selectedScenario !== null;
      case 'domain-mapping':
        return domainMapping !== null;
      case 'configuration':
        return migrationConfig.sourceDomain && 
               migrationConfig.targetDomain && 
               migrationConfig.services.length > 0 &&
               dwdSetupComplete &&
               areAllAdminEmailsProvided() &&
               selectedUsers.length > 0; // Require users to be selected
      case 'review':
        return true;
      default:
        return false;
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Enhanced Progress Steps */}
          <div className="mb-12">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between relative">
                {/* Progress Line */}
                <div className="absolute top-6 left-0 right-0 h-0.5 bg-gray-200">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-500"
                    style={{ width: `${((getStepNumber() - 1) / 4) * 100}%` }}
                  />
                </div>
                
                {/* Steps */}
                {Object.entries(STEP_CONFIG).map(([stepKey, config], index) => {
                  const stepNumber = index + 1;
                  const isActive = stepNumber === getStepNumber();
                  const isCompleted = stepNumber < getStepNumber();
                  const IconComponent = config.icon;
                  
                  return (
                    <div key={stepKey} className="relative flex flex-col items-center">
                      {/* Step Circle */}
                      <div className={`relative z-10 flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all duration-300 ${
                        isCompleted 
                          ? 'bg-gradient-to-r from-blue-500 to-indigo-600 border-blue-500 text-white shadow-lg' 
                          : isActive
                          ? 'bg-white border-blue-500 text-blue-600 shadow-lg ring-4 ring-blue-100'
                          : 'bg-white border-gray-300 text-gray-400'
                      }`}>
                        {isCompleted ? (
                          <CheckCircle className="h-6 w-6" />
                        ) : (
                          <IconComponent className="h-5 w-5" />
                        )}
                      </div>
                      
                      {/* Step Info */}
                      <div className="mt-3 text-center">
                        <div className={`text-sm font-semibold ${
                          isActive ? 'text-blue-600' : isCompleted ? 'text-gray-900' : 'text-gray-500'
                        }`}>
                          {config.title}
                        </div>
                        <div className={`text-xs mt-1 max-w-24 ${
                          isActive ? 'text-blue-500' : 'text-gray-400'
                        }`}>
                          {config.description}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Main Content Card */}
          <div className="max-w-6xl mx-auto">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-8 py-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl font-bold text-white">
                      Create New Migration
                    </h1>
                    {currentStep !== 'scenario' && (
                      <p className="text-blue-100 mt-1">
                        Step {getStepNumber()} of 5: {STEP_CONFIG[currentStep].title}
                      </p>
                    )}
                  </div>
                  {currentStep !== 'scenario' && currentStep !== 'migration' && (
                    <div className="flex items-center space-x-2 text-blue-100">
                      <Clock className="h-4 w-4" />
                      <span className="text-sm">Est. {5 - getStepNumber()} steps remaining</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="p-8">
                {renderStepContent()}
              </div>

              {/* Navigation */}
              {currentStep !== 'migration' && (
                <div className="bg-gray-50 px-8 py-6 border-t border-gray-100">
                  <div className="flex justify-between items-center">
                    <button
                      onClick={handleBack}
                      disabled={currentStep === 'scenario'}
                      className={`flex items-center px-6 py-3 text-sm font-medium rounded-lg transition-all ${
                        currentStep === 'scenario'
                          ? 'text-gray-400 cursor-not-allowed'
                          : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100 border border-gray-300'
                      }`}
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back
                    </button>

                    <div className="flex items-center space-x-4">
                      {!canProceed() && currentStep !== 'scenario' && (
                        <div className="flex items-center text-orange-600 text-sm">
                          <AlertCircle className="h-4 w-4 mr-2" />
                          Complete all required fields to continue
                        </div>
                      )}
                      <button
                        onClick={handleNext}
                        disabled={!canProceed()}
                        className={`flex items-center px-8 py-3 text-sm font-medium rounded-lg transition-all ${
                          canProceed()
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        {currentStep === 'review' ? (
                          <>
                            <PlayCircle className="h-4 w-4 mr-2" />
                            Start Migration
                          </>
                        ) : (
                          <>
                            Continue
                            <ArrowRight className="h-4 w-4 ml-2" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
