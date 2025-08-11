/**
 * Multi-Tenant API Middleware
 * Handles tenant isolation, authentication, and request routing
 */

import { NextRequest, NextResponse } from 'next/server';
import { Tenant } from '../../lib/database/schema';

export interface TenantRequest extends NextRequest {
  tenant?: Tenant;
  tenantId?: string;
}

export interface TenantValidationResult {
  isValid: boolean;
  tenant?: Tenant;
  error?: string;
}

export class MultiTenantMiddleware {
  
  /**
   * Extract tenant from request (subdomain, header, or path)
   */
  static extractTenantIdentifier(request: NextRequest): string | null {
    // Method 1: Subdomain extraction
    const host = request.headers.get('host');
    if (host) {
      const subdomain = host.split('.')[0];
      if (subdomain && subdomain !== 'www' && subdomain !== 'api') {
        return subdomain;
      }
    }

    // Method 2: Header-based tenant
    const tenantHeader = request.headers.get('x-tenant-id');
    if (tenantHeader) {
      return tenantHeader;
    }

    // Method 3: Path-based tenant
    const pathMatch = request.nextUrl.pathname.match(/^\/api\/tenant\/([^\/]+)/);
    if (pathMatch) {
      return pathMatch[1];
    }

    // Method 4: Query parameter
    const tenantParam = request.nextUrl.searchParams.get('tenant');
    if (tenantParam) {
      return tenantParam;
    }

    return null;
  }

  /**
   * Validate tenant and load tenant data
   */
  static async validateTenant(tenantId: string): Promise<TenantValidationResult> {
    try {
      // This would integrate with your database
      const tenant = await this.loadTenant(tenantId);
      
      if (!tenant) {
        return { isValid: false, error: 'Tenant not found' };
      }

      if (tenant.status !== 'active') {
        return { isValid: false, error: 'Tenant is not active' };
      }

      return { isValid: true, tenant };
    } catch (error) {
      return { 
        isValid: false, 
        error: error instanceof Error ? error.message : 'Tenant validation failed' 
      };
    }
  }

  /**
   * Main middleware function
   */
  static async middleware(request: NextRequest): Promise<NextResponse | null> {
    // Skip middleware for public routes
    if (this.isPublicRoute(request.nextUrl.pathname)) {
      return null;
    }

    // Extract tenant identifier
    const tenantId = this.extractTenantIdentifier(request);
    
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant identifier required' },
        { status: 400 }
      );
    }

    // Validate tenant
    const validation = await this.validateTenant(tenantId);
    
    if (!validation.isValid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 403 }
      );
    }

    // Add tenant info to request headers for downstream handlers
    const response = NextResponse.next();
    response.headers.set('x-tenant-id', tenantId);
    response.headers.set('x-tenant-data', JSON.stringify(validation.tenant));

    return response;
  }

  /**
   * Check if route is public (doesn't require tenant validation)
   */
  private static isPublicRoute(pathname: string): boolean {
    const publicRoutes = [
      '/api/health',
      '/api/auth',
      '/api/signup',
      '/api/webhooks',
      '/_next',
      '/favicon.ico'
    ];

    return publicRoutes.some(route => pathname.startsWith(route));
  }

  /**
   * Load tenant from database (mock implementation)
   */
  private static async loadTenant(tenantId: string): Promise<Tenant | null> {
    // This would integrate with your actual database
    // For now, return a mock tenant for demo purposes
    
    if (tenantId === 'demo') {
      return {
        id: 'demo',
        name: 'Demo Tenant',
        domain: 'demo.example.com',
        status: 'active',
        subscription: {
          plan: 'professional',
          quotas: {
            maxMigrations: 10,
            maxUsers: 1000,
            maxStorageGB: 100,
            apiCallsPerMonth: 100000
          },
          billing: {
            isActive: true,
            nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            pricePerUser: 5.00
          }
        },
        settings: {
          allowCrossTenantMigration: true,
          requireApprovalForMigrations: false,
          retentionDays: 90,
          enableAuditLogs: true
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }

    return null;
  }
}

/**
 * Tenant-aware API route wrapper
 */
export function withTenant<T extends any[]>(
  handler: (request: TenantRequest, ...args: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    // Extract tenant from headers (set by middleware)
    const tenantId = request.headers.get('x-tenant-id');
    const tenantData = request.headers.get('x-tenant-data');

    if (!tenantId || !tenantData) {
      return NextResponse.json(
        { error: 'Tenant context missing' },
        { status: 500 }
      );
    }

    // Parse tenant data and add to request
    const tenant: Tenant = JSON.parse(tenantData);
    const tenantRequest = request as TenantRequest;
    tenantRequest.tenant = tenant;
    tenantRequest.tenantId = tenantId;

    return handler(tenantRequest, ...args);
  };
}

/**
 * Quota enforcement middleware
 */
export class QuotaMiddleware {
  static async enforceQuotas(
    request: TenantRequest,
    operation: string
  ): Promise<NextResponse | null> {
    if (!request.tenant) {
      return NextResponse.json(
        { error: 'Tenant context required for quota enforcement' },
        { status: 500 }
      );
    }

    const tenant = request.tenant;
    
    // Check different quota types based on operation
    switch (operation) {
      case 'create_migration':
        return this.checkMigrationQuota(tenant);
      case 'api_call':
        return this.checkAPIQuota(tenant);
      case 'storage':
        return this.checkStorageQuota(tenant);
      default:
        return null;
    }
  }

  private static async checkMigrationQuota(tenant: Tenant): Promise<NextResponse | null> {
    // This would check current migration count against quota
    // For now, just return null (allow)
    return null;
  }

  private static async checkAPIQuota(tenant: Tenant): Promise<NextResponse | null> {
    // This would check current API usage against quota
    // For now, just return null (allow)
    return null;
  }

  private static async checkStorageQuota(tenant: Tenant): Promise<NextResponse | null> {
    // This would check current storage usage against quota
    // For now, just return null (allow)
    return null;
  }
}

export default MultiTenantMiddleware;
