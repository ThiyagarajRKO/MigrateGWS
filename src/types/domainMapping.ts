// Redesigned domain mapping types for seamless value passing

export type DomainMapping = Record<string, string[]>;

// Interface for the UI component state
export interface DomainMappingUIState {
  strategy: 'one-to-many' | 'one-to-one' | 'many-to-one' | 'cross-tenant';
  sourceDomain: string;
  targetDomains: string[];
}

// Interface for validation and processing
export interface DomainMappingConfig {
  mapping: DomainMapping;
  strategy: string;
  metadata?: {
    created: Date;
    source: 'ui' | 'config' | 'api' | 'builder';
    userEmail?: string;
  };
}

// Builder class for easy domain mapping creation
export class DomainMappingBuilder {
  private mapping: DomainMapping = {};
  private strategy: string = 'one-to-many';

  static create(): DomainMappingBuilder {
    return new DomainMappingBuilder();
  }

  // Add a one-to-many mapping
  addOneToMany(source: string, targets: string[]): DomainMappingBuilder {
    this.mapping[source] = [...targets];
    this.strategy = 'one-to-many';
    return this;
  }

  // Add a one-to-one mapping
  addOneToOne(source: string, target: string): DomainMappingBuilder {
    this.mapping[source] = [target];
    this.strategy = 'one-to-one';
    return this;
  }

  // Add multiple sources to one target (many-to-one)
  addManyToOne(sources: string[], target: string): DomainMappingBuilder {
    sources.forEach(source => {
      this.mapping[source] = [target];
    });
    this.strategy = 'many-to-one';
    return this;
  }

  // Create from UI state
  static fromUIState(uiState: DomainMappingUIState): DomainMappingBuilder {
    const builder = new DomainMappingBuilder();
    builder.strategy = uiState.strategy;
    
    switch (uiState.strategy) {
      case 'one-to-many':
        builder.addOneToMany(uiState.sourceDomain, uiState.targetDomains);
        break;
      case 'one-to-one':
        builder.addOneToOne(uiState.sourceDomain, uiState.targetDomains[0] || '');
        break;
      case 'many-to-one':
        // For UI, we treat sourceDomain as primary, but this could be extended
        builder.addManyToOne([uiState.sourceDomain], uiState.targetDomains[0] || '');
        break;
      default:
        builder.addOneToMany(uiState.sourceDomain, uiState.targetDomains);
    }
    
    return builder;
  }

  // Create from your existing format
  static fromRecord(record: DomainMapping): DomainMappingBuilder {
    const builder = new DomainMappingBuilder();
    builder.mapping = { ...record };
    
    // Auto-detect strategy
    const sources = Object.keys(record);
    const allTargets = Object.values(record).flat();
    const uniqueTargets = [...new Set(allTargets)];
    
    if (sources.length === 1 && record[sources[0]].length > 1) {
      builder.strategy = 'one-to-many';
    } else if (sources.length === 1 && record[sources[0]].length === 1) {
      builder.strategy = 'one-to-one';
    } else if (sources.length > 1 && uniqueTargets.length === 1) {
      builder.strategy = 'many-to-one';
    } else {
      builder.strategy = 'complex';
    }
    
    return builder;
  }

  // Build the final configuration
  build(): DomainMappingConfig {
    return {
      mapping: { ...this.mapping },
      strategy: this.strategy,
      metadata: {
        created: new Date(),
        source: 'builder'
      }
    };
  }

  // Get just the mapping record
  buildMapping(): DomainMapping {
    return { ...this.mapping };
  }

  // Validate the current mapping
  validate(): boolean {
    try {
      validateDomainMapping(this.mapping);
      return true;
    } catch {
      return false;
    }
  }
}

// Validation function
export function validateDomainMapping(mapping: DomainMapping): void {
  for (const [source, targets] of Object.entries(mapping)) {
    if (!Array.isArray(targets) || targets.length === 0) {
      throw new Error(`No targets defined for source domain: ${source}`);
    }
    
    // Validate domain format
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(source)) {
      throw new Error(`Invalid source domain format: ${source}`);
    }
    
    targets.forEach(target => {
      if (!domainRegex.test(target)) {
        throw new Error(`Invalid target domain format: ${target} for source: ${source}`);
      }
    });
    
    // Check for duplicate targets
    const uniqueTargets = new Set(targets);
    if (uniqueTargets.size !== targets.length) {
      throw new Error(`Duplicate target domains found for source domain: ${source}`);
    }
  }
}

// Helper functions
export function getSourceDomains(mapping: DomainMapping): string[] {
  return Object.keys(mapping);
}

export function getTargetDomains(mapping: DomainMapping): string[] {
  return [...new Set(Object.values(mapping).flat())];
}

export function isValidDomainMapping(mapping: DomainMapping): boolean {
  try {
    validateDomainMapping(mapping);
    return true;
  } catch {
    return false;
  }
}

// Conversion utilities
export function convertToUIState(mapping: DomainMapping): DomainMappingUIState {
  const sources = getSourceDomains(mapping);
  const targets = getTargetDomains(mapping);
  
  // Default to the first source domain
  const sourceDomain = sources[0] || '';
  const targetDomains = mapping[sourceDomain] || targets;
  
  // Auto-detect strategy
  let strategy: DomainMappingUIState['strategy'] = 'one-to-many';
  if (sources.length === 1 && targetDomains.length === 1) {
    strategy = 'one-to-one';
  } else if (sources.length > 1 && [...new Set(Object.values(mapping).flat())].length === 1) {
    strategy = 'many-to-one';
  }
  
  return {
    strategy,
    sourceDomain,
    targetDomains
  };
}

// Preset configurations for common scenarios
export const DomainMappingPresets = {
  // Your specific scenario
  rrgokuldhamToArakutourism: (): DomainMapping => ({
    "rrgokuldham.com": [
      "sample.arakutourism.net",
      "migrate.arakutourism.net"
    ]
  }),

  // Alternative format using builder
  createRrgokuldhamMapping: (): DomainMappingConfig => 
    DomainMappingBuilder
      .create()
      .addOneToMany("rrgokuldham.com", [
        "sample.arakutourism.net",
        "migrate.arakutourism.net"
      ])
      .build(),

  // Single domain migration
  oneToOne: (source: string, target: string): DomainMapping => ({
    [source]: [target]
  }),

  // Multiple sources to single target
  manyToOne: (sources: string[], target: string): DomainMapping => {
    const mapping: DomainMapping = {};
    sources.forEach(source => {
      mapping[source] = [target];
    });
    return mapping;
  }
};
