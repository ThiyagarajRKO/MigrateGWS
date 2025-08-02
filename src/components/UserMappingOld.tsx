'use client';

import { useState, useEffect, memo, useCallback } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  Download, 
  UserCheck, 
  UserX, 
  Mail, 
  Shield, 
  Calendar,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
  UserPlus,
  ArrowRight,
  Copy,
  MapPin,
  Plus,
  Minus,
  X,
  Clock
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
}

interface UserMapping {
  sourceUser: User;
  targetEmail: string;
  targetUser?: User;
  action: 'map' | 'clone' | 'skip';
  status: 'pending' | 'mapped' | 'cloned' | 'exists' | 'error';
  error?: string;
}

interface UserMappingError {
  type: 'general' | 'delegation' | 'mapping';
  title: string;
  message: string;
  details?: string[];
  actionRequired?: string;
  domain?: string;
  adminEmail?: string;
}

interface UserMappingProps {
  sourceDomain?: string;
  targetDomains?: string[];
  sourceAdminEmail?: string;
  targetAdminEmails?: {[domain: string]: string};
  onMappingComplete?: (mappings: UserMapping[]) => void;
  onComplete?: () => void;
}

export const UserMapping = memo(function UserMapping({ 
  sourceDomain = '', 
  targetDomains = [], 
  sourceAdminEmail = '',
  targetAdminEmails = {},
  onMappingComplete, 
  onComplete 
}: UserMappingProps) {
  const [sourceUsers, setSourceUsers] = useState<User[]>([]);
  const [userMappings, setUserMappings] = useState<UserMapping[]>([]);
  const [filteredMappings, setFilteredMappings] = useState<UserMapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<UserMappingError | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTargetDomain, setSelectedTargetDomain] = useState(targetDomains[0] || '');
  const [showFilters, setShowFilters] = useState(false);
  const [processingMappings, setProcessingMappings] = useState(false);
  
  // Filter states
  const [filterAction, setFilterAction] = useState<'all' | 'map' | 'clone' | 'skip'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'mapped' | 'cloned' | 'exists' | 'error'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'email' | 'action' | 'status'>('name');

  // Fetch source users automatically when component mounts with valid domain
  const fetchSourceUsers = useCallback(async () => {
    if (!sourceDomain) {
      setError({
        type: 'general',
        title: 'Missing Configuration',
        message: 'Source domain is required',
        details: ['Please provide a source domain in the general settings']
      });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        action: 'all-users',
        domain: sourceDomain,
        includeSuspended: 'false'
      });
      
      if (sourceAdminEmail) {
        params.append('adminEmail', sourceAdminEmail);
      }
      
      const response = await fetch(`/api/google-workspace?${params.toString()}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        setError({
          type: 'delegation',
          title: 'Error Fetching Source Users',
          message: errorData?.message || `Failed to fetch users from ${sourceDomain}`,
          details: errorData?.details,
          actionRequired: errorData?.actionRequired,
          domain: sourceDomain,
          adminEmail: sourceAdminEmail
        });
        return;
      }

      const data = await response.json();
      const users = data.users || [];
      setSourceUsers(users);
      
      // Initialize user mappings
      const initialMappings: UserMapping[] = users.map((user: User) => ({
        sourceUser: user,
        targetEmail: generateTargetEmail(user, selectedTargetDomain),
        action: 'map',
        status: 'pending'
      }));
      
      setUserMappings(initialMappings);
    } catch (err) {
      setError({
        type: 'general',
        title: 'Error Fetching Users',
        message: err instanceof Error ? err.message : 'Failed to fetch users'
      });
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  }, [sourceDomain, sourceAdminEmail, selectedTargetDomain]);

  // Generate target email based on source user and target domain
  const generateTargetEmail = (user: User, targetDomain: string): string => {
    const localPart = user.primaryEmail.split('@')[0];
    return `${localPart}@${targetDomain}`;
  };

  // Check if user exists in target domain
  const checkUserExistsInTarget = async (email: string, targetDomain: string): Promise<User | null> => {
    try {
      const adminEmail = targetAdminEmails[targetDomain];
      const params = new URLSearchParams({
        action: 'users',
        domain: targetDomain
      });
      
      if (adminEmail) {
        params.append('adminEmail', adminEmail);
      }
      
      const response = await fetch(`/api/google-workspace?${params.toString()}`);
      
      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const users = data.users || [];
      return users.find((user: User) => user.primaryEmail.toLowerCase() === email.toLowerCase()) || null;
    } catch (error) {
      console.error('Error checking user in target domain:', error);
      return null;
    }
  };

  // Check all mappings for existing users in target domains
  const checkExistingUsers = useCallback(async () => {
    if (userMappings.length === 0) return;
    
    setProcessingMappings(true);
    
    const updatedMappings = await Promise.all(
      userMappings.map(async (mapping) => {
        try {
          const existingUser = await checkUserExistsInTarget(mapping.targetEmail, selectedTargetDomain);
          
          if (existingUser) {
            return {
              ...mapping,
              targetUser: existingUser,
              action: 'map' as const,
              status: 'exists' as const
            };
          } else {
            return {
              ...mapping,
              action: 'clone' as const,
              status: 'pending' as const
            };
          }
        } catch (error) {
          return {
            ...mapping,
            status: 'error' as const,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      })
    );
    
    setUserMappings(updatedMappings);
    setProcessingMappings(false);
  }, [userMappings, selectedTargetDomain, targetAdminEmails]);

  // Apply filters
  const applyFilters = useCallback(() => {
    let filtered = [...userMappings];

    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(mapping => 
        mapping.sourceUser.name.fullName.toLowerCase().includes(search) ||
        mapping.sourceUser.primaryEmail.toLowerCase().includes(search) ||
        mapping.targetEmail.toLowerCase().includes(search)
      );
    }

    // Action filter
    if (filterAction !== 'all') {
      filtered = filtered.filter(mapping => mapping.action === filterAction);
    }

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(mapping => mapping.status === filterStatus);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.sourceUser.name.fullName.localeCompare(b.sourceUser.name.fullName);
        case 'email':
          return a.sourceUser.primaryEmail.localeCompare(b.sourceUser.primaryEmail);
        case 'action':
          return a.action.localeCompare(b.action);
        case 'status':
          return a.status.localeCompare(b.status);
        default:
          return 0;
      }
    });

    setFilteredMappings(filtered);
  }, [userMappings, searchTerm, filterAction, filterStatus, sortBy]);

  // Update mapping action
  const updateMappingAction = (index: number, action: 'map' | 'clone' | 'skip') => {
    const updatedMappings = [...userMappings];
    updatedMappings[index] = {
      ...updatedMappings[index],
      action,
      status: action === 'skip' ? 'pending' : updatedMappings[index].status
    };
    setUserMappings(updatedMappings);
  };

  // Update target email
  const updateTargetEmail = (index: number, email: string) => {
    const updatedMappings = [...userMappings];
    updatedMappings[index] = {
      ...updatedMappings[index],
      targetEmail: email,
      targetUser: undefined,
      status: 'pending'
    };
    setUserMappings(updatedMappings);
  };

  // Create user in target domain
  const createUserInTarget = async (mapping: UserMapping): Promise<User | null> => {
    try {
      const adminEmail = targetAdminEmails[selectedTargetDomain];
      
      const userData = {
        primaryEmail: mapping.targetEmail,
        name: {
          givenName: mapping.sourceUser.name.givenName,
          familyName: mapping.sourceUser.name.familyName
        },
        password: 'TempPassword123!', // Temporary password - user should change on first login
        changePasswordAtNextLogin: true
      };

      const response = await fetch('/api/google-workspace', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'create-user',
          data: {
            domain: selectedTargetDomain,
            adminEmail,
            userData
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create user: ${response.statusText}`);
      }

      const data = await response.json();
      return data.user;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  };

  // Process all mappings
  const processMappings = async () => {
    setProcessingMappings(true);
    
    const updatedMappings: UserMapping[] = await Promise.all(
      userMappings.map(async (mapping): Promise<UserMapping> => {
        if (mapping.action === 'skip') {
          return { ...mapping, status: 'pending' as const };
        }
        
        if (mapping.action === 'clone' && mapping.status === 'pending') {
          try {
            const newUser = await createUserInTarget(mapping);
            return {
              ...mapping,
              targetUser: newUser || undefined,
              status: 'cloned' as const
            };
          } catch (error) {
            return {
              ...mapping,
              status: 'error' as const,
              error: error instanceof Error ? error.message : 'Failed to clone user'
            };
          }
        }
        
        if (mapping.action === 'map') {
          return {
            ...mapping,
            status: 'mapped' as const
          };
        }
        
        return mapping;
      })
    );
    
    setUserMappings(updatedMappings);
    setProcessingMappings(false);
    
    if (onMappingComplete) {
      onMappingComplete(updatedMappings);
    }
  };

  // Effects
  useEffect(() => {
    if (sourceDomain) {
      fetchSourceUsers();
    }
  }, [sourceDomain, fetchSourceUsers]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  useEffect(() => {
    if (userMappings.length > 0) {
      checkExistingUsers();
    }
  }, [selectedTargetDomain]);

  // Get status badge
  const getStatusBadge = (status: UserMapping['status']) => {
    const badges = {
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
      mapped: { color: 'bg-blue-100 text-blue-800', icon: MapPin },
      cloned: { color: 'bg-green-100 text-green-800', icon: UserPlus },
      exists: { color: 'bg-purple-100 text-purple-800', icon: UserCheck },
      error: { color: 'bg-red-100 text-red-800', icon: AlertCircle }
    };
    
    const badge = badges[status];
    const Icon = badge.icon;
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="h-3 w-3 mr-1" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  // Get action badge
  const getActionBadge = (action: UserMapping['action']) => {
    const badges = {
      map: { color: 'bg-blue-100 text-blue-800', icon: ArrowRight },
      clone: { color: 'bg-green-100 text-green-800', icon: UserPlus },
      skip: { color: 'bg-gray-100 text-gray-800', icon: X }
    };
    
    const badge = badges[action];
    const Icon = badge.icon;
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="h-3 w-3 mr-1" />
        {action.charAt(0).toUpperCase() + action.slice(1)}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="flex items-center justify-center space-x-3">
          <RefreshCw className="h-6 w-6 text-blue-600 animate-spin" />
          <div>
            <h3 className="text-lg font-medium text-gray-900">Loading User Mapping</h3>
            <p className="text-gray-600">Fetching users from {sourceDomain}...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="flex items-center space-x-3 text-red-600 mb-4">
          <AlertCircle className="h-6 w-6" />
          <h3 className="text-lg font-medium">{error.title}</h3>
        </div>
        <p className="text-gray-700 mb-4">{error.message}</p>
        
        {error.details && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <ul className="list-disc list-inside space-y-1 text-sm text-red-700">
              {error.details.map((detail, index) => (
                <li key={index}>{detail}</li>
              ))}
            </ul>
          </div>
        )}
        
        <button
          onClick={fetchSourceUsers}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Users className="h-6 w-6 text-blue-600" />
              <div>
                <h3 className="text-lg font-medium text-gray-900">User Mapping</h3>
                <p className="text-sm text-gray-600">
                  Map users from {configSourceDomain || sourceDomain} to {selectedTargetDomain}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <select
                value={selectedTargetDomain}
                onChange={(e) => setSelectedTargetDomain(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {(configTargetDomains.length > 0 ? configTargetDomains : targetDomains).map(domain => (
                  <option key={domain} value={domain}>{domain}</option>
                ))}
              </select>
            
            <button
              onClick={checkExistingUsers}
              disabled={processingMappings}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Users className="h-6 w-6 text-blue-600" />
            <div>
              <h3 className="text-lg font-medium text-gray-900">User Mapping</h3>
              <p className="text-sm text-gray-600">
                Map users from {sourceDomain} to {selectedTargetDomain}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {targetDomains.length > 1 && (
              <select
                value={selectedTargetDomain}
                onChange={(e) => setSelectedTargetDomain(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {targetDomains.map((domain: string) => (
                  <option key={domain} value={domain}>{domain}</option>
                ))}
              </select>
            )}
            
            <button
              onClick={fetchSourceUsers}
              disabled={loading || !sourceDomain}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <div className="flex items-center space-x-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Loading...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <RefreshCw className="h-4 w-4" />
                  <span>Discover Users</span>
                </div>
              )}
            </button>
            
            <button
              onClick={checkExistingUsers}
              disabled={processingMappings || userMappings.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {processingMappings ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                'Check Existing'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="p-6 border-b border-gray-200 bg-gray-50">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-64">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
          >
            <Filter className="h-4 w-4" />
            <span>Filters</span>
          </button>
          
          <div className="text-sm text-gray-600">
            {filteredMappings.length} of {userMappings.length} users
          </div>
        </div>

        {/* Filter Options */}
        {showFilters && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Actions</option>
                <option value="map">Map</option>
                <option value="clone">Clone</option>
                <option value="skip">Skip</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="mapped">Mapped</option>
                <option value="cloned">Cloned</option>
                <option value="exists">Exists</option>
                <option value="error">Error</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="name">Name</option>
                <option value="email">Email</option>
                <option value="action">Action</option>
                <option value="status">Status</option>
              </select>
            </div>
          </div>
        )}
      </div>
      )}

      {/* User Mappings Table */}
      {!showConfiguration && (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Source User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Target Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Action
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Operations
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredMappings.map((mapping, index) => (
              <tr key={mapping.sourceUser.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10">
                      <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-700">
                          {mapping.sourceUser.name.givenName?.[0]}{mapping.sourceUser.name.familyName?.[0]}
                        </span>
                      </div>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {mapping.sourceUser.name.fullName}
                      </div>
                      <div className="text-sm text-gray-500">
                        {mapping.sourceUser.primaryEmail}
                      </div>
                    </div>
                  </div>
                </td>
                
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="email"
                    value={mapping.targetEmail}
                    onChange={(e) => updateTargetEmail(index, e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </td>
                
                <td className="px-6 py-4 whitespace-nowrap">
                  <select
                    value={mapping.action}
                    onChange={(e) => updateMappingAction(index, e.target.value as any)}
                    className="px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="map">Map</option>
                    <option value="clone">Clone</option>
                    <option value="skip">Skip</option>
                  </select>
                </td>
                
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(mapping.status)}
                  {mapping.error && (
                    <div className="text-xs text-red-600 mt-1">
                      {mapping.error}
                    </div>
                  )}
                </td>
                
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex items-center space-x-2">
                    {mapping.targetUser && (
                      <span title="User exists in target">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      </span>
                    )}
                    {mapping.action === 'clone' && !mapping.targetUser && (
                      <span title="Will be cloned">
                        <UserPlus className="h-4 w-4 text-blue-600" />
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {/* Footer Actions */}
      {!showConfiguration && (
      <div className="p-6 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>Total: {userMappings.length}</div>
              <div>Map: {userMappings.filter(m => m.action === 'map').length}</div>
              <div>Clone: {userMappings.filter(m => m.action === 'clone').length}</div>
              <div>Skip: {userMappings.filter(m => m.action === 'skip').length}</div>
              <div>Processed: {userMappings.filter(m => m.status !== 'pending').length}</div>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={processMappings}
              disabled={processingMappings}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center space-x-2"
            >
              {processingMappings ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              <span>Process Mappings</span>
            </button>
            
            {onComplete && (
              <button
                onClick={onComplete}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Continue
              </button>
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  );
});

export default UserMapping;
