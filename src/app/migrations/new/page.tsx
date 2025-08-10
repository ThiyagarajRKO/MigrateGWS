'use client';

import { useState, lazy, Suspense, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useCrossTenantTokens } from '@/lib/cross-tenant-auth-context';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { 
  MigrationScenario, 
  MigrationStatus,
  createMigrationScenario,
  SINGLE_SUPER_ADMIN_STEPS,
  CROSS_TENANT_STEPS,
  DomainMappingConfig
} from '@/types/migration-scenarios';
import { DomainMapping } from '@/types/config';
import { UserMappingConfig } from '@/types';
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
  ClipboardList,
  UserPlus,
  AlertTriangle,
  GitBranch,
  MapPin
} from 'lucide-react';

// Dynamic imports for heavy components with better loading strategies
const ScenarioSelector = lazy(() => 
  import('@/components/ScenarioSelector').then(module => ({ default: module.default }))
);
const AuthenticateAndConfigureDomains = lazy(() => 
  import('@/components/AuthenticateAndConfigureDomains').then(module => ({ default: module.AuthenticateAndConfigureDomains }))
);
const DomainMappingSelector = lazy(() => 
  import('@/components/DomainMappingSelector').then(module => ({ default: module.default }))
);
const UserMappingRelationshipSelector = lazy(() => 
  import('@/components/UserMappingRelationshipSelector').then(module => ({ default: module.UserMappingRelationshipSelector }))
);
const DomainWideDelegationSetup = lazy(() => 
  import('@/components/DomainWideDelegationSetup').then(module => ({ default: module.default }))
);
const UserManagementWorkflow = lazy(() => 
  import('@/components/UserManagementWorkflow').then(module => ({ default: module.default }))
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

type WizardStep = 'scenario' | 'auth-and-domains' | 'user-mapping' | 'delegation' | 'user-management' | 'configuration' | 'review' | 'migration';

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
    title: 'Migration Strategy', 
    description: 'Choose migration scenario and user mapping strategy' 
  },
  'auth-and-domains': { 
    icon: Shield, 
    title: 'Authenticate & Configure Domains', 
    description: 'Connect to Google Workspace and configure domain mappings' 
  },
  'user-mapping': { 
    icon: GitBranch, 
    title: 'User Mapping Relationship', 
    description: 'Choose how source users map to target users',
    hidden: true // Skip this step in normal flow
  },
  delegation: { 
    icon: Shield, 
    title: 'Setup Delegation', 
    description: 'Configure domain-wide delegation and permissions' 
  },
  'user-management': { 
    icon: Users, 
    title: 'Manage Users', 
    description: 'Discover, map, and create users in target domains' 
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
  const [domainMapping, setDomainMapping] = useState<DomainMapping | null>(null);
  const [userMappingConfig, setUserMappingConfig] = useState<UserMappingConfig | null>(null);

  // Helper functions for domain handling
  const getTargetDomainsFromMapping = useCallback((mapping: DomainMapping) => {
    // DomainMapping is Record<string, string[]> - get all target domains
    return Object.values(mapping).flat().filter(Boolean);
  }, []);

  const formatTargetDomains = useCallback((mapping: DomainMapping) => {
    const targets = getTargetDomainsFromMapping(mapping);
    if (targets.length === 1) {
      return targets[0];
    }
    return targets.filter(Boolean).join(', ');
  }, [getTargetDomainsFromMapping]);
  
  const [migrationConfig, setMigrationConfig] = useState({
    migrationName: '',
    sourceDomain: '',
    targetDomain: '',
    targetDomains: [] as string[], // Add support for multiple target domains
    services: ['Gmail', 'Drive'] as string[], // Add default services for testing
    userMappings: [] as Array<{ sourceAdminEmail: string; targetEmail: string }>,
    migrationOptions: {
      preserveLabels: true,
      migrateFolderStructure: true,
      enableDeltaSync: false,
      migrateSharedDrives: true,
      maintainPermissions: true,
    }
  });

  // Debug migration config changes to track auto-population
  const domainsClearedRef = useRef(false);
  
  useEffect(() => {
    const stack = new Error().stack;
    console.log('[Migration Wizard] migrationConfig.sourceDomain changed:', {
      sourceDomain: migrationConfig.sourceDomain,
      targetDomain: migrationConfig.targetDomain,
      timestamp: new Date().toISOString(),
      stackTrace: stack?.split('\n').slice(1, 4).join('\n') // Show top 3 stack frames
    });
    
    // Prevent auto-population of specific domains (only once)
    if (!domainsClearedRef.current && 
        (migrationConfig.sourceDomain === 'rrgokuldham.com' || migrationConfig.targetDomain === 'arakutourism.net')) {
      console.warn('[Migration Wizard] Detected auto-population of domains! Clearing them:', {
        sourceDomain: migrationConfig.sourceDomain,
        targetDomain: migrationConfig.targetDomain
      });
      
      domainsClearedRef.current = true;
      
      // Clear the auto-populated domains
      setMigrationConfig(prev => ({
        ...prev,
        sourceDomain: '',
        targetDomain: ''
      }));
    }
    
    // Reset the flag if domains are changed manually to something else
    if (migrationConfig.sourceDomain !== 'rrgokuldham.com' && 
        migrationConfig.targetDomain !== 'arakutourism.net' &&
        migrationConfig.sourceDomain !== '' && 
        migrationConfig.targetDomain !== '') {
      domainsClearedRef.current = false;
    }
  }, [migrationConfig.sourceDomain, migrationConfig.targetDomain]);

  // Domain-wide Delegation state
  const [dwdSetupComplete, setDwdSetupComplete] = useState(false);
  const [dwdVerificationStatus, setDwdVerificationStatus] = useState(false);
  const [sourceAdminEmail, setSourceAdminEmail] = useState('');
  const [sourceAdminEmails, setSourceAdminEmails] = useState<{[domain: string]: string}>({});
  const [targetAdminEmail, setTargetAdminEmail] = useState('');
  const [targetAdminEmails, setTargetAdminEmails] = useState<{[domain: string]: string}>({});
  
  // Single Super Admin uses adminEmail instead of sourceAdminEmail for clarity
  const [adminEmail, setAdminEmail] = useState('');
  
  const [showDwdSetup, setShowDwdSetup] = useState(false);

  // OAuth Authentication state for domain discovery
  const [authenticatedDomains, setAuthenticatedDomains] = useState<string[]>([]);
  const [availableSourceDomains, setAvailableSourceDomains] = useState<string[]>([]);
  const [availableTargetDomains, setAvailableTargetDomains] = useState<string[]>([]);
  const [oauthTokens, setOauthTokens] = useState<{[domain: string]: {
    authenticated: boolean;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    error?: string;
  }}>({});
  const [oauthInProgress, setOauthInProgress] = useState<string | null>(null);

  // Component lifecycle tracking
  useEffect(() => {
    console.log('[Migration Wizard] Component mounted at:', new Date().toISOString());
    
    // Clear any potential auto-population on mount
    console.log('[Migration Wizard] Clearing potential auto-populated domain values on mount');
    setMigrationConfig(prev => ({
      ...prev,
      sourceDomain: '',
      targetDomain: ''
    }));
    
    return () => {
      console.log('[Migration Wizard] Component unmounting at:', new Date().toISOString());
    };
  }, []);

  // Cross-tenant authentication for auto-populating admin emails
  const { sourceAdminEmail: authSourceAdminEmail, targetAdminEmail: authTargetAdminEmail } = useCrossTenantTokens();

  // Cross-tenant authentication for auto-populating admin emails
  useEffect(() => {
    if (authSourceAdminEmail && !sourceAdminEmail) {
      console.log('[Migration Wizard] Auto-populating source admin email (NOT DOMAIN):', authSourceAdminEmail);
      setSourceAdminEmail(authSourceAdminEmail);
      
      // DISABLED: Domain derivation from admin email - manual domain selection required
      // const sourceDomain = authSourceAdminEmail.split('@')[1];
      // console.log('[Migration Wizard] NOT deriving source domain from admin email:', sourceDomain);
    }
  }, [authSourceAdminEmail, sourceAdminEmail]);

  useEffect(() => {
    if (authTargetAdminEmail && !targetAdminEmail) {
      console.log('[Migration Wizard] Auto-populating target admin email (NOT DOMAIN):', authTargetAdminEmail);
      setTargetAdminEmail(authTargetAdminEmail);
      
      // DISABLED: Domain derivation from admin email - manual domain selection required
      // const targetDomain = authTargetAdminEmail.split('@')[1];
      // console.log('[Migration Wizard] NOT deriving target domain from admin email:', targetDomain);
    }
  }, [authTargetAdminEmail, targetAdminEmail]);

  // Auto-populate admin email from regular auth context for Single Super Admin scenarios
  useEffect(() => {
    if (selectedScenario === 'single-super-admin' && user?.email && !adminEmail && !authSourceAdminEmail) {
      console.log('[Migration Wizard] Auto-populating admin email for Single Super Admin:', user.email);
      setAdminEmail(user.email);
    }
  }, [selectedScenario, user?.email, adminEmail, authSourceAdminEmail]);

  // OAuth Domain Discovery state
  const [oauthSessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [oauthDiscoveryStatus, setOauthDiscoveryStatus] = useState({
    authenticated: false,
    discoveredDomains: [] as string[],
    loading: false,
    error: null as string | null
  });

  // Cross-tenant OAuth state
  const [sourceAuthStatus, setSourceAuthStatus] = useState({
    authenticated: false,
    domains: [] as string[],
    error: undefined as string | undefined
  });
  const [targetAuthStatus, setTargetAuthStatus] = useState({
    authenticated: false,
    domains: [] as string[],
    error: undefined as string | undefined
  });

  // User Discovery state
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);
  const [discoveredUsers, setDiscoveredUsers] = useState<any[]>([]);
  const [userMappings, setUserMappings] = useState<any[]>([]);
  const [createdUsers, setCreatedUsers] = useState<any[]>([]);

  // Extract target users from user mappings
  const getTargetUsersFromMappings = useCallback(() => {
    if (!userMappings || userMappings.length === 0) {
      return [];
    }

    return userMappings.map(mapping => {
      // Safely extract name from potentially complex name objects
      let sourceName = '';
      if (mapping.user?.name) {
        if (typeof mapping.user.name === 'string') {
          sourceName = mapping.user.name;
        } else if (mapping.user.name?.fullName) {
          sourceName = mapping.user.name.fullName;
        } else if (mapping.user.name?.givenName || mapping.user.name?.familyName) {
          sourceName = `${mapping.user.name.givenName || ''} ${mapping.user.name.familyName || ''}`.trim();
        }
      }
      
      // Fallback to displayName or email
      if (!sourceName) {
        sourceName = mapping.user?.displayName || mapping.user?.primaryEmail || mapping.user?.email || 'Unknown User';
      }

      return {
        sourceUser: mapping.user,
        targetEmail: mapping.targetEmail,
        targetDomain: mapping.targetDomain,
        status: mapping.status,
        sourceEmail: mapping.user?.primaryEmail || mapping.user?.email,
        sourceName: sourceName,
        sourceDomain: mapping.user?.domain || (mapping.user?.primaryEmail || mapping.user?.email)?.split('@')[1]
      };
    });
  }, [userMappings]);

  // Helper function to find corresponding source user for a target user
  const findSourceUserForTarget = useCallback((targetUser: any) => {
    if (!userMappings || userMappings.length === 0) return null;
    
    const targetEmail = targetUser.email || targetUser.primaryEmail;
    if (!targetEmail) return null;
    
    // Find mapping where target email matches
    const mapping = userMappings.find(m => 
      m.targetEmail === targetEmail || 
      m.user?.email === targetEmail ||
      m.user?.primaryEmail === targetEmail
    );
    
    if (!mapping || !mapping.user) return null;
    
    // Extract source user information
    let sourceName = '';
    if (mapping.user?.name) {
      if (typeof mapping.user.name === 'string') {
        sourceName = mapping.user.name;
      } else if (mapping.user.name?.fullName) {
        sourceName = mapping.user.name.fullName;
      } else if (mapping.user.name?.givenName || mapping.user.name?.familyName) {
        sourceName = `${mapping.user.name.givenName || ''} ${mapping.user.name.familyName || ''}`.trim();
      }
    }
    
    if (!sourceName) {
      sourceName = mapping.user?.displayName || mapping.user?.primaryEmail || mapping.user?.email || 'Unknown User';
    }
    
    return {
      sourceEmail: mapping.user?.primaryEmail || mapping.user?.email,
      sourceName: sourceName,
      sourceDomain: mapping.user?.domain || (mapping.user?.primaryEmail || mapping.user?.email)?.split('@')[1],
      sourceUser: mapping.user
    };
  }, [userMappings]);

  // Existing Users Selection state for migration settings
  const [existingUsers, setExistingUsers] = useState<any[]>([]);
  const [selectedExistingUsers, setSelectedExistingUsers] = useState<any[]>([]);
  const [loadingTargetUsers, setLoadingTargetUsers] = useState(false);
  const [useExistingUsers, setUseExistingUsers] = useState(false);

  // All Target Domain Users state for migration settings
  const [allTargetUsers, setAllTargetUsers] = useState<any[]>([]);
  const [selectedAllTargetUsers, setSelectedAllTargetUsers] = useState<any[]>([]);
  const [loadingAllTargetUsers, setLoadingAllTargetUsers] = useState(false);

  // User view mode state - controls whether to show only cloned users or all users
  const [userViewMode, setUserViewMode] = useState<'cloned' | 'all'>('all');

  const [migrationStatus, setMigrationStatus] = useState<MigrationStatus | null>(null);

  // Handle OAuth callback success - DISABLED for cross-tenant auth
  // Cross-tenant auth is handled by AuthenticateAndConfigureDomains component via postMessage
  useEffect(() => {
    const handleOAuthCallback = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const oauthSuccess = urlParams.get('oauth_success');
      const domainsDiscovered = urlParams.get('domains_discovered');
      const sessionId = urlParams.get('session_id');
      const authType = urlParams.get('auth_type');

      // Only handle single super admin OAuth (no authType parameter)
      // Cross-tenant OAuth is handled by AuthenticateAndConfigureDomains component
      if (oauthSuccess === 'true' && domainsDiscovered && !authType && sessionId === oauthSessionId) {
        const domains = domainsDiscovered.split(',').filter(Boolean);
        
        // Single super admin authentication
        setOauthDiscoveryStatus({
          authenticated: true,
          discoveredDomains: domains,
          loading: false,
          error: null
        });

        // Clean up URL parameters
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      } else if (authType) {
        // Clean up URL parameters - these should be handled by the component via postMessage
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      }
    };

    handleOAuthCallback();
  }, [oauthSessionId]);

  // Handle OAuth popup close messages from cross-origin popup
  useEffect(() => {
    const handlePopupClose = (event: MessageEvent) => {
      // Only handle messages from our own origin
      if (event.origin !== window.location.origin) return;
      
      if (event.data?.type === 'close_oauth_popup') {
        console.log('Received close popup message from OAuth callback');
        // Find any open popup windows and close them
        // This is a fallback in case the popup can't close itself due to COOP
      }
    };

    window.addEventListener('message', handlePopupClose);
    
    return () => {
      window.removeEventListener('message', handlePopupClose);
    };
  }, []);

  // Preload next components based on current step
  useEffect(() => {
    const preloadNext = () => {
      switch (currentStep) {
        case 'scenario':
          // Preload domain mapping selector
          import('@/components/DomainMappingSelector');
          break;
        case 'auth-and-domains':
          // Preload delegation setup
          import('@/components/DomainWideDelegationSetup').then(module => ({ default: module.default }));
          break;
        case 'delegation':
          // Preload user management workflow
          import('@/components/UserManagementWorkflow');
          break;
        case 'user-management':
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

  // Debug useEffect to track verification status changes - TEMPORARILY DISABLED FOR PERFORMANCE
  // useEffect(() => {
  //   console.log('[Migration Wizard] dwdVerificationStatus changed:', dwdVerificationStatus, {
  //     currentStep,
  //     dwdSetupComplete,
  //     canProceedDelegation: currentStep === 'delegation' ? (dwdSetupComplete && areAllAdminEmailsProvided() && dwdVerificationStatus) : 'N/A'
  //   })
  // }, [dwdVerificationStatus, dwdSetupComplete, currentStep, areAllAdminEmailsProvided])

  // Auto-populate domain fields from domainMapping selections
  useEffect(() => {
    console.log('[Migration Wizard] Auto-population effect triggered:', {
      domainMapping,
      hasMapping: !!(domainMapping && Object.keys(domainMapping).length > 0),
      currentSourceDomain: migrationConfig.sourceDomain,
      currentTargetDomain: migrationConfig.targetDomain
    });
    
    if (domainMapping && Object.keys(domainMapping).length > 0) {
      // Auto-populate source domain from domainMapping if not already set
      const sourceDomains = Object.keys(domainMapping).filter(domain => Boolean(domain));
      
      if (sourceDomains.length > 0 && !migrationConfig.sourceDomain) {
        const newSourceDomain = sourceDomains[0];
        console.log('[Migration Wizard] Auto-populating source domain:', newSourceDomain);
        setMigrationConfig(prev => ({
          ...prev,
          sourceDomain: newSourceDomain
        }));
      }

      // Auto-populate target domain from domainMapping if not already set
      const targetDomains = Object.values(domainMapping).flat().filter(domain => Boolean(domain));
      
      if (targetDomains.length > 0 && !migrationConfig.targetDomain) {
        const newTargetDomain = targetDomains[0];
        console.log('[Migration Wizard] Auto-populating target domain:', newTargetDomain, 'from targets:', targetDomains);
        setMigrationConfig(prev => ({
          ...prev,
          targetDomain: newTargetDomain,
          targetDomains: targetDomains // Also update the targetDomains array
        }));
      }
    }
  }, [domainMapping, migrationConfig.sourceDomain, migrationConfig.targetDomain])

  // Debug useEffect to track admin email changes
  // Monitor admin email state for debugging
  // Debug useEffect to track admin email changes - TEMPORARILY DISABLED FOR PERFORMANCE
  // useEffect(() => {
  //   const stack = new Error().stack;
  //   console.log('[Migration Wizard] Admin emails changed:', {
  //     adminEmail,
  //     sourceAdminEmail,
  //     targetAdminEmail,
  //     sourceAdminEmails,
  //     targetAdminEmails,
  //     areAllAdminEmailsProvided: areAllAdminEmailsProvided(),
  //     timestamp: new Date().toISOString(),
  //     currentStep,
  //     selectedScenario,
  //     stackTrace: stack?.split('\n').slice(1, 4).join('\n') // Show top 3 stack frames
  //   });
  // }, [adminEmail, sourceAdminEmail, targetAdminEmail, sourceAdminEmails, targetAdminEmails, currentStep, selectedScenario, areAllAdminEmailsProvided])

  // Auto-redirect to authentication when both scenario and user mapping are selected
  useEffect(() => {
    if (currentStep === 'scenario' && selectedScenario && userMappingConfig?.relationship) {
      console.log('[Migration Wizard] Both scenario and user mapping are selected, auto-redirecting to auth-and-domains');
      const timer = setTimeout(() => {
        setCurrentStep('auth-and-domains');
      }, 1000); // Give user time to see the "Ready to Proceed" status
      
      return () => clearTimeout(timer);
    }
  }, [currentStep, selectedScenario, userMappingConfig?.relationship]);

  // Debug useEffect to track user mapping configuration changes - TEMPORARILY DISABLED FOR PERFORMANCE
  // useEffect(() => {
  //   console.log('[Migration Wizard] User mapping configuration changed:', {
  //     userMappingConfig,
  //     domainMapping: {
  //       type: domainMapping?.type,
  //       description: domainMapping?.description,
  //       sourceDomains: domainMapping?.sourceDomains,
  //       targetDomain: domainMapping?.targetDomain,
  //       targetDomains: domainMapping?.targetDomains
  //     },
  //     selectedScenario,
  //     currentStep,
  //     timestamp: new Date().toISOString()
  //   });
  // }, [userMappingConfig, domainMapping, selectedScenario, currentStep])

  // OAuth Domain Discovery handlers
  const handleDomainsDiscovered = (domains: string[]) => {
    setOauthDiscoveryStatus(prev => ({
      ...prev,
      discoveredDomains: domains,
      authenticated: true,
      loading: false
    }));
  };

  const handleOAuthStart = () => {
    setOauthDiscoveryStatus(prev => ({
      ...prev,
      loading: true,
      error: null
    }));
  };

  const checkOAuthStatusAndDiscoverDomains = async () => {
    try {
      const response = await fetch(`/api/auth/oauth/discover-domains?sessionId=${oauthSessionId}`);
      if (response.ok) {
        const data = await response.json();
        setOauthDiscoveryStatus({
          authenticated: data.authenticated,
          discoveredDomains: data.discoveredDomains || [],
          loading: false,
          error: null
        });
      }
    } catch (error) {
      console.error('Error checking OAuth status:', error);
      setOauthDiscoveryStatus(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to check authentication status'
      }));
    }
  };

  const isOAuthCompleteForDomainDiscovery = useCallback(() => {
    if (selectedScenario === 'cross-tenant') {
      return sourceAuthStatus.authenticated && targetAuthStatus.authenticated;
    }
    return oauthDiscoveryStatus.authenticated && oauthDiscoveryStatus.discoveredDomains.length > 0;
  }, [selectedScenario, sourceAuthStatus.authenticated, targetAuthStatus.authenticated, oauthDiscoveryStatus.authenticated, oauthDiscoveryStatus.discoveredDomains.length]);

  // Cross-tenant OAuth handlers
  const handleSourceAuthComplete = (domains: string[]) => {
    setSourceAuthStatus({
      authenticated: true,
      domains,
      error: undefined
    });
  };

  const handleTargetAuthComplete = (domains: string[]) => {
    setTargetAuthStatus({
      authenticated: true,
      domains,
      error: undefined
    });
  };

  const handleScenarioSelect = (scenario: MigrationScenario) => {
    setSelectedScenario(scenario);
    
    // Auto-redirect to authentication if user mapping is already selected
    if (userMappingConfig?.relationship) {
      console.log('[Migration Wizard] Both scenario and user mapping already selected, auto-redirecting to auth-and-domains');
      setTimeout(() => {
        setCurrentStep('auth-and-domains');
      }, 500); // Small delay to show the selection visually before redirecting
    } else {
      // If user mapping not selected yet, stay on current step to allow user mapping selection
      console.log('[Migration Wizard] Scenario selected, waiting for user mapping selection');
    }
  };

  const handleDomainConfiguration = (config: any) => {
    // Update authentication status
    if (selectedScenario === 'cross-tenant') {
      setSourceAuthStatus({
        authenticated: config.sourceAuthenticated,
        domains: config.sourceDomains,
        error: undefined
      });
      setTargetAuthStatus({
        authenticated: config.targetAuthenticated,
        domains: config.targetDomains,
        error: undefined
      });
    } else {
      setOauthDiscoveryStatus({
        authenticated: config.sourceAuthenticated,
        discoveredDomains: config.sourceDomains,
        loading: false,
        error: null
      });
    }

    // Set up domain mapping from the configuration
    if (config.domainMappings && config.domainMappings.length > 0) {
      // Convert domain mappings from AuthenticateAndConfigureDomains format to DomainMapping format
      // AuthenticateAndConfigureDomains returns: [{ source: string|string[], target: string|string[] }]
      // DomainWideDelegationSetup expects: Record<string, string[]> (DomainMapping)
      
      const domainMapping: Record<string, string[]> = {};
      
      config.domainMappings.forEach((mapping: any) => {
        const sources = Array.isArray(mapping.source) ? mapping.source : [mapping.source];
        const targets = Array.isArray(mapping.target) ? mapping.target : [mapping.target];
        
        sources.forEach((source: string) => {
          if (source) {
            if (!domainMapping[source]) {
              domainMapping[source] = [];
            }
            targets.forEach((target: string) => {
              if (target && !domainMapping[source].includes(target)) {
                domainMapping[source].push(target);
              }
            });
          }
        });
      });
      
      console.log('[Migration Wizard] Converted domain mappings:', {
        original: config.domainMappings,
        converted: domainMapping
      });
      
      setDomainMapping(domainMapping);
    } else {
      // DISABLED: Fallback automatic domain mapping creation - manual mapping required
      console.log('[Migration Wizard] No domain mappings provided - manual domain mapping configuration required');
      // Users must explicitly configure domain mappings through the UI
      // setDomainMapping(mapping);
    }
    
    // Allow auto-populate migration config from domain mapping
    // Domain configuration can be auto-selected if domain mapping is available
    const finalMapping = config.domainMappings?.[0];
    if (finalMapping) {
      // Use domains from the domain mapping with automatic selection
      const sourceDomains = finalMapping.sourceDomains || [];
      const targetDomains = finalMapping.type === 'one-to-many' && finalMapping.multiTargetConfig 
        ? finalMapping.multiTargetConfig.map((c: any) => c.domain).filter(Boolean)
        : finalMapping.targetDomains || [];
      
      setMigrationConfig(prev => ({
        ...prev,
        // Allow auto-population from domain mapping
        sourceDomain: prev.sourceDomain || '', 
        targetDomain: prev.targetDomain || '',
        targetDomains: targetDomains
      }));
    } else {
      // Preserve existing configuration if no domain mappings
      setMigrationConfig(prev => ({
        ...prev,
        targetDomains: config.targetDomains || prev.targetDomains
      }));
    }

    // Move to next step
    setCurrentStep('delegation');
  };

  const handleDomainMappingSelect = (mapping: DomainMapping) => {
    setDomainMapping(mapping);
    
    // Extract target domains from the mapping
    const targetDomains = Object.values(mapping).flat();
    
    // Allow auto-populate source and target domains from domain mapping
    // Domain mapping selection can automatically populate migration config
    setMigrationConfig(prev => ({
      ...prev,
      // Auto-population will be handled by the useEffect
      targetDomains: targetDomains
    }));
    
    // Initialize source admin emails for multiple source domains (cross-tenant only)
    if (selectedScenario === 'cross-tenant' && mapping.sourceDomains && mapping.sourceDomains.length > 1) {
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
    
    // For both scenarios, go directly to delegation since OAuth is already completed
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

  // Existing Users Helper Functions
  const toggleExistingUserSelection = (user: any) => {
    console.log('[User Selection] Toggling user:', user.email);
    setSelectedExistingUsers(prev => {
      const isSelected = prev.some(u => u.email === user.email);
      console.log('[User Selection] Was selected:', isSelected, 'Current selection count:', prev.length);
      if (isSelected) {
        const newSelection = prev.filter(u => u.email !== user.email);
        console.log('[User Selection] Removing user, new count:', newSelection.length);
        return newSelection;
      } else {
        const newSelection = [...prev, user];
        console.log('[User Selection] Adding user, new count:', newSelection.length);
        return newSelection;
      }
    });
  };

  const selectAllExistingUsers = () => {
    setSelectedExistingUsers([...existingUsers]);
  };

  const deselectAllExistingUsers = () => {
    setSelectedExistingUsers([]);
  };

  // All Target Users Helper Functions
  const toggleAllTargetUserSelection = (user: any) => {
    console.log('[All Target User Selection] Toggling user:', user.primaryEmail);
    setSelectedAllTargetUsers(prev => {
      const isSelected = prev.some(u => u.primaryEmail === user.primaryEmail);
      if (isSelected) {
        const newSelection = prev.filter(u => u.primaryEmail !== user.primaryEmail);
        console.log('[All Target User Selection] Removing user, new count:', newSelection.length);
        return newSelection;
      } else {
        const newSelection = [...prev, user];
        console.log('[All Target User Selection] Adding user, new count:', newSelection.length);
        return newSelection;
      }
    });
  };

  const selectAllTargetUsers = () => {
    setSelectedAllTargetUsers([...allTargetUsers]);
  };

  const deselectAllTargetUsers = () => {
    setSelectedAllTargetUsers([]);
  };

  // Simplified function to load target users from Google Admin Console
  const loadTargetUsersFromAdminConsole = async () => {
    console.log('[Admin Console] Loading target users from Google Admin Console...');
    setLoadingAllTargetUsers(true);
    
    try {
      const targetDomains = getTargetDomains();
      const verificationToken = typeof window !== 'undefined' ? localStorage.getItem('dwd_verification_token') : null;
      
      console.log('[Admin Console] Target domains:', targetDomains);
      console.log('[Admin Console] Verification token available:', !!verificationToken);
      console.log('[Admin Console] Target admin emails:', targetAdminEmails);
      console.log('[Admin Console] Domain mapping:', domainMapping);
      
      if (!targetDomains || targetDomains.length === 0) {
        console.log('[Admin Console] No target domains found');
        alert('No target domains configured. Please complete the domain mapping step first.');
        return;
      }
      
      if (!verificationToken) {
        console.log('[Admin Console] No verification token found');
        alert('No verification token found. Please complete the domain-wide delegation setup first.');
        return;
      }
      
      const allUsers = [];
      
      for (const domain of targetDomains) {
        console.log(`[Admin Console] Fetching users from domain: ${domain}`);
        
        // Try different admin email sources
        let adminEmail = targetAdminEmails[domain] || targetAdminEmail;
        
        if (!adminEmail && selectedScenario === 'cross-tenant') {
          // For cross-tenant, try to find admin email from the target admin emails object
          const availableEmails = Object.values(targetAdminEmails);
          if (availableEmails.length > 0) {
            adminEmail = availableEmails[0];
          }
        }
        
        // If still no admin email, try to extract from domain mapping or use a default pattern
        if (!adminEmail && domainMapping) {
          // Try to find an admin email pattern for this domain
          const domainKeys = Object.keys(domainMapping);
          const targetDomainsList = Object.values(domainMapping).flat();
          
          if (targetDomainsList.includes(domain)) {
            // This domain is in our mapping, try to use admin@domain pattern
            adminEmail = `admin@${domain}`;
            console.log(`[Admin Console] Using pattern admin email: ${adminEmail} for domain: ${domain}`);
          }
        }
        
        if (!adminEmail) {
          console.error(`[Admin Console] No admin email found for domain: ${domain}`);
          console.log('[Admin Console] Available admin emails:', targetAdminEmails);
          console.log('[Admin Console] Target admin email:', targetAdminEmail);
          continue;
        }
        
        console.log(`[Admin Console] Using admin email: ${adminEmail} for domain: ${domain}`);
        
        try {
          // Build the API URL with verification token
          const params = new URLSearchParams({
            action: 'users',
            domain: domain,
            adminEmail: adminEmail,
            verificationToken: verificationToken
          });
          
          const url = `/api/google-workspace?${params.toString()}`;
          console.log(`[Admin Console] API URL: ${url.replace(verificationToken, 'TOKEN_HIDDEN')}`);
          
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            }
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Admin Console] API Error for ${domain}:`, response.status, errorText);
            
            // Try without verification token as fallback
            if (response.status === 401 || response.status === 403) {
              console.log(`[Admin Console] Trying fallback without verification token for ${domain}`);
              const fallbackParams = new URLSearchParams({
                action: 'users',
                domain: domain,
                adminEmail: adminEmail
              });
              
              const fallbackResponse = await fetch(`/api/google-workspace?${fallbackParams.toString()}`);
              
              if (fallbackResponse.ok) {
                const fallbackData = await fallbackResponse.json();
                console.log(`[Admin Console] Fallback success for ${domain}:`, fallbackData);
                
                if (fallbackData.success && fallbackData.users && Array.isArray(fallbackData.users)) {
                  const users = fallbackData.users
                    .filter((user: any) => user && user.primaryEmail && !user.suspended)
                    .map((user: any) => ({
                      id: user.id || user.primaryEmail,
                      primaryEmail: user.primaryEmail,
                      email: user.primaryEmail,
                      name: user.name,
                      displayName: typeof user.name === 'string' ? user.name : 
                                 user.name?.fullName || 
                                 `${user.name?.givenName || ''} ${user.name?.familyName || ''}`.trim() || 
                                 user.primaryEmail.split('@')[0],
                      isAdmin: user.isAdmin || false,
                      suspended: user.suspended || false,
                      domain: domain,
                      targetDomain: domain,
                      orgUnitPath: user.orgUnitPath || '/',
                      lastLoginTime: user.lastLoginTime,
                      creationTime: user.creationTime,
                      customerId: user.customerId,
                      exists: true,
                      verified: true,
                      source: 'google-admin-console',
                      loadedWith: 'fallback-no-token'
                    }));
                  allUsers.push(...users);
                  continue;
                }
              }
            }
            continue;
          }
          
          const data = await response.json();
          console.log(`[Admin Console] Raw API response for ${domain}:`, data);
          console.log(`[Admin Console] Response structure analysis:`, {
            hasSuccess: 'success' in data,
            successValue: data.success,
            hasUsers: 'users' in data,
            usersType: typeof data.users,
            usersIsArray: Array.isArray(data.users),
            usersLength: data.users ? data.users.length : 0,
            hasError: 'error' in data,
            errorValue: data.error,
            allKeys: Object.keys(data)
          });
          
          // Check multiple possible response formats
          let users = [];
          
          // The API returns { users: [], count: number, domain: string, timestamp: string, cached: boolean }
          if (data.users && Array.isArray(data.users)) {
            users = data.users;
            console.log(`[Admin Console] Found users in data.users array: ${users.length}`);
          } else if (data.success && data.users && Array.isArray(data.users)) {
            users = data.users;
            console.log(`[Admin Console] Found users in data.users with success flag: ${users.length}`);
          } else if (Array.isArray(data)) {
            users = data;
            console.log(`[Admin Console] Found users in root array: ${users.length}`);
          } else if (data.result && Array.isArray(data.result)) {
            users = data.result;
            console.log(`[Admin Console] Found users in data.result: ${users.length}`);
          } else {
            console.log(`[Admin Console] No users array found in response for ${domain}. Response:`, data);
          }
          
          if (users.length > 0) {
            console.log(`[Admin Console] Sample user object:`, users[0]);
            
            const processedUsers = users
              .filter((user: any) => {
                const isValid = user && user.primaryEmail && !user.suspended;
                if (!isValid) {
                  console.log(`[Admin Console] Filtering out user:`, { user, reason: !user ? 'null' : !user.primaryEmail ? 'no email' : 'suspended' });
                }
                return isValid;
              })
              .map((user: any) => ({
                id: user.id || user.primaryEmail,
                primaryEmail: user.primaryEmail,
                email: user.primaryEmail,
                name: user.name,
                displayName: typeof user.name === 'string' ? user.name : 
                           user.name?.fullName || 
                           `${user.name?.givenName || ''} ${user.name?.familyName || ''}`.trim() || 
                           user.primaryEmail.split('@')[0],
                isAdmin: user.isAdmin || false,
                suspended: user.suspended || false,
                domain: domain,
                targetDomain: domain,
                orgUnitPath: user.orgUnitPath || '/',
                lastLoginTime: user.lastLoginTime,
                creationTime: user.creationTime,
                customerId: user.customerId,
                exists: true,
                verified: true,
                source: 'google-admin-console',
                loadedWith: 'verification-token'
              }));
              
            console.log(`[Admin Console] Processed ${processedUsers.length} users from ${domain} (filtered from ${users.length})`);
            allUsers.push(...processedUsers);
          } else if (data.error) {
            console.error(`[Admin Console] API returned error for ${domain}:`, data.error);
          } else {
            console.log(`[Admin Console] No users found in any expected format for ${domain}:`, data);
          }
        } catch (apiError) {
          console.error(`[Admin Console] API call failed for ${domain}:`, apiError);
        }
      }
      
      console.log(`[Admin Console] Total users loaded: ${allUsers.length}`);
      
      if (allUsers.length > 0) {
        setAllTargetUsers(allUsers);
        console.log('[Admin Console] Successfully loaded target users:', allUsers);
        
        // Show success message
        const userCount = allUsers.length;
        const domainCount = [...new Set(allUsers.map(u => u.domain))].length;
        alert(`Successfully loaded ${userCount} users from ${domainCount} target domain(s)!`);
      } else {
        console.warn('[Admin Console] No users were loaded from any domain');
        alert('No users found in the target domains. Please check domain configuration and admin permissions.');
      }
      
    } catch (error) {
      console.error('[Admin Console] Error loading target users:', error);
      alert('Failed to load target users. Check console for details.');
    } finally {
      setLoadingAllTargetUsers(false);
    }
  };

  // Function to load all users from target domains for migration settings
  const loadAllTargetDomainUsers = async () => {
    console.log('[Migration Config] Loading all target domain users for migration settings...');
    setLoadingAllTargetUsers(true);
    
    const targetDomains = getTargetDomains();
    console.log('[Migration Config] Target domains for all users:', targetDomains);
    console.log('[Migration Config] Target admin emails:', targetAdminEmails);
    console.log('[Migration Config] Domain mapping:', domainMapping);
    
    if (!targetDomains || targetDomains.length === 0) {
      console.log('[Migration Config] No target domains configured for all users');
      setLoadingAllTargetUsers(false);
      return;
    }
    
    const allUsers = [];
    
    try {
      // Load users from each target domain
      for (const domain of targetDomains) {
        let adminEmail = targetAdminEmails[domain];
        
        // If no admin email in targetAdminEmails, try to find it from domain mapping or use a fallback
        if (!adminEmail) {
          // Try to use the target admin email if it's a single target scenario
          if (targetAdminEmail && targetDomains.length === 1) {
            adminEmail = targetAdminEmail;
            console.log(`[Migration Config] Using single target admin email: ${adminEmail} for domain: ${domain}`);
          } else {
            console.warn(`[Migration Config] No admin email configured for domain: ${domain}`);
            console.log(`[Migration Config] Available admin emails:`, Object.keys(targetAdminEmails));
            continue;
          }
        }
        
        console.log(`[Migration Config] Fetching all users from domain: ${domain} with admin: ${adminEmail}`);
        
        const response = await fetch(`/api/google-workspace?action=users&domain=${domain}&adminEmail=${encodeURIComponent(adminEmail)}`);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[Migration Config] Failed to fetch all users from ${domain}:`, response.status, errorText);
          continue;
        }
        
        const data = await response.json();
        console.log(`[Migration Config] Raw response from ${domain}:`, data);
        console.log(`[Migration Config] Fetched ${data.users?.length || 0} total users from ${domain}`);
        
        if (data.users && data.users.length > 0) {
          const domainUsers = data.users
            .filter((user: any) => {
              // Include all active users (not suspended)
              return !user.suspended && user.primaryEmail && user.name;
            })
            .map((user: any) => ({
              id: user.id || user.primaryEmail,
              primaryEmail: user.primaryEmail,
              email: user.primaryEmail, // Add email alias for compatibility
              name: user.name?.fullName || `${user.name?.givenName || ''} ${user.name?.familyName || ''}`.trim() || 'Unknown User',
              isAdmin: user.isAdmin || false,
              suspended: user.suspended || false,
              domain: domain,
              targetDomain: domain,
              adminEmail: adminEmail,
              orgUnitPath: user.orgUnitPath || '/',
              lastLoginTime: user.lastLoginTime,
              creationTime: user.creationTime,
              userType: 'all-existing', // Mark as all existing users
              customerId: user.customerId,
              isFromTargetDomain: true, // Flag to identify these are from target domain
              exists: true // Mark as existing/verified
            }));
          
          console.log(`[Migration Config] Processed ${domainUsers.length} users from ${domain}`);
          allUsers.push(...domainUsers);
        } else {
          console.log(`[Migration Config] No users found in response from ${domain}`);
        }
      }
      
      console.log(`[Migration Config] Total users loaded from all target domains: ${allUsers.length}`);
      setAllTargetUsers(allUsers);
      
      if (allUsers.length === 0) {
        console.warn('[Migration Config] No target users were loaded. Check domain configuration and admin permissions.');
      }
      
    } catch (error) {
      console.error('[Migration Config] Error loading all target domain users:', error);
    } finally {
      setLoadingAllTargetUsers(false);
    }
  };

  // Function to load actual target domain users
  const loadActualTargetUsers = async () => {
    console.log('[Migration Config] Loading actual target domain users...');
    const targetDomains = getTargetDomains();
    console.log('[Migration Config] Target domains:', targetDomains);
    console.log('[Migration Config] Target admin emails:', targetAdminEmails);
    
    if (!targetDomains || targetDomains.length === 0) {
      console.log('[Migration Config] No target domains configured');
      return [];
    }
    
    const allTargetUsers = [];
    
    try {
      // Load users from each target domain
      for (const domain of targetDomains) {
        const adminEmail = targetAdminEmails[domain];
        if (!adminEmail) {
          console.warn(`[Migration Config] No admin email configured for domain: ${domain}`);
          continue;
        }
        
        console.log(`[Migration Config] Fetching users from domain: ${domain} with admin: ${adminEmail}`);
        
        const response = await fetch(`/api/google-workspace?action=users&domain=${domain}&adminEmail=${encodeURIComponent(adminEmail)}`);
        
        if (!response.ok) {
          console.error(`[Migration Config] Failed to fetch users from ${domain}:`, response.status);
          continue;
        }
        
        const data = await response.json();
        console.log(`[Migration Config] Fetched ${data.users?.length || 0} users from ${domain}`);
        
        if (data.users && data.users.length > 0) {
          const domainUsers = data.users
            .filter((user: any) => {
              // Filter out suspended users or users that don't meet existence criteria
              return !user.suspended && user.primaryEmail && user.name;
            })
            .map((user: any) => ({
              id: user.primaryEmail,
              email: user.primaryEmail,
              name: user.name?.fullName || user.name?.givenName || 'Unknown User',
              isAdmin: user.isAdmin || false,
              exists: true, // All users returned from API exist
              domain: domain,
              adminEmail: adminEmail,
              orgUnitPath: user.orgUnitPath,
              suspended: user.suspended || false,
              lastLoginTime: user.lastLoginTime,
              creationTime: user.creationTime,
              userType: 'existing' // Mark as existing user
            }));
          
          console.log(`[Migration Config] Filtered to ${domainUsers.length} existing users from ${data.users.length} total users in ${domain}`);
          allTargetUsers.push(...domainUsers);
        }
      }
      
      console.log(`[Migration Config] Total target users loaded: ${allTargetUsers.length}`);
      return allTargetUsers;
      
    } catch (error) {
      console.error('[Migration Config] Error loading target users:', error);
      return [];
    }
  };

  const handleNext = () => {
    switch (currentStep) {
      case 'scenario':
        // Only proceed if both scenario and user mapping are selected
        if (selectedScenario && userMappingConfig?.relationship) {
          setCurrentStep('auth-and-domains');
        } else {
          console.log('[Migration Wizard] Cannot proceed from scenario step - missing selections:', {
            selectedScenario,
            userMappingStrategy: userMappingConfig?.relationship
          });
        }
        break;
      case 'auth-and-domains':
        // Skip user-mapping and go directly to delegation
        setCurrentStep('delegation');
        break;
      case 'user-mapping':
        setCurrentStep('delegation');
        break;
      case 'delegation':
        setCurrentStep('user-management');
        break;
      case 'user-management':
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
      case 'auth-and-domains':
        setCurrentStep('scenario');
        break;
      case 'user-mapping':
        setCurrentStep('auth-and-domains');
        break;
      case 'delegation':
        // Skip user-mapping and go back to auth-and-domains
        setCurrentStep('auth-and-domains');
        break;
      case 'user-management':
        setCurrentStep('delegation');
        break;
      case 'configuration':
        setCurrentStep('user-management');
        break;
      case 'review':
        setCurrentStep('configuration');
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
      name: migrationConfig.migrationName || `${selectedScenario} Migration - ${new Date().toLocaleDateString()}`,
      scenarioType: selectedScenario,
      status: 'running',
      currentStep: scenario.steps[0].id,
      startTime: new Date().toISOString(),
      estimatedCompletion: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(), // 6 hours from now
      overallProgress: 0,
      errors: [],
      // Add migration configuration data
      migrationConfig: {
        services: migrationConfig.services,
        sourceDomain: migrationConfig.sourceDomain,
        targetDomain: migrationConfig.targetDomain,
        migrationOptions: migrationConfig.migrationOptions,
        userMappings: userMappings,
        selectedUsers: selectedUsers,
        domainMapping: domainMapping,
        userMappingConfig: userMappingConfig,
        adminCredentials: {
          scenario: selectedScenario,
          adminEmail: selectedScenario === 'single-super-admin' ? adminEmail : undefined,
          sourceAdminEmail: selectedScenario === 'cross-tenant' ? sourceAdminEmail : undefined,
          targetAdminEmail: selectedScenario === 'cross-tenant' ? targetAdminEmail : undefined,
          sourceAdminEmails: selectedScenario === 'cross-tenant' ? sourceAdminEmails : undefined,
          targetAdminEmails: targetAdminEmails
        }
      }
    };

    setMigrationStatus(status);
    
    // Log the migration start for debugging
    console.log('[Migration Wizard] Starting migration with configuration:', {
      migrationId: status.id,
      scenarioType: selectedScenario,
      services: migrationConfig.services,
      userCount: selectedUsers.length,
      mappingType: userMappingConfig?.relationship,
      domainMapping: domainMapping?.type,
      timestamp: new Date().toISOString()
    });
    
    setCurrentStep('migration');
  };

  // Handle Domain-wide Delegation setup completion
  const handleDwdSetupComplete = () => {
    setDwdSetupComplete(true);
    setShowDwdSetup(false);
  };

  // Handle verification status change
  const handleVerificationStatusChange = (isVerified: boolean) => {
    // console.log('[Migration Wizard] Verification status changed:', isVerified, {
    //   currentStep,
    //   dwdSetupComplete,
    //   previousVerificationStatus: dwdVerificationStatus,
    //   adminEmailsProvided: areAllAdminEmailsProvided(),
    //   adminEmail,
    //   sourceAdminEmail,
    //   targetAdminEmail
    // })
    setDwdVerificationStatus(isVerified);
    
    // Force a re-evaluation of canProceed after status change
    // setTimeout(() => {
    //   console.log('[Migration Wizard] After verification status update:', {
    //     dwdVerificationStatus: isVerified,
    //     dwdSetupComplete,
    //     areAllAdminEmailsProvided: areAllAdminEmailsProvided(),
    //     canProceedNow: (dwdSetupComplete && areAllAdminEmailsProvided() && isVerified)
    //   });
    // }, 100);
  };

  // Handle admin email changes from DomainWideDelegationSetup component
  const handleAdminEmailChange = (email: string) => {
    const stack = new Error().stack;
    console.log('[Migration Wizard] Admin email changed:', {
      email,
      timestamp: new Date().toISOString(),
      stackTrace: stack?.split('\n').slice(1, 3).join('\n')
    });
    // For single super admin, set the admin email
    setAdminEmail(email);
  };

  const handlesourceAdminEmailChange = (email: string) => {
    const stack = new Error().stack;
    console.log('[Migration Wizard] Source email changed:', {
      email,
      timestamp: new Date().toISOString(),
      stackTrace: stack?.split('\n').slice(1, 3).join('\n')
    });
    setSourceAdminEmail(email);
  };

  const handledestAdminEmailChange = (email: string) => {
    const stack = new Error().stack;
    console.log('[Migration Wizard] Dest email changed:', {
      email,
      timestamp: new Date().toISOString(),
      stackTrace: stack?.split('\n').slice(1, 3).join('\n')
    });
    setTargetAdminEmail(email);
  };

  const handlesourceAdminEmailsChange = (emails: {[domain: string]: string}) => {
    const stack = new Error().stack;
    console.log('[Migration Wizard] Source emails changed:', {
      emails,
      timestamp: new Date().toISOString(),
      stackTrace: stack?.split('\n').slice(1, 3).join('\n')
    });
    setSourceAdminEmails(emails);
  };

  const handledestAdminEmailsChange = (emails: {[domain: string]: string}) => {
    const stack = new Error().stack;
    console.log('[Migration Wizard] Dest emails changed:', {
      emails,
      timestamp: new Date().toISOString(),
      stackTrace: stack?.split('\n').slice(1, 3).join('\n')
    });
    setTargetAdminEmails(emails);
  };

  // Handle user discovery trigger from DomainWideDelegationSetup
  const handleUserDiscoveryReady = (data: {
    sourceDomains: string[];
    targetDomains: string[];
    adminEmails: {[domain: string]: string};
    scenario: 'single-super-admin' | 'cross-tenant';
    verificationToken?: string;
  }) => {
    console.log('[Migration Wizard] User discovery ready with data:', {
      ...data,
      adminEmails: Object.keys(data.adminEmails).reduce((acc, domain) => {
        acc[domain] = data.adminEmails[domain] ? '***@' + data.adminEmails[domain].split('@')[1] : 'NO_EMAIL'
        return acc
      }, {} as {[domain: string]: string}),
      verificationToken: data.verificationToken ? `${data.verificationToken.substring(0, 20)}...` : 'NOT_PROVIDED'
    });

    // Update migration config with the validated domains and admin emails
    // DISABLED: Auto-selection of first domains - require manual selection
    setMigrationConfig(prev => ({
      ...prev,
      sourceDomain: '', // No auto-selection - manual selection required
      targetDomain: '', // No auto-selection - manual selection required
      targetDomains: data.targetDomains || []
    }));

    // Store the admin emails for user discovery
    if (data.scenario === 'single-super-admin') {
      // DISABLED: Auto-selection of primary source domain - require manual selection
      // For single super admin, admin email must be manually configured
      // const primarySourceDomain = (data.sourceDomains && data.sourceDomains.length > 0) ? data.sourceDomains[0] : null;
      // if (primarySourceDomain && data.adminEmails && data.adminEmails[primarySourceDomain]) {
      //   setAdminEmail(data.adminEmails[primarySourceDomain]);
      // }
    } else if (data.scenario === 'cross-tenant') {
      // For cross-tenant, separate source and target admin emails
      const sourceEmails: {[domain: string]: string} = {};
      const targetEmails: {[domain: string]: string} = {};
      
      (data.sourceDomains || []).forEach(domain => {
        if (data.adminEmails && data.adminEmails[domain]) {
          sourceEmails[domain] = data.adminEmails[domain];
        }
      });
      
      (data.targetDomains || []).forEach(domain => {
        if (data.adminEmails && data.adminEmails[domain]) {
          targetEmails[domain] = data.adminEmails[domain];
        }
      });
      
      // Update state with separated admin emails
      if (Object.keys(sourceEmails).length === 1) {
        setSourceAdminEmail(Object.values(sourceEmails)[0]);
      } else if (Object.keys(sourceEmails).length > 1) {
        setSourceAdminEmails(sourceEmails);
      }
      
      if (Object.keys(targetEmails).length === 1) {
        setTargetAdminEmail(Object.values(targetEmails)[0]);
      } else if (Object.keys(targetEmails).length > 1) {
        setTargetAdminEmails(targetEmails);
      }
    }

    // Store verification token for authenticated user discovery operations
    if (data.verificationToken) {
      try {
        // Store the token in localStorage for persistent domain authentication until session closed
        localStorage.setItem('dwd_verification_token', data.verificationToken);
        
        // Also decode and log verification details (for debugging)
        const verificationData = JSON.parse(atob(data.verificationToken));
        console.log('[Migration Wizard] Verification token stored:', {
          verificationId: verificationData.verificationId,
          timestamp: verificationData.timestamp,
          verifiedDomains: verificationData.verifiedDomains?.length || 0,
          serviceAccountEmail: verificationData.serviceAccountEmail ? '***@' + verificationData.serviceAccountEmail.split('@')[1] : 'NOT_SET',
          delegationVerified: verificationData.delegationStatus?.sourceVerified && verificationData.delegationStatus?.destVerified
        });
      } catch (error) {
        console.error('[Migration Wizard] Error processing verification token:', error);
      }
    }

    console.log('[Migration Wizard] User discovery configuration ready - admin emails updated for user discovery');
  };

  // Get target domains for multi-target scenarios
  const getTargetDomains = useCallback((): string[] => {
    // First check if we have target domains array in migration config
    if (migrationConfig.targetDomains && migrationConfig.targetDomains.length > 0) {
      return migrationConfig.targetDomains.filter((domain): domain is string => Boolean(domain));
    }
    
    // Fallback to domain mapping configuration (Record<string, string[]>)
    if (!domainMapping) return [migrationConfig.targetDomain].filter((domain): domain is string => Boolean(domain));
    
    // Extract target domains from the mapping
    const targets = Object.values(domainMapping).flat().filter((domain): domain is string => Boolean(domain));
    return targets.length > 0 ? targets : [migrationConfig.targetDomain].filter((domain): domain is string => Boolean(domain));
  }, [migrationConfig.targetDomains, migrationConfig.targetDomain, domainMapping]);

  // Get source domains for multi-source scenarios
  const getSourceDomains = useCallback((): string[] => {
    if (!domainMapping) return [migrationConfig.sourceDomain].filter((domain): domain is string => Boolean(domain));
    
    // Extract source domains from the mapping keys
    const sources = Object.keys(domainMapping).filter((domain): domain is string => Boolean(domain));
    return sources.length > 0 ? sources : [migrationConfig.sourceDomain].filter((domain): domain is string => Boolean(domain));
  }, [domainMapping, migrationConfig.sourceDomain]);

  // OAuth Authentication Functions for Domain Discovery
  const initiateOAuthForDomainDiscovery = async () => {
    try {
      setOauthInProgress('discovery');
      
      // Build OAuth URL with proper scopes for domain discovery
      const scopes = [
        'https://www.googleapis.com/auth/admin.directory.domain.readonly',
        'https://www.googleapis.com/auth/admin.directory.user.readonly',
        'https://www.googleapis.com/auth/admin.directory.group.readonly',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/contacts.readonly'
      ].join(' ');

      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      const redirectUri = `${window.location.origin}/api/auth/oauth/callback/google`;
      
      const params = new URLSearchParams({
        client_id: clientId || '',
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: scopes,
        access_type: 'offline',
        prompt: 'consent',
        state: JSON.stringify({ 
          type: 'domain_discovery', 
          scenario: selectedScenario,
          migrationId: Date.now() 
        })
      });

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
      
      // Open OAuth in popup window
      const popup = window.open(authUrl, 'oauth_discovery', 'width=600,height=600,scrollbars=yes,resizable=yes');
      
      // Listen for OAuth completion
      const checkClosed = setInterval(() => {
        try {
          if (popup?.closed) {
            clearInterval(checkClosed);
            setOauthInProgress(null);
            // Check if authentication was successful and discover domains
            checkOAuthStatusAndDiscoverDomains();
          }
        } catch (error) {
          // Handle case where we can't access popup.closed due to COOP policy
          console.log('Cannot check popup.closed due to COOP policy, checking auth status anyway');
          clearInterval(checkClosed);
          setOauthInProgress(null);
          checkOAuthStatusAndDiscoverDomains();
        }
      }, 1000);

    } catch (error) {
      console.error('OAuth initiation error:', error);
      setOauthInProgress(null);
    }
  };

  const initiateAdditionalOAuth = async (domainHint?: string) => {
    try {
      setOauthInProgress('additional');
      
      const scopes = [
        'https://www.googleapis.com/auth/admin.directory.domain.readonly',
        'https://www.googleapis.com/auth/admin.directory.user.readonly',
        'https://www.googleapis.com/auth/admin.directory.group.readonly'
      ].join(' ');

      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      const redirectUri = `${window.location.origin}/api/auth/oauth/callback/google`;
      
      const params = new URLSearchParams({
        client_id: clientId || '',
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: scopes,
        access_type: 'offline',
        prompt: 'consent',
        state: JSON.stringify({ 
          type: 'additional_domain_discovery', 
          scenario: selectedScenario,
          migrationId: Date.now() 
        })
      });

      if (domainHint) {
        params.set('hd', domainHint);
      }

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
      
      const popup = window.open(authUrl, 'oauth_additional', 'width=600,height=600,scrollbars=yes,resizable=yes');
      
      const checkClosed = setInterval(() => {
        try {
          if (popup?.closed) {
            clearInterval(checkClosed);
            setOauthInProgress(null);
            checkAdditionalOAuthStatus();
          }
        } catch (error) {
          // Handle case where we can't access popup.closed due to COOP policy
          console.log('Cannot check popup.closed due to COOP policy, checking auth status anyway');
          clearInterval(checkClosed);
          setOauthInProgress(null);
          checkAdditionalOAuthStatus();
        }
      }, 1000);

    } catch (error) {
      console.error('Additional OAuth error:', error);
      setOauthInProgress(null);
    }
  };

  const checkAdditionalOAuthStatus = async () => {
    try {
      const response = await fetch('/api/auth/oauth/discover-domains?type=additional');
      const data = await response.json();
      
      if (data.authenticated && data.domains) {
        // Add newly discovered domains to target domains for cross-tenant
        setAvailableTargetDomains(prev => {
          const combined = [...prev, ...data.domains];
          return Array.from(new Set(combined)); // Remove duplicates
        });
        
        setOauthTokens(prev => ({
          ...prev,
          'additional': {
            authenticated: true,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            expiresAt: data.expiresAt
          }
        }));
      }
    } catch (error) {
      console.error('Additional domain discovery error:', error);
    }
  };

  const revokeOAuthToken = async (tokenKey: string) => {
    try {
      await fetch('/api/auth/oauth/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenKey })
      });
      
      // Clear local status
      setOauthTokens(prev => {
        const newTokens = { ...prev };
        delete newTokens[tokenKey];
        return newTokens;
      });
      
      // Reset discovered domains if revoking primary token
      if (tokenKey === 'primary') {
        setAuthenticatedDomains([]);
        setAvailableSourceDomains([]);
        if (selectedScenario === 'single-super-admin') {
          setAvailableTargetDomains([]);
        }
      }
    } catch (error) {
      console.error('OAuth revocation error:', error);
    }
  };

  // Check if all required admin emails are provided
  const areAllAdminEmailsProvided = useCallback((): boolean => {
    // Check if service account is configured (if so, admin emails are optional)
    const serviceAccountEmail = process.env.NEXT_PUBLIC_GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL;
    
    // If service account is configured, admin emails are not required
    if (serviceAccountEmail) {
      // console.log('[Migration Page] Service account configured, admin emails not required:', serviceAccountEmail ? '***@' + serviceAccountEmail.split('@')[1] : 'NOT_SET');
      return true;
    }
    
    // Fallback to original logic if service account is not configured
    if (selectedScenario === 'single-super-admin') {
      // For single super admin, check admin email OR authenticated user email
      return !!(adminEmail || user?.email);
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
  }, [selectedScenario, adminEmail, user?.email, sourceAdminEmail, targetAdminEmail, sourceAdminEmails, targetAdminEmails, getSourceDomains, getTargetDomains]);

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
                  selectedUserMapping={userMappingConfig?.relationship}
                  onUserMappingSelect={(mapping) => {
                    const newUserMappingConfig = {
                      relationship: mapping,
                      strategy: 'automatic' as const,
                      conflictResolution: 'rename' as const,
                      preserveUsernames: true
                    };
                    setUserMappingConfig(newUserMappingConfig);
                    
                    // Auto-redirect to authentication if both scenario and user mapping are selected
                    if (selectedScenario) {
                      console.log('[Migration Wizard] Both scenario and user mapping selected, auto-redirecting to auth-and-domains');
                      setTimeout(() => {
                        setCurrentStep('auth-and-domains');
                      }, 500); // Small delay to show the selection visually before redirecting
                    }
                  }}
                />
              </ComponentLoader>
            </div>

            {/* Selection Status Indicator */}
            <div className="max-w-4xl mx-auto">
              <div className={`p-4 rounded-xl border ${
                selectedScenario && userMappingConfig?.relationship
                  ? 'bg-green-50 border-green-200'
                  : 'bg-yellow-50 border-yellow-200'
              }`}>
                <div className="flex items-center space-x-3">
                  {selectedScenario && userMappingConfig?.relationship ? (
                    <>
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <div>
                        <h3 className="font-medium text-green-900">Ready to Proceed</h3>
                        <p className="text-sm text-green-700">
                          {selectedScenario === 'single-super-admin' ? 'Single Super Admin' : 'Cross-Tenant'} migration with {userMappingConfig.relationship} user mapping selected. 
                          Redirecting to authentication...
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <Clock className="h-5 w-5 text-yellow-600" />
                      <div>
                        <h3 className="font-medium text-yellow-900">Complete Your Selection</h3>
                        <div className="text-sm text-yellow-800 space-y-1">
                          <p>Please select both options to continue:</p>
                          <div className="ml-4 space-y-1">
                            <div className="flex items-center space-x-2">
                              {selectedScenario ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              ) : (
                                <Circle className="h-4 w-4 text-gray-400" />
                              )}
                              <span>Migration scenario</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              {userMappingConfig?.relationship ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              ) : (
                                <Circle className="h-4 w-4 text-gray-400" />
                              )}
                              <span>User mapping strategy</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
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

      case 'auth-and-domains':
        if (!selectedScenario) return null;
        return (
          <div className="space-y-8">
            {/* Header */}
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-xl">
                  <Shield className="h-8 w-8 text-indigo-600" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                Authenticate Google Workspace
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                {selectedScenario === 'single-super-admin' 
                  ? 'Authenticate with your Google Workspace to discover and configure domains under your super admin account.'
                  : 'Authenticate with both source and target Google Workspace domains to enable cross-tenant migration.'}
              </p>
            </div>

            {/* Configuration Summary */}
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-indigo-900 mb-2 flex items-center">
                    <Users className="h-5 w-5 mr-2" />
                    Migration Scenario
                  </h3>
                  <p className="text-indigo-800 text-sm">
                    {selectedScenario === 'single-super-admin' ? 'Single Super Admin Migration' : 'Cross-Tenant Migration'}
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-indigo-900 mb-2 flex items-center">
                    <GitBranch className="h-5 w-5 mr-2" />
                    User Mapping Strategy
                  </h3>
                  <p className="text-indigo-800 text-sm">
                    {userMappingConfig?.relationship ? 
                      userMappingConfig.relationship.charAt(0).toUpperCase() + userMappingConfig.relationship.slice(1).replace('-', ' to ') + ' mapping'
                      : 'Not configured'}
                  </p>
                </div>
              </div>
            </div>

            {/* Authentication Component */}
            <div className="max-w-4xl mx-auto">
              <ComponentLoader>
                <AuthenticateAndConfigureDomains
                  selectedScenario={selectedScenario}
                  sessionId={oauthSessionId}
                  userMappingStrategy={userMappingConfig?.relationship}
                  onConfigurationComplete={handleDomainConfiguration}
                />
              </ComponentLoader>
            </div>
          </div>
        );

      case 'user-mapping':
        if (!selectedScenario) return null;
        return (
          <div className="space-y-8">
            <ComponentLoader>
              <UserMappingRelationshipSelector
                selectedScenario={selectedScenario}
                onSelectionComplete={(config) => {
                  setUserMappingConfig(config);
                  handleNext();
                }}
              />
            </ComponentLoader>
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
                Domain-wide Delegation Setup
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Configure domain-wide delegation to allow the migration tool to access Google Workspace APIs on behalf of users.
              </p>
            </div>

            {/* Configuration Summary */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
              <div className="flex items-start space-x-3">
                <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-medium text-blue-900 mb-2">Configuration Summary</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-blue-900">Migration Type:</span>
                      <span className="text-blue-800 ml-2">{selectedScenario === 'single-super-admin' ? 'Single Super Admin' : 'Cross-Tenant'}</span>
                    </div>
                    <div>
                      <span className="font-medium text-blue-900">Domains:</span>
                      <span className="text-blue-800 ml-2">
                        {domainMapping?.sourceDomains && domainMapping.sourceDomains.length > 0 
                          ? domainMapping.sourceDomains.join(', ') 
                          : getSourceDomains().join(', ')
                        } → {
                          domainMapping?.targetDomain || 
                          (domainMapping?.targetDomains && domainMapping.targetDomains.length > 0 
                            ? domainMapping.targetDomains.join(', ')
                            : getTargetDomains().join(', ')
                          )
                        }
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Domain-wide Delegation Setup */}
            <div className="max-w-4xl mx-auto">
              <ComponentLoader>
                <DomainWideDelegationSetup
                  migrationScenario={selectedScenario || undefined}
                  domainMapping={domainMapping || undefined}
                  onComplete={() => setDwdSetupComplete(true)}
                  onVerificationStatusChange={setDwdVerificationStatus}
                  // For single super admin scenario
                  adminEmail={selectedScenario === 'single-super-admin' ? adminEmail : undefined}
                  // For cross-tenant scenario
                  sourceAccount={selectedScenario === 'cross-tenant' ? sourceAdminEmail : undefined}
                  destAccount={selectedScenario === 'cross-tenant' ? targetAdminEmail : undefined}
                  sourceAccounts={selectedScenario === 'cross-tenant' && getSourceDomains().length > 1 ? sourceAdminEmails : undefined}
                  destAccounts={selectedScenario === 'cross-tenant' && getTargetDomains().length > 1 ? targetAdminEmails : undefined}
                  onAdminEmailChange={handleAdminEmailChange}
                  onsourceAdminEmailChange={handlesourceAdminEmailChange}
                  ondestAdminEmailChange={handledestAdminEmailChange}
                  onsourceAdminEmailsChange={handlesourceAdminEmailsChange}
                  ondestAdminEmailsChange={handledestAdminEmailsChange}
                />
              </ComponentLoader>
            </div>

            {/* Status Indicator */}
            {dwdSetupComplete && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-6">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                  <div>
                    <h3 className="font-medium text-green-900">Domain-wide Delegation Configured</h3>
                    <p className="text-green-700 text-sm">The service account has been properly configured for domain-wide delegation.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        );      case 'delegation':
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
              {/* Authentication Prerequisite Warning */}
              {!isOAuthCompleteForDomainDiscovery() && (
                <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-400 rounded-lg">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <AlertTriangle className="h-5 w-5 text-red-400" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">
                        Authentication Required
                      </h3>
                      <div className="mt-2 text-sm text-red-700">
                        <p>
                          Domain-wide delegation setup requires authentication to be completed first. 
                          Please complete the "Authenticate & Configure Domains" step before proceeding.
                        </p>
                        <div className="mt-3">
                          <button
                            onClick={() => setCurrentStep('auth-and-domains')}
                            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-800 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                          >
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Go to Authentication Step
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <ComponentLoader>
                <DomainWideDelegationSetup
                  // For single super admin scenario
                  adminEmail={selectedScenario === 'single-super-admin' ? adminEmail : undefined}
                  // For cross-tenant scenario
                  sourceAccount={selectedScenario === 'cross-tenant' ? sourceAdminEmail : undefined}
                  destAccount={selectedScenario === 'cross-tenant' && getTargetDomains().length <= 1 ? targetAdminEmail : undefined}
                  sourceAccounts={selectedScenario === 'cross-tenant' && getSourceDomains().length > 1 ? sourceAdminEmails : undefined}
                  destAccounts={selectedScenario === 'cross-tenant' && getTargetDomains().length > 1 ? targetAdminEmails : undefined}
                  migrationScenario={selectedScenario || undefined}
                  domainMapping={domainMapping || undefined}
                  onComplete={handleDwdSetupComplete}
                  onVerificationStatusChange={handleVerificationStatusChange}
                  onAdminEmailChange={handleAdminEmailChange}
                  onsourceAdminEmailChange={handlesourceAdminEmailChange}
                  ondestAdminEmailChange={handledestAdminEmailChange}
                  onsourceAdminEmailsChange={handlesourceAdminEmailsChange}
                  ondestAdminEmailsChange={handledestAdminEmailsChange}
                  onUserDiscoveryReady={handleUserDiscoveryReady}
                  className="bg-white"
                  // Disable the component if authentication is not complete
                  style={!isOAuthCompleteForDomainDiscovery() ? { opacity: 0.5, pointerEvents: 'none' } : undefined}
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

      case 'user-management':
        // Debug log the props being passed to UserManagementWorkflow
        // Debug log the props being passed to UserManagementWorkflow
        
        return (
          <div className="space-y-8">
            {/* Header */}
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl">
                  <Users className="h-8 w-8 text-green-600" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                User Management & Discovery
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                {selectedScenario === 'single-super-admin' 
                  ? 'Discover users from your Google Workspace and configure user mappings for migration across domains.'
                  : 'Discover users from both source and target domains and configure cross-tenant user mappings.'}
              </p>
            </div>

            {/* Configuration Summary */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-green-900 mb-2 flex items-center">
                    <Shield className="h-5 w-5 mr-2" />
                    Migration Scenario
                  </h3>
                  <p className="text-green-800 text-sm">
                    {selectedScenario === 'single-super-admin' ? 'Single Super Admin Migration' : 'Cross-Tenant Migration'}
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-green-900 mb-2 flex items-center">
                    <GitBranch className="h-5 w-5 mr-2" />
                    User Mapping Strategy
                  </h3>
                  <p className="text-green-800 text-sm">
                    {userMappingConfig?.relationship ? 
                      userMappingConfig.relationship.charAt(0).toUpperCase() + userMappingConfig.relationship.slice(1).replace('-', ' to ') + ' mapping'
                      : 'Not configured'}
                  </p>
                </div>
              </div>
              {domainMapping && (
                <div className="mt-4 pt-4 border-t border-green-300">
                  <h3 className="font-semibold text-green-900 mb-2 flex items-center">
                    <Database className="h-5 w-5 mr-2" />
                    Domain Configuration
                  </h3>
                  <p className="text-green-800 text-sm">
                    Domain mapping configured: {Object.keys(domainMapping).length} source domain(s) to {Object.values(domainMapping).flat().length} target domain(s)
                  </p>
                </div>
              )}
            </div>

            {/* UserManagementWorkflow Component */}
            <div className="max-w-6xl mx-auto">
              <ComponentLoader>
                <UserManagementWorkflow
                  sourceDomains={sourceDomains}
                  targetDomains={targetDomains}
                  sourceAdminEmails={memoizedSourceAdminEmails}
                  sourceAdminEmail={memoizedSourceAdminEmail}
                  targetAdminEmails={targetAdminEmails}
                  migrationScenario={memoizedMigrationScenario}
                  domainMapping={domainMapping ? {
                    type: memoizedMappingType || 'one-to-one',
                    sourceDomains: Object.keys(domainMapping),
                    targetDomains: Object.values(domainMapping).flat(),
                    userMappingStrategy: 'automatic' as const,
                    preserveStructure: true,
                    allowCrossTenant: selectedScenario === 'cross-tenant'
                  } : undefined}
                  userMappingStrategy={memoizedUserMappingStrategy}
                  userMappingConfig={memoizedUserMappingConfig}
                  verificationToken={memoizedVerificationToken}
                  mappingType={memoizedMappingType}
                  onComplete={(results) => {
                    console.log('[Migration Wizard] Workflow completed with results:', {
                      discoveredUsers: results.discoveredUsers?.length || 0,
                      createdUsers: results.createdUsers?.length || 0,
                      mappings: results.mappings?.length || 0,
                      userPairs: results.userPairs?.length || 0
                    });
                    
                    setDiscoveredUsers(results.discoveredUsers);
                    setCreatedUsers(results.createdUsers);
                    setUserMappings(results.mappings);
                    
                    // Log the source-to-target user pairs for services migration
                    console.log('[Migration Wizard] Source-to-target user pairs:', results.userPairs);
                    console.log('[Migration Wizard] Comprehensive mapping:', results.sourceToTargetMapping);
                    
                    // Advance to configuration step after user management completes
                    console.log('[Migration Wizard] User management complete, advancing to configuration step');
                    setCurrentStep('configuration');
                  }}
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

            {/* Migration Name */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <FileText className="h-5 w-5 mr-2 text-blue-600" />
                Migration Name
              </h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Give your migration a descriptive name
                </label>
                <input
                  type="text"
                  value={migrationConfig.migrationName}
                  onChange={(e) => setMigrationConfig(prev => ({ ...prev, migrationName: e.target.value }))}
                  placeholder="e.g., Acme Corp Acquisition Migration, Q4 2024 Domain Consolidation"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
                <p className="text-sm text-gray-500 mt-2">
                  Choose a name that helps you identify this migration later. This will appear in your dashboard and migration history.
                </p>
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

              {/* Admin Email Configuration - Removed for service account authentication */}

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
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                        {getSourceDomains().length > 1 ? 'Primary Source Domain' : 'Source Domain'}
                        {domainMapping && Object.keys(domainMapping).length > 0 && migrationConfig.sourceDomain && (
                          <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Auto-populated
                          </span>
                        )}
                      </label>
                      <input
                        type="text"
                        value={migrationConfig.sourceDomain}
                        onChange={(e) => setMigrationConfig(prev => ({ ...prev, sourceDomain: e.target.value }))}
                        placeholder={domainMapping && Object.keys(domainMapping).length > 0 ? "Auto-populated from domain mapping" : "e.g., oldcompany.com"}
                        autoComplete="off"
                        readOnly={!!(domainMapping && Object.keys(domainMapping).length > 0 && migrationConfig.sourceDomain)}
                        className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          domainMapping && Object.keys(domainMapping).length > 0 && migrationConfig.sourceDomain
                            ? 'border-blue-300 bg-blue-50 text-blue-900'
                            : 'border-gray-300'
                        }`}
                        required
                      />
                      {getSourceDomains().length > 1 ? (
                        <p className="text-xs text-gray-500 mt-1">
                          Primary domain for migration. Total source domains: {getSourceDomains().length}
                        </p>
                      ) : domainMapping && Object.keys(domainMapping).length > 0 && migrationConfig.sourceDomain && (
                        <p className="text-xs text-blue-600 mt-1">
                          ✓ Auto-populated from previous domain mapping selection
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
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                        {getTargetDomains().length > 1 ? 'Primary Target Domain' : 'Target Domain'}
                        {domainMapping && Object.keys(domainMapping).length > 0 && migrationConfig.targetDomain && (
                          <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Auto-populated
                          </span>
                        )}
                      </label>
                      <input
                        type="text"
                        value={migrationConfig.targetDomain}
                        onChange={(e) => setMigrationConfig(prev => ({ ...prev, targetDomain: e.target.value }))}
                        placeholder={domainMapping && Object.keys(domainMapping).length > 0 ? "Auto-populated from domain mapping" : "e.g., newcompany.com"}
                        autoComplete="off"
                        readOnly={!!(domainMapping && Object.keys(domainMapping).length > 0 && migrationConfig.targetDomain)}
                        className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          domainMapping && Object.keys(domainMapping).length > 0 && migrationConfig.targetDomain
                            ? 'border-blue-300 bg-blue-50 text-blue-900'
                            : 'border-gray-300'
                        }`}
                        required
                      />
                      {getTargetDomains().length > 1 ? (
                        <p className="text-xs text-gray-500 mt-1">
                          Primary domain for migration. Total target domains: {getTargetDomains().length}
                        </p>
                      ) : domainMapping && Object.keys(domainMapping).length > 0 && migrationConfig.targetDomain && (
                        <p className="text-xs text-blue-600 mt-1">
                          ✓ Auto-populated from previous domain mapping selection
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

                {/* Select users for migration */}
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Users className="h-5 w-5 mr-2 text-gray-600" />
                    Select users for migration
                  </h3>
                  
                  {/* Toggle for using existing users */}

                  {/* Existing Users List */}
                  <div className="space-y-4">
                    {allTargetUsers.length > 0 ? (
                      <>
                        {/* Select All Controls */}
                        <div className="flex items-center justify-between py-2 border-b border-gray-200">
                          <span className="text-sm font-medium text-gray-700">
                            Target Domain Users ({allTargetUsers.length})
                          </span>
                          <div className="flex space-x-2">
                            <button
                              type="button"
                              onClick={() => setSelectedExistingUsers([...allTargetUsers])}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                              Select All
                            </button>
                            <span className="text-xs text-gray-400">|</span>
                            <button
                              type="button"
                              onClick={() => setSelectedExistingUsers([])}
                              className="text-xs text-gray-600 hover:text-gray-800 font-medium"
                            >
                              Clear All
                            </button>
                          </div>
                        </div>

                        {/* Users List */}
                        <div className="max-h-48 overflow-y-auto space-y-2">
                          {allTargetUsers.map((user) => {
                            const isSelected = selectedExistingUsers.some(u => 
                              (u.email || u.primaryEmail) === (user.email || user.primaryEmail)
                            );
                            const sourceUser = findSourceUserForTarget(user);
                            return (
                              <label
                                key={user.email || user.primaryEmail}
                                className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                  isSelected
                                    ? 'border-blue-300 bg-blue-50'
                                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {
                                    setSelectedExistingUsers(prev => {
                                      const userEmail = user.email || user.primaryEmail;
                                      const exists = prev.some(u => (u.email || u.primaryEmail) === userEmail);
                                      if (exists) {
                                        return prev.filter(u => (u.email || u.primaryEmail) !== userEmail);
                                      } else {
                                        return [...prev, user];
                                      }
                                    });
                                  }}
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center space-x-2">
                                    <span className="text-sm font-medium text-gray-900 truncate">
                                      {typeof user.name === 'string' ? user.name : 
                                       user.name?.fullName || 
                                       `${user.name?.givenName || ''} ${user.name?.familyName || ''}`.trim() || 
                                       user.email || user.primaryEmail}
                                    </span>
                                    {user.isAdmin && (
                                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                        Admin
                                      </span>
                                    )}
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                      Verified
                                    </span>
                                    {sourceUser && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                        Mapped
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-gray-500 truncate mt-1">
                                    <span className="font-medium">Target:</span> {user.email || user.primaryEmail}
                                  </div>
                                  <div className="text-xs text-blue-600 truncate">
                                    <span className="font-medium">Domain:</span> {(user.email || user.primaryEmail)?.split('@')[1]}
                                  </div>
                                  {sourceUser && (
                                    <>
                                      <div className="text-xs text-orange-600 truncate mt-1">
                                        <span className="font-medium">Source:</span> {sourceUser.sourceName} ({sourceUser.sourceEmail})
                                      </div>
                                      <div className="text-xs text-orange-500 truncate">
                                        <span className="font-medium">From:</span> {sourceUser.sourceDomain}
                                      </div>
                                    </>
                                  )}
                                </div>
                              </label>
                            );
                          })}
                        </div>

                        {/* Selection Summary */}
                        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Selected Users:</span>
                            <span className="font-medium text-gray-900">
                              {selectedExistingUsers.length} of {allTargetUsers.length}
                            </span>
                          </div>
                          {selectedExistingUsers.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {selectedExistingUsers.slice(0, 3).map(user => (
                                <span key={user.email || user.primaryEmail} className="inline-flex items-center px-2 py-1 rounded-md bg-blue-100 text-blue-800 text-xs font-medium">
                                  {typeof user.name === 'string' ? user.name : 
                                   user.name?.fullName || 
                                   user.email || user.primaryEmail}
                                </span>
                              ))}
                              {selectedExistingUsers.length > 3 && (
                                <span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 text-gray-600 text-xs font-medium">
                                  +{selectedExistingUsers.length - 3} more
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-8">
                        <Users className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-sm text-gray-600 mb-2">No target domain users found</p>
                        <p className="text-xs text-gray-500 mb-4">
                          Target users will be loaded from the target domains once user discovery is completed
                        </p>
                        
                        {/* Debug Information */}
                        <div className="text-xs text-gray-400 bg-gray-50 p-3 rounded-lg mb-4">
                          <p>Debug Info:</p>
                          <p>• Target Domains: {getTargetDomains().length} ({getTargetDomains().join(', ')})</p>
                          <p>• Target Admin Emails: {Object.keys(targetAdminEmails).length}</p>
                          <p>• Current Step: {currentStep}</p>
                          <p>• Loading: {loadingAllTargetUsers ? 'Yes' : 'No'}</p>
                        </div>
                        
                        {/* Manual Load Button */}
                        <div className="space-y-2">
                          <button
                            onClick={() => loadTargetUsersFromAdminConsole()}
                            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                            disabled={loadingAllTargetUsers}
                          >
                            {loadingAllTargetUsers ? 'Loading...' : 'Load from Google Admin Console'}
                          </button>
                          
                          {/* Debug Info Button */}
                          <button
                            onClick={() => {
                              console.log('=== DEBUG INFO ===');
                              console.log('Target Domains:', getTargetDomains());
                              console.log('Target Admin Emails:', targetAdminEmails);
                              console.log('Single Target Admin Email:', targetAdminEmail);
                              console.log('Selected Scenario:', selectedScenario);
                              console.log('Domain Mapping:', domainMapping);
                              console.log('Current allTargetUsers:', allTargetUsers);
                              console.log('==================');
                            }}
                            className="px-4 py-2 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
                          >
                            Show Debug Info
                          </button>
                        </div>
                        
                        {loadingAllTargetUsers && (
                          <div className="mt-3">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                            <p className="text-xs text-blue-600 mt-2">Loading target domain users...</p>
                          </div>
                        )}
                      </div>
                    )}
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
                    <div className="text-sm text-gray-600 mb-1">Migration Name</div>
                    <div className="font-medium text-gray-900">
                      {migrationConfig.migrationName || 'Untitled Migration'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Migration Type</div>
                    <div className="font-medium text-gray-900">
                      {selectedScenario === 'single-super-admin' ? 'Single Super Admin Migration' : 'Cross-Tenant Migration'}
                    </div>
                  </div>
                  {domainMapping && (
                    <div className="md:col-span-2">
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
                        <div className="text-gray-700 mb-2">Domain Mapping:</div>
                        <div className="space-y-2">
                          {Object.entries(domainMapping).map(([source, targets], idx) => (
                            <div key={idx} className="flex items-center space-x-4">
                              <span className="text-blue-600 font-medium">{source}</span>
                              <ArrowRight className="h-4 w-4 text-gray-400" />
                              <span className="text-green-600 font-medium">
                                {Array.isArray(targets) ? targets.join(', ') : targets}
                              </span>
                            </div>
                          ))}
                        </div>
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
                        Target Domain{(migrationConfig.targetDomains && migrationConfig.targetDomains.length > 1) ? 's' : ''}
                      </div>
                      <div className="font-medium text-gray-900">
                        {domainMapping ? formatTargetDomains(domainMapping) : migrationConfig.targetDomain}
                      </div>
                      {migrationConfig.targetDomains && migrationConfig.targetDomains.length > 1 && (
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

              {/* Existing Target Users */}
              {selectedExistingUsers.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Users className="h-5 w-5 mr-2 text-blue-600" />
                    Selected Existing Target Users ({selectedExistingUsers.length})
                  </h3>
                  <div className="space-y-3">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-gray-600 mb-1">Total Existing Users</div>
                        <div className="font-medium text-gray-900">{selectedExistingUsers.length}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600 mb-1">Admin Users</div>
                        <div className="font-medium text-gray-900">
                          {selectedExistingUsers.filter(user => user.isAdmin).length}
                        </div>
                      </div>
                    </div>
                    <div className="max-h-32 overflow-y-auto">
                      <div className="text-sm text-gray-600 mb-2">Existing users to migrate to:</div>
                      <div className="space-y-1">
                        {selectedExistingUsers.slice(0, 10).map(user => (
                          <div key={user.id} className="flex items-center space-x-2 text-sm">
                            <Mail className="h-3 w-3 text-blue-400" />
                            <span className="text-gray-900">{user.name || user.email}</span>
                            {user.name && user.name !== user.email && (
                              <span className="text-gray-500">({user.email})</span>
                            )}
                            {user.isAdmin && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                Admin
                              </span>
                            )}
                          </div>
                        ))}
                        {selectedExistingUsers.length > 10 && (
                          <div className="text-sm text-gray-500 italic">
                            ...and {selectedExistingUsers.length - 10} more users
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-start space-x-2">
                        <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-blue-800">
                          <p className="font-medium mb-1">Migration to Existing Users</p>
                          <p>Data will be migrated to these existing target domain users. Ensure proper permissions and backup policies are in place.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Existing Target Users */}
              {selectedExistingUsers.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Users className="h-5 w-5 mr-2 text-blue-600" />
                    Selected Existing Target Users ({selectedExistingUsers.length})
                  </h3>
                  <div className="space-y-3">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-gray-600 mb-1">Total Existing Users</div>
                        <div className="font-medium text-gray-900">{selectedExistingUsers.length}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600 mb-1">Admin Users</div>
                        <div className="font-medium text-gray-900">
                          {selectedExistingUsers.filter(user => user.isAdmin).length}
                        </div>
                      </div>
                    </div>
                    <div className="max-h-32 overflow-y-auto">
                      <div className="text-sm text-gray-600 mb-2">Existing users to migrate to:</div>
                      <div className="space-y-1">
                        {selectedExistingUsers.slice(0, 10).map(user => (
                          <div key={user.id} className="flex items-center space-x-2 text-sm">
                            <Mail className="h-3 w-3 text-blue-400" />
                            <span className="text-gray-900">{user.name || user.email}</span>
                            {user.name && user.name !== user.email && (
                              <span className="text-gray-500">({user.email})</span>
                            )}
                            {user.isAdmin && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                Admin
                              </span>
                            )}
                          </div>
                        ))}
                        {selectedExistingUsers.length > 10 && (
                          <div className="text-sm text-gray-500 italic">
                            ...and {selectedExistingUsers.length - 10} more users
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-start space-x-2">
                        <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-blue-800">
                          <p className="font-medium mb-1">Migration to Existing Users</p>
                          <p>Data will be migrated to these existing target domain users. Ensure proper permissions and backup policies are in place.</p>
                        </div>
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

  const getTotalSteps = () => {
    return Object.values(STEP_CONFIG as any).filter((config: any) => !config.hidden).length;
  };

  const getStepNumber = () => {
    const visibleSteps = Object.keys(STEP_CONFIG).filter(stepKey => !(STEP_CONFIG as any)[stepKey].hidden);
    const currentIndex = visibleSteps.indexOf(currentStep);
    return currentIndex >= 0 ? currentIndex + 1 : 1;
  };

  const canProceed = useCallback(() => {
    switch (currentStep) {
      case 'scenario':
        return selectedScenario !== null && userMappingConfig !== null;
      case 'auth-and-domains':
        return isOAuthCompleteForDomainDiscovery() && domainMapping !== null;
      case 'delegation':
        // CRITICAL: Authentication must be completed before delegation verification
        const isAuthCompleted = isOAuthCompleteForDomainDiscovery() && domainMapping !== null;
        const adminEmailsProvided = areAllAdminEmailsProvided();
        const canProceedDelegation = isAuthCompleted && dwdSetupComplete && adminEmailsProvided && dwdVerificationStatus;
        console.log('[Migration Wizard] canProceed delegation:', {
          // Authentication prerequisite checks
          isAuthCompleted,
          isOAuthCompleteForDomainDiscovery: isOAuthCompleteForDomainDiscovery(),
          domainMapping: !!domainMapping,
          
          // Delegation specific checks
          dwdSetupComplete,
          areAllAdminEmailsProvided: adminEmailsProvided,
          dwdVerificationStatus,
          
          // User mapping configuration
          userMappingConfig,
          userMappingStrategy: userMappingConfig?.relationship,
          
          // Final result
          canProceed: canProceedDelegation,
          
          // Additional debug info
          selectedScenario,
          adminEmail,
          sourceAdminEmail,
          targetAdminEmail,
          sourceAdminEmails,
          targetAdminEmails,
          sourceDomains: getSourceDomains(),
          targetDomains: getTargetDomains()
        });
        return canProceedDelegation;
      case 'user-mapping':
        return userMappingConfig !== null;
      case 'user-management':
        return discoveredUsers.length > 0;
      case 'configuration':
        const configValid = migrationConfig.migrationName.trim() !== '' &&
               migrationConfig.sourceDomain && 
               migrationConfig.targetDomain && 
               migrationConfig.services.length > 0 &&
               selectedUsers.length > 0; // Require users to be selected
        
        console.log('[Migration Wizard] Configuration validation:', {
          migrationName: migrationConfig.migrationName,
          migrationNameValid: migrationConfig.migrationName.trim() !== '',
          sourceDomain: migrationConfig.sourceDomain,
          sourceDomainValid: !!migrationConfig.sourceDomain,
          targetDomain: migrationConfig.targetDomain,
          targetDomainValid: !!migrationConfig.targetDomain,
          services: migrationConfig.services,
          servicesValid: migrationConfig.services.length > 0,
          selectedUsers: selectedUsers.length,
          selectedUsersValid: selectedUsers.length > 0,
          overallValid: configValid
        });
        
        return configValid;
      case 'review':
        return true;
      default:
        return false;
    }
  }, [
    currentStep, 
    selectedScenario, 
    userMappingConfig, 
    isOAuthCompleteForDomainDiscovery, 
    domainMapping, 
    areAllAdminEmailsProvided, 
    dwdSetupComplete, 
    dwdVerificationStatus, 
    discoveredUsers.length, 
    migrationConfig.migrationName, 
    migrationConfig.sourceDomain, 
    migrationConfig.targetDomain, 
    migrationConfig.services.length, 
    selectedUsers.length,
    adminEmail,
    sourceAdminEmail,
    targetAdminEmail,
    sourceAdminEmails,
    targetAdminEmails,
    getSourceDomains,
    getTargetDomains
  ]);

  const getNextButtonText = useCallback(() => {
    switch (currentStep) {
      case 'scenario':
        return userMappingConfig ? 'Authenticate & Configure Domains' : 'Configure Domain';
      case 'auth-and-domains':
        return 'Setup Delegation';
      case 'user-mapping':
        return 'Setup Delegation';
      case 'delegation':
        return 'Manage Users';
      case 'user-management':
        return 'Configure Settings';
      case 'configuration':
        return 'Review & Confirm';
      default:
        return 'Continue';
    }
  }, [currentStep, userMappingConfig]);

  // Memoize UserManagementWorkflow props to prevent unnecessary re-renders
  const sourceDomains = useMemo(() => getSourceDomains(), [getSourceDomains]);
  const targetDomains = useMemo(() => getTargetDomains(), [getTargetDomains]);
  
  // Add ref to track if we've loaded users for this configuration step
  const hasLoadedUsersForCurrentStep = useRef(false);

  // Load existing users when we enter configuration step
  useEffect(() => {
    console.log('[Migration Config] useEffect triggered - Current step:', currentStep);
    console.log('[Migration Config] hasLoadedUsersForCurrentStep:', hasLoadedUsersForCurrentStep.current);
    console.log('[Migration Config] selectedExistingUsers.length:', selectedExistingUsers.length);
    
    if (currentStep === 'configuration') {
      console.log('[Migration Config] Loading target users...');
      console.log('[Migration Config] Available data - discoveredUsers:', discoveredUsers.length, 'createdUsers:', createdUsers.length, 'userMappings:', userMappings.length);
      
      const isFirstLoad = !hasLoadedUsersForCurrentStep.current;
      console.log('[Migration Config] isFirstLoad:', isFirstLoad);
      
      const loadTargetUsers = async () => {
        setLoadingTargetUsers(true);
        
        try {
          // Debug: Log the current data sources
          console.log('[Migration Config] === USER CLASSIFICATION DEBUG ===');
          console.log('[Migration Config] Debug - userMappings.length:', userMappings.length);
          console.log('[Migration Config] Debug - createdUsers.length:', createdUsers.length);
          console.log('[Migration Config] Debug - discoveredUsers (SOURCE):', discoveredUsers.map(u => u.primaryEmail));
          console.log('[Migration Config] Debug - targetDomains:', getTargetDomains());
          console.log('[Migration Config] Debug - targetAdminEmails:', targetAdminEmails);
          
          // If we have no created users but have user mappings, 
          // check for historical data before giving up
          if (userMappings.length > 0 && createdUsers.length === 0) {
            console.log('[Migration Config] === CHECKING FOR HISTORICAL CLONED USERS ===');
            console.log('[Migration Config] User mappings exist but no users were created in current session');
            
            // Load historical cloned users from localStorage for early exit check
            const earlyHistoricalCheck = loadClonedUsersFromHistory();
            console.log('[Migration Config] Historical cloned users found:', earlyHistoricalCheck.length);
            
            if (earlyHistoricalCheck.length === 0) {
              console.log('[Migration Config] No historical cloned users found either - showing empty list');
              setExistingUsers([]);
              setLoadingTargetUsers(false);
              hasLoadedUsersForCurrentStep.current = true;
              return;
            } else {
              console.log('[Migration Config] Found historical cloned users, will proceed with processing');
              // Continue processing to include historical users
            }
          }
          
          // Priority 1: Check if we have user mappings (from skip or creation process)
          if (userMappings.length > 0) {
            console.log('[Migration Config] Using user mappings to build target users list');
            console.log('[Migration Config] Sample userMapping:', userMappings[0]);
            
            // Check if these mappings are from actual user creation/cloning
            const hasCreatedUsers = createdUsers.length > 0;
            console.log('[Migration Config] Has created users:', hasCreatedUsers);
            console.log('[Migration Config] Created users emails:', createdUsers.map(c => c.user?.primaryEmail));
            
            // Load historical cloned users from localStorage
            const allHistoricalUsers = loadClonedUsersFromHistory();
            console.log('[Migration Config] Historical cloned users loaded:', allHistoricalUsers.length);
            
            const targetUsers = userMappings
              .filter(mapping => {
                // Must have valid target email and domain
                const hasValidTarget = mapping.targetEmail && mapping.targetDomain;
                // Must have valid source user
                const hasValidSource = mapping.user && mapping.user.primaryEmail;
                // Both source and target should exist for complete mapping
                console.log('[Migration Config] Filtering mapping:', {
                  targetEmail: mapping.targetEmail,
                  targetDomain: mapping.targetDomain,
                  hasValidTarget,
                  hasValidSource,
                  sourceEmail: mapping.user?.primaryEmail
                });
                return hasValidTarget && hasValidSource;
              })
              .map(mapping => {
                // Determine if this is a cloned user or just a mapped user
                const isActuallyCloned = createdUsers.some(created => {
                  const match = created.success && 
                    created.user?.primaryEmail === mapping.targetEmail;
                  console.log('[Migration Config] Checking if cloned:', {
                    targetEmail: mapping.targetEmail,
                    createdEmail: created.user?.primaryEmail,
                    success: created.success,
                    match: match
                  });
                  return match;
                });
                
                // Also check if this user exists in historical data
                const isHistoricallyCloned = allHistoricalUsers.some(historical => 
                  historical.email === mapping.targetEmail
                );
                
                const isClonedUser = isActuallyCloned || isHistoricallyCloned;
                
                console.log('[Migration Config] User', mapping.targetEmail, 'is cloned:', isClonedUser, 
                  '(current session:', isActuallyCloned, ', historical:', isHistoricallyCloned, ')');
                
                return {
                  id: mapping.targetEmail,
                  email: mapping.targetEmail,
                  name: mapping.targetName || mapping.user.name?.fullName || 'Unknown User',
                  isAdmin: false, // We don't have admin status for target users from mappings
                  exists: true, // These are confirmed existing mappings
                  sourceMapping: mapping.user.primaryEmail,
                  sourceName: mapping.user.name?.fullName || 'Unknown Source User',
                  targetDomain: mapping.targetDomain,
                  status: isClonedUser ? 'cloned' : mapping.status || 'mapped',
                  userType: isClonedUser ? 'cloned' : 'existing', // Mark as cloned if created in any session
                  isCloned: isClonedUser,
                  isHistorical: isHistoricallyCloned && !isActuallyCloned, // Mark if from history only
                  createdInCurrentSession: isActuallyCloned,
                  createdInPreviousSession: isHistoricallyCloned && !isActuallyCloned
                };
              });
            
            const clonedUsers = targetUsers.filter(user => user.isCloned);
            const existingUsers = targetUsers.filter(user => !user.isCloned);
            
            // Add purely historical users that might not be in current mappings
            const purelyHistoricalUsers = allHistoricalUsers.filter(historical => 
              !targetUsers.some(target => target.email === historical.email)
            ).map(historical => ({
              ...historical,
              isHistorical: true,
              createdInCurrentSession: false,
              createdInPreviousSession: true
            }));
            
            console.log('[Migration Config] Found purely historical users (not in current mappings):', purelyHistoricalUsers.length);
            
            // Combine cloned users with purely historical users
            const allClonedUsers = [...clonedUsers, ...purelyHistoricalUsers];
            
            console.log('[Migration Config] Found cloned users from mappings:', clonedUsers.length);
            console.log('[Migration Config] Found existing mapped users:', existingUsers.length);
            console.log('[Migration Config] Found purely historical users:', purelyHistoricalUsers.length);
            console.log('[Migration Config] Total cloned users (current + historical):', allClonedUsers.length);
            console.log('[Migration Config] All cloned users list:', allClonedUsers.map(u => ({ target: u.email, source: u.sourceMapping, historical: u.isHistorical })));
            
            // If user wants to see only cloned users, filter to show only those
            // Otherwise show all target users (both cloned and existing)
            const shouldShowOnlyCloned = userViewMode === 'cloned'; // Use state to control filter
            
            if (shouldShowOnlyCloned && allClonedUsers.length > 0) {
              console.log('[Migration Config] Filtering to show ONLY cloned users (including historical):', allClonedUsers.length);
              setExistingUsers(allClonedUsers);
            } else if (shouldShowOnlyCloned && allClonedUsers.length === 0) {
              console.log('[Migration Config] No cloned users found (including historical), showing empty list');
              setExistingUsers([]);
            } else {
              console.log('[Migration Config] Setting existingUsers to all target users (cloned + existing)');
              setExistingUsers(targetUsers);
            }
          } else if (createdUsers.length > 0) {
            console.log('[Migration Config] Using created/cloned users as target users');
            console.log('[Migration Config] Created users data:', createdUsers);
            
            const actuallyClonedUsers = createdUsers
              .filter(result => {
                // Only successful creations with valid source mapping
                return result.success && result.user && result.user.primaryEmail && result.sourceEmail;
              })
              .map(result => ({
                id: result.user.primaryEmail,
                email: result.user.primaryEmail,
                name: result.user.name?.fullName || 'Cloned User',
                isAdmin: result.user.isAdmin || false,
                exists: true,
                sourceMapping: result.sourceEmail,
                sourceName: 'Source User', // We don't have source user details here
                status: 'cloned', // These are truly cloned users
                userType: 'cloned', // Mark as cloned user
                isCloned: true, // These are definitely cloned
                targetDomain: result.user.primaryEmail.split('@')[1], // Extract domain from email
                createdAt: result.user.creationTime
              }));
            
            console.log('[Migration Config] Created actually cloned target users from creation results:', actuallyClonedUsers.length);
            console.log('[Migration Config] Actually cloned users list:', actuallyClonedUsers.map(u => ({ target: u.email, source: u.sourceMapping })));
            console.log('[Migration Config] Setting existingUsers to actually cloned target users');
            
            // Save cloned users to history for future sessions
            if (actuallyClonedUsers.length > 0) {
              saveClonedUsersToHistory(actuallyClonedUsers);
            }
            
            setExistingUsers(actuallyClonedUsers);
          } else {
            console.log('[Migration Config] No mappings or created users found, loading actual target domain users with source mapping');
            const actualTargetUsers = await loadActualTargetUsers();
            console.log('[Migration Config] Loaded actual target users:', actualTargetUsers.length);
            
            if (actualTargetUsers.length > 0 && discoveredUsers.length > 0) {
              console.log('[Migration Config] Matching target users with discovered source users...');
              
              // Create a comprehensive list: Target users with their corresponding source users
              const targetUsersWithSourceMapping = actualTargetUsers.map(targetUser => {
                // Find corresponding source user by matching username (local part)
                const targetLocalPart = targetUser.email.split('@')[0].toLowerCase();
                const correspondingSourceUser = discoveredUsers.find(sourceUser => {
                  const sourceLocalPart = sourceUser.primaryEmail.split('@')[0].toLowerCase();
                  return sourceLocalPart === targetLocalPart;
                });
                
                // Always include the target user, but mark if it has source mapping
                const userWithMapping = {
                  ...targetUser,
                  sourceMapping: correspondingSourceUser?.primaryEmail || null,
                  sourceName: correspondingSourceUser?.name?.fullName || null,
                  hasSourceMapping: !!correspondingSourceUser,
                  targetDomain: targetUser.domain,
                  userType: 'target' // Explicitly mark as target user
                };
                
                console.log('[Migration Config] Target user:', targetUser.email, 'Source mapping:', userWithMapping.sourceMapping, 'Has mapping:', userWithMapping.hasSourceMapping);
                return userWithMapping;
              });
              
              // Filter to only show target users that have corresponding source users
              const usersWithValidSourceMapping = targetUsersWithSourceMapping.filter(user => user.hasSourceMapping);
              
              console.log('[Migration Config] Target users with valid source mapping:', usersWithValidSourceMapping.length, 'out of', actualTargetUsers.length, 'total target users');
              console.log('[Migration Config] Final target user list:', usersWithValidSourceMapping.map(u => ({ target: u.email, source: u.sourceMapping })));
              
              console.log('[Migration Config] Setting existingUsers to target users with source mapping');
              setExistingUsers(usersWithValidSourceMapping);
            } else {
              console.log('[Migration Config] No target users found with corresponding source users');
              console.log('[Migration Config] Setting existingUsers to empty array');
              setExistingUsers([]);
            }
          }
          
          // Only reset selection on first load of configuration step
          // Don't reset if users are already selected and this is just a data refresh
          if (isFirstLoad) {
            setSelectedExistingUsers([]);
            hasLoadedUsersForCurrentStep.current = true;
          }
          console.log('[Migration Config] Target users loaded successfully');
        } catch (error) {
          console.error('[Migration Config] Error in loadTargetUsers:', error);
          setExistingUsers([]);
        } finally {
          setLoadingTargetUsers(false);
        }
      };
      
      loadTargetUsers();
    } else {
      // Reset the ref when leaving configuration step
      hasLoadedUsersForCurrentStep.current = false;
    }
  }, [currentStep, discoveredUsers, createdUsers, userMappings, targetDomains, targetAdminEmails, loadActualTargetUsers]);
  
  // Load all target domain users when configuration step is reached
  useEffect(() => {
    console.log('[Target Users Loading] useEffect triggered');
    console.log('[Target Users Loading] currentStep:', currentStep);
    console.log('[Target Users Loading] targetDomains:', getTargetDomains());
    console.log('[Target Users Loading] allTargetUsers.length:', allTargetUsers.length);
    
    if (currentStep === 'configuration') {
      const targetDomainsArray = getTargetDomains();
      const hasTargetDomains = targetDomainsArray.length > 0;
      const needsLoading = allTargetUsers.length === 0 && !loadingAllTargetUsers;
      
      console.log('[Target Users Loading] hasTargetDomains:', hasTargetDomains);
      console.log('[Target Users Loading] needsLoading:', needsLoading);
      
      if (hasTargetDomains && needsLoading) {
        console.log('[Target Users Loading] Auto-loading target users from admin console...');
        loadTargetUsersFromAdminConsole();
      } else {
        console.log('[Target Users Loading] Conditions not met for auto-loading');
      }
    }
  }, [currentStep, allTargetUsers.length, loadingAllTargetUsers]);
  
  const memoizedSourceAdminEmails = useMemo(() => {
    return selectedScenario === 'cross-tenant' && getSourceDomains().length > 1 ? sourceAdminEmails : undefined;
  }, [selectedScenario, getSourceDomains, sourceAdminEmails]);
  
  const memoizedSourceAdminEmail = useMemo(() => {
    return selectedScenario === 'single-super-admin' ? adminEmail : (getSourceDomains().length <= 1 ? sourceAdminEmail : undefined);
  }, [selectedScenario, adminEmail, getSourceDomains, sourceAdminEmail]);
  
  const memoizedMigrationScenario = useMemo(() => {
    return selectedScenario || undefined;
  }, [selectedScenario]);
  
  const memoizedUserMappingStrategy = useMemo(() => {
    return userMappingConfig?.relationship;
  }, [userMappingConfig?.relationship]);
  
  const memoizedUserMappingConfig = useMemo(() => {
    return userMappingConfig || undefined;
  }, [userMappingConfig]);
  
  const memoizedVerificationToken = useMemo(() => {
    return typeof window !== 'undefined' ? localStorage.getItem('dwd_verification_token') || undefined : undefined;
  }, []);
  
  const memoizedUseServiceAccount = useMemo(() => {
    return !!(process.env.NEXT_PUBLIC_GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL);
  }, []);
  
  const memoizedMappingType = useMemo(() => {
    return userMappingConfig?.relationship === 'one-to-many' ? 'one-to-many' :
           userMappingConfig?.relationship === 'many-to-one' ? 'many-to-one' :
           'one-to-one';
  }, [userMappingConfig?.relationship]);

  // Function to save cloned users to localStorage for history
  const saveClonedUsersToHistory = (clonedUsers: any[]) => {
    if (typeof window === 'undefined') return;
    
    try {
      const historyKey = 'gws_cloned_users_history';
      const existingHistory = JSON.parse(localStorage.getItem(historyKey) || '[]');
      
      // Add current session cloned users with timestamp
      const sessionData = {
        timestamp: new Date().toISOString(),
        sessionId: Date.now().toString(),
        users: clonedUsers.map(user => ({
          ...user,
          createdInSession: true,
          sessionTimestamp: new Date().toISOString()
        }))
      };
      
      // Keep only last 10 sessions to avoid localStorage bloat
      const updatedHistory = [sessionData, ...existingHistory].slice(0, 10);
      localStorage.setItem(historyKey, JSON.stringify(updatedHistory));
      
      console.log('[Migration Config] Saved cloned users to history:', clonedUsers.length);
    } catch (error) {
      console.error('[Migration Config] Error saving cloned users to history:', error);
    }
  };

  // Function to load cloned users from history
  const loadClonedUsersFromHistory = (): any[] => {
    if (typeof window === 'undefined') return [];
    
    try {
      const historyKey = 'gws_cloned_users_history';
      const history = JSON.parse(localStorage.getItem(historyKey) || '[]');
      
      // Flatten all users from all sessions
      const allHistoricalUsers = history.reduce((acc: any[], session: any) => {
        return acc.concat(session.users || []);
      }, []);
      
      console.log('[Migration Config] Loaded historical cloned users:', allHistoricalUsers.length);
      return allHistoricalUsers;
    } catch (error) {
      console.error('[Migration Config] Error loading cloned users from history:', error);
      return [];
    }
  };

  // Function to clear historical data (for testing)
  const clearHistoricalData = () => {
    if (typeof window === 'undefined') return;
    
    const historyKey = 'gws_cloned_users_history';
    localStorage.removeItem(historyKey);
    console.log('[Migration Config] Cleared historical data');
    
    // Reload the page to reflect changes
    window.location.reload();
  };

  // Function to detect cloned users by checking user creation patterns
  const detectClonedUsersFromAPI = async (targetUsers: any[]): Promise<any[]> => {
    const potentialClonedUsers: any[] = [];
    
    try {
      // Look for users that might have been created through cloning
      // Check for common patterns:
      // 1. Users created recently (within last 30 days)
      // 2. Users with similar naming patterns to source users
      // 3. Users that match known source-target domain patterns
      
      for (const user of targetUsers) {
        const isRecentlyCreated = user.creationTime && 
          new Date(user.creationTime) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days
        
        const hasClonedPattern = user.name?.fullName?.includes('(Cloned)') || 
          user.name?.fullName?.includes('Migration') ||
          user.primaryEmail?.includes('migrated') ||
          user.primaryEmail?.includes('cloned');
        
        if (isRecentlyCreated || hasClonedPattern) {
          potentialClonedUsers.push({
            ...user,
            id: user.primaryEmail,
            email: user.primaryEmail,
            name: user.name?.fullName || user.primaryEmail,
            isAdmin: user.isAdmin || false,
            exists: true,
            isCloned: true,
            userType: 'cloned',
            status: 'cloned',
            targetDomain: user.primaryEmail.split('@')[1],
            createdAt: user.creationTime,
            detectedFromAPI: true,
            sourceMapping: null // Will be updated if we find a mapping
          });
        }
      }
      
      console.log('[Migration Config] Detected potential cloned users from API:', potentialClonedUsers.length);
      return potentialClonedUsers;
    } catch (error) {
      console.error('[Migration Config] Error detecting cloned users from API:', error);
      return [];
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
                    style={{ width: `${((getStepNumber() - 1) / (getTotalSteps() - 1)) * 100}%` }}
                  />
                </div>
                
                {/* Steps */}
                {Object.entries(STEP_CONFIG)
                  .filter(([stepKey, config]) => !(config as any).hidden) // Filter out hidden steps
                  .map(([stepKey, config], index) => {
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
                        <div className={`text-sm font-sansation text-heading mb-1 ${
                          isActive ? 'text-blue-600' : isCompleted ? 'text-gray-900' : 'text-gray-500'
                        }`}>
                          {config.title}
                        </div>
                        <div className={`text-xs font-sansation text-subheading leading-relaxed ${
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
                        Step {getStepNumber()} of {getTotalSteps()}: {STEP_CONFIG[currentStep].title}
                      </p>
                    )}
                  </div>
                  {currentStep !== 'scenario' && currentStep !== 'migration' && (
                    <div className="flex items-center space-x-2 text-blue-100">
                      <Clock className="h-4 w-4" />
                      <span className="text-sm">Est. {getTotalSteps() - getStepNumber()} steps remaining</span>
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
                          {currentStep === 'delegation' ? (
                            <div>
                              {!isOAuthCompleteForDomainDiscovery() && 'Authentication must be completed first. '}
                              {!domainMapping && 'Domain configuration required. '}
                              {!dwdSetupComplete && 'Domain-wide delegation setup required. '}
                              {!areAllAdminEmailsProvided() && 'Admin emails or service account configuration required. '}
                              {!dwdVerificationStatus && 'Delegation verification required. '}
                            </div>
                          ) : currentStep === 'configuration' ? (
                            <div>
                              {!migrationConfig.migrationName.trim() && 'Migration name required. '}
                              {!migrationConfig.sourceDomain && 'Source domain required. '}
                              {!migrationConfig.targetDomain && 'Target domain required. '}
                              {migrationConfig.services.length === 0 && 'Select at least one service. '}
                              {selectedUsers.length === 0 && 'Select users to migrate. '}
                            </div>
                          ) : (
                            'Complete all required fields to continue'
                          )}
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
 
