'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Users, 
  Play, 
  Pause, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertCircle,
  Database,
  Mail,
  HardDrive,
  Calendar,
  Phone,
  MessageSquare,
  Image,
  FileText,
  Presentation,
  ArrowRight,
  Filter,
  Eye,
  Settings
} from 'lucide-react';

interface User {
  id: string;
  primaryEmail: string;
  name: {
    givenName: string;
    familyName: string;
    fullName: string;
  };
  isAdmin: boolean;
  suspended: boolean;
  orgUnitPath: string;
}

interface UserMapping {
  sourceUser: User;
  targetEmail: string;
  targetUser?: User;
  action: 'map' | 'clone' | 'skip';
  status: 'pending' | 'mapped' | 'cloned' | 'exists' | 'error';
}

interface UserMappingGroup {
  sourceUser: User;
  mappings: UserMapping[];
}

interface ServiceMigrationStatus {
  service: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  selectedUsers: number;
  processedUsers: number;
  completedUsers: number;
  failedUsers: number;
  progress: number;
  errors: string[];
  startTime?: string;
  estimatedCompletion?: string;
}

interface SelectedUserMigrationControllerProps {
  selectedUserMappings: UserMappingGroup[];
  selectedServices: string[];
  sourceAdminEmail: string;
  targetAdminEmail: string;
  onMigrationStart?: (config: any) => void;
  onMigrationComplete?: (results: any) => void;
  onUserSelectionChange?: (selectedMappings: UserMappingGroup[]) => void;
}

const serviceIcons: Record<string, any> = {
  gmail: Mail,
  drive: HardDrive,
  calendar: Calendar,
  contacts: Phone,
  chat: MessageSquare,
  photos: Image,
  forms: FileText,
  slides: Presentation
};

const serviceNames: Record<string, string> = {
  gmail: 'Gmail',
  drive: 'Google Drive',
  calendar: 'Calendar',
  contacts: 'Contacts',
  chat: 'Chat',
  photos: 'Photos',
  forms: 'Forms',
  slides: 'Slides'
};

export default function SelectedUserMigrationController({
  selectedUserMappings: initialSelectedMappings,
  selectedServices,
  sourceAdminEmail,
  targetAdminEmail,
  onMigrationStart,
  onMigrationComplete,
  onUserSelectionChange
}: SelectedUserMigrationControllerProps) {
  const [selectedMappings, setSelectedMappings] = useState<UserMappingGroup[]>(initialSelectedMappings);
  const [migrationStatus, setMigrationStatus] = useState<'idle' | 'running' | 'paused' | 'completed' | 'failed'>('idle');
  const [serviceStatuses, setServiceStatuses] = useState<Record<string, ServiceMigrationStatus>>({});
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(
    new Set(initialSelectedMappings.map(mapping => mapping.sourceUser.id))
  );
  const [showUserSelection, setShowUserSelection] = useState(false);
  const [migrationConfig, setMigrationConfig] = useState<any>(null);

  // Initialize service statuses
  useEffect(() => {
    const statuses: Record<string, ServiceMigrationStatus> = {};
    selectedServices.forEach(service => {
      statuses[service] = {
        service,
        status: 'pending',
        selectedUsers: selectedMappings.length,
        processedUsers: 0,
        completedUsers: 0,
        failedUsers: 0,
        progress: 0,
        errors: []
      };
    });
    setServiceStatuses(statuses);
  }, [selectedServices, selectedMappings.length]);

  // Update selected mappings when user selection changes
  const handleUserSelectionChange = useCallback((userId: string, isSelected: boolean) => {
    const newSelectedUsers = new Set(selectedUsers);
    
    if (isSelected) {
      newSelectedUsers.add(userId);
    } else {
      newSelectedUsers.delete(userId);
    }
    
    setSelectedUsers(newSelectedUsers);
    
    // Filter mappings to only include selected users
    const newSelectedMappings = initialSelectedMappings.filter(mapping => 
      newSelectedUsers.has(mapping.sourceUser.id)
    );
    
    setSelectedMappings(newSelectedMappings);
    
    // Update service statuses with new user count
    setServiceStatuses(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(service => {
        updated[service] = {
          ...updated[service],
          selectedUsers: newSelectedMappings.length
        };
      });
      return updated;
    });
    
    // Notify parent component
    onUserSelectionChange?.(newSelectedMappings);
  }, [selectedUsers, initialSelectedMappings, onUserSelectionChange]);

  // Select/deselect all users
  const handleSelectAll = useCallback((selectAll: boolean) => {
    const newSelectedUsers = selectAll 
      ? new Set(initialSelectedMappings.map(mapping => mapping.sourceUser.id))
      : new Set<string>();
    
    setSelectedUsers(newSelectedUsers);
    
    const newSelectedMappings = selectAll ? initialSelectedMappings : [];
    setSelectedMappings(newSelectedMappings);
    
    // Update service statuses
    setServiceStatuses(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(service => {
        updated[service] = {
          ...updated[service],
          selectedUsers: newSelectedMappings.length
        };
      });
      return updated;
    });
    
    onUserSelectionChange?.(newSelectedMappings);
  }, [initialSelectedMappings, onUserSelectionChange]);

  // Start migration for selected users only
  const startMigration = async () => {
    if (selectedMappings.length === 0) {
      alert('Please select at least one user for migration');
      return;
    }

    const config = {
      sourceAdminEmail,
      targetAdminEmail,
      userMappings: selectedMappings.flatMap(group => group.mappings),
      selectedUserIds: selectedMappings.map(mapping => mapping.sourceUser.id),
      services: selectedServices,
      migrationOptions: {
        includeLabels: true,
        includeFilters: true,
        includeSignature: true,
        batchSize: 50,
        concurrentBatches: 3
      },
      scenario: 'cross-tenant',
      domainMapping: 'one-to-one',
      realDataMode: true,
      dryRun: false
    };

    setMigrationConfig(config);
    setMigrationStatus('running');
    
    // Update service statuses to running
    setServiceStatuses(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(service => {
        updated[service] = {
          ...updated[service],
          status: 'running',
          startTime: new Date().toISOString()
        };
      });
      return updated;
    });

    onMigrationStart?.(config);

    // Simulate migration progress for selected services
    for (const service of selectedServices) {
      simulateServiceMigration(service);
    }
  };

  // Simulate migration progress for a service
  const simulateServiceMigration = async (service: string) => {
    const userCount = selectedMappings.length;
    let processedUsers = 0;
    let completedUsers = 0;
    
    while (processedUsers < userCount && migrationStatus === 'running') {
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
      
      processedUsers++;
      const success = Math.random() > 0.1; // 90% success rate
      
      if (success) {
        completedUsers++;
      }
      
      const progress = Math.round((processedUsers / userCount) * 100);
      
      setServiceStatuses(prev => ({
        ...prev,
        [service]: {
          ...prev[service],
          processedUsers,
          completedUsers,
          failedUsers: processedUsers - completedUsers,
          progress,
          status: processedUsers === userCount ? 'completed' : 'running'
        }
      }));
    }
  };

  // Pause migration
  const pauseMigration = () => {
    setMigrationStatus('paused');
    setServiceStatuses(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(service => {
        if (updated[service].status === 'running') {
          updated[service] = {
            ...updated[service],
            status: 'paused'
          };
        }
      });
      return updated;
    });
  };

  // Resume migration
  const resumeMigration = () => {
    setMigrationStatus('running');
    setServiceStatuses(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(service => {
        if (updated[service].status === 'paused') {
          updated[service] = {
            ...updated[service],
            status: 'running'
          };
        }
      });
      return updated;
    });
  };

  // Calculate overall progress
  const calculateOverallProgress = () => {
    if (Object.keys(serviceStatuses).length === 0) return 0;
    
    const totalProgress = Object.values(serviceStatuses).reduce((sum, status) => sum + status.progress, 0);
    return Math.round(totalProgress / Object.keys(serviceStatuses).length);
  };

  const overallProgress = calculateOverallProgress();
  const allServicesCompleted = Object.values(serviceStatuses).every(status => status.status === 'completed');

  // Check if migration is complete
  useEffect(() => {
    if (allServicesCompleted && migrationStatus === 'running') {
      setMigrationStatus('completed');
      onMigrationComplete?.({
        selectedUsers: selectedMappings.length,
        services: serviceStatuses,
        overallProgress: 100
      });
    }
  }, [allServicesCompleted, migrationStatus, selectedMappings.length, serviceStatuses, onMigrationComplete]);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Database className="h-6 w-6 mr-3 text-blue-600" />
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Selected User Migration Controller
            </h2>
            <p className="text-sm text-gray-600">
              Migrate services for {selectedMappings.length} selected users across {selectedServices.length} services
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowUserSelection(!showUserSelection)}
            className="flex items-center px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Eye className="h-4 w-4 mr-2" />
            {showUserSelection ? 'Hide' : 'Show'} User Selection
          </button>
          
          {migrationStatus === 'idle' && (
            <button
              onClick={startMigration}
              disabled={selectedMappings.length === 0}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Play className="h-4 w-4 mr-2" />
              Start Migration
            </button>
          )}
          
          {migrationStatus === 'running' && (
            <button
              onClick={pauseMigration}
              className="flex items-center px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
            >
              <Pause className="h-4 w-4 mr-2" />
              Pause
            </button>
          )}
          
          {migrationStatus === 'paused' && (
            <button
              onClick={resumeMigration}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Play className="h-4 w-4 mr-2" />
              Resume
            </button>
          )}
        </div>
      </div>

      {/* User Selection Panel */}
      {showUserSelection && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <Users className="h-5 w-5 mr-2" />
              User Selection ({selectedMappings.length}/{initialSelectedMappings.length} selected)
            </h3>
            
            <div className="flex space-x-2">
              <button
                onClick={() => handleSelectAll(true)}
                className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
              >
                Select All
              </button>
              <button
                onClick={() => handleSelectAll(false)}
                className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
              >
                Select None
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-60 overflow-y-auto">
            {initialSelectedMappings.map((mapping) => {
              const isSelected = selectedUsers.has(mapping.sourceUser.id);
              
              return (
                <div
                  key={mapping.sourceUser.id}
                  className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-blue-50 border-blue-200'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                  onClick={() => handleUserSelectionChange(mapping.sourceUser.id, !isSelected)}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => handleUserSelectionChange(mapping.sourceUser.id, e.target.checked)}
                    className="h-4 w-4 text-blue-600 rounded border-gray-300 mr-3"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {mapping.sourceUser.name.fullName}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {mapping.sourceUser.primaryEmail}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Overall Progress */}
      {migrationStatus !== 'idle' && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-medium text-gray-900">Overall Progress</h3>
            <span className="text-sm font-medium text-gray-900">{overallProgress}%</span>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
          
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-blue-600">{selectedMappings.length}</p>
              <p className="text-sm text-gray-600">Selected Users</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">
                {Object.values(serviceStatuses).reduce((sum, status) => sum + status.completedUsers, 0)}
              </p>
              <p className="text-sm text-gray-600">Completed</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-600">
                {Object.values(serviceStatuses).reduce((sum, status) => sum + (status.processedUsers - status.completedUsers), 0)}
              </p>
              <p className="text-sm text-gray-600">In Progress</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">
                {Object.values(serviceStatuses).reduce((sum, status) => sum + status.failedUsers, 0)}
              </p>
              <p className="text-sm text-gray-600">Failed</p>
            </div>
          </div>
        </div>
      )}

      {/* Service Progress */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900 flex items-center">
          <Settings className="h-5 w-5 mr-2" />
          Service Migration Progress
        </h3>
        
        {selectedServices.map((service) => {
          const status = serviceStatuses[service];
          const Icon = serviceIcons[service] || Database;
          
          if (!status) return null;
          
          return (
            <div key={service} className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                  <Icon className="h-5 w-5 mr-3 text-gray-600" />
                  <div>
                    <h4 className="font-medium text-gray-900">{serviceNames[service]}</h4>
                    <p className="text-sm text-gray-600">
                      {status.processedUsers}/{status.selectedUsers} users processed
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center">
                  {status.status === 'pending' && (
                    <Clock className="h-5 w-5 text-gray-400" />
                  )}
                  {status.status === 'running' && (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                  )}
                  {status.status === 'completed' && (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  )}
                  {status.status === 'failed' && (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                  {status.status === 'paused' && (
                    <Pause className="h-5 w-5 text-yellow-600" />
                  )}
                </div>
              </div>
              
              <div className="mb-2">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Progress</span>
                  <span className="font-medium">{status.progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      status.status === 'completed'
                        ? 'bg-green-600'
                        : status.status === 'failed'
                        ? 'bg-red-600'
                        : status.status === 'paused'
                        ? 'bg-yellow-600'
                        : 'bg-blue-600'
                    }`}
                    style={{ width: `${status.progress}%` }}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="text-center">
                  <p className="font-medium text-green-600">{status.completedUsers}</p>
                  <p className="text-gray-600">Completed</p>
                </div>
                <div className="text-center">
                  <p className="font-medium text-yellow-600">
                    {status.processedUsers - status.completedUsers - status.failedUsers}
                  </p>
                  <p className="text-gray-600">In Progress</p>
                </div>
                <div className="text-center">
                  <p className="font-medium text-red-600">{status.failedUsers}</p>
                  <p className="text-gray-600">Failed</p>
                </div>
              </div>
              
              {status.errors.length > 0 && (
                <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded">
                  <div className="flex items-center text-sm text-red-800">
                    <AlertCircle className="h-4 w-4 mr-2" />
                    <span className="font-medium">{status.errors.length} error(s)</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Migration Summary */}
      {migrationStatus === 'completed' && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center">
            <CheckCircle className="h-6 w-6 text-green-600 mr-3" />
            <div>
              <h3 className="text-lg font-semibold text-green-900">Migration Completed!</h3>
              <p className="text-sm text-green-700">
                Successfully migrated {selectedMappings.length} selected users across {selectedServices.length} services.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
