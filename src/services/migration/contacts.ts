/**
 * Google Contacts Migration Service
 * Handles migration of contacts, contact groups, and contact metadata
 */

import { BaseMigrationService, UserMapping, MigrationResult, MigrationProgress, ContactsMigrationOptions } from './types';

export class ContactsMigrationService extends BaseMigrationService {
  private options: ContactsMigrationOptions;

  constructor(credentials: any, config: any, options: ContactsMigrationOptions) {
    super('contacts', credentials, config);
    this.options = options;
  }

  async validatePermissions(userMapping: UserMapping): Promise<boolean> {
    try {
      // Validate People API permissions for contacts
      const { google } = await import('googleapis');
      const auth = this.createAuthClient(userMapping.sourceEmail);
      const people = google.people({ version: 'v1', auth });
      
      // Test read permission on source
      await people.people.connections.list({
        resourceName: 'people/me',
        pageSize: 1,
      });
      
      // Test write permission on target (if different domain)
      if (userMapping.sourceDomain !== userMapping.targetDomain) {
        const targetAuth = this.createAuthClient(userMapping.targetEmail);
        const targetPeople = google.people({ version: 'v1', auth: targetAuth });
        
        // Test if we can access target contacts
        await targetPeople.people.connections.list({
          resourceName: 'people/me',
          pageSize: 1,
        });
      }
      
      return true;
    } catch (error) {
      console.error('Contacts permission validation failed:', error);
      return false;
    }
  }

  async estimateItems(userMapping: UserMapping): Promise<number> {
    try {
      const { google } = await import('googleapis');
      const auth = this.createAuthClient(userMapping.sourceEmail);
      const people = google.people({ version: 'v1', auth });
      
      let totalContacts = 0;
      let nextPageToken: string | undefined;
      
      do {
        const response = await people.people.connections.list({
          resourceName: 'people/me',
          pageSize: 1000,
          pageToken: nextPageToken,
          personFields: 'metadata',
        });
        
        totalContacts += response.data.connections?.length || 0;
        nextPageToken = response.data.nextPageToken || undefined;
      } while (nextPageToken);
      
      // Add contact groups count
      const groupsResponse = await people.contactGroups.list({});
      const contactGroups = groupsResponse.data.contactGroups?.length || 0;
      
      return totalContacts + contactGroups;
    } catch (error) {
      console.error('Contacts estimation failed:', error);
      return 0;
    }
  }

  async migrateUser(
    userMapping: UserMapping,
    onProgress?: (progress: MigrationProgress) => void
  ): Promise<MigrationResult> {
    const startTime = new Date().toISOString();
    let progress = this.createProgress(userMapping, 'in-progress', 0, { startTime });
    
    try {
      onProgress?.(progress);
      
      const { google } = await import('googleapis');
      const sourceAuth = this.createAuthClient(userMapping.sourceEmail);
      const targetAuth = this.createAuthClient(userMapping.targetEmail);
      
      const sourcePeople = google.people({ version: 'v1', auth: sourceAuth });
      const targetPeople = google.people({ version: 'v1', auth: targetAuth });
      
      let totalItems = 0;
      let successfulItems = 0;
      let failedItems = 0;
      let skippedItems = 0;
      const errors: string[] = [];
      const warnings: string[] = [];
      
      // Step 1: Migrate contact groups first (if enabled)
      if (this.options.preserveContactGroups) {
        progress = this.createProgress(userMapping, 'in-progress', 10, {
          ...progress,
          details: {
            currentItem: 'Migrating contact groups...',
          },
        });
        onProgress?.(progress);
        
        const groupsResult = await this.migrateContactGroups(sourcePeople, targetPeople);
        totalItems += groupsResult.total;
        successfulItems += groupsResult.successful;
        failedItems += groupsResult.failed;
        errors.push(...groupsResult.errors);
        warnings.push(...groupsResult.warnings);
      }
      
      // Step 2: Migrate contacts
      progress = this.createProgress(userMapping, 'in-progress', 20, {
        ...progress,
        details: {
          currentItem: 'Migrating contacts...',
        },
      });
      onProgress?.(progress);
      
      const contactsResult = await this.migrateContacts(
        sourcePeople, 
        targetPeople, 
        userMapping,
        onProgress
      );
      
      totalItems += contactsResult.total;
      successfulItems += contactsResult.successful;
      failedItems += contactsResult.failed;
      skippedItems += contactsResult.skipped;
      errors.push(...contactsResult.errors);
      warnings.push(...contactsResult.warnings);
      
      const endTime = new Date().toISOString();
      progress = this.createProgress(userMapping, 'completed', 100, {
        ...progress,
        endTime,
        details: {
          currentItem: 'Contacts migration completed',
        },
      });
      onProgress?.(progress);
      
      return {
        success: failedItems === 0,
        progress,
        summary: {
          totalItems,
          successfulItems,
          failedItems,
          skippedItems,
        },
        errors,
        warnings,
      };
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      progress = this.createProgress(userMapping, 'failed', 0, {
        ...progress,
        error: errorMsg,
        endTime: new Date().toISOString(),
      });
      onProgress?.(progress);
      
      return {
        success: false,
        progress,
        summary: {
          totalItems: 0,
          successfulItems: 0,
          failedItems: 1,
          skippedItems: 0,
        },
        errors: [errorMsg],
        warnings: [],
      };
    }
  }

  private async migrateContactGroups(sourcePeople: any, targetPeople: any) {
    const result = {
      total: 0,
      successful: 0,
      failed: 0,
      errors: [] as string[],
      warnings: [] as string[],
    };
    
    try {
      const groupsResponse = await sourcePeople.contactGroups.list({});
      const contactGroups = groupsResponse.data.contactGroups || [];
      
      result.total = contactGroups.length;
      
      for (const group of contactGroups) {
        try {
          // Skip system groups
          if (group.groupType === 'SYSTEM_CONTACT_GROUP') {
            result.warnings.push(`Skipped system contact group: ${group.name}`);
            continue;
          }
          
          // Create contact group in target
          await targetPeople.contactGroups.create({
            requestBody: {
              contactGroup: {
                name: group.name,
              },
            },
          });
          
          result.successful++;
          await this.delay(this.config.options.throttleMs);
          
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push(`Failed to migrate contact group ${group.name}: ${errorMsg}`);
          result.failed++;
        }
      }
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Failed to fetch contact groups: ${errorMsg}`);
    }
    
    return result;
  }

  private async migrateContacts(
    sourcePeople: any, 
    targetPeople: any, 
    userMapping: UserMapping,
    onProgress?: (progress: MigrationProgress) => void
  ) {
    const result = {
      total: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: [] as string[],
      warnings: [] as string[],
    };
    
    try {
      let nextPageToken: string | undefined;
      let processedCount = 0;
      
      do {
        const response = await sourcePeople.people.connections.list({
          resourceName: 'people/me',
          pageSize: this.config.options.batchSize || 50,
          pageToken: nextPageToken,
          personFields: this.getPersonFields(),
        });
        
        const contacts = response.data.connections || [];
        result.total += contacts.length;
        
        for (const contact of contacts) {
          try {
            // Check if contact should be migrated
            if (!this.shouldMigrateContact(contact)) {
              result.skipped++;
              continue;
            }
            
            // Prepare contact data for target
            const contactData = this.prepareContactForMigration(contact);
            
            // Create contact in target
            await targetPeople.people.createContact({
              requestBody: contactData,
            });
            
            result.successful++;
            processedCount++;
            
            // Update progress
            const progressPercent = Math.min(20 + (processedCount / result.total) * 70, 90);
            const progress = this.createProgress(userMapping, 'in-progress', progressPercent, {
              details: {
                currentItem: `Migrated contact: ${contact.names?.[0]?.displayName || 'Unknown'}`,
              },
            });
            onProgress?.(progress);
            
            await this.delay(this.config.options.throttleMs);
            
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            const contactName = contact.names?.[0]?.displayName || 'Unknown contact';
            result.errors.push(`Failed to migrate contact ${contactName}: ${errorMsg}`);
            result.failed++;
          }
        }
        
        nextPageToken = response.data.nextPageToken || undefined;
        
      } while (nextPageToken);
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Failed to fetch contacts: ${errorMsg}`);
    }
    
    return result;
  }

  private getPersonFields(): string {
    const fields = [
      'names',
      'emailAddresses', 
      'phoneNumbers',
      'addresses',
      'organizations',
      'birthdays',
      'urls',
      'relations',
      'nicknames',
      'biographies',
    ];
    
    if (this.options.preservePhotos) {
      fields.push('photos');
    }
    
    if (this.options.preserveCustomFields) {
      fields.push('userDefined');
    }
    
    return fields.join(',');
  }

  private shouldMigrateContact(contact: any): boolean {
    // Skip contacts without names or email addresses
    if (!contact.names?.length && !contact.emailAddresses?.length) {
      return false;
    }
    
    // Skip if contact has no meaningful data
    const hasData = contact.names?.length || 
                   contact.emailAddresses?.length || 
                   contact.phoneNumbers?.length ||
                   contact.addresses?.length;
    
    return hasData;
  }

  private prepareContactForMigration(contact: any): any {
    const contactData: any = {};
    
    // Copy basic fields
    if (contact.names) contactData.names = contact.names;
    if (contact.emailAddresses) contactData.emailAddresses = contact.emailAddresses;
    if (contact.phoneNumbers) contactData.phoneNumbers = contact.phoneNumbers;
    if (contact.addresses) contactData.addresses = contact.addresses;
    if (contact.organizations) contactData.organizations = contact.organizations;
    if (contact.birthdays) contactData.birthdays = contact.birthdays;
    if (contact.urls) contactData.urls = contact.urls;
    if (contact.relations) contactData.relations = contact.relations;
    if (contact.nicknames) contactData.nicknames = contact.nicknames;
    if (contact.biographies) contactData.biographies = contact.biographies;
    
    // Handle photos if enabled
    if (this.options.preservePhotos && contact.photos) {
      contactData.photos = contact.photos;
    }
    
    // Handle custom fields if enabled
    if (this.options.preserveCustomFields && contact.userDefined) {
      contactData.userDefined = contact.userDefined;
    }
    
    return contactData;
  }

  async rollback(userMapping: UserMapping): Promise<boolean> {
    try {
      const { google } = await import('googleapis');
      const auth = this.createAuthClient(userMapping.targetEmail);
      const people = google.people({ version: 'v1', auth });
      
      // Note: People API doesn't have a direct way to identify migrated contacts
      // This would require maintaining a migration log or using custom labels
      console.warn('Contacts rollback requires manual identification of migrated contacts');
      
      return false;
    } catch (error) {
      console.error('Contacts rollback failed:', error);
      return false;
    }
  }

  // Utility methods for different mapping scenarios
  async migrateOneToOne(sourceUser: string, targetUser: string): Promise<MigrationResult> {
    const userMapping: UserMapping = {
      sourceEmail: sourceUser,
      targetEmail: targetUser,
      sourceDomain: sourceUser.split('@')[1],
      targetDomain: targetUser.split('@')[1],
      status: 'pending',
    };
    
    return this.migrateUser(userMapping);
  }

  async migrateManyToOne(sourceUsers: string[], targetUser: string): Promise<MigrationResult[]> {
    const results: MigrationResult[] = [];
    
    for (const sourceUser of sourceUsers) {
      const userMapping: UserMapping = {
        sourceEmail: sourceUser,
        targetEmail: targetUser,
        sourceDomain: sourceUser.split('@')[1],
        targetDomain: targetUser.split('@')[1],
        status: 'pending',
      };
      
      const result = await this.migrateUser(userMapping);
      results.push(result);
      
      // Add extra delay for many-to-one to avoid overwhelming target
      await this.delay(this.config.options.throttleMs * 2);
    }
    
    return results;
  }

  async migrateOneToMany(sourceUser: string, targetUsers: string[]): Promise<MigrationResult[]> {
    const results: MigrationResult[] = [];
    
    for (const targetUser of targetUsers) {
      const userMapping: UserMapping = {
        sourceEmail: sourceUser,
        targetEmail: targetUser,
        sourceDomain: sourceUser.split('@')[1],
        targetDomain: targetUser.split('@')[1],
        status: 'pending',
      };
      
      const result = await this.migrateUser(userMapping);
      results.push(result);
      
      await this.delay(this.config.options.throttleMs);
    }
    
    return results;
  }
}
