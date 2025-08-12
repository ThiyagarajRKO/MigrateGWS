/**
 * Drive API Rate Limiter with Exponential Backoff
 * Prevents quota exceeded errors and handles recovery
 */

import { migrationLogger } from './migration-websocket-logger';

export interface QuotaUsage {
  requestsThisMinute: number;
  requestsToday: number;
  lastReset: number;
  windowStart: number;
}

export interface DriveAPIConfig {
  batchSize: number;
  requestsPerMinute: number;
  retryStrategy: 'exponential_backoff';
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  jitterPercent: number;
  quotaMonitoring: {
    enabled: boolean;
    warningThreshold: number;
    criticalThreshold: number;
  };
}

export const DRIVE_API_CONFIG: DriveAPIConfig = {
  batchSize: 10,
  requestsPerMinute: 900, // 90% of API limit for safety margin
  retryStrategy: 'exponential_backoff',
  maxRetries: 5,
  baseDelay: 60000, // 1 minute initial delay
  maxDelay: 3600000, // 1 hour maximum delay
  jitterPercent: 20, // Random jitter to prevent thundering herd
  quotaMonitoring: {
    enabled: true,
    warningThreshold: 0.8, // Warn at 80% quota usage
    criticalThreshold: 0.95 // Critical at 95% quota usage
  }
};

export class DriveAPIRateLimiter {
  private requestCount = 0;
  private windowStart = Date.now();
  private readonly maxRequestsPerMinute: number;
  private quotaUsage: QuotaUsage;

  constructor(config: DriveAPIConfig = DRIVE_API_CONFIG) {
    this.maxRequestsPerMinute = config.requestsPerMinute;
    this.quotaUsage = {
      requestsThisMinute: 0,
      requestsToday: 0,
      lastReset: Date.now(),
      windowStart: Date.now()
    };
  }

  async throttle(): Promise<void> {
    const now = Date.now();
    const windowElapsed = now - this.windowStart;
    
    // Reset window if 1 minute has passed
    if (windowElapsed >= 60000) {
      this.requestCount = 0;
      this.windowStart = now;
      this.quotaUsage.requestsThisMinute = 0;
      this.quotaUsage.lastReset = now;
      return;
    }
    
    // Check if we need to wait
    if (this.requestCount >= this.maxRequestsPerMinute) {
      const waitTime = 60000 - windowElapsed;
      
      migrationLogger.log({
        level: 'warning',
        category: 'api',
        service: 'drive',
        message: 'Rate limit approaching - throttling requests',
        details: {
          waitTime: `${waitTime}ms`,
          requestsThisMinute: this.requestCount,
          limit: this.maxRequestsPerMinute,
          usage: `${Math.round((this.requestCount / this.maxRequestsPerMinute) * 100)}%`
        }
      });

      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.requestCount = 0;
      this.windowStart = Date.now();
      this.quotaUsage.requestsThisMinute = 0;
      this.quotaUsage.lastReset = Date.now();
    }
    
    this.requestCount++;
    this.quotaUsage.requestsThisMinute++;
    this.quotaUsage.requestsToday++;
    
    this.checkQuotaWarnings();
  }

  private checkQuotaWarnings(): void {
    const minuteUsage = this.quotaUsage.requestsThisMinute / 1000;
    
    if (minuteUsage > DRIVE_API_CONFIG.quotaMonitoring.criticalThreshold) {
      migrationLogger.log({
        level: 'error',
        category: 'api',
        service: 'drive',
        message: 'Critical quota usage detected',
        details: {
          usage: `${Math.round(minuteUsage * 100)}%`,
          requestsThisMinute: this.quotaUsage.requestsThisMinute,
          limit: 1000,
          action: 'throttling_enabled'
        }
      });
    } else if (minuteUsage > DRIVE_API_CONFIG.quotaMonitoring.warningThreshold) {
      migrationLogger.log({
        level: 'warning',
        category: 'api',
        service: 'drive',
        message: 'Quota usage approaching limit',
        details: {
          usage: `${Math.round(minuteUsage * 100)}%`,
          requestsThisMinute: this.quotaUsage.requestsThisMinute,
          limit: 1000
        }
      });
    }
  }

  getQuotaUsage(): QuotaUsage {
    return { ...this.quotaUsage };
  }

  resetQuota(): void {
    this.requestCount = 0;
    this.windowStart = Date.now();
    this.quotaUsage = {
      requestsThisMinute: 0,
      requestsToday: this.quotaUsage.requestsToday,
      lastReset: Date.now(),
      windowStart: Date.now()
    };

    migrationLogger.log({
      level: 'info',
      category: 'api',
      service: 'drive',
      message: 'Quota usage reset',
      details: {
        resetTime: new Date().toISOString(),
        dailyRequests: this.quotaUsage.requestsToday
      }
    });
  }
}

export async function handleDriveAPICall<T>(
  apiCall: () => Promise<T>,
  context: {
    endpoint: string;
    fileId?: string;
    fileName?: string;
    operation?: string;
  }
): Promise<T> {
  const maxRetries = DRIVE_API_CONFIG.maxRetries;
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      migrationLogger.log({
        level: 'info',
        category: 'api',
        service: 'drive',
        message: `Making API call: ${context.endpoint}`,
        details: {
          endpoint: context.endpoint,
          attempt: attempt + 1,
          maxRetries,
          fileId: context.fileId,
          fileName: context.fileName,
          operation: context.operation
        }
      });

      const result = await apiCall();
      
      migrationLogger.log({
        level: 'success',
        category: 'api',
        service: 'drive',
        message: `API call successful: ${context.endpoint}`,
        details: {
          endpoint: context.endpoint,
          fileId: context.fileId,
          fileName: context.fileName,
          operation: context.operation,
          attempts: attempt + 1
        }
      });

      return result;
    } catch (error: any) {
      if (error.status === 429) { // Quota exceeded
        const delay = Math.min(
          Math.pow(2, attempt) * DRIVE_API_CONFIG.baseDelay, // Exponential backoff
          DRIVE_API_CONFIG.maxDelay // Max delay cap
        );
        
        // Add jitter to prevent thundering herd
        const jitter = delay * (DRIVE_API_CONFIG.jitterPercent / 100) * Math.random();
        const totalDelay = delay + jitter;
        
        migrationLogger.log({
          level: 'error',
          category: 'api',
          service: 'drive',
          message: 'Quota exceeded - implementing backoff',
          details: {
            endpoint: context.endpoint,
            error: error.message,
            attempt: attempt + 1,
            maxRetries,
            retryAfter: `${Math.round(totalDelay / 1000)}s`,
            baseDelay: `${DRIVE_API_CONFIG.baseDelay / 1000}s`,
            jitter: `${Math.round(jitter / 1000)}s`,
            fileId: context.fileId,
            fileName: context.fileName,
            nextRetryIn: new Date(Date.now() + totalDelay).toISOString()
          }
        });
        
        await new Promise(resolve => setTimeout(resolve, totalDelay));
        attempt++;
      } else {
        // Non-quota error, log and re-throw
        migrationLogger.log({
          level: 'error',
          category: 'api',
          service: 'drive',
          message: `API call failed: ${context.endpoint}`,
          details: {
            endpoint: context.endpoint,
            error: error.message,
            status: error.status,
            fileId: context.fileId,
            fileName: context.fileName,
            operation: context.operation,
            isQuotaError: false
          }
        });
        throw error;
      }
    }
  }
  
  const finalError = new Error(`Max retries (${maxRetries}) exceeded for quota error`);
  
  migrationLogger.log({
    level: 'error',
    category: 'api',
    service: 'drive',
    message: 'Max retries exceeded for quota error',
    details: {
      endpoint: context.endpoint,
      maxRetries,
      totalAttempts: attempt,
      fileId: context.fileId,
      fileName: context.fileName,
      operation: context.operation,
      finalError: finalError.message
    }
  });
  
  throw finalError;
}

export async function migrateDriveFilesBatch(
  files: any[],
  migrationFunction: (file: any) => Promise<any>,
  batchSize: number = DRIVE_API_CONFIG.batchSize
): Promise<{
  totalFiles: number;
  processedFiles: number;
  failedFiles: number;
  quotaErrors: number;
  errors: Array<{
    fileId: string;
    fileName: string;
    error: string;
    isQuotaError: boolean;
  }>;
}> {
  const rateLimiter = new DriveAPIRateLimiter();
  const results = {
    totalFiles: files.length,
    processedFiles: 0,
    failedFiles: 0,
    quotaErrors: 0,
    errors: [] as Array<{
      fileId: string;
      fileName: string;
      error: string;
      isQuotaError: boolean;
    }>
  };

  migrationLogger.log({
    level: 'info',
    category: 'migration',
    service: 'drive',
    message: 'Starting batch Drive file migration',
    details: {
      totalFiles: files.length,
      batchSize,
      estimatedBatches: Math.ceil(files.length / batchSize)
    }
  });
  
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(files.length / batchSize);
    
    migrationLogger.log({
      level: 'info',
      category: 'migration',
      service: 'drive',
      message: `Processing batch ${batchNumber}/${totalBatches}`,
      details: {
        batchNumber,
        totalBatches,
        batchSize: batch.length,
        filesInBatch: batch.map(f => ({ id: f.id, name: f.name }))
      }
    });
    
    for (const file of batch) {
      await rateLimiter.throttle();
      
      try {
        await handleDriveAPICall(
          () => migrationFunction(file),
          {
            endpoint: 'drive.files.migrate',
            fileId: file.id,
            fileName: file.name,
            operation: 'migrate'
          }
        );
        results.processedFiles++;
      } catch (error: any) {
        results.failedFiles++;
        
        const isQuotaError = error.message.includes('quota') || error.message.includes('Max retries');
        if (isQuotaError) {
          results.quotaErrors++;
        }
        
        results.errors.push({
          fileId: file.id,
          fileName: file.name,
          error: error.message,
          isQuotaError
        });
      }
    }
    
    // Small delay between batches
    if (i + batchSize < files.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  migrationLogger.log({
    level: results.failedFiles > 0 ? 'warning' : 'success',
    category: 'migration',
    service: 'drive',
    message: 'Drive file migration batch completed',
    details: {
      ...results,
      successRate: `${Math.round((results.processedFiles / results.totalFiles) * 100)}%`,
      quotaErrorRate: `${Math.round((results.quotaErrors / results.totalFiles) * 100)}%`
    }
  });

  return results;
}
