/**
 * Advanced Migration Execution Coordinator
 * Implements the recommended execution order and service-specific strategies
 */

import { EventEmitter } from 'events';
import { MigrationQueueManager } from './queue/manager';
import { MigrationOrchestrator } from './orchestrator';
import {
  GmailMigrationService,
  DriveMigrationService,
  CalendarMigrationService,
  ContactsMigrationService,
  GroupMigrationService,
} from './index';
import {
  UserMapping,
  MigrationConfig,
  MigrationResult,
  MigrationProgress,
  ServiceCredentials,
} from './types';

export interface ExecutionPlan {
  id: string;
  name: string;
  description: string;
  userMappings: UserMapping[];
  executionPhases: ExecutionPhase[];
  estimatedDuration: number;
  totalUsers: number;
  totalServices: number;
  createdAt: string;
  status: 'draft' | 'ready' | 'running' | 'paused' | 'completed' | 'failed';
}

export interface ExecutionPhase {
  phase: number;
  name: string;
  services: string[];
  canRunInParallel: boolean;
  estimatedDurationMinutes: number;
  userConcurrency: number; // How many users to process concurrently
  serviceConcurrency: number; // How many services per user concurrently
  prerequisites: string[]; // Required phases to complete first
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  recommendations: string[];
  estimatedDuration: number;
  riskAssessment: {
    level: 'low' | 'medium' | 'high';
    factors: string[];
  };
}

export interface MigrationReport {
  planId: string;
  executionId: string;
  startTime: string;
  endTime?: string;
  status: 'running' | 'completed' | 'failed' | 'paused';
  overallProgress: number;
  userResults: UserMigrationResult[];
  serviceBreakdown: ServiceBreakdown[];
  performanceMetrics: PerformanceMetrics;
  issues: Issue[];
  recommendations: string[];
}

export interface UserMigrationResult {
  userId: string;
  sourceEmail: string;
  targetEmail: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: string;
  endTime?: string;
  duration?: number;
  services: ServiceResult[];
  totalItems: number;
  successfulItems: number;
  failedItems: number;
  errors: string[];
  warnings: string[];
}

export interface ServiceResult {
  serviceType: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startTime?: string;
  endTime?: string;
  duration?: number;
  itemsProcessed: number;
  itemsFailed: number;
  estimatedItems: number;
  actualItems: number;
  errors: string[];
  warnings: string[];
}

export interface ServiceBreakdown {
  serviceType: string;
  totalUsers: number;
  completedUsers: number;
  failedUsers: number;
  avgDuration: number;
  avgItemsPerUser: number;
  successRate: number;
  commonErrors: Array<{ error: string; count: number }>;
}

export interface PerformanceMetrics {
  totalDuration: number;
  avgUserMigrationTime: number;
  peakConcurrency: number;
  apiCallsPerService: { [service: string]: number };
  rateLimitHitsPerService: { [service: string]: number };
  throughputItemsPerHour: number;
  errorRate: number;
}

export interface Issue {
  id: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  category: 'performance' | 'data' | 'permission' | 'rate-limit' | 'system';
  title: string;
  description: string;
  affectedUsers: string[];
  affectedServices: string[];
  timestamp: string;
  resolved: boolean;
  resolution?: string;
}

export class MigrationExecutionCoordinator extends EventEmitter {
  private queueManager: MigrationQueueManager;
  private executionPlans: Map<string, ExecutionPlan> = new Map();
  private activeExecutions: Map<string, MigrationExecution> = new Map();
  private reports: Map<string, MigrationReport> = new Map();

  constructor(queueManager: MigrationQueueManager) {
    super();
    this.queueManager = queueManager;
  }

  /**
   * Create an optimized execution plan based on user mappings and services
   */
  createExecutionPlan(
    name: string,
    userMappings: UserMapping[],
    services: string[],
    options: {
      prioritizeSpeed?: boolean;
      prioritizeReliability?: boolean;
      maxConcurrentUsers?: number;
      deltaMode?: boolean;
    } = {}
  ): ExecutionPlan {
    const planId = `plan_${Date.now()}`;
    
    // Create optimized execution phases based on the recommended strategy
    const executionPhases = this.createOptimizedPhases(services, userMappings.length, options);
    
    // Calculate estimated duration
    const estimatedDuration = this.calculateEstimatedDuration(executionPhases, userMappings.length);
    
    const plan: ExecutionPlan = {
      id: planId,
      name,
      description: `Migration plan for ${userMappings.length} users with services: ${services.join(', ')}`,
      userMappings,
      executionPhases,
      estimatedDuration,
      totalUsers: userMappings.length,
      totalServices: services.length,
      createdAt: new Date().toISOString(),
      status: 'draft',
    };

    this.executionPlans.set(planId, plan);
    return plan;
  }

  private createOptimizedPhases(
    services: string[],
    userCount: number,
    options: any
  ): ExecutionPhase[] {
    const phases: ExecutionPhase[] = [];

    // Phase 1: Fast & Low-Risk Services (Contacts, Tasks, Calendar)
    const phase1Services = services.filter(s => ['contacts', 'tasks', 'calendar'].includes(s));
    if (phase1Services.length > 0) {
      phases.push({
        phase: 1,
        name: 'Fast & Low-Risk Services',
        services: phase1Services,
        canRunInParallel: true,
        estimatedDurationMinutes: 15,
        userConcurrency: Math.min(20, userCount), // Up to 20 users concurrently
        serviceConcurrency: 3, // All phase 1 services can run together
        prerequisites: [],
      });
    }

    // Phase 2: Communication Services (Chat, Sites)
    const phase2Services = services.filter(s => ['chat', 'sites'].includes(s));
    if (phase2Services.length > 0) {
      phases.push({
        phase: 2,
        name: 'Communication Services',
        services: phase2Services,
        canRunInParallel: true,
        estimatedDurationMinutes: 30,
        userConcurrency: Math.min(15, userCount),
        serviceConcurrency: 2,
        prerequisites: [], // Can start after phase 1 or in parallel
      });
    }

    // Phase 3: Heavy Data Services (Gmail, Drive)
    const phase3Services = services.filter(s => ['gmail', 'drive'].includes(s));
    if (phase3Services.length > 0) {
      phases.push({
        phase: 3,
        name: 'Heavy Data Services',
        services: phase3Services,
        canRunInParallel: false, // Due to rate limits and data volume
        estimatedDurationMinutes: 180,
        userConcurrency: Math.min(10, userCount), // Lower concurrency for heavy services
        serviceConcurrency: 1, // Sequential processing
        prerequisites: ['contacts'], // Ensure contacts are done for label mapping
      });
    }

    // Phase 4: Media Services (Photos)
    const phase4Services = services.filter(s => ['photos'].includes(s));
    if (phase4Services.length > 0) {
      phases.push({
        phase: 4,
        name: 'Media Services',
        services: phase4Services,
        canRunInParallel: false,
        estimatedDurationMinutes: 240,
        userConcurrency: Math.min(5, userCount), // Very limited concurrency
        serviceConcurrency: 1,
        prerequisites: ['drive'], // Photos might reference Drive files
      });
    }

    return phases;
  }

  private calculateEstimatedDuration(phases: ExecutionPhase[], userCount: number): number {
    let totalMinutes = 0;
    
    for (const phase of phases) {
      // Calculate phase duration based on user concurrency
      const parallelBatches = Math.ceil(userCount / phase.userConcurrency);
      const phaseDuration = parallelBatches * phase.estimatedDurationMinutes;
      totalMinutes += phaseDuration;
    }
    
    return totalMinutes;
  }

  /**
   * Validate an execution plan
   */
  validateExecutionPlan(planId: string): ValidationResult {
    const plan = this.executionPlans.get(planId);
    if (!plan) {
      return {
        isValid: false,
        errors: ['Execution plan not found'],
        warnings: [],
        recommendations: [],
        estimatedDuration: 0,
        riskAssessment: { level: 'high', factors: ['Plan not found'] },
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];
    const riskFactors: string[] = [];

    // Validate user mappings
    if (plan.userMappings.length === 0) {
      errors.push('No user mappings defined');
    }

    // Check for cross-domain migrations (higher risk)
    const crossDomainMappings = plan.userMappings.filter(
      m => m.sourceDomain !== m.targetDomain
    );
    if (crossDomainMappings.length > 0) {
      riskFactors.push('Cross-domain migrations detected');
      recommendations.push('Consider additional testing for cross-domain migrations');
    }

    // Validate service configurations
    const allServices = plan.executionPhases.flatMap(p => p.services);
    const uniqueServices = new Set(allServices);
    if (allServices.length !== uniqueServices.size) {
      warnings.push('Duplicate services detected across phases');
    }

    // Check for high-risk combinations
    if (allServices.includes('gmail') && allServices.includes('drive') && plan.userMappings.length > 50) {
      riskFactors.push('Large-scale Gmail + Drive migration');
      recommendations.push('Consider running Gmail and Drive migrations separately for large user sets');
    }

    // Performance recommendations
    if (plan.userMappings.length > 100) {
      recommendations.push('Consider implementing delta migration for large user sets');
      recommendations.push('Set up enhanced monitoring and alerting');
    }

    // Risk assessment
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (riskFactors.length > 2 || plan.userMappings.length > 200) {
      riskLevel = 'high';
    } else if (riskFactors.length > 0 || plan.userMappings.length > 50) {
      riskLevel = 'medium';
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      recommendations,
      estimatedDuration: plan.estimatedDuration,
      riskAssessment: {
        level: riskLevel,
        factors: riskFactors,
      },
    };
  }

  /**
   * Execute a migration plan
   */
  async executeplan(
    planId: string,
    credentials: ServiceCredentials,
    options: {
      dryRun?: boolean;
      pauseOnError?: boolean;
      notificationWebhook?: string;
    } = {}
  ): Promise<string> {
    const plan = this.executionPlans.get(planId);
    if (!plan) {
      throw new Error('Execution plan not found');
    }

    // Validate plan before execution
    const validation = this.validateExecutionPlan(planId);
    if (!validation.isValid) {
      throw new Error(`Plan validation failed: ${validation.errors.join(', ')}`);
    }

    const executionId = `exec_${planId}_${Date.now()}`;
    const execution = new MigrationExecution(
      executionId,
      plan,
      this.queueManager,
      credentials,
      options
    );

    this.activeExecutions.set(executionId, execution);

    // Set up event listeners
    execution.on('progress', (report: MigrationReport) => {
      this.reports.set(executionId, report);
      this.emit('executionProgress', report);
    });

    execution.on('completed', (report: MigrationReport) => {
      this.reports.set(executionId, report);
      this.activeExecutions.delete(executionId);
      this.emit('executionCompleted', report);
    });

    execution.on('failed', (report: MigrationReport) => {
      this.reports.set(executionId, report);
      this.activeExecutions.delete(executionId);
      this.emit('executionFailed', report);
    });

    // Start execution
    await execution.start();

    return executionId;
  }

  /**
   * Get execution report
   */
  getExecutionReport(executionId: string): MigrationReport | null {
    return this.reports.get(executionId) || null;
  }

  /**
   * Pause an active execution
   */
  async pauseExecution(executionId: string): Promise<boolean> {
    const execution = this.activeExecutions.get(executionId);
    if (execution) {
      await execution.pause();
      return true;
    }
    return false;
  }

  /**
   * Resume a paused execution
   */
  async resumeExecution(executionId: string): Promise<boolean> {
    const execution = this.activeExecutions.get(executionId);
    if (execution) {
      await execution.resume();
      return true;
    }
    return false;
  }

  /**
   * Cancel an active execution
   */
  async cancelExecution(executionId: string): Promise<boolean> {
    const execution = this.activeExecutions.get(executionId);
    if (execution) {
      await execution.cancel();
      this.activeExecutions.delete(executionId);
      return true;
    }
    return false;
  }

  /**
   * Generate comprehensive migration report
   */
  generateComprehensiveReport(executionId: string): MigrationReport | null {
    const report = this.reports.get(executionId);
    if (!report) return null;

    // Enhance report with additional analytics
    return {
      ...report,
      performanceMetrics: this.calculatePerformanceMetrics(report),
      recommendations: this.generateRecommendations(report),
    };
  }

  private calculatePerformanceMetrics(report: MigrationReport): PerformanceMetrics {
    const totalDuration = report.endTime 
      ? new Date(report.endTime).getTime() - new Date(report.startTime).getTime()
      : Date.now() - new Date(report.startTime).getTime();

    const completedUsers = report.userResults.filter(u => u.status === 'completed');
    const avgUserTime = completedUsers.length > 0
      ? completedUsers.reduce((sum, u) => sum + (u.duration || 0), 0) / completedUsers.length
      : 0;

    const totalItems = report.userResults.reduce((sum, u) => sum + u.totalItems, 0);
    const successfulItems = report.userResults.reduce((sum, u) => sum + u.successfulItems, 0);
    const failedItems = report.userResults.reduce((sum, u) => sum + u.failedItems, 0);

    return {
      totalDuration,
      avgUserMigrationTime: avgUserTime,
      peakConcurrency: 0, // Would be tracked during execution
      apiCallsPerService: {}, // Would be tracked during execution
      rateLimitHitsPerService: {}, // Would be tracked during execution
      throughputItemsPerHour: totalItems > 0 ? (totalItems / (totalDuration / (1000 * 60 * 60))) : 0,
      errorRate: totalItems > 0 ? (failedItems / totalItems) * 100 : 0,
    };
  }

  private generateRecommendations(report: MigrationReport): string[] {
    const recommendations: string[] = [];
    
    // Analyze performance metrics
    const metrics = this.calculatePerformanceMetrics(report);
    
    if (metrics.errorRate > 5) {
      recommendations.push('High error rate detected. Consider reviewing API permissions and rate limits.');
    }
    
    if (metrics.avgUserMigrationTime > 300000) { // 5 minutes
      recommendations.push('Long average migration time. Consider optimizing batch sizes or increasing concurrency.');
    }
    
    // Analyze service-specific issues
    const serviceBreakdown = report.serviceBreakdown;
    for (const service of serviceBreakdown) {
      if (service.successRate < 90) {
        recommendations.push(`${service.serviceType} has low success rate (${service.successRate}%). Review common errors.`);
      }
    }
    
    return recommendations;
  }
}

/**
 * Individual migration execution handler
 */
class MigrationExecution extends EventEmitter {
  private id: string;
  private plan: ExecutionPlan;
  private queueManager: MigrationQueueManager;
  private credentials: ServiceCredentials;
  private options: any;
  private status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled' = 'pending';
  private startTime?: string;
  private report: MigrationReport;

  constructor(
    id: string,
    plan: ExecutionPlan,
    queueManager: MigrationQueueManager,
    credentials: ServiceCredentials,
    options: any
  ) {
    super();
    this.id = id;
    this.plan = plan;
    this.queueManager = queueManager;
    this.credentials = credentials;
    this.options = options;
    
    this.report = this.initializeReport();
  }

  private initializeReport(): MigrationReport {
    return {
      planId: this.plan.id,
      executionId: this.id,
      startTime: new Date().toISOString(),
      status: 'running',
      overallProgress: 0,
      userResults: this.plan.userMappings.map(mapping => ({
        userId: mapping.sourceEmail,
        sourceEmail: mapping.sourceEmail,
        targetEmail: mapping.targetEmail,
        status: 'pending',
        services: [],
        totalItems: 0,
        successfulItems: 0,
        failedItems: 0,
        errors: [],
        warnings: [],
      })),
      serviceBreakdown: [],
      performanceMetrics: {
        totalDuration: 0,
        avgUserMigrationTime: 0,
        peakConcurrency: 0,
        apiCallsPerService: {},
        rateLimitHitsPerService: {},
        throughputItemsPerHour: 0,
        errorRate: 0,
      },
      issues: [],
      recommendations: [],
    };
  }

  async start(): Promise<void> {
    this.status = 'running';
    this.startTime = new Date().toISOString();
    
    try {
      // Execute phases sequentially
      for (const phase of this.plan.executionPhases) {
        if (this.status !== 'running') break;
        
        await this.executePhase(phase);
      }
      
      this.status = 'completed';
      this.report.status = 'completed';
      this.report.endTime = new Date().toISOString();
      this.emit('completed', this.report);
      
    } catch (error) {
      this.status = 'failed';
      this.report.status = 'failed';
      this.report.endTime = new Date().toISOString();
      this.emit('failed', this.report);
    }
  }

  private async executePhase(phase: ExecutionPhase): Promise<void> {
    console.log(`Executing phase ${phase.phase}: ${phase.name}`);
    
    // Add jobs to queue for this phase
    const phaseJobs: string[] = [];
    
    for (const userMapping of this.plan.userMappings) {
      const jobId = await this.queueManager.addMigrationJob(
        userMapping.sourceEmail,
        userMapping,
        phase.services,
        'medium'
      );
      phaseJobs.push(jobId);
    }
    
    // Wait for phase completion
    await this.waitForPhaseCompletion(phaseJobs);
  }

  private async waitForPhaseCompletion(jobIds: string[]): Promise<void> {
    return new Promise((resolve) => {
      const checkCompletion = () => {
        const allCompleted = jobIds.every(jobId => {
          const job = this.queueManager.jobs.get(jobId);
          return job && (job.status === 'completed' || job.status === 'failed');
        });
        
        if (allCompleted) {
          resolve();
        } else {
          setTimeout(checkCompletion, 5000); // Check every 5 seconds
        }
      };
      
      checkCompletion();
    });
  }

  async pause(): Promise<void> {
    this.status = 'paused';
  }

  async resume(): Promise<void> {
    this.status = 'running';
  }

  async cancel(): Promise<void> {
    this.status = 'cancelled';
  }
}
