import { NextRequest, NextResponse } from 'next/server';
import { 
  analyzeUserCloneStatus, 
  performCloneMatching, 
  generateCloneSuggestions,
  validateCloneAnalysis,
  exportCloneAnalysis,
  discoverSourceUsers,
  CloneAnalysisOptions 
} from '@/utils/userCloneAnalysis';
import { TargetDomainConfig } from '@/utils/targetDomainConfig';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      action, 
      sourceDomain, 
      sourceAdminEmail, 
      targetDomains, 
      targetAdminEmails, 
      options,
      serviceAccount,
      exportFormat 
    } = body;

    if (action === 'analyze-clone-status') {
      // Full clone analysis comparing source and target domains
      if (!sourceDomain || !sourceAdminEmail || !targetDomains || !targetAdminEmails) {
        return NextResponse.json({
          success: false,
          message: 'sourceDomain, sourceAdminEmail, targetDomains, and targetAdminEmails are required'
        }, { status: 400 });
      }

      const analysisOptions: CloneAnalysisOptions = {
        matchingStrategy: options?.matchingStrategy || 'custom',
        includeSuspended: options?.includeSuspended || false,
        customMappings: options?.customMappings || {},
        serviceAccount
      };

      const result = await analyzeUserCloneStatus(
        sourceDomain,
        sourceAdminEmail,
        targetDomains,
        targetAdminEmails,
        analysisOptions
      );

      // Validate results and get recommendations
      const validation = validateCloneAnalysis(result);
      
      // Generate clone suggestions for users that need cloning
      const cloneSuggestions = generateCloneSuggestions(result.needsCloning, targetDomains);

      return NextResponse.json({
        success: true,
        analysis: result,
        validation,
        cloneSuggestions,
        summary: {
          totalSourceUsers: result.totalSourceUsers,
          clonePercentage: result.cloneStatus.clonePercentage,
          readyForMigration: validation.isValid,
          recommendedActions: validation.recommendations
        },
        message: `Clone analysis completed: ${result.cloneStatus.clonedCount}/${result.totalSourceUsers} users already cloned (${result.cloneStatus.clonePercentage}%)`
      });
    }

    if (action === 'discover-source-users') {
      // Discover users from source domain only
      if (!sourceDomain || !sourceAdminEmail) {
        return NextResponse.json({
          success: false,
          message: 'sourceDomain and sourceAdminEmail are required'
        }, { status: 400 });
      }

      const result = await discoverSourceUsers(sourceDomain, sourceAdminEmail, {
        includeSuspended: options?.includeSuspended || false,
        maxResults: options?.maxResults || 1000,
        serviceAccount
      });

      return NextResponse.json({
        success: result.success,
        users: result.users,
        totalCount: result.totalCount,
        error: result.error,
        domain: sourceDomain,
        message: result.success 
          ? `Successfully discovered ${result.totalCount} source users from ${sourceDomain}`
          : `Failed to discover source users: ${result.error}`
      });
    }

    if (action === 'compare-users') {
      // Compare provided source and target user lists
      const { sourceUsers, targetUsers } = body;
      
      if (!sourceUsers || !targetUsers) {
        return NextResponse.json({
          success: false,
          message: 'sourceUsers and targetUsers arrays are required'
        }, { status: 400 });
      }

      const analysisOptions: CloneAnalysisOptions = {
        matchingStrategy: options?.matchingStrategy || 'custom',
        includeSuspended: options?.includeSuspended || false,
        customMappings: options?.customMappings || {}
      };

      const result = performCloneMatching(sourceUsers, targetUsers, analysisOptions);
      const validation = validateCloneAnalysis(result);

      return NextResponse.json({
        success: true,
        analysis: result,
        validation,
        message: `User comparison completed: ${result.cloneStatus.clonedCount} matches found`
      });
    }

    if (action === 'export-analysis') {
      // Export analysis results in specified format
      const { analysisResult } = body;
      
      if (!analysisResult) {
        return NextResponse.json({
          success: false,
          message: 'analysisResult is required for export'
        }, { status: 400 });
      }

      const format = exportFormat || 'json';
      const exportData = exportCloneAnalysis(analysisResult, format);

      // Set appropriate content type based on format
      const headers: Record<string, string> = {};
      if (format === 'csv') {
        headers['Content-Type'] = 'text/csv';
        headers['Content-Disposition'] = 'attachment; filename="clone-analysis.csv"';
      } else if (format === 'summary') {
        headers['Content-Type'] = 'text/plain';
      } else {
        headers['Content-Type'] = 'application/json';
      }

      return new NextResponse(exportData, { headers });
    }

    if (action === 'generate-clone-plan') {
      // Generate a detailed plan for cloning missing users
      const { needsCloning } = body;
      
      if (!needsCloning || !targetDomains) {
        return NextResponse.json({
          success: false,
          message: 'needsCloning array and targetDomains are required'
        }, { status: 400 });
      }

      const clonePlan = generateCloneSuggestions(needsCloning, targetDomains);
      
      // Group by target domain for easier execution
      const planByDomain: { [domain: string]: any[] } = {};
      clonePlan.forEach(plan => {
        if (!planByDomain[plan.suggestedTargetDomain]) {
          planByDomain[plan.suggestedTargetDomain] = [];
        }
        planByDomain[plan.suggestedTargetDomain].push(plan);
      });

      return NextResponse.json({
        success: true,
        clonePlan,
        planByDomain,
        totalUsersToClone: clonePlan.length,
        estimatedTime: `${Math.ceil(clonePlan.length / 10)} minutes`, // Assuming 10 users per minute
        message: `Clone plan generated for ${clonePlan.length} users across ${Object.keys(planByDomain).length} target domains`
      });
    }

    return NextResponse.json({
      success: false,
      message: 'Invalid action. Use "analyze-clone-status", "discover-source-users", "compare-users", "export-analysis", or "generate-clone-plan"'
    }, { status: 400 });

  } catch (error) {
    console.error('User clone analysis error:', error);
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
    const action = searchParams.get('action');
    const sourceDomain = searchParams.get('sourceDomain');
    const sourceAdminEmail = searchParams.get('sourceAdminEmail');
    const includeSuspended = searchParams.get('includeSuspended') === 'true';
    const maxResults = parseInt(searchParams.get('maxResults') || '100');

    if (action === 'discover-source-users') {
      if (!sourceDomain || !sourceAdminEmail) {
        return NextResponse.json({
          success: false,
          message: 'sourceDomain and sourceAdminEmail query parameters are required'
        }, { status: 400 });
      }

      const result = await discoverSourceUsers(sourceDomain, sourceAdminEmail, {
        includeSuspended,
        maxResults
      });

      return NextResponse.json({
        success: result.success,
        users: result.users,
        totalCount: result.totalCount,
        error: result.error,
        domain: sourceDomain,
        options: {
          includeSuspended,
          maxResults
        }
      });
    }

    return NextResponse.json({
      success: false,
      message: 'Invalid action. Use "discover-source-users" for GET requests'
    }, { status: 400 });

  } catch (error) {
    console.error('Error in user clone analysis GET:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to process request',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
