/**
 * Migration Execution Controller
 * Provides advanced migration execution controls integrated with existing app
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Play, 
  Pause, 
  Square, 
  RotateCcw,
  AlertTriangle,
  CheckCircle,
  Clock,
  Users,
  Activity,
  FileText,
  Download
} from 'lucide-react';
import { 
  migrationSystem, 
  MigrationSessionData, 
  MigrationExecutionOptions 
} from '@/services/migration/integration';
import { ExecutionPlan, ValidationResult, MigrationReport } from '@/services/migration/coordinator';

interface Props {
  userMappings: any[];
  selectedServices: string[];
  executionOptions: MigrationExecutionOptions;
  credentials: any;
  onStatusChange?: (status: string) => void;
}

export function MigrationExecutionController({
  userMappings,
  selectedServices,
  executionOptions,
  credentials,
  onStatusChange
}: Props) {
  const [sessionData, setSessionData] = useState<MigrationSessionData | null>(null);
  const [executionPlan, setExecutionPlan] = useState<ExecutionPlan | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [migrationReport, setMigrationReport] = useState<MigrationReport | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize migration system
  useEffect(() => {
    const initialize = async () => {
      try {
        await migrationSystem.initialize({
          maxWorkers: executionOptions.maxConcurrentUsers || 10,
          enableSlackAlerts: false,
        });
        setIsInitialized(true);
        
        // Set initial data
        migrationSystem.setUserMappings(userMappings);
        migrationSystem.setSelectedServices(selectedServices);
        migrationSystem.setExecutionOptions(executionOptions);
      } catch (err) {
        setError('Failed to initialize migration system: ' + (err as Error).message);
      }
    };

    initialize();
  }, []);

  // Subscribe to session updates
  useEffect(() => {
    if (!isInitialized) return;

    const unsubscribers = [
      migrationSystem.subscribe('statusChanged', setSessionData),
      migrationSystem.subscribe('planCreated', setSessionData),
      migrationSystem.subscribe('planValidated', setSessionData),
      migrationSystem.subscribe('executionProgress', setSessionData),
      migrationSystem.subscribe('executionCompleted', setSessionData),
      migrationSystem.subscribe('executionFailed', setSessionData),
    ];

    // Get initial session data
    setSessionData(migrationSystem.getSessionData());

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [isInitialized]);

  // Update options when props change
  useEffect(() => {
    if (isInitialized) {
      migrationSystem.setExecutionOptions(executionOptions);
    }
  }, [executionOptions, isInitialized]);

  // Notify parent of status changes
  useEffect(() => {
    if (sessionData && onStatusChange) {
      onStatusChange(sessionData.status);
    }
  }, [sessionData?.status, onStatusChange]);

  const createPlan = useCallback(async () => {
    if (!isInitialized) return;
    
    try {
      setError(null);
      const plan = await migrationSystem.createExecutionPlan(
        `Migration Plan - ${new Date().toLocaleDateString()}`
      );
      setExecutionPlan(plan);
    } catch (err) {
      setError('Failed to create execution plan: ' + (err as Error).message);
    }
  }, [isInitialized]);

  const validatePlan = useCallback(() => {
    if (!isInitialized) return;
    
    try {
      setError(null);
      const result = migrationSystem.validateExecutionPlan();
      setValidationResult(result);
    } catch (err) {
      setError('Failed to validate plan: ' + (err as Error).message);
    }
  }, [isInitialized]);

  const executePlan = useCallback(async () => {
    if (!isInitialized || !validationResult?.isValid) return;
    
    try {
      setError(null);
      await migrationSystem.executeMigrationPlan(credentials);
    } catch (err) {
      setError('Failed to execute migration: ' + (err as Error).message);
    }
  }, [isInitialized, validationResult, credentials]);

  const pauseMigration = useCallback(async () => {
    if (!isInitialized) return;
    
    try {
      await migrationSystem.pauseMigration();
    } catch (err) {
      setError('Failed to pause migration: ' + (err as Error).message);
    }
  }, [isInitialized]);

  const resumeMigration = useCallback(async () => {
    if (!isInitialized) return;
    
    try {
      await migrationSystem.resumeMigration();
    } catch (err) {
      setError('Failed to resume migration: ' + (err as Error).message);
    }
  }, [isInitialized]);

  const cancelMigration = useCallback(async () => {
    if (!isInitialized) return;
    
    try {
      await migrationSystem.cancelMigration();
    } catch (err) {
      setError('Failed to cancel migration: ' + (err as Error).message);
    }
  }, [isInitialized]);

  const downloadReport = useCallback(() => {
    const report = migrationSystem.getMigrationReport();
    if (report) {
      const blob = new Blob([JSON.stringify(report, null, 2)], { 
        type: 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `migration-report-${new Date().toISOString()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, []);

  const downloadAuditReport = useCallback(() => {
    const auditReport = migrationSystem.getAuditReport();
    if (auditReport) {
      const blob = new Blob([JSON.stringify(auditReport, null, 2)], { 
        type: 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-report-${new Date().toISOString()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, []);

  if (!isInitialized) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <Activity className="h-5 w-5 animate-spin" />
            <span>Initializing migration system...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Migration Execution Status</span>
            <Badge 
              variant={
                sessionData?.status === 'completed' ? 'default' :
                sessionData?.status === 'failed' ? 'destructive' :
                sessionData?.status === 'executing' ? 'secondary' :
                'outline'
              }
            >
              {sessionData?.status?.toUpperCase() || 'IDLE'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {userMappings.length}
              </div>
              <div className="text-xs text-gray-600">Users to Migrate</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {selectedServices.length}
              </div>
              <div className="text-xs text-gray-600">Services Selected</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {executionOptions.maxConcurrentUsers || 10}
              </div>
              <div className="text-xs text-gray-600">Max Concurrent</div>
            </div>
          </div>

          {sessionData?.dashboardData && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Overall Progress</span>
                <span>{sessionData.dashboardData.overview.overallSuccessRate.toFixed(1)}%</span>
              </div>
              <Progress value={sessionData.dashboardData.overview.overallSuccessRate} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Execution Plan */}
      {!executionPlan && sessionData?.status === 'idle' && (
        <Card>
          <CardHeader>
            <CardTitle>Step 1: Create Execution Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Create an optimized execution plan based on your selected users, services, and options.
              </p>
              <Button onClick={createPlan} disabled={sessionData?.status !== 'idle'}>
                <FileText className="h-4 w-4 mr-2" />
                Create Execution Plan
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plan Validation */}
      {executionPlan && !validationResult && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Validate Execution Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded">
                <div className="text-sm font-medium">Plan Summary:</div>
                <div className="text-xs text-gray-600 mt-1">
                  • {executionPlan.executionPhases.length} execution phases
                  <br />
                  • {executionPlan.executionPhases.reduce((sum: number, phase: any) => sum + (phase.services?.length || 0), 0)} total services
                  <br />
                  • Estimated duration: {executionPlan.estimatedDuration} minutes
                </div>
              </div>
              <Button onClick={validatePlan}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Validate Plan
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Validation Results */}
      {validationResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {validationResult.isValid ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-red-500" />
              )}
              Plan Validation Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {validationResult.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-medium">Validation Errors:</div>
                    <ul className="list-disc list-inside mt-1">
                      {validationResult.errors.map((error, index) => (
                        <li key={index} className="text-xs">{error}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {validationResult.warnings.length > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-medium">Warnings:</div>
                    <ul className="list-disc list-inside mt-1">
                      {validationResult.warnings.map((warning, index) => (
                        <li key={index} className="text-xs">{warning}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {validationResult.isValid && (
                <div className="flex space-x-2">
                  <Button 
                    onClick={executePlan}
                    disabled={sessionData?.status !== 'idle'}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Execute Migration
                  </Button>
                  
                  {executionOptions.dryRun && (
                    <Badge variant="outline">Dry Run Mode</Badge>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Execution Controls */}
      {sessionData?.status === 'executing' && (
        <Card>
          <CardHeader>
            <CardTitle>Migration Controls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex space-x-2">
              <Button onClick={pauseMigration} variant="outline" size="sm">
                <Pause className="h-4 w-4 mr-2" />
                Pause
              </Button>
              
              <Button onClick={cancelMigration} variant="destructive" size="sm">
                <Square className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reports and Downloads */}
      {(sessionData?.status === 'completed' || sessionData?.status === 'failed') && (
        <Card>
          <CardHeader>
            <CardTitle>Migration Reports</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex space-x-2">
                <Button onClick={downloadReport} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Migration Report
                </Button>
                
                <Button onClick={downloadAuditReport} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Audit Report
                </Button>
              </div>

              {sessionData.status === 'completed' && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Migration completed successfully! Download the reports for detailed information.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reset Option */}
      {(sessionData?.status === 'completed' || sessionData?.status === 'failed') && (
        <Card>
          <CardHeader>
            <CardTitle>Start New Migration</CardTitle>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => {
                migrationSystem.resetSession();
                setExecutionPlan(null);
                setValidationResult(null);
                setMigrationReport(null);
              }}
              variant="outline"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset for New Migration
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
