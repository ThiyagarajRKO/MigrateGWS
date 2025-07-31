'use client';

import { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  Play, 
  Pause, 
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ExternalLink
} from 'lucide-react';
import { MigrationStep, MigrationStatus } from '@/types/migration-scenarios';

interface MigrationProgressProps {
  migrationStatus: MigrationStatus;
  steps: MigrationStep[];
  onStepAction?: (stepId: string, action: 'start' | 'pause' | 'retry') => void;
}

export function MigrationProgress({ migrationStatus, steps, onStepAction }: MigrationProgressProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  
  const toggleStepExpansion = (stepId: string) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(stepId)) {
      newExpanded.delete(stepId);
    } else {
      newExpanded.add(stepId);
    }
    setExpandedSteps(newExpanded);
  };

  const getStepIcon = (step: MigrationStep) => {
    switch (step.status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'in-progress':
        return <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />;
      case 'failed':
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStepStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'in-progress':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const completedSteps = steps.filter(s => s.status === 'completed').length;
  const overallProgress = (completedSteps / steps.length) * 100;

  return (
    <div className="space-y-6">
      {/* Overall Progress */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Migration Progress</h2>
            <p className="text-gray-600">
              {migrationStatus.scenarioType === 'single-super-admin' 
                ? 'Single Super Admin Migration' 
                : 'Cross-Tenant Migration'}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">{Math.round(overallProgress)}%</div>
            <div className="text-sm text-gray-500">{completedSteps} of {steps.length} steps</div>
          </div>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
          <div 
            className="bg-blue-600 h-3 rounded-full transition-all duration-500" 
            style={{ width: `${overallProgress}%` }}
          ></div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="font-medium text-gray-900">Status</div>
            <div className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
              migrationStatus.status === 'completed' ? 'bg-green-100 text-green-800' :
              migrationStatus.status === 'running' ? 'bg-blue-100 text-blue-800' :
              migrationStatus.status === 'failed' ? 'bg-red-100 text-red-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {migrationStatus.status}
            </div>
          </div>
          <div>
            <div className="font-medium text-gray-900">Started</div>
            <div className="text-gray-600">
              {new Date(migrationStatus.startTime).toLocaleString()}
            </div>
          </div>
          <div>
            <div className="font-medium text-gray-900">Current Step</div>
            <div className="text-gray-600">
              {steps.find(s => s.id === migrationStatus.currentStep)?.title || 'Not started'}
            </div>
          </div>
          <div>
            <div className="font-medium text-gray-900">Estimated Completion</div>
            <div className="text-gray-600">
              {migrationStatus.estimatedCompletion 
                ? new Date(migrationStatus.estimatedCompletion).toLocaleString()
                : 'Calculating...'}
            </div>
          </div>
        </div>
      </div>

      {/* Step-by-Step Progress */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Migration Steps</h3>
        </div>
        
        <div className="divide-y divide-gray-200">
          {steps.map((step, index) => {
            const isExpanded = expandedSteps.has(step.id);
            const isCurrentStep = migrationStatus.currentStep === step.id;
            const stepErrors = migrationStatus.errors.filter(e => e.step === step.id && !e.resolved);
            
            return (
              <div key={step.id} className={`p-6 ${isCurrentStep ? 'bg-blue-50' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 flex-1">
                    <div className="flex-shrink-0">
                      {getStepIcon(step)}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <span className="text-sm font-medium text-gray-500">Step {index + 1}</span>
                        <h4 className="font-medium text-gray-900">{step.title}</h4>
                        <span className={`px-2 py-1 text-xs font-medium rounded border ${getStepStatusColor(step.status)}`}>
                          {step.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{step.description}</p>
                      
                      {step.status === 'in-progress' && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                            <span>Progress</span>
                            <span>{step.progress}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div 
                              className="bg-blue-600 h-1.5 rounded-full transition-all duration-300" 
                              style={{ width: `${step.progress}%` }}
                            ></div>
                          </div>
                        </div>
                      )}

                      {stepErrors.length > 0 && (
                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm">
                          <div className="font-medium text-red-800 mb-1">Errors:</div>
                          {stepErrors.map((error, idx) => (
                            <div key={idx} className="text-red-700">{error.message}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {step.estimatedDuration && (
                      <span className="text-xs text-gray-500 flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        {step.estimatedDuration}
                      </span>
                    )}

                    {(step.status === 'failed' || step.status === 'pending') && onStepAction && (
                      <button
                        onClick={() => onStepAction(step.id, step.status === 'failed' ? 'retry' : 'start')}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center"
                      >
                        <Play className="h-4 w-4 mr-1" />
                        {step.status === 'failed' ? 'Retry' : 'Start'}
                      </button>
                    )}

                    <button
                      onClick={() => toggleStepExpansion(step.id)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 pl-9 space-y-3 border-l-2 border-gray-200 ml-2">
                    <div>
                      <h5 className="font-medium text-gray-900 mb-2">Automation Approach</h5>
                      <p className="text-sm text-gray-600">{step.automationApproach}</p>
                    </div>
                    
                    <div>
                      <h5 className="font-medium text-gray-900 mb-2">APIs Used</h5>
                      <div className="flex flex-wrap gap-2">
                        {step.apisUsed.map((api, idx) => (
                          <span key={idx} className="inline-flex items-center px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded">
                            {api}
                            <ExternalLink className="h-3 w-3 ml-1" />
                          </span>
                        ))}
                      </div>
                    </div>

                    {step.actualDuration && (
                      <div>
                        <h5 className="font-medium text-gray-900 mb-1">Actual Duration</h5>
                        <p className="text-sm text-gray-600">{step.actualDuration}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
