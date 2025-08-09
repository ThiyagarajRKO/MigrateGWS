/**
 * Client-safe target domain configuration utilities
 * This file contains only configuration data that can be safely imported in client-side components
 */

export interface TargetDomainConfig {
  [domain: string]: string;
}

/**
 * Default admin email configurations for common target domains
 * This is a client-safe version that doesn't import server-side dependencies
 */
export const getDefaultTargetAdminEmails = (): TargetDomainConfig => {
  return {
    'sample.arakutourism.net': 'admin@sample.arakutourism.net',
    'migrate.arakutourism.net': 'admin@migrate.arakutourism.net'
  };
};

/**
 * Get effective target admin emails with fallback to defaults
 * Client-safe version that merges provided emails with defaults
 */
export const getEffectiveTargetAdminEmailsClient = (
  targetAdminEmails: TargetDomainConfig = {},
  sourceAdminEmail?: string,
  targetDomains: string[] = [],
  migrationScenario?: string
): TargetDomainConfig => {
  // For single-super-admin scenario, use the same source admin email for all target domains
  if (migrationScenario === 'single-super-admin' && sourceAdminEmail) {
    const effectiveEmails: TargetDomainConfig = {};
    
    targetDomains.forEach(domain => {
      effectiveEmails[domain] = sourceAdminEmail;
    });
    
    return effectiveEmails;
  }
  
  // For cross-tenant or when no source admin email, use provided emails with defaults as fallback
  const defaultAdminEmails = getDefaultTargetAdminEmails();
  const mergedAdminEmails = { ...defaultAdminEmails, ...targetAdminEmails };
  
  return mergedAdminEmails;
};

/**
 * Validate if all required target domains have admin email configurations
 */
export const validateTargetDomainConfigurations = (
  targetDomains: string[],
  effectiveAdminEmails: TargetDomainConfig
): { isValid: boolean; missingDomains: string[] } => {
  const missingDomains = targetDomains.filter(domain => !effectiveAdminEmails[domain]);
  
  return {
    isValid: missingDomains.length === 0,
    missingDomains
  };
};

/**
 * Get helpful configuration status with default availability information
 */
export const getTargetConfigurationStatusClient = (
  targetDomains: string[],
  effectiveAdminEmails: TargetDomainConfig,
  migrationScenario?: string
): { 
  isValid: boolean; 
  missingDomains: string[]; 
  message?: string;
  domainsWithDefaults: string[];
  domainsWithoutDefaults: string[];
} => {
  const missingDomains = targetDomains.filter(domain => !effectiveAdminEmails[domain]);
  
  if (missingDomains.length === 0) {
    return { 
      isValid: true, 
      missingDomains: [],
      domainsWithDefaults: [],
      domainsWithoutDefaults: []
    };
  }

  const defaultAdminEmails = getDefaultTargetAdminEmails();
  const domainsWithDefaults = missingDomains.filter(domain => defaultAdminEmails[domain]);
  const domainsWithoutDefaults = missingDomains.filter(domain => !defaultAdminEmails[domain]);

  let message: string;
  if (migrationScenario === 'single-super-admin') {
    message = `Single Super Admin scenario detected, but source admin email is not configured for target domains: ${missingDomains.join(', ')}. Please ensure your source admin email has domain-wide delegation rights for these target domains.`;
  } else if (domainsWithDefaults.length > 0 && domainsWithoutDefaults.length === 0) {
    message = `Default admin configurations are available for: ${domainsWithDefaults.join(', ')}. These will be used automatically if delegation is properly set up.`;
  } else {
    message = `Target domain admin configuration required for: ${missingDomains.join(', ')}. Please configure admin emails for these domains in the delegation setup.`;
  }

  return {
    isValid: false,
    missingDomains,
    message,
    domainsWithDefaults,
    domainsWithoutDefaults
  };
};
