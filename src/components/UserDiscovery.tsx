'use client';

import { useState, useEffect, memo, useCallback, useRef, useMemo } from 'react';
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
  ArrowRight,
  Target,
  X
} from 'lucide-react';
import UserMappingWithCreation from './UserMappingWithCreation';

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
  sourceDomain?: string; // Track which domain this user came from
  targetDomain?: string; // Track which target domain this user is mapped to
  targetEmail?: string; // Track custom target email if specified
}

interface UserDomainMapping {
  user: User;
  targetDomain: string;
  targetEmail?: string; // Optional custom target email
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
  sourceDomain?: string; // Single source domain (for backward compatibility)
  sourceDomains?: string[]; // Multiple source domains
  targetDomain?: string; // Single target domain (for backward compatibility)
  targetDomains?: string[]; // Multiple target domains
  sourceAdminEmail?: string; // Single admin email (for backward compatibility)
  sourceAdminEmails?: {[domain: string]: string}; // Multiple admin emails by domain
  targetAdminEmails?: {[domain: string]: string}; // Target admin emails for user creation
  mappingType?: 'one-to-one' | 'one-to-many' | 'many-to-one'; // Domain mapping type
  onUsersSelected?: (users: User[]) => void;
  onUserMappingChange?: (userMappings: UserDomainMapping[]) => void; // New callback for user mappings
  onTargetUserCreationRequired?: (mappings: UserDomainMapping[]) => void; // New callback for target user creation
  onComplete?: () => void;
  enableTargetUserCreation?: boolean; // Enable integrated target user creation
}

export const UserDiscovery = memo(function UserDiscovery({ 
  sourceDomain, 
  sourceDomains,
  targetDomain,
  targetDomains,
  sourceAdminEmail,
  sourceAdminEmails,
  targetAdminEmails,
  mappingType,
  onUsersSelected, 
  onUserMappingChange,
  onTargetUserCreationRequired,
  onComplete,
  enableTargetUserCreation = false
}: UserDiscoveryProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<UserDiscoveryError | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [domainProgress, setDomainProgress] = useState<{[domain: string]: {loading: boolean, users: User[], error?: string}}>({});
  const [userMappings, setUserMappings] = useState<{[userId: string]: UserDomainMapping}>({});
  const [showMappingView, setShowMappingView] = useState(false);
  const [showAdvancedMapping, setShowAdvancedMapping] = useState(false);
  const [targetUserCreationEnabled, setTargetUserCreationEnabled] = useState(enableTargetUserCreation);
  const [pendingUserCreation, setPendingUserCreation] = useState<UserDomainMapping[]>([]);
  
  // Track last fetch configuration to prevent unnecessary refetches
  const lastFetchConfig = useRef<string>('');
  const isFetching = useRef<boolean>(false);
  
  // Helper function to get domains to process
  const getDomainsToProcess = useCallback((): string[] => {
    if (sourceDomains && sourceDomains.length > 0) {
      return sourceDomains;
    }
    if (sourceDomain) {
      return [sourceDomain];
    }
    return [];
  }, [sourceDomains, sourceDomain]);

  // Helper function to get admin email for a domain
  const getAdminEmailForDomain = useCallback((domain: string): string => {
    if (sourceAdminEmails && sourceAdminEmails[domain]) {
      return sourceAdminEmails[domain];
    }
    return sourceAdminEmail || '';
  }, [sourceAdminEmails, sourceAdminEmail]);

  // Helper function to get target domains to process
  const getTargetDomainsToProcess = useCallback((): string[] => {
    if (targetDomains && targetDomains.length > 0) {
      return targetDomains;
    }
    if (targetDomain) {
      return [targetDomain];
    }
    return [];
  }, [targetDomains, targetDomain]);

  // Helper function to determine if mapping is required
  const isMappingRequired = useCallback((): boolean => {
    const sourceCount = getDomainsToProcess().length;
    const targetCount = getTargetDomainsToProcess().length;
    return targetCount > 1 || (sourceCount > 1 && targetCount >= 1) || mappingType !== 'one-to-one';
  }, [getDomainsToProcess, getTargetDomainsToProcess, mappingType]);
  
  // Filter states
  const [filterAdmin, setFilterAdmin] = useState<'all' | 'admin' | 'non-admin'>('all');
  const [filterSuspended, setFilterSuspended] = useState<'all' | 'active' | 'suspended'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'email' | 'lastLogin' | 'created'>('name');

  const fetchUsers = useCallback(async () => {
    const domainsToProcess = getDomainsToProcess();
    
    if (domainsToProcess.length === 0) {
      setError({
        type: 'general',
        title: 'No Source Domain',
        message: 'Please provide at least one source domain to discover users from.'
      });
      return;
    }

    // Prevent multiple simultaneous fetches
    if (isFetching.current) {
      console.log('[UserDiscovery] Fetch already in progress, skipping...');
      return;
    }

    isFetching.current = true;
    setLoading(true);
    setError(null);
    setDomainProgress({});

    try {
      // Initialize progress tracking for each domain
      const initialProgress: {[domain: string]: {loading: boolean, users: User[], error?: string}} = {};
      domainsToProcess.forEach(domain => {
        initialProgress[domain] = { loading: true, users: [] };
      });
      setDomainProgress(initialProgress);

      // Fetch users from all domains concurrently with performance optimizations
      const fetchPromises = domainsToProcess.map(async (domain, index) => {
        try {
          // Add small delay between requests to prevent rate limiting
          if (index > 0) {
            await new Promise(resolve => setTimeout(resolve, 100 * index));
          }

          const params = new URLSearchParams({
            action: 'users',
            domain: domain,
            maxResults: '150' // Increased batch size for better performance
          });
          
          // Add admin email for this specific domain
          const adminEmail = getAdminEmailForDomain(domain);
          console.log('[UserDiscovery] Fetching users for domain:', domain, 'with admin email:', adminEmail ? '***@' + adminEmail.split('@')[1] : 'MISSING');
          
          if (adminEmail) {
            params.append('adminEmail', adminEmail);
          } else {
            throw new Error(`No admin email provided for domain: ${domain}`);
          }
          
          const startTime = Date.now();
          const response = await fetch(`/api/google-workspace?${params.toString()}`, {
            headers: {
              'Cache-Control': 'max-age=120', // Allow caching for 2 minutes
            }
          });
          const fetchTime = Date.now() - startTime;
          
          console.log(`[UserDiscovery] Fetch time for ${domain}: ${fetchTime}ms`);
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            const errorMessage = errorData?.message || `Failed to fetch users from ${domain}: ${response.statusText}`;
            
            // Update progress for this domain with error
            setDomainProgress(prev => ({
              ...prev,
              [domain]: {
                ...prev[domain],
                loading: false,
                error: errorMessage
              }
            }));

            if (errorData?.error === 'Domain-wide delegation not configured') {
              throw {
                type: 'delegation',
                title: 'Domain-wide Delegation Required',
                message: errorData.message,
                details: errorData.details,
                actionRequired: errorData.actionRequired,
                domain: errorData.domain,
                adminEmail: errorData.adminEmail
              };
            } else {
              throw new Error(errorMessage);
            }
          }

          const data = await response.json();
          const domainUsers = (data.users || []).map((user: any) => ({
            ...user,
            sourceDomain: domain // Add source domain to each user
          }));

          console.log(`[UserDiscovery] Successfully fetched ${domainUsers.length} users from ${domain} ${data.cached ? '(cached)' : '(fresh)'}`);

          // Update progress for this domain with success
          setDomainProgress(prev => ({
            ...prev,
            [domain]: {
              ...prev[domain],
              loading: false,
              users: domainUsers
            }
          }));

          return { domain, users: domainUsers, success: true };
        } catch (error: any) {
          // Update progress for this domain with error
          setDomainProgress(prev => ({
            ...prev,
            [domain]: {
              ...prev[domain],
              loading: false,
              error: error.message || `Failed to fetch users from ${domain}`
            }
          }));

          return { domain, error, success: false };
        }
      });

      const results = await Promise.allSettled(fetchPromises);
      
      // Collect all users and errors
      const allUsers: User[] = [];
      const errors: string[] = [];
      let delegationError: any = null;

      results.forEach((result, index) => {
        const domain = domainsToProcess[index];
        
        if (result.status === 'fulfilled') {
          const { users, error, success } = result.value;
          if (success && users) {
            allUsers.push(...users);
          } else if (error) {
            if (error.type === 'delegation') {
              delegationError = error;
            } else {
              errors.push(`${domain}: ${error.message || error}`);
            }
          }
        } else {
          errors.push(`${domain}: ${result.reason?.message || result.reason}`);
        }
      });

      if (delegationError) {
        setError(delegationError);
        return;
      }

      if (allUsers.length === 0 && errors.length > 0) {
        setError({
          type: 'general',
          title: 'Failed to Fetch Users',
          message: `Could not fetch users from any domain:\n${errors.join('\n')}`
        });
        return;
      }

      // Set all discovered users
      setUsers(allUsers);
      
      // Auto-select all users initially
      const userIds = new Set(allUsers.map(user => user.id));
      setSelectedUsers(userIds);

    } catch (error: any) {
      console.error('Error fetching users:', error);
      setError({
        type: error.type || 'general',
        title: error.title || 'Error Fetching Users',
        message: error.message || 'An unexpected error occurred while fetching users.',
        details: error.details,
        actionRequired: error.actionRequired,
        domain: error.domain,
        adminEmail: error.adminEmail
      });
    } finally {
      setLoading(false);
      isFetching.current = false;
    }
  }, [getDomainsToProcess, getAdminEmailForDomain]);

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
    const domainsToProcess = getDomainsToProcess();
    if (domainsToProcess.length === 0) return;
    
    // Create a configuration hash to prevent unnecessary refetches
    const configHash = JSON.stringify({
      domains: domainsToProcess.sort(),
      adminEmails: domainsToProcess.reduce((acc, domain) => {
        acc[domain] = getAdminEmailForDomain(domain);
        return acc;
      }, {} as {[key: string]: string})
    });
    
    // Only fetch if configuration has changed
    if (configHash !== lastFetchConfig.current) {
      lastFetchConfig.current = configHash;
      fetchUsers();
    }
  }, [sourceDomain, sourceDomains, sourceAdminEmail, sourceAdminEmails, fetchUsers, getDomainsToProcess, getAdminEmailForDomain]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  // Memoize domains to process for other uses
  const domainsToProcess = useMemo(() => getDomainsToProcess(), [getDomainsToProcess]);

  // Memoize target domains for other uses
  const targetDomainsToProcess = useMemo(() => getTargetDomainsToProcess(), [getTargetDomainsToProcess]);

  // Auto-assign users to target domains based on mapping type
  const autoAssignUserMappings = useCallback((users: User[]) => {
    const targetDomains = getTargetDomainsToProcess();
    if (targetDomains.length === 0) return;

    const newMappings: {[userId: string]: UserDomainMapping} = {};

    users.forEach((user, index) => {
      let targetDomain: string;
      
      switch (mappingType) {
        case 'one-to-one':
          // Map to single target domain if available
          targetDomain = targetDomains[0] || targetDomains[0];
          break;
        case 'one-to-many':
          // Round-robin distribution across target domains
          targetDomain = targetDomains[index % targetDomains.length];
          break;
        case 'many-to-one':
          // All users go to the first target domain
          targetDomain = targetDomains[0];
          break;

        default:
          targetDomain = targetDomains[0];
      }

      newMappings[user.id] = {
        user,
        targetDomain,
        targetEmail: `${user.primaryEmail.split('@')[0]}@${targetDomain}`
      };
    });

    setUserMappings(newMappings);
    
    // Notify parent component of mapping changes
    if (onUserMappingChange) {
      onUserMappingChange(Object.values(newMappings));
    }
  }, [mappingType, getTargetDomainsToProcess, domainsToProcess, onUserMappingChange]);

  // Notify parent when users are initially loaded and handle auto-mapping
  useEffect(() => {
    if (users.length > 0) {
      if (onUsersSelected) {
        onUsersSelected(users);
      }
      
      // Auto-assign mappings if target domains are available
      if (isMappingRequired()) {
        autoAssignUserMappings(users);
      }
    }
  }, [users, onUsersSelected, isMappingRequired, autoAssignUserMappings]);

  // Memoize the domains display text
  const domainsDisplayText = useMemo(() => {
    const sourceCount = domainsToProcess.length;
    const targetCount = targetDomainsToProcess.length;
    
    let sourceText = sourceCount === 1 
      ? `${filteredUsers.length} users in ${domainsToProcess[0]}`
      : `${filteredUsers.length} users across ${sourceCount} domains`;
    
    if (targetCount > 0) {
      const targetText = targetCount === 1 
        ? targetDomainsToProcess[0]
        : `${targetCount} target domains`;
      return `${sourceText} → ${targetText}`;
    }
    
    return sourceText;
  }, [filteredUsers.length, domainsToProcess, targetDomainsToProcess]);

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

  const updateUserMapping = (userId: string, targetDomain: string, targetEmail?: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    const newMapping: UserDomainMapping = {
      user,
      targetDomain,
      targetEmail: targetEmail || `${user.primaryEmail.split('@')[0]}@${targetDomain}`
    };

    setUserMappings(prev => ({
      ...prev,
      [userId]: newMapping
    }));

    // Notify parent component
    if (onUserMappingChange) {
      const updatedMappings = Object.values({
        ...userMappings,
        [userId]: newMapping
      });
      onUserMappingChange(updatedMappings);
    }
  };

  const bulkAssignToTargetDomain = (targetDomain: string) => {
    const newMappings: {[userId: string]: UserDomainMapping} = {};
    
    selectedUsers.forEach(userId => {
      const user = users.find(u => u.id === userId);
      if (user) {
        newMappings[userId] = {
          user,
          targetDomain,
          targetEmail: `${user.primaryEmail.split('@')[0]}@${targetDomain}`
        };
      }
    });

    setUserMappings(prev => ({
      ...prev,
      ...newMappings
    }));

    if (onUserMappingChange) {
      const updatedMappings = Object.values({
        ...userMappings,
        ...newMappings
      });
      onUserMappingChange(updatedMappings);
    }
  };

  // Check if target users need to be created
  const checkTargetUsersExistence = useCallback(async () => {
    if (!targetAdminEmails || Object.keys(userMappings).length === 0) return;

    const mappingsToCheck = Object.values(userMappings);
    const nonExistentMappings: UserDomainMapping[] = [];

    for (const mapping of mappingsToCheck) {
      try {
        const adminEmail = targetAdminEmails[mapping.targetDomain];
        if (!adminEmail) continue;

        const targetEmail = mapping.targetEmail || `${mapping.user.primaryEmail.split('@')[0]}@${mapping.targetDomain}`;
        
        const response = await fetch('/api/google-workspace', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'check-user',
            data: { email: targetEmail, domain: mapping.targetDomain, adminEmail }
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (!data.exists) {
            nonExistentMappings.push(mapping);
          }
        }
      } catch (error) {
        console.error('Error checking user existence:', error);
        // Assume user doesn't exist if check fails
        nonExistentMappings.push(mapping);
      }
    }

    setPendingUserCreation(nonExistentMappings);
    
    if (nonExistentMappings.length > 0 && onTargetUserCreationRequired) {
      onTargetUserCreationRequired(nonExistentMappings);
    }
  }, [userMappings, targetAdminEmails, onTargetUserCreationRequired]);

  // Trigger target user existence check when mappings change
  useEffect(() => {
    if (targetUserCreationEnabled && Object.keys(userMappings).length > 0) {
      const timeoutId = setTimeout(checkTargetUsersExistence, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [userMappings, targetUserCreationEnabled, checkTargetUsersExistence]);

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
    const domainsText = domainsToProcess.length === 1 
      ? domainsToProcess[0] 
      : `${domainsToProcess.length} domains`;
      
    return (
      <div className="bg-white rounded-lg shadow p-8">
        <div className="flex items-center justify-center space-x-3">
          <RefreshCw className="h-6 w-6 text-blue-600 animate-spin" />
          <div>
            <h3 className="text-lg font-medium text-gray-900">Discovering Users</h3>
            <p className="text-gray-600">Fetching users from {domainsText}...</p>
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
              <p className="text-gray-600">{domainsDisplayText}</p>
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

      {/* Domain Progress (for multiple domains) */}
      {domainsToProcess.length > 1 && Object.keys(domainProgress).length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Domain Discovery Progress</h3>
          <div className="space-y-3">
            {domainsToProcess.map(domain => {
              const progress = domainProgress[domain];
              if (!progress) return null;
              
              return (
                <div key={domain} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="font-mono text-sm text-gray-900">{domain}</div>
                    {progress.loading && (
                      <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />
                    )}
                    {!progress.loading && !progress.error && (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    )}
                    {progress.error && (
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    )}
                  </div>
                  <div className="text-sm">
                    {progress.loading && 'Discovering users...'}
                    {!progress.loading && !progress.error && `${progress.users.length} users found`}
                    {progress.error && progress.error}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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

      {/* Target Domain Mapping Section */}
      {isMappingRequired() && targetDomainsToProcess.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Target className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Target Domain Mapping</h3>
                <p className="text-gray-600">
                  {mappingType === 'many-to-one' ? 'Merging users into target domain' :
                   mappingType === 'one-to-many' ? 'Distributing users across target domains' :
                   'Mapping users to target domains'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowMappingView(!showMappingView)}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  showMappingView ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {showMappingView ? 'Hide Details' : 'Show Details'}
              </button>
              <button
                onClick={() => autoAssignUserMappings(users)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Auto-Assign All
              </button>
              <button
                onClick={() => setShowAdvancedMapping(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <Target className="h-4 w-4" />
                <span>Advanced Mapping</span>
              </button>
            </div>
          </div>

          {/* Target Domain Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            {targetDomainsToProcess.map(domain => {
              const mappedCount = Object.values(userMappings).filter(m => m.targetDomain === domain).length;
              return (
                <div key={domain} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900">{domain}</h4>
                      <p className="text-sm text-gray-600">{mappedCount} users mapped</p>
                    </div>
                    <button
                      onClick={() => bulkAssignToTargetDomain(domain)}
                      disabled={selectedUsers.size === 0}
                      className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                        selectedUsers.size > 0
                          ? 'bg-purple-600 text-white hover:bg-purple-700'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      Assign Selected
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mapping Type Information */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-800 mb-2">Mapping Strategy: {mappingType?.replace('-', ' to ').toUpperCase() || 'ONE TO ONE'}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-700">
              <div>
                <strong>Source Domains:</strong> {domainsToProcess.length} ({domainsToProcess.join(', ')})
              </div>
              <div>
                <strong>Target Domains:</strong> {targetDomainsToProcess.length} ({targetDomainsToProcess.join(', ')})
              </div>
            </div>
            
            {/* Target User Creation Status */}
            {targetUserCreationEnabled && pendingUserCreation.length > 0 && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <span className="text-yellow-800 text-sm font-medium">
                    {pendingUserCreation.length} target users need to be created
                  </span>
                </div>
                <div className="mt-2 text-xs text-yellow-700">
                  These users will be automatically created in their target domains during migration.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detailed Mapping View */}
      {showMappingView && isMappingRequired() && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">User Domain Mappings</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {filteredUsers.map(user => {
              const mapping = userMappings[user.id];
              return (
                <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={selectedUsers.has(user.id)}
                      onChange={() => toggleUserSelection(user.id)}
                      className="h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                    <div>
                      <h4 className="font-medium text-gray-900">{user.name.fullName}</h4>
                      <p className="text-sm text-gray-600">{user.primaryEmail}</p>
                      {user.sourceDomain && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          From: {user.sourceDomain}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <select
                      value={mapping?.targetDomain || ''}
                      onChange={(e) => updateUserMapping(user.id, e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    >
                      <option value="">Select Target Domain</option>
                      {targetDomainsToProcess.map(domain => (
                        <option key={domain} value={domain}>{domain}</option>
                      ))}
                    </select>
                    {mapping && (
                      <div className="text-sm text-gray-600">
                        → {mapping.targetEmail}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
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
            {isMappingRequired() && Object.keys(userMappings).length > 0 && (
              <span className="text-sm text-purple-600">
                • {Object.keys(userMappings).length} mapped
              </span>
            )}
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
              disabled={selectedUsers.size === 0 || (isMappingRequired() && Object.keys(userMappings).length === 0)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                selectedUsers.size > 0 && (!isMappingRequired() || Object.keys(userMappings).length > 0)
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isMappingRequired() 
                ? `Continue with ${Object.keys(userMappings).length} mapped users`
                : `Continue with ${selectedUsers.size} users`
              }
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
                            {user.sourceDomain && domainsToProcess.length > 1 && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {user.sourceDomain}
                              </span>
                            )}
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

      {/* Advanced User Mapping Modal */}
      {showAdvancedMapping && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Advanced User Mapping</h2>
                  <p className="text-gray-600">
                    Configure advanced mapping strategies for {users.length} discovered users
                  </p>
                </div>
                <button
                  onClick={() => setShowAdvancedMapping(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <UserMappingWithCreation
                sourceUsers={users.map(user => ({
                  ...user,
                  sourceDomain: user.sourceDomain || user.primaryEmail.split('@')[1]
                }))}
                targetDomains={targetDomainsToProcess}
                targetAdminEmails={targetAdminEmails || {}}
                mappingType={mappingType}
                autoStartCreation={false}
                onMappingComplete={(mappings) => {
                  console.log('Advanced mapping completed:', mappings);
                  // Update the local user mappings
                  const newMappings: {[userId: string]: UserDomainMapping} = {};
                  mappings.forEach(mapping => {
                    newMappings[mapping.user.id] = mapping;
                  });
                  setUserMappings(newMappings);
                  
                  if (onUserMappingChange) {
                    onUserMappingChange(mappings);
                  }
                }}
                onCreationComplete={(results) => {
                  console.log('Target user creation completed:', results);
                  // Close the modal and refresh the user list
                  setShowAdvancedMapping(false);
                  // Optionally refresh the user list to show newly created users
                  if (fetchUsers) {
                    fetchUsers();
                  }
                }}
              />

              <div className="mt-6 pt-4 border-t border-gray-200 flex justify-end space-x-3">
                <button
                  onClick={() => setShowAdvancedMapping(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

UserDiscovery.displayName = 'UserDiscovery';

export default UserDiscovery;
