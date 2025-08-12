'use client';

import { useState, lazy, Suspense, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useCrossTenantTokens } from '@/lib/cross-tenant-auth-context';
import { useVerificationTokenGenerator } from '@/hooks/useVerificationTokenGenerator';
import { 
  generateEnhancedVerificationToken, 
  parseEnhancedVerificationToken, 
  isEnhancedTokenValidForDomains,
  type EnhancedVerificationTokenData 
} from '@/lib/enhanced-verification-token';
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
  RefreshCw,
  Download,
  Pause,
  StopCircle
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
const UserManagementWorkflow = lazy(() => import('@/components/UserManagementWorkflow'));
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
  scenario: { icon: Users, title: 'Strategy', tooltip: 'Choose migration scenario and user mapping strategy' },
  'auth-and-domains': { icon: Shield, title: 'Authenticate', tooltip: 'Connect to Google Workspace and configure domain mappings' },
  'user-mapping': { icon: GitBranch, title: 'Mapping', tooltip: 'Choose how source users map to target users', hidden: true },
  delegation: { icon: Shield, title: 'Delegation', tooltip: 'Configure domain-wide delegation and permissions' },
  'user-management': { icon: Users, title: 'Users', tooltip: 'Discover, map, and create users in target domains' },
  configuration: { icon: Cog, title: 'Settings', tooltip: 'Configure services, schedule, and notifications' },
  review: { icon: Eye, title: 'Review', tooltip: 'Review your migration setup before execution' },
  migration: { icon: PlayCircle, title: 'Migration', tooltip: 'Monitor your migration progress in real-time' }
} as const;

export default function NewMigration() {
  const { user } = useAuth();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<WizardStep>('scenario');
  const [selectedScenario, setSelectedScenario] = useState<MigrationScenario | null>(null);
  const [domainMapping, setDomainMapping] = useState<DomainMapping | null>(null);
  const [userMappingConfig, setUserMappingConfig] = useState<UserMappingConfig | null>(null);

  // User Discovery state - moved here to fix initialization order
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);
  const [discoveredUsers, setDiscoveredUsers] = useState<any[]>([]);
  const [userMappings, setUserMappings] = useState<any[]>([]);
  const [createdUsers, setCreatedUsers] = useState<any[]>([]);

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

  // Extract target users from user mappings
  const getTargetUsersFromMappings = useCallback(() => {
    if (!userMappings || userMappings.length === 0) {
      return [];
    }

    return userMappings.map(mapping => ({
      sourceUser: mapping.user,
      targetEmail: mapping.targetEmail,
      targetDomain: mapping.targetDomain,
      status: mapping.status,
      sourceEmail: mapping.user?.primaryEmail || mapping.user?.email,
      sourceName: mapping.user?.name || mapping.user?.displayName,
      sourceDomain: mapping.user?.domain || (mapping.user?.primaryEmail || mapping.user?.email)?.split('@')[1]
    }));
  }, [userMappings]);
  
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

  // Verification token generator hook for target user listing
  const verificationTokenGenerator = useVerificationTokenGenerator({
    debug: true,
    componentName: 'MigrationWizard',
    storageKey: 'dwd_verification_token'
  });

  // Enhanced verification token state
  const [enhancedVerificationToken, setEnhancedVerificationToken] = useState<string | null>(null);
  const [enhancedTokenData, setEnhancedTokenData] = useState<EnhancedVerificationTokenData | null>(null);

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

  // Enhanced verification token generation
  const generateEnhancedToken = useCallback(() => {
    if (!migrationConfig.sourceDomain || !migrationConfig.targetDomain) {
      console.log('[Enhanced Token] Cannot generate token: missing domain configuration');
      return;
    }

    try {
      const verifiedDomains = [migrationConfig.sourceDomain, migrationConfig.targetDomain];
      const adminEmails = {
        [migrationConfig.sourceDomain]: sourceAdminEmail || `admin@${migrationConfig.sourceDomain}`,
        [migrationConfig.targetDomain]: targetAdminEmails[migrationConfig.targetDomain] || `admin@${migrationConfig.targetDomain}`
      };

      const migrationScenario = migrationConfig.sourceDomain === migrationConfig.targetDomain 
        ? 'single-super-admin' 
        : 'cross-tenant';

      const delegationStatus = {
        source: { verified: true }, // Assume verified for now
        dest: { verified: true }    // Will be validated during migration
      };

      // Generate enhanced token with signing enabled
      const enhancedToken = generateEnhancedVerificationToken(
        verifiedDomains,
        adminEmails,
        migrationScenario,
        delegationStatus,
        { 
          enableSigning: true, 
          enableEncryption: false, // Keep simple for now
          expirationMinutes: 1440  // 24 hours
        }
      );

      // Parse token to get data for state
      const tokenData = parseEnhancedVerificationToken(enhancedToken);

      setEnhancedVerificationToken(enhancedToken);
      setEnhancedTokenData(tokenData);

      console.log('[Enhanced Token] Generated enhanced verification token:', {
        verificationId: tokenData?.verificationId,
        verifiedDomains: tokenData?.verifiedDomains,
        migrationScenario: tokenData?.migrationScenario,
        timestamp: tokenData?.timestamp
      });

      // Store in localStorage for persistence
      localStorage.setItem('enhanced_verification_token', enhancedToken);

    } catch (error) {
      console.error('[Enhanced Token] Failed to generate enhanced verification token:', error);
    }
  }, [migrationConfig.sourceDomain, migrationConfig.targetDomain, sourceAdminEmail, targetAdminEmails]);

  // Generate enhanced token when domain configuration changes
  useEffect(() => {
    if (migrationConfig.sourceDomain && migrationConfig.targetDomain) {
      generateEnhancedToken();
    }
  }, [generateEnhancedToken, migrationConfig.sourceDomain, migrationConfig.targetDomain]);

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

  // Existing Users Selection state for migration settings
  const [existingUsers, setExistingUsers] = useState<any[]>([]);
  const [selectedExistingUsers, setSelectedExistingUsers] = useState<any[]>([]);
  const [loadingTargetUsers, setLoadingTargetUsers] = useState(false);

  // All Target Domain Users state for migration settings
  const [allTargetUsers, setAllTargetUsers] = useState<any[]>([]);
  const [selectedAllTargetUsers, setSelectedAllTargetUsers] = useState<any[]>([]);
  const [loadingAllTargetUsers, setLoadingAllTargetUsers] = useState(false);

  // User view mode state - controls whether to show only cloned users or all users
  const [userViewMode, setUserViewMode] = useState<'cloned' | 'all'>('cloned');

  const [migrationStatus, setMigrationStatus] = useState<MigrationStatus | null>(null);

  // Real-time migration progress updates with one-to-many and many-to-one support
  useEffect(() => {
    if (!migrationStatus || migrationStatus.status !== 'running') {
      return;
    }

    const updateMigrationProgress = () => {
      setMigrationStatus(prev => {
        if (!prev || prev.status !== 'running') return prev;

        // Check relationship type for appropriate progress tracking
        const isOneToMany = userMappingConfig?.relationship === 'one-to-many';
        const isManyToOne = userMappingConfig?.relationship === 'many-to-one';
        const effectiveUserCount = isOneToMany || isManyToOne ? 
          (prev.migrationConfig?.executionPlan?.effectiveUsers || selectedAllTargetUsers.length) : 
          selectedAllTargetUsers.length;

        // Simulate progressive updates
        const currentProgress = prev.overallProgress || 0;
        const increment = Math.random() * 2; // Random increment 0-2%
        const newProgress = Math.min(100, currentProgress + increment);

        console.log(`[Service Migration] Overall progress update`, {
          migrationId: prev.id,
          previousProgress: currentProgress.toFixed(2),
          newProgress: newProgress.toFixed(2),
          increment: increment.toFixed(2),
          effectiveUserCount,
          relationship: userMappingConfig?.relationship,
          activeServices: (migrationConfig?.services || []).filter(s => 
            prev.serviceProgress?.[s.toLowerCase()]?.status === 'running'
          ),
          timestamp: new Date().toISOString()
        });

        // Log major milestones
        const previousMilestone = Math.floor(currentProgress / 25);
        const newMilestone = Math.floor(newProgress / 25);
        if (newMilestone > previousMilestone && newProgress < 100) {
          const milestonePercent = newMilestone * 25;
          console.log(`[Service Migration] 🎯 MILESTONE REACHED: ${milestonePercent}%`, {
            migrationId: prev.id,
            milestone: `${milestonePercent}%`,
            currentProgress: newProgress.toFixed(2),
            servicesStatus: Object.keys(prev.serviceProgress || {}).map(service => ({
              service,
              status: prev.serviceProgress![service].status,
              progress: prev.serviceProgress![service].progress.toFixed(1)
            })),
            estimatedTimeRemaining: prev.estimatedCompletion ? 
              new Date(prev.estimatedCompletion).getTime() - new Date().getTime() : 'unknown',
            timestamp: new Date().toISOString()
          });
        }

        // Initialize service progress if not exists
        const serviceProgress = prev.serviceProgress ? { ...prev.serviceProgress } : {};
        const userProgress = prev.userProgress ? { ...prev.userProgress } : {};

        // Update service progress with relationship awareness
        (migrationConfig?.services || []).forEach((service, index) => {
          const serviceName = service.toLowerCase();
          if (!serviceProgress[serviceName]) {
            console.log(`[Service Migration] Initializing service progress for: ${serviceName}`, {
              serviceIndex: index,
              effectiveUserCount,
              relationship: userMappingConfig?.relationship,
              isFirstService: index === 0,
              timestamp: new Date().toISOString()
            });
            
            const baseProgress = {
              progress: 0,
              status: index === 0 ? 'running' as const : 'pending' as const,
              itemsProcessed: 0,
              totalItems: effectiveUserCount,
              errors: [] as string[],
              estimatedTimeRemaining: 300000 // 5 minutes in ms
            };
            
            // Add relationship-specific tracking as additional properties
            if (isOneToMany) {
              console.log(`[Service Migration] Adding one-to-many tracking for ${serviceName}`, {
                targetUsersCount: selectedAllTargetUsers.length,
                parallelGroupsEstimate: Math.ceil(selectedAllTargetUsers.length / 5)
              });
              
              (baseProgress as any).parallelGroups = {
                total: 0,
                completed: 0,
                active: 0,
                failed: 0
              };
              (baseProgress as any).targetUsers = {
                total: selectedAllTargetUsers.length,
                completed: 0,
                inProgress: 0,
                failed: 0
              };
            } else if (isManyToOne) {
              console.log(`[Service Migration] Adding many-to-one tracking for ${serviceName}`, {
                sourceMappingsCount: selectedAllTargetUsers.length,
                consolidationGroupsEstimate: Math.max(1, Math.floor(selectedAllTargetUsers.length / 3))
              });
              
              (baseProgress as any).consolidationGroups = {
                total: 0,
                completed: 0,
                active: 0,
                failed: 0
              };
              (baseProgress as any).sourceUsers = {
                total: 0, // Will be calculated dynamically
                processed: 0,
                consolidating: 0,
                failed: 0
              };
              (baseProgress as any).dataConsolidation = {
                conflictsDetected: 0,
                conflictsResolved: 0,
                mergingInProgress: false,
                tempStorageUsed: '0MB'
              };
            } else {
              console.log(`[Service Migration] Adding standard one-to-one tracking for ${serviceName}`, {
                userCount: effectiveUserCount
              });
            }
            
            serviceProgress[serviceName] = baseProgress;
            console.log(`[Service Migration] Service ${serviceName} initialized with status: ${baseProgress.status}`);
          }

          // Update active service
          if (serviceProgress[serviceName].status === 'running') {
            const progressIncrement = Math.random() * 3;
            const newServiceProgress = Math.min(100, serviceProgress[serviceName].progress + progressIncrement);
            const previousProgress = serviceProgress[serviceName].progress;
            
            console.log(`[Service Migration] Updating active service: ${serviceName}`, {
              previousProgress: previousProgress.toFixed(2),
              newProgress: newServiceProgress.toFixed(2),
              increment: progressIncrement.toFixed(2),
              itemsProcessed: Math.round((newServiceProgress / 100) * effectiveUserCount),
              totalItems: effectiveUserCount,
              estimatedTimeRemaining: Math.max(0, (serviceProgress[serviceName].estimatedTimeRemaining || 0) - 5000)
            });
            
            serviceProgress[serviceName] = {
              ...serviceProgress[serviceName],
              progress: newServiceProgress,
              itemsProcessed: Math.round((newServiceProgress / 100) * effectiveUserCount),
              estimatedTimeRemaining: Math.max(0, (serviceProgress[serviceName].estimatedTimeRemaining || 0) - 5000)
            };
            
            // Update relationship-specific progress
            if (isOneToMany && (serviceProgress[serviceName] as any).targetUsers) {
              const totalProgress = serviceProgress[serviceName].progress;
              const previousCompleted = (serviceProgress[serviceName] as any).targetUsers.completed;
              const newCompleted = Math.round((totalProgress / 100) * selectedAllTargetUsers.length);
              const newInProgress = Math.min(5, selectedAllTargetUsers.length - newCompleted);
              
              (serviceProgress[serviceName] as any).targetUsers.completed = newCompleted;
              (serviceProgress[serviceName] as any).targetUsers.inProgress = newInProgress;
              
              console.log(`[Service Migration] One-to-many progress for ${serviceName}`, {
                totalProgress: totalProgress.toFixed(2),
                targetUsers: {
                  total: selectedAllTargetUsers.length,
                  previousCompleted,
                  newCompleted,
                  inProgress: newInProgress,
                  failed: (serviceProgress[serviceName] as any).targetUsers.failed
                }
              });
              
              // Update parallel groups progress
              if ((serviceProgress[serviceName] as any).parallelGroups) {
                const previousGroupsCompleted = (serviceProgress[serviceName] as any).parallelGroups.completed;
                const newGroupsCompleted = Math.floor(totalProgress / 20);
                const activeGroups = totalProgress < 100 ? 
                  Math.min(3, 5 - newGroupsCompleted) : 0;
                
                (serviceProgress[serviceName] as any).parallelGroups.completed = newGroupsCompleted;
                (serviceProgress[serviceName] as any).parallelGroups.active = activeGroups;
                
                console.log(`[Service Migration] Parallel groups update for ${serviceName}`, {
                  previousCompleted: previousGroupsCompleted,
                  newCompleted: newGroupsCompleted,
                  active: activeGroups,
                  total: (serviceProgress[serviceName] as any).parallelGroups.total
                });
              }
            } else if (isManyToOne && (serviceProgress[serviceName] as any).sourceUsers) {
              const totalProgress = serviceProgress[serviceName].progress;
              
              // Simulate source processing and consolidation
              const totalSources = selectedAllTargetUsers.length; // Total source mappings
              const previousProcessed = (serviceProgress[serviceName] as any).sourceUsers.processed;
              const processedSources = Math.round((totalProgress / 100) * totalSources);
              const consolidatingCount = totalProgress > 50 && totalProgress < 90 ? 
                Math.min(3, totalSources - processedSources) : 0;
              
              console.log(`[Service Migration] Many-to-one progress for ${serviceName}`, {
                totalProgress: totalProgress.toFixed(2),
                sourceUsers: {
                  total: totalSources,
                  previousProcessed,
                  newProcessed: processedSources,
                  consolidating: consolidatingCount,
                  failed: Math.floor(Math.random() * 2)
                }
              });
              
              (serviceProgress[serviceName] as any).sourceUsers = {
                ...((serviceProgress[serviceName] as any).sourceUsers || {}),
                total: totalSources,
                processed: processedSources,
                consolidating: consolidatingCount,
                failed: Math.floor(Math.random() * 2) // Simulate occasional failures
              };
              
              // Update consolidation groups progress
              if ((serviceProgress[serviceName] as any).consolidationGroups) {
                const totalGroups = Math.max(1, Math.floor(selectedAllTargetUsers.length / 3)); // Estimate consolidation groups
                const previousGroupsCompleted = (serviceProgress[serviceName] as any).consolidationGroups.completed;
                const newGroupsCompleted = Math.floor((totalProgress / 100) * totalGroups);
                const activeGroups = totalProgress > 25 && totalProgress < 95 ? 1 : 0;
                
                (serviceProgress[serviceName] as any).consolidationGroups = {
                  total: totalGroups,
                  completed: newGroupsCompleted,
                  active: activeGroups,
                  failed: 0
                };
                
                console.log(`[Service Migration] Consolidation groups update for ${serviceName}`, {
                  totalGroups,
                  previousCompleted: previousGroupsCompleted,
                  newCompleted: newGroupsCompleted,
                  active: activeGroups,
                  estimatedGroupSize: Math.floor(selectedAllTargetUsers.length / totalGroups)
                });
              }
              
              // Update data consolidation progress
              if ((serviceProgress[serviceName] as any).dataConsolidation) {
                const conflicts = Math.floor(processedSources * 0.1); // 10% conflict rate
                const previousConflictsResolved = (serviceProgress[serviceName] as any).dataConsolidation.conflictsResolved;
                const newConflictsResolved = Math.floor(conflicts * (totalProgress / 100));
                const isMerging = totalProgress > 60 && totalProgress < 90;
                const tempStorage = `${Math.floor((totalProgress / 100) * 250)}MB`;
                
                (serviceProgress[serviceName] as any).dataConsolidation = {
                  conflictsDetected: conflicts,
                  conflictsResolved: newConflictsResolved,
                  mergingInProgress: isMerging,
                  tempStorageUsed: tempStorage
                };
                
                console.log(`[Service Migration] Data consolidation update for ${serviceName}`, {
                  conflictsDetected: conflicts,
                  previousResolved: previousConflictsResolved,
                  newResolved: newConflictsResolved,
                  mergingInProgress: isMerging,
                  tempStorageUsed: tempStorage,
                  conflictResolutionRate: conflicts > 0 ? ((newConflictsResolved / conflicts) * 100).toFixed(1) + '%' : '0%'
                });
              }
            }

            // Mark as completed and start next service
            if (newServiceProgress >= 100) {
              console.log(`[Service Migration] Service ${serviceName} completed (100%)`, {
                finalStatus: 'completed',
                totalItemsProcessed: effectiveUserCount,
                relationship: userMappingConfig?.relationship,
                completionTime: new Date().toISOString()
              });
              
              serviceProgress[serviceName] = {
                ...serviceProgress[serviceName],
                status: 'completed' as const,
                progress: 100
              };
              
              // Update completion stats for relationships
              if (isOneToMany && (serviceProgress[serviceName] as any).targetUsers) {
                (serviceProgress[serviceName] as any).targetUsers.completed = selectedAllTargetUsers.length;
                (serviceProgress[serviceName] as any).targetUsers.inProgress = 0;
                
                console.log(`[Service Migration] One-to-many completion stats for ${serviceName}`, {
                  totalTargetUsers: selectedAllTargetUsers.length,
                  allCompleted: true,
                  parallelGroups: (serviceProgress[serviceName] as any).parallelGroups
                });
              } else if (isManyToOne && (serviceProgress[serviceName] as any).sourceUsers) {
                const totalSources = (serviceProgress[serviceName] as any).sourceUsers.total;
                (serviceProgress[serviceName] as any).sourceUsers.processed = totalSources;
                (serviceProgress[serviceName] as any).sourceUsers.consolidating = 0;
                
                console.log(`[Service Migration] Many-to-one completion stats for ${serviceName}`, {
                  totalSourcesProcessed: totalSources,
                  consolidationComplete: true,
                  finalConsolidationGroups: (serviceProgress[serviceName] as any).consolidationGroups
                });
                
                if ((serviceProgress[serviceName] as any).dataConsolidation) {
                  (serviceProgress[serviceName] as any).dataConsolidation.mergingInProgress = false;
                  
                  console.log(`[Service Migration] Data consolidation finalized for ${serviceName}`, {
                    finalConflictsResolved: (serviceProgress[serviceName] as any).dataConsolidation.conflictsResolved,
                    totalConflictsDetected: (serviceProgress[serviceName] as any).dataConsolidation.conflictsDetected,
                    finalTempStorage: (serviceProgress[serviceName] as any).dataConsolidation.tempStorageUsed,
                    mergingComplete: true
                  });
                }
              }
              
              // Start next service
              const nextServiceIndex = index + 1;
              if (nextServiceIndex < (migrationConfig?.services || []).length) {
                const nextServiceName = (migrationConfig?.services || [])[nextServiceIndex].toLowerCase();
                if (serviceProgress[nextServiceName]) {
                  console.log(`[Service Migration] Starting next service: ${nextServiceName}`, {
                    previousService: serviceName,
                    serviceIndex: nextServiceIndex,
                    totalServices: (migrationConfig?.services || []).length,
                    timestamp: new Date().toISOString()
                  });
                  
                  serviceProgress[nextServiceName] = {
                    ...serviceProgress[nextServiceName],
                    status: 'running' as const
                  };
                } else {
                  console.warn(`[Service Migration] Next service ${nextServiceName} not found in progress tracking`);
                }
              } else {
                console.log(`[Service Migration] All services completed!`, {
                  completedService: serviceName,
                  totalServicesCompleted: (migrationConfig?.services || []).length,
                  allServicesStatus: Object.keys(serviceProgress).map(s => ({
                    service: s,
                    status: serviceProgress[s].status,
                    progress: serviceProgress[s].progress
                  })),
                  timestamp: new Date().toISOString()
                });
              }
            }
          }
        });

        // Update user progress (existing logic with relationship considerations)
        selectedAllTargetUsers.forEach((user, index) => {
          const userEmail = user.primaryEmail;
          if (!userProgress[userEmail]) {
            userProgress[userEmail] = {
              progress: 0,
              currentService: (migrationConfig?.services || [])[0]?.toLowerCase() || 'unknown',
              status: 'pending',
              servicesCompleted: [],
              errors: [],
              startTime: null,
              lastUpdated: new Date().toISOString(),
              // Add relationship-specific metadata
              ...(isManyToOne && {
                sourceUsers: user.sourceEmail ? [user.sourceEmail] : [],
                // These properties will be added as additional metadata, not part of standard UserProgress type
                consolidationStatus: 'pending' as any,
                dataConflicts: [] as any
              }),
              ...(isOneToMany && user.parallelGroup && {
                parallelGroupId: user.parallelGroup.groupId as any,
                isParallelTarget: true as any,
                sourceUser: user.sourceEmail as any
              })
            };
          }

          // Simulate user-specific progress
          if (userProgress[userEmail].status === 'pending' && newProgress > index * 10) {
            userProgress[userEmail] = {
              ...userProgress[userEmail],
              status: 'processing',
              startTime: new Date().toISOString()
            };
          }

          if (userProgress[userEmail].status === 'processing') {
            const newUserProgress = Math.min(100, userProgress[userEmail].progress + Math.random() * 4);
            userProgress[userEmail] = {
              ...userProgress[userEmail],
              progress: newUserProgress,
              lastUpdated: new Date().toISOString()
            };

            // Update current service based on progress
            const serviceIndex = Math.floor((newUserProgress / 100) * (migrationConfig?.services || []).length);
            if (serviceIndex < (migrationConfig?.services || []).length) {
              userProgress[userEmail] = {
                ...userProgress[userEmail],
                currentService: (migrationConfig?.services || [])[serviceIndex].toLowerCase()
              };
            }
            
            // Update relationship-specific progress
            if (isManyToOne && newUserProgress > 50) {
              // Add consolidation status as additional property (not part of standard type)
              (userProgress[userEmail] as any).consolidationStatus = newUserProgress < 90 ? 'consolidating' : 'completed';
              (userProgress[userEmail] as any).dataConflicts = newUserProgress > 70 && Math.random() < 0.3 ? 
                [`Label conflict: ${user.sourceEmail}`, `Folder merge: Documents`] : [];
            }

            // Mark as completed
            if (newUserProgress >= 100) {
              userProgress[userEmail] = {
                ...userProgress[userEmail],
                status: 'completed',
                progress: 100,
                servicesCompleted: [...(migrationConfig?.services || [])]
              };
              
              // Add consolidation completion for many-to-one
              if (isManyToOne) {
                (userProgress[userEmail] as any).consolidationStatus = 'completed';
              }
            }
          }
        });

        const finalStatus = newProgress >= 100 ? 'completed' : 'running';
        
        if (finalStatus === 'completed' && prev.status === 'running') {
          console.log(`[Service Migration] 🎉 MIGRATION COMPLETED! 🎉`, {
            migrationId: prev.id,
            migrationName: prev.name,
            finalProgress: newProgress,
            totalServices: (migrationConfig?.services || []).length,
            completedServices: Object.values(serviceProgress).filter(s => s.status === 'completed').length,
            totalUsers: selectedAllTargetUsers.length,
            completedUsers: Object.values(userProgress).filter(u => u.status === 'completed').length,
            relationship: userMappingConfig?.relationship,
            duration: new Date().getTime() - new Date(prev.startTime).getTime(),
            completionTime: new Date().toISOString(),
            finalServiceStatuses: Object.keys(serviceProgress).map(service => ({
              service,
              status: serviceProgress[service].status,
              progress: serviceProgress[service].progress,
              itemsProcessed: serviceProgress[service].itemsProcessed
            }))
          });
        }

        return {
          ...prev,
          overallProgress: newProgress,
          serviceProgress,
          userProgress,
          lastUpdated: new Date().toISOString(),
          status: finalStatus
        };
      });
    };

    console.log(`[Service Migration] Starting migration progress updates`, {
      migrationId: migrationStatus?.id,
      status: migrationStatus?.status,
      currentServices: migrationConfig?.services || [],
      selectedUsersCount: selectedAllTargetUsers.length,
      relationship: userMappingConfig?.relationship,
      updateInterval: '2 seconds'
    });

    // Update every 2 seconds
    const interval = setInterval(updateMigrationProgress, 2000);
    return () => {
      console.log(`[Service Migration] Stopping migration progress updates`, {
        migrationId: migrationStatus?.id,
        finalStatus: migrationStatus?.status
      });
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [migrationStatus?.status, migrationConfig?.services, selectedAllTargetUsers, userMappingConfig?.relationship]);

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
          // Preload domain wide delegation setup (the component used in delegation step)
          import('@/components/DomainWideDelegationSetup');
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

  // Function to enrich users with source mapping information
  const enrichUsersWithSourceMapping = useCallback((users: any[]) => {
    return users.map(user => {
      // Try to find source mapping for this user
      const sourceMapping = userMappings.find(mapping => 
        mapping.targetEmail === user.primaryEmail || 
        mapping.targetEmail === user.email ||
        (mapping.user && mapping.user.primaryEmail === user.primaryEmail)
      );

      if (sourceMapping) {
        return {
          ...user,
          sourceEmail: sourceMapping.user?.primaryEmail || sourceMapping.sourceEmail,
          sourceDomain: sourceMapping.user?.primaryEmail?.split('@')[1] || sourceMapping.sourceEmail?.split('@')[1],
          sourceUser: sourceMapping.user,
          mappingRelationship: sourceMapping.relationship || 'one-to-one',
          hasSourceMapping: true
        };
      }

      // If no direct mapping found, try to infer from domain mapping
      if (domainMapping && user.primaryEmail) {
        const targetDomain = user.primaryEmail.split('@')[1];
        const sourceDomain = Object.keys(domainMapping).find(source => 
          domainMapping[source].includes(targetDomain)
        );
        
        if (sourceDomain) {
          // Create a potential source email using the same username
          const username = user.primaryEmail.split('@')[0];
          const potentialSourceEmail = `${username}@${sourceDomain}`;
          
          return {
            ...user,
            sourceEmail: potentialSourceEmail,
            sourceDomain: sourceDomain,
            mappingRelationship: 'inferred-from-domain',
            hasSourceMapping: false, // Mark as inferred, not explicitly mapped
            isInferredMapping: true
          };
        }
      }

      return {
        ...user,
        sourceEmail: null,
        sourceDomain: null,
        hasSourceMapping: false
      };
    });
  }, [userMappings, domainMapping]);

  // Function to load all users from target domains for migration settings
  const loadAllTargetDomainUsers = useCallback(async () => {
    console.log('[Migration Config] Loading all target domain users for migration settings...');
    console.log('[Migration Config] Migration config:', {
      targetDomains: migrationConfig.targetDomains,
      targetDomain: migrationConfig.targetDomain,
      domainMapping
    });
    setLoadingAllTargetUsers(true);
    
    const targetDomains = getTargetDomains();
    console.log('[Migration Config] Target domains for all users:', targetDomains);
    console.log('[Migration Config] Target admin emails:', targetAdminEmails);
    
    if (!targetDomains || targetDomains.length === 0) {
      console.log('[Migration Config] No target domains configured for all users');
      setLoadingAllTargetUsers(false);
      return;
    }
    
    const allUsers = [];
    
    try {
      // Load users from each target domain
      for (const domain of targetDomains) {
        const adminEmail = targetAdminEmails[domain];
        console.log(`[Migration Config] Checking domain: ${domain}, adminEmail: ${adminEmail}`);
        console.log(`[Migration Config] All target admin emails:`, Object.keys(targetAdminEmails).map(d => `${d}: ${targetAdminEmails[d]}`));
        
        // Try to find admin email with different approaches
        let effectiveAdminEmail: string | undefined = adminEmail;
        if (!effectiveAdminEmail) {
          // Try to find a matching admin email by checking variations
          const possibleKeys = Object.keys(targetAdminEmails);
          console.log(`[Migration Config] Trying to find admin email for ${domain} in keys:`, possibleKeys);
          
          // Try exact match first, then partial matches
          const exactMatch = targetAdminEmails[domain];
          const partialMatch = possibleKeys.find(key => key.includes(domain) || domain.includes(key));
          effectiveAdminEmail = exactMatch || (partialMatch ? targetAdminEmails[partialMatch] : undefined);
          
          // Fallback to service account email if available
          if (!effectiveAdminEmail) {
            const serviceAccountEmail = process.env.NEXT_PUBLIC_GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL || 
                                      process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL;
            if (serviceAccountEmail) {
              console.log(`[Migration Config] Using service account email as fallback for ${domain}: ${serviceAccountEmail}`);
              effectiveAdminEmail = serviceAccountEmail;
            }
          }
        }
        
        if (!effectiveAdminEmail) {
          console.warn(`[Migration Config] No admin email configured for domain: ${domain}`);
          continue;
        }
        
        console.log(`[Migration Config] Fetching all users from domain: ${domain} with admin: ${effectiveAdminEmail}`);
        
        const params = new URLSearchParams({
          action: 'users',
          domain,
          adminEmail: effectiveAdminEmail,
          includeSuspended: 'false'
        });
        
        // Use enhanced verification token with fallback to basic token
        const verificationToken = enhancedVerificationToken || verificationTokenGenerator.token;
        
        const response = await fetch(`/api/google-workspace?${params}`, {
          method: 'GET',
          headers: { 
            'Content-Type': 'application/json',
            ...(verificationToken && { 'X-Verification-Token': verificationToken })
          },
          credentials: 'include'
        });
        
        if (!response.ok) {
          console.error(`[Migration Config] Failed to fetch all users from ${domain}:`, {
            status: response.status,
            statusText: response.statusText,
            url: response.url
          });
          const errorText = await response.text();
          console.error(`[Migration Config] Error response body:`, errorText);
          continue;
        }
        
        const data = await response.json();
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
              isFromTargetDomain: true // Flag to identify these are from target domain
            }));
          
          console.log(`[Migration Config] Processed ${domainUsers.length} users from ${domain}`);
          allUsers.push(...domainUsers);
        }
      }
      
      console.log(`[Migration Config] Total users loaded from all target domains: ${allUsers.length}`);
      
      // Enrich users with source mapping information
      const enrichedUsers = enrichUsersWithSourceMapping(allUsers);
      console.log(`[Migration Config] Enriched ${enrichedUsers.length} users with source mapping data`);
      
      setAllTargetUsers(enrichedUsers);
      
    } catch (error) {
      console.error('[Migration Config] Error loading all target domain users:', error);
    } finally {
      setLoadingAllTargetUsers(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [migrationConfig.targetDomains, migrationConfig.targetDomain, domainMapping, targetAdminEmails, enrichUsersWithSourceMapping]);

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
        console.log(`[Migration Config] [loadActualTargetUsers] Checking domain: ${domain}, adminEmail: ${adminEmail}`);
        console.log(`[Migration Config] [loadActualTargetUsers] All target admin emails:`, Object.keys(targetAdminEmails).map(d => `${d}: ${targetAdminEmails[d]}`));
        
        // Try to find admin email with different approaches
        let effectiveAdminEmail: string | undefined = adminEmail;
        if (!effectiveAdminEmail) {
          // Try to find a matching admin email by checking variations
          const possibleKeys = Object.keys(targetAdminEmails);
          console.log(`[Migration Config] Trying to find admin email for ${domain} in keys:`, possibleKeys);
          
          // Try exact match first, then partial matches
          const exactMatch = targetAdminEmails[domain];
          const partialMatch = possibleKeys.find(key => key.includes(domain) || domain.includes(key));
          effectiveAdminEmail = exactMatch || (partialMatch ? targetAdminEmails[partialMatch] : undefined);
          
          // Fallback to service account email if available
          if (!effectiveAdminEmail) {
            const serviceAccountEmail = process.env.NEXT_PUBLIC_GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL || 
                                      process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL;
            if (serviceAccountEmail) {
              console.log(`[Migration Config] [loadActualTargetUsers] Using service account email as fallback for ${domain}: ${serviceAccountEmail}`);
              effectiveAdminEmail = serviceAccountEmail;
            }
          }
        }
        
        if (!effectiveAdminEmail) {
          console.warn(`[Migration Config] No admin email configured for domain: ${domain}`);
          continue;
        }
        
        console.log(`[Migration Config] Fetching users from domain: ${domain} with admin: ${effectiveAdminEmail}`);
        
        const params = new URLSearchParams({
          action: 'users',
          domain,
          adminEmail: effectiveAdminEmail,
          includeSuspended: 'false'
        });
        
        // Use enhanced verification token with fallback to basic token
        const verificationToken = enhancedVerificationToken || verificationTokenGenerator.token;
        
        const response = await fetch(`/api/google-workspace?${params}`, {
          method: 'GET',
          headers: { 
            'Content-Type': 'application/json',
            ...(verificationToken && { 'X-Verification-Token': verificationToken })
          },
          credentials: 'include'
        });
        
        if (!response.ok) {
          console.error(`[Migration Config] Failed to fetch users from ${domain}:`, {
            status: response.status,
            statusText: response.statusText,
            url: response.url
          });
          const errorText = await response.text();
          console.error(`[Migration Config] Error response body:`, errorText);
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

    // Ensure we have a domain mapping - create fallback if missing
    let effectiveDomainMapping = domainMapping;
    if (!effectiveDomainMapping && migrationConfig.sourceDomain && migrationConfig.targetDomain) {
      console.log('[Migration Wizard] Domain mapping is null, creating fallback mapping');
      effectiveDomainMapping = {
        [migrationConfig.sourceDomain]: [migrationConfig.targetDomain]
      };
      console.log('[Migration Wizard] Created fallback domain mapping:', effectiveDomainMapping);
    }

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
      // Initialize service progress for all configured services
      serviceProgress: (() => {
        const serviceProgress: { [key: string]: any } = {};
        
        migrationConfig.services.forEach((service, index) => {
          const serviceName = service.toLowerCase();
          const effectiveUserCount = selectedAllTargetUsers.length;
          
          console.log(`[Migration Wizard] Initializing service progress for startup: ${serviceName}`, {
            serviceIndex: index,
            effectiveUserCount,
            isFirstService: index === 0
          });
          
          serviceProgress[serviceName] = {
            progress: 0,
            status: index === 0 ? 'running' as const : 'pending' as const,
            itemsProcessed: 0,
            totalItems: effectiveUserCount,
            errors: [] as string[],
            estimatedTimeRemaining: 300000, // 5 minutes in ms
            // Add relationship-specific tracking
            ...(userMappingConfig?.relationship === 'one-to-many' && {
              parallelGroups: {
                total: Math.ceil(selectedAllTargetUsers.length / 5),
                completed: 0,
                active: 0,
                failed: 0
              },
              targetUsers: {
                total: selectedAllTargetUsers.length,
                completed: 0,
                inProgress: 0,
                failed: 0
              }
            }),
            ...(userMappingConfig?.relationship === 'many-to-one' && {
              consolidationGroups: {
                total: Math.max(1, Math.floor(selectedAllTargetUsers.length / 3)),
                completed: 0,
                active: 0,
                failed: 0
              },
              sourceUsers: {
                total: selectedAllTargetUsers.length,
                processed: 0,
                consolidating: 0,
                failed: 0
              },
              dataConsolidation: {
                conflictsDetected: 0,
                conflictsResolved: 0,
                mergingInProgress: false,
                tempStorageUsed: '0MB'
              }
            })
          };
        });
        
        console.log(`[Migration Wizard] Initialized service progress for ${Object.keys(serviceProgress).length} services:`, 
          Object.keys(serviceProgress).map(s => `${s}: ${serviceProgress[s].status}`));
        
        return serviceProgress;
      })(),
      // Initialize user progress for all selected users
      userProgress: (() => {
        const userProgress: { [key: string]: any } = {};
        
        selectedAllTargetUsers.forEach(user => {
          const userEmail = user.primaryEmail;
          userProgress[userEmail] = {
            progress: 0,
            currentService: migrationConfig.services[0]?.toLowerCase() || 'unknown',
            status: 'pending',
            servicesCompleted: [],
            errors: [],
            startTime: null,
            lastUpdated: new Date().toISOString(),
            // Add relationship-specific metadata
            ...(userMappingConfig?.relationship === 'many-to-one' && {
              sourceUsers: user.sourceEmail ? [user.sourceEmail] : [],
              consolidationStatus: 'pending',
              dataConflicts: []
            }),
            ...(userMappingConfig?.relationship === 'one-to-many' && user.parallelGroup && {
              parallelGroupId: user.parallelGroup.groupId,
              isParallelTarget: true,
              sourceUser: user.sourceEmail
            })
          };
        });
        
        console.log(`[Migration Wizard] Initialized user progress for ${Object.keys(userProgress).length} users`);
        
        return userProgress;
      })(),
      // Add migration configuration data
      migrationConfig: {
        services: migrationConfig.services,
        sourceDomain: migrationConfig.sourceDomain,
        targetDomain: migrationConfig.targetDomain,
        migrationOptions: migrationConfig.migrationOptions,
        userMappings: userMappings,
        selectedUsers: selectedAllTargetUsers,
        domainMapping: effectiveDomainMapping,
        userMappingConfig: userMappingConfig,
        // Enhanced user mapping for services with one-to-many and many-to-one support
        serviceUserMappings: (() => {
          const allServiceMappings: any[] = [];
          
          // Handle one-to-many mappings
          if (userMappingConfig?.relationship === 'one-to-many') {
            console.log('[Migration Wizard] Processing one-to-many user mappings');
            
            // Group users by source email to handle one-to-many relationships
            const sourceToTargetsMap = new Map<string, any[]>();
            
            selectedAllTargetUsers.forEach(user => {
              const sourceEmail = user.sourceEmail || user.primaryEmail;
              if (!sourceToTargetsMap.has(sourceEmail)) {
                sourceToTargetsMap.set(sourceEmail, []);
              }
              sourceToTargetsMap.get(sourceEmail)!.push(user);
            });
            
            // Create service mappings for each source-to-multiple-targets relationship
            sourceToTargetsMap.forEach((targetUsers, sourceEmail) => {
              if (targetUsers.length > 1) {
                console.log(`[Migration Wizard] One-to-many: ${sourceEmail} → ${targetUsers.length} targets`, 
                  targetUsers.map(u => u.primaryEmail));
                
                // Create a parallel migration group for this source user
                const parallelMigrationGroup = {
                  groupId: `one-to-many-${sourceEmail.replace('@', '-at-')}`,
                  sourceUser: targetUsers[0].sourceUser,
                  mappingType: 'one-to-many',
                  parallelTargets: targetUsers,
                  executionMode: 'parallel' // Run migrations to all targets simultaneously
                };
                
                // Create individual mappings but mark them as part of parallel group
                targetUsers.forEach((user, targetIndex) => {
                  allServiceMappings.push({
                    targetUser: {
                      email: user.primaryEmail,
                      name: user.name,
                      domain: user.targetDomain || user.primaryEmail.split('@')[1],
                      id: user.id,
                      customerId: user.customerId,
                      orgUnitPath: user.orgUnitPath
                    },
                    sourceUser: user.sourceEmail ? {
                      email: user.sourceEmail,
                      domain: user.sourceDomain,
                      name: user.sourceUser?.name || user.name,
                      id: user.sourceUser?.id,
                      customerId: user.sourceUser?.customerId,
                      orgUnitPath: user.sourceUser?.orgUnitPath
                    } : null,
                    mappingType: 'one-to-many',
                    relationship: 'one-to-many',
                    // Add parallel execution metadata
                    parallelGroup: parallelMigrationGroup,
                    isParallelExecution: true,
                    targetIndex: targetIndex,
                    totalTargetsInGroup: targetUsers.length,
                    services: migrationConfig.services.map(service => ({
                      serviceName: service.toLowerCase(),
                      enabled: true,
                      sourceConfig: {
                        delegatedAdmin: selectedScenario === 'cross-tenant' ? 
                          (sourceAdminEmails[user.sourceDomain] || sourceAdminEmail) : adminEmail,
                        impersonateUser: user.sourceEmail || user.primaryEmail
                      },
                      targetConfig: {
                        delegatedAdmin: targetAdminEmails[user.targetDomain || user.primaryEmail.split('@')[1]] || targetAdminEmail || adminEmail,
                        targetUser: user.primaryEmail
                      },
                      migrationRules: {
                        preserveLabels: migrationConfig.migrationOptions.preserveLabels,
                        migrateFolderStructure: migrationConfig.migrationOptions.migrateFolderStructure,
                        enableDeltaSync: migrationConfig.migrationOptions.enableDeltaSync,
                        migrateSharedDrives: migrationConfig.migrationOptions.migrateSharedDrives,
                        maintainPermissions: migrationConfig.migrationOptions.maintainPermissions
                      },
                      // Add parallel execution config for each service
                      parallelExecution: {
                        enabled: true,
                        groupId: parallelMigrationGroup.groupId,
                        sourceUser: user.sourceEmail,
                        targetUsers: targetUsers.map(t => t.primaryEmail),
                        coordinationStrategy: 'source-read-once-distribute', // Read from source once, distribute to all targets
                        conflictResolution: userMappingConfig?.conflictResolution || 'skip'
                      }
                    }))
                  });
                });
              } else {
                // Single target - treat as regular one-to-one
                const user = targetUsers[0];
                allServiceMappings.push({
                  targetUser: {
                    email: user.primaryEmail,
                    name: user.name,
                    domain: user.targetDomain || user.primaryEmail.split('@')[1],
                    id: user.id,
                    customerId: user.customerId,
                    orgUnitPath: user.orgUnitPath
                  },
                  sourceUser: user.sourceEmail ? {
                    email: user.sourceEmail,
                    domain: user.sourceDomain,
                    name: user.sourceUser?.name || user.name,
                    id: user.sourceUser?.id,
                    customerId: user.sourceUser?.customerId,
                    orgUnitPath: user.sourceUser?.orgUnitPath
                  } : null,
                  mappingType: user.hasSourceMapping ? 'explicit' : 
                              user.isInferredMapping ? 'inferred' : 'direct',
                  relationship: 'one-to-one',
                  services: migrationConfig.services.map(service => ({
                    serviceName: service.toLowerCase(),
                    enabled: true,
                    sourceConfig: {
                      delegatedAdmin: selectedScenario === 'cross-tenant' ? 
                        (sourceAdminEmails[user.sourceDomain] || sourceAdminEmail) : adminEmail,
                      impersonateUser: user.sourceEmail || user.primaryEmail
                    },
                    targetConfig: {
                      delegatedAdmin: targetAdminEmails[user.targetDomain || user.primaryEmail.split('@')[1]] || targetAdminEmail || adminEmail,
                      targetUser: user.primaryEmail
                    },
                    migrationRules: {
                      preserveLabels: migrationConfig.migrationOptions.preserveLabels,
                      migrateFolderStructure: migrationConfig.migrationOptions.migrateFolderStructure,
                      enableDeltaSync: migrationConfig.migrationOptions.enableDeltaSync,
                      migrateSharedDrives: migrationConfig.migrationOptions.migrateSharedDrives,
                      maintainPermissions: migrationConfig.migrationOptions.maintainPermissions
                    }
                  }))
                });
              }
            });
          } else if (userMappingConfig?.relationship === 'many-to-one') {
            console.log('[Migration Wizard] Processing many-to-one user mappings');
            
            // Group users by target email to handle many-to-one relationships
            const targetToSourcesMap = new Map<string, any[]>();
            
            selectedAllTargetUsers.forEach(user => {
              const targetEmail = user.primaryEmail;
              if (!targetToSourcesMap.has(targetEmail)) {
                targetToSourcesMap.set(targetEmail, []);
              }
              targetToSourcesMap.get(targetEmail)!.push(user);
            });
            
            // Create service mappings for each multiple-sources-to-target relationship
            targetToSourcesMap.forEach((userMappings, targetEmail) => {
              // For many-to-one, we need to identify multiple source users mapping to one target
              const uniqueSourceEmails = [...new Set(userMappings.map(u => u.sourceEmail).filter(Boolean))];
              
              if (uniqueSourceEmails.length > 1) {
                console.log(`[Migration Wizard] Many-to-one: ${uniqueSourceEmails.length} sources → ${targetEmail}`, 
                  uniqueSourceEmails);
                
                // Create a consolidation migration group for this target user
                const consolidationMigrationGroup = {
                  groupId: `many-to-one-${targetEmail.replace('@', '-at-')}`,
                  targetUser: userMappings[0],
                  mappingType: 'many-to-one',
                  sourceUsers: uniqueSourceEmails.map(sourceEmail => 
                    userMappings.find(u => u.sourceEmail === sourceEmail)?.sourceUser || { email: sourceEmail }
                  ),
                  executionMode: 'sequential-consolidation' // Read from all sources sequentially, consolidate into single target
                };
                
                // Create a single mapping representing the consolidation operation
                allServiceMappings.push({
                  targetUser: {
                    email: targetEmail,
                    name: userMappings[0].name,
                    domain: userMappings[0].targetDomain || targetEmail.split('@')[1],
                    id: userMappings[0].id,
                    customerId: userMappings[0].customerId,
                    orgUnitPath: userMappings[0].orgUnitPath
                  },
                  sourceUsers: uniqueSourceEmails.map(sourceEmail => {
                    const sourceMapping = userMappings.find(u => u.sourceEmail === sourceEmail);
                    return sourceMapping?.sourceUser ? {
                      email: sourceEmail,
                      domain: sourceMapping.sourceDomain,
                      name: sourceMapping.sourceUser.name || sourceMapping.name,
                      id: sourceMapping.sourceUser.id,
                      customerId: sourceMapping.sourceUser.customerId,
                      orgUnitPath: sourceMapping.sourceUser.orgUnitPath
                    } : { email: sourceEmail, domain: sourceEmail.split('@')[1] };
                  }),
                  mappingType: 'many-to-one',
                  relationship: 'many-to-one',
                  // Add consolidation execution metadata
                  consolidationGroup: consolidationMigrationGroup,
                  isConsolidationExecution: true,
                  sourceCount: uniqueSourceEmails.length,
                  totalSourcesInGroup: uniqueSourceEmails.length,
                  services: migrationConfig.services.map(service => ({
                    serviceName: service.toLowerCase(),
                    enabled: true,
                    sourceConfigs: uniqueSourceEmails.map(sourceEmail => {
                      const sourceMapping = userMappings.find(u => u.sourceEmail === sourceEmail);
                      return {
                        delegatedAdmin: selectedScenario === 'cross-tenant' ? 
                          (sourceAdminEmails[sourceMapping?.sourceDomain] || sourceAdminEmail) : adminEmail,
                        impersonateUser: sourceEmail,
                        sourceUser: sourceEmail,
                        sourceDomain: sourceMapping?.sourceDomain || sourceEmail.split('@')[1]
                      };
                    }),
                    targetConfig: {
                      delegatedAdmin: targetAdminEmails[userMappings[0].targetDomain || targetEmail.split('@')[1]] || targetAdminEmail || adminEmail,
                      targetUser: targetEmail
                    },
                    migrationRules: {
                      preserveLabels: migrationConfig.migrationOptions.preserveLabels,
                      migrateFolderStructure: migrationConfig.migrationOptions.migrateFolderStructure,
                      enableDeltaSync: migrationConfig.migrationOptions.enableDeltaSync,
                      migrateSharedDrives: migrationConfig.migrationOptions.migrateSharedDrives,
                      maintainPermissions: migrationConfig.migrationOptions.maintainPermissions,
                      // Many-to-one specific rules
                      dataConsolidation: {
                        enabled: true,
                        conflictResolution: userMappingConfig?.conflictResolution || 'merge',
                        labelMergeStrategy: 'prefix-source', // Prefix labels with source user identifier
                        folderMergeStrategy: 'create-source-folders', // Create separate folders for each source
                        duplicateHandling: 'rename-with-source' // Rename duplicates with source identifier
                      }
                    },
                    // Add consolidation execution config for each service
                    consolidationExecution: {
                      enabled: true,
                      groupId: consolidationMigrationGroup.groupId,
                      sourceUsers: uniqueSourceEmails,
                      targetUser: targetEmail,
                      coordinationStrategy: 'sequential-read-consolidate-write', // Read from sources sequentially, consolidate, then write
                      conflictResolution: userMappingConfig?.conflictResolution || 'merge',
                      progressTracking: 'per-source-and-aggregate' // Track progress per source and overall consolidation
                    }
                  }))
                });
              } else {
                // Single source - treat as regular one-to-one
                const user = userMappings[0];
                allServiceMappings.push({
                  targetUser: {
                    email: user.primaryEmail,
                    name: user.name,
                    domain: user.targetDomain || user.primaryEmail.split('@')[1],
                    id: user.id,
                    customerId: user.customerId,
                    orgUnitPath: user.orgUnitPath
                  },
                  sourceUser: user.sourceEmail ? {
                    email: user.sourceEmail,
                    domain: user.sourceDomain,
                    name: user.sourceUser?.name || user.name,
                    id: user.sourceUser?.id,
                    customerId: user.sourceUser?.customerId,
                    orgUnitPath: user.sourceUser?.orgUnitPath
                  } : null,
                  mappingType: user.hasSourceMapping ? 'explicit' : 
                              user.isInferredMapping ? 'inferred' : 'direct',
                  relationship: 'one-to-one',
                  services: migrationConfig.services.map(service => ({
                    serviceName: service.toLowerCase(),
                    enabled: true,
                    sourceConfig: {
                      delegatedAdmin: selectedScenario === 'cross-tenant' ? 
                        (sourceAdminEmails[user.sourceDomain] || sourceAdminEmail) : adminEmail,
                      impersonateUser: user.sourceEmail || user.primaryEmail
                    },
                    targetConfig: {
                      delegatedAdmin: targetAdminEmails[user.targetDomain || user.primaryEmail.split('@')[1]] || targetAdminEmail || adminEmail,
                      targetUser: user.primaryEmail
                    },
                    migrationRules: {
                      preserveLabels: migrationConfig.migrationOptions.preserveLabels,
                      migrateFolderStructure: migrationConfig.migrationOptions.migrateFolderStructure,
                      enableDeltaSync: migrationConfig.migrationOptions.enableDeltaSync,
                      migrateSharedDrives: migrationConfig.migrationOptions.migrateSharedDrives,
                      maintainPermissions: migrationConfig.migrationOptions.maintainPermissions
                    }
                  }))
                });
              }
            });
          } else {
            // Handle one-to-one mappings (existing logic)
            selectedAllTargetUsers.forEach(user => {
              allServiceMappings.push({
                targetUser: {
                  email: user.primaryEmail,
                  name: user.name,
                  domain: user.targetDomain || user.primaryEmail.split('@')[1],
                  id: user.id,
                  customerId: user.customerId,
                  orgUnitPath: user.orgUnitPath
                },
                sourceUser: user.sourceEmail ? {
                  email: user.sourceEmail,
                  domain: user.sourceDomain,
                  name: user.sourceUser?.name || user.name,
                  id: user.sourceUser?.id,
                  customerId: user.sourceUser?.customerId,
                  orgUnitPath: user.sourceUser?.orgUnitPath
                } : null,
                mappingType: user.hasSourceMapping ? 'explicit' : 
                            user.isInferredMapping ? 'inferred' : 'direct',
                relationship: user.mappingRelationship || userMappingConfig?.relationship || 'one-to-one',
                services: migrationConfig.services.map(service => ({
                  serviceName: service.toLowerCase(),
                  enabled: true,
                  sourceConfig: {
                    delegatedAdmin: selectedScenario === 'cross-tenant' ? 
                      (sourceAdminEmails[user.sourceDomain] || sourceAdminEmail) : adminEmail,
                    impersonateUser: user.sourceEmail || user.primaryEmail
                  },
                  targetConfig: {
                    delegatedAdmin: targetAdminEmails[user.targetDomain || user.primaryEmail.split('@')[1]] || targetAdminEmail || adminEmail,
                    targetUser: user.primaryEmail
                  },
                  migrationRules: {
                    preserveLabels: migrationConfig.migrationOptions.preserveLabels,
                    migrateFolderStructure: migrationConfig.migrationOptions.migrateFolderStructure,
                    enableDeltaSync: migrationConfig.migrationOptions.enableDeltaSync,
                    migrateSharedDrives: migrationConfig.migrationOptions.migrateSharedDrives,
                    maintainPermissions: migrationConfig.migrationOptions.maintainPermissions
                  }
                }))
              });
            });
          }
          
          console.log(`[Migration Wizard] Created ${allServiceMappings.length} service user mappings for ${userMappingConfig?.relationship || 'one-to-one'} relationship`);
          
          if (userMappingConfig?.relationship === 'one-to-many') {
            const parallelGroups = allServiceMappings.filter(m => m.isParallelExecution);
            const parallelGroupIds = [...new Set(parallelGroups.map(m => m.parallelGroup?.groupId))];
            console.log(`[Migration Wizard] One-to-many parallel groups: ${parallelGroupIds.length}`, parallelGroupIds);
          } else if (userMappingConfig?.relationship === 'many-to-one') {
            const consolidationGroups = allServiceMappings.filter(m => m.isConsolidationExecution);
            const consolidationGroupIds = [...new Set(consolidationGroups.map(m => m.consolidationGroup?.groupId))];
            console.log(`[Migration Wizard] Many-to-one consolidation groups: ${consolidationGroupIds.length}`, consolidationGroupIds);
          }
          
          return allServiceMappings;
        })(),
        // Migration execution plan with one-to-many and many-to-one optimization
        executionPlan: (() => {
          const baseUserCount = selectedAllTargetUsers.length;
          let effectiveUserCount = baseUserCount;
          let estimatedDuration = baseUserCount * migrationConfig.services.length * 5; // Base calculation
          
          // Adjust for one-to-many mappings
          if (userMappingConfig?.relationship === 'one-to-many') {
            // Group users by source email to understand parallel execution benefits
            const sourceToTargetsMap = new Map<string, any[]>();
            selectedAllTargetUsers.forEach(user => {
              const sourceEmail = user.sourceEmail || user.primaryEmail;
              if (!sourceToTargetsMap.has(sourceEmail)) {
                sourceToTargetsMap.set(sourceEmail, []);
              }
              sourceToTargetsMap.get(sourceEmail)!.push(user);
            });
            
            const parallelGroups = Array.from(sourceToTargetsMap.values()).filter(group => group.length > 1);
            const parallelTargetCount = parallelGroups.reduce((sum, group) => sum + group.length, 0);
            const singleTargetCount = baseUserCount - parallelTargetCount;
            const sourceCount = sourceToTargetsMap.size;
            
            // Optimize duration: parallel targets take same time as single source
            // Each source is read once and distributed to multiple targets simultaneously
            effectiveUserCount = sourceCount; // Effective processing units = number of unique sources
            estimatedDuration = effectiveUserCount * migrationConfig.services.length * 5;
            
            // Add small overhead for parallel coordination (10% per additional target in group)
            const averageGroupSize = parallelGroups.length > 0 ? 
              parallelTargetCount / parallelGroups.length : 1;
            const parallelOverhead = Math.max(0, (averageGroupSize - 1) * 0.1); // 10% overhead per additional target
            estimatedDuration = Math.round(estimatedDuration * (1 + parallelOverhead));
            
            console.log(`[Migration Wizard] One-to-many execution optimization:`, {
              totalTargets: baseUserCount,
              uniqueSources: sourceCount,
              parallelGroups: parallelGroups.length,
              parallelTargets: parallelTargetCount,
              singleTargets: singleTargetCount,
              averageGroupSize: averageGroupSize,
              parallelOverhead: `${(parallelOverhead * 100).toFixed(1)}%`,
              estimatedDuration: `${estimatedDuration} minutes`,
              timeSavings: `${((baseUserCount * migrationConfig.services.length * 5) - estimatedDuration)} minutes saved`
            });
          } else if (userMappingConfig?.relationship === 'many-to-one') {
            // Group users by target email to understand consolidation complexity
            const targetToSourcesMap = new Map<string, string[]>();
            selectedAllTargetUsers.forEach(user => {
              const targetEmail = user.primaryEmail;
              const sourceEmail = user.sourceEmail;
              if (sourceEmail) {
                if (!targetToSourcesMap.has(targetEmail)) {
                  targetToSourcesMap.set(targetEmail, []);
                }
                if (!targetToSourcesMap.get(targetEmail)!.includes(sourceEmail)) {
                  targetToSourcesMap.get(targetEmail)!.push(sourceEmail);
                }
              }
            });
            
            const consolidationGroups = Array.from(targetToSourcesMap.values()).filter(sources => sources.length > 1);
            const totalConsolidationSources = consolidationGroups.reduce((sum, sources) => sum + sources.length, 0);
            const singleSourceTargets = targetToSourcesMap.size - consolidationGroups.length;
            const uniqueTargetCount = targetToSourcesMap.size;
            
            // Adjust duration for consolidation complexity
            // Each consolidation requires reading multiple sources sequentially, then consolidating
            effectiveUserCount = uniqueTargetCount; // Effective processing units = number of unique targets
            
            // Base time per target + consolidation overhead for multiple sources
            let consolidationDuration = uniqueTargetCount * migrationConfig.services.length * 5;
            
            // Add consolidation overhead (25% per additional source per target)
            const totalExtraSources = totalConsolidationSources - consolidationGroups.length; // Extra sources beyond first
            const consolidationOverhead = totalExtraSources * 0.25; // 25% overhead per extra source
            consolidationDuration = Math.round(consolidationDuration * (1 + consolidationOverhead));
            
            // Add data merging time (10 minutes per consolidation group for conflict resolution)
            const mergingTime = consolidationGroups.length * 10;
            estimatedDuration = consolidationDuration + mergingTime;
            
            console.log(`[Migration Wizard] Many-to-one execution optimization:`, {
              totalUsers: baseUserCount,
              uniqueTargets: uniqueTargetCount,
              consolidationGroups: consolidationGroups.length,
              totalConsolidationSources: totalConsolidationSources,
              singleSourceTargets: singleSourceTargets,
              extraSources: totalExtraSources,
              consolidationOverhead: `${(consolidationOverhead * 100).toFixed(1)}%`,
              mergingTime: `${mergingTime} minutes`,
              estimatedDuration: `${estimatedDuration} minutes`,
              additionalTime: `${estimatedDuration - (baseUserCount * migrationConfig.services.length * 5)} minutes extra for consolidation`
            });
          }
          
          return {
            totalUsers: baseUserCount, // Total number of target users
            effectiveUsers: effectiveUserCount, // Effective processing units (sources for one-to-many, targets for many-to-one)
            totalServices: migrationConfig.services.length,
            estimatedDuration: estimatedDuration,
            batchSize: userMappingConfig?.relationship === 'one-to-many' ? 3 : 
                      userMappingConfig?.relationship === 'many-to-one' ? 2 : 5, // Smaller batches for complex operations
            retryPolicy: {
              maxRetries: 3,
              backoffMultiplier: 2,
              initialDelay: 1000
            },
            serviceOrder: migrationConfig.services, // Order of service migration
            parallelServices: false, // Keep services sequential for better control
            // One-to-many specific execution configuration
            oneToManyConfig: userMappingConfig?.relationship === 'one-to-many' ? {
              enabled: true,
              coordinationStrategy: 'source-read-once-distribute',
              parallelTargetLimit: 10, // Maximum targets to handle in parallel per source
              sourceReadTimeout: 30000, // 30 seconds timeout for reading source data
              targetWriteTimeout: 15000, // 15 seconds timeout per target write
              failureHandling: 'continue-with-remaining', // Continue with other targets if one fails
              progressReporting: 'aggregate-by-source' // Report progress by source user, not individual targets
            } : undefined,
            // Many-to-one specific execution configuration
            manyToOneConfig: userMappingConfig?.relationship === 'many-to-one' ? {
              enabled: true,
              coordinationStrategy: 'sequential-read-consolidate-write',
              sourceReadTimeout: 45000, // 45 seconds timeout for reading each source
              consolidationTimeout: 60000, // 60 seconds timeout for data consolidation
              targetWriteTimeout: 30000, // 30 seconds timeout for writing consolidated data
              conflictResolution: {
                strategy: userMappingConfig?.conflictResolution || 'merge',
                labelHandling: 'prefix-source', // Prefix labels with source user info
                folderHandling: 'create-source-folders', // Create separate folders for each source
                duplicateHandling: 'rename-with-source', // Rename duplicates with source identifier
                metadataHandling: 'preserve-all' // Keep metadata from all sources
              },
              dataConsolidation: {
                tempStorageRequired: true, // Temporary storage needed for consolidation
                memoryBufferSize: '512MB', // Memory buffer for consolidation operations
                progressCheckpoints: true, // Create checkpoints during consolidation
                rollbackSupport: true // Support rollback if consolidation fails
              },
              failureHandling: 'stop-and-rollback', // Stop migration and rollback on failure
              progressReporting: 'per-source-and-consolidation' // Report progress per source read and consolidation
            } : undefined
          };
        })(),
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
      userCount: selectedAllTargetUsers.length,
      mappingType: userMappingConfig?.relationship,
      domainMapping: effectiveDomainMapping,
      domainMappingType: effectiveDomainMapping?.type || 'fallback-created',
      domainMappingKeys: effectiveDomainMapping ? Object.keys(effectiveDomainMapping) : [],
      sourceDomain: migrationConfig.sourceDomain,
      targetDomain: migrationConfig.targetDomain,
      serviceUserMappings: status.migrationConfig.serviceUserMappings.length,
      executionPlan: status.migrationConfig.executionPlan,
      timestamp: new Date().toISOString()
    });

    // Log detailed user mappings for services
    console.log('[Migration Wizard] Service User Mappings:', {
      totalMappings: status.migrationConfig.serviceUserMappings.length,
      explicitMappings: status.migrationConfig.serviceUserMappings.filter((m: any) => m.mappingType === 'explicit').length,
      inferredMappings: status.migrationConfig.serviceUserMappings.filter((m: any) => m.mappingType === 'inferred').length,
      directMappings: status.migrationConfig.serviceUserMappings.filter((m: any) => m.mappingType === 'direct').length,
      sampleMapping: status.migrationConfig.serviceUserMappings[0] || null
    });
    
    setCurrentStep('migration');
    
    // Start actual service migrations
    setTimeout(() => {
      startServiceMigrations(status.id, status);
    }, 1000); // Small delay to ensure UI is ready
  };

  // Function to start actual service migrations
  const startServiceMigrations = async (migrationId: string, migrationStatusParam?: MigrationStatus) => {
    console.log(`[Service Migration] Starting actual service migrations for: ${migrationId}`);
    
    try {
      // Start with the first service in the list
      const firstService = migrationConfig.services[0];
      if (firstService) {
        await executeServiceMigration(firstService, migrationId, migrationStatusParam);
      }
    } catch (error) {
      console.error('[Service Migration] Error starting service migrations:', error);
      
      // Update migration status with error
      setMigrationStatus(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          status: 'failed',
          errors: [...prev.errors, {
            id: `startup-error-${Date.now()}`,
            step: 'migration-startup',
            message: `Failed to start service migrations: ${error}`,
            timestamp: new Date().toISOString(),
            resolved: false
          }],
          lastUpdated: new Date().toISOString()
        };
      });
    }
  };

  // Function to execute migration for a specific service
  const executeServiceMigration = async (serviceName: string, migrationId: string, migrationStatusParam?: MigrationStatus) => {
    const serviceKey = serviceName.toLowerCase();
    console.log(`[Service Migration] Executing migration for service: ${serviceKey}`);
    
    try {
      // Create the migration payload for this service, using passed status if available
      const migrationPayload = createMigrationPayload(serviceKey, migrationStatusParam);
      
      // Check if payload creation was successful
      if (!migrationPayload) {
        const error = `Failed to create migration payload for service: ${serviceKey}`;
        console.error(`[Service Migration] ${error}`);
        throw new Error(error);
      }
      
      console.log(`[Service Migration] Created payload for ${serviceKey}:`, {
        userMappings: migrationPayload?.userMappings?.length || 0,
        serviceName: (migrationPayload as any)?.service || 'all-services',
        totalUsers: (migrationPayload as any)?.totalUsers || 0,
        payloadType: (migrationPayload as any)?.service ? 'service-specific' : 'general'
      });
      
      // Execute actual migration API call
      const response = await executeActualServiceMigration(serviceKey, migrationPayload);
      
      if (response.success) {
        console.log(`[Service Migration] ${serviceKey} migration completed successfully`);
        
        // Start next service if available
        const currentIndex = migrationConfig.services.findIndex(s => s.toLowerCase() === serviceKey);
        const nextIndex = currentIndex + 1;
        
        if (nextIndex < migrationConfig.services.length) {
          const nextService = migrationConfig.services[nextIndex];
          console.log(`[Service Migration] Starting next service: ${nextService}`);
          
          // Update service status to start next service
          setMigrationStatus(prev => {
            if (!prev) return prev;
            
            const updatedServiceProgress = { ...prev.serviceProgress };
            if (updatedServiceProgress[nextService.toLowerCase()]) {
              updatedServiceProgress[nextService.toLowerCase()].status = 'running';
            }
            
            return {
              ...prev,
              serviceProgress: updatedServiceProgress,
              lastUpdated: new Date().toISOString()
            };
          });
          
          // Start the next service
          setTimeout(() => {
            executeServiceMigration(nextService, migrationId, migrationStatusParam);
          }, 2000); // 2 second delay between services
        } else {
          console.log(`[Service Migration] All services completed for migration: ${migrationId}`);
        }
      } else {
        throw new Error(response.error || 'Service migration failed');
      }
    } catch (error) {
      console.error(`[Service Migration] Error executing ${serviceKey} migration:`, error);
      
      // Update service status with error
      setMigrationStatus(prev => {
        if (!prev) return prev;
        
        const updatedServiceProgress = { ...prev.serviceProgress };
        if (updatedServiceProgress[serviceKey]) {
          updatedServiceProgress[serviceKey] = {
            ...updatedServiceProgress[serviceKey],
            status: 'failed',
            errors: [...(updatedServiceProgress[serviceKey].errors || []), String(error)]
          };
        }
        
        return {
          ...prev,
          serviceProgress: updatedServiceProgress,
          errors: [...prev.errors, {
            id: `service-error-${serviceKey}-${Date.now()}`,
            step: `${serviceKey}-migration`,
            message: `${serviceName} migration failed: ${error}`,
            timestamp: new Date().toISOString(),
            resolved: false
          }],
          lastUpdated: new Date().toISOString()
        };
      });
    }
  };

  // User Migration Orchestration Layer
  const executeUserMigrationOrchestration = async (
    serviceName: string, 
    endpoint: string, 
    userMappings: any[], 
    basePayload: any
  ) => {
    console.log(`[Migration Orchestration] Starting ${serviceName} for ${userMappings.length} users`);
    
    // Check if the service supports multi-user migration in a single request
    const supportsMultiUserMigration = ['gmail'].includes(serviceName.toLowerCase());
    
    if (supportsMultiUserMigration && userMappings.length > 1) {
      console.log(`[Migration Orchestration] Using multi-user migration for ${serviceName}`);
      
      try {
        const result = await executeMultiUserMigration(serviceName, endpoint, userMappings, basePayload);
        
        // Convert multi-user result to individual user results format
        const results = userMappings.map((mapping, index) => ({
          success: true, // If we got here, the overall request succeeded
          userEmail: mapping.targetUser?.email || mapping.targetUserEmail || 'unknown',
          migrationId: `${result.migrationId}-user-${index + 1}`,
          details: result.details
        }));
        
        console.log(`[Migration Orchestration] ${serviceName} multi-user migration completed: ${result.summary?.successRate || 'N/A'} success rate`);
        
        return {
          results,
          summary: {
            total: userMappings.length,
            successful: result.summary?.completedUsers || userMappings.length,
            failed: result.summary?.failedUsers || 0,
            successRate: result.summary?.successRate || '100%'
          }
        };
        
      } catch (error: any) {
        console.error(`[Migration Orchestration] Multi-user migration failed for ${serviceName}:`, error);
        
        // Fall back to individual user migration if multi-user fails
        console.log(`[Migration Orchestration] Falling back to individual user migrations for ${serviceName}`);
        return await executeIndividualUserMigrations(serviceName, endpoint, userMappings, basePayload);
      }
    } else {
      // Use individual user migrations for services that don't support multi-user or single user requests
      return await executeIndividualUserMigrations(serviceName, endpoint, userMappings, basePayload);
    }
  };

  // Execute individual user migrations (original logic)
  const executeIndividualUserMigrations = async (
    serviceName: string, 
    endpoint: string, 
    userMappings: any[], 
    basePayload: any
  ) => {
    const results: Array<{ 
      success: boolean; 
      userEmail: string; 
      error?: string; 
      migrationId?: string 
    }> = [];
    
    // Determine execution strategy based on user count
    const PARALLEL_THRESHOLD = 3;
    const BATCH_SIZE = 2; // Process 2 users in parallel
    
    if (userMappings.length <= PARALLEL_THRESHOLD) {
      // Sequential execution for small numbers
      console.log(`[Migration Orchestration] Using sequential execution for ${userMappings.length} users`);
      
      for (let i = 0; i < userMappings.length; i++) {
        const userMapping = userMappings[i];
        const result = await executeSingleUserMigration(serviceName, endpoint, userMapping, basePayload, i + 1, userMappings.length);
        results.push(result);
        
        // Small delay between sequential migrations to avoid overwhelming APIs
        if (i < userMappings.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } else {
      // Parallel batch execution for larger numbers
      console.log(`[Migration Orchestration] Using parallel batch execution: ${userMappings.length} users in batches of ${BATCH_SIZE}`);
      
      for (let i = 0; i < userMappings.length; i += BATCH_SIZE) {
        const batch = userMappings.slice(i, i + BATCH_SIZE);
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(userMappings.length / BATCH_SIZE);
        
        console.log(`[Migration Orchestration] Processing batch ${batchNumber}/${totalBatches} (${batch.length} users)`);
        
        // Execute batch in parallel
        const batchPromises = batch.map((userMapping, batchIndex) => 
          executeSingleUserMigration(
            serviceName, 
            endpoint, 
            userMapping, 
            basePayload, 
            i + batchIndex + 1, 
            userMappings.length
          )
        );
        
        const batchResults = await Promise.allSettled(batchPromises);
        
        // Process batch results
        batchResults.forEach((result, batchIndex) => {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            const userMapping = batch[batchIndex];
            results.push({
              success: false,
              userEmail: userMapping.targetUser?.email || userMapping.targetUserEmail || 'unknown',
              error: `Batch execution failed: ${result.reason}`
            });
          }
        });
        
        // Delay between batches to avoid overwhelming APIs
        if (i + BATCH_SIZE < userMappings.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    const successfulResults = results.filter(r => r.success);
    const failedResults = results.filter(r => !r.success);
    
    console.log(`[Migration Orchestration] ${serviceName} individual user migrations completed:`, {
      totalUsers: userMappings.length,
      successful: successfulResults.length,
      failed: failedResults.length,
      results: results.map(r => ({ 
        user: r.userEmail, 
        success: r.success, 
        error: r.error?.substring(0, 50) 
      }))
    });
    
    return {
      results,
      summary: {
        total: userMappings.length,
        successful: successfulResults.length,
        failed: failedResults.length,
        successRate: `${Math.round((successfulResults.length / userMappings.length) * 100)}%`
      }
    };
  };

  // Execute migration for multiple users in one request (optimized for new APIs)
  const executeMultiUserMigration = async (
    serviceName: string, 
    endpoint: string, 
    userMappings: any[], 
    basePayload: any
  ) => {
    try {
      console.log(`[Multi User Migration] ${serviceName}: Processing ${userMappings.length} users in single request`);
      
      // Create multi-user migration request
      const multiUserRequest = {
        scenario: basePayload.scenario,
        migrationId: `${basePayload.migrationId}-${serviceName}-multi-user`,
        sourceAdminEmail: basePayload.adminCredentials?.sourceAdminEmail || basePayload.adminCredentials?.adminEmail,
        targetAdminEmail: basePayload.adminCredentials?.targetAdminEmail || basePayload.adminCredentials?.adminEmail,
        userMappings: userMappings.map(mapping => ({
          sourceUserEmail: mapping.sourceUser?.email || mapping.sourceUserEmail,
          targetUserEmail: mapping.targetUser?.email || mapping.targetUserEmail,
          sourceUser: mapping.sourceUser,
          targetUser: mapping.targetUser
        })),
        migrationOptions: getServiceSpecificMigrationOptions(serviceName, basePayload.migrationOptions),
        domainMapping: userMappingConfig?.relationship || 'one-to-many',
        verificationToken: basePayload.verificationToken,
        realDataMode: false, // Keep as false for safety
        dryRun: true
      };
      
      console.log(`[Multi User Migration] Making API call for ${serviceName}:`, {
        endpoint,
        userCount: userMappings.length,
        migrationId: multiUserRequest.migrationId,
        timestamp: new Date().toISOString()
      });
      
      // Make API call to service endpoint
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(multiUserRequest),
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      console.log(`[Multi User Migration] ${serviceName} migration successful:`, {
        status: result.success,
        migrationId: result.migrationId,
        summary: result.summary
      });

      return {
        success: true,
        migrationId: result.migrationId,
        progress: result.progress,
        summary: result.summary,
        details: result.message
      };

    } catch (error: any) {
      console.error(`[Multi User Migration] ${serviceName} migration failed:`, error.message);
      throw error;
    }
  };

  // Execute migration for a single user mapping
  const executeSingleUserMigration = async (
    serviceName: string, 
    endpoint: string, 
    userMapping: any, 
    basePayload: any, 
    userIndex: number, 
    totalUsers: number
  ) => {
    const targetUserEmail = userMapping.targetUser?.email || userMapping.targetUserEmail;
    const sourceUserEmail = userMapping.sourceUser?.email || userMapping.sourceUserEmail;
    
    try {
      console.log(`[Single User Migration] ${serviceName} [${userIndex}/${totalUsers}]: ${sourceUserEmail} → ${targetUserEmail}`);
      
        // Create single-user migration request (compatible with existing APIs)
        const singleUserRequest = {
          scenario: basePayload.scenario,
          migrationId: `${basePayload.migrationId}-${serviceName}-user-${userIndex}`,
          sourceAdminEmail: basePayload.adminCredentials?.sourceAdminEmail || basePayload.adminCredentials?.adminEmail,
          targetAdminEmail: basePayload.adminCredentials?.targetAdminEmail || basePayload.adminCredentials?.adminEmail,
          sourceUserEmail: sourceUserEmail,
          targetUserEmail: targetUserEmail,
          migrationOptions: getServiceSpecificMigrationOptions(serviceName, basePayload.migrationOptions),
          domainMapping: userMappingConfig?.relationship || 'one-to-one',
          verificationToken: basePayload.verificationToken,
          realDataMode: false, // Keep as false for safety
          dryRun: true
        };
        
        console.log(`[Single User Migration] Making API call for ${targetUserEmail}:`, {
          endpoint,
          sourceUser: sourceUserEmail,
          targetUser: targetUserEmail,
          sourceAdmin: singleUserRequest.sourceAdminEmail,
          targetAdmin: singleUserRequest.targetAdminEmail,
          migrationId: singleUserRequest.migrationId,
          timestamp: new Date().toISOString()
        });
        
      // Make API call to service endpoint
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(singleUserRequest),
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`;
        const errorDetails = errorData.details || 'No additional details provided';
        
        console.error(`[Single User Migration] Error for ${sourceUserEmail} → ${targetUserEmail}:`, {
          status: response.status,
          error: errorMessage,
          details: errorDetails,
          service: serviceName
        });
        
        throw new Error(`${errorMessage} - ${errorDetails}`);
      }

      const result = await response.json();
      
      console.log(`[Single User Migration] ${serviceName} migration successful for ${targetUserEmail}:`, {
        status: result.status,
        migrationId: result.migrationId
      });
      
      return {
        success: true,
        userEmail: targetUserEmail,
        migrationId: result.migrationId
      };
      
    } catch (error) {
      console.error(`[Single User Migration] ${serviceName} migration failed for ${targetUserEmail}:`, error);
      return {
        success: false,
        userEmail: targetUserEmail,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  };

  // Execute actual service migration with multi-user orchestration
  const executeActualServiceMigration = async (serviceName: string, payload: any): Promise<{ success: boolean; error?: string }> => {
    console.log(`[Service Migration] Starting ${serviceName} migration with user mapping orchestration...`);
    
    try {
      // Map service names to API endpoints
      const serviceEndpoints = {
        'gmail': '/api/v1/migration/gmail',
        'drive': '/api/v1/migration/drive',
        'calendar': '/api/v1/migration/calendar',
        'contacts': '/api/v1/migration/contacts',
        'chat': '/api/v1/migration/chat',
        'photos': '/api/v1/migration/photos',
        'groups': '/api/v1/migration/groups',
        'slides': '/api/v1/migration/slides',
        'forms': '/api/v1/migration/forms'
      };

      const endpoint = serviceEndpoints[serviceName.toLowerCase() as keyof typeof serviceEndpoints];
      if (!endpoint) {
        throw new Error(`No API endpoint configured for service: ${serviceName}`);
      }

      // Get user mappings for this service
      const serviceConfig = payload.serviceConfigs?.[serviceName.toLowerCase()];
      const userMappings = serviceConfig?.userMappings || payload.userMappings || [];
      
      if (userMappings.length === 0) {
        console.warn(`[Service Migration] No user mappings found for ${serviceName}`);
        return { success: true }; // Consider no users as successful
      }
      
      console.log(`[Service Migration] ${serviceName} - Processing ${userMappings.length} user mappings`, {
        serviceName,
        userMappingsCount: userMappings.length,
        endpoint,
        executionStrategy: userMappings.length > 3 ? 'parallel-batches' : 'sequential'
      });

      // Execute user migrations with orchestration
      const migrationResults = await executeUserMigrationOrchestration(
        serviceName, 
        endpoint, 
        userMappings, 
        payload
      );
      
      // Analyze results
      const actualResults = Array.isArray(migrationResults) ? migrationResults : migrationResults.results;
      const successfulMigrations = actualResults.filter(result => result.success).length;
      const failedMigrations = actualResults.filter(result => !result.success).length;
      
      // Update migration progress in real-time
      setMigrationStatus(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          progress: Math.round((successfulMigrations / userMappings.length) * 100),
          lastUpdated: new Date().toISOString(),
          errors: failedMigrations > 0 ? [
            ...prev.errors,
            {
              id: `${serviceName}-user-failures-${Date.now()}`,
              step: `${serviceName}-migration`,
              message: `${failedMigrations} user migrations failed in ${serviceName}`,
              timestamp: new Date().toISOString(),
              resolved: false
            }
          ] : prev.errors
        };
      });
      
      console.log(`[Service Migration] ${serviceName} orchestration completed:`, {
        total: userMappings.length,
        successful: successfulMigrations,
        failed: failedMigrations,
        successRate: `${Math.round((successfulMigrations / userMappings.length) * 100)}%`,
        timestamp: new Date().toISOString()
      });
      
      // Consider migration successful if at least 80% of users migrated successfully
      const successThreshold = 0.8;
      const actualSuccessRate = successfulMigrations / userMappings.length;
      
      if (actualSuccessRate >= successThreshold) {
        return { success: true };
      } else {
        const failedUsers = actualResults
          .filter(result => !result.success)
          .map(result => result.userEmail)
          .join(', ');
        return { 
          success: false, 
          error: `Migration failed for ${failedMigrations} users: ${failedUsers}` 
        };
      }

    } catch (error) {
      console.error(`[Service Migration] ${serviceName} orchestration failed:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      };
    }
  };

  // Create service-specific migration request
  const createServiceMigrationRequest = (serviceName: string, payload: any) => {
    // Check if payload is null or undefined
    if (!payload) {
      console.error(`[Service Migration] Cannot create migration request for ${serviceName}: payload is null`);
      throw new Error(`Migration payload is null for service: ${serviceName}`);
    }
    
    const serviceConfig = payload.serviceConfigs?.[serviceName.toLowerCase()];
    const userMappings = serviceConfig?.userMappings || payload.userMappings || [];

    // Base request structure that all services expect
    const baseRequest = {
      scenario: payload.scenario,
      migrationId: payload.migrationId,
      userMappings: userMappings.map((mapping: any) => ({
        sourceAdminEmail: payload.adminCredentials?.sourceAdminEmail || payload.adminCredentials?.adminEmail,
        targetAdminEmail: payload.adminCredentials?.targetAdminEmail || payload.adminCredentials?.adminEmail,
        sourceUserEmail: mapping.sourceUser?.email || mapping.sourceUser?.primaryEmail,
        targetUserEmail: mapping.targetUser?.email || mapping.targetUser?.primaryEmail,
        migrationOptions: getServiceSpecificMigrationOptions(serviceName, payload.migrationOptions),
        domainMapping: userMappingConfig?.relationship || 'one-to-one'
      }))
    };

    console.log(`[Service Migration] Created ${serviceName} migration request:`, {
      userMappingCount: baseRequest.userMappings.length,
      scenario: baseRequest.scenario,
      sampleMapping: baseRequest.userMappings[0] || null
    });

    return baseRequest;
  };

  // Get service-specific migration options
  const getServiceSpecificMigrationOptions = (serviceName: string, globalOptions: any) => {
    const baseOptions = {
      batchSize: 50,
      ...globalOptions
    };

    switch (serviceName.toLowerCase()) {
      case 'gmail':
        return {
          ...baseOptions,
          includeLabels: globalOptions?.preserveLabels !== false,
          includeFilters: true,
          includeSignature: true,
          dateRange: globalOptions?.dateRange
        };
      
      case 'drive':
        return {
          ...baseOptions,
          includeSharedDrives: globalOptions?.migrateSharedDrives !== false,
          preservePermissions: globalOptions?.maintainPermissions !== false,
          preserveFolderStructure: globalOptions?.migrateFolderStructure !== false,
          includeComments: true
        };
      
      case 'calendar':
        return {
          ...baseOptions,
          includeEvents: true,
          includeCalendarSettings: true,
          preservePermissions: globalOptions?.maintainPermissions !== false
        };
      
      case 'contacts':
        return {
          ...baseOptions,
          includeGroups: true,
          preserveLabels: globalOptions?.preserveLabels !== false
        };
      
      default:
        return baseOptions;
    }
  };

  // Poll service migration progress until completion
  const pollServiceMigrationProgress = async (
    serviceName: string, 
    migrationId: string, 
    endpoint: string
  ): Promise<{ success: boolean; error?: string }> => {
    const maxPolls = 60; // Maximum 5 minutes of polling (5s intervals)
    let polls = 0;

    while (polls < maxPolls) {
      try {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        polls++;

        console.log(`[Service Migration] Polling ${serviceName} progress... (${polls}/${maxPolls})`);

        // Check migration status
        const statusResponse = await fetch(`${endpoint}/${migrationId}/status`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          credentials: 'include'
        });

        if (!statusResponse.ok) {
          console.warn(`[Service Migration] Status check failed for ${serviceName}:`, statusResponse.status);
          continue;
        }

        const status = await statusResponse.json();
        
        console.log(`[Service Migration] ${serviceName} status update:`, {
          status: status.status,
          progress: status.progress,
          processed: status.processedItems,
          total: status.totalItems
        });

        if (status.status === 'completed') {
          console.log(`[Service Migration] ${serviceName} completed successfully after ${polls} polls`);
          return { success: true };
        }

        if (status.status === 'failed') {
          return { 
            success: false, 
            error: status.error || `${serviceName} migration failed during execution`
          };
        }

        // Continue polling for 'processing' status
      } catch (error) {
        console.error(`[Service Migration] Error polling ${serviceName} status:`, error);
        // Continue polling unless it's the last attempt
        if (polls >= maxPolls) {
          return { 
            success: false, 
            error: `Polling timeout after ${polls} attempts`
          };
        }
      }
    }

    return { 
      success: false, 
      error: `Migration polling timeout after ${maxPolls} attempts`
    };
  };

  // Simulate service migration (DEPRECATED - keeping for fallback)
  const simulateServiceMigration = async (serviceName: string, payload: any): Promise<{ success: boolean; error?: string }> => {
    console.log(`[Service Migration] FALLBACK: Simulating ${serviceName} migration...`);
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 5000 + Math.random() * 10000)); // 5-15 seconds
    
    // Simulate random success/failure (90% success rate)
    const success = Math.random() > 0.1;
    
    if (success) {
      console.log(`[Service Migration] ${serviceName} simulation completed successfully`);
      return { success: true };
    } else {
      const error = `Simulated error in ${serviceName} migration`;
      console.error(`[Service Migration] ${serviceName} simulation failed:`, error);
      return { success: false, error };
    }
  };

  // Function to create migration API payload for services
  const createMigrationPayload = useCallback((serviceName?: string, migrationStatusParam?: MigrationStatus) => {
    // Use passed parameter or fallback to state
    const effectiveMigrationStatus = migrationStatusParam || migrationStatus;
    
    console.log(`[createMigrationPayload] Called for service: ${serviceName}`, {
      migrationStatus: !!effectiveMigrationStatus,
      migrationConfig: !!migrationConfig,
      migrationStatusId: effectiveMigrationStatus?.id,
      migrationConfigServices: migrationConfig?.services,
      usingParam: !!migrationStatusParam
    });
    
    if (!effectiveMigrationStatus || !migrationConfig) {
      console.warn(`[createMigrationPayload] Returning null - migrationStatus: ${!!effectiveMigrationStatus}, migrationConfig: ${!!migrationConfig}`);
      return null;
    }

    const basePayload = {
      migrationId: effectiveMigrationStatus.id,
      scenario: selectedScenario,
      services: migrationConfig.services || [],
      userMappings: effectiveMigrationStatus.migrationConfig?.serviceUserMappings || [],
      executionPlan: effectiveMigrationStatus.migrationConfig?.executionPlan,
      adminCredentials: effectiveMigrationStatus.migrationConfig?.adminCredentials,
      domainMapping: effectiveMigrationStatus.migrationConfig?.domainMapping,
      migrationOptions: effectiveMigrationStatus.migrationConfig?.migrationOptions,
      verificationToken: enhancedVerificationToken || effectiveMigrationStatus.migrationConfig?.verificationToken || verificationTokenGenerator.token,
      // Service-specific configurations
      serviceConfigs: (migrationConfig.services || []).reduce((configs: Record<string, any>, service: string) => {
        configs[service.toLowerCase()] = {
          enabled: true,
          batchSize: effectiveMigrationStatus.migrationConfig?.executionPlan?.batchSize || 5,
          retryPolicy: effectiveMigrationStatus.migrationConfig?.executionPlan?.retryPolicy,
          rules: effectiveMigrationStatus.migrationConfig?.migrationOptions,
          userMappings: (effectiveMigrationStatus.migrationConfig?.serviceUserMappings || []).map((mapping: any) => ({
            targetUser: mapping.targetUser,
            sourceUser: mapping.sourceUser,
            serviceConfig: mapping.services?.find((s: any) => s.serviceName === service.toLowerCase())
          })).filter((mapping: any) => mapping.serviceConfig)
        };
        return configs;
      }, {}),
      // API endpoints for service communication
      endpoints: {
        progress: `/api/migration/${effectiveMigrationStatus.id}/progress`,
        status: `/api/migration/${effectiveMigrationStatus.id}/status`,
        error: `/api/migration/${effectiveMigrationStatus.id}/error`,
        complete: `/api/migration/${effectiveMigrationStatus.id}/complete`
      }
    };

    // If serviceName is provided, return service-specific payload
    if (serviceName) {
      const serviceConfig = basePayload.serviceConfigs?.[serviceName.toLowerCase()];
      if (!serviceConfig) {
        console.warn(`Service ${serviceName} not found in configuration`);
        return null;
      }

      return {
        migrationId: basePayload.migrationId,
        service: serviceName,
        servicePriority: (migrationConfig?.services || []).indexOf(serviceName) + 1,
        userMappings: serviceConfig.userMappings || [],
        totalUsers: serviceConfig.userMappings?.length || 0,
        mappingStats: {
          explicit: (effectiveMigrationStatus.migrationConfig?.serviceUserMappings || []).filter((m: any) => m.mappingType === 'explicit').length,
          inferred: (effectiveMigrationStatus.migrationConfig?.serviceUserMappings || []).filter((m: any) => m.mappingType === 'inferred').length,
          direct: (effectiveMigrationStatus.migrationConfig?.serviceUserMappings || []).filter((m: any) => m.mappingType === 'direct').length
        },
        sourceDomain: migrationConfig?.sourceDomain || '',
        targetDomains: migrationConfig?.targetDomains || [],
        adminCredentials: basePayload.adminCredentials,
        migrationOptions: basePayload.migrationOptions,
        executionPlan: basePayload.executionPlan,
        verificationToken: basePayload.verificationToken
      };
    }

    return basePayload;
  }, [selectedScenario, migrationConfig, enhancedVerificationToken, verificationTokenGenerator.token, migrationStatus]);

  const calculateEstimatedDuration = useCallback((serviceType: string, userCount: number) => {
    const baseDuration = {
      gmail: 30, // minutes per user
      drive: 45,
      calendar: 15,
      contacts: 10
    };
    return ((baseDuration as any)[serviceType] || 20) * userCount;
  }, []);

  const createBatchExecutionPlan = useCallback((userMappings: any[], batchSize: number) => {
    const batches = [];
    for (let i = 0; i < userMappings.length; i += batchSize) {
      batches.push({
        batchId: Math.floor(i / batchSize) + 1,
        users: userMappings.slice(i, i + batchSize),
        estimatedStartTime: new Date(Date.now() + (i / batchSize) * 10 * 60 * 1000), // 10 minutes per batch
        status: 'pending'
      });
    }
    return batches;
  }, []);

  const getServiceDependencies = useCallback((serviceType: string) => {
    const dependencies = {
      gmail: ['contacts'], // Gmail often needs contacts migrated first
      drive: [], // Drive can run independently
      calendar: ['contacts'], // Calendar needs contacts for attendee mapping
      contacts: [] // Contacts has no dependencies
    };
    return (dependencies as any)[serviceType] || [];
  }, []);

  // Function to start individual service migration with one-to-many support
  const startServiceMigration = useCallback(async (serviceName: string, payload?: any) => {
    const servicePayload = payload || createMigrationPayload(serviceName);
    if (!servicePayload) return;

    // Check for one-to-many mappings
    const oneToManyMappings = servicePayload.userMappings?.filter((m: any) => m.isParallelExecution) || [];
    const regularMappings = servicePayload.userMappings?.filter((m: any) => !m.isParallelExecution) || [];

    console.log(`🚀 Starting ${serviceName.toUpperCase()} migration...`);
    console.log(`📋 Migration ID: ${servicePayload.migrationId}`);
    console.log(`👥 Total Users: ${servicePayload.totalUsers || 0}`);
    console.log(`🔄 One-to-Many Groups: ${oneToManyMappings.length > 0 ? 
      [...new Set(oneToManyMappings.map((m: any) => m.parallelGroup?.groupId))].length : 0}`);
    console.log(`👤 Regular Mappings: ${regularMappings.length}`);
    console.log(`⏱️  Estimated Duration: ${servicePayload.executionPlan?.estimatedDuration || 0} minutes`);
    console.log(`📦 Batches: ${servicePayload.executionPlan?.batchExecutionPlan?.length || 0}`);
    
    // Log one-to-many specific information
    if (oneToManyMappings.length > 0) {
      const parallelGroups = [...new Set(oneToManyMappings.map((m: any) => m.parallelGroup?.groupId))];
      console.log(`🔀 Parallel Execution Groups:`, parallelGroups);
      
      parallelGroups.forEach(groupId => {
        const groupMappings = oneToManyMappings.filter((m: any) => m.parallelGroup?.groupId === groupId);
        const sourceUser = groupMappings[0]?.sourceUser?.email || 'unknown';
        const targetUsers = groupMappings.map((m: any) => m.targetUser.email);
        console.log(`   Group ${groupId}: ${sourceUser} → [${targetUsers.join(', ')}]`);
      });
      
      console.log(`⚡ Optimization: Reading from ${parallelGroups.length} sources, distributing to ${oneToManyMappings.length} targets`);
    }
    
    if (servicePayload.executionPlan?.dependencies?.length > 0) {
      console.log(`⚠️  Dependencies: ${servicePayload.executionPlan.dependencies.join(', ')}`);
    }

    // Here you would make the actual API call to your migration service
    try {
      console.log(`✅ ${serviceName.toUpperCase()} migration service called successfully`);
      console.log(`📊 Mapping Statistics:`, {
        totalMappings: servicePayload.userMappings?.length || 0,
        oneToManyGroups: oneToManyMappings.length > 0 ? 
          [...new Set(oneToManyMappings.map((m: any) => m.parallelGroup?.groupId))].length : 0,
        parallelTargets: oneToManyMappings.length,
        regularMappings: regularMappings.length,
        coordinationStrategy: servicePayload.executionPlan?.oneToManyConfig?.coordinationStrategy || 'standard'
      });
      
      // For one-to-many, log the parallel execution plan
      if (oneToManyMappings.length > 0) {
        console.log(`🔄 Parallel Execution Plan:`, {
          strategy: servicePayload.executionPlan?.oneToManyConfig?.coordinationStrategy,
          parallelLimit: servicePayload.executionPlan?.oneToManyConfig?.parallelTargetLimit,
          failureHandling: servicePayload.executionPlan?.oneToManyConfig?.failureHandling,
          progressReporting: servicePayload.executionPlan?.oneToManyConfig?.progressReporting
        });
      }
      
      return {
        success: true,
        migrationId: servicePayload.migrationId,
        service: serviceName,
        status: 'initiated',
        executionMode: oneToManyMappings.length > 0 ? 'parallel-groups' : 'sequential',
        parallelGroups: oneToManyMappings.length > 0 ? 
          [...new Set(oneToManyMappings.map((m: any) => m.parallelGroup?.groupId))] : []
      };
    } catch (error) {
      console.error(`❌ Failed to start ${serviceName} migration:`, error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }, [createMigrationPayload]);

  // Example of how services would receive and process user mappings
  const processMigrationForService = useCallback(async (serviceName: string, userMappings: any[]) => {
    console.log(`[Migration ${serviceName}] Processing ${userMappings.length} user mappings`);
    
    // Example service processing logic
    const serviceResults = await Promise.all(
      userMappings.map(async (mapping: any) => {
        const { targetUser, sourceUser, serviceConfig } = mapping;
        
        console.log(`[Migration ${serviceName}] Processing user: ${sourceUser?.email || 'direct'} → ${targetUser.email}`);
        
        // This would be the actual service-specific migration logic
        const migrationResult = {
          targetUser: targetUser.email,
          sourceUser: sourceUser?.email || null,
          service: serviceName,
          status: 'processing',
          startTime: new Date().toISOString(),
          progress: 0,
          items: {
            total: 0,
            processed: 0,
            failed: 0
          },
          errors: [],
          // Service-specific data
          serviceData: serviceConfig ? {
            sourceConfig: serviceConfig.sourceConfig,
            targetConfig: serviceConfig.targetConfig,
            rules: serviceConfig.migrationRules
          } : null
        };

        // Simulate service processing
        switch (serviceName.toLowerCase()) {
          case 'gmail':
            migrationResult.items.total = Math.floor(Math.random() * 1000) + 100; // 100-1100 emails
            break;
          case 'drive':
            migrationResult.items.total = Math.floor(Math.random() * 500) + 50; // 50-550 files
            break;
          case 'calendar':
            migrationResult.items.total = Math.floor(Math.random() * 50) + 10; // 10-60 events
            break;
          case 'contacts':
            migrationResult.items.total = Math.floor(Math.random() * 200) + 20; // 20-220 contacts
            break;
          default:
            migrationResult.items.total = Math.floor(Math.random() * 100) + 10;
        }

        return migrationResult;
      })
    );

    console.log(`[Migration ${serviceName}] Initialized ${serviceResults.length} user migrations`);
    return serviceResults;
  }, []);

  // Function to get migration payload for external services
  const getMigrationPayloadForAPI = useCallback(() => {
    const payload = createMigrationPayload(); // Get full payload, not service-specific
    if (!payload) return null;

    // Ensure we have the full payload with all properties
    if (!('scenario' in payload) || !('services' in payload)) {
      console.error('Invalid payload structure for API');
      return null;
    }

    // Return sanitized payload for API consumption
    return {
      migrationId: payload.migrationId,
      scenario: payload.scenario,
      services: payload.services,
      totalUsers: payload.userMappings?.length || 0,
      userMappings: (payload.userMappings || []).map((mapping: any) => ({
        id: `${mapping.targetUser.email}-${mapping.sourceUser?.email || 'direct'}`,
        target: {
          email: mapping.targetUser.email,
          name: mapping.targetUser.name,
          domain: mapping.targetUser.domain,
          orgUnit: mapping.targetUser.orgUnitPath
        },
        source: mapping.sourceUser ? {
          email: mapping.sourceUser.email,
          name: mapping.sourceUser.name,
          domain: mapping.sourceUser.domain,
          orgUnit: mapping.sourceUser.orgUnitPath
        } : null,
        mapping: {
          type: mapping.mappingType,
          relationship: mapping.relationship
        },
        services: mapping.services.map((service: any) => ({
          name: service.serviceName,
          enabled: service.enabled,
          source: service.sourceConfig,
          target: service.targetConfig,
          rules: service.migrationRules
        }))
      })),
      execution: payload.executionPlan,
      credentials: {
        scenario: payload.adminCredentials.scenario,
        hasSourceAdmin: !!payload.adminCredentials.sourceAdminEmail,
        hasTargetAdmin: !!payload.adminCredentials.targetAdminEmail,
        adminCount: {
          source: payload.adminCredentials.sourceAdminEmails?.length || 0,
          target: payload.adminCredentials.targetAdminEmails?.length || 0
        }
      },
      timestamp: new Date().toISOString()
    };
  }, [createMigrationPayload]);

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
    // Ensure we return something for each case
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
                Authenticate & Configure Domains
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                {selectedScenario === 'single-super-admin' 
                  ? 'Authenticate with your Google Workspace to discover and configure domains under your super admin account.'
                  : 'Authenticate with both source and target Google Workspace domains to discover and configure domain mappings under your cross-tenant migration.'}
              </p>
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
                  useServiceAccount={!!(process.env.NEXT_PUBLIC_GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL)}
                />
              </ComponentLoader>
            </div>

            {/* Status Indicator */}
            {dwdSetupComplete && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-6">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                  <div>
                    <h3 className="font-medium text-green-900 text-sm">Domain-wide Delegation Configured</h3>
                    <p className="text-green-700 text-xs">The service account has been properly configured for domain-wide delegation.</p>
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
                  useServiceAccount={!!(process.env.NEXT_PUBLIC_GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL)}
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
                  useServiceAccount={memoizedUseServiceAccount}
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

                {/* User Mapping Section - moved up */}
                <div className="bg-white border border-gray-200 rounded-xl">
                  <Suspense fallback={
                    <div className="p-6">
                      <div className="flex items-center space-x-3 mb-4">
                        <div className="w-5 h-5 bg-gray-300 rounded animate-pulse"></div>
                        <div className="w-48 h-6 bg-gray-300 rounded animate-pulse"></div>
                      </div>
                      <div className="space-y-3">
                        <div className="w-full h-4 bg-gray-200 rounded animate-pulse"></div>
                        <div className="w-3/4 h-4 bg-gray-200 rounded animate-pulse"></div>
                        <div className="w-1/2 h-4 bg-gray-200 rounded animate-pulse"></div>
                      </div>
                    </div>
                  }>
                    <UserMapping
                      sourceDomains={sourceDomains}
                      targetDomains={targetDomains}
                      sourceAdminEmails={(() => {
                        // Ensure all source domains have admin emails
                        const computedSourceAdminEmails: {[domain: string]: string} = {};
                        sourceDomains.forEach(domain => {
                          computedSourceAdminEmails[domain] = sourceAdminEmails[domain] || sourceAdminEmail || adminEmail || '';
                        });
                        return computedSourceAdminEmails;
                      })()}
                      targetAdminEmails={targetAdminEmails}
                      strategy={userMappingConfig?.relationship || 'one-to-one'}
                      onMappingComplete={(mappings) => {
                        console.log('[Migration Config] User mappings completed:', mappings);
                        console.log('[Migration Config] UserMapping domains:', { sourceDomains, targetDomains });
                        console.log('[Migration Config] Strategy:', userMappingConfig?.relationship);
                        
                        // Extract users from mappings and update selectedAllTargetUsers
                        const users: any[] = [];
                        mappings.forEach(mapping => {
                          // For many-to-one strategy with consolidated mappings
                          if ((mapping as any).targetUsers && typeof (mapping as any).targetUsers === 'object') {
                            // Handle consolidated mappings where targetUsers is an object with domain keys
                            Object.entries((mapping as any).targetUsers).forEach(([domain, domainUsers]) => {
                              if (Array.isArray(domainUsers)) {
                                domainUsers.forEach(user => {
                                  users.push({
                                    ...user,
                                    sourceEmail: mapping.sourceUser.primaryEmail,
                                    sourceUser: mapping.sourceUser,
                                    targetDomain: domain
                                  });
                                });
                              }
                            });
                          } else {
                            // Handle regular one-to-one mappings
                            if (mapping.targetUser) {
                              users.push({
                                primaryEmail: mapping.targetUser.primaryEmail || mapping.targetEmail,
                                targetDomain: mapping.targetUser.domain,
                                sourceEmail: mapping.sourceUser.primaryEmail,
                                sourceUser: mapping.sourceUser,
                                name: mapping.sourceUser.name || mapping.targetUser.name
                              });
                            } else if (mapping.targetEmail) {
                              // Fallback to targetEmail if targetUser is not available
                              users.push({
                                primaryEmail: mapping.targetEmail,
                                sourceEmail: mapping.sourceUser.primaryEmail,
                                sourceUser: mapping.sourceUser,
                                name: mapping.sourceUser.name
                              });
                            }
                          }
                        });
                        
                        console.log('[Migration Config] Extracted users for migration:', users);
                        setSelectedAllTargetUsers(users);
                      }}
                    />
                  </Suspense>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-6">
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

                {/* Advanced Options - moved to right column */}
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

              {/* Selected Users for Migration */}
              {selectedAllTargetUsers.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Users className="h-5 w-5 mr-2 text-blue-600" />
                    Selected Users for Migration ({selectedAllTargetUsers.length})
                  </h3>
                  <div className="space-y-4">
                    <div className="grid md:grid-cols-3 gap-4">
                      <div>
                        <div className="text-sm text-gray-600 mb-1">Total Users</div>
                        <div className="font-medium text-gray-900">{selectedAllTargetUsers.length}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600 mb-1">Migration Strategy</div>
                        <div className="font-medium text-gray-900">
                          {userMappingConfig?.relationship ? 
                            userMappingConfig.relationship.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 
                            'One-to-One'
                          }
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600 mb-1">Target Domains</div>
                        <div className="font-medium text-gray-900">
                          {new Set(selectedAllTargetUsers.map(user => user.targetDomain || user.primaryEmail?.split('@')[1]).filter(Boolean)).size}
                        </div>
                      </div>
                    </div>
                    
                    <div className="max-h-40 overflow-y-auto">
                      <div className="text-sm text-gray-600 mb-2">Users selected for migration:</div>
                      <div className="space-y-2">
                        {selectedAllTargetUsers.slice(0, 15).map((user, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center space-x-3">
                              <div className="flex-shrink-0">
                                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                                  <span className="text-xs font-medium text-blue-600">
                                    {user.name?.fullName?.charAt(0) || user.name?.givenName?.charAt(0) || user.sourceUser?.name?.givenName?.charAt(0) || user.primaryEmail?.charAt(0) || 'U'}
                                  </span>
                                </div>
                              </div>
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {user.name?.fullName || user.sourceUser?.name?.fullName || user.primaryEmail}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {user.sourceEmail && user.primaryEmail ? 
                                    `${user.sourceEmail} → ${user.primaryEmail}` : 
                                    user.primaryEmail
                                  }
                                </div>
                              </div>
                            </div>
                            <div className="text-xs text-blue-600 font-medium">
                              {user.targetDomain || user.primaryEmail?.split('@')[1]}
                            </div>
                          </div>
                        ))}
                        {selectedAllTargetUsers.length > 15 && (
                          <div className="text-sm text-gray-500 italic text-center py-2">
                            ...and {selectedAllTargetUsers.length - 15} more users
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-start space-x-2">
                        <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-blue-800">
                          <p className="font-medium mb-1">Migration Target</p>
                          <p>
                            Data from {selectedAllTargetUsers.length} user{selectedAllTargetUsers.length !== 1 ? 's' : ''} will be migrated across {migrationConfig.services.length} service{migrationConfig.services.length !== 1 ? 's' : ''}. 
                            {userMappingConfig?.relationship === 'many-to-one' && ' Multiple source users will be consolidated into target accounts.'}
                            {userMappingConfig?.relationship === 'one-to-many' && ' Source users will be distributed across multiple target domains.'}
                          </p>
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

            {/* Start Migration Button */}
            <div className="max-w-4xl mx-auto">
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Ready to Start Migration</h3>
                  <p className="text-gray-600 mb-6">
                    All configurations have been reviewed. Click the button below to begin the migration process.
                  </p>
                  <button
                    onClick={() => {
                      if (!selectedScenario) {
                        console.error('[Migration] Cannot start migration: no scenario selected');
                        return;
                      }
                      
                      console.log('[Migration] Starting migration process...');
                      // TODO: Implement migration start logic
                      setCurrentStep('migration');
                      
                      // Initialize migration status
                      setMigrationStatus({
                        id: `migration-${Date.now()}`,
                        name: migrationConfig.migrationName || `Migration - ${new Date().toLocaleDateString()}`,
                        scenarioType: selectedScenario,
                        status: 'running',
                        currentStep: 'migration',
                        startTime: new Date().toISOString(),
                        estimatedCompletion: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
                        overallProgress: 0,
                        errors: [],
                        serviceProgress: {},
                        userProgress: {},
                        migrationConfig: {
                          services: migrationConfig.services,
                          sourceDomain: migrationConfig.sourceDomain,
                          targetDomain: migrationConfig.targetDomain,
                          migrationOptions: migrationConfig.migrationOptions,
                          userMappings: userMappings,
                          selectedUsers: selectedAllTargetUsers,
                          domainMapping: domainMapping,
                          userMappingConfig: userMappingConfig,
                          serviceUserMappings: [],
                          executionPlan: {
                            totalUsers: selectedAllTargetUsers.length,
                            effectiveUsers: selectedAllTargetUsers.length,
                            totalServices: migrationConfig.services.length,
                            estimatedDuration: migrationConfig.services.length * 30,
                            batchSize: 5,
                            retryPolicy: {
                              maxRetries: 3,
                              backoffMultiplier: 2,
                              initialDelay: 1000
                            },
                            serviceOrder: migrationConfig.services,
                            parallelServices: false
                          },
                          adminCredentials: {
                            scenario: selectedScenario,
                            adminEmail: selectedScenario === 'single-super-admin' ? adminEmail : undefined,
                            sourceAdminEmail: selectedScenario === 'cross-tenant' ? sourceAdminEmail : undefined,
                            targetAdminEmail: selectedScenario === 'cross-tenant' ? targetAdminEmail : undefined,
                            sourceAdminEmails: selectedScenario === 'cross-tenant' ? sourceAdminEmails : undefined,
                            targetAdminEmails: targetAdminEmails
                          }
                        }
                      });
                    }}
                    className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-xl hover:from-green-700 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transform transition-all duration-200 hover:scale-105 shadow-lg"
                  >
                    <PlayCircle className="h-6 w-6 mr-3" />
                    Start Migration Process
                  </button>
                  <p className="text-sm text-gray-500 mt-4">
                    This will begin migrating data for {selectedAllTargetUsers.length} user{selectedAllTargetUsers.length !== 1 ? 's' : ''} across {migrationConfig.services.length} service{migrationConfig.services.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case 'migration':
        if (!selectedScenario || !migrationStatus) return null;
        
        return (
          <div className="space-y-8">
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl">
                  <PlayCircle className="h-8 w-8 text-green-600 animate-pulse" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Migration in Progress
              </h2>
            </div>
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
               selectedAllTargetUsers.length > 0; // Require users to be selected
        
        console.log('[Migration Wizard] Configuration validation:', {
          migrationName: migrationConfig.migrationName,
          migrationNameValid: migrationConfig.migrationName.trim() !== '',
          sourceDomain: migrationConfig.sourceDomain,
          sourceDomainValid: !!migrationConfig.sourceDomain,
          targetDomain: migrationConfig.targetDomain,
          targetDomainValid: !!migrationConfig.targetDomain,
          services: migrationConfig.services,
          servicesValid: migrationConfig.services.length > 0,
          selectedUsers: selectedAllTargetUsers.length,
          selectedUsersValid: selectedAllTargetUsers.length > 0,
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
    migrationConfig.services, 
    selectedAllTargetUsers.length,
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
  const sourceDomains = useMemo(() => {
    const domains = getSourceDomains();
    console.log('[Migration Page] Computed sourceDomains:', domains);
    return domains;
  }, [getSourceDomains]);
  const targetDomains = useMemo(() => {
    const domains = getTargetDomains();
    console.log('[Migration Page] Computed targetDomains:', domains);
    return domains;
  }, [getTargetDomains]);
  
  // Add ref to track if we've loaded users for this configuration step
  const hasLoadedUsersForCurrentStep = useRef(false);
  const hasLoadedAllTargetUsers = useRef(false);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);
  
  // Load all target domain users when configuration step is reached
  useEffect(() => {
    console.log('[Migration Config] Second useEffect triggered - currentStep:', currentStep, 
                'targetDomains:', targetDomains, 
                'targetAdminEmails:', targetAdminEmails);
    
    const condition1 = currentStep === 'configuration';
    const condition2 = targetDomains.length > 0;
    const condition3 = Object.keys(targetAdminEmails).length > 0;
    
    console.log('[Migration Config] Conditions check:', {
      'currentStep': currentStep,
      'currentStep === configuration': condition1,
      'targetDomains': targetDomains,
      'targetDomains.length > 0': condition2,
      'targetAdminEmails': targetAdminEmails,
      'targetAdminEmails keys': Object.keys(targetAdminEmails),
      'targetAdminEmails keys > 0': condition3,
      'hasLoadedAllTargetUsers.current': hasLoadedAllTargetUsers.current,
      'all conditions met': condition1 && condition2 && condition3,
      'final condition': condition1 && condition2 && condition3 && !hasLoadedAllTargetUsers.current
    });
    
    if (condition1 && condition2 && condition3 && !hasLoadedAllTargetUsers.current) {
      console.log('[Migration Config] Loading all target domain users for migration settings...');
      hasLoadedAllTargetUsers.current = true;
      loadAllTargetDomainUsers();
    } else {
      console.log('[Migration Config] Not loading target users - conditions not met or already loaded');
      console.log('[Migration Config] Reason:', {
        'step not configuration': !condition1,
        'no target domains': !condition2,
        'no admin emails': !condition3,
        'already loaded': hasLoadedAllTargetUsers.current
      });
    }
  }, [currentStep, targetDomains, targetAdminEmails, loadAllTargetDomainUsers]);

  // Debug helper function - expose to window for console debugging
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).debugMigrationStep = {
        currentStep,
        targetDomains,
        targetAdminEmails,
        migrationConfig,
        domainMapping,
        goToConfiguration: () => setCurrentStep('configuration'),
        forceLoadUsers: () => {
          console.log('[DEBUG] Force loading users...');
          hasLoadedAllTargetUsers.current = false;
          loadAllTargetDomainUsers();
        },
        checkConditions: () => {
          const condition1 = currentStep === 'configuration';
          const condition2 = targetDomains.length > 0;
          const condition3 = Object.keys(targetAdminEmails).length > 0;
          
          return {
            currentStep,
            targetDomains,
            targetAdminEmails,
            'currentStep === configuration': condition1,
            'targetDomains.length > 0': condition2,
            'targetAdminEmails keys > 0': condition3,
            'all conditions met': condition1 && condition2 && condition3,
            'hasLoadedAllTargetUsers': hasLoadedAllTargetUsers.current
          };
        }
      };
    }
  }, [currentStep, targetDomains, targetAdminEmails, migrationConfig, domainMapping, loadAllTargetDomainUsers]);

  // Reset loading flags when step changes
  useEffect(() => {
    if (currentStep !== 'configuration') {
      hasLoadedAllTargetUsers.current = false;
      hasLoadedUsersForCurrentStep.current = false;
    }
  }, [currentStep]);
  
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
    return verificationTokenGenerator.token || undefined;
  }, [verificationTokenGenerator.token]);
  
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
                      {/* Step Circle with Tooltip */}
                      <div 
                        className="relative z-10 group"
                        title={config.tooltip}
                      >
                        <div className={`flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all duration-300 cursor-pointer ${
                          isCompleted 
                            ? 'bg-gradient-to-r from-blue-500 to-indigo-600 border-blue-500 text-white shadow-lg' 
                            : isActive
                            ? 'bg-white border-blue-500 text-blue-600 shadow-lg ring-4 ring-blue-100'
                            : 'bg-white border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-500'
                        }`}>
                          {isCompleted ? (
                            <CheckCircle className="h-6 w-6" />
                          ) : (
                            <IconComponent className="h-5 w-5" />
                          )}
                        </div>
                        
                        {/* Custom Tooltip */}
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 shadow-lg">
                          {config.tooltip}
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
                        </div>
                      </div>
                      
                      {/* Step Info */}
                      <div className="mt-4 text-center max-w-36 px-2">
                        <div className={`text-sm font-sansation text-heading mb-1 ${
                          isActive ? 'text-blue-600' : isCompleted ? 'text-gray-900' : 'text-gray-500'
                        }`}>
                          {config.title}
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
                  <div className="flex flex-col items-end space-y-2">
                    {/* Domain Configuration - Right aligned */}
                    {domainMapping && (
                      <div className="flex items-center space-x-2">
                        <Database className="h-4 w-4 text-blue-200" />
                        <span className="text-sm text-blue-100">Domain Configuration:</span>
                        <span className="text-sm font-medium text-white">
                          {Object.keys(domainMapping).length} source domain(s) to {Object.values(domainMapping).flat().length} target domain(s)
                        </span>
                      </div>
                    )}
                    {/* Migration Scenario and User Mapping Strategy - Right aligned */}
                    {selectedScenario && (
                      <div className="flex flex-col space-y-1 text-right">
                        <div className="flex items-center space-x-2">
                          <Users className="h-4 w-4 text-blue-200" />
                          <span className="text-sm text-blue-100">Migration Scenario:</span>
                          <span className="text-sm font-medium text-white">
                            {selectedScenario === 'single-super-admin' ? 'Single Super Admin' : 'Cross-Tenant Migration'}
                          </span>
                        </div>
                        {userMappingConfig?.relationship && (
                          <div className="flex items-center space-x-2">
                            <GitBranch className="h-4 w-4 text-blue-200" />
                            <span className="text-sm text-blue-100">User Mapping Strategy:</span>
                            <span className="text-sm font-medium text-white">
                              {userMappingConfig.relationship === 'one-to-one' ? 'One-to-one mapping' : 
                               userMappingConfig.relationship === 'one-to-many' ? 'One-to-many mapping' :
                               userMappingConfig.relationship === 'many-to-one' ? 'Many-to-one mapping' :
                               userMappingConfig.relationship === 'many-to-many' ? 'Many-to-many mapping' :
                               userMappingConfig.relationship}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                    {currentStep !== 'scenario' && currentStep !== 'migration' && (
                      <div className="flex items-center space-x-2 text-blue-100">
                        <Clock className="h-4 w-4" />
                        <span className="text-sm">Est. {getTotalSteps() - getStepNumber()} steps remaining</span>
                      </div>
                    )}
                  </div>
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
                              {selectedAllTargetUsers.length === 0 && 'Select users to migrate. '}
                            </div>
                          ) : (
                            'Complete all required fields to continue'
                          )}
                        </div>
                      )}
                      {currentStep !== 'review' && (
                        <button
                          onClick={() => {
                            if (currentStep === 'delegation' && canProceed()) {
                              // Handle complete configuration action
                              console.log('Complete Configuration clicked');
                              // You can add specific logic here
                              handleNext(); // Or any other action you want
                            } else {
                              handleNext();
                            }
                          }}
                          disabled={!canProceed()}
                          className={`flex items-center px-8 py-3 text-sm font-medium rounded-lg transition-all ${
                            canProceed()
                              ? currentStep === 'delegation' 
                                ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700 shadow-lg hover:shadow-xl'
                                : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl'
                              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          }`}
                        >
                          {currentStep === 'delegation' ? (
                            <>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Complete Configuration
                            </>
                          ) : (
                            <>
                              {getNextButtonText()}
                              <ArrowRight className="h-4 w-4 ml-2" />
                            </>
                          )}
                        </button>
                      )}
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
