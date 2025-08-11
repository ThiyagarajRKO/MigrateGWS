/**
 * Multi-Tenant Queue Management System
 * Handles job queuing, prioritization, and execution with tenant isolation
 */

import { MigrationJob, Tenant, APIQuotaUsage } from '../../lib/database/schema';
import { getWebSocketServer } from '../websocket/migration-status';

export interface QueueConfig {
  maxConcurrentJobs: number;
  maxJobsPerTenant: number;
  priorityLevels: number;
  retryAttempts: number;
  retryDelayMs: number;
  batchSize: number;
}

export interface QueueStats {
  totalJobs: number;
  runningJobs: number;
  queuedJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageExecutionTime: number;
  tenantStats: Record<string, {
    queued: number;
    running: number;
    completed: number;
    failed: number;
  }>;
}

export interface JobResult {
  success: boolean;
  itemsProcessed: number;
  itemsFailed: number;
  errors: string[];
  metadata: Record<string, any>;
}

export type JobHandler = (job: MigrationJob) => Promise<JobResult>;

export class MultiTenantJobQueue {
  private queues: Map<string, MigrationJob[]> = new Map(); // tenant -> jobs
  private runningJobs: Map<string, MigrationJob> = new Map(); // jobId -> job
  private handlers: Map<string, JobHandler> = new Map(); // service -> handler
  private config: QueueConfig;
  private isProcessing: boolean = false;
  private processingInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<QueueConfig> = {}) {
    this.config = {
      maxConcurrentJobs: 50,
      maxJobsPerTenant: 10,
      priorityLevels: 10,
      retryAttempts: 3,
      retryDelayMs: 5000,
      batchSize: 5,
      ...config
    };

    this.startProcessing();
  }

  /**
   * Register a job handler for a specific service type
   */
  public registerHandler(serviceType: string, handler: JobHandler): void {
    this.handlers.set(serviceType, handler);
    console.log(`Registered handler for service: ${serviceType}`);
  }

  /**
   * Add a job to the queue
   */
  public async enqueueJob(job: MigrationJob): Promise<void> {
    const tenantId = this.getTenantIdFromJob(job);
    
    // Validate tenant quotas
    await this.validateTenantQuota(tenantId);
    
    // Initialize tenant queue if it doesn't exist
    if (!this.queues.has(tenantId)) {
      this.queues.set(tenantId, []);
    }

    const tenantQueue = this.queues.get(tenantId)!;
    
    // Check tenant-specific limits
    const runningJobsForTenant = Array.from(this.runningJobs.values())
      .filter(j => this.getTenantIdFromJob(j) === tenantId).length;
    
    if (runningJobsForTenant + tenantQueue.length >= this.config.maxJobsPerTenant) {
      throw new Error(`Tenant ${tenantId} has reached maximum job limit`);
    }

    // Set job status and timestamp
    job.status = 'queued';
    job.queued_at = new Date().toISOString();
    
    // Insert job in priority order
    this.insertJobByPriority(tenantQueue, job);
    
    console.log(`Job ${job.id} queued for tenant ${tenantId} (service: ${job.service_type})`);
    
    // Notify via WebSocket
    this.notifyJobQueued(tenantId, job);
    
    // Save job to database
    await this.saveJob(job);
  }

  /**
   * Get the next job to execute considering priorities and tenant fairness
   */
  private getNextJob(): MigrationJob | null {
    const tenantIds = Array.from(this.queues.keys()).filter(
      tenantId => this.queues.get(tenantId)!.length > 0
    );

    if (tenantIds.length === 0) {
      return null;
    }

    // Round-robin between tenants for fairness
    let selectedTenant: string | null = null;
    let highestPriority = -1;

    for (const tenantId of tenantIds) {
      const tenantQueue = this.queues.get(tenantId)!;
      const runningJobsForTenant = Array.from(this.runningJobs.values())
        .filter(j => this.getTenantIdFromJob(j) === tenantId).length;

      // Skip if tenant has reached concurrent job limit
      if (runningJobsForTenant >= Math.floor(this.config.maxJobsPerTenant / 2)) {
        continue;
      }

      const topJob = tenantQueue[0];
      if (topJob && topJob.priority > highestPriority) {
        highestPriority = topJob.priority;
        selectedTenant = tenantId;
      }
    }

    if (!selectedTenant) {
      return null;
    }

    const selectedQueue = this.queues.get(selectedTenant)!;
    return selectedQueue.shift() || null;
  }

  /**
   * Execute a job
   */
  private async executeJob(job: MigrationJob): Promise<void> {
    const tenantId = this.getTenantIdFromJob(job);
    
    try {
      // Update job status
      job.status = 'processing';
      job.started_at = new Date().toISOString();
      this.runningJobs.set(job.id, job);
      
      console.log(`Executing job ${job.id} (service: ${job.service_type}, tenant: ${tenantId})`);
      
      // Notify via WebSocket
      this.notifyJobStarted(tenantId, job);
      
      // Save job status
      await this.saveJob(job);

      // Get and execute handler
      const handler = this.handlers.get(job.service_type);
      if (!handler) {
        throw new Error(`No handler registered for service: ${job.service_type}`);
      }

      // Execute with timeout
      const result = await Promise.race([
        handler(job),
        this.createTimeoutPromise(job)
      ]);

      // Update job with results
      job.status = 'completed';
      job.completed_at = new Date().toISOString();
      job.items_processed = result.itemsProcessed;
      job.items_failed = result.itemsFailed;
      
      console.log(`Job ${job.id} completed successfully`);
      
      // Notify success
      this.notifyJobCompleted(tenantId, job, result);

    } catch (error) {
      console.error(`Job ${job.id} failed:`, error);
      
      // Handle retry logic
      const shouldRetry = await this.handleJobFailure(job, error);
      
      if (!shouldRetry) {
        job.status = 'failed';
        job.error_details = {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          retry_count: job.error_details?.retry_count || 0,
          last_retry_at: new Date().toISOString()
        };
        
        // Notify failure
        this.notifyJobFailed(tenantId, job, error);
      }
    } finally {
      // Remove from running jobs
      this.runningJobs.delete(job.id);
      
      // Save final job state
      await this.saveJob(job);
    }
  }

  /**
   * Handle job failure and retry logic
   */
  private async handleJobFailure(job: MigrationJob, error: any): Promise<boolean> {
    const retryCount = (job.error_details?.retry_count || 0) + 1;
    
    if (retryCount <= this.config.retryAttempts) {
      console.log(`Retrying job ${job.id} (attempt ${retryCount}/${this.config.retryAttempts})`);
      
      // Update retry information
      job.error_details = {
        message: error instanceof Error ? error.message : 'Unknown error',
        retry_count: retryCount,
        last_retry_at: new Date().toISOString()
      };
      
      // Reset status for retry
      job.status = 'queued';
      
      // Add delay before retry
      setTimeout(() => {
        this.enqueueJob(job).catch(console.error);
      }, this.config.retryDelayMs * Math.pow(2, retryCount - 1)); // Exponential backoff
      
      return true;
    }
    
    return false;
  }

  /**
   * Start the job processing loop
   */
  private startProcessing(): void {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    
    this.processingInterval = setInterval(async () => {
      try {
        await this.processJobs();
      } catch (error) {
        console.error('Error in job processing loop:', error);
      }
    }, 1000); // Check every second

    console.log('Job queue processing started');
  }

  /**
   * Process queued jobs
   */
  private async processJobs(): Promise<void> {
    const availableSlots = this.config.maxConcurrentJobs - this.runningJobs.size;
    
    if (availableSlots <= 0) {
      return;
    }

    const jobsToProcess = Math.min(availableSlots, this.config.batchSize);
    const jobPromises: Promise<void>[] = [];

    for (let i = 0; i < jobsToProcess; i++) {
      const job = this.getNextJob();
      if (!job) {
        break;
      }

      // Execute job without waiting
      jobPromises.push(this.executeJob(job));
    }

    // Don't await here to allow concurrent execution
    if (jobPromises.length > 0) {
      Promise.allSettled(jobPromises).catch(console.error);
    }
  }

  /**
   * Stop the job processing
   */
  public stop(): void {
    this.isProcessing = false;
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    console.log('Job queue processing stopped');
  }

  /**
   * Get queue statistics
   */
  public getStats(): QueueStats {
    const tenantStats: Record<string, any> = {};
    let totalQueued = 0;
    let totalCompleted = 0;
    let totalFailed = 0;

    for (const [tenantId, queue] of this.queues.entries()) {
      const runningForTenant = Array.from(this.runningJobs.values())
        .filter(j => this.getTenantIdFromJob(j) === tenantId).length;
      
      tenantStats[tenantId] = {
        queued: queue.length,
        running: runningForTenant,
        completed: 0, // Would come from database
        failed: 0 // Would come from database
      };

      totalQueued += queue.length;
    }

    return {
      totalJobs: totalQueued + this.runningJobs.size + totalCompleted + totalFailed,
      runningJobs: this.runningJobs.size,
      queuedJobs: totalQueued,
      completedJobs: totalCompleted,
      failedJobs: totalFailed,
      averageExecutionTime: 0, // Would be calculated from historical data
      tenantStats
    };
  }

  /**
   * Get jobs for a specific tenant
   */
  public getTenantJobs(tenantId: string): {
    queued: MigrationJob[];
    running: MigrationJob[];
  } {
    const queued = this.queues.get(tenantId) || [];
    const running = Array.from(this.runningJobs.values())
      .filter(j => this.getTenantIdFromJob(j) === tenantId);

    return { queued, running };
  }

  /**
   * Cancel a job
   */
  public async cancelJob(jobId: string): Promise<boolean> {
    // Remove from queue if queued
    for (const [tenantId, queue] of this.queues.entries()) {
      const index = queue.findIndex(j => j.id === jobId);
      if (index !== -1) {
        const job = queue.splice(index, 1)[0];
        job.status = 'cancelled';
        await this.saveJob(job);
        
        this.notifyJobCancelled(tenantId, job);
        return true;
      }
    }

    // Cancel running job
    const runningJob = this.runningJobs.get(jobId);
    if (runningJob) {
      runningJob.status = 'cancelled';
      this.runningJobs.delete(jobId);
      await this.saveJob(runningJob);
      
      const tenantId = this.getTenantIdFromJob(runningJob);
      this.notifyJobCancelled(tenantId, runningJob);
      return true;
    }

    return false;
  }

  // Helper methods
  private insertJobByPriority(queue: MigrationJob[], job: MigrationJob): void {
    let insertIndex = 0;
    for (let i = 0; i < queue.length; i++) {
      if (queue[i].priority < job.priority) {
        insertIndex = i;
        break;
      }
      insertIndex = i + 1;
    }
    queue.splice(insertIndex, 0, job);
  }

  private getTenantIdFromJob(job: MigrationJob): string {
    // Use explicit tenant_id field from job
    return job.tenant_id;
  }

  private async validateTenantQuota(tenantId: string): Promise<void> {
    // Would check tenant's current quota usage
    // For now, just log
    console.log(`Validating quota for tenant: ${tenantId}`);
  }

  private createTimeoutPromise(job: MigrationJob): Promise<JobResult> {
    const timeoutMs = 30 * 60 * 1000; // 30 minutes
    
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Job ${job.id} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }

  // WebSocket notification methods
  private notifyJobQueued(tenantId: string, job: MigrationJob): void {
    const wsServer = getWebSocketServer();
    wsServer.broadcastJobStatus(tenantId, job.id, {
      status: 'queued',
      job: job
    });
  }

  private notifyJobStarted(tenantId: string, job: MigrationJob): void {
    const wsServer = getWebSocketServer();
    wsServer.broadcastJobStatus(tenantId, job.id, {
      status: 'started',
      job: job
    });
  }

  private notifyJobCompleted(tenantId: string, job: MigrationJob, result: JobResult): void {
    const wsServer = getWebSocketServer();
    wsServer.broadcastJobStatus(tenantId, job.id, {
      status: 'completed',
      job: job,
      result: result
    });
  }

  private notifyJobFailed(tenantId: string, job: MigrationJob, error: any): void {
    const wsServer = getWebSocketServer();
    wsServer.broadcastJobStatus(tenantId, job.id, {
      status: 'failed',
      job: job,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  private notifyJobCancelled(tenantId: string, job: MigrationJob): void {
    const wsServer = getWebSocketServer();
    wsServer.broadcastJobStatus(tenantId, job.id, {
      status: 'cancelled',
      job: job
    });
  }

  // Database methods (to be implemented)
  private async saveJob(job: MigrationJob): Promise<void> {
    // Would save to database
    console.log(`Saving job ${job.id} with status ${job.status}`);
  }
}

// Singleton instance
let jobQueue: MultiTenantJobQueue | null = null;

/**
 * Get or create job queue instance
 */
export function getJobQueue(): MultiTenantJobQueue {
  if (!jobQueue) {
    jobQueue = new MultiTenantJobQueue();
  }
  return jobQueue;
}

/**
 * Initialize job queue with custom config
 */
export function initializeJobQueue(config?: Partial<QueueConfig>): MultiTenantJobQueue {
  if (jobQueue) {
    console.log('Job queue already initialized');
    return jobQueue;
  }
  
  jobQueue = new MultiTenantJobQueue(config);
  return jobQueue;
}

export default MultiTenantJobQueue;
