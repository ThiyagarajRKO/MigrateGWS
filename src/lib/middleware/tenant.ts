/**
 * Multi-Tenant Middleware
 * Handles tenant isolation and authentication
 */

import { NextRequest, NextResponse } from 'next/server';

export interface TenantRequest extends NextRequest {
  tenant?: any;
  tenantId?: string;
}

export interface TenantValidationResult {
  isValid: boolean;
  tenant?: any;
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
   * Validate tenant and load their information
   */
  static async validateTenant(tenantId: string): Promise<TenantValidationResult> {
    try {
      // Mock implementation for now
      if (tenantId === 'demo' || tenantId === 'test') {
        return { 
          isValid: true, 
          tenant: { 
            id: tenantId, 
            name: `${tenantId} Tenant`,
            status: 'active'
          } 
        };
      }
      
      return { isValid: false, error: 'Tenant not found' };
    } catch (error) {
      return { 
        isValid: false, 
        error: `Tenant validation failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
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
}

/**
 * Helper function to create a tenant-aware API wrapper
 */
export function withTenant<T extends any[]>(
  handler: (request: TenantRequest, ...args: T) => Promise<Response>
) {
  return async (request: NextRequest, ...args: T): Promise<Response> => {
    const tenantId = MultiTenantMiddleware.extractTenantIdentifier(request);
    
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant identification required' }, 
        { status: 401 }
      );
    }

    const validation = await MultiTenantMiddleware.validateTenant(tenantId);
    
    if (!validation.isValid) {
      return NextResponse.json(
        { error: validation.error || 'Unauthorized' }, 
        { status: 403 }
      );
    }

    // Add tenant context to request
    const tenantRequest = request as TenantRequest;
    tenantRequest.tenant = validation.tenant;
    tenantRequest.tenantId = tenantId;

    return handler(tenantRequest, ...args);
  };
}
