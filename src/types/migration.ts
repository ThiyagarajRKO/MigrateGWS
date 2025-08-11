// Shared types for the microservices migration system

export interface Tenant {
  id: string;
  name: string;
  domain: string;
  serviceAccountClientId: string;
  dwdConfigured: boolean;
  verificationToken?: string;
  onboardedAt: Date;
  scopes: string[];
  isActive: boolean;
}

export interface UserMapping {
  sourceEmail: string;
  targetEmail: string;
  mappingType: 'one-to-one' | 'one-to-many' | 'many-to-one';
  targetDomain: string;
  preserveAliases: boolean;
  transferOwnership: boolean;
}

export type ServiceName = 
  | 'gmail' 
  | 'drive' 
  | 'calendar' 
  | 'contacts' 
  | 'chat' 
  | 'groups' 
  | 'photos';

export interface ServiceConfig {
  name: ServiceName;
  enabled: boolean;
  priority: number;
  rateLimit: RateLimitConfig;
  retryPolicy: RetryPolicy;
  batchSize: number;
}

export interface RateLimitConfig {
  requestsPerSecond: number;
  requestsPerMinute: number;
  requestsPerHour: number;
  burstSize: number;
}

export interface RetryPolicy {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableStatusCodes: number[];
}

export interface JobConfig {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  userMappings: UserMapping[];
  services: ServiceConfig[];
  parallelism: {
    maxConcurrentUsers: number;
    maxConcurrentServices: number;
  };
  notifications: {
    webhookUrl?: string;
    emailNotifications: boolean;
    slackWebhook?: string;
  };
  createdAt: Date;
  scheduledAt?: Date;
}

export type TaskStatus = 
  | 'pending' 
  | 'queued' 
  | 'running' 
  | 'completed' 
  | 'failed' 
  | 'retrying' 
  | 'cancelled'
  | 'skipped';

export interface MigrationTask {
  id: string;
  jobId: string;
  tenantId: string;
  userId: string;
  service: ServiceName;
  status: TaskStatus;
  progress: number;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
  retryCount: number;
  idempotencyKey: string;
  metadata: Record<string, any>;
}

export interface JobProgress {
  jobId: string;
  status: TaskStatus;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  skippedTasks: number;
  progress: number;
  estimatedTimeRemaining?: number;
  startedAt: Date;
  lastUpdatedAt: Date;
  serviceProgress: Record<ServiceName, {
    total: number;
    completed: number;
    failed: number;
    progress: number;
  }>;
}

export interface MigrationLog {
  id: string;
  jobId: string;
  taskId?: string;
  tenantId: string;
  userId?: string;
  service?: ServiceName;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: Date;
  metadata?: Record<string, any>;
  correlationId?: string;
}

export interface AuditLog {
  id: string;
  tenantId: string;
  adminEmail: string;
  subjectUser: string;
  timestamp: Date;
  action: string;
  scopes: string[];
  success: boolean;
  errorMessage?: string;
  ipAddress: string;
  userAgent: string;
}

export interface TenantOnboarding {
  tenantId: string;
  step: 'oauth_consent' | 'dwd_configuration' | 'scope_validation' | 'testing' | 'completed';
  completedSteps: string[];
  instructions: string[];
  verificationStatus: {
    dwdConfigured: boolean;
    scopesGranted: boolean;
    testConnectionSuccessful: boolean;
  };
}

export interface MicroserviceHealth {
  service: ServiceName;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastHeartbeat: Date;
  version: string;
  tasksInQueue: number;
  tasksProcessing: number;
  errorRate: number;
  avgProcessingTime: number;
}

export interface OrchestratorMetrics {
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  totalTasks: number;
  tasksPerSecond: number;
  averageJobDuration: number;
  microservices: MicroserviceHealth[];
  queueDepth: Record<ServiceName, number>;
}
