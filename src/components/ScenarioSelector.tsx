'use client';

import { memo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Building, 
  ArrowRightLeft, 
  Shield, 
  Users, 
  CheckCircle,
  Clock,
  Info,
  HelpCircle,
  ArrowRight,
  GitMerge,
  GitBranch
} from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { 
  MigrationScenario, 
  getScenarioDescription, 
  getEstimatedTotalDuration, 
  SINGLE_SUPER_ADMIN_STEPS, 
  CROSS_TENANT_STEPS
} from '@/types/migration-scenarios';
import { UserMappingRelationship } from '@/types';

interface ScenarioSelectorProps {
  selectedScenario: MigrationScenario | null;
  onScenarioSelect: (scenario: MigrationScenario) => void;
  onStartGmailMigration?: () => void;
  selectedUserMapping?: UserMappingRelationship | null;
  onUserMappingSelect?: (mapping: UserMappingRelationship) => void;
}

export const ScenarioSelector = memo(function ScenarioSelector({ 
  selectedScenario, 
  onScenarioSelect, 
  onStartGmailMigration,
  selectedUserMapping,
  onUserMappingSelect 
}: ScenarioSelectorProps) {
  const router = useRouter();
  
  // User Mapping Options
  const USER_MAPPING_OPTIONS = [
    {
      type: 'one-to-one' as UserMappingRelationship,
      title: 'One-to-One',
      description: 'Each source user maps to exactly one target user',
      icon: ArrowRight,
      example: 'john@source.com → john@target.com',
      complexity: 'Low'
    },
    {
      type: 'one-to-many' as UserMappingRelationship,
      title: 'One-to-Many',
      description: 'Each source user maps to multiple target users',
      icon: GitBranch,
      example: 'admin@source.com → admin@target1.com, admin@target2.com',
      complexity: 'Medium'
    },
    {
      type: 'many-to-one' as UserMappingRelationship,
      title: 'Many-to-One',
      description: 'Multiple source users map to a single target user',
      icon: GitMerge,
      example: 'john@old1.com, john@old2.com → john@new.com',
      complexity: 'High'
    }
  ];

  // Tooltip Component
  const TooltipWrapper = ({ children, content }: { children: React.ReactNode; content: React.ReactNode }) => (
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          {children}
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="max-w-xs p-3 bg-gray-900 text-white text-sm rounded-lg shadow-lg z-50"
            sideOffset={5}
          >
            {content}
            <Tooltip.Arrow className="fill-gray-900" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );

  const scenarios = [
    {
      type: 'single-super-admin' as MigrationScenario,
      title: 'Single Super Admin',
      subtitle: 'One Domain to One Domain',
      description: 'Map and migrate data between two domains under the same Google Workspace account',
      icon: Building,
      complexity: 'Low',
      steps: SINGLE_SUPER_ADMIN_STEPS.length,
      estimatedTime: getEstimatedTotalDuration(SINGLE_SUPER_ADMIN_STEPS),
      requirements: [
        'Single Google Workspace Super Admin account',
        'Two verified domains in one workspace',
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
    <div className="space-y-8">
      {/* Migration Scenarios */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Choose Migration Scenario
          </h2>
          <p className="text-gray-600">
            Select the type of migration that matches your organization's setup.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {scenarios.map((scenario) => {
            const Icon = scenario.icon;
            const isSelected = selectedScenario === scenario.type;
            
            return (
              <div
                key={scenario.type}
                onClick={() => onScenarioSelect(scenario.type)}
                className={`relative cursor-pointer rounded-lg border-2 p-4 transition-all hover:shadow-md ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50 shadow-md'
                    : 'border-gray-200 bg-white hover:border-blue-300'
                }`}
              >
                {isSelected && (
                  <div className="absolute top-3 right-3">
                    <CheckCircle className="h-5 w-5 text-blue-600" />
                  </div>
                )}

                {/* Header */}
                <div className="flex items-start space-x-3 mb-3">
                  <div className={`p-2 rounded-lg ${isSelected ? 'bg-blue-600' : 'bg-gray-100'}`}>
                    <Icon className={`h-5 w-5 ${isSelected ? 'text-white' : 'text-gray-600'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900">{scenario.title}</h3>
                    <p className="text-sm text-gray-500">{scenario.subtitle}</p>
                  </div>
                </div>

                {/* Description */}
                <p className="text-gray-700 text-sm mb-3">{scenario.description}</p>

                {/* Compact Info Row */}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      scenario.complexity === 'High' 
                        ? 'bg-red-100 text-red-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {scenario.complexity}
                    </span>
                    <div className="flex items-center text-gray-600">
                      <Clock className="h-4 w-4 mr-1" />
                      <span>{scenario.estimatedTime}</span>
                    </div>
                  </div>

                  {/* Tooltips for Requirements and Benefits */}
                  <div className="flex items-center space-x-2">
                    <TooltipWrapper
                      content={
                        <div>
                          <p className="font-medium mb-2">Requirements:</p>
                          <ul className="space-y-1">
                            {scenario.requirements.map((req, index) => (
                              <li key={index} className="text-xs">• {req}</li>
                            ))}
                          </ul>
                        </div>
                      }
                    >
                      <button className="p-1 text-gray-400 hover:text-blue-600 transition-colors">
                        <Shield className="h-4 w-4" />
                      </button>
                    </TooltipWrapper>

                    <TooltipWrapper
                      content={
                        <div>
                          <p className="font-medium mb-2">Benefits:</p>
                          <ul className="space-y-1">
                            {scenario.benefits.map((benefit, index) => (
                              <li key={index} className="text-xs">• {benefit}</li>
                            ))}
                          </ul>
                        </div>
                      }
                    >
                      <button className="p-1 text-gray-400 hover:text-green-600 transition-colors">
                        <CheckCircle className="h-4 w-4" />
                      </button>
                    </TooltipWrapper>

                    <TooltipWrapper content={`${scenario.steps} automated migration steps with detailed progress tracking`}>
                      <button className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
                        <Info className="h-4 w-4" />
                      </button>
                    </TooltipWrapper>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* User Mapping Relationship Selection */}
      {selectedScenario && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              User Mapping Strategy
            </h3>
            <p className="text-gray-600">
              Choose how source users will be mapped to target users during the migration.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {USER_MAPPING_OPTIONS.map((mapping) => {
              const Icon = mapping.icon;
              const isSelected = selectedUserMapping === mapping.type;
              
              return (
                <div
                  key={mapping.type}
                  onClick={() => onUserMappingSelect?.(mapping.type)}
                  className={`relative cursor-pointer rounded-lg border-2 p-4 transition-all hover:shadow-md ${
                    isSelected
                      ? 'border-green-600 bg-green-50 shadow-md'
                      : 'border-gray-200 bg-white hover:border-green-300'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-3 right-3">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    </div>
                  )}

                  {/* Header */}
                  <div className="flex items-center space-x-3 mb-3">
                    <div className={`p-2 rounded-lg ${isSelected ? 'bg-green-600' : 'bg-gray-100'}`}>
                      <Icon className={`h-5 w-5 ${isSelected ? 'text-white' : 'text-gray-600'}`} />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-base font-medium text-gray-900">{mapping.title}</h4>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-gray-600 text-sm mb-3">{mapping.description}</p>

                  {/* Example */}
                  <div className="bg-gray-50 rounded-md p-2 mb-3">
                    <p className="text-xs font-medium text-gray-700 mb-1">Example:</p>
                    <p className="text-xs text-gray-600 font-mono">{mapping.example}</p>
                  </div>

                  {/* Complexity */}
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      mapping.complexity === 'Low' 
                        ? 'bg-green-100 text-green-800'
                        : mapping.complexity === 'Medium'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {mapping.complexity}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});

ScenarioSelector.displayName = 'ScenarioSelector';

export default ScenarioSelector;
