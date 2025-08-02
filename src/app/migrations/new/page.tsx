'use client';

import { useState, lazy, Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  Loader2,
  Presentation,
  ClipboardList
} from 'lucide-react';

// Dynamic imports for heavy components with better loading strategies
const ScenarioSelector = lazy(() => 
  import('@/components/ScenarioSelector').then(module => ({ default: module.default }))
);
const DomainMappingSelector = lazy(() => 
  import('@/components/DomainMappingSelector').then(module => ({ default: module.default }))
);
const DomainWideDelegationSetup = lazy(() => 
  import('@/components/DomainWideDelegationSetup').then(module => ({ default: module.default }))
);
const UserDiscovery = lazy(() => 
  import('@/components/UserDiscovery').then(module => ({ default: module.default }))
);
const UserMapping = lazy(() => 
  import('@/components/UserMapping').then(module => ({ default: module.UserMapping }))
);
const MigrationProgress = lazy(() => 
  import('@/components/MigrationProgress').then(module => ({ default: module.default }))
);

// Optimized loading component with skeleton
const ComponentLoader = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={
    <div className="animate-pulse space-y-4">
      <div className="h-8 bg-gray-200 rounded w-1/4"></div>
      <div className="space-y-3">
        <div className="h-4 bg-gray-200 rounded"></div>
        <div className="h-4 bg-gray-200 rounded w-5/6"></div>
        <div className="h-4 bg-gray-200 rounded w-4/6"></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="h-32 bg-gray-200 rounded"></div>
        <div className="h-32 bg-gray-200 rounded"></div>
      </div>
    </div>
  }>
    {children}
  </Suspense>
);

type WizardStep = 'scenario' | 'domain-mapping' | 'delegation' | 'user-discovery' | 'user-mapping' | 'configuration' | 'review' | 'migration';

const SERVICE_ICONS = {
  'Gmail': Mail,
  'Drive': HardDrive,
  'Calendar': Calendar,
  'Contacts': Phone,
  'Photos': Image,
  'Chat': MessageSquare,
  'Groups': Users,
  'Forms': ClipboardList,
  'Slides': Presentation
} as const;

const STEP_CONFIG = {
  scenario: { 
    icon: Users, 
    title: 'Choose Migration Type', 
    description: 'Select your migration scenario' 
  },
  'domain-mapping': { 
    icon: Database, 
    title: 'Configure Domains', 
    description: 'Set up source and target domain relationships' 
  },
  delegation: { 
    icon: Shield, 
    title: 'Setup Delegation', 
    description: 'Configure domain-wide delegation and permissions' 
  },
  'user-discovery': { 
    icon: Users, 
    title: 'Discover Users', 
    description: 'Find and list all users from source domains' 
  },
  'user-mapping': { 
    icon: ArrowRight, 
    title: 'Map Users', 
    description: 'Configure how users will be mapped to target domains' 
  },
  configuration: { 
    icon: Cog, 
    title: 'Migration Settings', 
    description: 'Configure services, schedule, and notifications' 
  },
  review: { 
    icon: Eye, 
    title: 'Review & Confirm', 
    description: 'Review your migration setup before execution' 
  },
  migration: { 
    icon: PlayCircle, 
    title: 'Migration in Progress', 
    description: 'Monitor your migration progress in real-time' 
  }
} as const;

export default function NewMigration() {
  const { user } = useAuth();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<WizardStep>('scenario');
  const [selectedScenario, setSelectedScenario] = useState<MigrationScenario | null>(null);
  const [domainMapping, setDomainMapping] = useState<DomainMappingConfig | null>(null);

  // Helper functions for domain handling
  const getTargetDomainsFromMapping = (mapping: DomainMappingConfig) => {
    if (mapping.type === 'one-to-many') {
      if (mapping.multiTargetConfig && mapping.multiTargetConfig.length > 0) {
        return mapping.multiTargetConfig.map(config => config.domain);
      } else if (mapping.targetDomains && mapping.targetDomains.length > 0) {
        return mapping.targetDomains.filter(domain => domain.trim() !== '');
      }
    }
    return mapping.targetDomain ? [mapping.targetDomain] : [];
  };

  const formatTargetDomains = (mapping: DomainMappingConfig) => {
    const targets = getTargetDomainsFromMapping(mapping);
    if (targets.length === 1) {
      return targets[0];
    }
    return targets.filter(Boolean).join(', ');
  };
  const [migrationConfig, setMigrationConfig] = useState({
    sourceDomain: '',
    targetDomain: '',
    targetDomains: [] as string[], // Add support for multiple target domains
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
  const [dwdVerificationStatus, setDwdVerificationStatus] = useState(false);
  const [sourceAdminEmail, setSourceAdminEmail] = useState('');
  const [sourceAdminEmails, setSourceAdminEmails] = useState<{[domain: string]: string}>({});
  const [targetAdminEmail, setTargetAdminEmail] = useState('');
  const [targetAdminEmails, setTargetAdminEmails] = useState<{[domain: string]: string}>({});
  const [showDwdSetup, setShowDwdSetup] = useState(false);

  // User Discovery state
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);
  const [discoveredUsers, setDiscoveredUsers] = useState<any[]>([]);
  const [userMappings, setUserMappings] = useState<any[]>([]);

  const [migrationStatus, setMigrationStatus] = useState<MigrationStatus | null>(null);

  // Preload next components based on current step
  useEffect(() => {
    const preloadNext = () => {
      switch (currentStep) {
        case 'scenario':
          // Preload domain mapping selector
          import('@/components/DomainMappingSelector');
          break;
        case 'domain-mapping':
          // Preload delegation setup
          import('@/components/DomainWideDelegationSetup');
          break;
        case 'delegation':
          // Preload user discovery
          import('@/components/UserDiscovery');
          break;
        case 'user-discovery':
          // Preload user mapping
          import('@/components/UserMapping');
          break;
        case 'user-mapping':
          // Preload configuration components
          import('@/components/MigrationProgress');
          break;
        case 'configuration':
          // Migration progress will be needed soon
          import('@/components/MigrationProgress');
          break;
      }
    };

    // Delay preloading to not block initial render
    const timer = setTimeout(preloadNext, 100);
    return () => clearTimeout(timer);
  }, [currentStep]);

  // Debug useEffect to track verification status changes
  useEffect(() => {
    console.log('[Migration Wizard] dwdVerificationStatus changed:', dwdVerificationStatus, {
      currentStep,
      dwdSetupComplete,
      canProceedDelegation: currentStep === 'delegation' ? (dwdSetupComplete && areAllAdminEmailsProvided() && dwdVerificationStatus) : 'N/A'
    })
  }, [dwdVerificationStatus, dwdSetupComplete, currentStep])

  // Debug useEffect to track admin email changes
  useEffect(() => {
    console.log('[Migration Wizard] Admin emails changed:', {
      sourceAdminEmail,
      targetAdminEmail,
      sourceAdminEmails,
      targetAdminEmails,
      areAllAdminEmailsProvided: areAllAdminEmailsProvided()
    });
  }, [sourceAdminEmail, targetAdminEmail, sourceAdminEmails, targetAdminEmails])

  const handleScenarioSelect = (scenario: MigrationScenario) => {
    setSelectedScenario(scenario);
    setCurrentStep('domain-mapping');
  };

  const handleDomainMappingSelect = (mapping: DomainMappingConfig) => {
    setDomainMapping(mapping);
    
    // Use helper function to get target domains
    const targetDomains = getTargetDomainsFromMapping(mapping);
    const targetDomain = targetDomains[0] || '';
    
    // Auto-populate source and target domains from mapping
    setMigrationConfig(prev => ({
      ...prev,
      sourceDomain: mapping.sourceDomains[0] || '',
      targetDomain: targetDomain || '',
      targetDomains: targetDomains
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
    if (targetDomains.length > 1) {
      const newTargetAdminEmails: {[domain: string]: string} = {};
      targetDomains.forEach(domain => {
        newTargetAdminEmails[domain] = targetAdminEmails[domain] || '';
      });
      setTargetAdminEmails(newTargetAdminEmails);
    }
    
    setCurrentStep('delegation');
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
        setCurrentStep('delegation');
        break;
      case 'delegation':
        setCurrentStep('user-discovery');
        break;
      case 'user-discovery':
        setCurrentStep('user-mapping');
        break;
      case 'user-mapping':
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
      case 'delegation':
        setCurrentStep('domain-mapping');
        break;
      case 'user-discovery':
        setCurrentStep('delegation');
        break;
      case 'user-mapping':
        setCurrentStep('user-discovery');
        break;
      case 'configuration':
        setCurrentStep('user-mapping');
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

  // Handle verification status change
  const handleVerificationStatusChange = (isVerified: boolean) => {
    console.log('[Migration Wizard] Verification status changed:', isVerified, {
      currentStep,
      dwdSetupComplete,
      previousVerificationStatus: dwdVerificationStatus,
      adminEmailsProvided: areAllAdminEmailsProvided(),
      sourceAdminEmail,
      targetAdminEmail
    })
    setDwdVerificationStatus(isVerified);
    
    // Force a re-evaluation of canProceed after status change
    setTimeout(() => {
      console.log('[Migration Wizard] After verification status update:', {
        dwdVerificationStatus: isVerified,
        dwdSetupComplete,
        areAllAdminEmailsProvided: areAllAdminEmailsProvided(),
        canProceedNow: (dwdSetupComplete && areAllAdminEmailsProvided() && isVerified)
      });
    }, 100);
  };

  // Handle admin email changes from DomainWideDelegationSetup component
  const handleAdminEmailChange = (email: string) => {
    console.log('[Migration Wizard] Admin email changed:', email);
    // For single super admin, this serves as the source admin email
    setSourceAdminEmail(email);
  };

  const handleSourceEmailChange = (email: string) => {
    console.log('[Migration Wizard] Source email changed:', email);
    setSourceAdminEmail(email);
  };

  const handleDestEmailChange = (email: string) => {
    console.log('[Migration Wizard] Dest email changed:', email);
    setTargetAdminEmail(email);
  };

  const handleSourceEmailsChange = (emails: {[domain: string]: string}) => {
    console.log('[Migration Wizard] Source emails changed:', emails);
    setSourceAdminEmails(emails);
  };

  const handleDestEmailsChange = (emails: {[domain: string]: string}) => {
    console.log('[Migration Wizard] Dest emails changed:', emails);
    setTargetAdminEmails(emails);
  };

  // Get target domains for multi-target scenarios
  const getTargetDomains = (): string[] => {
    // First check if we have target domains array in migration config
    if (migrationConfig.targetDomains && migrationConfig.targetDomains.length > 0) {
      return migrationConfig.targetDomains.filter((domain): domain is string => Boolean(domain));
    }
    
    // Fallback to domain mapping configuration
    if (!domainMapping) return [migrationConfig.targetDomain].filter((domain): domain is string => Boolean(domain));
    
    if (domainMapping.type === 'one-to-many') {
      if (domainMapping.multiTargetConfig) {
        return domainMapping.multiTargetConfig.map(config => config.domain).filter((domain): domain is string => Boolean(domain));
      }
      if (domainMapping.targetDomains) {
        return domainMapping.targetDomains.filter((domain): domain is string => Boolean(domain));
      }
    }
    
    return [domainMapping.targetDomain].filter((domain): domain is string => Boolean(domain));
  };

  // Get source domains for multi-source scenarios
  const getSourceDomains = (): string[] => {
    if (!domainMapping) return [migrationConfig.sourceDomain].filter((domain): domain is string => Boolean(domain));
    
    return domainMapping.sourceDomains.filter((domain): domain is string => Boolean(domain));
  };

  // Check if all required admin emails are provided
  const areAllAdminEmailsProvided = (): boolean => {
    if (selectedScenario === 'single-super-admin') {
      // For single super admin, only source admin email is required
      // Target domain admin emails are not needed as the same admin manages both
      return !!sourceAdminEmail;
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

      case 'delegation':
        return (
          <div className="space-y-8">
            {/* Header */}
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl">
                  <Shield className="h-8 w-8 text-green-600" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                Setup Domain-wide Delegation
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Configure secure access permissions and service account delegation for your Google Workspace domains.
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
                  <p className="text-blue-800 text-sm">
                    {selectedScenario === 'single-super-admin' ? 'Single Super Admin Migration' : 'Cross-Tenant Migration'}
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-blue-900 mb-2 flex items-center">
                    <Database className="h-5 w-5 mr-2" />
                    Domain Configuration
                  </h3>
                  <p className="text-blue-800 text-sm">
                    {domainMapping ? domainMapping.description : 'Not configured'}
                  </p>
                </div>
              </div>
            </div>

            {/* Domain-wide Delegation Setup */}
            <div className="max-w-4xl mx-auto">
              <ComponentLoader>
                <DomainWideDelegationSetup
                  sourceAccount={sourceAdminEmail}
                  destAccount={getTargetDomains().length <= 1 ? targetAdminEmail : undefined}
                  destAccounts={getTargetDomains().length > 1 ? targetAdminEmails : undefined}
                  migrationScenario={selectedScenario || undefined}
                  domainMapping={domainMapping || undefined}
                  onComplete={handleDwdSetupComplete}
                  onVerificationStatusChange={handleVerificationStatusChange}
                  onAdminEmailChange={handleAdminEmailChange}
                  onSourceEmailChange={handleSourceEmailChange}
                  onDestEmailChange={handleDestEmailChange}
                  onSourceEmailsChange={handleSourceEmailsChange}
                  onDestEmailsChange={handleDestEmailsChange}
                  className="bg-white"
                />
              </ComponentLoader>
            </div>

            {/* Status Indicator */}
            <div className="flex justify-center">
              <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${
                dwdSetupComplete && dwdVerificationStatus
                  ? 'bg-green-100 text-green-800' 
                  : dwdSetupComplete
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {dwdSetupComplete && dwdVerificationStatus ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Domain-wide delegation verified successfully
                  </>
                ) : dwdSetupComplete ? (
                  <>
                    <Clock className="h-4 w-4 mr-2" />
                    Verify delegation configuration to continue
                  </>
                ) : (
                  <>
                    <Clock className="h-4 w-4 mr-2" />
                    Complete setup to continue
                  </>
                )}
              </div>
            </div>
          </div>
        );

      case 'user-discovery':
        return (
          <div className="space-y-8">
            {/* Header */}
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-xl">
                  <Users className="h-8 w-8 text-blue-600" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                Discover Users
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Find and list all users from your source domains for migration.
              </p>
            </div>

            {/* Configuration Summary */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-green-900 mb-2 flex items-center">
                    <Database className="h-5 w-5 mr-2" />
                    Source Domain
                  </h3>
                  <p className="text-green-800 text-sm">
                    {domainMapping?.sourceDomains?.[0] || 'Not configured'}
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-green-900 mb-2 flex items-center">
                    <Shield className="h-5 w-5 mr-2" />
                    Delegation Status
                  </h3>
                  <p className="text-green-800 text-sm">
                    {dwdSetupComplete && dwdVerificationStatus ? 'Verified' : dwdSetupComplete ? 'Setup Complete' : 'Pending'}
                  </p>
                </div>
              </div>
            </div>

            {/* User Discovery Component */}
            <div className="max-w-4xl mx-auto">
              <ComponentLoader>
                <UserDiscovery
                  sourceDomains={getSourceDomains()}
                  sourceAdminEmails={selectedScenario === 'cross-tenant' && getSourceDomains().length > 1 ? sourceAdminEmails : undefined}
                  sourceAdminEmail={selectedScenario === 'single-super-admin' || getSourceDomains().length <= 1 ? sourceAdminEmail : undefined}
                  onUsersSelected={(users: any[]) => {
                    setDiscoveredUsers(users);
                    setSelectedUsers(users); // Initially select all users
                  }}
                />
              </ComponentLoader>
            </div>

            {/* Status Indicator */}
            <div className="flex justify-center">
              <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${
                discoveredUsers.length > 0
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {discoveredUsers.length > 0 ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {discoveredUsers.length} users discovered
                  </>
                ) : (
                  <>
                    <Clock className="h-4 w-4 mr-2" />
                    Discovering users...
                  </>
                )}
              </div>
            </div>
          </div>
        );

      case 'user-mapping':
        return (
          <div className="space-y-8">
            {/* Header */}
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-xl">
                  <ArrowRight className="h-8 w-8 text-indigo-600" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                Map Users
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Configure how users from source domains will be mapped to target domains.
              </p>
            </div>

            {/* Discovery Summary */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <h3 className="font-semibold text-blue-900 mb-2 flex items-center">
                    <Users className="h-5 w-5 mr-2" />
                    Discovered Users
                  </h3>
                  <p className="text-blue-800 text-sm">
                    {discoveredUsers.length} users found
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-blue-900 mb-2 flex items-center">
                    <Database className="h-5 w-5 mr-2" />
                    Source Domain
                  </h3>
                  <p className="text-blue-800 text-sm">
                    {domainMapping?.sourceDomains?.[0] || 'Not configured'}
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-blue-900 mb-2 flex items-center">
                    <ArrowRight className="h-5 w-5 mr-2" />
                    Target Domains
                  </h3>
                  <p className="text-blue-800 text-sm">
                    {domainMapping ? formatTargetDomains(domainMapping) : 'Not configured'}
                  </p>
                </div>
              </div>
            </div>

            {/* User Mapping Component */}
            <div className="max-w-6xl mx-auto">
              <ComponentLoader>
                <UserMapping
                  sourceDomain={getSourceDomains()[0] || ''}
                  targetDomains={getTargetDomains()}
                  sourceAdminEmail={sourceAdminEmail}
                  targetAdminEmails={targetAdminEmails}
                  onMappingComplete={(mappings) => {
                    setUserMappings(mappings);
                  }}
                />
              </ComponentLoader>
            </div>

            {/* Status Indicator */}
            <div className="flex justify-center">
              <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${
                userMappings.length > 0
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {userMappings.length > 0 ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {userMappings.length} users mapped
                  </>
                ) : (
                  <>
                    <Clock className="h-4 w-4 mr-2" />
                    Configure user mappings
                  </>
                )}
              </div>
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
                  {dwdSetupComplete && dwdVerificationStatus ? (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="h-5 w-5" />
                      <span className="text-sm font-medium">Verified</span>
                    </div>
                  ) : dwdSetupComplete ? (
                    <div className="flex items-center gap-2 text-yellow-600">
                      <AlertCircle className="h-5 w-5" />
                      <span className="text-sm font-medium">Verification Required</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-red-600">
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
                      
                      // For single-super-admin, we don't need separate target domain admin emails
                      // The super admin should have access to all domains
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
                      
                      // Only show target domain admin emails for cross-tenant migrations
                      if (selectedScenario === 'cross-tenant') {
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
                      }
                      
                      // For single super admin migrations, no target admin emails needed
                      return null;
                    })()}
                  </div>
                )}
              </div>

              {/* User Discovery Modal - REMOVED */}
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
                <div className="grid grid-cols-3 gap-4">
                  {['Gmail', 'Drive', 'Calendar', 'Contacts', 'Photos', 'Chat', 'Groups', 'Forms', 'Slides'].map(service => {
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
                      {migrationConfig.services.length} of 9 services
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {migrationConfig.services.map(service => (
                      <span key={service} className="inline-flex items-center px-2 py-1 rounded-md bg-blue-100 text-blue-800 text-xs font-medium">
                        {service}
                      </span>
                    ))}
                  </div>
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
                              {getTargetDomainsFromMapping(domainMapping).map((target, idx) => (
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
                      <div className="text-sm text-gray-600 mb-1">
                        Target Domain{migrationConfig.targetDomains.length > 1 ? 's' : ''}
                      </div>
                      <div className="font-medium text-gray-900">
                        {domainMapping ? formatTargetDomains(domainMapping) : migrationConfig.targetDomain}
                      </div>
                      {migrationConfig.targetDomains.length > 1 && (
                        <div className="text-xs text-gray-500 mt-1">
                          {migrationConfig.targetDomains.length} target domains configured
                        </div>
                      )}
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
      case 'delegation': return 3;
      case 'user-discovery': return 4;
      case 'user-mapping': return 5;
      case 'configuration': return 6;
      case 'review': return 7;
      case 'migration': return 8;
      default: return 1;
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'scenario':
        return selectedScenario !== null;
      case 'domain-mapping':
        return domainMapping !== null;
      case 'delegation':
        const adminEmailsProvided = areAllAdminEmailsProvided();
        const canProceedDelegation = dwdSetupComplete && adminEmailsProvided && dwdVerificationStatus;
        console.log('[Migration Wizard] canProceed delegation:', {
          dwdSetupComplete,
          areAllAdminEmailsProvided: adminEmailsProvided,
          dwdVerificationStatus,
          canProceed: canProceedDelegation,
          // Additional debug info
          selectedScenario,
          sourceAdminEmail,
          targetAdminEmail,
          sourceAdminEmails,
          targetAdminEmails,
          sourceDomains: getSourceDomains(),
          targetDomains: getTargetDomains()
        });
        return canProceedDelegation;
      case 'user-discovery':
        return discoveredUsers.length > 0;
      case 'user-mapping':
        return userMappings.length > 0;
      case 'configuration':
        return migrationConfig.sourceDomain && 
               migrationConfig.targetDomain && 
               migrationConfig.services.length > 0 &&
               selectedUsers.length > 0; // Require users to be selected
      case 'review':
        return true;
      default:
        return false;
    }
  };

  const getNextButtonText = () => {
    switch (currentStep) {
      case 'scenario':
        return 'Configure Domains';
      case 'domain-mapping':
        return 'Setup Delegation';
      case 'delegation':
        return 'Discover Users';
      case 'user-discovery':
        return 'Map Users';
      case 'user-mapping':
        return 'Configure Settings';
      case 'configuration':
        return 'Review & Confirm';
      default:
        return 'Continue';
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Enhanced Progress Steps */}
          <div className="mb-12">
            <div className="max-w-5xl mx-auto">
              <div className="flex items-start justify-between relative px-4">
                {/* Progress Line */}
                <div className="absolute top-6 left-16 right-16 h-0.5 bg-gray-200">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-500"
                    style={{ width: `${((getStepNumber() - 1) / 6) * 100}%` }}
                  />
                </div>
                
                {/* Steps */}
                {Object.entries(STEP_CONFIG).map(([stepKey, config], index) => {
                  const stepNumber = index + 1;
                  const isActive = stepNumber === getStepNumber();
                  const isCompleted = stepNumber < getStepNumber();
                  const IconComponent = config.icon;
                  
                  return (
                    <div key={stepKey} className="relative flex flex-col items-center min-w-0 flex-1">
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
                      <div className="mt-4 text-center max-w-36 px-2">
                        <div className={`text-sm font-clash text-heading mb-1 ${
                          isActive ? 'text-blue-600' : isCompleted ? 'text-gray-900' : 'text-gray-500'
                        }`}>
                          {config.title}
                        </div>
                        <div className={`text-xs font-clash text-subheading leading-relaxed ${
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
                        Step {getStepNumber()} of 7: {STEP_CONFIG[currentStep].title}
                      </p>
                    )}
                  </div>
                  {currentStep !== 'scenario' && currentStep !== 'migration' && (
                    <div className="flex items-center space-x-2 text-blue-100">
                      <Clock className="h-4 w-4" />
                      <span className="text-sm">Est. {7 - getStepNumber()} steps remaining</span>
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
                            {getNextButtonText()}
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
