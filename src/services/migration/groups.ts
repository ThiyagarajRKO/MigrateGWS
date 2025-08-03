/**
 * Google Groups Migration Service
 * Handles migration of groups, members, and settings
 */

import { admin_directory_v1, google } from 'googleapis';
import { BaseMigrationService, UserMapping, MigrationResult, MigrationProgress, GroupMigrationOptions } from './types';

export class GroupMigrationService extends BaseMigrationService {
  private sourceAdmin: admin_directory_v1.Admin;
  private targetAdmin: admin_directory_v1.Admin;
  private options: GroupMigrationOptions;

  constructor(credentials: any, config: any, options: GroupMigrationOptions) {
    super('groups', credentials, config);
    this.options = options;
    
    this.sourceAdmin = google.admin({ version: 'directory_v1', auth: credentials.sourceAuth });
    this.targetAdmin = google.admin({ version: 'directory_v1', auth: credentials.targetAuth });
  }

  async validatePermissions(userMapping: UserMapping): Promise<boolean> {
    try {
      // Check source permissions
      await this.sourceAdmin.groups.list({ domain: userMapping.sourceDomain });
      
      // Check target permissions
      await this.targetAdmin.groups.list({ domain: userMapping.targetDomain });
      
      return true;
    } catch (error) {
      console.error('Groups permission validation failed:', error);
      return false;
    }
  }

  async estimateItems(userMapping: UserMapping): Promise<number> {
    try {
      const response = await this.sourceAdmin.groups.list({
        domain: userMapping.sourceDomain,
        maxResults: 200,
      });
      
      return response.data.groups?.length || 0;
    } catch (error) {
      console.error('Groups estimation failed:', error);
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
      // Step 1: Get all groups in source domain
      onProgress?.(progress);
      const groups = await this.getAllGroups(userMapping.sourceDomain);
      progress.itemsTotal = groups.length;
      
      let processed = 0;
      const errors: string[] = [];
      const warnings: string[] = [];
      
      // Step 2: Migrate each group
      for (const group of groups) {
        try {
          await this.migrateGroup(group, userMapping);
          processed++;
        } catch (error) {
          const errorMsg = `Failed to migrate group ${group.email}: ${error}`;
          errors.push(errorMsg);
          
          // Continue with other groups even if one fails
          processed++;
        }
        
        progress = this.createProgress(userMapping, 'in-progress',
          Math.round((processed / groups.length) * 100), {
            ...progress,
            itemsProcessed: processed,
            itemsFailed: errors.length,
            details: {
              currentItem: `Group: ${group.name}`,
            }
          });
        onProgress?.(progress);
        
        await this.delay(this.config.options.throttleMs);
      }
      
      const endTime = new Date().toISOString();
      progress = this.createProgress(userMapping, 'completed', 100, {
        ...progress,
        endTime,
        itemsProcessed: processed,
        itemsFailed: errors.length,
      });
      onProgress?.(progress);
      
      return {
        success: errors.length === 0,
        progress,
        summary: {
          totalItems: groups.length,
          successfulItems: processed - errors.length,
          failedItems: errors.length,
          skippedItems: 0,
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

  async rollback(userMapping: UserMapping): Promise<boolean> {
    try {
      console.warn('Groups rollback not implemented - manual cleanup required');
      return false;
    } catch (error) {
      console.error('Groups rollback failed:', error);
      return false;
    }
  }

  private async getAllGroups(domain: string): Promise<admin_directory_v1.Schema$Group[]> {
    const groups: admin_directory_v1.Schema$Group[] = [];
    let pageToken: string | undefined;
    
    do {
      const response = await this.sourceAdmin.groups.list({
        domain,
        maxResults: 200,
        pageToken,
      });
      
      if (response.data.groups) {
        groups.push(...response.data.groups);
      }
      
      pageToken = response.data.nextPageToken || undefined;
    } while (pageToken);
    
    return groups;
  }

  private async migrateGroup(
    group: admin_directory_v1.Schema$Group,
    userMapping: UserMapping
  ): Promise<void> {
    if (!group.email) return;
    
    // Map group email to target domain
    const targetGroupEmail = group.email.replace(userMapping.sourceDomain, userMapping.targetDomain);
    
    try {
      // Check if group already exists in target domain
      await this.targetAdmin.groups.get({ groupKey: targetGroupEmail });
      console.warn(`Group ${targetGroupEmail} already exists, skipping creation`);
    } catch (error) {
      // Group doesn't exist, create it
      await this.createGroup(group, targetGroupEmail, userMapping);
    }
    
    // Migrate members if requested
    if (this.options.preserveMembers && group.email) {
      await this.migrateGroupMembers(group.email, targetGroupEmail, userMapping);
    }
  }

  private async createGroup(
    sourceGroup: admin_directory_v1.Schema$Group,
    targetEmail: string,
    userMapping: UserMapping
  ): Promise<void> {
    const groupData: admin_directory_v1.Schema$Group = {
      email: targetEmail,
      name: sourceGroup.name,
      description: sourceGroup.description,
    };
    
    await this.targetAdmin.groups.insert({
      requestBody: groupData,
    });
    
    // Apply group settings if preserveSettings is enabled
    if (this.options.preserveSettings) {
      await this.migrateGroupSettings(sourceGroup.email!, targetEmail);
    }
  }

  private async migrateGroupMembers(
    sourceGroupEmail: string,
    targetGroupEmail: string,
    userMapping: UserMapping
  ): Promise<void> {
    try {
      // Get all members from source group
      const members = await this.getAllGroupMembers(sourceGroupEmail);
      
      for (const member of members) {
        if (!member.email) continue;
        
        try {
          // Map member email to target domain
          const targetMemberEmail = this.mapMemberEmail(member.email, userMapping);
          
          // Add member to target group
          await this.targetAdmin.members.insert({
            groupKey: targetGroupEmail,
            requestBody: {
              email: targetMemberEmail,
              role: member.role,
              type: member.type,
            },
          });
        } catch (error) {
          console.warn(`Failed to add member ${member.email} to group ${targetGroupEmail}:`, error);
        }
        
        await this.delay(this.config.options.throttleMs / 5); // Faster for individual members
      }
    } catch (error) {
      console.error(`Failed to migrate members for group ${sourceGroupEmail}:`, error);
    }
  }

  private async getAllGroupMembers(groupEmail: string): Promise<admin_directory_v1.Schema$Member[]> {
    const members: admin_directory_v1.Schema$Member[] = [];
    let pageToken: string | undefined;
    
    do {
      const response = await this.sourceAdmin.members.list({
        groupKey: groupEmail,
        maxResults: 200,
        pageToken,
      });
      
      if (response.data.members) {
        members.push(...response.data.members);
      }
      
      pageToken = response.data.nextPageToken || undefined;
    } while (pageToken);
    
    return members;
  }

  private async migrateGroupSettings(sourceGroupEmail: string, targetGroupEmail: string): Promise<void> {
    try {
      // Note: Group settings migration would require the Groups Settings API
      // This is a placeholder for the settings migration logic
      console.log(`Migrating settings for group ${sourceGroupEmail} to ${targetGroupEmail}`);
      
      // You would need to:
      // 1. Get group settings from source using Groups Settings API
      // 2. Apply settings to target group
      // This requires additional API setup and permissions
    } catch (error) {
      console.warn(`Failed to migrate settings for group ${targetGroupEmail}:`, error);
    }
  }

  private mapMemberEmail(email: string, userMapping: UserMapping): string {
    // Map emails from source domain to target domain
    if (email.includes(userMapping.sourceDomain)) {
      return email.replace(userMapping.sourceDomain, userMapping.targetDomain);
    }
    
    // For external members, keep the original email
    return email;
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
    
    // For groups, many-to-one means migrating groups from multiple source domains to one target domain
    const sourceDomains = Array.from(new Set(sourceUsers.map(user => user.split('@')[1])));
    const targetDomain = targetUser.split('@')[1];
    
    for (const sourceDomain of sourceDomains) {
      const userMapping: UserMapping = {
        sourceEmail: `admin@${sourceDomain}`,
        targetEmail: targetUser,
        sourceDomain,
        targetDomain,
        status: 'pending',
      };
      
      const result = await this.migrateUser(userMapping);
      results.push(result);
      
      await this.delay(this.config.options.throttleMs * 2);
    }
    
    return results;
  }

  async migrateOneToMany(sourceUser: string, targetUsers: string[]): Promise<MigrationResult[]> {
    const results: MigrationResult[] = [];
    
    // For groups, one-to-many means migrating groups from one source domain to multiple target domains
    const sourceDomain = sourceUser.split('@')[1];
    const targetDomains = Array.from(new Set(targetUsers.map(user => user.split('@')[1])));
    
    for (const targetDomain of targetDomains) {
      const userMapping: UserMapping = {
        sourceEmail: sourceUser,
        targetEmail: `admin@${targetDomain}`,
        sourceDomain,
        targetDomain,
        status: 'pending',
      };
      
      const result = await this.migrateUser(userMapping);
      results.push(result);
      
      await this.delay(this.config.options.throttleMs * 2);
    }
    
    return results;
  }
}
