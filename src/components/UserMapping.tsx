'use client';

import { useState, useEffect, memo, useCallback } from 'react';
import { 
  Users, 
  RefreshCw,
  AlertCircle,
  CheckCircle,
  X
} from 'lucide-react';

interface User {
  id: string;
  primaryEmail: string;
  domain?: string;
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

interface UserMappingGroup {
  sourceUser: User;
  mappings: UserMapping[];
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
  sourceDomains?: string[];
  targetDomains?: string[];
  sourceAdminEmails?: { [domain: string]: string };
  targetAdminEmails?: { [domain: string]: string };
  strategy?: 'one-to-one' | 'one-to-many' | 'many-to-one';
  onMappingComplete?: (mappings: UserMapping[]) => void;
  onComplete?: () => void;
  onNext?: (selectedMappings: UserMappingGroup[]) => void;
}

export const UserMapping = memo(function UserMapping({ 
  sourceDomains = [], 
  targetDomains = [], 
  sourceAdminEmails = {},
  targetAdminEmails = {},
  strategy = 'one-to-one',
  onMappingComplete, 
  onComplete,
  onNext
}: UserMappingProps) {
  console.log('[UserMapping] Received props:', {
    sourceDomains,
    targetDomains,
    sourceAdminEmails,
    targetAdminEmails,
    strategy
  });

  // Validate domain configuration based on strategy
  const validateDomainConfiguration = () => {
    switch (strategy) {
      case 'one-to-one':
        return sourceDomains.length === 1 && targetDomains.length === 1;
      case 'one-to-many':
        return sourceDomains.length === 1 && targetDomains.length >= 1;
      case 'many-to-one':
        return sourceDomains.length >= 1 && targetDomains.length === 1;
      default:
        return false;
    }
  };

  const isValidConfiguration = validateDomainConfiguration();
  
  const getConfigurationMessage = () => {
    switch (strategy) {
      case 'one-to-one':
        return 'One-to-One strategy requires exactly 1 source domain and 1 target domain.';
      case 'one-to-many':
        return 'One-to-Many strategy requires exactly 1 source domain and at least 1 target domain.';
      case 'many-to-one':
        return 'Many-to-One strategy requires at least 1 source domain and exactly 1 target domain.';
      default:
        return 'Invalid strategy configuration.';
    }
  };
  const [sourceUsers, setSourceUsers] = useState<User[]>([]);
  const [userMappings, setUserMappings] = useState<UserMapping[]>([]);
  const [filteredMappings, setFilteredMappings] = useState<UserMappingGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<UserMappingError | null>(null);
  const [selectedTargetDomain, setSelectedTargetDomain] = useState(targetDomains[0] || '');
  const [processingMappings, setProcessingMappings] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  
  // Filter states - only keep what's needed
  const filterStatus = 'exists'; // Fixed to show only existing users
  const [sortBy, setSortBy] = useState<'name' | 'email' | 'action' | 'status'>('name');

  // Selection handlers
  const handleUserSelection = (userId: string, isSelected: boolean) => {
    const newSelected = new Set(selectedUsers);
    if (isSelected) {
      newSelected.add(userId);
    } else {
      newSelected.delete(userId);
    }
    setSelectedUsers(newSelected);
  };

  const handleSelectAll = (isSelected: boolean) => {
    if (isSelected) {
      const allUserIds = new Set(filteredMappings.map(group => group.sourceUser.id));
      setSelectedUsers(allUserIds);
    } else {
      setSelectedUsers(new Set());
    }
  };

  const getSelectedUserMappings = () => {
    return filteredMappings.filter(group => selectedUsers.has(group.sourceUser.id));
  };

  // Fetch source users automatically when component mounts with valid domains
  const fetchSourceUsers = useCallback(async () => {
    console.log('[UserMapping] fetchSourceUsers called');
    console.log('[UserMapping] Strategy:', strategy);
    console.log('[UserMapping] sourceDomains:', sourceDomains);
    console.log('[UserMapping] sourceAdminEmails:', sourceAdminEmails);
    
    if (!sourceDomains?.length) {
      console.log('[UserMapping] No source domains available');
      setError({
        type: 'general',
        title: 'Missing Configuration',
        message: 'Source domains are required',
        details: ['Please provide source domains in the general settings']
      });
      return;
    }

    // Get the relevant source domains based on strategy
    const domainsToFetch = strategy === 'one-to-one' || strategy === 'one-to-many' 
      ? [sourceDomains[0]] // Only use first domain for one-to-one and one-to-many
      : sourceDomains; // Use all domains for many-to-one

    if (!sourceAdminEmails || Object.keys(sourceAdminEmails).length === 0) {
      console.log('[UserMapping] No source admin emails available');
      setError({
        type: 'general',
        title: 'Missing Configuration',
        message: 'Source admin emails are required',
        details: ['Please provide admin emails for source domains']
      });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const allUsers: User[] = [];
      
      // Fetch users from relevant source domains
      for (const domain of domainsToFetch) {
        const adminEmail = sourceAdminEmails[domain];
        if (!adminEmail) {
          console.log(`[UserMapping] No admin email for domain: ${domain}`);
          continue;
        }

        console.log(`[UserMapping] Fetching users for domain: ${domain} with admin: ${adminEmail}`);
        
        const params = new URLSearchParams({
          action: 'all-users',
          domain,
          includeSuspended: 'false'
        });
        
        params.append('adminEmail', adminEmail);
        
        const response = await fetch(`/api/google-workspace?${params.toString()}`);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          console.error(`[UserMapping] Failed to fetch users for domain ${domain}:`, errorData);
          continue; // Continue with other domains instead of failing completely
        }

        const data = await response.json();
        const users = data.users || [];
        console.log(`[UserMapping] Fetched ${users.length} users for domain: ${domain}`);
        
        // Add domain info to each user
        const domainUsers = users.map((user: any) => ({
          ...user,
          domain
        })) as User[];
        
        allUsers.push(...domainUsers);
      }

      console.log(`[UserMapping] Total users fetched from domains: ${allUsers.length}`);
      setSourceUsers(allUsers);
      
      // Create initial user mappings based on strategy - check against ALL target domains
      const mappings: UserMapping[] = [];
      
      for (const user of allUsers) {
        const userDomain = user.domain || domainsToFetch[0];
        
        // Check user against all target domains
        for (const targetDomain of targetDomains) {
          const targetEmail = user.primaryEmail.replace(`@${userDomain}`, `@${targetDomain}`);
          
          mappings.push({
            sourceUser: user,
            targetEmail,
            action: 'clone' as const,
            status: 'pending' as const
          });
        }
      }
      
      setUserMappings(mappings);
      setLoading(false);
    } catch (error) {
      console.error('[UserMapping] Error fetching source users:', error);
      setError({
        type: 'general',
        title: 'Network Error',
        message: 'Failed to fetch users from source domains',
        details: [error instanceof Error ? error.message : 'Unknown error occurred']
      });
      setLoading(false);
    }
  }, [sourceDomains, sourceAdminEmails, targetDomains, strategy]);

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
          // Extract target domain from target email
          const targetDomain = mapping.targetEmail.split('@')[1];
          const existingUser = await checkUserExistsInTarget(mapping.targetEmail, targetDomain);
          
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
  }, [userMappings, targetAdminEmails]);

  // Apply filters and group by source user
  const applyFilters = useCallback(() => {
    let filtered = [...userMappings];
    
    // Status filter - only show existing users
    filtered = filtered.filter(mapping => mapping.status === 'exists');
    
    // Group by source user
    const groupedByUser = filtered.reduce((groups: { [userId: string]: UserMapping[] }, mapping) => {
      const userId = mapping.sourceUser.id;
      if (!groups[userId]) {
        groups[userId] = [];
      }
      groups[userId].push(mapping);
      return groups;
    }, {});
    
    // Convert to array and sort groups by user name
    const groupedArray = Object.entries(groupedByUser)
      .map(([userId, mappings]) => ({
        sourceUser: mappings[0].sourceUser,
        mappings: mappings.sort((a, b) => a.targetEmail.localeCompare(b.targetEmail))
      }))
      // Only keep users with multiple target domain mappings (grouped users)
      .filter(group => group.mappings.length > 1)
      .sort((a, b) => {
        switch (sortBy) {
          case 'name':
            return a.sourceUser.name.fullName.localeCompare(b.sourceUser.name.fullName);
          case 'email':
            return a.sourceUser.primaryEmail.localeCompare(b.sourceUser.primaryEmail);
          default:
            return a.sourceUser.name.fullName.localeCompare(b.sourceUser.name.fullName);
        }
      });

    setFilteredMappings(groupedArray);
  }, [userMappings, sortBy]);

  // Effects
  useEffect(() => {
    if (sourceDomains?.length && targetDomains.length > 0) {
      setSelectedTargetDomain(targetDomains[0]);
    }
  }, [sourceDomains, targetDomains]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  // Auto-fetch users when component mounts with valid configuration
  useEffect(() => {
    if (sourceDomains?.length && targetDomains.length > 0 && sourceUsers.length === 0) {
      fetchSourceUsers();
    }
  }, [sourceDomains, targetDomains, sourceUsers.length, fetchSourceUsers]);

  // Update mappings when domains change
  useEffect(() => {
    if (sourceUsers.length > 0 && targetDomains.length > 0) {
      const updatedMappings: UserMapping[] = [];
      
      for (const user of sourceUsers) {
        const userDomain = user.domain || sourceDomains?.[0] || '';
        
        // Create mappings for all target domains
        for (const targetDomain of targetDomains) {
          const targetEmail = user.primaryEmail.replace(`@${userDomain}`, `@${targetDomain}`);
          const existingMapping = userMappings.find(m => 
            m.sourceUser.id === user.id && m.targetEmail === targetEmail
          );
          
          updatedMappings.push({
            sourceUser: user,
            targetEmail,
            action: existingMapping?.action || ('clone' as const),
            status: existingMapping?.status || ('pending' as const),
            targetUser: existingMapping?.targetUser,
            error: existingMapping?.error
          });
        }
      }
      
      setUserMappings(updatedMappings);
    }
  }, [sourceUsers, sourceDomains, targetDomains]);

  // Call onMappingComplete when mappings change
  useEffect(() => {
    if (onMappingComplete && userMappings.length > 0) {
      onMappingComplete(userMappings);
    }
  }, [userMappings, onMappingComplete]);

  // Automatically check for existing users when mappings are first created
  useEffect(() => {
    if (userMappings.length > 0 && !processingMappings && userMappings.every(m => m.status === 'pending')) {
      console.log('[UserMapping] Auto-checking existing users...');
      checkExistingUsers();
    }
  }, [userMappings, processingMappings, checkExistingUsers]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="flex items-center justify-center space-x-3">
          <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
          <span className="text-gray-600">
            Discovering users from {
              strategy === 'one-to-one' || strategy === 'one-to-many' 
                ? sourceDomains[0] 
                : sourceDomains.join(', ')
            }...
          </span>
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

  if (!sourceDomains?.length || !targetDomains?.length) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="text-center">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Configuration Required</h3>
          <p className="text-gray-600">
            Please configure your source domains and target domains in the General settings tab first.
          </p>
        </div>
      </div>
    );
  }

  if (!isValidConfiguration) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="text-center">
          <Users className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Invalid Domain Configuration</h3>
          <p className="text-gray-600 mb-4">
            {getConfigurationMessage()}
          </p>
          <div className="bg-gray-50 rounded-lg p-4 text-sm">
            <p className="font-medium text-gray-700 mb-2">Current Configuration:</p>
            <p className="text-gray-600">
              Strategy: <span className="font-medium">{strategy}</span>
            </p>
            <p className="text-gray-600">
              Source Domains: <span className="font-medium">{sourceDomains.length}</span> 
              {sourceDomains.length > 0 && ` (${sourceDomains.join(', ')})`}
            </p>
            <p className="text-gray-600">
              Target Domains: <span className="font-medium">{targetDomains.length}</span>
              {targetDomains.length > 0 && ` (${targetDomains.join(', ')})`}
            </p>
          </div>
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
              <h3 className="text-lg font-medium text-gray-900">
                User Mapping ({strategy.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())})
              </h3>
              <p className="text-sm text-gray-600">
                {strategy === 'one-to-one' && `Map users from ${sourceDomains[0]} to ${targetDomains[0]}`}
                {strategy === 'one-to-many' && `Map users from ${sourceDomains[0]} to ${targetDomains.length} target domains`}
                {strategy === 'many-to-one' && `Map users from ${sourceDomains.length} source domains to ${targetDomains[0]}`}
                {filteredMappings.length > 0 && ` • ${filteredMappings.length} grouped users with ${filteredMappings.reduce((total, group) => total + group.mappings.length, 0)} total mappings`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* User Mappings Table */}
      {filteredMappings.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                  <input
                    type="checkbox"
                    checked={filteredMappings.length > 0 && selectedUsers.size === filteredMappings.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Source User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Target Email
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredMappings.map((group, groupIndex) => (
                group.mappings.map((mapping, mappingIndex) => (
                  <tr 
                    key={`${group.sourceUser.id}-${mapping.targetEmail}`} 
                    className={`hover:bg-gray-50 ${mappingIndex === 0 && groupIndex > 0 ? 'border-t-2 border-gray-100' : ''}`}
                  >
                    {/* Checkbox - only show for the first row of each group */}
                    {mappingIndex === 0 ? (
                      <td className="px-6 py-4 whitespace-nowrap text-center" rowSpan={group.mappings.length}>
                        <input
                          type="checkbox"
                          checked={selectedUsers.has(group.sourceUser.id)}
                          onChange={(e) => handleUserSelection(group.sourceUser.id, e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </td>
                    ) : null}
                    
                    {/* Only show source user info for the first row of each group */}
                    {mappingIndex === 0 ? (
                      <td className="px-6 py-4 whitespace-nowrap border-r border-gray-100" rowSpan={group.mappings.length}>
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                              <span className="text-sm font-medium text-blue-600">
                                {group.sourceUser.name.givenName.charAt(0)}
                                {group.sourceUser.name.familyName.charAt(0)}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {group.sourceUser.name.fullName}
                            </div>
                            <div className="text-sm text-gray-500">
                              {group.sourceUser.primaryEmail}
                            </div>
                            <div className="text-xs text-blue-600 mt-1 font-medium">
                              {group.mappings.length} target domain{group.mappings.length > 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>
                      </td>
                    ) : null}
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {mapping.targetEmail}
                      </div>
                      <div className="text-xs text-blue-600 font-medium">
                        {mapping.targetEmail.split('@')[1]}
                      </div>
                    </td>
                  </tr>
                ))
              )).flat()}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-8 text-center">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Existing Users Found</h3>
          <p className="text-gray-600">
            {userMappings.length === 0 
              ? "Users will be automatically discovered and checked for existence in target domains"
              : "No existing users found in target domains"
            }
          </p>
        </div>
      )}

      {/* Footer with action buttons */}
      {filteredMappings.length > 0 && (
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {selectedUsers.size} of {filteredMappings.length} users selected
          </div>
          <button
            onClick={() => {
              const selectedMappings = getSelectedUserMappings();
              console.log('Selected user mappings for next step:', selectedMappings);
              onNext?.(selectedMappings);
            }}
            disabled={selectedUsers.size === 0}
            className={`px-4 py-2 rounded-lg font-medium ${
              selectedUsers.size > 0
                ? 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Proceed with {selectedUsers.size} user{selectedUsers.size !== 1 ? 's' : ''} →
          </button>
        </div>
      )}
    </div>
  );
});

export default UserMapping;
