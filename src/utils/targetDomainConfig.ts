/**
 * Helper utilities for configuring target domain admin emails
 */

import { GoogleWorkspaceService } from '@/lib/google-workspace';

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
  lastLoginTime?: string;
  creationTime: string;
  suspended: boolean;
  orgUnitPath: string;
  customerId?: string;
  sourceDomain?: string;
  targetDomain: string;
}

/**
 * Default admin email configurations for common target domains
 */

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
 * Service account configuration for target domains
 */
export interface ServiceAccountConfig {
  clientEmail: string;
  privateKey: string;
  clientId: string;
  projectId?: string;
}

/**
 * Sets up target domain configuration using service account authentication
 */
export const setupTargetDomainsWithServiceAccount = async (
  targetDomains: string[],
  serviceAccountConfig: ServiceAccountConfig,
  customAdminEmails?: TargetDomainConfig
): Promise<{
  success: boolean;
  configuredDomains: string[];
  errors: string[];
  targetAdminEmails: TargetDomainConfig;
}> => {
  const configuredDomains: string[] = [];
  const errors: string[] = [];
  const targetAdminEmails: TargetDomainConfig = {};

  for (const domain of targetDomains) {
    try {
      // Use custom admin email if provided, otherwise generate default
      const adminEmail = customAdminEmails?.[domain] || `admin@${domain}`;
      
      // Validate the admin email format
      if (!validateAdminEmailFormat(adminEmail, domain)) {
        errors.push(`Invalid admin email format for domain ${domain}: ${adminEmail}`);
        continue;
      }

      // For the specific domains mentioned in the error, use default configuration
      if (domain === 'sample.arakutourism.net' || domain === 'migrate.arakutourism.net') {
        const defaults = getDefaultTargetAdminEmails();
        targetAdminEmails[domain] = defaults[domain];
        configuredDomains.push(domain);
        continue;
      }

      targetAdminEmails[domain] = adminEmail;
      configuredDomains.push(domain);

    } catch (error) {
      errors.push(`Failed to configure domain ${domain}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return {
    success: errors.length === 0,
    configuredDomains,
    errors,
    targetAdminEmails
  };
};

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
 * Discovers target users using the same logic as source user discovery
 * This is the equivalent of the source user listing but for target domains
 */
export const discoverTargetUsers = async (
  targetDomains: string[],
  targetAdminEmails: TargetDomainConfig,
  options?: {
    includeSuspended?: boolean;
    includeArchived?: boolean;
    maxResults?: number;
    onProgress?: (domain: string, users: TargetUser[], total: number) => void;
    serviceAccount?: {
      clientEmail: string;
      privateKey: string;
      projectId?: string;
      clientId?: string;
    };
  }
): Promise<{
  success: boolean;
  usersByDomain: { [domain: string]: TargetUser[] };
  allUsers: TargetUser[];
  errors: { [domain: string]: string };
  totalUsers: number;
}> => {
  const usersByDomain: { [domain: string]: TargetUser[] } = {};
  const allUsers: TargetUser[] = [];
  const errors: { [domain: string]: string } = {};
  let totalUsers = 0;

  for (const domain of targetDomains) {
    try {
      const adminEmail = targetAdminEmails[domain];
      if (!adminEmail) {
        errors[domain] = `No admin email configured for domain ${domain}`;
        continue;
      }

      console.log(`Discovering target users for ${domain} with admin email: ${adminEmail}`);

      // Create service account credentials for the target domain admin
      const serviceAccountCredentials = {
        clientEmail: options?.serviceAccount?.clientEmail || process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL || '',
        privateKey: options?.serviceAccount?.privateKey || process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY || '',
        subjectEmail: adminEmail // Use the target domain admin email as subject
      };

      // Create Google Workspace service instance with the target domain admin
      const gwsService = new GoogleWorkspaceService(serviceAccountCredentials, true);

      // Use the same logic as source user discovery
      const domainUsers = await gwsService.getAllUsers(domain, {
        includeSuspended: options?.includeSuspended || false,
        includeArchived: options?.includeArchived || false,
        onProgress: (users, total) => {
          if (options?.onProgress) {
            const targetUsers = users.map(user => ({
              ...user,
              targetDomain: domain,
              customerId: user.id // Preserve customer ID for target domain
            }));
            options.onProgress(domain, targetUsers, total);
          }
        }
      });

      // Convert to TargetUser format
      const targetUsers: TargetUser[] = domainUsers.map(user => ({
        id: user.id,
        primaryEmail: user.primaryEmail,
        name: {
          givenName: user.name.givenName,
          familyName: user.name.familyName,
          fullName: user.name.fullName,
        },
        isAdmin: user.isAdmin,
        isDelegatedAdmin: user.isDelegatedAdmin,
        lastLoginTime: user.lastLoginTime,
        creationTime: user.creationTime,
        suspended: user.suspended,
        orgUnitPath: user.orgUnitPath,
        customerId: user.id,
        targetDomain: domain
      }));

      usersByDomain[domain] = targetUsers;
      allUsers.push(...targetUsers);
      totalUsers += targetUsers.length;

      console.log(`Successfully discovered ${targetUsers.length} users from target domain ${domain}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error discovering target users for ${domain}:`, error);
      errors[domain] = errorMessage;
    }
  }

  return {
    success: Object.keys(errors).length === 0,
    usersByDomain,
    allUsers,
    errors,
    totalUsers
  };
};

/**
 * Gets target users for a specific domain using service account authentication
 * This mirrors the source user discovery API pattern
 */
export const getTargetUsersForDomain = async (
  domain: string,
  adminEmail: string,
  options?: {
    maxResults?: number;
    includeSuspended?: boolean;
    orgUnitPath?: string;
    serviceAccount?: {
      clientEmail: string;
      privateKey: string;
      projectId?: string;
      clientId?: string;
    };
  }
): Promise<{
  success: boolean;
  users: TargetUser[];
  error?: string;
  totalCount: number;
}> => {
  try {
    console.log(`Getting target users for domain ${domain} with admin ${adminEmail}`);

    // Create service account credentials for the target domain admin
    const serviceAccountCredentials = {
      clientEmail: options?.serviceAccount?.clientEmail || process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL || '',
      privateKey: options?.serviceAccount?.privateKey || process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY || '',
      subjectEmail: adminEmail // Use the target domain admin email as subject
    };

    // Initialize Google Workspace service with target domain admin
    const gwsService = new GoogleWorkspaceService(serviceAccountCredentials, true);

    // Test connection first
    await gwsService.testConnection(domain);

    // Get users using the same API as source discovery
    const users = await gwsService.getUsers(domain, options?.maxResults || 100);

    // Filter suspended users if not requested
    const filteredUsers = options?.includeSuspended 
      ? users 
      : users.filter(user => !user.suspended);

    // Convert to TargetUser format
    const targetUsers: TargetUser[] = filteredUsers.map(user => ({
      id: user.id,
      primaryEmail: user.primaryEmail,
      name: {
        givenName: user.name.givenName,
        familyName: user.name.familyName,
        fullName: user.name.fullName,
      },
      isAdmin: user.isAdmin,
      isDelegatedAdmin: user.isDelegatedAdmin,
      lastLoginTime: user.lastLoginTime,
      creationTime: user.creationTime,
      suspended: user.suspended,
      orgUnitPath: user.orgUnitPath,
      customerId: user.id,
      targetDomain: domain
    }));

    return {
      success: true,
      users: targetUsers,
      totalCount: targetUsers.length
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error getting target users for domain ${domain}:`, error);
    
    return {
      success: false,
      users: [],
      error: errorMessage,
      totalCount: 0
    };
  }
};

/**
 * Validates target domain access using the same connection test as source domains
 */
export const validateTargetDomainAccess = async (
  domain: string,
  adminEmail: string,
  serviceAccount?: {
    clientEmail: string;
    privateKey: string;
    projectId?: string;
    clientId?: string;
  }
): Promise<{
  success: boolean;
  error?: string;
}> => {
  try {
    console.log(`Validating target domain access for ${domain} with admin ${adminEmail}`);

    // Create service account credentials for the target domain admin
    const serviceAccountCredentials = {
      clientEmail: serviceAccount?.clientEmail || process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL || '',
      privateKey: serviceAccount?.privateKey || process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY || '',
      subjectEmail: adminEmail // Use the target domain admin email as subject
    };

    const gwsService = new GoogleWorkspaceService(serviceAccountCredentials, true);
    
    // Use the same connection test as source domains
    await gwsService.testConnection(domain);

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Target domain access validation failed for ${domain}:`, error);
    
    return {
      success: false,
      error: errorMessage
    };
  }
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
 * Merges existing target admin emails with new ones
 */
export const mergeTargetAdminEmails = (
  existing: TargetDomainConfig,
  newEmails: TargetDomainConfig
): TargetDomainConfig => {
  return {
    ...existing,
    ...newEmails
  };
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
