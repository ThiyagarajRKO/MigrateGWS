/**
 * Migration Services Index
 * Exports all service-specific migration microservices
 */

// Import all services first
import { BaseMigrationService } from './types';
import { GmailMigrationService } from './gmail';
import { DriveMigrationService } from './drive';
import { CalendarMigrationService } from './calendar';
import { GroupMigrationService } from './groups';
import { ContactsMigrationService } from './contacts';
import { ChatMigrationService } from './chat';
import { PhotoMigrationService } from './photos';
import { FormsMigrationService } from './forms';
import { SlidesMigrationService } from './slides';
import { MigrationOrchestrator } from './orchestrator';

// Re-export types and services
export { BaseMigrationService };
export type {
  UserMapping,
  MigrationConfig,
  MigrationProgress,
  MigrationResult,
  ServiceCredentials,
  GmailMigrationOptions,
  DriveMigrationOptions,
  CalendarMigrationOptions,
  GroupMigrationOptions,
  ContactsMigrationOptions,
  ChatMigrationOptions,
  PhotoMigrationOptions,
  FormsMigrationOptions,
  SlidesMigrationOptions,
} from './types';

export { 
  GmailMigrationService,
  DriveMigrationService,
  CalendarMigrationService,
  GroupMigrationService,
  ContactsMigrationService,
  ChatMigrationService,
  PhotoMigrationService,
  FormsMigrationService,
  SlidesMigrationService,
  MigrationOrchestrator
};

export type { ServiceMigrationOptions, OrchestrationProgress } from './orchestrator';

// Service factory for easy instantiation
export class MigrationServiceFactory {
  static createGmailService(credentials: any, config: any, options: any) {
    return new GmailMigrationService(credentials, config, options);
  }

  static createDriveService(credentials: any, config: any, options: any) {
    return new DriveMigrationService(credentials, config, options);
  }

  static createCalendarService(credentials: any, config: any, options: any) {
    return new CalendarMigrationService(credentials, config, options);
  }

  static createGroupService(credentials: any, config: any, options: any) {
    return new GroupMigrationService(credentials, config, options);
  }

  static createContactsService(credentials: any, config: any, options: any) {
    return new ContactsMigrationService(credentials, config, options);
  }

  static createChatService(credentials: any, config: any, options: any) {
    return new ChatMigrationService(credentials, config, options);
  }

  static createPhotoService(credentials: any, config: any, options: any) {
    return new PhotoMigrationService(credentials, config, options);
  }

  static createFormsService(credentials: any, config: any, options: any) {
    return new FormsMigrationService(credentials, config, options);
  }

  static createSlidesService(credentials: any, config: any, options: any) {
    return new SlidesMigrationService(credentials, config, options);
  }

  static createOrchestrator(config: any, credentials: any, options: any) {
    return new MigrationOrchestrator(config, credentials, options);
  }
}

// Default service configurations
export const DEFAULT_SERVICE_OPTIONS = {
  gmail: {
    includeSpam: false,
    includeTrash: false,
    preserveLabels: true,
  },
  drive: {
    includeSharedDrives: true,
    preserveFolderStructure: true,
    preserveComments: true,
    preserveRevisions: false,
    maxFileSize: 5 * 1024 * 1024 * 1024, // 5GB
  },
  calendar: {
    includeEvents: true,
    includeRecurring: true,
    preserveAttendees: true,
  },
  groups: {
    preserveMembers: true,
    preserveSettings: true,
    preserveArchives: false,
  },
  contacts: {
    preserveContactGroups: true,
    preservePhotos: true,
    preserveCustomFields: true,
  },
  chat: {
    preserveRooms: true,
    preserveDirectMessages: true,
    preserveAttachments: false,
  },
  photos: {
    preserveAlbums: true,
    preserveMetadata: true,
    includeSharedPhotos: false,
    maxResolution: 'original',
  },
  forms: {
    preserveResponses: true,
    preserveCollaborators: true,
    preserveSettings: true,
  },
  slides: {
    preserveComments: true,
    preserveRevisions: false,
    preserveCollaborators: true,
  },
};

// Migration configuration templates
export const MIGRATION_TEMPLATES = {
  BASIC_ONE_TO_ONE: {
    mappingType: 'one-to-one' as const,
    services: ['gmail', 'drive', 'calendar', 'contacts'],
    options: {
      preservePermissions: true,
      preserveSharing: true,
      batchSize: 10,
      retryAttempts: 3,
      throttleMs: 1000,
    },
  },
  COMPREHENSIVE_ONE_TO_ONE: {
    mappingType: 'one-to-one' as const,
    services: ['gmail', 'drive', 'calendar', 'groups', 'contacts'],
    options: {
      preservePermissions: true,
      preserveSharing: true,
      batchSize: 5,
      retryAttempts: 5,
      throttleMs: 2000,
    },
  },
  MANY_TO_ONE_CONSOLIDATION: {
    mappingType: 'many-to-one' as const,
    services: ['gmail', 'drive'],
    options: {
      preservePermissions: false,
      preserveSharing: false,
      batchSize: 20,
      retryAttempts: 3,
      throttleMs: 500,
    },
  },
  ONE_TO_MANY_DISTRIBUTION: {
    mappingType: 'one-to-many' as const,
    services: ['drive', 'calendar'],
    options: {
      preservePermissions: true,
      preserveSharing: true,
      batchSize: 3,
      retryAttempts: 5,
      throttleMs: 3000,
    },
  },
};
