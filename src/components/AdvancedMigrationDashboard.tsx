/**
 * Advanced Migration Dashboard Component
 * Demonstrates the complete migration system with all optimization features
 */

import React, { useState, useEffect } from 'react';
import { 
  MigrationExecutionCoordinator,
  ExecutionPlan,
  ValidationResult,
  MigrationReport 
} from '../services/migration/coordinator';
import { 
  MigrationQueueManager,
  WorkerConfig 
} from '../services/migration/queue/manager';
import { 
  MigrationMonitoringSystem,
  DashboardData,
  UserProgressData,
  AlertData 
} from '../services/migration/monitoring';

interface AdvancedMigrationDashboardProps {
  userMappings: Array<{
    sourceEmail: string;
    targetEmail: string;
    sourceDomain: string;
    targetDomain: string;
  }>;
  credentials: any;
}

export function AdvancedMigrationDashboard({ userMappings, credentials }: AdvancedMigrationDashboardProps) {
  const [executionPlan, setExecutionPlan] = useState<ExecutionPlan | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [activeExecution, setActiveExecution] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [selectedServices, setSelectedServices] = useState<string[]>([
    'contacts', 'calendar', 'gmail', 'drive'
  ]);
  const [migrationOptions, setMigrationOptions] = useState({
    prioritizeSpeed: false,
    prioritizeReliability: true,
    maxConcurrentUsers: 10,
    deltaMode: false,
  });
  const [isSystemReady, setIsSystemReady] = useState(false);

  // Initialize the migration system
  useEffect(() => {
    initializeMigrationSystem();
  }, []);

  const initializeMigrationSystem = async () => {
    try {
      // Initialize worker configuration
      const workerConfig: WorkerConfig = {
        maxConcurrentJobs: 10,
        maxConcurrentUsersPerWorker: 5,
        maxConcurrentServicesPerUser: 2,
        workerHeartbeatInterval: 30000,
        jobTimeoutMs: 3600000, // 1 hour
        cleanupInterval: 300000, // 5 minutes
      };

      // Initialize queue manager
      const queueManager = new MigrationQueueManager(workerConfig);
      
      // Initialize execution coordinator
      const coordinator = new MigrationExecutionCoordinator(queueManager);
      
      // Initialize monitoring system
      const monitoringConfig = {
        alertThresholds: {
          errorRatePercent: 5,
          queueDepthLimit: 100,
          rateLimitHitsPerHour: 50,
          avgProcessingTimeMs: 300000,
          failedJobsLimit: 10,
        },
        dashboardRefreshInterval: 5000,
        alertCooldownMs: 300000,
        enableEmailAlerts: false,
        enableSlackAlerts: false,
        webhookUrls: {},
      };
      
      const monitoring = new MigrationMonitoringSystem(
        monitoringConfig,
        coordinator,
        queueManager
      );

      // Start systems
      await queueManager.start();
      monitoring.start();

      // Set up event listeners
      monitoring.on('dashboardUpdated', (data: DashboardData) => {
        setDashboardData(data);
      });

      coordinator.on('executionCompleted', (report: MigrationReport) => {
        setActiveExecution(null);
        console.log('Migration execution completed:', report);
      });

      setIsSystemReady(true);
      
    } catch (error) {
      console.error('Failed to initialize migration system:', error);
    }
  };

  const createExecutionPlan = () => {
    if (!isSystemReady || !userMappings.length) return;

    // Convert user mappings to the expected format
    const formattedMappings = userMappings.map(mapping => ({
      sourceEmail: mapping.sourceEmail,
      targetEmail: mapping.targetEmail,
      sourceDomain: mapping.sourceDomain,
      targetDomain: mapping.targetDomain,
      status: 'pending' as const,
    }));

    // Create execution plan (this would use the actual coordinator)
    const mockPlan: ExecutionPlan = {
      id: `plan_${Date.now()}`,
      name: `Migration Plan - ${userMappings.length} users`,
      description: `Migrating ${selectedServices.join(', ')} for ${userMappings.length} users`,
      userMappings: formattedMappings,
      executionPhases: [
        {
          phase: 1,
          name: 'Fast & Low-Risk Services',
          services: selectedServices.filter(s => ['contacts', 'calendar'].includes(s)),
          canRunInParallel: true,
          estimatedDurationMinutes: 15,
          userConcurrency: 20,
          serviceConcurrency: 2,
          prerequisites: [],
        },
        {
          phase: 2,
          name: 'Heavy Data Services',
          services: selectedServices.filter(s => ['gmail', 'drive'].includes(s)),
          canRunInParallel: false,
          estimatedDurationMinutes: 180,
          userConcurrency: 5,
          serviceConcurrency: 1,
          prerequisites: ['contacts'],
        },
      ],
      estimatedDuration: 195, // Total estimated minutes
      totalUsers: userMappings.length,
      totalServices: selectedServices.length,
      createdAt: new Date().toISOString(),
      status: 'ready',
    };

    setExecutionPlan(mockPlan);
    
    // Validate the plan
    const mockValidation: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: userMappings.length > 50 ? ['Large migration detected'] : [],
      recommendations: [
        'Consider running during off-peak hours',
        'Ensure all users have proper permissions',
        'Set up monitoring alerts',
      ],
      estimatedDuration: mockPlan.estimatedDuration,
      riskAssessment: {
        level: userMappings.length > 100 ? 'high' : 'medium',
        factors: userMappings.length > 100 ? ['Large user count'] : [],
      },
    };

    setValidationResult(mockValidation);
  };

  const executeCurrentPlan = async () => {
    if (!executionPlan || !validationResult?.isValid) return;

    try {
      // This would use the actual coordinator to execute the plan
      const executionId = `exec_${Date.now()}`;
      setActiveExecution(executionId);
      
      console.log('Starting migration execution:', executionId);
      
      // Simulate execution progress
      simulateExecution(executionId);
      
    } catch (error) {
      console.error('Failed to execute migration plan:', error);
      setActiveExecution(null);
    }
  };

  const simulateExecution = (executionId: string) => {
    // Simulate dashboard data updates
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 10;
      
      const mockDashboard: DashboardData = {
        overview: {
          totalMigrations: 1,
          activeMigrations: progress < 100 ? 1 : 0,
          completedMigrations: progress >= 100 ? 1 : 0,
          failedMigrations: 0,
          totalUsers: userMappings.length,
          overallSuccessRate: Math.min(progress, 100),
        },
        realTimeMetrics: {
          currentThroughput: 150 + Math.random() * 50,
          activeWorkers: 8,
          queueDepth: Math.max(0, 50 - Math.floor(progress)),
          avgProcessingTime: 120000 + Math.random() * 60000,
          rateLimitHits: Math.floor(Math.random() * 5),
        },
        serviceMetrics: {
          contacts: {
            totalUsers: userMappings.length,
            completedUsers: Math.floor((progress / 100) * userMappings.length),
            failedUsers: 0,
            avgDuration: 30000,
            successRate: 100,
            lastProcessed: new Date().toISOString(),
          },
          gmail: {
            totalUsers: userMappings.length,
            completedUsers: Math.floor(((progress - 20) / 100) * userMappings.length),
            failedUsers: 0,
            avgDuration: 300000,
            successRate: 98,
            lastProcessed: new Date().toISOString(),
          },
        },
        userProgress: userMappings.slice(0, 10).map((mapping, index) => ({
          userId: mapping.sourceEmail,
          sourceEmail: mapping.sourceEmail,
          targetEmail: mapping.targetEmail,
          overallProgress: Math.min(progress + (index * 5), 100),
          currentService: progress < 50 ? 'contacts' : 'gmail',
          status: progress >= 100 ? 'completed' : 'running',
          startTime: new Date(Date.now() - 60000).toISOString(),
          services: [
            {
              serviceType: 'contacts',
              status: progress > 20 ? 'completed' : 'running',
              progress: Math.min(progress * 2, 100),
              itemsProcessed: Math.floor(Math.random() * 500),
              itemsTotal: 500,
            },
            {
              serviceType: 'gmail',
              status: progress > 80 ? 'completed' : progress > 20 ? 'running' : 'pending',
              progress: Math.max(0, progress - 20),
              itemsProcessed: Math.floor(Math.random() * 10000),
              itemsTotal: 10000,
            },
          ],
          issues: [],
        })),
        recentActivity: [
          {
            id: 'activity_1',
            timestamp: new Date().toISOString(),
            level: 'info',
            category: 'migration',
            message: `User ${userMappings[0]?.sourceEmail} contacts migration completed`,
          },
        ],
        alerts: [],
        performanceTrends: [],
      };

      setDashboardData(mockDashboard);

      if (progress >= 100) {
        clearInterval(interval);
        setActiveExecution(null);
      }
    }, 2000);
  };

  const getPhaseStatusIcon = (phase: any) => {
    if (activeExecution) {
      return '🔄'; // Running
    }
    return '⏳'; // Pending
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-green-600';
      case 'medium': return 'text-yellow-600';
      case 'high': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  if (!isSystemReady) {
    return (
      <div className="p-6 bg-white rounded-lg shadow">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Initializing Migration System...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Migration Planning Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-semibold mb-4">Advanced Migration Planning</h2>
        
        {/* Service Selection */}
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-3">Select Services to Migrate</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { id: 'contacts', name: 'Contacts', phase: 1, icon: '👥' },
              { id: 'calendar', name: 'Calendar', phase: 1, icon: '📅' },
              { id: 'gmail', name: 'Gmail', phase: 3, icon: '📧' },
              { id: 'drive', name: 'Drive', phase: 3, icon: '📁' },
              { id: 'photos', name: 'Photos', phase: 4, icon: '📷' },
              { id: 'chat', name: 'Chat', phase: 2, icon: '💬' },
            ].map(service => (
              <label key={service.id} className="flex items-center space-x-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={selectedServices.includes(service.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedServices([...selectedServices, service.id]);
                    } else {
                      setSelectedServices(selectedServices.filter(s => s !== service.id));
                    }
                  }}
                  className="rounded"
                />
                <span className="text-xl">{service.icon}</span>
                <div>
                  <div className="font-medium">{service.name}</div>
                  <div className="text-xs text-gray-500">Phase {service.phase}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Migration Options */}
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-3">Migration Options</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={migrationOptions.prioritizeSpeed}
                onChange={(e) => setMigrationOptions({
                  ...migrationOptions,
                  prioritizeSpeed: e.target.checked,
                  prioritizeReliability: !e.target.checked,
                })}
                className="rounded"
              />
              <span>Prioritize Speed (Higher concurrency, more risk)</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={migrationOptions.prioritizeReliability}
                onChange={(e) => setMigrationOptions({
                  ...migrationOptions,
                  prioritizeReliability: e.target.checked,
                  prioritizeSpeed: !e.target.checked,
                })}
                className="rounded"
              />
              <span>Prioritize Reliability (Lower concurrency, safer)</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={migrationOptions.deltaMode}
                onChange={(e) => setMigrationOptions({
                  ...migrationOptions,
                  deltaMode: e.target.checked,
                })}
                className="rounded"
              />
              <span>Delta Mode (Only migrate changes)</span>
            </label>
            <div className="flex items-center space-x-2">
              <label>Max Concurrent Users:</label>
              <input
                type="number"
                min={1}
                max={50}
                value={migrationOptions.maxConcurrentUsers}
                onChange={(e) => setMigrationOptions({
                  ...migrationOptions,
                  maxConcurrentUsers: parseInt(e.target.value) || 10,
                })}
                className="w-20 px-2 py-1 border rounded"
              />
            </div>
          </div>
        </div>

        <button
          onClick={createExecutionPlan}
          disabled={selectedServices.length === 0 || userMappings.length === 0}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
        >
          Create Execution Plan
        </button>
      </div>

      {/* Execution Plan Review */}
      {executionPlan && validationResult && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-semibold mb-4">Execution Plan Review</h2>
          
          {/* Plan Summary */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">{executionPlan.totalUsers}</div>
                <div className="text-sm text-gray-600">Users</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{executionPlan.totalServices}</div>
                <div className="text-sm text-gray-600">Services</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">{Math.floor(executionPlan.estimatedDuration / 60)}h {executionPlan.estimatedDuration % 60}m</div>
                <div className="text-sm text-gray-600">Est. Duration</div>
              </div>
              <div>
                <div className={`text-2xl font-bold ${getRiskLevelColor(validationResult.riskAssessment.level)}`}>
                  {validationResult.riskAssessment.level.toUpperCase()}
                </div>
                <div className="text-sm text-gray-600">Risk Level</div>
              </div>
            </div>
          </div>

          {/* Execution Phases */}
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-3">Execution Phases</h3>
            <div className="space-y-3">
              {executionPlan.executionPhases.map(phase => (
                <div key={phase.phase} className="flex items-center space-x-4 p-3 border rounded-lg">
                  <div className="text-2xl">{getPhaseStatusIcon(phase)}</div>
                  <div className="flex-1">
                    <div className="font-medium">Phase {phase.phase}: {phase.name}</div>
                    <div className="text-sm text-gray-600">
                      Services: {phase.services.join(', ')} • 
                      Duration: {phase.estimatedDurationMinutes}min • 
                      Concurrency: {phase.userConcurrency} users
                    </div>
                  </div>
                  <div className="text-sm font-medium">
                    {phase.canRunInParallel ? '⚡ Parallel' : '⏯️ Sequential'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Validation Results */}
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-3">Validation Results</h3>
            
            {validationResult.errors.length > 0 && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="font-medium text-red-800">Errors:</div>
                <ul className="list-disc list-inside text-red-700">
                  {validationResult.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            {validationResult.warnings.length > 0 && (
              <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="font-medium text-yellow-800">Warnings:</div>
                <ul className="list-disc list-inside text-yellow-700">
                  {validationResult.warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            {validationResult.recommendations.length > 0 && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="font-medium text-blue-800">Recommendations:</div>
                <ul className="list-disc list-inside text-blue-700">
                  {validationResult.recommendations.map((rec, index) => (
                    <li key={index}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <button
            onClick={executeCurrentPlan}
            disabled={!validationResult.isValid || activeExecution !== null}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300"
          >
            {activeExecution ? 'Migration Running...' : 'Execute Migration Plan'}
          </button>
        </div>
      )}

      {/* Real-time Dashboard */}
      {dashboardData && activeExecution && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-semibold mb-4">Migration Dashboard</h2>
          
          {/* Overview Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{dashboardData.overview.overallSuccessRate.toFixed(1)}%</div>
              <div className="text-sm text-blue-700">Overall Progress</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{dashboardData.realTimeMetrics.currentThroughput.toFixed(0)}</div>
              <div className="text-sm text-green-700">Items/Hour</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{dashboardData.realTimeMetrics.activeWorkers}</div>
              <div className="text-sm text-purple-700">Active Workers</div>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{dashboardData.realTimeMetrics.queueDepth}</div>
              <div className="text-sm text-yellow-700">Queue Depth</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{dashboardData.realTimeMetrics.rateLimitHits}</div>
              <div className="text-sm text-red-700">Rate Limit Hits</div>
            </div>
          </div>

          {/* User Progress */}
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-3">User Progress (Top 10)</h3>
            <div className="space-y-2">
              {dashboardData.userProgress.slice(0, 10).map((user, index) => (
                <div key={user.userId} className="flex items-center space-x-4 p-3 border rounded-lg">
                  <div className="w-4 h-4 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{user.sourceEmail}</div>
                    <div className="text-sm text-gray-600">
                      Current: {user.currentService || 'Completed'} • Status: {user.status}
                    </div>
                  </div>
                  <div className="w-32">
                    <div className="bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${user.overallProgress}%` }}
                      ></div>
                    </div>
                    <div className="text-xs text-center mt-1">{user.overallProgress.toFixed(1)}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Service Breakdown */}
          <div>
            <h3 className="text-lg font-medium mb-3">Service Performance</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(dashboardData.serviceMetrics).map(([service, metrics]) => (
                <div key={service} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium capitalize">{service}</div>
                    <div className="text-sm text-gray-600">{metrics.successRate.toFixed(1)}% success</div>
                  </div>
                  <div className="text-sm text-gray-600">
                    Completed: {metrics.completedUsers}/{metrics.totalUsers} users
                  </div>
                  <div className="text-sm text-gray-600">
                    Avg Duration: {Math.floor(metrics.avgDuration / 1000)}s
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Feature Information */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-semibold mb-4">🚀 Advanced Migration Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold text-blue-600 mb-2">🔄 Concurrency Management</h3>
            <p className="text-sm text-gray-600">
              Migrate 10-20 users in parallel with configurable worker pools and intelligent queue management.
            </p>
          </div>
          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold text-green-600 mb-2">⚡ Service-wise Chunking</h3>
            <p className="text-sm text-gray-600">
              Run multiple services in parallel per user while respecting dependencies and rate limits.
            </p>
          </div>
          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold text-purple-600 mb-2">🎯 Priority Handling</h3>
            <p className="text-sm text-gray-600">
              Intelligent service prioritization: fast services first, heavy services with proper throttling.
            </p>
          </div>
          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold text-yellow-600 mb-2">🛡️ Rate Limiting</h3>
            <p className="text-sm text-gray-600">
              Built-in rate control per service to avoid 429s. Gmail: 2500/day, Drive: 1000 QPS per project.
            </p>
          </div>
          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold text-red-600 mb-2">📊 Live Monitoring</h3>
            <p className="text-sm text-gray-600">
              Real-time dashboards, alerts, and comprehensive reporting with automatic issue detection.
            </p>
          </div>
          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold text-indigo-600 mb-2">🔍 Validation & QA</h3>
            <p className="text-sm text-gray-600">
              Random sampling QA, checksum validation, and automated post-migration verification.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
