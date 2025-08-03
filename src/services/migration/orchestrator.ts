/**
 * Migration Orchestrator
 * Coordinates multiple service-specific migrations and handles user mappings
 */

import { GmailMigrationService } from './gmail';
import { DriveMigrationService } from './drive';
import { CalendarMigrationService } from './calendar';
import { GroupMigrationService } from './groups';
import { ContactsMigrationService } from './contacts';
import {
  BaseMigrationService,
  MigrationConfig,
  UserMapping,
  MigrationResult,
  MigrationProgress,
  ServiceCredentials,
  GmailMigrationOptions,
  DriveMigrationOptions,
  CalendarMigrationOptions,
  GroupMigrationOptions,
  ContactsMigrationOptions
} from './types';

export interface ServiceMigrationOptions {
  gmail?: GmailMigrationOptions;
  drive?: DriveMigrationOptions;
  calendar?: CalendarMigrationOptions;
  groups?: GroupMigrationOptions;
  contacts?: ContactsMigrationOptions;
}

export interface OrchestrationProgress {
  overallProgress: number;
  currentService: string;
  currentUser: string;
  serviceProgresses: Map<string, MigrationProgress>;
  completedServices: string[];
  failedServices: string[];
  userMappingStatus: Map<string, 'pending' | 'in-progress' | 'completed' | 'failed'>;
}

export class MigrationOrchestrator {
  private services: Map<string, BaseMigrationService> = new Map();
  private config: MigrationConfig;
  private credentials: ServiceCredentials;
  private options: ServiceMigrationOptions;

  constructor(
    config: MigrationConfig,
    credentials: ServiceCredentials,
    options: ServiceMigrationOptions = {}
  ) {
    this.config = config;
    this.credentials = credentials;
    this.options = options;
    
    this.initializeServices();
  }

  private initializeServices(): void {
    // Initialize only the services that are included in the migration config
    if (this.config.services.includes('gmail') && this.options.gmail) {
      this.services.set('gmail', new GmailMigrationService(
        this.credentials,
        this.config,
        this.options.gmail
      ));
    }

    if (this.config.services.includes('drive') && this.options.drive) {
      this.services.set('drive', new DriveMigrationService(
        this.credentials,
        this.config,
        this.options.drive
      ));
    }

    if (this.config.services.includes('calendar') && this.options.calendar) {
      this.services.set('calendar', new CalendarMigrationService(
        this.credentials,
        this.config,
        this.options.calendar
      ));
    }

    if (this.config.services.includes('groups') && this.options.groups) {
      this.services.set('groups', new GroupMigrationService(
        this.credentials,
        this.config,
        this.options.groups
      ));
    }

    if (this.config.services.includes('contacts') && this.options.contacts) {
      this.services.set('contacts', new ContactsMigrationService(
        this.credentials,
        this.config,
        this.options.contacts
      ));
    }
  }

  async validateAllPermissions(): Promise<{ [service: string]: boolean }> {
    const results: { [service: string]: boolean } = {};
    
    for (const serviceName of Array.from(this.services.keys())) {
      const service = this.services.get(serviceName)!;
      // For permission validation, we just need one user mapping as example
      const sampleUserMapping = this.config.userMappings[0];
      if (sampleUserMapping) {
        results[serviceName] = await service.validatePermissions(sampleUserMapping);
      } else {
        results[serviceName] = false;
      }
    }
    
    return results;
  }

  async estimateAllItems(): Promise<{ [service: string]: { [user: string]: number } }> {
    const estimates: { [service: string]: { [user: string]: number } } = {};
    
    for (const serviceName of Array.from(this.services.keys())) {
      const service = this.services.get(serviceName)!;
      estimates[serviceName] = {};
      
      for (const userMapping of this.config.userMappings) {
        estimates[serviceName][userMapping.sourceEmail] = await service.estimateItems(userMapping);
      }
    }
    
    return estimates;
  }

  async migrateAll(
    onProgress?: (progress: OrchestrationProgress) => void
  ): Promise<{ [service: string]: { [user: string]: MigrationResult } }> {
    const results: { [service: string]: { [user: string]: MigrationResult } } = {};
    const serviceProgresses = new Map<string, MigrationProgress>();
    const userMappingStatus = new Map<string, 'pending' | 'in-progress' | 'completed' | 'failed'>();
    const completedServices: string[] = [];
    const failedServices: string[] = [];

    // Initialize user mapping statuses
    for (const userMapping of this.config.userMappings) {
      userMappingStatus.set(userMapping.sourceEmail, 'pending');
    }

    const totalOperations = this.services.size * this.config.userMappings.length;
    let completedOperations = 0;

    // Migrate based on mapping type
    switch (this.config.mappingType) {
      case 'one-to-one':
        return await this.migrateOneToOne(onProgress);
      
      case 'many-to-one':
        return await this.migrateManyToOne(onProgress);
      
      case 'one-to-many':
        return await this.migrateOneToMany(onProgress);
      
      default:
        throw new Error(`Unsupported mapping type: ${this.config.mappingType}`);
    }
  }

  private async migrateOneToOne(
    onProgress?: (progress: OrchestrationProgress) => void
  ): Promise<{ [service: string]: { [user: string]: MigrationResult } }> {
    const results: { [service: string]: { [user: string]: MigrationResult } } = {};
    const serviceProgresses = new Map<string, MigrationProgress>();
    const userMappingStatus = new Map<string, 'pending' | 'in-progress' | 'completed' | 'failed'>();
    const completedServices: string[] = [];
    const failedServices: string[] = [];

    const totalOperations = this.services.size * this.config.userMappings.length;
    let completedOperations = 0;

    // Process each service for each user mapping
    for (const [serviceName, service] of Array.from(this.services.entries())) {
      results[serviceName] = {};
      
      for (const userMapping of this.config.userMappings) {
        userMappingStatus.set(userMapping.sourceEmail, 'in-progress');
        
        // Report progress
        const progress: OrchestrationProgress = {
          overallProgress: Math.round((completedOperations / totalOperations) * 100),
          currentService: serviceName,
          currentUser: userMapping.sourceEmail,
          serviceProgresses,
          completedServices,
          failedServices,
          userMappingStatus,
        };
        onProgress?.(progress);

        try {
          const result = await service.migrateUser(userMapping, (serviceProgress: MigrationProgress) => {
            serviceProgresses.set(`${serviceName}-${userMapping.sourceEmail}`, serviceProgress);
            onProgress?.({
              ...progress,
              serviceProgresses,
            });
          });

          results[serviceName][userMapping.sourceEmail] = result;
          
          if (result.success) {
            userMappingStatus.set(userMapping.sourceEmail, 'completed');
          } else {
            userMappingStatus.set(userMapping.sourceEmail, 'failed');
          }
        } catch (error) {
          userMappingStatus.set(userMapping.sourceEmail, 'failed');
          results[serviceName][userMapping.sourceEmail] = {
            success: false,
            progress: {
              serviceType: serviceName,
              userId: userMapping.sourceEmail,
              status: 'failed',
              progress: 0,
              itemsTotal: 0,
              itemsProcessed: 0,
              itemsFailed: 1,
              error: error instanceof Error ? error.message : 'Unknown error',
            },
            summary: {
              totalItems: 0,
              successfulItems: 0,
              failedItems: 1,
              skippedItems: 0,
            },
            errors: [error instanceof Error ? error.message : 'Unknown error'],
            warnings: [],
          };
        }

        completedOperations++;
      }

      // Check if service completed successfully for all users
      const serviceResults = Object.values(results[serviceName]);
      if (serviceResults.every(result => result.success)) {
        completedServices.push(serviceName);
      } else {
        failedServices.push(serviceName);
      }
    }

    return results;
  }

  private async migrateManyToOne(
    onProgress?: (progress: OrchestrationProgress) => void
  ): Promise<{ [service: string]: { [user: string]: MigrationResult } }> {
    const results: { [service: string]: { [user: string]: MigrationResult } } = {};
    
    // For many-to-one, we need to group source users and migrate them to single target users
    const targetUsers = Array.from(new Set(this.config.userMappings.map(m => m.targetEmail)));
    
    for (const [serviceName, service] of Array.from(this.services.entries())) {
      results[serviceName] = {};
      
      for (const targetUser of targetUsers) {
        const sourceUsersForTarget = this.config.userMappings
          .filter(m => m.targetEmail === targetUser)
          .map(m => m.sourceEmail);
        
        // Use service-specific many-to-one migration
        const serviceResults = await (service as any).migrateManyToOne(sourceUsersForTarget, targetUser);
        
        // Map results back to individual source users
        serviceResults.forEach((result: MigrationResult, index: number) => {
          results[serviceName][sourceUsersForTarget[index]] = result;
        });
      }
    }
    
    return results;
  }

  private async migrateOneToMany(
    onProgress?: (progress: OrchestrationProgress) => void
  ): Promise<{ [service: string]: { [user: string]: MigrationResult } }> {
    const results: { [service: string]: { [user: string]: MigrationResult } } = {};
    
    // For one-to-many, we need to group target users by source user
    const sourceUsers = Array.from(new Set(this.config.userMappings.map(m => m.sourceEmail)));
    
    for (const [serviceName, service] of Array.from(this.services.entries())) {
      results[serviceName] = {};
      
      for (const sourceUser of sourceUsers) {
        const targetUsersForSource = this.config.userMappings
          .filter(m => m.sourceEmail === sourceUser)
          .map(m => m.targetEmail);
        
        // Use service-specific one-to-many migration
        const serviceResults = await (service as any).migrateOneToMany(sourceUser, targetUsersForSource);
        
        // Map results back to individual target users
        serviceResults.forEach((result: MigrationResult, index: number) => {
          const targetUser = targetUsersForSource[index];
          results[serviceName][`${sourceUser}->${targetUser}`] = result;
        });
      }
    }
    
    return results;
  }

  async rollbackAll(): Promise<{ [service: string]: boolean }> {
    const results: { [service: string]: boolean } = {};
    
    for (const [serviceName, service] of Array.from(this.services.entries())) {
      // For rollback, we attempt to rollback all user mappings
      let serviceRollbackSuccess = true;
      
      for (const userMapping of this.config.userMappings) {
        const rollbackResult = await service.rollback(userMapping);
        if (!rollbackResult) {
          serviceRollbackSuccess = false;
        }
      }
      
      results[serviceName] = serviceRollbackSuccess;
    }
    
    return results;
  }

  // Utility methods to get service-specific instances
  getGmailService(): GmailMigrationService | undefined {
    return this.services.get('gmail') as GmailMigrationService;
  }

  getDriveService(): DriveMigrationService | undefined {
    return this.services.get('drive') as DriveMigrationService;
  }

  getCalendarService(): CalendarMigrationService | undefined {
    return this.services.get('calendar') as CalendarMigrationService;
  }

  getGroupService(): GroupMigrationService | undefined {
    return this.services.get('groups') as GroupMigrationService;
  }
}
