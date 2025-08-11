/**
 * Multi-Tenant Migration Dashboard API
 * Provides real-time migration status, progress tracking, and tenant-specific analytics
 */

import { NextRequest, NextResponse } from 'next/server';
import { withTenant, TenantRequest } from '../../../lib/middleware/tenant';
import { Migration, MigrationJob, MigrationLog } from '../../../lib/database/schema';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

interface DashboardStats {
  activeMigrations: number;
  completedMigrations: number;
  failedMigrations: number;
  totalUsers: number;
  totalItemsMigrated: number;
  averageCompletionTime: number;
  quotaUsage: {
    apiCalls: number;
    storage: number;
    users: number;
  };
}

interface MigrationProgress {
  migrationId: string;
  name: string;
  status: string;
  progress: number;
  usersCompleted: number;
  usersTotal: number;
  itemsCompleted: number;
  itemsTotal: number;
  estimatedCompletion: string | null;
  servicesProgress: ServiceProgress[];
  recentLogs: MigrationLog[];
}

interface ServiceProgress {
  service: string;
  status: string;
  progress: number;
  itemsTotal: number;
  itemsCompleted: number;
  itemsFailed: number;
  lastUpdate: string;
}

class MigrationDashboardService {
  
  /**
   * Get tenant dashboard statistics
   */
  async getDashboardStats(tenantId: string): Promise<DashboardStats> {
    // In a real implementation, this would query the database
    // For now, return mock data
    return {
      activeMigrations: 3,
      completedMigrations: 47,
      failedMigrations: 2,
      totalUsers: 1250,
      totalItemsMigrated: 45670,
      averageCompletionTime: 4.5, // hours
      quotaUsage: {
        apiCalls: 75000,
        storage: 45, // GB
        users: 1250
      }
    };
  }

  /**
   * Get active migrations with progress
   */
  async getActiveMigrations(tenantId: string): Promise<MigrationProgress[]> {
    // Mock data for active migrations
    return [
      {
        migrationId: 'mig_001',
        name: 'Q4 2024 Department Consolidation',
        status: 'running',
        progress: 67,
        usersCompleted: 134,
        usersTotal: 200,
        itemsCompleted: 15430,
        itemsTotal: 23000,
        estimatedCompletion: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        servicesProgress: [
          {
            service: 'gmail',
            status: 'completed',
            progress: 100,
            itemsTotal: 8500,
            itemsCompleted: 8500,
            itemsFailed: 0,
            lastUpdate: new Date().toISOString()
          },
          {
            service: 'drive',
            status: 'running',
            progress: 45,
            itemsTotal: 12000,
            itemsCompleted: 5400,
            itemsFailed: 23,
            lastUpdate: new Date().toISOString()
          },
          {
            service: 'calendar',
            status: 'pending',
            progress: 0,
            itemsTotal: 2500,
            itemsCompleted: 0,
            itemsFailed: 0,
            lastUpdate: new Date().toISOString()
          }
        ],
        recentLogs: []
      }
    ];
  }

  /**
   * Get migration history with pagination
   */
  async getMigrationHistory(
    tenantId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ migrations: Migration[]; total: number; pages: number }> {
    // Mock implementation
    const total = 49;
    const pages = Math.ceil(total / limit);
    
    return {
      migrations: [], // Would be populated from database
      total,
      pages
    };
  }

  /**
   * Get detailed migration status
   */
  async getMigrationDetails(
    tenantId: string,
    migrationId: string
  ): Promise<MigrationProgress | null> {
    // Mock implementation
    const activeMigrations = await this.getActiveMigrations(tenantId);
    return activeMigrations.find(m => m.migrationId === migrationId) || null;
  }

  /**
   * Get migration logs with filtering
   */
  async getMigrationLogs(
    tenantId: string,
    migrationId: string,
    filters: {
      level?: string;
      service?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
    } = {}
  ): Promise<MigrationLog[]> {
    // Mock implementation
    return [];
  }

  /**
   * Get real-time migration metrics
   */
  async getRealtimeMetrics(tenantId: string): Promise<any> {
    return {
      activeJobs: 15,
      queuedJobs: 42,
      failedJobs: 3,
      apiCallsPerMinute: 125,
      throughputItemsPerMinute: 340,
      errorRate: 0.02,
      averageJobDuration: 45, // seconds
      quotaRemaining: {
        gmail: 8500,
        drive: 4200,
        calendar: 9800
      }
    };
  }
}

const dashboardService = new MigrationDashboardService();

/**
 * GET /api/dashboard/stats
 * Get tenant dashboard statistics
 */
export const GET = withTenant(async (request: TenantRequest) => {
  try {
    const stats = await dashboardService.getDashboardStats(request.tenantId!);
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  }
});

/**
 * GET /api/dashboard/migrations/active
 * Get active migrations with progress
 */
export async function getActiveMigrations(request: TenantRequest) {
  try {
    const migrations = await dashboardService.getActiveMigrations(request.tenantId!);
    return NextResponse.json(migrations);
  } catch (error) {
    console.error('Active migrations error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch active migrations' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/dashboard/migrations/history
 * Get migration history with pagination
 */
export async function getMigrationHistory(request: TenantRequest) {
  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    
    const history = await dashboardService.getMigrationHistory(
      request.tenantId!,
      page,
      limit
    );
    
    return NextResponse.json(history);
  } catch (error) {
    console.error('Migration history error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch migration history' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/dashboard/migrations/[id]
 * Get detailed migration status
 */
export async function getMigrationDetails(
  request: TenantRequest,
  { params }: { params: { id: string } }
) {
  try {
    const migration = await dashboardService.getMigrationDetails(
      request.tenantId!,
      params.id
    );
    
    if (!migration) {
      return NextResponse.json(
        { error: 'Migration not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(migration);
  } catch (error) {
    console.error('Migration details error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch migration details' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/dashboard/logs
 * Get migration logs with filtering
 */
export async function getMigrationLogs(request: TenantRequest) {
  try {
    const url = new URL(request.url);
    const migrationId = url.searchParams.get('migrationId');
    
    if (!migrationId) {
      return NextResponse.json(
        { error: 'Migration ID required' },
        { status: 400 }
      );
    }
    
    const filters = {
      level: url.searchParams.get('level') || undefined,
      service: url.searchParams.get('service') || undefined,
      startDate: url.searchParams.get('startDate') || undefined,
      endDate: url.searchParams.get('endDate') || undefined,
      limit: parseInt(url.searchParams.get('limit') || '100')
    };
    
    const logs = await dashboardService.getMigrationLogs(
      request.tenantId!,
      migrationId,
      filters
    );
    
    return NextResponse.json(logs);
  } catch (error) {
    console.error('Migration logs error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch migration logs' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/dashboard/metrics/realtime
 * Get real-time migration metrics
 */
export async function getRealtimeMetrics(request: TenantRequest) {
  try {
    const metrics = await dashboardService.getRealtimeMetrics(request.tenantId!);
    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Realtime metrics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch realtime metrics' },
      { status: 500 }
    );
  }
}

export { dashboardService };
