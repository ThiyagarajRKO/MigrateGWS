/**
 * Google Drive API Service with Comprehensive Quota Management
 * Handles rate limiting, exponential backoff, and real-time monitoring
 */

import { migrationLogger } from '@/lib/migration-websocket-logger';

export interface DriveQuotaConfig {
  maxRequestsPerMinute: number;
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  jitterPercent: number;
  batchSize: number;
  warningThreshold: number;
  criticalThreshold: number;
}

export interface DriveQuotaUsage {
  requestsThisMinute: number;
  requestsToday: number;
  lastReset: number;
  windowStart: number;
}

export interface DriveFileMetadata {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  parents?: string[];
  modifiedTime: string;
  createdTime: string;
}

export interface DriveAPIError extends Error {
  status?: number;
  code?: string;
  quotaExceeded?: boolean;
  retryAfter?: number;
}

export class DriveAPIQuotaManager {
  private quotaUsage: DriveQuotaUsage = {
    requestsThisMinute: 0,
    requestsToday: 0,
    lastReset: Date.now(),
    windowStart: Date.now()
  };

  private readonly config: DriveQuotaConfig = {
    maxRequestsPerMinute: 900, // 90% of 1000 limit for safety
    maxRetries: 5,
    baseDelay: 60000, // 1 minute
    maxDelay: 3600000, // 1 hour
    jitterPercent: 20,
    batchSize: 10,
    warningThreshold: 0.8,
    criticalThreshold: 0.95
  };

  constructor(config?: Partial<DriveQuotaConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Throttle requests to stay within quota limits
   */
  async throttle(): Promise<void> {
    const now = Date.now();
    const windowElapsed = now - this.quotaUsage.windowStart;

    // Reset window if 1 minute has passed
    if (windowElapsed >= 60000) {
      this.quotaUsage.requestsThisMinute = 0;
      this.quotaUsage.windowStart = now;
      return;
    }

    // Check if we need to wait
    if (this.quotaUsage.requestsThisMinute >= this.config.maxRequestsPerMinute) {
      const waitTime = 60000 - windowElapsed;
      
      migrationLogger.log({
        level: 'warning',
        category: 'api',
        service: 'drive',
        message: 'Rate limit approaching - throttling requests',
        details: {
          waitTime: `${waitTime}ms`,
          requestsThisMinute: this.quotaUsage.requestsThisMinute,
          limit: this.config.maxRequestsPerMinute
        }
      });

      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.quotaUsage.requestsThisMinute = 0;
      this.quotaUsage.windowStart = Date.now();
    }

    this.quotaUsage.requestsThisMinute++;
    this.quotaUsage.requestsToday++;

    // Log quota warnings
    const minuteUsage = this.quotaUsage.requestsThisMinute / this.config.maxRequestsPerMinute;
    if (minuteUsage > this.config.warningThreshold) {
      migrationLogger.log({
        level: minuteUsage > this.config.criticalThreshold ? 'error' : 'warning',
        category: 'api',
        service: 'drive',
        message: 'Quota usage threshold exceeded',
        details: {
          usage: `${Math.round(minuteUsage * 100)}%`,
          requestsThisMinute: this.quotaUsage.requestsThisMinute,
          limit: this.config.maxRequestsPerMinute,
          threshold: minuteUsage > this.config.criticalThreshold ? 'critical' : 'warning'
        }
      });
    }
  }

  /**
   * Calculate exponential backoff delay with jitter
   */
  calculateBackoffDelay(attempt: number): number {
    const exponentialDelay = Math.min(
      Math.pow(2, attempt) * this.config.baseDelay,
      this.config.maxDelay
    );

    // Add jitter to prevent thundering herd
    const jitter = exponentialDelay * (this.config.jitterPercent / 100) * Math.random();
    return exponentialDelay + jitter;
  }

  /**
   * Handle API calls with comprehensive error handling and retry logic
   */
  async handleAPICall<T>(
    apiCall: () => Promise<T>,
    context: { endpoint: string; migrationId?: string; fileId?: string }
  ): Promise<T> {
    let attempt = 0;

    while (attempt < this.config.maxRetries) {
      try {
        // Throttle before making the call
        await this.throttle();

        // Log API call attempt
        migrationLogger.apiCall('drive', `Making API call to ${context.endpoint}`, {
          endpoint: context.endpoint,
          attempt: attempt + 1,
          migrationId: context.migrationId,
          fileId: context.fileId,
          quotaUsage: this.quotaUsage
        });

        const startTime = Date.now();
        const result = await apiCall();
        const responseTime = Date.now() - startTime;

        // Log successful API call
        migrationLogger.apiSuccess('drive', `API call successful: ${context.endpoint}`, {
          endpoint: context.endpoint,
          responseTime: `${responseTime}ms`,
          migrationId: context.migrationId,
          fileId: context.fileId
        });

        return result;

      } catch (error: any) {
        const driveError: DriveAPIError = error;

        // Check if this is a quota exceeded error
        if (driveError.status === 429 || driveError.code === 'rateLimitExceeded') {
          driveError.quotaExceeded = true;
          
          const delay = this.calculateBackoffDelay(attempt);
          driveError.retryAfter = delay;

          migrationLogger.apiError('drive', 'Quota exceeded - implementing exponential backoff', {
            endpoint: context.endpoint,
            error: driveError.message,
            attempt: attempt + 1,
            maxRetries: this.config.maxRetries,
            retryAfter: `${Math.round(delay / 1000)}s`,
            quotaUsage: this.quotaUsage,
            migrationId: context.migrationId,
            fileId: context.fileId
          });

          if (attempt < this.config.maxRetries - 1) {
            console.log(`Quota exceeded. Retrying in ${Math.round(delay / 1000)} seconds... (Attempt ${attempt + 1}/${this.config.maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            attempt++;
            continue;
          }
        }

        // Log non-quota errors
        migrationLogger.apiError('drive', `API call failed: ${context.endpoint}`, {
          endpoint: context.endpoint,
          error: driveError.message,
          status: driveError.status,
          isQuotaError: driveError.quotaExceeded || false,
          attempt: attempt + 1,
          migrationId: context.migrationId,
          fileId: context.fileId
        });

        throw driveError;
      }
    }

    throw new Error(`Max retries (${this.config.maxRetries}) exceeded for quota errors`);
  }

  /**
   * Get current quota usage statistics
   */
  getQuotaUsage(): DriveQuotaUsage & { usagePercent: number } {
    const usagePercent = (this.quotaUsage.requestsThisMinute / this.config.maxRequestsPerMinute) * 100;
    return {
      ...this.quotaUsage,
      usagePercent
    };
  }

  /**
   * Reset quota counters (for testing or manual reset)
   */
  resetQuota(): void {
    this.quotaUsage = {
      requestsThisMinute: 0,
      requestsToday: 0,
      lastReset: Date.now(),
      windowStart: Date.now()
    };

    migrationLogger.log({
      level: 'info',
      category: 'api',
      service: 'drive',
      message: 'Quota counters reset',
      details: { resetTime: new Date().toISOString() }
    });
  }
}

export class DriveAPIService {
  private quotaManager: DriveAPIQuotaManager;
  private accessToken: string;

  constructor(accessToken: string, quotaConfig?: Partial<DriveQuotaConfig>) {
    this.accessToken = accessToken;
    this.quotaManager = new DriveAPIQuotaManager(quotaConfig);
  }

  /**
   * List files with quota-aware pagination
   */
  async listFiles(
    query: string = '',
    pageSize: number = 100,
    migrationId?: string
  ): Promise<{ files: DriveFileMetadata[]; nextPageToken?: string }> {
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&pageSize=${pageSize}&fields=files(id,name,mimeType,size,parents,modifiedTime,createdTime),nextPageToken`;

    return this.quotaManager.handleAPICall(
      async () => {
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          const error: DriveAPIError = new Error(`Drive API error: ${response.statusText}`);
          error.status = response.status;
          throw error;
        }

        return response.json();
      },
      { endpoint: 'files.list', migrationId }
    );
  }

  /**
   * Copy file with quota handling
   */
  async copyFile(
    fileId: string,
    targetParentId: string,
    newName?: string,
    migrationId?: string
  ): Promise<DriveFileMetadata> {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}/copy`;

    const body = {
      name: newName,
      parents: [targetParentId]
    };

    return this.quotaManager.handleAPICall(
      async () => {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        });

        if (!response.ok) {
          const error: DriveAPIError = new Error(`Drive API error: ${response.statusText}`);
          error.status = response.status;
          throw error;
        }

        return response.json();
      },
      { endpoint: 'files.copy', migrationId, fileId }
    );
  }

  /**
   * Create folder with quota handling
   */
  async createFolder(
    name: string,
    parentId?: string,
    migrationId?: string
  ): Promise<DriveFileMetadata> {
    const url = 'https://www.googleapis.com/drive/v3/files';

    const body = {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined
    };

    return this.quotaManager.handleAPICall(
      async () => {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        });

        if (!response.ok) {
          const error: DriveAPIError = new Error(`Drive API error: ${response.statusText}`);
          error.status = response.status;
          throw error;
        }

        return response.json();
      },
      { endpoint: 'files.create', migrationId }
    );
  }

  /**
   * Migrate files in batches with comprehensive error handling
   */
  async migrateBatch(
    files: Array<{ id: string; name: string; targetParentId: string }>,
    migrationId: string,
    onProgress?: (progress: { completed: number; failed: number; total: number }) => void
  ): Promise<{ 
    results: Array<{ fileId: string; success: boolean; error?: string; newFileId?: string }>;
    quotaStats: ReturnType<DriveAPIQuotaManager['getQuotaUsage']>;
  }> {
    const results: Array<{ fileId: string; success: boolean; error?: string; newFileId?: string }> = [];
    let completed = 0;
    let failed = 0;

    migrationLogger.log({
      level: 'info',
      category: 'migration',
      service: 'drive',
      message: `Starting batch migration of ${files.length} files`,
      migrationId,
      details: {
        batchSize: files.length,
        totalFiles: files.length
      }
    });

    for (const file of files) {
      try {
        const newFile = await this.copyFile(file.id, file.targetParentId, file.name, migrationId);
        
        results.push({
          fileId: file.id,
          success: true,
          newFileId: newFile.id
        });
        
        completed++;

        migrationLogger.log({
          level: 'success',
          category: 'migration',
          service: 'drive',
          message: `File copied successfully: ${file.name}`,
          migrationId,
          details: {
            fileId: file.id,
            newFileId: newFile.id,
            fileName: file.name,
            progress: Math.round((completed / files.length) * 100)
          }
        });

      } catch (error: any) {
        const driveError = error as DriveAPIError;
        
        results.push({
          fileId: file.id,
          success: false,
          error: driveError.message
        });
        
        failed++;

        migrationLogger.log({
          level: 'error',
          category: 'migration',
          service: 'drive',
          message: `Failed to copy file: ${file.name}`,
          migrationId,
          details: {
            fileId: file.id,
            fileName: file.name,
            error: driveError.message,
            isQuotaError: driveError.quotaExceeded || false,
            retryAfter: driveError.retryAfter
          }
        });
      }

      // Report progress
      if (onProgress) {
        onProgress({ completed, failed, total: files.length });
      }

      // Small delay between files to be gentle on the API
      if (completed + failed < files.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const quotaStats = this.quotaManager.getQuotaUsage();

    migrationLogger.log({
      level: 'success',
      category: 'migration',
      service: 'drive',
      message: `Batch migration completed`,
      migrationId,
      details: {
        totalFiles: files.length,
        successful: completed,
        failed: failed,
        successRate: `${Math.round((completed / files.length) * 100)}%`,
        quotaUsage: `${Math.round(quotaStats.usagePercent)}%`
      }
    });

    return { results, quotaStats };
  }

  /**
   * Get quota usage statistics
   */
  getQuotaUsage() {
    return this.quotaManager.getQuotaUsage();
  }

  /**
   * Reset quota counters
   */
  resetQuota() {
    this.quotaManager.resetQuota();
  }
}

export default DriveAPIService;
