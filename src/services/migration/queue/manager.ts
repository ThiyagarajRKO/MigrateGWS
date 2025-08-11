/**
 * Migration Queue Manager
 * Handles concurrent user migrations with service-wise chunking and priority handling
 */

import { EventEmitter } from 'events';
import {
  MigrationJob,
  ServiceJob,
  WorkerConfig,
  QueueMetrics,
  ServicePriorityConfig,
  SERVICE_PRIORITY_CONFIGS,
  MIGRATION_PHASES,
  QueueHealthCheck,
  MigrationDashboard,
  RateLimitConfig,
} from './types';
import { MigrationOrchestrator } from '../orchestrator';

export class MigrationQueueManager extends EventEmitter {
  private jobs: Map<string, MigrationJob> = new Map();
  private serviceJobs: Map<string, ServiceJob> = new Map();
  private workers: Map<string, Worker> = new Map();
  private rateLimiters: Map<string, RateLimiter> = new Map();
  private config: WorkerConfig;
  private isRunning = false;
  private metrics: QueueMetrics;
  private healthCheckInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(config: WorkerConfig) {
    super();
    this.config = config;
    this.metrics = this.initializeMetrics();
    this.initializeRateLimiters();
  }

  private initializeMetrics(): QueueMetrics {
    return {
      totalJobs: 0,
      pendingJobs: 0,
      runningJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      avgProcessingTime: 0,
      successRate: 0,
      activeWorkers: 0,
      queueDepth: 0,
      rateLimitHits: 0,
    };
  }

  private initializeRateLimiters(): void {
    for (const serviceConfig of SERVICE_PRIORITY_CONFIGS) {
      const rateLimiter = new RateLimiter(serviceConfig.rateLimitConfig);
      this.rateLimiters.set(serviceConfig.serviceType, rateLimiter);
    }
  }

  /**
   * Add a migration job to the queue
   */
  async addMigrationJob(
    userId: string,
    userMapping: any,
    services: string[],
    priority: 'high' | 'medium' | 'low' = 'medium'
  ): Promise<string> {
    const jobId = `job_${userId}_${Date.now()}`;
    
    // Determine phase based on services
    const phase = this.determinePhase(services);
    
    const job: MigrationJob = {
      id: jobId,
      userId,
      userMapping,
      services,
      priority,
      phase,
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date().toISOString(),
      status: 'pending',
    };

    this.jobs.set(jobId, job);
    this.metrics.totalJobs++;
    this.metrics.pendingJobs++;
    this.metrics.queueDepth++;

    // Create service jobs for each service
    await this.createServiceJobs(job);

    this.emit('jobAdded', job);
    console.log(`Added migration job ${jobId} for user ${userId} with services: ${services.join(', ')}`);

    return jobId;
  }

  private determinePhase(services: string[]): 1 | 2 | 3 | 4 {
    const phases = services.map(service => {
      const config = SERVICE_PRIORITY_CONFIGS.find(c => c.serviceType === service);
      return config?.phase || 4;
    });
    return Math.min(...phases) as 1 | 2 | 3 | 4;
  }

  private async createServiceJobs(parentJob: MigrationJob): Promise<void> {
    for (const serviceType of parentJob.services) {
      const serviceConfig = SERVICE_PRIORITY_CONFIGS.find(c => c.serviceType === serviceType);
      if (!serviceConfig) continue;

      const serviceJobId = `${parentJob.id}_${serviceType}`;
      const serviceJob: ServiceJob = {
        id: serviceJobId,
        parentJobId: parentJob.id,
        userId: parentJob.userId,
        serviceType,
        priority: serviceConfig.priority,
        retryCount: 0,
        maxRetries: serviceConfig.maxRetries,
        status: 'pending',
        estimatedItems: 0, // Will be updated during estimation
        processedItems: 0,
        failedItems: 0,
        rateLimitConfig: serviceConfig.rateLimitConfig,
        createdAt: new Date().toISOString(),
      };

      this.serviceJobs.set(serviceJobId, serviceJob);
    }
  }

  /**
   * Start the queue processing
   */
  async start(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;
    console.log('Starting Migration Queue Manager...');

    // Start worker pools
    await this.startWorkers();

    // Start health checks
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30000); // Every 30 seconds

    // Start cleanup
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);

    this.emit('started');
  }

  /**
   * Stop the queue processing
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.isRunning = false;
    console.log('Stopping Migration Queue Manager...');

    // Stop all workers
    for (const worker of Array.from(this.workers.values())) {
      await worker.stop();
    }
    this.workers.clear();

    // Clear intervals
    if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);

    this.emit('stopped');
  }

  private async startWorkers(): Promise<void> {
    for (let i = 0; i < this.config.maxConcurrentJobs; i++) {
      const workerId = `worker_${i}`;
      const worker = new Worker(workerId, this);
      this.workers.set(workerId, worker);
      await worker.start();
    }
    this.metrics.activeWorkers = this.workers.size;
  }

  /**
   * Get next job for a worker to process
   */
  async getNextJob(): Promise<MigrationJob | null> {
    // Find highest priority pending job
    const pendingJobs = Array.from(this.jobs.values())
      .filter(job => job.status === 'pending')
      .sort((a, b) => {
        // Sort by priority, then by phase, then by creation time
        const priorityOrder = { high: 1, medium: 2, low: 3 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        if (a.phase !== b.phase) {
          return a.phase - b.phase;
        }
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });

    return pendingJobs[0] || null;
  }

  /**
   * Get next service job for processing
   */
  async getNextServiceJob(parentJobId: string, phase: number): Promise<ServiceJob | null> {
    const serviceJobs = Array.from(this.serviceJobs.values())
      .filter(job => 
        job.parentJobId === parentJobId && 
        job.status === 'pending'
      )
      .sort((a, b) => a.priority - b.priority);

    // Check dependencies
    for (const serviceJob of serviceJobs) {
      const serviceConfig = SERVICE_PRIORITY_CONFIGS.find(c => c.serviceType === serviceJob.serviceType);
      if (serviceConfig && await this.checkDependencies(serviceJob, serviceConfig)) {
        return serviceJob;
      }
    }

    return null;
  }

  /**
   * Get a job by ID
   */
  getJob(jobId: string): MigrationJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get job status and progress
   */
  getJobStatus(jobId: string): { job?: MigrationJob; serviceJobs: ServiceJob[] } {
    const job = this.jobs.get(jobId);
    const serviceJobs = Array.from(this.serviceJobs.values())
      .filter(sj => sj.parentJobId === jobId);
    
    return { job, serviceJobs };
  }

  /**
   * Get a service job by ID
   */
  getServiceJob(serviceJobId: string): ServiceJob | undefined {
    return this.serviceJobs.get(serviceJobId);
  }

  private async checkDependencies(serviceJob: ServiceJob, config: ServicePriorityConfig): Promise<boolean> {
    if (!config.dependencies.length) return true;

    // Check if all dependency services are completed
    for (const dependency of config.dependencies) {
      const dependencyJobId = `${serviceJob.parentJobId}_${dependency}`;
      const dependencyJob = this.serviceJobs.get(dependencyJobId);
      if (!dependencyJob || dependencyJob.status !== 'completed') {
        return false;
      }
    }

    return true;
  }

  /**
   * Update job status
   */
  updateJobStatus(jobId: string, status: MigrationJob['status'], error?: string): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    const oldStatus = job.status;
    job.status = status;

    if (status === 'running' && oldStatus === 'pending') {
      job.startedAt = new Date().toISOString();
      this.metrics.pendingJobs--;
      this.metrics.runningJobs++;
    } else if (status === 'completed' && oldStatus === 'running') {
      job.completedAt = new Date().toISOString();
      this.metrics.runningJobs--;
      this.metrics.completedJobs++;
      this.metrics.queueDepth--;
    } else if (status === 'failed') {
      job.failedAt = new Date().toISOString();
      if (error) job.error = error;
      this.metrics.runningJobs--;
      this.metrics.failedJobs++;
      this.metrics.queueDepth--;
    }

    this.updateMetrics();
    this.emit('jobStatusChanged', job);
  }

  /**
   * Update service job status
   */
  updateServiceJobStatus(
    serviceJobId: string, 
    status: ServiceJob['status'], 
    progress?: { processed: number; failed: number; total?: number }
  ): void {
    const serviceJob = this.serviceJobs.get(serviceJobId);
    if (!serviceJob) return;

    serviceJob.status = status;
    
    if (progress) {
      serviceJob.processedItems = progress.processed;
      serviceJob.failedItems = progress.failed;
      if (progress.total) serviceJob.estimatedItems = progress.total;
    }

    if (status === 'running' && !serviceJob.startedAt) {
      serviceJob.startedAt = new Date().toISOString();
    } else if (status === 'completed' || status === 'failed') {
      serviceJob.completedAt = new Date().toISOString();
    }

    this.emit('serviceJobStatusChanged', serviceJob);
  }

  /**
   * Check rate limit for a service
   */
  async checkRateLimit(serviceType: string): Promise<boolean> {
    const rateLimiter = this.rateLimiters.get(serviceType);
    if (!rateLimiter) return true;

    const canProceed = await rateLimiter.checkLimit();
    if (!canProceed) {
      this.metrics.rateLimitHits++;
    }
    return canProceed;
  }

  /**
   * Get queue metrics
   */
  getMetrics(): QueueMetrics {
    return { ...this.metrics };
  }

  /**
   * Get migration dashboard data
   */
  getDashboard(): MigrationDashboard {
    const serviceBreakdown: { [service: string]: any } = {};
    
    // Calculate service breakdown
    for (const serviceJob of Array.from(this.serviceJobs.values())) {
      if (!serviceBreakdown[serviceJob.serviceType]) {
        serviceBreakdown[serviceJob.serviceType] = {
          completed: 0,
          failed: 0,
          pending: 0,
          avgDuration: 0,
        };
      }
      
      const breakdown = serviceBreakdown[serviceJob.serviceType];
      if (serviceJob.status === 'completed') breakdown.completed++;
      else if (serviceJob.status === 'failed') breakdown.failed++;
      else breakdown.pending++;
    }

    // Get recent activity
    const recentActivity = Array.from(this.serviceJobs.values())
      .filter(job => job.completedAt)
      .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())
      .slice(0, 20)
      .map(job => ({
        timestamp: job.completedAt!,
        userId: job.userId,
        service: job.serviceType,
        status: job.status,
        duration: job.startedAt && job.completedAt 
          ? new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()
          : undefined,
      }));

    return {
      overallProgress: this.calculateOverallProgress(),
      totalUsers: new Set(Array.from(this.jobs.values()).map(j => j.userId)).size,
      completedUsers: Array.from(this.jobs.values()).filter(j => j.status === 'completed').length,
      failedUsers: Array.from(this.jobs.values()).filter(j => j.status === 'failed').length,
      activeUsers: Array.from(this.jobs.values()).filter(j => j.status === 'running').length,
      serviceBreakdown,
      recentActivity,
      alerts: [], // Would be populated with actual alerts
    };
  }

  private calculateOverallProgress(): number {
    const totalJobs = this.metrics.totalJobs;
    if (totalJobs === 0) return 0;
    return Math.round((this.metrics.completedJobs / totalJobs) * 100);
  }

  private updateMetrics(): void {
    this.metrics.successRate = this.metrics.totalJobs > 0 
      ? (this.metrics.completedJobs / this.metrics.totalJobs) * 100 
      : 0;
  }

  private performHealthCheck(): void {
    const healthCheck: QueueHealthCheck = {
      isHealthy: true,
      queueDepth: this.metrics.queueDepth,
      activeWorkers: this.metrics.activeWorkers,
      avgResponseTime: this.metrics.avgProcessingTime,
      errorRate: this.metrics.failedJobs / Math.max(this.metrics.totalJobs, 1) * 100,
      rateLimitHits: this.metrics.rateLimitHits,
      lastCheckAt: new Date().toISOString(),
      issues: [],
    };

    // Check for issues
    if (healthCheck.queueDepth > 100) {
      healthCheck.issues.push('High queue depth detected');
      healthCheck.isHealthy = false;
    }
    if (healthCheck.errorRate > 10) {
      healthCheck.issues.push('High error rate detected');
      healthCheck.isHealthy = false;
    }
    if (healthCheck.rateLimitHits > 50) {
      healthCheck.issues.push('High rate limit hits detected');
      healthCheck.isHealthy = false;
    }

    this.emit('healthCheck', healthCheck);
  }

  private cleanup(): void {
    // Remove old completed jobs (older than 24 hours)
    const cutoff = Date.now() - (24 * 60 * 60 * 1000);
    
    for (const [jobId, job] of Array.from(this.jobs.entries())) {
      if (job.status === 'completed' && job.completedAt) {
        const completedTime = new Date(job.completedAt).getTime();
        if (completedTime < cutoff) {
          this.jobs.delete(jobId);
          // Also remove associated service jobs
          for (const [serviceJobId, serviceJob] of Array.from(this.serviceJobs.entries())) {
            if (serviceJob.parentJobId === jobId) {
              this.serviceJobs.delete(serviceJobId);
            }
          }
        }
      }
    }
  }
}

/**
 * Worker class for processing migration jobs
 */
class Worker {
  private id: string;
  private queueManager: MigrationQueueManager;
  private isRunning = false;
  private currentJob?: MigrationJob;
  private orchestrator?: MigrationOrchestrator;

  constructor(id: string, queueManager: MigrationQueueManager) {
    this.id = id;
    this.queueManager = queueManager;
  }

  async start(): Promise<void> {
    this.isRunning = true;
    this.processJobs();
  }

  async stop(): Promise<void> {
    this.isRunning = false;
  }

  private async processJobs(): Promise<void> {
    while (this.isRunning) {
      try {
        const job = await this.queueManager.getNextJob();
        if (!job) {
          await this.delay(1000); // Wait 1 second before checking again
          continue;
        }

        this.currentJob = job;
        await this.processJob(job);
        this.currentJob = undefined;
        
      } catch (error) {
        console.error(`Worker ${this.id} error:`, error);
        if (this.currentJob) {
          this.queueManager.updateJobStatus(this.currentJob.id, 'failed', 
            error instanceof Error ? error.message : 'Unknown error');
        }
      }
    }
  }

  private async processJob(job: MigrationJob): Promise<void> {
    console.log(`Worker ${this.id} processing job ${job.id} for user ${job.userId}`);
    
    this.queueManager.updateJobStatus(job.id, 'running');
    
    try {
      // Process services in phases
      const phases = this.groupServicesByPhase(job.services);
      
      for (const [phase, services] of Array.from(phases.entries())) {
        await this.processPhase(job, phase, services);
      }
      
      this.queueManager.updateJobStatus(job.id, 'completed');
      
    } catch (error) {
      console.error(`Job ${job.id} failed:`, error);
      this.queueManager.updateJobStatus(job.id, 'failed', 
        error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private groupServicesByPhase(services: string[]): Map<number, string[]> {
    const phases = new Map<number, string[]>();
    
    for (const service of services) {
      const config = SERVICE_PRIORITY_CONFIGS.find(c => c.serviceType === service);
      const phase = config?.phase || 4;
      
      if (!phases.has(phase)) {
        phases.set(phase, []);
      }
      phases.get(phase)!.push(service);
    }
    
    return phases;
  }

  private async processPhase(job: MigrationJob, phase: number, services: string[]): Promise<void> {
    console.log(`Processing phase ${phase} for job ${job.id}: ${services.join(', ')}`);
    
    // Check if services in this phase can run in parallel
    const phaseConfig = MIGRATION_PHASES.find(p => p.phase === phase);
    const canRunInParallel = phaseConfig?.canRunInParallel || false;
    
    if (canRunInParallel && services.length > 1) {
      // Process services in parallel
      const promises = services.map(service => this.processService(job, service));
      await Promise.allSettled(promises);
    } else {
      // Process services sequentially
      for (const service of services) {
        await this.processService(job, service);
      }
    }
  }

  private async processService(job: MigrationJob, serviceType: string): Promise<void> {
    const serviceJobId = `${job.id}_${serviceType}`;
    const serviceJob = this.queueManager.getServiceJob(serviceJobId);
    
    if (!serviceJob) {
      throw new Error(`Service job not found: ${serviceJobId}`);
    }

    // Check rate limits
    const canProceed = await this.queueManager.checkRateLimit(serviceType);
    if (!canProceed) {
      console.log(`Rate limit hit for ${serviceType}, waiting...`);
      await this.delay(5000); // Wait 5 seconds
      return this.processService(job, serviceType); // Retry
    }

    this.queueManager.updateServiceJobStatus(serviceJobId, 'running');
    
    try {
      // Here you would integrate with your actual migration services
      console.log(`Processing ${serviceType} for user ${job.userId}`);
      
      // Simulate processing time based on service type
      const config = SERVICE_PRIORITY_CONFIGS.find(c => c.serviceType === serviceType);
      const estimatedMs = (config?.estimatedDurationMinutes || 5) * 60 * 1000;
      
      // Simulate processing with progress updates
      const totalItems = Math.floor(Math.random() * 1000) + 100;
      this.queueManager.updateServiceJobStatus(serviceJobId, 'running', {
        processed: 0,
        failed: 0,
        total: totalItems,
      });
      
      for (let i = 0; i < totalItems; i += 10) {
        await this.delay(estimatedMs / (totalItems / 10));
        this.queueManager.updateServiceJobStatus(serviceJobId, 'running', {
          processed: Math.min(i + 10, totalItems),
          failed: Math.floor(Math.random() * 2), // Random failures
          total: totalItems,
        });
      }
      
      this.queueManager.updateServiceJobStatus(serviceJobId, 'completed');
      
    } catch (error) {
      console.error(`Service ${serviceType} failed for job ${job.id}:`, error);
      this.queueManager.updateServiceJobStatus(serviceJobId, 'failed');
      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Rate Limiter class for managing API rate limits
 */
class RateLimiter {
  private config: RateLimitConfig;
  private requests: number[] = [];
  private hourlyRequests: number[] = [];
  private dailyRequests: number[] = [];

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  async checkLimit(): Promise<boolean> {
    const now = Date.now();
    
    // Clean old requests
    this.cleanOldRequests(now);
    
    // Check daily limit
    if (this.dailyRequests.length >= this.config.requestsPerDay) {
      return false;
    }
    
    // Check hourly limit
    if (this.hourlyRequests.length >= this.config.requestsPerHour) {
      return false;
    }
    
    // Check per-minute limit
    if (this.requests.length >= this.config.requestsPerMinute) {
      return false;
    }
    
    // Check burst limit
    const recentRequests = this.requests.filter(time => now - time < 1000); // Last second
    if (recentRequests.length >= this.config.burstLimit) {
      return false;
    }
    
    // Record the request
    this.requests.push(now);
    this.hourlyRequests.push(now);
    this.dailyRequests.push(now);
    
    return true;
  }

  private cleanOldRequests(now: number): void {
    // Clean requests older than 1 minute
    this.requests = this.requests.filter(time => now - time < 60000);
    
    // Clean requests older than 1 hour
    this.hourlyRequests = this.hourlyRequests.filter(time => now - time < 3600000);
    
    // Clean requests older than 1 day
    this.dailyRequests = this.dailyRequests.filter(time => now - time < 86400000);
  }
}

// Re-export types for convenience
export type { QueueMetrics } from './types';
