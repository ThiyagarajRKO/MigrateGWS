// Migration scenario types and configuration

export type MigrationScenario = 'single-super-admin' | 'cross-tenant';

// Domain mapping types
export type DomainMappingType = 'one-to-one' | 'one-to-many' | 'many-to-one' | 'subdomain';

export interface DomainMappingConfig {
  type: DomainMappingType;
  sourceDomains: string[];
  targetDomain: string;
  targetDomains?: string[]; // For one-to-many scenarios
  preserveSourceAsAlias?: boolean;
  conflictResolution?: 'prefix' | 'suffix' | 'manual';
  distributionRule?: 'department' | 'alphabetical' | 'custom'; // For one-to-many
  description: string;
}

export interface DomainMappingOption {
  type: DomainMappingType;
  title: string;
  description: string;
  example: string;
  advantages: string[];
  considerations: string[];
  complexity: 'Low' | 'Medium' | 'High';
  requiresConflictHandling: boolean;
  supportedScenarios: MigrationScenario[];
}

export interface MigrationStep {
  id: string;
  title: string;
  description: string;
  automationApproach: string;
  apisUsed: string[];
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  progress: number;
  estimatedDuration?: string;
  actualDuration?: string;
}

export interface SingleSuperAdminScenario {
  type: 'single-super-admin';
  goal: 'Map and migrate data between two domains under the same Google Workspace account';
  superAdminEmail: string;
  sourceDomain: string;
  targetDomain: string;
  steps: MigrationStep[];
}

export interface CrossTenantScenario {
  type: 'cross-tenant';
  goal: 'Fully migrate data between two separate Google Workspace accounts/domains';
  sourceAdminEmail: string;
  targetAdminEmail: string;
  sourceDomain: string;
  targetDomain: string;
  steps: MigrationStep[];
}

export type MigrationScenarioConfig = SingleSuperAdminScenario | CrossTenantScenario;

// Scenario 1: Single Super Admin (Multi-Domain) Steps
export const SINGLE_SUPER_ADMIN_STEPS: MigrationStep[] = [
  {
    id: 'oauth-scopes',
    title: '🔐 OAuth & Scopes',
    description: 'Authenticate as Super Admin with domain-wide delegation',
    automationApproach: 'Admin SDK + OAuth2 with required scopes',
    apisUsed: ['Admin SDK', 'Drive API', 'Gmail API', 'Calendar API'],
    status: 'pending',
    progress: 0,
    estimatedDuration: '2-3 minutes'
  },
  {
    id: 'fetch-domains',
    title: '📄 Fetch All Domains',
    description: 'List all verified domains under the admin account',
    automationApproach: 'AdminSDK > Domains.list()',
    apisUsed: ['Admin SDK'],
    status: 'pending',
    progress: 0,
    estimatedDuration: '30 seconds'
  },
  {
    id: 'user-discovery',
    title: '👤 User Discovery',
    description: 'List all users in source domain',
    automationApproach: 'Filter by email ending with @domain.com',
    apisUsed: ['AdminSDK > Users.list()'],
    status: 'pending',
    progress: 0,
    estimatedDuration: '1-2 minutes'
  },
  {
    id: 'smart-mapping',
    title: '🗺️ Smart Mapping Engine',
    description: 'Apply mapping rule like user@domain1.com → user@domain2.com',
    automationApproach: 'Auto, pattern, or CSV-based mapping',
    apisUsed: ['Custom logic'],
    status: 'pending',
    progress: 0,
    estimatedDuration: '5-10 minutes'
  },
  {
    id: 'gmail-migration',
    title: '📨 Gmail Migration',
    description: 'Fetch messages via source domain, insert into target domain',
    automationApproach: 'Use impersonation & Gmail API',
    apisUsed: ['Gmail API'],
    status: 'pending',
    progress: 0,
    estimatedDuration: '2-6 hours'
  },
  {
    id: 'drive-migration',
    title: '📁 Drive Migration',
    description: 'List + copy Drive files with permissions to target',
    automationApproach: 'Preserve hierarchy and access control',
    apisUsed: ['Drive API'],
    status: 'pending',
    progress: 0,
    estimatedDuration: '1-4 hours'
  },
  {
    id: 'calendar-contacts',
    title: '📅 Calendar & Contacts',
    description: 'Export → Import with adjusted attendee addresses',
    automationApproach: 'Replace references of old domain',
    apisUsed: ['Calendar API', 'People API'],
    status: 'pending',
    progress: 0,
    estimatedDuration: '30 minutes - 1 hour'
  },
  {
    id: 'delta-migration',
    title: '🔄 Delta Migration',
    description: 'Use historyId and modifiedTime to sync changes',
    automationApproach: 'Scheduled cron job or webhook',
    apisUsed: ['Gmail history.list()', 'Drive modifiedTime'],
    status: 'pending',
    progress: 0,
    estimatedDuration: 'Ongoing'
  }
];

// Scenario 2: Cross-Tenant Migration Steps
export const CROSS_TENANT_STEPS: MigrationStep[] = [
  {
    id: 'dual-auth',
    title: '🔐 Dual Super Admin Auth',
    description: 'Collect OAuth tokens from both source & destination Super Admins',
    automationApproach: 'Enforce admin-only scope usage',
    apisUsed: ['OAuth2 + Admin SDK'],
    status: 'pending',
    progress: 0,
    estimatedDuration: '5-10 minutes'
  },
  {
    id: 'domain-enumeration',
    title: '📄 Domain & User Enumeration',
    description: 'Get users from source domain; suggest user mapping to target domain',
    automationApproach: 'Via email pattern or manual mapping UI',
    apisUsed: ['AdminSDK > Users.list()'],
    status: 'pending',
    progress: 0,
    estimatedDuration: '2-5 minutes'
  },
  {
    id: 'cross-domain-mapping',
    title: '🗺️ Cross-domain Mapping Rules',
    description: 'Auto-fill or let admin map (john@abc.com → j.smith@xyz.com)',
    automationApproach: 'Smart mapping UI or CSV import',
    apisUsed: ['Custom logic'],
    status: 'pending',
    progress: 0,
    estimatedDuration: '10-30 minutes'
  },
  {
    id: 'data-extraction',
    title: '📤 Data Extraction',
    description: 'Export Gmail, Drive, Calendar, Contacts using impersonation',
    automationApproach: 'Write data to intermediate encrypted Object Store',
    apisUsed: ['Gmail API', 'Drive API', 'Calendar API', 'People API'],
    status: 'pending',
    progress: 0,
    estimatedDuration: '2-8 hours'
  },
  {
    id: 'data-injection',
    title: '📥 Data Injection',
    description: 'Re-insert content into destination domain via impersonation',
    automationApproach: 'Track content types separately',
    apisUsed: ['Gmail API', 'Drive API', 'Calendar API', 'People API'],
    status: 'pending',
    progress: 0,
    estimatedDuration: '2-8 hours'
  },
  {
    id: 'delta-reconciliation',
    title: '🔁 Delta + Reconciliation',
    description: 'Handle in-flight data via Gmail historyId and Drive change tracking',
    automationApproach: 'Scheduled follow-up job or webhook',
    apisUsed: ['Gmail history APIs', 'Drive history APIs'],
    status: 'pending',
    progress: 0,
    estimatedDuration: 'Ongoing'
  },
  {
    id: 'validation',
    title: '🧪 Validation',
    description: 'Cross-check item count, quota usage, permission status',
    automationApproach: 'Flag partial/incomplete objects',
    apisUsed: ['Reports API', 'internal checks'],
    status: 'pending',
    progress: 0,
    estimatedDuration: '30 minutes - 1 hour'
  },
  {
    id: 'cleanup',
    title: '🛑 Optional Cleanup',
    description: 'Option to suspend users in old domain or delete data after success',
    automationApproach: 'Admin SDK + configurable toggle',
    apisUsed: ['AdminSDK > Users.update()'],
    status: 'pending',
    progress: 0,
    estimatedDuration: '15-30 minutes'
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
  
  // This is a simplified estimation - in reality you'd parse the individual step durations
  if (steps.length === SINGLE_SUPER_ADMIN_STEPS.length) {
    return scenarios['single-super-admin'];
  } else {
    return scenarios['cross-tenant'];
  }
}

// Migration status tracking
export interface MigrationStatus {
  id: string;
  scenarioType: MigrationScenario;
  currentStep: string;
  overallProgress: number;
  startTime: string;
  estimatedCompletion?: string;
  actualCompletion?: string;
  status: 'planning' | 'running' | 'paused' | 'completed' | 'failed';
  errors: Array<{
    step: string;
    message: string;
    timestamp: string;
    resolved: boolean;
  }>;
}

// Domain mapping options
export const DOMAIN_MAPPING_OPTIONS: DomainMappingOption[] = [
  {
    type: 'one-to-one',
    title: 'One-to-One Mapping',
    description: 'Same username, different domain - most common scenario',
    example: 'alice@oldcompany.com → alice@newcompany.com',
    advantages: [
      'Simple and straightforward',
      'Users keep familiar usernames',
      'No conflict resolution needed',
      'Easy to communicate to users'
    ],
    considerations: [
      'Requires MX record switch',
      'Reapplication of file/email sharing settings',
      'DNS propagation time',
      'User notification required'
    ],
    complexity: 'Low',
    requiresConflictHandling: false,
    supportedScenarios: ['single-super-admin', 'cross-tenant']
  },
  {
    type: 'one-to-many',
    title: 'One-to-Many Domain Distribution',
    description: 'Distribute users from single source domain to multiple target domains',
    example: 'user@company.com → user@division1.com, user@division2.com',
    advantages: [
      'Organizational restructuring support',
      'Division-specific domain assignment',
      'Improved brand segmentation',
      'Flexible user distribution rules'
    ],
    considerations: [
      'Complex user assignment logic required',
      'Multiple domain management overhead',
      'User communication complexity',
      'Cross-domain collaboration setup'
    ],
    complexity: 'High',
    requiresConflictHandling: false,
    supportedScenarios: ['single-super-admin', 'cross-tenant']
  },
  {
    type: 'many-to-one',
    title: 'Many-to-One Domain Merge',
    description: 'Multiple source domains consolidated into single destination',
    example: 'user@brandA.com, user@brandB.com → user@mainbrand.com',
    advantages: [
      'Domain consolidation',
      'Simplified management',
      'Cost optimization',
      'Unified brand identity'
    ],
    considerations: [
      'Duplicate username conflicts',
      'Group policy review and merge',
      'Complex user communication',
      'Potential data conflicts'
    ],
    complexity: 'High',
    requiresConflictHandling: true,
    supportedScenarios: ['single-super-admin', 'cross-tenant']
  },
  {
    type: 'subdomain',
    title: 'Subdomain Mapping',
    description: 'Map from subdomain to main domain or different structure',
    example: 'user@sub.olddomain.com → user@newdomain.com',
    advantages: [
      'Organizational restructuring',
      'Simplified domain hierarchy',
      'Better DNS management',
      'Cleaner email addresses'
    ],
    considerations: [
      'Custom routing/DNS configuration',
      'Multi-tenant setup complexity',
      'Email forwarding rules',
      'Subdomain deprecation planning'
    ],
    complexity: 'Medium',
    requiresConflictHandling: false,
    supportedScenarios: ['single-super-admin', 'cross-tenant']
  }
];

// Helper function to get domain mapping option by type
export function getDomainMappingOption(type: DomainMappingType): DomainMappingOption | undefined {
  return DOMAIN_MAPPING_OPTIONS.find(option => option.type === type);
}

// Helper function to get supported mapping types for a scenario
export function getSupportedMappingTypes(scenario: MigrationScenario): DomainMappingOption[] {
  return DOMAIN_MAPPING_OPTIONS.filter(option => 
    option.supportedScenarios.includes(scenario)
  );
}
