/**
 * Enhanced Multi-Tenant Migration Orchestration Service
 * Implements the complete flowchart flow from tenant registration to completion
 */

import { EventEmitter } from 'events';
import { 
  Tenant, 
  Migration, 
  MigrationJob, 
  UserMapping, 
  TenantDomainConfig,
  TenantServiceAccount,
  MigrationLog 
} from '../../lib/database/schema';
import { getJobQueue } from '../queue/job-queue';
import { getWebSocketServer } from '../websocket/migration-status';

export interface TenantConfigurationData {
  tenantId: string;
  domains: {
    source: TenantDomainConfig;
    target: TenantDomainConfig;
  };
  userMappings: UserMapping[];
  enabledServices: string[];
  serviceAccount: TenantServiceAccount;
  migrationSettings: {
    batchSize: number;
    concurrentJobs: number;
    retryAttempts: number;
    preserveStructure: boolean;
  };
}

export interface MicroserviceExecution {
  service: string;
  users: UserMapping[];
  jobs: MigrationJob[];
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export class EnhancedMigrationOrchestrator extends EventEmitter {
  private activeMigrations: Map<string, Migration> = new Map();
  private microserviceExecutions: Map<string, MicroserviceExecution[]> = new Map();
  private migrationLogs: Map<string, MigrationLog[]> = new Map();

  constructor() {
    super();
    console.log('🎼 Enhanced Migration Orchestrator initialized');
  }

  /**
   * Step 4-6: Pull Tenant Config, Load User List, Domain Mapping, Enabled Services
   * This implements the "Pull Tenant Config from Existing System DB" step
   */
  async loadTenantConfiguration(tenantId: string): Promise<TenantConfigurationData> {
    console.log(`📋 Step 4-6: Loading tenant configuration for: ${tenantId}`);

    try {
      // Load tenant data from database
      const tenant = await this.getTenantData(tenantId);
      const domains = await this.getDomainMappings(tenantId);
      const userMappings = await this.getUserMappings(tenantId);
      const enabledServices = await this.getEnabledServices(tenantId);
      const serviceAccount = await this.getServiceAccount(tenantId);

      const configData: TenantConfigurationData = {
        tenantId,
        domains,
        userMappings,
        enabledServices,
        serviceAccount,
        migrationSettings: {
          batchSize: tenant.subscription.quotas.maxUsers > 100 ? 10 : 5,
          concurrentJobs: tenant.subscription.plan === 'enterprise' ? 5 : 3,
          retryAttempts: 3,
          preserveStructure: true
        }
      };

      console.log(`✅ Tenant configuration loaded: ${userMappings.length} users, ${enabledServices.length} services`);
      
      // Log the configuration loading
      await this.logMigrationEvent(tenantId, 'config_loaded', {
        userCount: userMappings.length,
        services: enabledServices,
        domains: Object.keys(domains)
      });

      return configData;

    } catch (error) {
      console.error(`❌ Failed to load tenant configuration:`, error);
      throw error;
    }
  }

  /**
   * Step 7: Orchestration Service - Split by Service into Microservices
   * This implements the core orchestration logic
   */
  async startMigrationOrchestration(migrationId: string): Promise<void> {
    console.log(`🎼 Step 7: Starting migration orchestration for: ${migrationId}`);

    try {
      // Get migration details
      const migration = await this.getMigration(migrationId);
      if (!migration) {
        throw new Error(`Migration ${migrationId} not found`);
      }

      // Load tenant configuration
      const config = await this.loadTenantConfiguration(migration.tenant_id);

      // Update migration status
      migration.status = 'running';
      migration.started_at = new Date().toISOString();
      await this.saveMigration(migration);

      // Store active migration
      this.activeMigrations.set(migrationId, migration);

      console.log(`🔄 Splitting migration into microservices for ${config.enabledServices.length} services`);

      // Step 7: Split by service into microservices
      const microserviceExecutions = this.createMicroserviceExecutions(config);
      this.microserviceExecutions.set(migrationId, microserviceExecutions);

      // Log orchestration start
      await this.logMigrationEvent(migration.tenant_id, 'orchestration_started', {
        migrationId,
        microservices: microserviceExecutions.length,
        totalUsers: config.userMappings.length
      });

      // Step 8: Execute microservices in parallel
      await this.executeParallelMicroservices(migrationId, microserviceExecutions, config);

    } catch (error) {
      console.error(`❌ Migration orchestration failed:`, error);
      await this.handleMigrationFailure(migrationId, error);
      throw error;
    }
  }

  /**
   * Create microservice execution plans for each enabled service
   */
  private createMicroserviceExecutions(config: TenantConfigurationData): MicroserviceExecution[] {
    const executions: MicroserviceExecution[] = [];

    // Create a microservice execution for each enabled service
    for (const service of config.enabledServices) {
      const jobs = this.createJobsForService(service, config);
      
      executions.push({
        service,
        users: config.userMappings,
        jobs,
        status: 'pending'
      });

      console.log(`📦 Created microservice execution for ${service}: ${jobs.length} jobs`);
    }

    return executions;
  }

  /**
   * Step 8: Execute microservices in parallel per user
   */
  private async executeParallelMicroservices(
    migrationId: string, 
    executions: MicroserviceExecution[], 
    config: TenantConfigurationData
  ): Promise<void> {
    console.log(`⚡ Step 8: Executing ${executions.length} microservices in parallel`);

    const jobQueue = getJobQueue();
    const wsServer = getWebSocketServer();

    try {
      // Start all microservices in parallel
      const executionPromises = executions.map(async (execution) => {
        execution.status = 'running';
        
        console.log(`🚀 Starting microservice: ${execution.service}`);
        
        // Log microservice start
        await this.logMigrationEvent(config.tenantId, 'microservice_started', {
          migrationId,
          service: execution.service,
          jobCount: execution.jobs.length
        });

        // Enqueue all jobs for this microservice
        for (const job of execution.jobs) {
          await jobQueue.enqueueJob(job);
        }

        // Monitor job completion for this microservice
        return this.monitorMicroserviceCompletion(migrationId, execution, config.tenantId);
      });

      // Wait for all microservices to complete
      const results = await Promise.allSettled(executionPromises);
      
      // Process results
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      console.log(`📊 Microservice execution complete: ${successful} successful, ${failed} failed`);

      // Step 9-13: Handle completion flow
      await this.completeMigrationFlow(migrationId, config.tenantId, results);

    } catch (error) {
      console.error(`❌ Parallel microservice execution failed:`, error);
      throw error;
    }
  }

  /**
   * Monitor individual microservice completion
   */
  private async monitorMicroserviceCompletion(
    migrationId: string, 
    execution: MicroserviceExecution,
    tenantId: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(async () => {
        try {
          const jobQueue = getJobQueue();
          const tenantJobs = jobQueue.getTenantJobs(tenantId);
          
          // Check if all jobs for this microservice are complete
          const serviceJobs = execution.jobs.map(j => j.id);
          const runningServiceJobs = tenantJobs.running.filter(j => serviceJobs.includes(j.id));
          const queuedServiceJobs = tenantJobs.queued.filter(j => serviceJobs.includes(j.id));

          if (runningServiceJobs.length === 0 && queuedServiceJobs.length === 0) {
            execution.status = 'completed';
            clearInterval(checkInterval);
            
            // Log microservice completion
            await this.logMigrationEvent(tenantId, 'microservice_completed', {
              migrationId,
              service: execution.service,
              jobsCompleted: execution.jobs.length
            });

            console.log(`✅ Microservice ${execution.service} completed`);
            resolve();
          }

        } catch (error) {
          execution.status = 'failed';
          clearInterval(checkInterval);
          reject(error);
        }
      }, 2000); // Check every 2 seconds

      // Timeout after 30 minutes
      setTimeout(() => {
        execution.status = 'failed';
        clearInterval(checkInterval);
        reject(new Error(`Microservice ${execution.service} timed out`));
      }, 30 * 60 * 1000);
    });
  }

  /**
   * Steps 9-13: Complete migration flow (Dashboard updates, Logs, UI, Notifications)
   */
  private async completeMigrationFlow(
    migrationId: string, 
    tenantId: string, 
    results: PromiseSettledResult<void>[]
  ): Promise<void> {
    console.log(`🏁 Steps 9-13: Completing migration flow for: ${migrationId}`);

    const migration = this.activeMigrations.get(migrationId);
    if (!migration) return;

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    try {
      // Step 9: Update Migration Status Dashboard
      migration.status = failed > 0 ? 'failed' : 'completed';
      migration.completed_at = new Date().toISOString();
      
      // Update progress
      migration.progress.completed_users = migration.progress.total_users;
      migration.progress.failed_users = failed;
      
      await this.saveMigration(migration);

      // Step 10: Store Logs in DB for Auditing
      await this.finalizeAuditLogs(migrationId, tenantId);

      // Step 11: Expose Logs in UI for Tenant
      await this.updateTenantDashboard(migrationId, tenantId);

      // Step 12: Send Migration Complete Notification
      await this.sendCompletionNotification(migrationId, tenantId, migration.status);

      // Clean up
      this.activeMigrations.delete(migrationId);
      this.microserviceExecutions.delete(migrationId);

      console.log(`✅ Migration flow completed: ${migrationId}`);

    } catch (error) {
      console.error(`❌ Failed to complete migration flow:`, error);
      throw error;
    }
  }

  /**
   * Create jobs for a specific service
   */
  private createJobsForService(service: string, config: TenantConfigurationData): MigrationJob[] {
    const jobs: MigrationJob[] = [];

    for (const userMapping of config.userMappings) {
      const job: MigrationJob = {
        id: `${config.tenantId}_${service}_${userMapping.id}_${Date.now()}`,
        migration_id: `migration_${config.tenantId}`,
        tenant_id: config.tenantId,
        service_type: service,
        user_mapping_id: userMapping.id,
        status: 'queued',
        priority: this.calculateJobPriority(service, config),
        source_data: {
          user_email: userMapping.source_email,
          domain: config.domains.source.domain
        },
        target_data: {
          user_email: userMapping.target_email,
          domain: config.domains.target.domain
        },
        items_total: this.estimateItemsForService(service),
        items_processed: 0,
        items_failed: 0,
        queued_at: new Date().toISOString(),
        api_calls_made: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      jobs.push(job);
    }

    return jobs;
  }

  /**
   * Calculate job priority based on service type and tenant settings
   */
  private calculateJobPriority(service: string, config: TenantConfigurationData): number {
    const servicePriorities: Record<string, number> = {
      gmail: 8,
      drive: 7,
      calendar: 6,
      contacts: 5,
      chat: 4,
      groups: 3,
      photos: 2,
      forms: 1
    };

    return servicePriorities[service] || 5;
  }

  /**
   * Estimate number of items for a service (for demo purposes)
   */
  private estimateItemsForService(service: string): number {
    const estimates: Record<string, number> = {
      gmail: 1000,
      drive: 500,
      calendar: 100,
      contacts: 200,
      chat: 300,
      groups: 10,
      photos: 2000,
      forms: 5
    };

    return estimates[service] || 100;
  }

  // Database and logging methods
  private async logMigrationEvent(tenantId: string, event: string, data: any): Promise<void> {
    const log: MigrationLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      migration_id: `migration_${tenantId}`,
      tenant_id: tenantId,
      level: 'info',
      message: `Migration event: ${event}`,
      context: {
        metadata: data
      },
      timestamp: new Date().toISOString()
    };

    // Store log
    const logs = this.migrationLogs.get(tenantId) || [];
    logs.push(log);
    this.migrationLogs.set(tenantId, logs);

    console.log(`📝 Logged event [${event}] for tenant ${tenantId}`);
  }

  private async finalizeAuditLogs(migrationId: string, tenantId: string): Promise<void> {
    console.log(`📊 Step 10: Finalizing audit logs for migration: ${migrationId}`);
    // Implementation for storing final audit logs
  }

  private async updateTenantDashboard(migrationId: string, tenantId: string): Promise<void> {
    console.log(`🖥️ Step 11: Updating tenant dashboard for: ${tenantId}`);
    
    const wsServer = getWebSocketServer();
    wsServer.broadcastMigrationProgress(tenantId, migrationId, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      dashboardReady: true
    });
  }

  private async sendCompletionNotification(migrationId: string, tenantId: string, status: string): Promise<void> {
    console.log(`📧 Step 12: Sending completion notification - Migration ${migrationId}: ${status}`);
    
    // Implementation for sending notification (email, webhook, etc.)
    const notification = {
      type: 'migration_completion',
      migrationId,
      tenantId,
      status,
      timestamp: new Date().toISOString(),
      dashboardUrl: `/dashboard/migrations/${migrationId}`
    };

    console.log('📧 Notification sent:', notification);
  }

  // Mock database methods (replace with actual database calls)
  private async getTenantData(tenantId: string): Promise<Tenant> {
    return {
      id: tenantId,
      name: 'Demo Tenant',
      domain: 'demo.example.com',
      status: 'active',
      subscription: {
        plan: 'enterprise',
        quotas: {
          maxMigrations: 10,
          maxUsers: 1000,
          maxStorageGB: 10000,
          apiCallsPerMonth: 100000
        },
        billing: {
          isActive: true,
          nextBillingDate: '2024-02-01',
          pricePerUser: 15
        }
      },
      settings: {
        allowCrossTenantMigration: true,
        requireApprovalForMigrations: false,
        retentionDays: 365,
        enableAuditLogs: true
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  private async getDomainMappings(tenantId: string): Promise<{ source: TenantDomainConfig; target: TenantDomainConfig }> {
    return {
      source: {
        id: 'source-1',
        tenant_id: tenantId,
        domain: 'source.example.com',
        type: 'source',
        admin_email: 'admin@source.example.com',
        is_verified: true,
        delegation_status: 'verified',
        oauth_scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      target: {
        id: 'target-1',
        tenant_id: tenantId,
        domain: 'target.example.com',
        type: 'target',
        admin_email: 'admin@target.example.com',
        is_verified: true,
        delegation_status: 'verified',
        oauth_scopes: ['https://www.googleapis.com/auth/gmail'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    };
  }

  private async getUserMappings(tenantId: string): Promise<UserMapping[]> {
    return [
      {
        id: 'mapping-1',
        migration_id: `migration_${tenantId}`,
        source_email: 'user1@source.example.com',
        target_email: 'user1@target.example.com',
        source_domain: 'source.example.com',
        target_domain: 'target.example.com',
        status: 'pending',
        mapping_type: 'direct',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'mapping-2',
        migration_id: `migration_${tenantId}`,
        source_email: 'user2@source.example.com',
        target_email: 'user2@target.example.com',
        source_domain: 'source.example.com',
        target_domain: 'target.example.com',
        status: 'pending',
        mapping_type: 'direct',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];
  }

  private async getEnabledServices(tenantId: string): Promise<string[]> {
    return ['gmail', 'drive', 'calendar', 'contacts', 'chat', 'photos', 'groups'];
  }

  private async getServiceAccount(tenantId: string): Promise<TenantServiceAccount> {
    return {
      id: 'sa-1',
      tenant_id: tenantId,
      client_id: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_ID || 'mock-client-id',
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || 'service@example.com',
      private_key_id: 'key-id',
      private_key_encrypted: 'encrypted-private-key',
      project_id: 'project-id',
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
      client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/service%40example.com',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  private async getMigration(migrationId: string): Promise<Migration | null> {
    // Mock migration data
    return {
      id: migrationId,
      tenant_id: 'demo-tenant-1',
      name: 'Demo Migration',
      type: 'cross-tenant',
      status: 'draft',
      source_domains: ['source.example.com'],
      target_domains: ['target.example.com'],
      domain_mapping: { 'source.example.com': ['target.example.com'] },
      selected_users: ['user1@source.example.com', 'user2@source.example.com'],
      user_mappings: [],
      services: ['gmail', 'drive', 'calendar'],
      service_configs: {},
      batch_size: 10,
      retry_attempts: 3,
      throttle_ms: 1000,
      progress: {
        total_users: 2,
        completed_users: 0,
        failed_users: 0,
        total_items: 0,
        completed_items: 0,
        failed_items: 0
      },
      created_by: 'system',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  private async saveMigration(migration: Migration): Promise<void> {
    console.log(`💾 Saving migration: ${migration.id} (${migration.status})`);
  }

  private async handleMigrationFailure(migrationId: string, error: any): Promise<void> {
    console.error(`❌ Handling migration failure for ${migrationId}:`, error);
    
    const migration = this.activeMigrations.get(migrationId);
    if (migration) {
      migration.status = 'failed';
      migration.completed_at = new Date().toISOString();
      await this.saveMigration(migration);
    }
  }
}

// Singleton instance
let orchestrator: EnhancedMigrationOrchestrator | null = null;

export function getEnhancedOrchestrator(): EnhancedMigrationOrchestrator {
  if (!orchestrator) {
    orchestrator = new EnhancedMigrationOrchestrator();
  }
  return orchestrator;
}

export default EnhancedMigrationOrchestrator;
