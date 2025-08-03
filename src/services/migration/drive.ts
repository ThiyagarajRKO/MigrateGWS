/**
 * Google Drive Migration Service
 * Handles migration of Drive files, folders, and sharing permissions
 */

import { drive_v3, google } from 'googleapis';
import { BaseMigrationService, UserMapping, MigrationResult, MigrationProgress, DriveMigrationOptions } from './types';

export class DriveMigrationService extends BaseMigrationService {
  private sourceDrive: drive_v3.Drive;
  private targetDrive: drive_v3.Drive;
  private options: DriveMigrationOptions;

  constructor(credentials: any, config: any, options: DriveMigrationOptions) {
    super('drive', credentials, config);
    this.options = options;
    
    this.sourceDrive = google.drive({ version: 'v3', auth: credentials.sourceAuth });
    this.targetDrive = google.drive({ version: 'v3', auth: credentials.targetAuth });
  }

  async validatePermissions(userMapping: UserMapping): Promise<boolean> {
    try {
      // Check source permissions
      await this.sourceDrive.about.get({ fields: 'user' });
      
      // Check target permissions  
      await this.targetDrive.about.get({ fields: 'user' });
      
      return true;
    } catch (error) {
      console.error('Drive permission validation failed:', error);
      return false;
    }
  }

  async estimateItems(userMapping: UserMapping): Promise<number> {
    try {
      let totalFiles = 0;
      let pageToken: string | undefined;
      
      do {
        const response = await this.sourceDrive.files.list({
          pageToken,
          pageSize: 1000,
          fields: 'nextPageToken, files(id)',
          q: `'me' in owners and trashed=false`,
        });
        
        totalFiles += response.data.files?.length || 0;
        pageToken = response.data.nextPageToken || undefined;
      } while (pageToken);
      
      return totalFiles;
    } catch (error) {
      console.error('Drive estimation failed:', error);
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
      // Step 1: Get all files and folders
      onProgress?.(progress);
      const allFiles = await this.getAllFiles();
      progress.itemsTotal = allFiles.length;
      
      // Step 2: Create folder structure first
      const folders = allFiles.filter(file => file.mimeType === 'application/vnd.google-apps.folder');
      const files = allFiles.filter(file => file.mimeType !== 'application/vnd.google-apps.folder');
      
      const folderMapping = new Map<string, string>();
      let processed = 0;
      const errors: string[] = [];
      
      // Step 3: Migrate folders first to preserve structure
      if (this.options.preserveFolderStructure) {
        for (const folder of folders) {
          try {
            const newFolderId = await this.migrateFolder(folder, folderMapping);
            if (newFolderId && folder.id) {
              folderMapping.set(folder.id, newFolderId);
            }
            processed++;
          } catch (error) {
            errors.push(`Failed to migrate folder ${folder.name}: ${error}`);
          }
          
          progress = this.createProgress(userMapping, 'in-progress',
            Math.round((processed / allFiles.length) * 100), {
              ...progress,
              itemsProcessed: processed,
              itemsFailed: errors.length,
              details: {
                currentItem: `Folder: ${folder.name}`,
              }
            });
          onProgress?.(progress);
          
          await this.delay(this.config.options.throttleMs);
        }
      }
      
      // Step 4: Migrate files
      for (const file of files) {
        try {
          await this.migrateFile(file, folderMapping, userMapping);
          processed++;
        } catch (error) {
          errors.push(`Failed to migrate file ${file.name}: ${error}`);
        }
        
        progress = this.createProgress(userMapping, 'in-progress',
          Math.round((processed / allFiles.length) * 100), {
            ...progress,
            itemsProcessed: processed,
            itemsFailed: errors.length,
            details: {
              currentItem: `File: ${file.name}`,
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
          totalItems: allFiles.length,
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
      // Drive rollback would need to track migrated files
      console.warn('Drive rollback not implemented - manual cleanup required');
      return false;
    } catch (error) {
      console.error('Drive rollback failed:', error);
      return false;
    }
  }

  private async getAllFiles(): Promise<drive_v3.Schema$File[]> {
    const files: drive_v3.Schema$File[] = [];
    let pageToken: string | undefined;
    
    do {
      const response = await this.sourceDrive.files.list({
        pageToken,
        pageSize: 1000,
        fields: 'nextPageToken, files(id, name, mimeType, parents, size, permissions, webViewLink)',
        q: `'me' in owners and trashed=false`,
      });
      
      if (response.data.files) {
        files.push(...response.data.files);
      }
      
      pageToken = response.data.nextPageToken || undefined;
    } while (pageToken);
    
    return files;
  }

  private async migrateFolder(
    folder: drive_v3.Schema$File,
    folderMapping: Map<string, string>
  ): Promise<string | null> {
    const parentId = folder.parents?.[0];
    const newParentId = parentId ? folderMapping.get(parentId) : undefined;
    
    const response = await this.targetDrive.files.create({
      requestBody: {
        name: folder.name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: newParentId ? [newParentId] : undefined,
      },
    });
    
    return response.data.id || null;
  }

  private async migrateFile(
    file: drive_v3.Schema$File,
    folderMapping: Map<string, string>,
    userMapping: UserMapping
  ): Promise<void> {
    if (!file.id) return;
    
    // Check file size limit
    const fileSize = parseInt(file.size || '0');
    if (fileSize > this.options.maxFileSize) {
      throw new Error(`File too large: ${fileSize} bytes`);
    }
    
    // Determine parent folder
    const parentId = file.parents?.[0];
    const newParentId = parentId ? folderMapping.get(parentId) : undefined;
    
    // Download file content
    const content = await this.sourceDrive.files.get({
      fileId: file.id,
      alt: 'media',
    });
    
    // Upload to target
    const response = await this.targetDrive.files.create({
      requestBody: {
        name: file.name,
        parents: newParentId ? [newParentId] : undefined,
      },
      media: {
        body: content.data as any,
      },
    });
    
    // Preserve permissions if requested
    if (this.config.options.preservePermissions && file.permissions) {
      await this.migratePermissions(file, response.data.id!, userMapping);
    }
  }

  private async migratePermissions(
    sourceFile: drive_v3.Schema$File,
    targetFileId: string,
    userMapping: UserMapping
  ): Promise<void> {
    if (!sourceFile.permissions) return;
    
    for (const permission of sourceFile.permissions) {
      try {
        // Skip owner permissions
        if (permission.role === 'owner') continue;
        
        // Map email addresses from source domain to target domain
        let emailAddress = permission.emailAddress;
        if (emailAddress && emailAddress.includes(userMapping.sourceDomain)) {
          emailAddress = emailAddress.replace(userMapping.sourceDomain, userMapping.targetDomain);
        }
        
        await this.targetDrive.permissions.create({
          fileId: targetFileId,
          requestBody: {
            role: permission.role,
            type: permission.type,
            emailAddress,
          },
        });
      } catch (error) {
        console.warn(`Failed to migrate permission for ${targetFileId}:`, error);
      }
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
      
      await this.delay(this.config.options.throttleMs * 2);
    }
    
    return results;
  }
}
