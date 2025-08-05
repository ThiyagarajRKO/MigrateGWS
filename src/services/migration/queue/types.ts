/**
 * Migration Queue Types and Interfaces
 * Defines the structure for concurrent migration processing
 */

export interface MigrationJob {
  id: string;
  userId: string;
  userMapping: {
    sourceEmail: string;
    targetEmail: string;
    sourceDomain: string;
    targetDomain: string;
  };
  services: string[];
  priority: 'high' | 'medium' | 'low';
  phase: 1 | 2 | 3 | 4;
  retryCount: number;
  maxRetries: number;
  createdAt: string;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;
  status: 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'retrying';
  metadata?: {
    estimatedItems?: number;
    actualItems?: number;
    estimatedDuration?: number;
    actualDuration?: number;
  };
}

export interface ServiceJob {
  id: string;
  parentJobId: string;
  userId: string;
  serviceType: string;
  priority: number;
  retryCount: number;
  maxRetries: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  estimatedItems: number;
  processedItems: number;
  failedItems: number;
  rateLimitConfig: RateLimitConfig;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
  burstLimit: number;
  backoffStrategy: 'linear' | 'exponential';
  maxBackoffMs: number;
}

export interface WorkerConfig {
  maxConcurrentJobs: number;
  maxConcurrentUsersPerWorker: number;
  maxConcurrentServicesPerUser: number;
  workerHeartbeatInterval: number;
  jobTimeoutMs: number;
  cleanupInterval: number;
}

export interface QueueMetrics {
  totalJobs: number;
  pendingJobs: number;
  runningJobs: number;
  completedJobs: number;
  failedJobs: number;
  avgProcessingTime: number;
  successRate: number;
  activeWorkers: number;
  queueDepth: number;
  rateLimitHits: number;
  lastProcessedAt?: string;
}

export interface MigrationPhase {
  phase: number;
  name: string;
  services: string[];
  description: string;
  priority: 'high' | 'medium' | 'low';
  canRunInParallel: boolean;
  estimatedDurationMinutes: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface ServicePriorityConfig {
  serviceType: string;
  priority: number; // 1-10, 1 being highest priority
  phase: number;
  estimatedDurationMinutes: number;
  riskLevel: 'low' | 'medium' | 'high';
  rateLimitConfig: RateLimitConfig;
  dependencies: string[]; // Services that must complete before this one
  canRunInParallel: boolean;
  maxRetries: number;
}

// Migration execution phases
export const MIGRATION_PHASES: MigrationPhase[] = [
  {
    phase: 1,
    name: 'Fast & Low-Risk Services',
    services: ['contacts', 'tasks', 'calendar'],
    description: 'Quick migrations with minimal risk',
    priority: 'high',
    canRunInParallel: true,
    estimatedDurationMinutes: 15,
    riskLevel: 'low',
  },
  {
    phase: 2,
    name: 'Communication Services',
    services: ['chat', 'sites'],
    description: 'Communication and collaboration tools',
    priority: 'medium',
    canRunInParallel: true,
    estimatedDurationMinutes: 30,
    riskLevel: 'medium',
  },
  {
    phase: 3,
    name: 'Heavy Data Services',
    services: ['gmail', 'drive'],
    description: 'Large data migrations requiring careful handling',
    priority: 'medium',
    canRunInParallel: false, // Due to rate limits
    estimatedDurationMinutes: 180,
    riskLevel: 'high',
  },
  {
    phase: 4,
    name: 'Media Services',
    services: ['photos'],
    description: 'Media-heavy migrations (optional)',
    priority: 'low',
    canRunInParallel: false,
    estimatedDurationMinutes: 240,
    riskLevel: 'high',
  },
];

// Service-specific rate limits and configurations
export const SERVICE_PRIORITY_CONFIGS: ServicePriorityConfig[] = [
  {
    serviceType: 'contacts',
    priority: 1,
    phase: 1,
    estimatedDurationMinutes: 5,
    riskLevel: 'low',
    rateLimitConfig: {
      requestsPerMinute: 100,
      requestsPerHour: 3000,
      requestsPerDay: 50000,
      burstLimit: 10,
      backoffStrategy: 'linear',
      maxBackoffMs: 5000,
    },
    dependencies: [],
    canRunInParallel: true,
    maxRetries: 3,
  },
  {
    serviceType: 'calendar',
    priority: 2,
    phase: 1,
    estimatedDurationMinutes: 8,
    riskLevel: 'low',
    rateLimitConfig: {
      requestsPerMinute: 200,
      requestsPerHour: 5000,
      requestsPerDay: 100000,
      burstLimit: 20,
      backoffStrategy: 'exponential',
      maxBackoffMs: 10000,
    },
    dependencies: [],
    canRunInParallel: true,
    maxRetries: 3,
  },
  {
    serviceType: 'tasks',
    priority: 3,
    phase: 1,
    estimatedDurationMinutes: 3,
    riskLevel: 'low',
    rateLimitConfig: {
      requestsPerMinute: 150,
      requestsPerHour: 4000,
      requestsPerDay: 80000,
      burstLimit: 15,
      backoffStrategy: 'linear',
      maxBackoffMs: 3000,
    },
    dependencies: [],
    canRunInParallel: true,
    maxRetries: 3,
  },
  {
    serviceType: 'chat',
    priority: 4,
    phase: 2,
    estimatedDurationMinutes: 20,
    riskLevel: 'medium',
    rateLimitConfig: {
      requestsPerMinute: 50,
      requestsPerHour: 1000,
      requestsPerDay: 10000,
      burstLimit: 5,
      backoffStrategy: 'exponential',
      maxBackoffMs: 30000,
    },
    dependencies: [],
    canRunInParallel: true,
    maxRetries: 5,
  },
  {
    serviceType: 'gmail',
    priority: 5,
    phase: 3,
    estimatedDurationMinutes: 120,
    riskLevel: 'high',
    rateLimitConfig: {
      requestsPerMinute: 40, // Conservative for Gmail API
      requestsPerHour: 1000,
      requestsPerDay: 2500, // Gmail API daily limit per user
      burstLimit: 3,
      backoffStrategy: 'exponential',
      maxBackoffMs: 60000,
    },
    dependencies: ['contacts'], // Ensure contacts are migrated first for label mapping
    canRunInParallel: false,
    maxRetries: 5,
  },
  {
    serviceType: 'drive',
    priority: 6,
    phase: 3,
    estimatedDurationMinutes: 90,
    riskLevel: 'high',
    rateLimitConfig: {
      requestsPerMinute: 100,
      requestsPerHour: 2000,
      requestsPerDay: 20000,
      burstLimit: 10,
      backoffStrategy: 'exponential',
      maxBackoffMs: 45000,
    },
    dependencies: [],
    canRunInParallel: false, // Due to large file transfers
    maxRetries: 5,
  },
  {
    serviceType: 'photos',
    priority: 7,
    phase: 4,
    estimatedDurationMinutes: 240,
    riskLevel: 'high',
    rateLimitConfig: {
      requestsPerMinute: 30,
      requestsPerHour: 500,
      requestsPerDay: 5000,
      burstLimit: 2,
      backoffStrategy: 'exponential',
      maxBackoffMs: 120000,
    },
    dependencies: ['drive'], // Photos might reference Drive files
    canRunInParallel: false,
    maxRetries: 3,
  },
];

export interface QueueHealthCheck {
  isHealthy: boolean;
  queueDepth: number;
  activeWorkers: number;
  avgResponseTime: number;
  errorRate: number;
  rateLimitHits: number;
  lastCheckAt: string;
  issues: string[];
}

export interface MigrationDashboard {
  overallProgress: number;
  totalUsers: number;
  completedUsers: number;
  failedUsers: number;
  activeUsers: number;
  serviceBreakdown: {
    [service: string]: {
      completed: number;
      failed: number;
      pending: number;
      avgDuration: number;
    };
  };
  recentActivity: Array<{
    timestamp: string;
    userId: string;
    service: string;
    status: string;
    duration?: number;
  }>;
  alerts: Array<{
    level: 'info' | 'warning' | 'error';
    message: string;
    timestamp: string;
  }>;
}
