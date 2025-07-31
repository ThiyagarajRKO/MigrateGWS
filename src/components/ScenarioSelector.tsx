'use client';

import { useState } from 'react';
import { 
  Building, 
  ArrowRightLeft, 
  Shield, 
  Users, 
  CheckCircle,
  Clock,
  Info
} from 'lucide-react';
import { MigrationScenario, getScenarioDescription, getEstimatedTotalDuration, SINGLE_SUPER_ADMIN_STEPS, CROSS_TENANT_STEPS } from '@/types/migration-scenarios';

interface ScenarioSelectorProps {
  selectedScenario: MigrationScenario | null;
  onScenarioSelect: (scenario: MigrationScenario) => void;
}

export function ScenarioSelector({ selectedScenario, onScenarioSelect }: ScenarioSelectorProps) {
  const scenarios = [
    {
      type: 'single-super-admin' as MigrationScenario,
      title: 'Single Super Admin (Multi-Domain)',
      subtitle: 'Within One Google Workspace Account',
      description: 'Map and migrate data between two domains under the same Google Workspace account',
      icon: Building,
      complexity: 'Medium',
      steps: SINGLE_SUPER_ADMIN_STEPS.length,
      estimatedTime: getEstimatedTotalDuration(SINGLE_SUPER_ADMIN_STEPS),
      requirements: [
        'Single Google Workspace Super Admin account',
        'Multiple verified domains in one workspace',
        'Domain-wide delegation enabled',
        'Appropriate API scopes configured'
      ],
      benefits: [
        'Simplified authentication (single admin)',
        'Native domain management within workspace',
        'Faster migration due to same-tenant operations',
        'Easier permission management'
      ]
    },
    {
      type: 'cross-tenant' as MigrationScenario,
      title: 'Cross-Tenant Migration',
      subtitle: 'Between Separate Google Workspace Accounts',
      description: 'Fully migrate data between two separate Google Workspace accounts/domains',
      icon: ArrowRightLeft,
      complexity: 'High',
      steps: CROSS_TENANT_STEPS.length,
      estimatedTime: getEstimatedTotalDuration(CROSS_TENANT_STEPS),
      requirements: [
        'Super Admin access to source workspace',
        'Super Admin access to destination workspace',
        'Dual OAuth authentication setup',
        'Intermediate secure storage for data transfer'
      ],
      benefits: [
        'Complete organizational separation',
        'Full data ownership transfer',
        'Independent billing and management',
        'Enhanced security isolation'
      ]
    }
  ];

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Choose Migration Scenario</h2>
        <p className="text-gray-600">Select the type of migration that matches your organizational structure</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {scenarios.map((scenario) => {
          const Icon = scenario.icon;
          const isSelected = selectedScenario === scenario.type;
          
          return (
            <div
              key={scenario.type}
              onClick={() => onScenarioSelect(scenario.type)}
              className={`relative cursor-pointer rounded-lg border-2 p-6 transition-all hover:shadow-lg ${
                isSelected
                  ? 'border-blue-600 bg-blue-50 shadow-lg'
                  : 'border-gray-200 bg-white hover:border-blue-300'
              }`}
            >
              {isSelected && (
                <div className="absolute top-4 right-4">
                  <CheckCircle className="h-6 w-6 text-blue-600" />
                </div>
              )}

              <div className="flex items-start space-x-4 mb-4">
                <div className={`p-3 rounded-lg ${isSelected ? 'bg-blue-600' : 'bg-gray-100'}`}>
                  <Icon className={`h-6 w-6 ${isSelected ? 'text-white' : 'text-gray-600'}`} />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{scenario.title}</h3>
                  <p className="text-sm text-gray-500">{scenario.subtitle}</p>
                </div>
              </div>

              <p className="text-gray-700 mb-4">{scenario.description}</p>

              <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Complexity:</span>
                  <span className={`ml-2 px-2 py-1 rounded text-xs ${
                    scenario.complexity === 'High' 
                      ? 'bg-red-100 text-red-800' 
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {scenario.complexity}
                  </span>
                </div>
                <div className="flex items-center">
                  <Clock className="h-4 w-4 text-gray-500 mr-1" />
                  <span className="text-gray-600">{scenario.estimatedTime}</span>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2 flex items-center">
                    <Shield className="h-4 w-4 mr-1" />
                    Requirements
                  </h4>
                  <ul className="space-y-1">
                    {scenario.requirements.map((req, index) => (
                      <li key={index} className="text-sm text-gray-600 flex items-start">
                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mt-2 mr-2 flex-shrink-0" />
                        {req}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-2 flex items-center">
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Benefits
                  </h4>
                  <ul className="space-y-1">
                    {scenario.benefits.map((benefit, index) => (
                      <li key={index} className="text-sm text-gray-600 flex items-start">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2 mr-2 flex-shrink-0" />
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>{scenario.steps} migration steps</span>
                  <span className="flex items-center">
                    <Info className="h-4 w-4 mr-1" />
                    Automated workflow
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {selectedScenario && (
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-medium text-blue-900 mb-2">Selected: {scenarios.find(s => s.type === selectedScenario)?.title}</h3>
          <p className="text-blue-800 text-sm">
            {getScenarioDescription(selectedScenario)}
          </p>
        </div>
      )}
    </div>
  );
}
