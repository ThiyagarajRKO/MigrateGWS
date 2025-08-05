/**
 * Migration System Integration Layer
 * Connects the advanced migration system with the existing app
 */

import { 
  MigrationExecutionCoordinator,
  ExecutionPlan,
  ValidationResult,
  MigrationReport 
} from '@/services/migration/coordinator';
import { 
  MigrationQueueManager
} from '@/services/migration/queue/manager';
import {
  WorkerConfig
} from '@/services/migration/queue/types';
import { 
  MigrationMonitoringSystem,
  DashboardData,
  MonitoringConfig 
} from '@/services/migration/monitoring';
import { UserMappingConfig, UserMapping } from '@/types';
import { MigrationScenario } from '@/types/migration-scenarios';

export interface IntegratedMigrationSystem {
  queueManager: MigrationQueueManager;
  coordinator: MigrationExecutionCoordinator;
  monitoring: MigrationMonitoringSystem;
  isInitialized: boolean;
}

export interface MigrationExecutionOptions {
  prioritizeSpeed?: boolean;
  prioritizeReliability?: boolean;
  maxConcurrentUsers?: number;
  deltaMode?: boolean;
  dryRun?: boolean;
  pauseOnError?: boolean;
  notificationWebhook?: string;
}

export interface MigrationSessionData {
  executionId?: string;
  planId?: string;
  status: 'idle' | 'planning' | 'validating' | 'executing' | 'completed' | 'failed';
  currentPlan?: ExecutionPlan;
  validationResult?: ValidationResult;
  dashboardData?: DashboardData;
  startTime?: string;
  endTime?: string;
  userMappings: UserMapping[];
  selectedServices: string[];
  executionOptions: MigrationExecutionOptions;
}

export class MigrationSystemIntegration {
  private static instance: MigrationSystemIntegration;
  private system: IntegratedMigrationSystem | null = null;
  private sessionData: MigrationSessionData = {
    status: 'idle',
    userMappings: [],
    selectedServices: [],
    executionOptions: {
      prioritizeReliability: true,
      maxConcurrentUsers: 10,
      deltaMode: false,
    },
  };
  private listeners: Map<string, ((data: MigrationSessionData) => void)[]> = new Map();

  private constructor() {}

  static getInstance(): MigrationSystemIntegration {
    if (!MigrationSystemIntegration.instance) {
      MigrationSystemIntegration.instance = new MigrationSystemIntegration();
    }
    return MigrationSystemIntegration.instance;
  }

  /**
   * Initialize the migration system
   */
  async initialize(options: {
    maxWorkers?: number;
    enableSlackAlerts?: boolean;
    webhookUrls?: { slack?: string; general?: string };
  } = {}): Promise<void> {
    if (this.system?.isInitialized) return;

    try {
      // Initialize worker configuration
      const workerConfig: WorkerConfig = {
        maxConcurrentJobs: options.maxWorkers || 10,
        maxConcurrentUsersPerWorker: 5,
        maxConcurrentServicesPerUser: 2,
        workerHeartbeatInterval: 30000,
        jobTimeoutMs: 3600000, // 1 hour
        cleanupInterval: 300000, // 5 minutes
      };

      // Initialize queue manager
      const queueManager = new MigrationQueueManager(workerConfig);
      
      // Initialize execution coordinator
      const coordinator = new MigrationExecutionCoordinator(queueManager);
      
      // Initialize monitoring system
      const monitoringConfig: MonitoringConfig = {
        alertThresholds: {
          errorRatePercent: 5,
          queueDepthLimit: 100,
          rateLimitHitsPerHour: 50,
          avgProcessingTimeMs: 300000,
          failedJobsLimit: 10,
        },
        dashboardRefreshInterval: 5000,
        alertCooldownMs: 300000,
        enableEmailAlerts: false,
        enableSlackAlerts: options.enableSlackAlerts || false,
        webhookUrls: options.webhookUrls || {},
      };
      
      const monitoring = new MigrationMonitoringSystem(
        monitoringConfig,
        coordinator,
        queueManager
      );

      // Start systems
      await queueManager.start();
      monitoring.start();

      // Set up event listeners
      this.setupEventListeners(coordinator, monitoring);

      this.system = {
        queueManager,
        coordinator,
        monitoring,
        isInitialized: true,
      };

      console.log('Migration system initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize migration system:', error);
      throw error;
    }
  }

  private setupEventListeners(
    coordinator: MigrationExecutionCoordinator,
    monitoring: MigrationMonitoringSystem
  ): void {
    // Monitor dashboard updates
    monitoring.on('dashboardUpdated', (data: DashboardData) => {
      this.sessionData.dashboardData = data;
      this.notifyListeners('dashboardUpdate');
    });

    // Monitor execution events
    coordinator.on('executionProgress', (report: MigrationReport) => {
      this.updateSessionFromReport(report);
      this.notifyListeners('executionProgress');
    });

    coordinator.on('executionCompleted', (report: MigrationReport) => {
      this.sessionData.status = 'completed';
      this.sessionData.endTime = new Date().toISOString();
      this.updateSessionFromReport(report);
      this.notifyListeners('executionCompleted');
    });

    coordinator.on('executionFailed', (report: MigrationReport) => {
      this.sessionData.status = 'failed';
      this.sessionData.endTime = new Date().toISOString();
      this.updateSessionFromReport(report);
      this.notifyListeners('executionFailed');
    });
  }

  private updateSessionFromReport(report: MigrationReport): void {
    // Update session data based on migration report
    // This integrates the advanced system data with the existing app state
  }

  /**
   * Set user mappings from existing app format
   */
  setUserMappings(mappings: UserMapping[]): void {
    this.sessionData.userMappings = mappings;
    this.sessionData.status = 'idle';
    this.notifyListeners('userMappingsChanged');
  }

  /**
   * Set selected services for migration
   */
  setSelectedServices(services: string[]): void {
    this.sessionData.selectedServices = services;
    this.notifyListeners('servicesChanged');
  }

  /**
   * Set execution options
   */
  setExecutionOptions(options: MigrationExecutionOptions): void {
    this.sessionData.executionOptions = { ...this.sessionData.executionOptions, ...options };
    this.notifyListeners('optionsChanged');
  }

  /**
   * Create execution plan
   */
  async createExecutionPlan(name: string): Promise<ExecutionPlan> {
    if (!this.system?.isInitialized) {
      throw new Error('Migration system not initialized');
    }

    this.sessionData.status = 'planning';
    this.notifyListeners('statusChanged');

    try {
      // Convert user mappings to expected format
      const userMappings = this.sessionData.userMappings.map(mapping => ({
        sourceEmail: mapping.sourceUser || '',
        targetEmail: mapping.targetUser || '',
        sourceDomain: mapping.sourceUser?.split('@')[1] || '',
        targetDomain: mapping.targetUser?.split('@')[1] || '',
        status: 'pending' as const,
      }));

      const plan = this.system.coordinator.createExecutionPlan(
        name,
        userMappings,
        this.sessionData.selectedServices,
        this.sessionData.executionOptions
      );

      this.sessionData.currentPlan = plan;
      this.sessionData.planId = plan.id;
      this.notifyListeners('planCreated');

      return plan;
    } catch (error) {
      this.sessionData.status = 'idle';
      this.notifyListeners('statusChanged');
      throw error;
    }
  }

  /**
   * Validate execution plan
   */
  validateExecutionPlan(): ValidationResult | null {
    if (!this.system?.isInitialized || !this.sessionData.planId) {
      return null;
    }

    this.sessionData.status = 'validating';
    this.notifyListeners('statusChanged');

    try {
      const validation = this.system.coordinator.validateExecutionPlan(this.sessionData.planId);
      this.sessionData.validationResult = validation;
      this.notifyListeners('planValidated');
      return validation;
    } catch (error) {
      console.error('Failed to validate execution plan:', error);
      return null;
    }
  }

  /**
   * Execute migration plan
   */
  async executeMigrationPlan(credentials: any): Promise<string> {
    if (!this.system?.isInitialized || !this.sessionData.planId || !this.sessionData.validationResult?.isValid) {
      throw new Error('Cannot execute migration: system not ready or plan invalid');
    }

    this.sessionData.status = 'executing';
    this.sessionData.startTime = new Date().toISOString();
    this.notifyListeners('statusChanged');

    try {
      const executionId = await this.system.coordinator.executeplan(
        this.sessionData.planId,
        credentials,
        this.sessionData.executionOptions
      );

      this.sessionData.executionId = executionId;
      this.notifyListeners('executionStarted');

      return executionId;
    } catch (error) {
      this.sessionData.status = 'failed';
      this.sessionData.endTime = new Date().toISOString();
      this.notifyListeners('statusChanged');
      throw error;
    }
  }

  /**
   * Pause active migration
   */
  async pauseMigration(): Promise<boolean> {
    if (!this.system?.isInitialized || !this.sessionData.executionId) {
      return false;
    }

    return await this.system.coordinator.pauseExecution(this.sessionData.executionId);
  }

  /**
   * Resume paused migration
   */
  async resumeMigration(): Promise<boolean> {
    if (!this.system?.isInitialized || !this.sessionData.executionId) {
      return false;
    }

    return await this.system.coordinator.resumeExecution(this.sessionData.executionId);
  }

  /**
   * Cancel active migration
   */
  async cancelMigration(): Promise<boolean> {
    if (!this.system?.isInitialized || !this.sessionData.executionId) {
      return false;
    }

    const result = await this.system.coordinator.cancelExecution(this.sessionData.executionId);
    if (result) {
      this.sessionData.status = 'idle';
      this.sessionData.executionId = undefined;
      this.notifyListeners('statusChanged');
    }
    return result;
  }

  /**
   * Get current session data
   */
  getSessionData(): MigrationSessionData {
    return { ...this.sessionData };
  }

  /**
   * Get migration report
   */
  getMigrationReport(): MigrationReport | null {
    if (!this.system?.isInitialized || !this.sessionData.executionId) {
      return null;
    }

    return this.system.coordinator.getExecutionReport(this.sessionData.executionId);
  }

  /**
   * Get comprehensive audit report
   */
  getAuditReport(): any | null {
    if (!this.system?.isInitialized || !this.sessionData.executionId) {
      return null;
    }

    return this.system.monitoring.generateAuditReport(this.sessionData.executionId);
  }

  /**
   * Perform random sampling QA
   */
  async performQualityAssurance(samplePercentage: number = 10): Promise<any[]> {
    if (!this.system?.isInitialized || !this.sessionData.executionId) {
      throw new Error('No active execution to validate');
    }

    return await this.system.monitoring.performRandomSamplingQA(
      this.sessionData.executionId,
      samplePercentage
    );
  }

  /**
   * Subscribe to system events
   */
  subscribe(event: string, callback: (data: MigrationSessionData) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  private notifyListeners(event: string): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(this.sessionData);
        } catch (error) {
          console.error('Error in migration system listener:', error);
        }
      });
    }
  }

  /**
   * Reset session data
   */
  resetSession(): void {
    this.sessionData = {
      status: 'idle',
      userMappings: [],
      selectedServices: [],
      executionOptions: {
        prioritizeReliability: true,
        maxConcurrentUsers: 10,
        deltaMode: false,
      },
    };
    this.notifyListeners('sessionReset');
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    if (this.system?.isInitialized) {
      await this.system.queueManager.stop();
      this.system.monitoring.stop();
      this.system.isInitialized = false;
    }
    this.listeners.clear();
    this.resetSession();
  }
}

// Export singleton instance
export const migrationSystem = MigrationSystemIntegration.getInstance();
