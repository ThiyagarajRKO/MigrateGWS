import { NextRequest, NextResponse } from 'next/server';
import { discoverTargetUsers, getTargetUsersForDomain, validateTargetDomainAccess } from '@/utils/targetDomainConfig';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, targetDomains, targetAdminEmails, domain, adminEmail, options, serviceAccount } = body;

    if (action === 'discover-all') {
      // Discover users from all target domains (same as source discovery)
      const result = await discoverTargetUsers(targetDomains, targetAdminEmails, {
        ...options,
        serviceAccount
      });
      
      return NextResponse.json({
        success: result.success,
        usersByDomain: result.usersByDomain,
        allUsers: result.allUsers,
        errors: result.errors,
        totalUsers: result.totalUsers,
        message: result.success 
          ? `Successfully discovered ${result.totalUsers} users from ${Object.keys(result.usersByDomain).length} target domains`
          : 'Some domains failed during user discovery'
      });
    }

    if (action === 'discover-domain') {
      // Discover users from a specific target domain
      if (!domain || !adminEmail) {
        return NextResponse.json({
          success: false,
          message: 'Domain and adminEmail are required for domain-specific discovery'
        }, { status: 400 });
      }

      const result = await getTargetUsersForDomain(domain, adminEmail, {
        ...options,
        serviceAccount
      });
      
      return NextResponse.json({
        success: result.success,
        users: result.users,
        error: result.error,
        totalCount: result.totalCount,
        domain,
        message: result.success 
          ? `Successfully discovered ${result.totalCount} users from target domain ${domain}`
          : `Failed to discover users from target domain ${domain}: ${result.error}`
      });
    }

    if (action === 'validate-access') {
      // Validate access to target domain (same as source validation)
      if (!domain || !adminEmail) {
        return NextResponse.json({
          success: false,
          message: 'Domain and adminEmail are required for access validation'
        }, { status: 400 });
      }

      const result = await validateTargetDomainAccess(domain, adminEmail, serviceAccount);
      
      return NextResponse.json({
        success: result.success,
        error: result.error,
        domain,
        adminEmail,
        message: result.success 
          ? `Target domain access validated successfully for ${domain}`
          : `Target domain access validation failed for ${domain}: ${result.error}`
      });
    }

    return NextResponse.json({
      success: false,
      message: 'Invalid action. Use "discover-all", "discover-domain", or "validate-access"'
    }, { status: 400 });

  } catch (error) {
    console.error('Target user discovery error:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const domain = searchParams.get('domain');
    const adminEmail = searchParams.get('adminEmail');
    const maxResults = parseInt(searchParams.get('maxResults') || '100');
    const includeSuspended = searchParams.get('includeSuspended') === 'true';

    if (!domain || !adminEmail) {
      return NextResponse.json({
        success: false,
        message: 'Domain and adminEmail query parameters are required'
      }, { status: 400 });
    }

    // Get target users for the specified domain (same as source user API)
    const result = await getTargetUsersForDomain(domain, adminEmail, {
      maxResults,
      includeSuspended
    });

    return NextResponse.json({
      success: result.success,
      users: result.users,
      error: result.error,
      totalCount: result.totalCount,
      domain,
      adminEmail,
      options: {
        maxResults,
        includeSuspended
      }
    });

  } catch (error) {
    console.error('Error getting target users:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to get target users',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
