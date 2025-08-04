/**
 * Enhanced Migration Page
 * Integrates advanced migration features with existing app workflow
 * This component can be used to replace or enhance the existing migration/new page
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ArrowLeft,
  ArrowRight,
  Settings,
  Users,
  Shield,
  Activity,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';

// Import existing components
import { ScenarioSelector } from '@/components/ScenarioSelector';
import { DomainMappingSelector } from '@/components/DomainMappingSelector';
import { UserDiscovery } from '@/components/UserDiscovery';

// Import new enhanced components
import { EnhancedMigrationOptions, MigrationExecutionOptions } from '@/components/EnhancedMigrationOptions';
import { MigrationExecutionController } from '@/components/MigrationExecutionController';
import { RealTimeMigrationDashboard } from '@/components/RealTimeMigrationDashboard';

import { MigrationScenario, DomainMappingConfig } from '@/types/migration-scenarios';
import { UserMapping } from '@/types';

type Step = 'scenario' | 'mapping' | 'users' | 'options' | 'execution' | 'monitoring';

interface MigrationState {
  scenario: MigrationScenario | null;
  domainMappings: any[];
  userMappings: UserMapping[];
  selectedServices: string[];
  executionOptions: MigrationExecutionOptions;
  credentials: any;
  migrationStatus: string;
}

export default function EnhancedMigrationPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>('scenario');
  const [migrationState, setMigrationState] = useState<MigrationState>({
    scenario: null,
    domainMappings: [],
    userMappings: [],
    selectedServices: [],
    executionOptions: {
      prioritizeReliability: true,
      maxConcurrentUsers: 10,
      deltaMode: false,
      dryRun: false,
      pauseOnError: true,
    },
    credentials: null,
    migrationStatus: 'idle',
  });

  const steps: { key: Step; title: string; description: string; icon: any }[] = [
    {
      key: 'scenario',
      title: 'Migration Scenario',
      description: 'Select your migration scenario and configure basic settings',
      icon: Settings,
    },
    {
      key: 'mapping',
      title: 'Domain Mapping',
      description: 'Map source domains to target domains',
      icon: Shield,
    },
    {
      key: 'users',
      title: 'User Discovery',
      description: 'Discover and map users between organizations',
      icon: Users,
    },
    {
      key: 'options',
      title: 'Execution Options',
      description: 'Configure advanced migration optimization settings',
      icon: Settings,
    },
    {
      key: 'execution',
      title: 'Migration Execution',
      description: 'Execute and control the migration process',
      icon: Activity,
    },
    {
      key: 'monitoring',
      title: 'Live Monitoring',
      description: 'Monitor migration progress in real-time',
      icon: Activity,
    },
  ];

  const currentStepIndex = steps.findIndex(step => step.key === currentStep);
  const progressPercentage = ((currentStepIndex + 1) / steps.length) * 100;

  const canProceedToNext = () => {
    switch (currentStep) {
      case 'scenario':
        return migrationState.scenario !== null;
      case 'mapping':
        return migrationState.domainMappings.length > 0;
      case 'users':
        return migrationState.userMappings.length > 0;
      case 'options':
        return true; // Options are always valid
      case 'execution':
        return migrationState.migrationStatus === 'completed' || migrationState.migrationStatus === 'failed';
      default:
        return false;
    }
  };

  const handleNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex].key);
    }
  };

  const handlePrevious = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex].key);
    }
  };

  const handleScenarioSelect = (scenario: MigrationScenario) => {
    setMigrationState(prev => ({
      ...prev,
      scenario,
      selectedServices: ['gmail', 'drive', 'calendar', 'contacts'], // Default services for all scenarios
    }));
  };

  const handleDomainMappingComplete = (mapping: DomainMappingConfig) => {
    setMigrationState(prev => ({
      ...prev,
      domainMappings: [mapping], // Convert single mapping to array if needed
    }));
  };

  const handleUserDiscoveryComplete = (userMappings: any[]) => {
    setMigrationState(prev => ({
      ...prev,
      userMappings,
    }));
  };

  const handleExecutionOptionsChange = (options: MigrationExecutionOptions) => {
    setMigrationState(prev => ({
      ...prev,
      executionOptions: options,
    }));
  };

  const handleMigrationStatusChange = (status: string) => {
    setMigrationState(prev => ({
      ...prev,
      migrationStatus: status,
    }));
  };

  const isExecutionActive = migrationState.migrationStatus === 'executing';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Enhanced Migration Setup
              </h1>
              <p className="text-gray-600 mt-2">
                Configure and execute your Google Workspace migration with advanced optimization
              </p>
            </div>
            
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Migrations
            </Button>
          </div>

          {/* Progress Bar */}
          <div className="mt-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">
                Step {currentStepIndex + 1} of {steps.length}: {steps[currentStepIndex].title}
              </span>
              <span className="text-sm text-gray-500">
                {progressPercentage.toFixed(0)}% Complete
              </span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>

          {/* Step Indicators */}
          <div className="mt-4 flex space-x-4 overflow-x-auto">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isCompleted = index < currentStepIndex;
              const isCurrent = index === currentStepIndex;
              
              return (
                <div
                  key={step.key}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                    isCurrent
                      ? 'bg-blue-100 text-blue-700'
                      : isCompleted
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                  onClick={() => setCurrentStep(step.key)}
                >
                  {isCompleted ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                  <span className="text-sm font-medium whitespace-nowrap">
                    {step.title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Panel */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {React.createElement(steps[currentStepIndex].icon, { className: "h-5 w-5" })}
                  {steps[currentStepIndex].title}
                </CardTitle>
                <p className="text-sm text-gray-600">
                  {steps[currentStepIndex].description}
                </p>
              </CardHeader>
              <CardContent>
                {/* Step Content */}
                {currentStep === 'scenario' && (
                  <ScenarioSelector
                    selectedScenario={migrationState.scenario}
                    onScenarioSelect={handleScenarioSelect}
                  />
                )}

                {currentStep === 'mapping' && migrationState.scenario && (
                  <DomainMappingSelector
                    selectedScenario={migrationState.scenario}
                    selectedMapping={null}
                    onMappingSelect={handleDomainMappingComplete}
                  />
                )}

                {currentStep === 'users' && migrationState.scenario && (
                  <UserDiscovery
                    scenario={migrationState.scenario}
                    domainMapping={migrationState.domainMappings?.[0]} // Pass the first domain mapping
                    onUserMappingChange={handleUserDiscoveryComplete}
                  />
                )}

                {currentStep === 'options' && (
                  <EnhancedMigrationOptions
                    options={migrationState.executionOptions}
                    onOptionsChange={handleExecutionOptionsChange}
                  />
                )}

                {currentStep === 'execution' && (
                  <MigrationExecutionController
                    userMappings={migrationState.userMappings}
                    selectedServices={migrationState.selectedServices}
                    executionOptions={migrationState.executionOptions}
                    credentials={migrationState.credentials}
                    onStatusChange={handleMigrationStatusChange}
                  />
                )}

                {currentStep === 'monitoring' && (
                  <RealTimeMigrationDashboard
                    isActive={isExecutionActive || migrationState.migrationStatus === 'completed'}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Migration Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Migration Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Scenario:</span>
                  <span className="font-medium">
                    {migrationState.scenario === 'single-super-admin' 
                      ? 'Single Super Admin' 
                      : migrationState.scenario === 'cross-tenant' 
                        ? 'Cross-Tenant Migration' 
                        : 'Not selected'
                    }
                  </span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span>Domains:</span>
                  <span className="font-medium">{migrationState.domainMappings.length}</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span>Users:</span>
                  <span className="font-medium">{migrationState.userMappings.length}</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span>Services:</span>
                  <span className="font-medium">{migrationState.selectedServices.length}</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span>Status:</span>
                  <span className="font-medium capitalize">{migrationState.migrationStatus}</span>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={handlePrevious}
                  disabled={currentStepIndex === 0}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Previous Step
                </Button>
                
                <Button
                  size="sm"
                  className="w-full"
                  onClick={handleNext}
                  disabled={!canProceedToNext() || currentStepIndex === steps.length - 1}
                >
                  Next Step
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>

            {/* Optimization Insights */}
            {currentStep === 'options' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Optimization Insights</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {migrationState.executionOptions.prioritizeSpeed && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        Speed optimization may increase error rates. Monitor closely.
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {migrationState.executionOptions.prioritizeReliability && (
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        Reliability optimization ensures data integrity with slower speeds.
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {migrationState.executionOptions.dryRun && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        Dry run mode enabled. No actual data will be migrated.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Live Status (when executing) */}
            {isExecutionActive && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    Live Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className="text-lg font-bold text-green-600">RUNNING</div>
                    <div className="text-xs text-gray-600">Migration in progress</div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
