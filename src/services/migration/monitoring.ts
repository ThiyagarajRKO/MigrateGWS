/**
 * Migration Monitoring and Dashboard System
 * Provides real-time monitoring, alerts, and comprehensive reporting
 */

import { EventEmitter } from 'events';
import { MigrationExecutionCoordinator, MigrationReport, UserMigrationResult, Issue } from './coordinator';
import { MigrationQueueManager, QueueMetrics } from './queue/manager';

export interface MonitoringConfig {
  alertThresholds: {
    errorRatePercent: number;
    queueDepthLimit: number;
    rateLimitHitsPerHour: number;
    avgProcessingTimeMs: number;
    failedJobsLimit: number;
  };
  dashboardRefreshInterval: number;
  alertCooldownMs: number;
  enableEmailAlerts: boolean;
  enableSlackAlerts: boolean;
  webhookUrls: {
    slack?: string;
    general?: string;
  };
}

export interface DashboardData {
  overview: {
    totalMigrations: number;
    activeMigrations: number;
    completedMigrations: number;
    failedMigrations: number;
    totalUsers: number;
    overallSuccessRate: number;
  };
  realTimeMetrics: {
    currentThroughput: number; // Items per hour
    activeWorkers: number;
    queueDepth: number;
    avgProcessingTime: number;
    rateLimitHits: number;
  };
  serviceMetrics: {
    [service: string]: {
      totalUsers: number;
      completedUsers: number;
      failedUsers: number;
      avgDuration: number;
      successRate: number;
      lastProcessed: string;
    };
  };
  userProgress: UserProgressData[];
  recentActivity: ActivityLogEntry[];
  alerts: AlertData[];
  performanceTrends: PerformanceTrend[];
}

export interface UserProgressData {
  userId: string;
  sourceEmail: string;
  targetEmail: string;
  overallProgress: number;
  currentService?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  startTime?: string;
  estimatedCompletion?: string;
  services: {
    serviceType: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    progress: number;
    itemsProcessed: number;
    itemsTotal: number;
    duration?: number;
  }[];
  issues: string[];
}

export interface ActivityLogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'success';
  category: 'migration' | 'system' | 'user' | 'service';
  message: string;
  details?: any;
  userId?: string;
  serviceType?: string;
}

export interface AlertData {
  id: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  category: 'performance' | 'data' | 'system' | 'rate-limit';
  timestamp: string;
  acknowledged: boolean;
  autoResolved: boolean;
  affectedUsers?: string[];
  affectedServices?: string[];
  actionRequired?: string;
}

export interface PerformanceTrend {
  timestamp: string;
  throughput: number;
  errorRate: number;
  avgProcessingTime: number;
  queueDepth: number;
  activeWorkers: number;
}

export interface ValidationSample {
  userId: string;
  serviceType: string;
  sampleData: {
    sourceCount: number;
    targetCount: number;
    matchedItems: number;
    missingItems: string[];
    checksumMatch?: boolean;
  };
  validationTime: string;
  isValid: boolean;
  issues: string[];
}

export class MigrationMonitoringSystem extends EventEmitter {
  private config: MonitoringConfig;
  private coordinator: MigrationExecutionCoordinator;
  private queueManager: MigrationQueueManager;
  private alerts: Map<string, AlertData> = new Map();
  private activityLog: ActivityLogEntry[] = [];
  private performanceTrends: PerformanceTrend[] = [];
  private isMonitoring = false;
  private dashboardData: DashboardData;
  private monitoringInterval?: NodeJS.Timeout;
  private alertCooldowns: Map<string, number> = new Map();

  constructor(
    config: MonitoringConfig,
    coordinator: MigrationExecutionCoordinator,
    queueManager: MigrationQueueManager
  ) {
    super();
    this.config = config;
    this.coordinator = coordinator;
    this.queueManager = queueManager;
    this.dashboardData = this.initializeDashboard();
    
    this.setupEventListeners();
  }

  private initializeDashboard(): DashboardData {
    return {
      overview: {
        totalMigrations: 0,
        activeMigrations: 0,
        completedMigrations: 0,
        failedMigrations: 0,
        totalUsers: 0,
        overallSuccessRate: 0,
      },
      realTimeMetrics: {
        currentThroughput: 0,
        activeWorkers: 0,
        queueDepth: 0,
        avgProcessingTime: 0,
        rateLimitHits: 0,
      },
      serviceMetrics: {},
      userProgress: [],
      recentActivity: [],
      alerts: [],
      performanceTrends: [],
    };
  }

  private setupEventListeners(): void {
    // Listen to coordinator events
    this.coordinator.on('executionProgress', (report: MigrationReport) => {
      this.updateDashboardFromReport(report);
      this.logActivity('info', 'migration', `Migration progress updated for execution ${report.executionId}`, report);
    });

    this.coordinator.on('executionCompleted', (report: MigrationReport) => {
      this.updateDashboardFromReport(report);
      this.logActivity('success', 'migration', `Migration completed for execution ${report.executionId}`, report);
    });

    this.coordinator.on('executionFailed', (report: MigrationReport) => {
      this.updateDashboardFromReport(report);
      this.createAlert('error', 'Migration Failed', `Execution ${report.executionId} has failed`, 'data');
      this.logActivity('error', 'migration', `Migration failed for execution ${report.executionId}`, report);
    });

    // Listen to queue manager events
    this.queueManager.on('jobStatusChanged', (job: any) => {
      this.logActivity('info', 'user', `Job ${job.id} status changed to ${job.status}`, { userId: job.userId });
    });

    this.queueManager.on('healthCheck', (healthCheck: any) => {
      if (!healthCheck.isHealthy) {
        this.createAlert('warning', 'Queue Health Issue', `Queue health issues detected: ${healthCheck.issues.join(', ')}`, 'system');
      }
    });
  }

  /**
   * Start monitoring system
   */
  start(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    console.log('Starting Migration Monitoring System...');

    // Start periodic dashboard updates
    this.monitoringInterval = setInterval(() => {
      this.updateDashboard();
      this.checkAlertThresholds();
      this.recordPerformanceTrend();
    }, this.config.dashboardRefreshInterval);

    this.logActivity('info', 'system', 'Migration monitoring system started');
    this.emit('monitoringStarted');
  }

  /**
   * Stop monitoring system
   */
  stop(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.logActivity('info', 'system', 'Migration monitoring system stopped');
    this.emit('monitoringStopped');
  }

  /**
   * Get current dashboard data
   */
  getDashboardData(): DashboardData {
    return { ...this.dashboardData };
  }

  /**
   * Get live migration status for specific user
   */
  getUserMigrationStatus(userId: string): UserProgressData | null {
    return this.dashboardData.userProgress.find(user => user.userId === userId) || null;
  }

  /**
   * Create manual alert
   */
  createAlert(
    level: AlertData['level'],
    title: string,
    message: string,
    category: AlertData['category'],
    options: {
      affectedUsers?: string[];
      affectedServices?: string[];
      actionRequired?: string;
    } = {}
  ): string {
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const alert: AlertData = {
      id: alertId,
      level,
      title,
      message,
      category,
      timestamp: new Date().toISOString(),
      acknowledged: false,
      autoResolved: false,
      ...options,
    };

    this.alerts.set(alertId, alert);
    this.dashboardData.alerts.unshift(alert);

    // Keep only recent alerts in dashboard
    if (this.dashboardData.alerts.length > 50) {
      this.dashboardData.alerts = this.dashboardData.alerts.slice(0, 50);
    }

    this.logActivity(level, 'system', `Alert created: ${title}`, { alertId, category });
    this.emit('alertCreated', alert);

    // Send external notifications
    this.sendAlertNotifications(alert);

    return alertId;
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      this.logActivity('info', 'system', `Alert acknowledged: ${alert.title}`, { alertId });
      this.emit('alertAcknowledged', alert);
      return true;
    }
    return false;
  }

  /**
   * Perform random sampling validation
   */
  async performRandomSamplingQA(
    executionId: string,
    samplePercentage: number = 10
  ): Promise<ValidationSample[]> {
    console.log(`Performing random sampling QA (${samplePercentage}%) for execution ${executionId}`);
    
    const report = this.coordinator.getExecutionReport(executionId);
    if (!report) {
      throw new Error('Execution report not found');
    }

    const completedUsers = report.userResults.filter(user => user.status === 'completed');
    const sampleSize = Math.max(1, Math.floor(completedUsers.length * (samplePercentage / 100)));
    
    // Randomly select users for validation
    const selectedUsers = this.shuffleArray([...completedUsers]).slice(0, sampleSize);
    const validationResults: ValidationSample[] = [];

    for (const user of selectedUsers) {
      for (const service of user.services) {
        if (service.status === 'completed') {
          const sample = await this.validateServiceMigration(user, service);
          validationResults.push(sample);
        }
      }
    }

    this.logActivity('info', 'system', `Random sampling QA completed for ${validationResults.length} samples`);
    return validationResults;
  }

  private async validateServiceMigration(
    user: UserMigrationResult,
    service: any
  ): Promise<ValidationSample> {
    // This would integrate with actual Google APIs to validate migration
    // For now, returning a mock validation
    const mockValidation: ValidationSample = {
      userId: user.userId,
      serviceType: service.serviceType,
      sampleData: {
        sourceCount: service.itemsProcessed + service.itemsFailed,
        targetCount: service.itemsProcessed,
        matchedItems: service.itemsProcessed,
        missingItems: [],
        checksumMatch: true,
      },
      validationTime: new Date().toISOString(),
      isValid: service.itemsFailed === 0,
      issues: service.itemsFailed > 0 ? [`${service.itemsFailed} items failed to migrate`] : [],
    };

    return mockValidation;
  }

  /**
   * Generate comprehensive audit report
   */
  generateAuditReport(executionId: string): any {
    const report = this.coordinator.getExecutionReport(executionId);
    if (!report) {
      throw new Error('Execution report not found');
    }

    const auditReport = {
      executionInfo: {
        executionId: report.executionId,
        planId: report.planId,
        startTime: report.startTime,
        endTime: report.endTime,
        duration: report.endTime 
          ? new Date(report.endTime).getTime() - new Date(report.startTime).getTime()
          : null,
        status: report.status,
      },
      summary: {
        totalUsers: report.userResults.length,
        completedUsers: report.userResults.filter(u => u.status === 'completed').length,
        failedUsers: report.userResults.filter(u => u.status === 'failed').length,
        overallSuccessRate: report.overallProgress,
        totalItems: report.userResults.reduce((sum, u) => sum + u.totalItems, 0),
        migratedItems: report.userResults.reduce((sum, u) => sum + u.successfulItems, 0),
        failedItems: report.userResults.reduce((sum, u) => sum + u.failedItems, 0),
      },
      serviceBreakdown: report.serviceBreakdown,
      performanceMetrics: report.performanceMetrics,
      userDetails: report.userResults.map(user => ({
        sourceEmail: user.sourceEmail,
        targetEmail: user.targetEmail,
        status: user.status,
        duration: user.duration,
        successfulItems: user.successfulItems,
        failedItems: user.failedItems,
        errors: user.errors,
        warnings: user.warnings,
      })),
      issues: report.issues,
      recommendations: report.recommendations,
      generatedAt: new Date().toISOString(),
    };

    return auditReport;
  }

  private updateDashboard(): void {
    const queueMetrics = this.queueManager.getMetrics();
    
    // Update real-time metrics
    this.dashboardData.realTimeMetrics = {
      currentThroughput: this.calculateCurrentThroughput(),
      activeWorkers: queueMetrics.activeWorkers,
      queueDepth: queueMetrics.queueDepth,
      avgProcessingTime: queueMetrics.avgProcessingTime,
      rateLimitHits: queueMetrics.rateLimitHits,
    };

    // Update recent activity (keep last 100 entries)
    this.dashboardData.recentActivity = this.activityLog
      .slice(-100)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    this.emit('dashboardUpdated', this.dashboardData);
  }

  private updateDashboardFromReport(report: MigrationReport): void {
    // Update overview
    this.dashboardData.overview.totalUsers = report.userResults.length;
    this.dashboardData.overview.overallSuccessRate = report.overallProgress;

    // Update user progress
    this.dashboardData.userProgress = report.userResults.map(user => ({
      userId: user.userId,
      sourceEmail: user.sourceEmail,
      targetEmail: user.targetEmail,
      overallProgress: this.calculateUserProgress(user),
      currentService: this.getCurrentService(user),
      status: user.status,
      startTime: user.startTime,
      estimatedCompletion: this.estimateCompletion(user),
      services: user.services.map(service => ({
        serviceType: service.serviceType,
        status: service.status,
        progress: service.estimatedItems > 0 
          ? Math.round((service.itemsProcessed / service.estimatedItems) * 100)
          : 0,
        itemsProcessed: service.itemsProcessed,
        itemsTotal: service.estimatedItems,
        duration: service.duration,
      })),
      issues: [...user.errors, ...user.warnings],
    }));

    // Update service metrics
    for (const serviceBreakdown of report.serviceBreakdown) {
      this.dashboardData.serviceMetrics[serviceBreakdown.serviceType] = {
        totalUsers: serviceBreakdown.totalUsers,
        completedUsers: serviceBreakdown.completedUsers,
        failedUsers: serviceBreakdown.failedUsers,
        avgDuration: serviceBreakdown.avgDuration,
        successRate: serviceBreakdown.successRate,
        lastProcessed: new Date().toISOString(),
      };
    }
  }

  private calculateUserProgress(user: UserMigrationResult): number {
    if (user.services.length === 0) return 0;
    
    const serviceProgresses = user.services.map(service => {
      if (service.status === 'completed') return 100;
      if (service.status === 'failed') return 0;
      if (service.estimatedItems > 0) {
        return (service.itemsProcessed / service.estimatedItems) * 100;
      }
      return 0;
    });

    return Math.round(serviceProgresses.reduce((sum, p) => sum + p, 0) / serviceProgresses.length);
  }

  private getCurrentService(user: UserMigrationResult): string | undefined {
    const runningService = user.services.find(s => s.status === 'running');
    return runningService?.serviceType;
  }

  private estimateCompletion(user: UserMigrationResult): string | undefined {
    // Simple estimation based on average service duration
    // In a real implementation, this would be more sophisticated
    const remainingServices = user.services.filter(s => s.status === 'pending').length;
    if (remainingServices === 0) return undefined;

    const avgDuration = 30 * 60 * 1000; // 30 minutes average
    const estimatedMs = remainingServices * avgDuration;
    return new Date(Date.now() + estimatedMs).toISOString();
  }

  private calculateCurrentThroughput(): number {
    // Calculate items processed in the last hour
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const recentActivity = this.activityLog.filter(
      entry => new Date(entry.timestamp).getTime() > oneHourAgo
    );
    
    // This is a simplified calculation
    return recentActivity.length;
  }

  private checkAlertThresholds(): void {
    const metrics = this.queueManager.getMetrics();
    const now = Date.now();

    // Check error rate
    if (metrics.totalJobs > 0 && (metrics.failedJobs / metrics.totalJobs) * 100 > this.config.alertThresholds.errorRatePercent) {
      if (!this.shouldSkipAlert('high-error-rate', now)) {
        this.createAlert(
          'warning',
          'High Error Rate',
          `Error rate is ${((metrics.failedJobs / metrics.totalJobs) * 100).toFixed(1)}%`,
          'performance'
        );
        this.alertCooldowns.set('high-error-rate', now);
      }
    }

    // Check queue depth
    if (metrics.queueDepth > this.config.alertThresholds.queueDepthLimit) {
      if (!this.shouldSkipAlert('high-queue-depth', now)) {
        this.createAlert(
          'warning',
          'High Queue Depth',
          `Queue depth is ${metrics.queueDepth}`,
          'performance'
        );
        this.alertCooldowns.set('high-queue-depth', now);
      }
    }

    // Check rate limit hits
    if (metrics.rateLimitHits > this.config.alertThresholds.rateLimitHitsPerHour) {
      if (!this.shouldSkipAlert('rate-limit-hits', now)) {
        this.createAlert(
          'error',
          'High Rate Limit Hits',
          `Rate limit hits: ${metrics.rateLimitHits}`,
          'rate-limit'
        );
        this.alertCooldowns.set('rate-limit-hits', now);
      }
    }
  }

  private shouldSkipAlert(alertType: string, now: number): boolean {
    const lastAlert = this.alertCooldowns.get(alertType);
    return lastAlert ? (now - lastAlert) < this.config.alertCooldownMs : false;
  }

  private recordPerformanceTrend(): void {
    const metrics = this.queueManager.getMetrics();
    
    const trend: PerformanceTrend = {
      timestamp: new Date().toISOString(),
      throughput: this.calculateCurrentThroughput(),
      errorRate: metrics.totalJobs > 0 ? (metrics.failedJobs / metrics.totalJobs) * 100 : 0,
      avgProcessingTime: metrics.avgProcessingTime,
      queueDepth: metrics.queueDepth,
      activeWorkers: metrics.activeWorkers,
    };

    this.performanceTrends.push(trend);

    // Keep only last 24 hours of trends (assuming 5-minute intervals)
    const maxTrends = (24 * 60) / 5; // 288 data points
    if (this.performanceTrends.length > maxTrends) {
      this.performanceTrends = this.performanceTrends.slice(-maxTrends);
    }

    this.dashboardData.performanceTrends = this.performanceTrends;
  }

  private logActivity(
    level: ActivityLogEntry['level'],
    category: ActivityLogEntry['category'],
    message: string,
    details?: any
  ): void {
    const entry: ActivityLogEntry = {
      id: `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      details,
    };

    this.activityLog.push(entry);

    // Keep only last 1000 entries
    if (this.activityLog.length > 1000) {
      this.activityLog = this.activityLog.slice(-1000);
    }

    this.emit('activityLogged', entry);
  }

  private async sendAlertNotifications(alert: AlertData): Promise<void> {
    try {
      // Send Slack notification
      if (this.config.enableSlackAlerts && this.config.webhookUrls.slack) {
        await this.sendSlackAlert(alert);
      }

      // Send general webhook notification
      if (this.config.webhookUrls.general) {
        await this.sendWebhookAlert(alert);
      }
    } catch (error) {
      console.error('Failed to send alert notifications:', error);
    }
  }

  private async sendSlackAlert(alert: AlertData): Promise<void> {
    // Implementation would send to Slack webhook
    console.log(`Slack alert: [${alert.level.toUpperCase()}] ${alert.title}: ${alert.message}`);
  }

  private async sendWebhookAlert(alert: AlertData): Promise<void> {
    // Implementation would send to general webhook
    console.log(`Webhook alert: [${alert.level.toUpperCase()}] ${alert.title}: ${alert.message}`);
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}
