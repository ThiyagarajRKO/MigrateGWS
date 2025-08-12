'use client';

import { useState, useCallback, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  Plus, 
  Minus,
  Play,
  Pause,
  Settings,
  CheckCircle,
  AlertCircle,
  Clock,
  UserCheck,
  Package,
  Layers,
  Target,
  ArrowRight,
  FileText,
  Calendar,
  Database
} from 'lucide-react';

interface User {
  id: string;
  name: string;
  email: string;
  department?: string;
  role?: string;
  lastLogin?: string;
  storageUsed?: number;
  calendarCount?: number;
  eventCount?: number;
}

interface UserBatch {
  batchId: string;
  batchName: string;
  userMappings: Array<{
    sourceUserEmail: string;
    targetUserEmail: string;
  }>;
  priority: 'high' | 'medium' | 'low';
  scheduledStart?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

interface SelectionCriteria {
  departments?: string[];
  roles?: string[];
  emailPatterns?: string[];
  excludePatterns?: string[];
  storageUsedGt?: number;
  storageUsedLt?: number;
  calendarCountGt?: number;
  calendarCountLt?: number;
  eventCountGt?: number;
  eventCountLt?: number;
  lastLoginAfter?: string;
  lastLoginBefore?: string;
}

interface MultiUserSelectionManagerProps {
  discoveredUsers: User[];
  targetDomains: string[];
  onSelectionComplete: (selection: {
    mode: 'single' | 'multi' | 'batch' | 'criteria';
    userMappings?: Array<{ sourceUserEmail: string; targetUserEmail: string }>;
    userBatches?: UserBatch[];
    selectedUserIds?: string[];
    selectionCriteria?: SelectionCriteria;
  }) => void;
  supportedServices: string[];
}

export function MultiUserSelectionManager({ 
  discoveredUsers, 
  targetDomains, 
  onSelectionComplete,
  supportedServices 
}: MultiUserSelectionManagerProps) {
  const [selectionMode, setSelectionMode] = useState<'single' | 'multi' | 'batch' | 'criteria'>('multi');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [userBatches, setUserBatches] = useState<UserBatch[]>([]);
  const [selectionCriteria, setSelectionCriteria] = useState<SelectionCriteria>({});
  const [currentBatch, setCurrentBatch] = useState<Partial<UserBatch>>({});
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterRole, setFilterRole] = useState('');

  // Get unique departments and roles for filters
  const departments = Array.from(new Set(discoveredUsers.map(u => u.department).filter(Boolean)));
  const roles = Array.from(new Set(discoveredUsers.map(u => u.role).filter(Boolean)));

  // Filter users based on search and filters
  const filteredUsers = discoveredUsers.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDepartment = !filterDepartment || user.department === filterDepartment;
    const matchesRole = !filterRole || user.role === filterRole;
    
    return matchesSearch && matchesDepartment && matchesRole;
  });

  // Toggle user selection
  const toggleUserSelection = (userId: string) => {
    const newSelection = new Set(selectedUserIds);
    if (newSelection.has(userId)) {
      newSelection.delete(userId);
    } else {
      newSelection.add(userId);
    }
    setSelectedUserIds(newSelection);
  };

  // Select all filtered users
  const selectAllFiltered = () => {
    const newSelection = new Set(selectedUserIds);
    filteredUsers.forEach(user => newSelection.add(user.id));
    setSelectedUserIds(newSelection);
  };

  // Clear all selections
  const clearAllSelections = () => {
    setSelectedUserIds(new Set());
  };

  // Create batch from selected users
  const createBatchFromSelection = () => {
    if (selectedUserIds.size === 0) return;
    
    setCurrentBatch({
      batchId: `batch-${Date.now()}`,
      batchName: `Batch ${userBatches.length + 1}`,
      userMappings: Array.from(selectedUserIds).map(userId => {
        const user = discoveredUsers.find(u => u.id === userId)!;
        return {
          sourceUserEmail: user.email,
          targetUserEmail: `${user.email.split('@')[0]}@${targetDomains[0]}`
        };
      }),
      priority: 'medium' as const,
      status: 'pending' as const
    });
    setShowBatchModal(true);
  };

  // Save batch
  const saveBatch = () => {
    if (currentBatch.batchId && currentBatch.batchName && currentBatch.userMappings) {
      setUserBatches([...userBatches, currentBatch as UserBatch]);
      setCurrentBatch({});
      setSelectedUserIds(new Set());
      setShowBatchModal(false);
    }
  };

  // Delete batch
  const deleteBatch = (batchId: string) => {
    setUserBatches(userBatches.filter(b => b.batchId !== batchId));
  };

  // Complete selection
  const completeSelection = () => {
    let selection: any = { mode: selectionMode };

    switch (selectionMode) {
      case 'single':
        if (selectedUserIds.size === 1) {
          const user = discoveredUsers.find(u => u.id === Array.from(selectedUserIds)[0])!;
          selection.userMappings = [{
            sourceUserEmail: user.email,
            targetUserEmail: `${user.email.split('@')[0]}@${targetDomains[0]}`
          }];
        }
        break;
      case 'multi':
        selection.userMappings = Array.from(selectedUserIds).map(userId => {
          const user = discoveredUsers.find(u => u.id === userId)!;
          return {
            sourceUserEmail: user.email,
            targetUserEmail: `${user.email.split('@')[0]}@${targetDomains[0]}`
          };
        });
        break;
      case 'batch':
        selection.userBatches = userBatches;
        break;
      case 'criteria':
        selection.selectionCriteria = selectionCriteria;
        selection.selectedUserIds = Array.from(selectedUserIds);
        break;
    }

    onSelectionComplete(selection);
  };

  // Apply criteria-based selection
  const applyCriteriaSelection = () => {
    const newSelection = new Set<string>();
    
    discoveredUsers.forEach(user => {
      let matches = true;
      
      // Department filter
      if (selectionCriteria.departments?.length && !selectionCriteria.departments.includes(user.department || '')) {
        matches = false;
      }
      
      // Role filter
      if (selectionCriteria.roles?.length && !selectionCriteria.roles.includes(user.role || '')) {
        matches = false;
      }
      
      // Email pattern filter
      if (selectionCriteria.emailPatterns?.length) {
        const matchesPattern = selectionCriteria.emailPatterns.some(pattern => 
          user.email.includes(pattern)
        );
        if (!matchesPattern) matches = false;
      }
      
      // Exclude pattern filter
      if (selectionCriteria.excludePatterns?.length) {
        const matchesExclude = selectionCriteria.excludePatterns.some(pattern => 
          user.email.includes(pattern)
        );
        if (matchesExclude) matches = false;
      }
      
      // Storage filters
      if (selectionCriteria.storageUsedGt && (user.storageUsed || 0) <= selectionCriteria.storageUsedGt) {
        matches = false;
      }
      if (selectionCriteria.storageUsedLt && (user.storageUsed || 0) >= selectionCriteria.storageUsedLt) {
        matches = false;
      }
      
      // Calendar count filters
      if (selectionCriteria.calendarCountGt && (user.calendarCount || 0) <= selectionCriteria.calendarCountGt) {
        matches = false;
      }
      if (selectionCriteria.calendarCountLt && (user.calendarCount || 0) >= selectionCriteria.calendarCountLt) {
        matches = false;
      }
      
      if (matches) {
        newSelection.add(user.id);
      }
    });
    
    setSelectedUserIds(newSelection);
  };

  return (
    <div className="space-y-6">
      {/* Selection Mode Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'multi', label: 'Multi-User Selection', icon: Users },
            { id: 'batch', label: 'Batch Processing', icon: Layers },
            { id: 'criteria', label: 'Criteria-Based', icon: Filter }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectionMode(tab.id as any)}
              className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm ${
                selectionMode === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-5 w-5" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Search and Filters */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <select
            value={filterDepartment}
            onChange={(e) => setFilterDepartment(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Departments</option>
            {departments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
          
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Roles</option>
            {roles.map(role => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
          
          <div className="flex gap-2">
            <button
              onClick={selectAllFiltered}
              className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              Select All
            </button>
            <button
              onClick={clearAllSelections}
              className="flex-1 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
            >
              Clear All
            </button>
          </div>
        </div>
      </div>

      {/* Mode-specific content */}
      {selectionMode === 'criteria' && (
        <div className="bg-blue-50 rounded-lg p-4 space-y-4">
          <h3 className="text-lg font-semibold text-blue-900">Criteria-Based Selection</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Patterns (include)
              </label>
              <input
                type="text"
                placeholder="admin, manager, @specific-domain.com"
                value={selectionCriteria.emailPatterns?.join(', ') || ''}
                onChange={(e) => setSelectionCriteria({
                  ...selectionCriteria,
                  emailPatterns: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Storage Used (GB) - Greater than
              </label>
              <input
                type="number"
                placeholder="5"
                value={selectionCriteria.storageUsedGt || ''}
                onChange={(e) => setSelectionCriteria({
                  ...selectionCriteria,
                  storageUsedGt: e.target.value ? Number(e.target.value) : undefined
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Calendar Count - Greater than
              </label>
              <input
                type="number"
                placeholder="3"
                value={selectionCriteria.calendarCountGt || ''}
                onChange={(e) => setSelectionCriteria({
                  ...selectionCriteria,
                  calendarCountGt: e.target.value ? Number(e.target.value) : undefined
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Event Count - Greater than
              </label>
              <input
                type="number"
                placeholder="100"
                value={selectionCriteria.eventCountGt || ''}
                onChange={(e) => setSelectionCriteria({
                  ...selectionCriteria,
                  eventCountGt: e.target.value ? Number(e.target.value) : undefined
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>
          
          <button
            onClick={applyCriteriaSelection}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Apply Criteria Selection
          </button>
        </div>
      )}

      {selectionMode === 'batch' && (
        <div className="space-y-4">
          {/* Batch Management */}
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Batch Management</h3>
            <button
              onClick={createBatchFromSelection}
              disabled={selectedUserIds.size === 0}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300"
            >
              <Plus className="h-4 w-4" />
              Create Batch from Selection ({selectedUserIds.size})
            </button>
          </div>
          
          {/* Existing Batches */}
          <div className="space-y-3">
            {userBatches.map((batch) => (
              <div key={batch.batchId} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-gray-900">{batch.batchName}</h4>
                    <p className="text-sm text-gray-600">
                      {batch.userMappings.length} users • Priority: {batch.priority}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-500">
                        Status: {batch.status}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteBatch(batch.batchId)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <Minus className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* User List */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-semibold">
            Users ({filteredUsers.length}) • Selected ({selectedUserIds.size})
          </h3>
          {selectedUserIds.size > 0 && (
            <div className="text-sm text-gray-600">
              {Array.from(selectedUserIds).slice(0, 3).map(id => {
                const user = discoveredUsers.find(u => u.id === id);
                return user?.name;
              }).join(', ')}
              {selectedUserIds.size > 3 && ` and ${selectedUserIds.size - 3} more`}
            </div>
          )}
        </div>
        
        <div className="max-h-96 overflow-y-auto">
          {filteredUsers.map((user) => (
            <div
              key={user.id}
              className={`flex items-center justify-between p-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${
                selectedUserIds.has(user.id) ? 'bg-blue-50 border-blue-200' : ''
              }`}
            >
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={selectedUserIds.has(user.id)}
                  onChange={() => toggleUserSelection(user.id)}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <div>
                  <h4 className="font-medium text-gray-900">{user.name}</h4>
                  <p className="text-sm text-gray-600">{user.email}</p>
                  {user.department && (
                    <span className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded mt-1">
                      {user.department}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="text-right text-sm text-gray-500">
                {user.storageUsed && (
                  <div className="flex items-center gap-1">
                    <Database className="h-4 w-4" />
                    {user.storageUsed}GB
                  </div>
                )}
                {user.calendarCount && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {user.calendarCount} calendars
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-600">
          Supported Services: {supportedServices.join(', ')}
        </div>
        
        <button
          onClick={completeSelection}
          disabled={
            (selectionMode === 'single' && selectedUserIds.size !== 1) ||
            (selectionMode === 'multi' && selectedUserIds.size === 0) ||
            (selectionMode === 'batch' && userBatches.length === 0) ||
            (selectionMode === 'criteria' && Object.keys(selectionCriteria).length === 0)
          }
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 flex items-center gap-2"
        >
          <ArrowRight className="h-4 w-4" />
          Proceed with {selectionMode === 'single' ? '1 User' : 
                        selectionMode === 'multi' ? `${selectedUserIds.size} Users` :
                        selectionMode === 'batch' ? `${userBatches.length} Batches` :
                        'Criteria Selection'}
        </button>
      </div>

      {/* Batch Creation Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Create New Batch</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Batch Name
                </label>
                <input
                  type="text"
                  value={currentBatch.batchName || ''}
                  onChange={(e) => setCurrentBatch({ ...currentBatch, batchName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <select
                  value={currentBatch.priority || 'medium'}
                  onChange={(e) => setCurrentBatch({ ...currentBatch, priority: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="high">High Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="low">Low Priority</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Scheduled Start (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={currentBatch.scheduledStart || ''}
                  onChange={(e) => setCurrentBatch({ ...currentBatch, scheduledStart: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              
              <div className="text-sm text-gray-600">
                This batch will include {selectedUserIds.size} users
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowBatchModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={saveBatch}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create Batch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MultiUserSelectionManager;
