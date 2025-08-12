/**
 * Enhanced Drive API Service with Quota Management
 * Handles Drive API operations with automatic quota error recovery
 */

import { google, drive_v3 } from 'googleapis';
import { migrationLogger } from './migration-websocket-logger';
import { 
  DriveAPIRateLimiter, 
  handleDriveAPICall, 
  DRIVE_API_CONFIG,
  QuotaUsage 
} from './drive-api-rate-limiter';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  parents?: string[];
  webViewLink?: string;
  downloadUrl?: string;
}

export interface MigrationProgress {
  totalFiles: number;
  processedFiles: number;
  failedFiles: number;
  quotaErrors: number;
  currentFile?: string;
  estimatedTimeRemaining?: string;
  successRate: number;
}

export class EnhancedDriveAPIService {
  private drive: drive_v3.Drive;
  private rateLimiter: DriveAPIRateLimiter;
  private quotaUsage: QuotaUsage;

  constructor(private auth: any) {
    this.drive = google.drive({ version: 'v3', auth });
    this.rateLimiter = new DriveAPIRateLimiter();
    this.quotaUsage = this.rateLimiter.getQuotaUsage();
  }

  async listFiles(options: {
    folderId?: string;
    pageSize?: number;
    query?: string;
    fields?: string;
  } = {}): Promise<DriveFile[]> {
    await this.rateLimiter.throttle();

    return handleDriveAPICall(
      async () => {
        const response = await this.drive.files.list({
          q: options.query || (options.folderId ? `'${options.folderId}' in parents` : undefined),
          pageSize: options.pageSize || 100,
          fields: options.fields || 'files(id,name,mimeType,size,parents,webViewLink)'
        });

        this.updateQuotaUsage();
        return response.data.files as DriveFile[];
      },
      {
        endpoint: 'drive.files.list',
        operation: 'list_files'
      }
    );
  }

  async getFile(fileId: string, fields?: string): Promise<DriveFile> {
    await this.rateLimiter.throttle();

    return handleDriveAPICall(
      async () => {
        const response = await this.drive.files.get({
          fileId,
          fields: fields || 'id,name,mimeType,size,parents,webViewLink'
        });

        this.updateQuotaUsage();
        return response.data as DriveFile;
      },
      {
        endpoint: 'drive.files.get',
        fileId,
        operation: 'get_file'
      }
    );
  }

  async copyFile(
    fileId: string,
    destinationFolderId: string,
    newName?: string
  ): Promise<DriveFile> {
    await this.rateLimiter.throttle();

    return handleDriveAPICall(
      async () => {
        const response = await this.drive.files.copy({
          fileId,
          requestBody: {
            name: newName,
            parents: [destinationFolderId]
          }
        });

        this.updateQuotaUsage();
        return response.data as DriveFile;
      },
      {
        endpoint: 'drive.files.copy',
        fileId,
        operation: 'copy_file'
      }
    );
  }

  async createFolder(name: string, parentId?: string): Promise<DriveFile> {
    await this.rateLimiter.throttle();

    return handleDriveAPICall(
      async () => {
        const response = await this.drive.files.create({
          requestBody: {
            name,
            mimeType: 'application/vnd.google-apps.folder',
            parents: parentId ? [parentId] : undefined
          }
        });

        this.updateQuotaUsage();
        return response.data as DriveFile;
      },
      {
        endpoint: 'drive.files.create',
        operation: 'create_folder',
        fileName: name
      }
    );
  }

  async downloadFile(fileId: string, fileName: string): Promise<Buffer> {
    await this.rateLimiter.throttle();

    return handleDriveAPICall(
      async () => {
        const response = await this.drive.files.get({
          fileId,
          alt: 'media'
        }, { responseType: 'arraybuffer' });

        this.updateQuotaUsage();
        return Buffer.from(response.data as ArrayBuffer);
      },
      {
        endpoint: 'drive.files.get.media',
        fileId,
        fileName,
        operation: 'download_file'
      }
    );
  }

  async uploadFile(
    name: string,
    content: Buffer,
    mimeType: string,
    parentId?: string
  ): Promise<DriveFile> {
    await this.rateLimiter.throttle();

    return handleDriveAPICall(
      async () => {
        const response = await this.drive.files.create({
          requestBody: {
            name,
            parents: parentId ? [parentId] : undefined
          },
          media: {
            mimeType,
            body: content
          }
        });

        this.updateQuotaUsage();
        return response.data as DriveFile;
      },
      {
        endpoint: 'drive.files.create.upload',
        fileName: name,
        operation: 'upload_file'
      }
    );
  }

  async migrateFile(
    sourceFile: DriveFile,
    targetFolderId: string,
    options: {
      preserveName?: boolean;
      namePrefix?: string;
      nameSuffix?: string;
    } = {}
  ): Promise<DriveFile> {
    const fileName = sourceFile.name;
    let newName = fileName;

    if (options.namePrefix) newName = options.namePrefix + newName;
    if (options.nameSuffix) newName = newName + options.nameSuffix;
    if (!options.preserveName && options.namePrefix) {
      newName = options.namePrefix + '_' + fileName;
    }

    migrationLogger.log({
      level: 'info',
      category: 'migration',
      service: 'drive',
      message: `Starting file migration: ${fileName}`,
      details: {
        sourceFileId: sourceFile.id,
        sourceFileName: fileName,
        targetFolderId,
        newName,
        mimeType: sourceFile.mimeType,
        size: sourceFile.size
      }
    });

    try {
      // For Google Workspace files, use copy
      if (sourceFile.mimeType.startsWith('application/vnd.google-apps.')) {
        return await this.copyFile(sourceFile.id, targetFolderId, newName);
      }

      // For regular files, download and re-upload
      const fileContent = await this.downloadFile(sourceFile.id, fileName);
      return await this.uploadFile(newName, fileContent, sourceFile.mimeType, targetFolderId);

    } catch (error: any) {
      migrationLogger.log({
        level: 'error',
        category: 'migration',
        service: 'drive',
        message: `File migration failed: ${fileName}`,
        details: {
          sourceFileId: sourceFile.id,
          sourceFileName: fileName,
          targetFolderId,
          error: error.message,
          isQuotaError: error.status === 429 || error.message.includes('quota')
        }
      });
      throw error;
    }
  }

  async migrateFolderStructure(
    sourceFolderId: string,
    targetParentId: string,
    options: {
      preserveStructure?: boolean;
      nameMapping?: Record<string, string>;
      onProgress?: (progress: MigrationProgress) => void;
    } = {}
  ): Promise<{
    migratedFiles: DriveFile[];
    migratedFolders: DriveFile[];
    errors: Array<{ file: DriveFile; error: string }>;
  }> {
    const results = {
      migratedFiles: [] as DriveFile[],
      migratedFolders: [] as DriveFile[],
      errors: [] as Array<{ file: DriveFile; error: string }>
    };

    migrationLogger.log({
      level: 'info',
      category: 'migration',
      service: 'drive',
      message: 'Starting folder structure migration',
      details: {
        sourceFolderId,
        targetParentId,
        preserveStructure: options.preserveStructure
      }
    });

    // Get all files and folders in source
    const allItems = await this.listFiles({
      folderId: sourceFolderId,
      query: `'${sourceFolderId}' in parents`,
      pageSize: 1000
    });

    const folders = allItems.filter(item => item.mimeType === 'application/vnd.google-apps.folder');
    const files = allItems.filter(item => item.mimeType !== 'application/vnd.google-apps.folder');

    let processedItems = 0;
    const totalItems = folders.length + files.length;

    // Create folders first if preserving structure
    if (options.preserveStructure) {
      for (const folder of folders) {
        try {
          const newFolder = await this.createFolder(folder.name, targetParentId);
          results.migratedFolders.push(newFolder);
          
          migrationLogger.log({
            level: 'success',
            category: 'migration',
            service: 'drive',
            message: `Folder created: ${folder.name}`,
            details: {
              sourceFolderId: folder.id,
              targetFolderId: newFolder.id,
              folderName: folder.name
            }
          });
        } catch (error: any) {
          results.errors.push({ file: folder, error: error.message });
        }
        
        processedItems++;
        options.onProgress?.({
          totalFiles: totalItems,
          processedFiles: processedItems,
          failedFiles: results.errors.length,
          quotaErrors: results.errors.filter(e => e.error.includes('quota')).length,
          currentFile: folder.name,
          successRate: (processedItems - results.errors.length) / processedItems * 100
        });
      }
    }

    // Migrate files
    for (const file of files) {
      try {
        const migratedFile = await this.migrateFile(file, targetParentId);
        results.migratedFiles.push(migratedFile);
      } catch (error: any) {
        results.errors.push({ file, error: error.message });
      }
      
      processedItems++;
      options.onProgress?.({
        totalFiles: totalItems,
        processedFiles: processedItems,
        failedFiles: results.errors.length,
        quotaErrors: results.errors.filter(e => e.error.includes('quota')).length,
        currentFile: file.name,
        successRate: (processedItems - results.errors.length) / processedItems * 100
      });
    }

    migrationLogger.log({
      level: results.errors.length > 0 ? 'warning' : 'success',
      category: 'migration',
      service: 'drive',
      message: 'Folder structure migration completed',
      details: {
        totalItems,
        migratedFiles: results.migratedFiles.length,
        migratedFolders: results.migratedFolders.length,
        errors: results.errors.length,
        successRate: `${Math.round(((totalItems - results.errors.length) / totalItems) * 100)}%`
      }
    });

    return results;
  }

  private updateQuotaUsage(): void {
    this.quotaUsage = this.rateLimiter.getQuotaUsage();
  }

  getQuotaUsage(): QuotaUsage {
    return this.rateLimiter.getQuotaUsage();
  }

  resetQuota(): void {
    this.rateLimiter.resetQuota();
  }

  async testAPIConnection(): Promise<{
    success: boolean;
    quotaUsage: QuotaUsage;
    responseTime: number;
  }> {
    const startTime = Date.now();
    
    try {
      await this.listFiles({ pageSize: 1 });
      const responseTime = Date.now() - startTime;
      
      migrationLogger.log({
        level: 'success',
        category: 'api',
        service: 'drive',
        message: 'Drive API connection test successful',
        details: {
          responseTime: `${responseTime}ms`,
          quotaUsage: this.getQuotaUsage()
        }
      });

      return {
        success: true,
        quotaUsage: this.getQuotaUsage(),
        responseTime
      };
    } catch (error: any) {
      migrationLogger.log({
        level: 'error',
        category: 'api',
        service: 'drive',
        message: 'Drive API connection test failed',
        details: {
          error: error.message,
          responseTime: Date.now() - startTime
        }
      });

      throw error;
    }
  }
}
