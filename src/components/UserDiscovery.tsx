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
  EyeOff
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

interface UserDiscoveryError {
  type: 'general' | 'delegation';
  title: string;
  message: string;
  details?: string[];
  actionRequired?: string;
  domain?: string;
  adminEmail?: string;
}

interface UserDiscoveryProps {
  sourceDomain: string;
  targetDomain?: string;
  sourceAdminEmail?: string; // Add admin email prop
  onUsersSelected?: (users: User[]) => void;
  onComplete?: () => void;
}

export const UserDiscovery = memo(function UserDiscovery({ 
  sourceDomain, 
  targetDomain, 
  sourceAdminEmail,
  onUsersSelected, 
  onComplete 
}: UserDiscoveryProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<UserDiscoveryError | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  
  // Filter states
  const [filterAdmin, setFilterAdmin] = useState<'all' | 'admin' | 'non-admin'>('all');
  const [filterSuspended, setFilterSuspended] = useState<'all' | 'active' | 'suspended'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'email' | 'lastLogin' | 'created'>('name');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        action: 'users',
        domain: sourceDomain
      });
      
      // Add admin email if provided for service account authentication
      if (sourceAdminEmail) {
        params.append('adminEmail', sourceAdminEmail);
      }
      
      const response = await fetch(`/api/google-workspace?${params.toString()}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        if (errorData?.error === 'Domain-wide delegation not configured') {
          // Set detailed error for domain-wide delegation issues
          setError({
            type: 'delegation',
            title: 'Domain-wide Delegation Required',
            message: errorData.message,
            details: errorData.details,
            actionRequired: errorData.actionRequired,
            domain: errorData.domain,
            adminEmail: errorData.adminEmail
          });
        } else {
          setError({
            type: 'general',
            title: 'Error Fetching Users',
            message: errorData?.message || `Failed to fetch users: ${response.statusText}`
          });
        }
        return;
      }

      const data = await response.json();
      setUsers(data.users || []);
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
  }, [sourceDomain, sourceAdminEmail]);

  const applyFilters = useCallback(() => {
    let filtered = [...users];

    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(user => 
        user.name.fullName.toLowerCase().includes(search) ||
        user.primaryEmail.toLowerCase().includes(search) ||
        user.orgUnitPath.toLowerCase().includes(search)
      );
    }

    // Admin filter
    if (filterAdmin !== 'all') {
      filtered = filtered.filter(user => 
        filterAdmin === 'admin' ? user.isAdmin : !user.isAdmin
      );
    }

    // Suspended filter
    if (filterSuspended !== 'all') {
      filtered = filtered.filter(user => 
        filterSuspended === 'suspended' ? user.suspended : !user.suspended
      );
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.fullName.localeCompare(b.name.fullName);
        case 'email':
          return a.primaryEmail.localeCompare(b.primaryEmail);
        case 'lastLogin':
          return (b.lastLoginTime || '').localeCompare(a.lastLoginTime || '');
        case 'created':
          return new Date(b.creationTime).getTime() - new Date(a.creationTime).getTime();
        default:
          return 0;
      }
    });

    setFilteredUsers(filtered);
  }, [users, searchTerm, filterAdmin, filterSuspended, sortBy]);

  // Effects - must come after function definitions due to dependencies
  useEffect(() => {
    if (sourceDomain) {
      fetchUsers();
    }
  }, [sourceDomain, fetchUsers]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const toggleUserSelection = (userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
    
    if (onUsersSelected) {
      const selectedUsersList = users.filter(user => newSelected.has(user.id));
      onUsersSelected(selectedUsersList);
    }
  };

  const selectAllFiltered = () => {
    const allFilteredIds = new Set(filteredUsers.map(user => user.id));
    setSelectedUsers(allFilteredIds);
    
    if (onUsersSelected) {
      onUsersSelected(filteredUsers);
    }
  };

  const clearSelection = () => {
    setSelectedUsers(new Set());
    if (onUsersSelected) {
      onUsersSelected([]);
    }
  };

  const exportUserList = () => {
    const csvContent = [
      ['Email', 'Full Name', 'Organization Unit', 'Admin', 'Suspended', 'Last Login', 'Created'].join(','),
      ...filteredUsers.map(user => [
        user.primaryEmail,
        `"${user.name.fullName}"`,
        `"${user.orgUnitPath}"`,
        user.isAdmin ? 'Yes' : 'No',
        user.suspended ? 'Yes' : 'No',
        user.lastLoginTime ? new Date(user.lastLoginTime).toLocaleDateString() : 'Never',
        new Date(user.creationTime).toLocaleDateString()
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-${sourceDomain}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-8">
        <div className="flex items-center justify-center space-x-3">
          <RefreshCw className="h-6 w-6 text-blue-600 animate-spin" />
          <div>
            <h3 className="text-lg font-medium text-gray-900">Discovering Users</h3>
            <p className="text-gray-600">Fetching users from {sourceDomain}...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-8">
        <div className="flex items-center space-x-3 text-red-600 mb-4">
          <AlertCircle className="h-6 w-6" />
          <h3 className="text-lg font-medium">{error.title}</h3>
        </div>
        
        <div className="space-y-4">
          <p className="text-gray-600">{error.message}</p>
          
          {error.type === 'delegation' && error.details && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-medium text-yellow-800 mb-2">Setup Required:</h4>
              <ul className="list-disc list-inside space-y-1 text-yellow-700 text-sm">
                {error.details.map((detail, index) => (
                  <li key={index}>{detail}</li>
                ))}
              </ul>
              {error.actionRequired && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-blue-800 text-sm font-medium">{error.actionRequired}</p>
                </div>
              )}
            </div>
          )}
          
          {error.domain && error.adminEmail && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <p><strong>Domain:</strong> {error.domain}</p>
              <p><strong>Admin Email:</strong> {error.adminEmail}</p>
            </div>
          )}
        </div>
        
        <button
          onClick={fetchUsers}
          className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">User Discovery</h2>
              <p className="text-gray-600">Found {filteredUsers.length} users in {sourceDomain}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-lg transition-colors ${
                showFilters ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {showFilters ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
            <button
              onClick={exportUserList}
              className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Download className="h-5 w-5" />
            </button>
            <button
              onClick={fetchUsers}
              className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <RefreshCw className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <div className="relative">
                <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search users..."
                  className="pl-10 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Admin Status</label>
              <select
                value={filterAdmin}
                onChange={(e) => setFilterAdmin(e.target.value as any)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Users</option>
                <option value="admin">Admins Only</option>
                <option value="non-admin">Non-Admins Only</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Account Status</label>
              <select
                value={filterSuspended}
                onChange={(e) => setFilterSuspended(e.target.value as any)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Users</option>
                <option value="active">Active Only</option>
                <option value="suspended">Suspended Only</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="name">Name</option>
                <option value="email">Email</option>
                <option value="lastLogin">Last Login</option>
                <option value="created">Created Date</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Selection Controls */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">
              {selectedUsers.size} of {filteredUsers.length} users selected
            </span>
            <div className="flex space-x-2">
              <button
                onClick={selectAllFiltered}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Select All
              </button>
              <span className="text-gray-300">|</span>
              <button
                onClick={clearSelection}
                className="text-sm text-gray-600 hover:text-gray-700"
              >
                Clear All
              </button>
            </div>
          </div>
          
          {onComplete && (
            <button
              onClick={onComplete}
              disabled={selectedUsers.size === 0}
              className={`px-4 py-2 rounded-lg transition-colors ${
                selectedUsers.size > 0
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Continue with {selectedUsers.size} users
            </button>
          )}
        </div>
      </div>

      {/* User List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="max-h-96 overflow-y-auto">
          {filteredUsers.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Users Found</h3>
              <p className="text-gray-600">
                {searchTerm ? 'Try adjusting your search or filters.' : 'No users found in this domain.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className={`p-4 hover:bg-gray-50 transition-colors ${
                    selectedUsers.has(user.id) ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-center space-x-4">
                    <input
                      type="checkbox"
                      checked={selectedUsers.has(user.id)}
                      onChange={() => toggleUserSelection(user.id)}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <div>
                          <h4 className="font-medium text-gray-900">{user.name.fullName}</h4>
                          <div className="flex items-center space-x-4 text-sm text-gray-600">
                            <span className="flex items-center">
                              <Mail className="h-4 w-4 mr-1" />
                              {user.primaryEmail}
                            </span>
                            <span>{user.orgUnitPath}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {user.isAdmin && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          <Shield className="h-3 w-3 mr-1" />
                          Admin
                        </span>
                      )}
                      
                      {user.suspended ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <UserX className="h-3 w-3 mr-1" />
                          Suspended
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <UserCheck className="h-3 w-3 mr-1" />
                          Active
                        </span>
                      )}
                      
                      <div className="text-xs text-gray-500">
                        {user.lastLoginTime 
                          ? `Last: ${new Date(user.lastLoginTime).toLocaleDateString()}`
                          : 'Never logged in'
                        }
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

UserDiscovery.displayName = 'UserDiscovery';

export default UserDiscovery;
