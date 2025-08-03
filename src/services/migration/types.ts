/**
 * Migration Service Types and Interfaces
 * Defines the contracts for service-specific migration microservices
 */

export interface UserMapping {
  sourceEmail: string;
  targetEmail: string;
  sourceDomain: string;
  targetDomain: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  error?: string;
}

export interface MigrationConfig {
  id: string;
  name: string;
  mappingType: 'one-to-one' | 'many-to-one' | 'one-to-many';
  userMappings: UserMapping[];
  services: string[];
  options: {
    preservePermissions: boolean;
    preserveSharing: boolean;
    batchSize: number;
    retryAttempts: number;
    throttleMs: number;
  };
}

export interface MigrationProgress {
  serviceType: string;
  userId: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed' | 'skipped';
  progress: number; // 0-100
  itemsTotal: number;
  itemsProcessed: number;
  itemsFailed: number;
  startTime?: string;
  endTime?: string;
  error?: string;
  details?: {
    currentItem?: string;
    lastSuccessfulItem?: string;
    failedItems?: string[];
  };
}

export interface MigrationResult {
  success: boolean;
  progress: MigrationProgress;
  summary: {
    totalItems: number;
    successfulItems: number;
    failedItems: number;
    skippedItems: number;
  };
  errors: string[];
  warnings: string[];
}

export interface ServiceCredentials {
  sourceToken: string;
  targetToken: string;
  sourceServiceAccount?: string;
  targetServiceAccount?: string;
}

export abstract class BaseMigrationService {
  protected serviceType: string;
  protected credentials: ServiceCredentials;
  protected config: MigrationConfig;

  constructor(serviceType: string, credentials: ServiceCredentials, config: MigrationConfig) {
    this.serviceType = serviceType;
    this.credentials = credentials;
    this.config = config;
  }

  // Abstract methods that each service must implement
  abstract validatePermissions(userMapping: UserMapping): Promise<boolean>;
  abstract estimateItems(userMapping: UserMapping): Promise<number>;
  abstract migrateUser(userMapping: UserMapping, onProgress?: (progress: MigrationProgress) => void): Promise<MigrationResult>;
  abstract rollback(userMapping: UserMapping): Promise<boolean>;

  // Common utility methods
  protected async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  protected createAuthClient(userEmail: string): any {
    // This method should be implemented based on your authentication setup
    // For now, returning a placeholder that should be replaced with actual auth logic
    console.warn('createAuthClient method needs to be implemented with actual Google Auth setup');
    return {
      // Placeholder auth client
      // In a real implementation, this would create a Google Auth client
      // using the appropriate credentials and user email
    };
  }

  protected async withRetry<T>(
    operation: () => Promise<T>,
    retries: number = this.config.options.retryAttempts
  ): Promise<T> {
    let lastError: Error;
    
    for (let i = 0; i <= retries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        if (i < retries) {
          await this.delay(this.config.options.throttleMs * Math.pow(2, i)); // Exponential backoff
        }
      }
    }
    
    throw lastError!;
  }

  protected createProgress(
    userMapping: UserMapping,
    status: MigrationProgress['status'],
    progress: number = 0,
    details?: Partial<MigrationProgress>
  ): MigrationProgress {
    return {
      serviceType: this.serviceType,
      userId: userMapping.sourceEmail,
      status,
      progress,
      itemsTotal: details?.itemsTotal || 0,
      itemsProcessed: details?.itemsProcessed || 0,
      itemsFailed: details?.itemsFailed || 0,
      startTime: details?.startTime,
      endTime: details?.endTime,
      error: details?.error,
      details: details?.details,
    };
  }
}

// Service-specific configuration interfaces
export interface GmailMigrationOptions {
  includeSpam: boolean;
  includeTrash: boolean;
  preserveLabels: boolean;
  dateRange?: {
    startDate: string;
    endDate: string;
  };
}

export interface DriveMigrationOptions {
  includeSharedDrives: boolean;
  preserveFolderStructure: boolean;
  preserveComments: boolean;
  preserveRevisions: boolean;
  maxFileSize: number; // in bytes
}

export interface CalendarMigrationOptions {
  includeEvents: boolean;
  includeRecurring: boolean;
  preserveAttendees: boolean;
  dateRange?: {
    startDate: string;
    endDate: string;
  };
}

export interface GroupMigrationOptions {
  preserveMembers: boolean;
  preserveSettings: boolean;
  preserveArchives: boolean;
}

export interface ChatMigrationOptions {
  preserveRooms: boolean;
  preserveDirectMessages: boolean;
  preserveAttachments: boolean;
  dateRange?: {
    startDate: string;
    endDate: string;
  };
}

export interface PhotoMigrationOptions {
  preserveAlbums: boolean;
  preserveMetadata: boolean;
  includeSharedPhotos: boolean;
  maxResolution: string;
}

export interface FormsMigrationOptions {
  preserveResponses: boolean;
  preserveCollaborators: boolean;
  preserveSettings: boolean;
}

export interface SlidesMigrationOptions {
  preserveComments: boolean;
  preserveRevisions: boolean;
  preserveCollaborators: boolean;
}

export interface ContactsMigrationOptions {
  preserveContactGroups: boolean;
  preservePhotos: boolean;
  preserveCustomFields: boolean;
}
