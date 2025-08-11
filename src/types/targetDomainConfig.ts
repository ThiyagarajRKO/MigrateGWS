/**
 * Client-side types and utilities for target domain configuration
 * This file contains only types and utilities that don't import server-side dependencies
 */

export interface TargetDomainConfig {
  [domain: string]: string;
}

export interface TargetUser {
  id: string;
  primaryEmail: string;
  name: {
    givenName: string;
    familyName: string;
    fullName: string;
  };
  isAdmin: boolean;
  isDelegatedAdmin?: boolean;
  suspended?: boolean;
  customSchemas?: any;
  includeInGlobalAddressList?: boolean;
  ipWhitelisted?: boolean;
  orgUnitPath?: string;
  recoveryEmail?: string;
  recoveryPhone?: string;
}

export interface TargetDomainValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  missingDomains: string[];
  invalidEmails: string[];
  validDomains: string[];
}

export interface AutoConfigurationResult {
  success: boolean;
  configuredDomains: string[];
  errors: {
    [domain: string]: string;
  };
  adminEmailsFound: {
    [domain: string]: string;
  };
}

export interface ServiceAccountConfig {
  credentialsPath: string;
  scopes: string[];
  delegatedAdminEmail: string;
  clientEmail?: string;
  clientId?: string;
  privateKey?: string;
}

/**
 * Auto-configures target domains for the specific migration scenario
 */
export const autoConfigureTargetDomains = (): TargetDomainConfig => {
  const targetDomains = ['sample.arakutourism.net', 'migrate.arakutourism.net'];
  const config: TargetDomainConfig = {};

  targetDomains.forEach(domain => {
    config[domain] = `admin@${domain}`;
  });

  return config;
};

/**
 * Default admin email configurations for common target domains
 */
export const getDefaultTargetAdminEmails = (): TargetDomainConfig => {
  return {
    'sample.arakutourism.net': 'admin@sample.arakutourism.net',
    'migrate.arakutourism.net': 'admin@migrate.arakutourism.net'
  };
};

/**
 * Generates admin email suggestions based on domain names
 */
export const generateAdminEmailSuggestions = (targetDomains: string[]): TargetDomainConfig => {
  const suggestions: TargetDomainConfig = {};
  
  targetDomains.forEach(domain => {
    // Common admin email patterns
    suggestions[domain] = `admin@${domain}`;
  });
  
  return suggestions;
};

/**
 * Validates email format for target admin emails
 */
export const validateAdminEmailFormat = (email: string, domain: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(email)) {
    return false;
  }
  
  // Check if email domain matches the target domain
  const emailDomain = email.split('@')[1];
  return emailDomain === domain;
};

/**
 * Gets configuration status for target domains
 */
export const getTargetDomainStatus = (
  targetDomains: string[],
  targetAdminEmails: TargetDomainConfig,
  migrationScenario: 'single-super-admin' | 'cross-tenant' = 'cross-tenant'
): {
  configured: string[];
  missing: string[];
  invalid: string[];
  allConfigured: boolean;
} => {
  const configured: string[] = [];
  const missing: string[] = [];
  const invalid: string[] = [];

  targetDomains.forEach(domain => {
    const adminEmail = targetAdminEmails[domain];
    
    if (!adminEmail?.trim()) {
      missing.push(domain);
    } else if (!validateAdminEmailFormat(adminEmail, domain)) {
      invalid.push(domain);
    } else {
      configured.push(domain);
    }
  });

  return {
    configured,
    missing,
    invalid,
    allConfigured: missing.length === 0 && invalid.length === 0
  };
};

/**
 * Validates if all target domains have admin emails configured
 */
export const validateTargetDomainConfig = (
  targetDomains: string[], 
  targetAdminEmails: TargetDomainConfig
): { isValid: boolean; missingDomains: string[]; message?: string } => {
  const missingDomains = targetDomains.filter(domain => !targetAdminEmails[domain]?.trim());
  
  if (missingDomains.length === 0) {
    return { isValid: true, missingDomains: [] };
  }

  return {
    isValid: false,
    missingDomains,
    message: `Target domain admin configuration required for: ${missingDomains.join(', ')}. Please configure admin emails for these domains in the delegation setup.`
  };
};

/**
 * Validates email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Extracts domain from email
 */
export function getDomainFromEmail(email: string): string {
  return email.split('@')[1] || '';
}

/**
 * Validates target domain configuration object
 */
export function validateTargetDomainConfigObject(
  config: TargetDomainConfig,
  requiredDomains: string[]
): TargetDomainValidationResult {
  const result: TargetDomainValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    missingDomains: [],
    invalidEmails: [],
    validDomains: []
  };

  // Check for missing domains
  for (const domain of requiredDomains) {
    if (!config[domain]) {
      result.missingDomains.push(domain);
      result.errors.push(`Missing admin email for domain: ${domain}`);
    }
  }

  // Check for invalid email formats
  for (const [domain, email] of Object.entries(config)) {
    if (email && !isValidEmail(email)) {
      result.invalidEmails.push(email);
      result.errors.push(`Invalid email format for domain ${domain}: ${email}`);
    } else if (email) {
      result.validDomains.push(domain);
    }
  }

  result.isValid = result.errors.length === 0;
  return result;
}

/**
 * Gets default admin email suggestions based on domain patterns
 */
export function getDefaultAdminEmailSuggestions(domains: string[]): TargetDomainConfig {
  const suggestions: TargetDomainConfig = {};
  
  for (const domain of domains) {
    // Common admin email patterns
    const commonPatterns = [
      `admin@${domain}`,
      `administrator@${domain}`,
      `postmaster@${domain}`,
      `root@${domain}`
    ];
    
    // For now, suggest the most common pattern
    suggestions[domain] = commonPatterns[0];
  }
  
  return suggestions;
}
