import { DomainMapping } from '@/types/config'

/**
 * Validates domain mappings to ensure they are properly formatted
 * @param mapping - The domain mapping to validate
 * @throws Error if validation fails
 */
export function validateMappings(mapping: DomainMapping): void {
  if (!mapping || typeof mapping !== 'object') {
    throw new Error('Domain mapping must be a valid object')
  }

  const entries = Object.entries(mapping)
  if (entries.length === 0) {
    throw new Error('Domain mapping cannot be empty')
  }

  for (const [sourceDomain, targetDomains] of entries) {
    // Validate source domain
    if (!sourceDomain || typeof sourceDomain !== 'string' || sourceDomain.trim() === '') {
      throw new Error('Source domain must be a non-empty string')
    }

    if (!isValidDomain(sourceDomain)) {
      throw new Error(`Invalid source domain format: ${sourceDomain}`)
    }

    // Validate target domains
    if (!Array.isArray(targetDomains)) {
      throw new Error(`Target domains for ${sourceDomain} must be an array`)
    }

    if (targetDomains.length === 0) {
      throw new Error(`Target domains for ${sourceDomain} cannot be empty`)
    }

    for (const targetDomain of targetDomains) {
      if (!targetDomain || typeof targetDomain !== 'string' || targetDomain.trim() === '') {
        throw new Error(`Target domain must be a non-empty string for source ${sourceDomain}`)
      }

      if (!isValidDomain(targetDomain)) {
        throw new Error(`Invalid target domain format: ${targetDomain} for source ${sourceDomain}`)
      }
    }
  }
}

/**
 * Extracts all source domains from the domain mapping
 * @param mapping - The domain mapping
 * @returns Array of source domain names
 */
export function getSourceDomains(mapping: DomainMapping): string[] {
  if (!mapping || typeof mapping !== 'object') {
    return []
  }

  return Object.keys(mapping).filter(domain => domain && domain.trim() !== '')
}

/**
 * Extracts all target domains from the domain mapping
 * @param mapping - The domain mapping
 * @returns Array of unique target domain names
 */
export function getTargetDomains(mapping: DomainMapping): string[] {
  if (!mapping || typeof mapping !== 'object') {
    return []
  }

  const allTargets = new Set<string>()
  
  for (const targetDomains of Object.values(mapping)) {
    if (Array.isArray(targetDomains)) {
      targetDomains.forEach(domain => {
        if (domain && domain.trim() !== '') {
          allTargets.add(domain.trim())
        }
      })
    }
  }

  return Array.from(allTargets).sort()
}

/**
 * Gets all unique domains (both source and target) from the mapping
 * @param mapping - The domain mapping
 * @returns Array of all unique domain names
 */
export function getAllDomains(mapping: DomainMapping): string[] {
  const sourceDomains = getSourceDomains(mapping)
  const targetDomains = getTargetDomains(mapping)
  
  const allDomains = new Set([...sourceDomains, ...targetDomains])
  return Array.from(allDomains).sort()
}

/**
 * Checks if a domain mapping represents a one-to-many scenario
 * @param mapping - The domain mapping
 * @returns True if it's a one-to-many mapping
 */
export function isOneToMany(mapping: DomainMapping): boolean {
  const sourceDomains = getSourceDomains(mapping)
  
  // Must have exactly one source domain
  if (sourceDomains.length !== 1) {
    return false
  }
  
  // Check if that single source maps to multiple targets
  const singleSource = sourceDomains[0]
  const targetsForSource = mapping[singleSource]
  
  return Array.isArray(targetsForSource) && targetsForSource.length > 1
}

/**
 * Checks if a domain mapping represents a many-to-one scenario
 * @param mapping - The domain mapping
 * @returns True if it's a many-to-one mapping
 */
export function isManyToOne(mapping: DomainMapping): boolean {
  const sourceDomains = getSourceDomains(mapping)
  
  // Must have multiple source domains
  if (sourceDomains.length <= 1) {
    return false
  }
  
  // Check if all sources map to the same single target
  const allTargets = new Set<string>()
  
  for (const sourceDomain of sourceDomains) {
    const targets = mapping[sourceDomain]
    if (Array.isArray(targets)) {
      // Each source should map to exactly one target for many-to-one
      if (targets.length !== 1) {
        return false
      }
      allTargets.add(targets[0])
    }
  }
  
  // All sources should map to the same single target
  return allTargets.size === 1
}

/**
 * Checks if a domain mapping represents a many-to-many scenario
 * @param mapping - The domain mapping
 * @returns Always false since many-to-many is not supported
 */
export function isManyToMany(mapping: DomainMapping): boolean {
  // Many-to-many is not needed/supported
  return false
}

/**
 * Checks if a domain mapping represents a one-to-one scenario
 * @param mapping - The domain mapping
 * @returns True if it's a one-to-one mapping
 */
export function isOneToOne(mapping: DomainMapping): boolean {
  const sourceDomains = getSourceDomains(mapping)
  
  // Must have exactly one source domain
  if (sourceDomains.length !== 1) {
    return false
  }
  
  // Check if that single source maps to exactly one target
  const singleSource = sourceDomains[0]
  const targetsForSource = mapping[singleSource]
  
  return Array.isArray(targetsForSource) && targetsForSource.length === 1
}

/**
 * Gets the mapping type as a string
 * @param mapping - The domain mapping
 * @returns String describing the mapping type (many-to-many not supported)
 */
export function getMappingType(mapping: DomainMapping): 'one-to-one' | 'one-to-many' | 'many-to-one' | 'unsupported' | 'empty' {
  if (!mapping || Object.keys(mapping).length === 0) {
    return 'empty'
  }

  if (isOneToOne(mapping)) return 'one-to-one'
  if (isOneToMany(mapping)) return 'one-to-many'
  if (isManyToOne(mapping)) return 'many-to-one'
  
  // If none of the supported patterns match, it's unsupported
  return 'unsupported'
}

/**
 * Gets detailed mapping information for analysis
 * @param mapping - The domain mapping
 * @returns Detailed mapping analysis
 */
export function getMappingAnalysis(mapping: DomainMapping): {
  type: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'unsupported' | 'empty';
  sourceDomains: string[];
  targetDomains: string[];
  sourceCount: number;
  targetCount: number;
  mappingDetails: Array<{source: string, targets: string[]}>;
} {
  const sourceDomains = getSourceDomains(mapping)
  const targetDomains = getTargetDomains(mapping)
  const type = getMappingType(mapping)
  
  const mappingDetails = sourceDomains.map(source => ({
    source,
    targets: mapping[source] || []
  }))
  
  return {
    type,
    sourceDomains,
    targetDomains,
    sourceCount: sourceDomains.length,
    targetCount: targetDomains.length,
    mappingDetails
  }
}

/**
 * Basic domain validation using regex
 * @param domain - Domain string to validate
 * @returns True if domain appears to be valid
 */
function isValidDomain(domain: string): boolean {
  // Basic domain validation - allows for common domain patterns
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/
  
  // Additional checks
  if (domain.length > 253) return false // Max domain length
  if (domain.includes('..')) return false // No consecutive dots
  if (domain.startsWith('.') || domain.endsWith('.')) return false // No leading/trailing dots
  if (domain.includes(' ')) return false // No spaces
  
  return domainRegex.test(domain)
}

/**
 * Normalizes a domain mapping by trimming whitespace and removing empty entries
 * @param mapping - The domain mapping to normalize
 * @returns Normalized domain mapping
 */
export function normalizeDomainMapping(mapping: DomainMapping): DomainMapping {
  if (!mapping || typeof mapping !== 'object') {
    return {}
  }

  const normalized: DomainMapping = {}

  for (const [sourceDomain, targetDomains] of Object.entries(mapping)) {
    const trimmedSource = sourceDomain?.trim()
    if (!trimmedSource) continue

    if (Array.isArray(targetDomains)) {
      const trimmedTargets = targetDomains
        .map(domain => domain?.trim())
        .filter(domain => domain && domain.length > 0)
      
      if (trimmedTargets.length > 0) {
        normalized[trimmedSource] = trimmedTargets
      }
    }
  }

  return normalized
}
