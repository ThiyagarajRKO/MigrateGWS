/**
 * Multi-Tenant Migration Dashboard API
 * Real-time migration tracking with tenant isolation
 */

import { NextRequest, NextResponse } from 'next/server';
import { withTenant, TenantRequest } from '../../../../lib/middleware/tenant';
import { Migration, MigrationJob, MigrationLog } from '../../../../lib/database/schema';

interface DashboardStats {
  migrations: {
    total: number;
    active: number;
    completed: number;
    failed: number;
  };
  users: {
    total: number;
    migrated: number;
    pending: number;
    failed: number;
  };
  services: {
    [key: string]: {
      total: number;
      completed: number;
      failed: number;
      progress: number;
    };
  };
  quota: {
    used: number;
    remaining: number;
    limit: number;
    resetDate: string;
  };
  recentActivity: MigrationLog[];
}

interface MigrationProgress {
  migrationId: string;
  name: string;
  status: string;
  progress: number;
  usersTotal: number;
  usersCompleted: number;
  usersFailed: number;
  servicesProgress: {
    [key: string]: {
      progress: number;
      itemsTotal: number;
      itemsCompleted: number;
      itemsFailed: number;
    };
  };
  estimatedCompletion?: string;
  startedAt?: string;
  lastUpdate: string;
}

async function getDashboardStats(tenantId: string): Promise<DashboardStats> {
  // This would integrate with your database
  // For now, return mock data
  
  const mockStats: DashboardStats = {
    migrations: {
      total: 15,
      active: 3,
      completed: 10,
      failed: 2
    },
    users: {
      total: 1250,
      migrated: 1100,
      pending: 120,
      failed: 30
    },
    services: {
      gmail: {
        total: 1250,
        completed: 1100,
        failed: 25,
        progress: 88
      },
      drive: {
        total: 1250,
        completed: 950,
        failed: 50,
        progress: 76
      },
      calendar: {
        total: 1250,
        completed: 1150,
        failed: 15,
        progress: 92
      },
      contacts: {
        total: 1250,
        completed: 1200,
        failed: 10,
        progress: 96
      }
    },
    quota: {
      used: 75000,
      remaining: 25000,
      limit: 100000,
      resetDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    },
    recentActivity: [
      {
        id: '1',
        tenant_id: tenantId,
        migration_id: 'mig_123',
        level: 'info',
        message: 'Gmail migration completed for user@example.com',
        context: {
          service: 'gmail',
          user_email: 'user@example.com',
          item_id: 'email_batch_456'
        },
        timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString()
      },
      {
        id: '2',
        tenant_id: tenantId,
        migration_id: 'mig_124',
        level: 'warn',
        message: 'Drive file permission issue detected',
        context: {
          service: 'drive',
          user_email: 'manager@example.com',
          item_id: 'file_789'
        },
        timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString()
      }
    ]
  };

  return mockStats;
}

async function getMigrationProgress(
  tenantId: string,
  migrationId?: string
): Promise<MigrationProgress[]> {
  // This would integrate with your database
  // For now, return mock data
  
  const mockProgress: MigrationProgress[] = [
    {
      migrationId: 'mig_123',
      name: 'Engineering Team Migration',
      status: 'running',
      progress: 75,
      usersTotal: 50,
      usersCompleted: 38,
      usersFailed: 2,
      servicesProgress: {
        gmail: {
          progress: 85,
          itemsTotal: 25000,
          itemsCompleted: 21250,
          itemsFailed: 125
        },
        drive: {
          progress: 70,
          itemsTotal: 15000,
          itemsCompleted: 10500,
          itemsFailed: 200
        },
        calendar: {
          progress: 90,
          itemsTotal: 5000,
          itemsCompleted: 4500,
          itemsFailed: 25
        }
      },
      estimatedCompletion: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      startedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      lastUpdate: new Date(Date.now() - 30 * 1000).toISOString()
    },
    {
      migrationId: 'mig_124',
      name: 'Marketing Department Transfer',
      status: 'running',
      progress: 45,
      usersTotal: 25,
      usersCompleted: 11,
      usersFailed: 1,
      servicesProgress: {
        gmail: {
          progress: 60,
          itemsTotal: 12000,
          itemsCompleted: 7200,
          itemsFailed: 50
        },
        drive: {
          progress: 35,
          itemsTotal: 8000,
          itemsCompleted: 2800,
          itemsFailed: 100
        }
      },
      estimatedCompletion: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      lastUpdate: new Date(Date.now() - 15 * 1000).toISOString()
    }
  ];

  if (migrationId) {
    return mockProgress.filter(p => p.migrationId === migrationId);
  }

  return mockProgress;
}

// GET /api/v1/dashboard/stats
export const GET = withTenant(async (request: TenantRequest) => {
  try {
    const tenantId = request.tenantId!;
    const stats = await getDashboardStats(tenantId);
    
    return NextResponse.json({ success: true, data: stats });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  }
});

// POST /api/v1/dashboard/progress
export const POST = withTenant(async (request: TenantRequest) => {
  try {
    const tenantId = request.tenantId!;
    const body = await request.json();
    const { migrationId } = body;
    
    const progress = await getMigrationProgress(tenantId, migrationId);
    
    return NextResponse.json({ success: true, data: progress });
  } catch (error) {
    console.error('Migration progress error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch migration progress' },
      { status: 500 }
    );
  }
});
