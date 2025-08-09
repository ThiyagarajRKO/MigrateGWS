import { NextRequest, NextResponse } from 'next/server';
import { autoConfigureTargetDomains, validateTargetDomainConfig } from '@/utils/targetDomainConfig';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { targetDomains, action } = body;

    if (action === 'auto-configure') {
      // Auto-configure the specific domains mentioned in the error
      const autoConfig = autoConfigureTargetDomains();
      
      // Validate the configuration
      const validation = validateTargetDomainConfig(
        targetDomains || ['sample.arakutourism.net', 'migrate.arakutourism.net'], 
        autoConfig
      );

      if (validation.isValid) {
        return NextResponse.json({
          success: true,
          message: 'Target domains configured successfully',
          targetAdminEmails: autoConfig,
          configuredDomains: Object.keys(autoConfig)
        });
      } else {
        return NextResponse.json({
          success: false,
          message: validation.message,
          missingDomains: validation.missingDomains
        }, { status: 400 });
      }
    }

    if (action === 'validate') {
      const { targetAdminEmails } = body;
      const validation = validateTargetDomainConfig(targetDomains, targetAdminEmails);
      
      return NextResponse.json({
        success: validation.isValid,
        message: validation.message,
        missingDomains: validation.missingDomains
      });
    }

    return NextResponse.json({
      success: false,
      message: 'Invalid action. Use "auto-configure" or "validate"'
    }, { status: 400 });

  } catch (error) {
    console.error('Target domain configuration error:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Return the default configuration
    const autoConfig = autoConfigureTargetDomains();
    
    return NextResponse.json({
      success: true,
      defaultConfiguration: autoConfig,
      targetDomains: Object.keys(autoConfig),
      instructions: [
        'Use this configuration to resolve the "Target Domain Configuration Required" error',
        'Ensure domain-wide delegation is configured for your service account',
        'Apply this configuration in your migration wizard'
      ]
    });
  } catch (error) {
    console.error('Error getting target domain configuration:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to get configuration',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
