// Migration scenario type definitions
export type MigrationScenario = 
  | 'single-super-admin'
  | 'cross-tenant';

export interface MigrationStep {
  id: string;
  title: string;
  description: string;
  automationApproach: string;
  apisUsed: string[];
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  progress: number; // 0-100
  estimatedDuration: string;
  actualDuration?: string;
  error?: string;
  features?: string[];
}

export interface MigrationError {
  id: string;
  step: string;
  message: string;
  timestamp: string;
  resolved: boolean;
}

export interface MigrationStatus {
  id: string;
  name: string;
  scenarioType: MigrationScenario;
  status: 'running' | 'completed' | 'failed' | 'paused';
  currentStep: string;
  startTime: string;
  estimatedCompletion: string;
  overallProgress: number;
  errors: MigrationError[];
}

export interface DomainMapping {
  sourceDomain: string;
  targetDomain: string;
  userMappings?: Array<{
    sourceUser: string;
    targetUser: string;
  }>;
}

export interface MultiDomainMapping {
  sourceDomains: string[];
  targetDomains: string[];
  mappingType: DomainMappingType;
  userMappings?: Array<{
    sourceUser: string;
    targetUser: string;
    sourceDomain: string;
    targetDomain: string;
  }>;
}

export interface TargetDomainConfig {
  domain: string;
  userMappings?: Array<{
    sourceUser: string;
    targetUser: string;
  }>;
  conflictResolution?: 'prefix' | 'suffix' | 'manual';
  preserveGroups?: boolean;
  emailForwarding?: boolean;
}

export interface SingleSuperAdminScenario {
  type: 'single-super-admin';
  domainMapping: DomainMapping | MultiDomainMapping;
  steps: MigrationStep[];
  migrationDirection: 'source-to-target' | 'bidirectional';
  migrationDepth: 'users-only' | 'users-and-data';
  mappingType?: DomainMappingType;
  multiTargetConfig?: MultiTargetDomainConfig;
  multiSourceConfig?: MultiSourceDomainConfig;
}

export interface CrossTenantScenario {
  type: 'cross-tenant';
  domainMapping: DomainMapping | MultiDomainMapping;
  steps: MigrationStep[];
  authenticationStrategy: 'service-account' | 'oauth' | 'hybrid';
  migrationDepth: 'users-only' | 'users-and-data';
  mappingType?: DomainMappingType;
  multiTargetConfig?: MultiTargetDomainConfig;
  multiSourceConfig?: MultiSourceDomainConfig;
}

export type MigrationScenarioConfig = 
  | SingleSuperAdminScenario
  | CrossTenantScenario;

// Scenario 1: Single Super Admin Migration Steps
export const SINGLE_SUPER_ADMIN_STEPS: MigrationStep[] = [
  {
    id: 'auth-and-domains',
    title: '� Authenticate & Configure Domains',
    description: 'Authenticate with Google Workspace and configure domain mappings',
    automationApproach: 'OAuth 2.0 authentication with automatic domain discovery and mapping configuration',
    apisUsed: ['Google OAuth 2.0', 'AdminSDK > Domains.list()', 'Custom domain mapping logic'],
    status: 'pending',
    progress: 0,
    estimatedDuration: '3-7 minutes'
  },
  {
    id: 'user-discovery',
    title: '� User Discovery',
    description: 'Discover and analyze users in source domains',
    automationApproach: 'Use Admin SDK to enumerate all users and their properties',
    apisUsed: ['AdminSDK > Users.list()', 'AdminSDK > Users.get()'],
    status: 'pending',
    progress: 0,
    estimatedDuration: '2-5 minutes'
  },
  {
    id: 'target-user-creation',
    title: '👤 Target User Creation',
    description: 'Create users in target domain with validation and progress tracking',
    automationApproach: 'Intelligent bulk user creation with existence checking, retry logic, and comprehensive error handling',
    apisUsed: ['AdminSDK > Users.insert()', 'AdminSDK > Users.get()', 'Batch processing with rate limiting'],
    status: 'pending',
    progress: 0,
    estimatedDuration: '5-15 minutes',
    features: [
      'Batch user creation with configurable batch sizes',
      'Real-time progress tracking and ETA calculation', 
      'Automatic existence checking to prevent duplicates',
      'Exponential backoff retry mechanism for failed creations',
      'Comprehensive error handling and rollback capabilities',
      'Secure temporary password generation',
      'Organizational unit preservation',
      'Domain-specific admin email routing'
    ]
  },
  {
    id: 'email-migration',
    title: '📧 Email Migration',
    description: 'Migrate emails from source to target users',
    automationApproach: 'Use Gmail API to transfer messages and labels',
    apisUsed: ['Gmail API > messages.list()', 'Gmail API > messages.import()'],
    status: 'pending',
    progress: 0,
    estimatedDuration: '2-8 hours'
  },
  {
    id: 'drive-migration',
    title: '💾 Drive Migration',
    description: 'Migrate Google Drive files and sharing permissions',
    automationApproach: 'Transfer files maintaining folder structure and permissions',
    apisUsed: ['Drive API > files.list()', 'Drive API > files.copy()', 'Drive API > permissions'],
    status: 'pending',
    progress: 0,
    estimatedDuration: '1-4 hours'
  },
  {
    id: 'calendar-migration',
    title: '📅 Calendar Migration',
    description: 'Migrate calendar events and settings',
    automationApproach: 'Export and import calendar data with attendee updates',
    apisUsed: ['Calendar API > events.list()', 'Calendar API > events.insert()'],
    status: 'pending',
    progress: 0,
    estimatedDuration: '30-60 minutes'
  }
];

// Scenario 2: Cross-Tenant Steps
export const CROSS_TENANT_STEPS: MigrationStep[] = [
  {
    id: 'auth-and-domains',
    title: '🔐 Authenticate & Configure Domains',
    description: 'Authenticate with both source and target domains and configure domain mappings',
    automationApproach: 'Secure OAuth 2.0 flow for cross-tenant access with automatic domain discovery and mapping',
    apisUsed: ['Google OAuth 2.0', 'Google Identity API', 'AdminSDK > Domains.list()'],
    status: 'pending',
    progress: 0,
    estimatedDuration: '5-10 minutes'
  },
  {
    id: 'source-user-discovery',
    title: '🔍 Source User Discovery',
    description: 'Discover users in source workspace before cross-tenant migration',
    automationApproach: 'Enumerate source tenant users with appropriate service account',
    apisUsed: ['AdminSDK > Users.list()', 'AdminSDK > Users.get()'],
    status: 'pending',
    progress: 0,
    estimatedDuration: '3-5 minutes'
  },
  {
    id: 'target-user-creation',
    title: '👥 Target User Creation',
    description: 'Create corresponding users in target workspace',
    automationApproach: 'Replicate user structure in destination tenant',
    apisUsed: ['AdminSDK > Users.insert()'],
    status: 'pending',
    progress: 0,
    estimatedDuration: '5-15 minutes'
  },
  {
    id: 'cross-tenant-data-migration',
    title: '🔄 Cross-Tenant Data Migration',
    description: 'Migrate data between separate Google Workspace accounts',
    automationApproach: 'Secure intermediate storage for cross-tenant transfer',
    apisUsed: ['Gmail API', 'Drive API', 'Calendar API', 'Cloud Storage'],
    status: 'pending',
    progress: 0,
    estimatedDuration: '4-12 hours'
  }
];

// Helper functions
export function createMigrationScenario(
  type: MigrationScenario,
  config: Partial<MigrationScenarioConfig>
): MigrationScenarioConfig {
  const baseSteps = type === 'single-super-admin' ? SINGLE_SUPER_ADMIN_STEPS : CROSS_TENANT_STEPS;
  
  const scenario: MigrationScenarioConfig = {
    type,
    ...config,
    steps: baseSteps.map(step => ({ ...step })) // Deep clone steps
  } as MigrationScenarioConfig;

  return scenario;
}

export function getScenarioDescription(type: MigrationScenario): string {
  switch (type) {
    case 'single-super-admin':
      return 'Map and migrate data between two domains under the same Google Workspace account';
    case 'cross-tenant':
      return 'Fully migrate data between two separate Google Workspace accounts/domains';
    default:
      return 'Unknown migration scenario';
  }
}

export function getEstimatedTotalDuration(steps: MigrationStep[]): string {
  const scenarios = {
    'single-super-admin': '4-12 hours + ongoing delta sync',
    'cross-tenant': '6-18 hours + ongoing delta sync'
  };

  if (steps.length === SINGLE_SUPER_ADMIN_STEPS.length) {
    return scenarios['single-super-admin'];
  } else if (steps.length === CROSS_TENANT_STEPS.length) {
    return scenarios['cross-tenant'];
  }

  return 'Variable duration based on data volume and complexity';
}

export function getComplexityRating(type: MigrationScenario, mappingType?: DomainMappingType): 'Low' | 'Medium' | 'High' | 'Very High' {
  // Base complexity from scenario type
  let baseComplexity: 'Low' | 'Medium' | 'High' | 'Very High';
  
  switch (type) {
    case 'single-super-admin':
      baseComplexity = 'Low';
      break;
    case 'cross-tenant':
      baseComplexity = 'High';
      break;
    default:
      baseComplexity = 'Medium';
  }

  // Adjust complexity based on domain mapping type
  if (mappingType) {
    const mappingOption = DOMAIN_MAPPING_OPTIONS.find(option => option.type === mappingType);
    if (mappingOption) {
      // If mapping complexity is higher than base, use mapping complexity
      const complexityLevels = { 'Low': 1, 'Medium': 2, 'High': 3, 'Very High': 4 };
      const baseLevel = complexityLevels[baseComplexity];
      const mappingLevel = complexityLevels[mappingOption.complexity];
      
      if (mappingLevel > baseLevel) {
        return mappingOption.complexity;
      }
    }
  }

  return baseComplexity;
}

// Domain Mapping Types and Configurations
export type DomainMappingType = 
  | 'one-to-one'
  | 'one-to-many' 
  | 'many-to-one'
  | 'cross-tenant-single'
  | 'cross-tenant-multi-target'
  | 'cross-tenant-multi-source';

export interface DomainMappingOption {
  type: DomainMappingType;
  title: string;
  description: string;
  icon: string;
  complexity: 'Low' | 'Medium' | 'High' | 'Very High';
  supportedScenarios: MigrationScenario[];
  requiresConflictHandling?: boolean;
  example?: string;
}

export interface DomainMappingConfig {
  type: DomainMappingType;
  sourceDomains: string[];
  targetDomain?: string;
  targetDomains?: string[];
  multiTargetConfig?: TargetDomainConfig[];
  userMappingStrategy?: 'automatic' | 'manual' | 'hybrid';
  preserveStructure?: boolean;
  allowCrossTenant?: boolean;
  distributionStrategy?: 'round-robin' | 'by-department' | 'by-location' | 'custom';
  consolidationStrategy?: 'merge-all' | 'selective-merge' | 'priority-based';
  preserveSourceAsAlias?: boolean;
  conflictResolution?: 'prefix' | 'suffix' | 'manual';
  description?: string;
}

export interface MultiTargetDomainConfig {
  type: 'one-to-many' | 'cross-tenant-multi-target';
  sourceDomain: string;
  targetDomains: Array<{
    domain: string;
    userMappings: Array<{
      sourceUser: string;
      targetUser: string;
    }>;
    priority: number;
    capacity?: number;
  }>;
  distributionRules: {
    strategy: 'round-robin' | 'by-department' | 'by-location' | 'custom';
    customRules?: Array<{
      condition: string;
      targetDomain: string;
    }>;
  };
}

export interface MultiSourceDomainConfig {
  type: 'many-to-one' | 'cross-tenant-multi-source';
  sourceDomains: Array<{
    domain: string;
    userMappings: Array<{
      sourceUser: string;
      targetUser: string;
    }>;
    priority: number;
    migrationOrder?: number;
  }>;
  targetDomain: string;
  consolidationRules: {
    strategy: 'merge-all' | 'selective-merge' | 'priority-based';
    conflictResolution: 'source-priority' | 'target-priority' | 'manual-review';
    usernamePrefixStrategy?: 'domain-prefix' | 'department-prefix' | 'custom';
  };
}

export const DOMAIN_MAPPING_OPTIONS: DomainMappingOption[] = [
  {
    type: 'one-to-one',
    title: 'One-to-One Domain Migration',
    description: 'Migrate from one source domain to one target domain with direct user mapping',
    icon: 'ArrowRight',
    complexity: 'Low',
    supportedScenarios: ['single-super-admin'],
    example: 'oldcompany.com → newcompany.com'
  },
  {
    type: 'one-to-many',
    title: 'Multi-Target Domain Migration',
    description: 'Migrate from one source domain to multiple target domains with distributed user mapping',
    icon: 'GitBranch',
    complexity: 'Medium',
    supportedScenarios: ['single-super-admin'],
    requiresConflictHandling: true,
    example: 'company.com → dept1.com, dept2.com'
  },
  {
    type: 'many-to-one',
    title: 'Multi-Source Domain Migration',
    description: 'Consolidate multiple source domains into one target domain with merged user mapping',
    icon: 'GitMerge',
    complexity: 'Medium',
    supportedScenarios: ['single-super-admin'],
    requiresConflictHandling: true,
    example: 'old1.com, old2.com → newcompany.com'
  },
  {
    type: 'cross-tenant-single',
    title: 'Cross-Tenant Single Domain',
    description: 'Migrate between different Google Workspace tenants with single domain mapping',
    icon: 'Building',
    complexity: 'High',
    supportedScenarios: ['cross-tenant'],
    example: 'source-tenant.com → target-tenant.com'
  },
  {
    type: 'cross-tenant-multi-target',
    title: 'Cross-Tenant Multi-Target',
    description: 'Migrate from one source tenant domain to multiple target tenant domains',
    icon: 'Network',
    complexity: 'Very High',
    supportedScenarios: ['cross-tenant'],
    requiresConflictHandling: true,
    example: 'source.com → target1.com, target2.com'
  },
  {
    type: 'cross-tenant-multi-source',
    title: 'Cross-Tenant Multi-Source',
    description: 'Consolidate multiple source tenant domains into one target tenant domain',
    icon: 'Combine',
    complexity: 'Very High',
    supportedScenarios: ['cross-tenant'],
    requiresConflictHandling: true,
    example: 'source1.com, source2.com → target.com'
  }
];

export function getSupportedMappingTypes(scenario: MigrationScenario): DomainMappingOption[] {
  return DOMAIN_MAPPING_OPTIONS.filter(option => 
    option.supportedScenarios.includes(scenario)
  );
}

export function getDomainMappingDescription(mappingType: DomainMappingType): string {
  const option = DOMAIN_MAPPING_OPTIONS.find(opt => opt.type === mappingType);
  return option?.description || 'Unknown mapping type';
}

export function isMultiTargetMapping(mappingType: DomainMappingType): boolean {
  return mappingType === 'one-to-many' || mappingType === 'cross-tenant-multi-target';
}

export function isMultiSourceMapping(mappingType: DomainMappingType): boolean {
  return mappingType === 'many-to-one' || mappingType === 'cross-tenant-multi-source';
}

export function isCrossTenantMapping(mappingType: DomainMappingType): boolean {
  return mappingType.startsWith('cross-tenant');
}

export function validateDomainMappingConfig(
  scenario: MigrationScenario, 
  mappingType: DomainMappingType
): boolean {
  const supportedTypes = getSupportedMappingTypes(scenario);
  return supportedTypes.some(option => option.type === mappingType);
}

export function getAvailableTargetDomains(
  allDomains: Array<{ domainName: string; isPrimary?: boolean; verified?: boolean }>,
  selectedSourceDomains: string[],
  excludeTargetDomains?: string[]
): Array<{ domainName: string; isPrimary?: boolean; verified?: boolean }> {
  const excludedDomains = new Set([
    ...selectedSourceDomains.filter(d => d.trim() !== ''),
    ...(excludeTargetDomains || []).filter(d => d.trim() !== '')
  ]);
  
  return allDomains.filter(domain => !excludedDomains.has(domain.domainName));
}

export function getAvailableSourceDomains(
  allDomains: Array<{ domainName: string; isPrimary?: boolean; verified?: boolean }>,
  selectedTargetDomains: string[],
  excludeSourceDomains?: string[]
): Array<{ domainName: string; isPrimary?: boolean; verified?: boolean }> {
  const excludedDomains = new Set([
    ...selectedTargetDomains.filter(d => d.trim() !== ''),
    ...(excludeSourceDomains || []).filter(d => d.trim() !== '')
  ]);
  
  return allDomains.filter(domain => !excludedDomains.has(domain.domainName));
}

export function validateNoDomainConflicts(
  sourceDomains: string[],
  targetDomains: string[]
): { isValid: boolean; conflicts: string[] } {
  const sources = new Set(sourceDomains.filter(d => d.trim() !== ''));
  const targets = new Set(targetDomains.filter(d => d.trim() !== ''));
  
  const conflicts: string[] = [];
  
  sources.forEach(domain => {
    if (targets.has(domain)) {
      conflicts.push(domain);
    }
  });
  
  return {
    isValid: conflicts.length === 0,
    conflicts
  };
}
