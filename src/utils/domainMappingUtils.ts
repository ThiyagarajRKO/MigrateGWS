import type { DomainMappingConfig, TargetDomainConfig } from '../types/migration-scenarios';

/**
 * Utility functions to create properly formatted domain mapping configurations
 */

export interface CreateDomainMappingOptions {
  sourceDomains: string[];
  targetDomains: string[];
  migrationScenario?: 'single-super-admin' | 'cross-tenant';
  distributionStrategy?: 'round-robin' | 'by-department' | 'by-location' | 'custom';
  conflictResolution?: 'prefix' | 'suffix' | 'manual';
  preserveGroups?: boolean;
  emailForwarding?: boolean;
  preserveSourceAsAlias?: boolean;
  description?: string;
}

/**
 * Create a one-to-one domain mapping configuration
 */
export function createOneToOneDomainMapping(
  sourceDomain: string,
  targetDomain: string,
  options: Partial<CreateDomainMappingOptions> = {}
): DomainMappingConfig {
  return {
    type: options.migrationScenario === 'cross-tenant' ? 'cross-tenant-single' : 'one-to-one',
    sourceDomains: [sourceDomain],
    targetDomains: [targetDomain],
    userMappingStrategy: 'manual',
    preserveSourceAsAlias: options.preserveSourceAsAlias ?? true,
    allowCrossTenant: options.migrationScenario === 'cross-tenant',
    preserveStructure: true,
    conflictResolution: options.conflictResolution ?? 'prefix',
    description: options.description ?? `One-to-one migration from ${sourceDomain} to ${targetDomain}`
  };
}

/**
 * Create a one-to-many domain mapping configuration
 */
export function createOneToManyDomainMapping(
  sourceDomain: string,
  targetDomains: string[],
  options: Partial<CreateDomainMappingOptions> = {}
): DomainMappingConfig {
  const multiTargetConfig: TargetDomainConfig[] = targetDomains.map(domain => ({
    domain,
    conflictResolution: options.conflictResolution ?? 'prefix',
    preserveGroups: options.preserveGroups ?? true,
    emailForwarding: options.emailForwarding ?? false,
    userMappings: []
  }));

  return {
    type: options.migrationScenario === 'cross-tenant' ? 'cross-tenant-multi-target' : 'one-to-many',
    sourceDomains: [sourceDomain],
    targetDomains,
    multiTargetConfig,
    userMappingStrategy: 'manual',
    distributionStrategy: options.distributionStrategy ?? 'round-robin',
    preserveSourceAsAlias: options.preserveSourceAsAlias ?? true,
    allowCrossTenant: options.migrationScenario === 'cross-tenant',
    preserveStructure: true,
    conflictResolution: options.conflictResolution ?? 'prefix',
    description: options.description ?? `One-to-many migration from ${sourceDomain} to ${targetDomains.length} target domains`
  };
}

/**
 * Create a many-to-one domain mapping configuration
 */
export function createManyToOneDomainMapping(
  sourceDomains: string[],
  targetDomain: string,
  options: Partial<CreateDomainMappingOptions> = {}
): DomainMappingConfig {
  return {
    type: options.migrationScenario === 'cross-tenant' ? 'cross-tenant-multi-source' : 'many-to-one',
    sourceDomains,
    targetDomains: [targetDomain],
    userMappingStrategy: 'manual',
    consolidationStrategy: 'merge-all',
    preserveSourceAsAlias: options.preserveSourceAsAlias ?? true,
    allowCrossTenant: options.migrationScenario === 'cross-tenant',
    preserveStructure: false, // Structure changes when consolidating multiple domains
    conflictResolution: options.conflictResolution ?? 'prefix',
    description: options.description ?? `Many-to-one migration from ${sourceDomains.length} source domains to ${targetDomain}`
  };
}

/**
 * Create domain mapping for your specific configuration (from the image)
 * Source: rrgokuldham.com
 * Targets: sample.arakutourism.net, migrate.arakutourism.net
 */
export function createYourDomainMapping(): DomainMappingConfig {
  return createOneToManyDomainMapping(
    'rrgokuldham.com',
    ['sample.arakutourism.net', 'migrate.arakutourism.net'],
    {
      migrationScenario: 'single-super-admin',
      distributionStrategy: 'round-robin',
      conflictResolution: 'prefix',
      preserveGroups: true,
      emailForwarding: false,
      preserveSourceAsAlias: true,
      description: 'Migration from rrgokuldham.com to multiple arakutourism.net domains'
    }
  );
}

/**
 * Validate domain mapping configuration
 */
export function validateDomainMapping(domainMapping: DomainMappingConfig): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required fields
  if (!domainMapping.type) {
    errors.push('Domain mapping type is required');
  }

  if (!domainMapping.sourceDomains || domainMapping.sourceDomains.length === 0) {
    errors.push('At least one source domain is required');
  }

  if (!domainMapping.targetDomains || domainMapping.targetDomains.length === 0) {
    errors.push('At least one target domain is required');
  }

  // Validate domain formats
  const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
  
  domainMapping.sourceDomains?.forEach(domain => {
    if (!domainRegex.test(domain)) {
      errors.push(`Invalid source domain format: ${domain}`);
    }
  });

  domainMapping.targetDomains?.forEach(domain => {
    if (!domainRegex.test(domain)) {
      errors.push(`Invalid target domain format: ${domain}`);
    }
  });

  // Check for domain conflicts
  const allDomains = [
    ...(domainMapping.sourceDomains || []),
    ...(domainMapping.targetDomains || [])
  ];
  const uniqueDomains = new Set(allDomains);
  
  if (allDomains.length !== uniqueDomains.size) {
    errors.push('Duplicate domains found in source and target lists');
  }

  // Validate multiTargetConfig if present
  if (domainMapping.multiTargetConfig) {
    domainMapping.multiTargetConfig.forEach((config, index) => {
      if (!config.domain) {
        errors.push(`Multi-target config ${index}: domain is required`);
      } else if (!domainMapping.targetDomains?.includes(config.domain)) {
        warnings.push(`Multi-target config ${index}: domain ${config.domain} not found in targetDomains`);
      }
    });
  }

  // Type-specific validations
  if (domainMapping.type === 'one-to-many' && (!domainMapping.targetDomains || domainMapping.targetDomains.length < 2)) {
    warnings.push('One-to-many mapping should have multiple target domains');
  }

  if (domainMapping.type === 'many-to-one' && (!domainMapping.sourceDomains || domainMapping.sourceDomains.length < 2)) {
    warnings.push('Many-to-one mapping should have multiple source domains');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Get recommended settings based on domain mapping type and scenario
 */
export function getRecommendedSettings(
  mappingType: DomainMappingConfig['type'],
  migrationScenario: 'single-super-admin' | 'cross-tenant'
): Partial<DomainMappingConfig> {
  const baseSettings = {
    userMappingStrategy: 'manual' as const,
    preserveStructure: true,
    conflictResolution: 'prefix' as const
  };

  switch (mappingType) {
    case 'one-to-one':
    case 'cross-tenant-single':
      return {
        ...baseSettings,
        distributionStrategy: undefined, // Not needed for one-to-one
        consolidationStrategy: undefined
      };

    case 'one-to-many':
    case 'cross-tenant-multi-target':
      return {
        ...baseSettings,
        distributionStrategy: 'round-robin' as const,
        preserveSourceAsAlias: true
      };

    case 'many-to-one':
    case 'cross-tenant-multi-source':
      return {
        ...baseSettings,
        consolidationStrategy: 'merge-all' as const,
        preserveStructure: false, // Structure changes when consolidating
        conflictResolution: 'prefix' as const
      };

    default:
      return baseSettings;
  }
}

// Export example configurations
export const EXAMPLE_CONFIGURATIONS = {
  // Your specific configuration
  yourConfiguration: createYourDomainMapping(),
  
  // Other examples
  simpleOneToOne: createOneToOneDomainMapping('old-company.com', 'new-company.com'),
  
  crossTenantOneToOne: createOneToOneDomainMapping(
    'source-company.com', 
    'target-company.com',
    { migrationScenario: 'cross-tenant' }
  ),
  
  departmentSplit: createOneToManyDomainMapping(
    'company.com',
    ['engineering.company.com', 'sales.company.com', 'marketing.company.com'],
    { distributionStrategy: 'by-department' }
  ),
  
  companyMerger: createManyToOneDomainMapping(
    ['company-a.com', 'company-b.com', 'company-c.com'],
    'merged-company.com',
    { conflictResolution: 'suffix' }
  )
};
