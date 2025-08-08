// Domain mapping adapter for seamless value passing
import { DomainMapping, DomainMappingBuilder, DomainMappingUIState, validateDomainMapping } from '@/types/domainMapping';

export class DomainMappingAdapter {
  private mapping: DomainMapping = {};

  constructor(input?: DomainMapping | DomainMappingUIState | string) {
    if (!input) {
      this.mapping = {};
    } else if (typeof input === 'string') {
      // Handle JSON string input
      try {
        this.mapping = JSON.parse(input);
      } catch {
        throw new Error('Invalid JSON string for domain mapping');
      }
    } else if ('sourceDomain' in input && 'targetDomains' in input && 'strategy' in input) {
      // Handle UI state input
      this.mapping = DomainMappingBuilder.fromUIState(input).buildMapping();
    } else {
      // Handle direct mapping input
      this.mapping = { ...input as DomainMapping };
    }
  }

  // Static factory methods for easy creation
  static fromUI(uiState: DomainMappingUIState): DomainMappingAdapter {
    return new DomainMappingAdapter(uiState);
  }

  static fromMapping(mapping: DomainMapping): DomainMappingAdapter {
    return new DomainMappingAdapter(mapping);
  }

  static fromJSON(jsonString: string): DomainMappingAdapter {
    return new DomainMappingAdapter(jsonString);
  }

  // Your specific scenario
  static rrgokuldhamScenario(): DomainMappingAdapter {
    return new DomainMappingAdapter({
      "rrgokuldham.com": [
        "sample.arakutourism.net",
        "migrate.arakutourism.net"
      ]
    });
  }

  // Quick builders
  static oneToMany(source: string, targets: string[]): DomainMappingAdapter {
    return new DomainMappingAdapter({ [source]: targets });
  }

  static oneToOne(source: string, target: string): DomainMappingAdapter {
    return new DomainMappingAdapter({ [source]: [target] });
  }

  static manyToOne(sources: string[], target: string): DomainMappingAdapter {
    const mapping: DomainMapping = {};
    sources.forEach(source => {
      mapping[source] = [target];
    });
    return new DomainMappingAdapter(mapping);
  }

  // Validation
  validate(): { isValid: boolean; errors: string[] } {
    try {
      validateDomainMapping(this.mapping);
      return { isValid: true, errors: [] };
    } catch (error) {
      return { 
        isValid: false, 
        errors: [error instanceof Error ? error.message : 'Unknown validation error'] 
      };
    }
  }

  // Getters
  getMapping(): DomainMapping {
    return { ...this.mapping };
  }

  getSourceDomains(): string[] {
    return Object.keys(this.mapping);
  }

  getTargetDomains(): string[] {
    return [...new Set(Object.values(this.mapping).flat())];
  }

  getAllDomains(): string[] {
    return [...this.getSourceDomains(), ...this.getTargetDomains()];
  }

  // Get migration pairs for processing
  getMigrationPairs(): Array<{ source: string; targets: string[] }> {
    return Object.entries(this.mapping).map(([source, targets]) => ({
      source,
      targets: [...targets]
    }));
  }

  // Check if domain is source/target
  isSourceDomain(domain: string): boolean {
    return domain in this.mapping;
  }

  isTargetDomain(domain: string): boolean {
    return Object.values(this.mapping).some(targets => targets.includes(domain));
  }

  // Get targets for specific source
  getTargetsForSource(sourceDomain: string): string[] {
    return this.mapping[sourceDomain] || [];
  }

  // Convert to different formats
  toUIState(): DomainMappingUIState {
    const sources = this.getSourceDomains();
    const sourceDomain = sources[0] || '';
    const targetDomains = this.mapping[sourceDomain] || this.getTargetDomains();
    
    // Auto-detect strategy
    let strategy: DomainMappingUIState['strategy'] = 'one-to-many';
    if (sources.length === 1 && targetDomains.length === 1) {
      strategy = 'one-to-one';
    } else if (sources.length > 1 && this.getTargetDomains().length === 1) {
      strategy = 'many-to-one';
    }
    
    return {
      strategy,
      sourceDomain,
      targetDomains
    };
  }

  toJSON(): string {
    return JSON.stringify(this.mapping);
  }

  // Utility methods for component integration
  isEmpty(): boolean {
    return Object.keys(this.mapping).length === 0;
  }

  size(): number {
    return Object.keys(this.mapping).length;
  }

  // Add new mappings
  addMapping(source: string, targets: string[]): DomainMappingAdapter {
    this.mapping[source] = [...targets];
    return this;
  }

  removeMapping(source: string): DomainMappingAdapter {
    delete this.mapping[source];
    return this;
  }

  // Clone
  clone(): DomainMappingAdapter {
    return new DomainMappingAdapter(this.mapping);
  }

  // Debug information
  getDebugInfo(): object {
    return {
      mapping: this.mapping,
      sourceDomains: this.getSourceDomains(),
      targetDomains: this.getTargetDomains(),
      migrationPairs: this.getMigrationPairs(),
      validation: this.validate(),
      uiState: this.toUIState(),
      json: this.toJSON()
    };
  }
}

// Usage examples and utilities
export const DomainMappingUtils = {
  // Create adapter from any input
  create: (input?: any): DomainMappingAdapter => {
    return new DomainMappingAdapter(input);
  },

  // Validate any input format
  validate: (input: any): boolean => {
    try {
      const adapter = new DomainMappingAdapter(input);
      return adapter.validate().isValid;
    } catch {
      return false;
    }
  },

  // Convert between formats
  convertToMapping: (input: any): DomainMapping => {
    return new DomainMappingAdapter(input).getMapping();
  },

  convertToUIState: (input: any): DomainMappingUIState => {
    return new DomainMappingAdapter(input).toUIState();
  },

  // Quick creation methods
  createFromUI: (sourceDomain: string, targetDomains: string[], strategy = 'one-to-many'): DomainMappingAdapter => {
    return DomainMappingAdapter.fromUI({
      strategy: strategy as DomainMappingUIState['strategy'],
      sourceDomain,
      targetDomains
    });
  }
};
