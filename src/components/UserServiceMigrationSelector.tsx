'use client';

import { useState, useEffect, memo, useCallback } from 'react';
import { 
  Users, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  ArrowRight,
  Target,
  Building,
  Shield,
  Mail,
  Database,
  Calendar,
  MessageSquare,
  HardDrive,
  Camera,
  CheckSquare,
  Square
} from 'lucide-react';

interface User {
  id: string;
  primaryEmail: string;
  name: {
    fullName: string;
    givenName: string;
    familyName: string;
  };
  isAdmin: boolean;
  suspended: boolean;
  lastLoginTime?: string;
  creationTime: string;
  orgUnitPath: string;
  customerId: string;
  sourceDomain?: string;
  targetDomain?: string;
  targetEmail?: string;
}

interface UserDomainMapping {
  user: User;
  targetDomain: string;
  targetEmail?: string;
}

interface ServiceType {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  enabled: boolean;
}

interface UserServiceSelection {
  sourceUser: User;
  targetMappings: UserDomainMapping[];
  selectedServices: string[];
  migrationPriority: 'high' | 'medium' | 'low';
}

interface UserServiceMigrationSelectorProps {
  userMappings: UserDomainMapping[];
  mappingType: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';
  onSelectionComplete?: (selections: UserServiceSelection[]) => void;
  defaultServices?: string[];
}

const AVAILABLE_SERVICES: ServiceType[] = [
  {
    id: 'gmail',
    name: 'Gmail',
    icon: Mail,
    description: 'Email messages, labels, and filters',
    enabled: true
  },
  {
    id: 'drive',
    name: 'Google Drive',
    icon: HardDrive,
    description: 'Files, folders, and sharing permissions',
    enabled: true
  },
  {
    id: 'calendar',
    name: 'Google Calendar',
    icon: Calendar,
    description: 'Events, meetings, and calendar settings',
    enabled: true
  },
  {
    id: 'contacts',
    name: 'Google Contacts',
    icon: Database,
    description: 'Contact information and groups',
    enabled: true
  },
  {
    id: 'chat',
    name: 'Google Chat',
    icon: MessageSquare,
    description: 'Chat history and room memberships',
    enabled: true
  },
  {
    id: 'photos',
    name: 'Google Photos',
    icon: Camera,
    description: 'Photos and albums (if accessible)',
    enabled: false // Usually requires special permissions
  }
];

export const UserServiceMigrationSelector = memo(function UserServiceMigrationSelector({
  userMappings,
  mappingType,
  onSelectionComplete,
  defaultServices = ['gmail', 'drive', 'calendar', 'contacts']
}: UserServiceMigrationSelectorProps) {
  const [userSelections, setUserSelections] = useState<UserServiceSelection[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [globalServices, setGlobalServices] = useState<Set<string>>(new Set(defaultServices));
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Group mappings by source user for one-to-many scenario
  const groupedMappings = useCallback(() => {
    const groups = new Map<string, UserDomainMapping[]>();
    
    userMappings.forEach(mapping => {
      const sourceUserId = mapping.user.id;
      if (!groups.has(sourceUserId)) {
        groups.set(sourceUserId, []);
      }
      groups.get(sourceUserId)!.push(mapping);
    });
    
    return Array.from(groups.entries()).map(([userId, mappings]) => ({
      sourceUser: mappings[0].user, // All mappings have the same source user
      targetMappings: mappings
    }));
  }, [userMappings]);

  // Initialize user selections
  useEffect(() => {
    const grouped = groupedMappings();
    const initialSelections: UserServiceSelection[] = grouped.map(({ sourceUser, targetMappings }) => ({
      sourceUser,
      targetMappings,
      selectedServices: [...defaultServices],
      migrationPriority: 'medium'
    }));
    
    setUserSelections(initialSelections);
    setSelectedUserIds(new Set(grouped.map(g => g.sourceUser.id)));
  }, [userMappings, mappingType, defaultServices, groupedMappings]);

  // Toggle user selection
  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  // Toggle service for a specific user
  const toggleUserService = (userId: string, serviceId: string) => {
    setUserSelections(prev => prev.map(selection => 
      selection.sourceUser.id === userId
        ? {
            ...selection,
            selectedServices: selection.selectedServices.includes(serviceId)
              ? selection.selectedServices.filter(s => s !== serviceId)
              : [...selection.selectedServices, serviceId]
          }
        : selection
    ));
  };

  // Toggle service globally for all users
  const toggleGlobalService = (serviceId: string) => {
    const isAdding = !globalServices.has(serviceId);
    
    setGlobalServices(prev => {
      const newSet = new Set(prev);
      if (isAdding) {
        newSet.add(serviceId);
      } else {
        newSet.delete(serviceId);
      }
      return newSet;
    });

    // Apply to all user selections
    setUserSelections(prev => prev.map(selection => ({
      ...selection,
      selectedServices: isAdding
        ? Array.from(new Set([...selection.selectedServices, serviceId]))
        : selection.selectedServices.filter(s => s !== serviceId)
    })));
  };

  // Update migration priority for a user
  const updateMigrationPriority = (userId: string, priority: 'high' | 'medium' | 'low') => {
    setUserSelections(prev => prev.map(selection => 
      selection.sourceUser.id === userId
        ? { ...selection, migrationPriority: priority }
        : selection
    ));
  };

  // Select all users
  const selectAllUsers = () => {
    setSelectedUserIds(new Set(userSelections.map(s => s.sourceUser.id)));
  };

  // Deselect all users
  const deselectAllUsers = () => {
    setSelectedUserIds(new Set());
  };

  // Get migration summary
  const getMigrationSummary = () => {
    const selectedSelections = userSelections.filter(s => selectedUserIds.has(s.sourceUser.id));
    const totalSourceUsers = selectedSelections.length;
    const totalTargetUsers = selectedSelections.reduce((sum, s) => sum + s.targetMappings.length, 0);
    const totalMigrations = selectedSelections.reduce((sum, s) => sum + s.selectedServices.length * s.targetMappings.length, 0);
    
    return {
      totalSourceUsers,
      totalTargetUsers,
      totalMigrations,
      selectedSelections
    };
  };

  // Handle migration start
  const handleStartMigration = () => {
    const summary = getMigrationSummary();
    if (onSelectionComplete) {
      onSelectionComplete(summary.selectedSelections);
    }
  };

  const summary = getMigrationSummary();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Service Migration Selection</h2>
            <p className="text-gray-600">
              Select users and services to migrate from source to target accounts
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              {showAdvanced ? 'Hide' : 'Show'} Advanced
            </button>
            <button
              onClick={handleStartMigration}
              disabled={selectedUserIds.size === 0}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                selectedUserIds.size > 0
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Start Migration ({summary.totalMigrations} operations)
            </button>
          </div>
        </div>

        {/* Migration Strategy Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-800 mb-2">
            Migration Strategy: {mappingType.replace('-', ' to ').toUpperCase()}
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="font-medium text-blue-900">Source Users:</span>
              <span className="text-blue-800 ml-2">{summary.totalSourceUsers}</span>
            </div>
            <div>
              <span className="font-medium text-blue-900">Target Users:</span>
              <span className="text-blue-800 ml-2">{summary.totalTargetUsers}</span>
            </div>
            <div>
              <span className="font-medium text-blue-900">Services:</span>
              <span className="text-blue-800 ml-2">{globalServices.size}</span>
            </div>
            <div>
              <span className="font-medium text-blue-900">Total Operations:</span>
              <span className="text-blue-800 ml-2">{summary.totalMigrations}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Global Service Selection */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Global Service Selection</h3>
            <p className="text-gray-600">Select services to migrate for all users</p>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={selectAllUsers}
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              Select All Users
            </button>
            <button
              onClick={deselectAllUsers}
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              Deselect All
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {AVAILABLE_SERVICES.filter(service => service.enabled).map(service => {
            const Icon = service.icon;
            const isSelected = globalServices.has(service.id);
            
            return (
              <button
                key={service.id}
                onClick={() => toggleGlobalService(service.id)}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-3 mb-2">
                  <Icon className={`h-6 w-6 ${isSelected ? 'text-blue-600' : 'text-gray-600'}`} />
                  <span className={`font-medium ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                    {service.name}
                  </span>
                  {isSelected ? (
                    <CheckSquare className="h-5 w-5 text-blue-600" />
                  ) : (
                    <Square className="h-5 w-5 text-gray-400" />
                  )}
                </div>
                <p className={`text-sm ${isSelected ? 'text-blue-700' : 'text-gray-600'}`}>
                  {service.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* User Selection List */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          User Migration Configuration ({userSelections.length} users)
        </h3>
        
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {userSelections.map((selection) => {
            const isSelected = selectedUserIds.has(selection.sourceUser.id);
            const isClonedUser = mappingType === 'one-to-many';
            const isMergedUser = mappingType === 'many-to-one' && selection.sourceUser.primaryEmail.includes(',');
            
            return (
              <div key={selection.sourceUser.id} className={`border rounded-lg p-4 ${
                isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
              }`}>
                {/* User Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => toggleUserSelection(selection.sourceUser.id)}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                      }`}
                    >
                      {isSelected && <CheckCircle className="h-3 w-3 text-white" />}
                    </button>
                    
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-medium text-gray-900">{selection.sourceUser.name.fullName}</h4>
                        {isClonedUser && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Clone to {selection.targetMappings.length} domains
                          </span>
                        )}
                        {isMergedUser && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                            Merged Account
                          </span>
                        )}
                        {selection.sourceUser.isAdmin && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            <Shield className="h-3 w-3 mr-1" />
                            Admin
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 flex items-center space-x-2">
                        <Mail className="h-4 w-4" />
                        <span>{selection.sourceUser.primaryEmail}</span>
                      </div>
                    </div>
                  </div>
                  
                  {showAdvanced && (
                    <select
                      value={selection.migrationPriority}
                      onChange={(e) => updateMigrationPriority(selection.sourceUser.id, e.target.value as 'high' | 'medium' | 'low')}
                      className="border border-gray-300 rounded px-2 py-1 text-sm"
                    >
                      <option value="high">High Priority</option>
                      <option value="medium">Medium Priority</option>
                      <option value="low">Low Priority</option>
                    </select>
                  )}
                </div>

                {/* Target Mappings */}
                <div className="mb-3">
                  <div className="flex items-center space-x-2 mb-2">
                    <ArrowRight className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-700">Target Users:</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 ml-6">
                    {selection.targetMappings.map((mapping, index) => (
                      <div key={`${mapping.targetDomain}-${index}`} className="flex items-center space-x-2 text-sm">
                        <Building className="h-4 w-4 text-blue-600" />
                        <span className="text-gray-900">{mapping.targetEmail}</span>
                        <span className="text-gray-500">({mapping.targetDomain})</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Service Selection for this user */}
                {isSelected && (
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-2">Services to migrate:</div>
                    <div className="flex flex-wrap gap-2 ml-6">
                      {AVAILABLE_SERVICES.filter(service => service.enabled).map(service => {
                        const Icon = service.icon;
                        const isServiceSelected = selection.selectedServices.includes(service.id);
                        
                        return (
                          <button
                            key={service.id}
                            onClick={() => toggleUserService(selection.sourceUser.id, service.id)}
                            className={`inline-flex items-center space-x-1 px-2 py-1 rounded text-xs ${
                              isServiceSelected
                                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                : 'bg-gray-100 text-gray-600 border border-gray-200'
                            }`}
                          >
                            <Icon className="h-3 w-3" />
                            <span>{service.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Migration Summary */}
      {summary.totalMigrations > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-center space-x-3 mb-4">
            <CheckCircle className="h-6 w-6 text-green-600" />
            <h3 className="text-lg font-semibold text-green-900">Migration Summary</h3>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{summary.totalSourceUsers}</div>
              <div className="text-green-700">Source Users</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{summary.totalTargetUsers}</div>
              <div className="text-blue-700">Target Users</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{globalServices.size}</div>
              <div className="text-purple-700">Services</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{summary.totalMigrations}</div>
              <div className="text-orange-700">Total Operations</div>
            </div>
          </div>
          
          {mappingType === 'one-to-many' && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <span className="font-medium text-yellow-900">Clone Migration Notice</span>
              </div>
              <p className="text-sm text-yellow-800 mt-1">
                Each source user will be migrated to {summary.totalTargetUsers / summary.totalSourceUsers} target domains. 
                Data will be duplicated across all target accounts.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

UserServiceMigrationSelector.displayName = 'UserServiceMigrationSelector';

export default UserServiceMigrationSelector;
