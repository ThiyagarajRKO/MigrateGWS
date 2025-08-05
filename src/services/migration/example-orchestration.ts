/**
 * Example demonstrating how to use the Migration Orchestrator with all services
 */

import { 
  MigrationOrchestrator, 
  ServiceMigrationOptions,
  DEFAULT_SERVICE_OPTIONS,
  MIGRATION_TEMPLATES,
  AVAILABLE_SERVICES 
} from './index';
import { MigrationConfig, ServiceCredentials } from './types';

// Example comprehensive migration configuration
export function createComprehensiveMigrationConfig(): {
  config: MigrationConfig;
  credentials: ServiceCredentials;
  options: ServiceMigrationOptions;
} {
  const config: MigrationConfig = {
    id: 'comprehensive-migration-001',
    name: 'Comprehensive Migration Example',
    mappingType: 'one-to-one',
    services: [...AVAILABLE_SERVICES], // All available services
    userMappings: [
      {
        sourceEmail: 'user1@source.com',
        targetEmail: 'user1@target.com',
        sourceDomain: 'source.com',
        targetDomain: 'target.com',
        status: 'pending' as const
      },
      {
        sourceEmail: 'user2@source.com',
        targetEmail: 'user2@target.com',
        sourceDomain: 'source.com',
        targetDomain: 'target.com',
        status: 'pending' as const
      }
    ],
    options: {
      preservePermissions: true,
      preserveSharing: true,
      batchSize: 5,
      retryAttempts: 3,
      throttleMs: 2000
    }
  };

  const credentials: ServiceCredentials = {
    sourceToken: 'source-oauth-token-or-service-account-json',
    targetToken: 'target-oauth-token-or-service-account-json',
    sourceServiceAccount: 'migration@source-project.iam.gserviceaccount.com',
    targetServiceAccount: 'migration@target-project.iam.gserviceaccount.com'
  };

  const options: ServiceMigrationOptions = {
    gmail: {
      ...DEFAULT_SERVICE_OPTIONS.gmail,
      includeSpam: false,
      includeTrash: false
    },
    drive: {
      ...DEFAULT_SERVICE_OPTIONS.drive,
      includeSharedDrives: true,
      preserveRevisions: false
    },
    calendar: {
      ...DEFAULT_SERVICE_OPTIONS.calendar,
      includeEvents: true,
      preserveAttendees: true
    },
    groups: {
      ...DEFAULT_SERVICE_OPTIONS.groups,
      preserveArchives: false
    },
    contacts: {
      ...DEFAULT_SERVICE_OPTIONS.contacts,
      preserveContactGroups: true
    },
    chat: {
      ...DEFAULT_SERVICE_OPTIONS.chat,
      preserveAttachments: false,
      dateRange: {
        startDate: '2023-01-01',
        endDate: '2024-12-31'
      }
    },
    photos: {
      ...DEFAULT_SERVICE_OPTIONS.photos,
      includeSharedPhotos: false,
      maxResolution: 'original'
    },
    forms: {
      ...DEFAULT_SERVICE_OPTIONS.forms,
      preserveResponses: true
    },
    slides: {
      ...DEFAULT_SERVICE_OPTIONS.slides,
      preserveRevisions: false
    }
  };

  return { config, credentials, options };
}

// Example usage function
export async function runComprehensiveMigration(): Promise<void> {
  const { config, credentials, options } = createComprehensiveMigrationConfig();

  // Create orchestrator
  const orchestrator = new MigrationOrchestrator(config, credentials, options);

  try {
    console.log('Starting comprehensive migration with services:', config.services);

    // Validate permissions for all services
    console.log('Validating permissions...');
    const permissionResults = await orchestrator.validateAllPermissions();
    console.log('Permission validation results:', permissionResults);

    // Check for any permission failures
    const failedPermissions = Object.entries(permissionResults)
      .filter(([_, hasPermission]) => !hasPermission)
      .map(([service]) => service);

    if (failedPermissions.length > 0) {
      console.error('Permission validation failed for services:', failedPermissions);
      return;
    }

    // Estimate migration scope
    console.log('Estimating migration scope...');
    const estimates = await orchestrator.estimateAllItems();
    console.log('Migration estimates:', estimates);

    // Calculate total items to migrate
    const totalItems = Object.values(estimates).reduce((total, serviceEstimates) => {
      return total + Object.values(serviceEstimates).reduce((sum, count) => sum + count, 0);
    }, 0);
    console.log(`Total items to migrate: ${totalItems}`);

    // Start migration with progress tracking
    console.log('Starting migration...');
    const results = await orchestrator.migrateAll((progress) => {
      console.log(`Migration progress: ${progress.overallProgress}%`);
      console.log(`Current service: ${progress.currentService}`);
      console.log(`Current user: ${progress.currentUser}`);
      console.log(`Completed services: ${progress.completedServices.join(', ')}`);
      
      if (progress.failedServices.length > 0) {
        console.log(`Failed services: ${progress.failedServices.join(', ')}`);
      }
    });

    console.log('Migration completed!');
    console.log('Results summary:', results);

    // Analyze results
    const serviceResults = Object.entries(results);
    const totalSuccessful = serviceResults.reduce((count, [_, serviceResult]) => {
      return count + Object.values(serviceResult).filter(r => r.success).length;
    }, 0);
    const totalFailed = serviceResults.reduce((count, [_, serviceResult]) => {
      return count + Object.values(serviceResult).filter(r => !r.success).length;
    }, 0);

    console.log(`Migration Summary:`);
    console.log(`- Total successful migrations: ${totalSuccessful}`);
    console.log(`- Total failed migrations: ${totalFailed}`);
    console.log(`- Success rate: ${((totalSuccessful / (totalSuccessful + totalFailed)) * 100).toFixed(2)}%`);

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// Example service-specific migration
export async function runServiceSpecificMigration(services: string[]): Promise<void> {
  const { config, credentials, options } = createComprehensiveMigrationConfig();
  
  // Update config to only include specified services
  config.services = services.filter(service => AVAILABLE_SERVICES.includes(service as any));
  
  console.log(`Running migration for specific services: ${config.services.join(', ')}`);
  
  const orchestrator = new MigrationOrchestrator(config, credentials, options);
  
  const results = await orchestrator.migrateAll((progress) => {
    console.log(`${progress.currentService}: ${progress.overallProgress}% complete`);
  });
  
  console.log('Service-specific migration results:', results);
}

// Template-based migration examples
export async function runTemplateBasedMigration(templateName: keyof typeof MIGRATION_TEMPLATES): Promise<void> {
  const template = MIGRATION_TEMPLATES[templateName];
  const { credentials, options } = createComprehensiveMigrationConfig();
  
  const config: MigrationConfig = {
    id: `template-${templateName}-${Date.now()}`,
    name: `Template Migration: ${templateName}`,
    mappingType: template.mappingType,
    services: template.services,
    userMappings: [
      {
        sourceEmail: 'user1@source.com',
        targetEmail: 'user1@target.com',
        sourceDomain: 'source.com',
        targetDomain: 'target.com',
        status: 'pending' as const
      }
    ],
    options: template.options
  };

  console.log(`Running migration using template: ${templateName}`);
  console.log(`Services: ${config.services.join(', ')}`);
  
  const orchestrator = new MigrationOrchestrator(config, credentials, options);
  
  const results = await orchestrator.migrateAll((progress) => {
    console.log(`Template migration progress: ${progress.overallProgress}%`);
  });
  
  console.log(`Template migration completed:`, results);
}

// Export for use in other parts of the application
export {
  AVAILABLE_SERVICES,
  DEFAULT_SERVICE_OPTIONS,
  MIGRATION_TEMPLATES
};
