/**
 * Gmail Migration Service
 * Handles migration of Gmail messages, labels, and settings
 */

import { gmail_v1, google } from 'googleapis';
import { BaseMigrationService, UserMapping, MigrationResult, MigrationProgress, GmailMigrationOptions } from './types';

export class GmailMigrationService extends BaseMigrationService {
  private sourceGmail: gmail_v1.Gmail;
  private targetGmail: gmail_v1.Gmail;
  private options: GmailMigrationOptions;

  constructor(credentials: any, config: any, options: GmailMigrationOptions) {
    super('gmail', credentials, config);
    this.options = options;
    
    // Initialize Gmail API clients
    this.sourceGmail = google.gmail({ version: 'v1', auth: credentials.sourceAuth });
    this.targetGmail = google.gmail({ version: 'v1', auth: credentials.targetAuth });
  }

  async validatePermissions(userMapping: UserMapping): Promise<boolean> {
    try {
      // Check source permissions
      await this.sourceGmail.users.getProfile({ userId: userMapping.sourceEmail });
      
      // Check target permissions
      await this.targetGmail.users.getProfile({ userId: userMapping.targetEmail });
      
      return true;
    } catch (error) {
      console.error('Gmail permission validation failed:', error);
      return false;
    }
  }

  async estimateItems(userMapping: UserMapping): Promise<number> {
    try {
      const response = await this.sourceGmail.users.messages.list({
        userId: userMapping.sourceEmail,
        includeSpamTrash: this.options.includeSpam || this.options.includeTrash,
      });
      
      return response.data.resultSizeEstimate || 0;
    } catch (error) {
      console.error('Gmail estimation failed:', error);
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
      // Step 1: Get all messages
      onProgress?.(progress);
      const messages = await this.getAllMessages(userMapping.sourceEmail);
      progress.itemsTotal = messages.length;
      
      // Step 2: Migrate labels first
      await this.migrateLabels(userMapping);
      
      // Step 3: Migrate messages in batches
      const batchSize = this.config.options.batchSize;
      let processed = 0;
      const errors: string[] = [];
      
      for (let i = 0; i < messages.length; i += batchSize) {
        const batch = messages.slice(i, i + batchSize);
        
        for (const message of batch) {
          try {
            await this.migrateMessage(message, userMapping);
            processed++;
          } catch (error) {
            errors.push(`Failed to migrate message ${message.id}: ${error}`);
          }
          
          // Update progress
          progress = this.createProgress(userMapping, 'in-progress', 
            Math.round((processed / messages.length) * 100), {
              ...progress,
              itemsProcessed: processed,
              itemsFailed: errors.length,
              details: {
                currentItem: `Message ${message.id}`,
                lastSuccessfulItem: processed > 0 ? `Message ${message.id}` : undefined,
                failedItems: errors.slice(-5), // Last 5 failures
              }
            });
          onProgress?.(progress);
          
          // Throttle requests
          await this.delay(this.config.options.throttleMs);
        }
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
          totalItems: messages.length,
          successfulItems: processed,
          failedItems: errors.length,
          skippedItems: 0,
        },
        errors,
        warnings: [],
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
      // Gmail rollback is complex - would need to track what was migrated
      // For now, this is a placeholder
      console.warn('Gmail rollback not implemented - manual cleanup required');
      return false;
    } catch (error) {
      console.error('Gmail rollback failed:', error);
      return false;
    }
  }

  private async getAllMessages(userId: string): Promise<gmail_v1.Schema$Message[]> {
    const messages: gmail_v1.Schema$Message[] = [];
    let pageToken: string | undefined;
    
    do {
      const response = await this.sourceGmail.users.messages.list({
        userId,
        pageToken,
        includeSpamTrash: this.options.includeSpam || this.options.includeTrash,
        maxResults: 500,
      });
      
      if (response.data.messages) {
        messages.push(...response.data.messages);
      }
      
      pageToken = response.data.nextPageToken || undefined;
    } while (pageToken);
    
    return messages;
  }

  private async migrateLabels(userMapping: UserMapping): Promise<void> {
    if (!this.options.preserveLabels) return;
    
    // Get source labels
    const sourceLabels = await this.sourceGmail.users.labels.list({
      userId: userMapping.sourceEmail,
    });
    
    // Create labels in target account
    const targetLabels = await this.targetGmail.users.labels.list({
      userId: userMapping.targetEmail,
    });
    
    const existingLabelNames = new Set(
      targetLabels.data.labels?.map(label => label.name) || []
    );
    
    for (const label of sourceLabels.data.labels || []) {
      if (label.type === 'user' && label.name && !existingLabelNames.has(label.name)) {
        try {
          await this.targetGmail.users.labels.create({
            userId: userMapping.targetEmail,
            requestBody: {
              name: label.name,
              labelListVisibility: label.labelListVisibility,
              messageListVisibility: label.messageListVisibility,
            },
          });
        } catch (error) {
          console.warn(`Failed to create label ${label.name}:`, error);
        }
      }
    }
  }

  private async migrateMessage(
    message: gmail_v1.Schema$Message,
    userMapping: UserMapping
  ): Promise<void> {
    if (!message.id) return;
    
    // Get full message from source
    const fullMessage = await this.sourceGmail.users.messages.get({
      userId: userMapping.sourceEmail,
      id: message.id,
      format: 'raw',
    });
    
    if (!fullMessage.data.raw) {
      throw new Error(`No raw content for message ${message.id}`);
    }
    
    // Import message to target account
    await this.withRetry(async () => {
      await this.targetGmail.users.messages.import({
        userId: userMapping.targetEmail,
        requestBody: {
          raw: fullMessage.data.raw,
        },
      });
    });
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
      
      // Add delay between user migrations
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
      
      // Add delay between user migrations
      await this.delay(this.config.options.throttleMs * 2);
    }
    
    return results;
  }
}
