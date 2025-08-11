'use client';

import { useState, useEffect, memo } from 'react';
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
import { MigrationStep, MigrationStatus, MigrationError } from '@/types/migration-scenarios';

interface MigrationProgressProps {
  migrationStatus: MigrationStatus;
  steps: MigrationStep[];
  onStepAction?: (stepId: string, action: 'start' | 'pause' | 'retry') => void;
}

export const MigrationProgress = memo(function MigrationProgress({ migrationStatus, steps, onStepAction }: MigrationProgressProps) {
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
            <h2 className="text-xl font-semibold text-gray-900">{migrationStatus.name}</h2>
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

      {/* Compact Migration Steps Stepper */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium text-gray-900">Migration Steps</h3>
          <div className="text-sm text-gray-500">
            {completedSteps} of {steps.length} completed
          </div>
        </div>
        
        {/* Compact Horizontal Stepper */}
        <div className="overflow-x-auto pb-4">
          <div className="flex items-center justify-between min-w-max px-4">
            {steps.map((step, index) => {
              const isActive = migrationStatus.currentStep === step.id;
              const isCompleted = step.status === 'completed';
              const isFailed = step.status === 'failed';
              const isInProgress = step.status === 'in-progress';
              const stepErrors = migrationStatus.errors.filter(e => e.step === step.id && !e.resolved);
              
              return (
                <div key={step.id} className="flex items-center group relative">
                  {/* Step Circle */}
                  <div 
                    className={`relative flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all duration-200 ${
                      isCompleted 
                        ? 'bg-green-500 border-green-500 text-white shadow-lg' 
                        : isFailed
                        ? 'bg-red-500 border-red-500 text-white shadow-lg'
                        : isInProgress 
                        ? 'bg-blue-500 border-blue-500 text-white shadow-lg animate-pulse' 
                        : isActive 
                        ? 'bg-blue-100 border-blue-500 text-blue-600 shadow-lg' 
                        : 'bg-gray-100 border-gray-300 text-gray-400 hover:bg-gray-200 hover:border-gray-400'
                    }`}
                  >
                    {getStepIcon(step)}
                    
                    {/* In-progress indicator */}
                    {isInProgress && (
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center">
                        <RefreshCw className="h-2.5 w-2.5 text-white animate-spin" />
                      </div>
                    )}
                    
                    {/* Error indicator */}
                    {stepErrors.length > 0 && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs font-bold">!</span>
                      </div>
                    )}
                    
                    {/* Hover Tooltip */}
                    <div className="absolute bottom-full mb-3 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-50">
                      <div className="bg-gray-900 text-white text-xs rounded-lg px-4 py-3 shadow-xl whitespace-nowrap max-w-sm">
                        <div className="font-semibold text-center mb-1">{step.title}</div>
                        <div className="text-gray-300 text-center mb-2">{step.description}</div>
                        
                        <div className="space-y-1 text-left">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Status:</span>
                            <span className={`font-medium ${
                              isCompleted ? 'text-green-400' :
                              isFailed ? 'text-red-400' :
                              isInProgress ? 'text-blue-400' :
                              'text-gray-300'
                            }`}>
                              {step.status}
                            </span>
                          </div>
                          
                          {step.estimatedDuration && (
                            <div className="flex justify-between">
                              <span className="text-gray-400">Duration:</span>
                              <span className="text-gray-300">{step.estimatedDuration}</span>
                            </div>
                          )}
                          
                          {isInProgress && step.progress !== undefined && (
                            <div className="flex justify-between">
                              <span className="text-gray-400">Progress:</span>
                              <span className="text-blue-400">{step.progress}%</span>
                            </div>
                          )}
                          
                          {step.automationApproach && (
                            <div className="mt-2 pt-2 border-t border-gray-700">
                              <div className="text-gray-400 text-center">Automation</div>
                              <div className="text-gray-300 text-center">{step.automationApproach}</div>
                            </div>
                          )}
                          
                          {step.apisUsed && step.apisUsed.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-700">
                              <div className="text-gray-400 text-center mb-1">APIs Used</div>
                              <div className="flex flex-wrap gap-1 justify-center">
                                {step.apisUsed.slice(0, 3).map((api, idx) => (
                                  <span key={idx} className="bg-gray-800 text-gray-300 px-1 py-0.5 rounded text-xs">
                                    {api}
                                  </span>
                                ))}
                                {step.apisUsed.length > 3 && (
                                  <span className="text-gray-400 text-xs">+{step.apisUsed.length - 3}</span>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {stepErrors.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-red-700">
                              <div className="text-red-400 text-center mb-1">Errors ({stepErrors.length})</div>
                              <div className="text-red-300 text-center text-xs">
                                {stepErrors[0].message}
                                {stepErrors.length > 1 && <div className="text-red-400">+{stepErrors.length - 1} more</div>}
                              </div>
                            </div>
                          )}
                        </div>
                        
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Step Label */}
                  <div className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 text-center">
                    <div className="text-xs font-medium text-gray-900 whitespace-nowrap">
                      Step {index + 1}
                    </div>
                    <div className="text-xs text-gray-500 whitespace-nowrap max-w-20 truncate">
                      {step.title}
                    </div>
                  </div>
                  
                  {/* Connector Line */}
                  {index < steps.length - 1 && (
                    <div 
                      className={`flex-1 h-0.5 mx-4 transition-colors duration-300 min-w-16 ${
                        steps[index + 1].status === 'completed' || isCompleted 
                          ? 'bg-green-400' 
                          : isInProgress || isActive
                          ? 'bg-blue-400'
                          : 'bg-gray-300'
                      }`}
                    />
                  )}
                  
                  {/* Action Buttons for Failed/Pending Steps */}
                  {(isFailed || (step.status === 'pending' && isActive)) && onStepAction && (
                    <button
                      onClick={() => onStepAction(step.id, isFailed ? 'retry' : 'start')}
                      className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      {isFailed ? 'Retry' : 'Start'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Current Step Progress Bar (if in progress) */}
        {steps.some(s => s.status === 'in-progress') && (
          <div className="mt-8 pt-4 border-t border-gray-200">
            {steps.filter(s => s.status === 'in-progress').map(step => (
              <div key={step.id} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-900">Current: {step.title}</span>
                  <span className="text-gray-600">{step.progress || 0}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-500" 
                    style={{ width: `${step.progress || 0}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

MigrationProgress.displayName = 'MigrationProgress';

export default MigrationProgress;
