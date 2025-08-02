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
    givenName: string;
    familyName: string;
    fullName: string;
  };
  isAdmin: boolean;
  isDelegatedAdmin: boolean;
  lastLoginTime?: string;
  creationTime: string;
  suspended: boolean;
  orgUnitPath: string;
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
  targetAdminEmails?: { [domain: string]: string };
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
      
      // Create initial user mappings
      const mappings: UserMapping[] = users.map((user: User) => {
        const targetEmail = user.primaryEmail.replace(`@${sourceDomain}`, `@${selectedTargetDomain}`);
        return {
          sourceUser: user,
          targetEmail,
          action: 'clone' as const,
          status: 'pending' as const
        };
      });
      
      setUserMappings(mappings);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching source users:', error);
      setError({
        type: 'general',
        title: 'Network Error',
        message: 'Failed to fetch users from source domain',
        details: [error instanceof Error ? error.message : 'Unknown error occurred']
      });
      setLoading(false);
    }
  }, [sourceDomain, sourceAdminEmail, selectedTargetDomain]);

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
      filtered = filtered.filter(mapping => 
        mapping.sourceUser.primaryEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mapping.sourceUser.name.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mapping.targetEmail.toLowerCase().includes(searchTerm.toLowerCase())
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

  // Effects
  useEffect(() => {
    if (sourceDomain && targetDomains.length > 0) {
      setSelectedTargetDomain(targetDomains[0]);
    }
  }, [sourceDomain, targetDomains]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  // Auto-fetch users when component mounts with valid configuration
  useEffect(() => {
    if (sourceDomain && targetDomains.length > 0 && sourceUsers.length === 0) {
      fetchSourceUsers();
    }
  }, [sourceDomain, targetDomains, sourceUsers.length, fetchSourceUsers]);

  // Update mappings when target domain changes
  useEffect(() => {
    if (sourceUsers.length > 0 && selectedTargetDomain) {
      const updatedMappings = sourceUsers.map((user: User) => {
        const targetEmail = user.primaryEmail.replace(`@${sourceDomain}`, `@${selectedTargetDomain}`);
        const existingMapping = userMappings.find(m => m.sourceUser.id === user.id);
        return {
          sourceUser: user,
          targetEmail,
          action: existingMapping?.action || ('clone' as const),
          status: existingMapping?.status || ('pending' as const),
          targetUser: existingMapping?.targetUser,
          error: existingMapping?.error
        };
      });
      setUserMappings(updatedMappings);
    }
  }, [selectedTargetDomain, sourceUsers, sourceDomain]);

  // Call onMappingComplete when mappings change
  useEffect(() => {
    if (onMappingComplete && userMappings.length > 0) {
      onMappingComplete(userMappings);
    }
  }, [userMappings, onMappingComplete]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="flex items-center justify-center space-x-3">
          <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
          <span className="text-gray-600">Discovering users from {sourceDomain}...</span>
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

  if (!sourceDomain || targetDomains.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="text-center">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Configuration Required</h3>
          <p className="text-gray-600">
            Please configure your source domain and target domains in the General settings tab first.
          </p>
        </div>
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
            className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Filter className="h-4 w-4" />
            <span>Filters</span>
          </button>
          
          <div className="text-sm text-gray-600">
            {filteredMappings.length} of {userMappings.length} users
          </div>
        </div>
        
        {showFilters && (
          <div className="mt-4 flex flex-wrap gap-4">
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Actions</option>
              <option value="map">Map</option>
              <option value="clone">Clone</option>
              <option value="skip">Skip</option>
            </select>
            
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="mapped">Mapped</option>
              <option value="cloned">Cloned</option>
              <option value="exists">Exists</option>
              <option value="error">Error</option>
            </select>
            
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="name">Sort by Name</option>
              <option value="email">Sort by Email</option>
              <option value="action">Sort by Action</option>
              <option value="status">Sort by Status</option>
            </select>
          </div>
        )}
      </div>

      {/* User Mappings Table */}
      {filteredMappings.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
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
                  Target Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredMappings.map((mapping, index) => (
                <tr key={mapping.sourceUser.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <span className="text-sm font-medium text-blue-600">
                            {mapping.sourceUser.name.givenName.charAt(0)}
                            {mapping.sourceUser.name.familyName.charAt(0)}
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
                      onChange={(e) => updateTargetEmail(userMappings.indexOf(mapping), e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <select
                      value={mapping.action}
                      onChange={(e) => updateMappingAction(userMappings.indexOf(mapping), e.target.value as any)}
                      className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="map">Map</option>
                      <option value="clone">Clone</option>
                      <option value="skip">Skip</option>
                    </select>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      mapping.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      mapping.status === 'mapped' ? 'bg-blue-100 text-blue-800' :
                      mapping.status === 'cloned' ? 'bg-green-100 text-green-800' :
                      mapping.status === 'exists' ? 'bg-gray-100 text-gray-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {mapping.status}
                    </span>
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
      ) : (
        <div className="p-8 text-center">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Users Found</h3>
          <p className="text-gray-600">
            {userMappings.length === 0 
              ? "Click 'Discover Users' to load users from the source domain"
              : "No users match your current filters"
            }
          </p>
        </div>
      )}
    </div>
  );
});

export default UserMapping;
