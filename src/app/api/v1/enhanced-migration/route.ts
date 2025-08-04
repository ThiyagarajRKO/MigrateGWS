/**
 * Enhanced Migration API
 * Provides backend support for advanced migration features
 */

import { NextRequest, NextResponse } from 'next/server';
import { migrationSystem } from '@/services/migration/integration';

export async function POST(request: NextRequest) {
  try {
    const { action, ...params } = await request.json();

    switch (action) {
      case 'initialize':
        await migrationSystem.initialize(params);
        return NextResponse.json({ success: true });

      case 'setUserMappings':
        migrationSystem.setUserMappings(params.mappings);
        return NextResponse.json({ success: true });

      case 'setSelectedServices':
        migrationSystem.setSelectedServices(params.services);
        return NextResponse.json({ success: true });

      case 'setExecutionOptions':
        migrationSystem.setExecutionOptions(params.options);
        return NextResponse.json({ success: true });

      case 'createExecutionPlan':
        const plan = await migrationSystem.createExecutionPlan(params.name);
        return NextResponse.json({ success: true, plan });

      case 'validateExecutionPlan':
        const validation = migrationSystem.validateExecutionPlan();
        return NextResponse.json({ success: true, validation });

      case 'executeMigrationPlan':
        const executionId = await migrationSystem.executeMigrationPlan(params.credentials);
        return NextResponse.json({ success: true, executionId });

      case 'pauseMigration':
        const pauseResult = await migrationSystem.pauseMigration();
        return NextResponse.json({ success: pauseResult });

      case 'resumeMigration':
        const resumeResult = await migrationSystem.resumeMigration();
        return NextResponse.json({ success: resumeResult });

      case 'cancelMigration':
        const cancelResult = await migrationSystem.cancelMigration();
        return NextResponse.json({ success: cancelResult });

      case 'getSessionData':
        const sessionData = migrationSystem.getSessionData();
        return NextResponse.json({ success: true, sessionData });

      case 'getMigrationReport':
        const report = migrationSystem.getMigrationReport();
        return NextResponse.json({ success: true, report });

      case 'getAuditReport':
        const auditReport = migrationSystem.getAuditReport();
        return NextResponse.json({ success: true, auditReport });

      case 'performQualityAssurance':
        const qaResults = await migrationSystem.performQualityAssurance(
          params.samplePercentage || 10
        );
        return NextResponse.json({ success: true, qaResults });

      case 'resetSession':
        migrationSystem.resetSession();
        return NextResponse.json({ success: true });

      default:
        return NextResponse.json(
          { success: false, error: 'Unknown action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Enhanced migration API error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'sessionData':
        const sessionData = migrationSystem.getSessionData();
        return NextResponse.json({ success: true, sessionData });

      case 'migrationReport':
        const report = migrationSystem.getMigrationReport();
        return NextResponse.json({ success: true, report });

      case 'auditReport':
        const auditReport = migrationSystem.getAuditReport();
        return NextResponse.json({ success: true, auditReport });

      case 'status':
        const status = migrationSystem.getSessionData().status;
        return NextResponse.json({ success: true, status });

      default:
        return NextResponse.json(
          { success: false, error: 'Unknown action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Enhanced migration API GET error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
