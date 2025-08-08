'use client';

import { useState } from 'react';
import { 
  ArrowRight, 
  GitBranch, 
  GitMerge,
  Users,
  User,
  CheckCircle,
  Info,
  Clock
} from 'lucide-react';
import { UserMappingRelationship, UserMappingOption, UserMappingConfig } from '@/types';

interface UserMappingRelationshipSelectorProps {
  onSelectionComplete: (config: UserMappingConfig) => void;
  selectedScenario: 'single-super-admin' | 'cross-tenant';
}

const USER_MAPPING_OPTIONS: UserMappingOption[] = [
  {
    type: 'one-to-one',
    title: 'One-to-One User Mapping',
    description: 'Each source user maps to exactly one target user. Direct 1:1 relationship with username preservation or transformation.',
    icon: 'ArrowRight',
    complexity: 'Low',
    example: 'john@source.com → john@target.com',
    useCases: [
      'Simple domain migration',
      'Company rebrand or acquisition',
      'Preserving existing user structure',
      'Minimal disruption to users'
    ]
  },
  {
    type: 'one-to-many',
    title: 'One-to-Many User Mapping',
    description: 'Each source user can map to multiple target users across different domains or with different roles.',
    icon: 'GitBranch',
    complexity: 'Medium',
    example: 'admin@source.com → admin@target1.com, admin@target2.com',
    useCases: [
      'Multi-domain deployment',
      'Role-based access distribution',
      'Backup/redundant account creation',
      'Cross-departmental access'
    ]
  },
  {
    type: 'many-to-one',
    title: 'Many-to-One User Mapping',
    description: 'Multiple source users can map to a single target user, typically for consolidation scenarios.',
    icon: 'GitMerge',
    complexity: 'High',
    example: 'john@old1.com, john@old2.com → john@newcompany.com',
    useCases: [
      'Company mergers and acquisitions',
      'Consolidating multiple domains',
      'Eliminating duplicate accounts',
      'Centralizing user management'
    ]
  }
];

export function UserMappingRelationshipSelector({ 
  onSelectionComplete, 
  selectedScenario 
}: UserMappingRelationshipSelectorProps) {
  const [selectedRelationship, setSelectedRelationship] = useState<UserMappingRelationship | null>(null);
  const [mappingStrategy, setMappingStrategy] = useState<'automatic' | 'manual' | 'hybrid'>('manual');
  const [conflictResolution, setConflictResolution] = useState<'skip' | 'rename' | 'overwrite' | 'manual'>('rename');
  const [preserveUsernames, setPreserveUsernames] = useState(true);
  const [usernameSuffix, setUsernameSuffix] = useState('');
  const [usernamePrefix, setUsernamePrefix] = useState('');

  const handleContinue = () => {
    if (!selectedRelationship) return;

    const config: UserMappingConfig = {
      relationship: selectedRelationship,
      strategy: mappingStrategy,
      conflictResolution,
      preserveUsernames,
      usernameSuffix: usernameSuffix || undefined,
      usernamePrefix: usernamePrefix || undefined,
      description: USER_MAPPING_OPTIONS.find(opt => opt.type === selectedRelationship)?.description
    };

    onSelectionComplete(config);
  };

  const getIconComponent = (iconName: string) => {
    switch (iconName) {
      case 'ArrowRight':
        return ArrowRight;
      case 'GitBranch':
        return GitBranch;
      case 'GitMerge':
        return GitMerge;
      default:
        return ArrowRight;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          Choose User Mapping Relationship
        </h2>
        <p className="text-gray-600 max-w-3xl">
          Select how source users will be mapped to target users. This determines the migration 
          strategy and affects how user accounts, permissions, and data will be handled.
        </p>
      </div>

      {/* Relationship Options */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {USER_MAPPING_OPTIONS.map((option) => {
          const IconComponent = getIconComponent(option.icon);
          const isSelected = selectedRelationship === option.type;
          
          return (
            <div
              key={option.type}
              onClick={() => setSelectedRelationship(option.type)}
              className={`
                relative cursor-pointer rounded-lg border-2 p-6 transition-all duration-200 hover:shadow-md
                ${isSelected 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-200 bg-white hover:border-gray-300'
                }
              `}
            >
              {/* Selection Indicator */}
              {isSelected && (
                <div className="absolute top-4 right-4">
                  <CheckCircle className="h-5 w-5 text-blue-600" />
                </div>
              )}

              {/* Icon and Title */}
              <div className="flex items-center space-x-3 mb-3">
                <div className={`
                  p-2 rounded-lg
                  ${isSelected ? 'bg-blue-100' : 'bg-gray-100'}
                `}>
                  <IconComponent className={`
                    h-6 w-6
                    ${isSelected ? 'text-blue-600' : 'text-gray-600'}
                  `} />
                </div>
                <h3 className="text-lg font-medium text-gray-900">
                  {option.title}
                </h3>
              </div>

              {/* Description */}
              <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                {option.description}
              </p>

              {/* Example */}
              <div className="bg-gray-50 rounded-md p-3 mb-4">
                <p className="text-xs font-medium text-gray-700 mb-1">Example:</p>
                <p className="text-xs text-gray-600 font-mono">
                  {option.example}
                </p>
              </div>

              {/* Complexity Badge */}
              <div className="flex items-center justify-between">
                <span className={`
                  inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                  ${option.complexity === 'Low' 
                    ? 'bg-green-100 text-green-800' 
                    : option.complexity === 'Medium'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-red-100 text-red-800'
                  }
                `}>
                  {option.complexity} Complexity
                </span>
                <Clock className="h-4 w-4 text-gray-400" />
              </div>

              {/* Use Cases */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-xs font-medium text-gray-700 mb-2">Common Use Cases:</p>
                <ul className="space-y-1">
                  {option.useCases.slice(0, 2).map((useCase, index) => (
                    <li key={index} className="text-xs text-gray-600 flex items-start">
                      <span className="w-1 h-1 bg-gray-400 rounded-full mt-1.5 mr-2 flex-shrink-0"></span>
                      {useCase}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>

      {/* Configuration Section */}
      {selectedRelationship && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Mapping Configuration
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Mapping Strategy */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Mapping Strategy
              </label>
              <div className="space-y-2">
                {['automatic', 'manual', 'hybrid'].map((strategy) => (
                  <label key={strategy} className="flex items-center">
                    <input
                      type="radio"
                      name="mappingStrategy"
                      value={strategy}
                      checked={mappingStrategy === strategy}
                      onChange={(e) => setMappingStrategy(e.target.value as any)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="ml-3 text-sm text-gray-700 capitalize">
                      {strategy}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Conflict Resolution */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Conflict Resolution
              </label>
              <select
                value={conflictResolution}
                onChange={(e) => setConflictResolution(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="skip">Skip conflicting users</option>
                <option value="rename">Auto-rename with suffix</option>
                <option value="overwrite">Overwrite existing users</option>
                <option value="manual">Manual review required</option>
              </select>
            </div>

            {/* Username Preservation */}
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={preserveUsernames}
                  onChange={(e) => setPreserveUsernames(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-3 text-sm text-gray-700">
                  Preserve original usernames
                </span>
              </label>
            </div>

            {/* Username Transformations */}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username Prefix (optional)
                </label>
                <input
                  type="text"
                  value={usernamePrefix}
                  onChange={(e) => setUsernamePrefix(e.target.value)}
                  placeholder="e.g., migrated_"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username Suffix (optional)
                </label>
                <input
                  type="text"
                  value={usernameSuffix}
                  onChange={(e) => setUsernameSuffix(e.target.value)}
                  placeholder="e.g., _new"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Info Box */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-blue-900 mb-1">
                  Configuration Impact
                </h4>
                <p className="text-sm text-blue-700">
                  {selectedRelationship === 'one-to-one' && 
                    'This configuration will create a direct 1:1 mapping between source and target users. Usernames will be preserved unless transformations are specified.'
                  }
                  {selectedRelationship === 'one-to-many' && 
                    'This configuration allows each source user to be mapped to multiple target locations. Useful for creating backup accounts or role-based distribution.'
                  }
                  {selectedRelationship === 'many-to-one' && 
                    'This configuration consolidates multiple source users into single target users. Requires careful conflict resolution and may result in data merging.'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Continue Button */}
      <div className="flex justify-end">
        <button
          onClick={handleContinue}
          disabled={!selectedRelationship}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium flex items-center space-x-2"
        >
          <span>Continue with {selectedRelationship ? selectedRelationship.replace('-', '-to-') : 'Selection'}</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
