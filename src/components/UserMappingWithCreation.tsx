'use client';

import { useState, useEffect, memo, useCallback } from 'react';
import { 
  Users, 
  UserPlus, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  ArrowRight,
  Target,
  Building,
  Shield,
  Mail
} from 'lucide-react';
import TargetUserCreation from './TargetUserCreation';

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

interface UserMappingWithCreationProps {
  sourceUsers: User[];
  targetDomains: string[];
  targetAdminEmails: {[domain: string]: string};
  onMappingComplete?: (mappings: UserDomainMapping[]) => void;
  onCreationComplete?: (results: any[]) => void;
  autoStartCreation?: boolean;
  mappingType?: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';
}

export const UserMappingWithCreation = memo(function UserMappingWithCreation({
  sourceUsers,
  targetDomains,
  targetAdminEmails,
  onMappingComplete,
  onCreationComplete,
  autoStartCreation = false,
  mappingType = 'one-to-one'
}: UserMappingWithCreationProps) {
  const [currentStep, setCurrentStep] = useState<'mapping' | 'validation' | 'creation' | 'complete'>('mapping');
  const [userMappings, setUserMappings] = useState<UserDomainMapping[]>([]);
  const [validationResults, setValidationResults] = useState<{[email: string]: boolean}>({});
  const [isValidating, setIsValidating] = useState(false);
  const [showCreation, setShowCreation] = useState(false);

  // Initialize mappings when source users change
  useEffect(() => {
    if (sourceUsers.length > 0 && targetDomains.length > 0) {
      const initialMappings = generateInitialMappings();
      setUserMappings(initialMappings);
    }
  }, [sourceUsers, targetDomains, mappingType]);

  // Helper function to normalize names for grouping
  const normalizeUserName = (user: User): string => {
    const firstName = user.name.givenName?.toLowerCase().trim() || '';
    const lastName = user.name.familyName?.toLowerCase().trim() || '';
    return `${firstName}.${lastName}`;
  };

  // Helper function to generate target email with domain-specific logic
  const generateTargetEmail = (user: User, targetDomain: string, mappingType: string): string => {
    const baseEmail = user.primaryEmail.split('@')[0];
    
    switch (mappingType) {
      case 'one-to-many':
        // Add domain identifier to prevent conflicts across domains
        const domainPrefix = targetDomain.split('.')[0];
        return `${baseEmail}.${domainPrefix}@${targetDomain}`;
      case 'many-to-one':
        // Use normalized name for merging
        return `${normalizeUserName(user)}@${targetDomain}`;
      default:
        return `${baseEmail}@${targetDomain}`;
    }
  };

  // Generate initial mappings based on mapping type
  const generateInitialMappings = useCallback((): UserDomainMapping[] => {
    if (sourceUsers.length === 0 || targetDomains.length === 0) return [];

    const mappings: UserDomainMapping[] = [];

    switch (mappingType) {
      case 'one-to-one':
        // Simple 1:1 mapping to first target domain
        sourceUsers.forEach(user => {
          mappings.push({
            user,
            targetDomain: targetDomains[0],
            targetEmail: `${user.primaryEmail.split('@')[0]}@${targetDomains[0]}`
          });
        });
        break;

      case 'one-to-many':
        // Clone each source user to ALL target domains
        sourceUsers.forEach(user => {
          targetDomains.forEach(targetDomain => {
            const targetEmail = generateTargetEmail(user, targetDomain, 'one-to-many');
            
            mappings.push({
              user,
              targetDomain,
              targetEmail
            });
          });
        });
        break;

      case 'many-to-one':
        // Merge users with same first+last name into single target user
        const usersByName = new Map<string, User[]>();
        
        // Group users by normalized name
        sourceUsers.forEach(user => {
          const nameKey = normalizeUserName(user);
          if (!usersByName.has(nameKey)) {
            usersByName.set(nameKey, []);
          }
          usersByName.get(nameKey)!.push(user);
        });

        // Create one mapping per unique name combination
        usersByName.forEach((usersWithSameName, nameKey) => {
          const primaryUser = usersWithSameName[0]; // Use first user as primary
          const allEmails = usersWithSameName.map(u => u.primaryEmail).join(', ');
          const targetEmail = generateTargetEmail(primaryUser, targetDomains[0], 'many-to-one');
          
          // Create mapping with merged user information
          mappings.push({
            user: {
              ...primaryUser,
              primaryEmail: allEmails, // Store all source emails for reference
              // Combine admin status (true if any source user is admin)
              isAdmin: usersWithSameName.some(u => u.isAdmin),
              // Use the most recent creation time
              creationTime: usersWithSameName.reduce((latest, user) => 
                new Date(user.creationTime) > new Date(latest) ? user.creationTime : latest, 
                usersWithSameName[0].creationTime
              )
            },
            targetDomain: targetDomains[0],
            targetEmail
          });
        });
        break;

      case 'many-to-many':
        // Smart distribution based on source domains and name matching
        const sourceDomainGroups = new Map<string, User[]>();
        
        // Group by source domain first
        sourceUsers.forEach(user => {
          const domain = user.sourceDomain || 'unknown';
          if (!sourceDomainGroups.has(domain)) {
            sourceDomainGroups.set(domain, []);
          }
          sourceDomainGroups.get(domain)!.push(user);
        });

        // Map each source domain group to corresponding target domains
        sourceDomainGroups.forEach((users, sourceDomain) => {
          // Try to find matching target domain, otherwise distribute
          const targetDomainIndex = Array.from(sourceDomainGroups.keys()).indexOf(sourceDomain);
          const assignedTargetDomain = targetDomains[targetDomainIndex % targetDomains.length];
          
          users.forEach(user => {
            mappings.push({
              user,
              targetDomain: assignedTargetDomain,
              targetEmail: `${user.primaryEmail.split('@')[0]}@${assignedTargetDomain}`
            });
          });
        });
        break;

      default:
        // Fallback to round-robin distribution
        sourceUsers.forEach((user, index) => {
          mappings.push({
            user,
            targetDomain: targetDomains[index % targetDomains.length],
            targetEmail: `${user.primaryEmail.split('@')[0]}@${targetDomains[index % targetDomains.length]}`
          });
        });
    }

    return mappings;
  }, [sourceUsers, targetDomains, mappingType]);

  // Update mapping for a specific user
  const updateMapping = (userId: string, targetDomain: string, targetEmail?: string) => {
    setUserMappings(prev => prev.map(mapping => 
      mapping.user.id === userId 
        ? {
            ...mapping,
            targetDomain,
            targetEmail: targetEmail || `${mapping.user.primaryEmail.split('@')[0]}@${targetDomain}`
          }
        : mapping
    ));
  };

  // Validate all target users existence
  const validateTargetUsers = useCallback(async () => {
    setIsValidating(true);
    setCurrentStep('validation');
    
    const results: {[email: string]: boolean} = {};
    
    for (const mapping of userMappings) {
      try {
        const adminEmail = targetAdminEmails[mapping.targetDomain];
        if (!adminEmail) {
          results[mapping.targetEmail!] = false;
          continue;
        }

        const response = await fetch('/api/google-workspace', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'check-user',
            data: { 
              email: mapping.targetEmail, 
              domain: mapping.targetDomain, 
              adminEmail 
            }
          })
        });

        if (response.ok) {
          const data = await response.json();
          results[mapping.targetEmail!] = data.exists;
        } else {
          results[mapping.targetEmail!] = false;
        }
      } catch (error) {
        console.error('Error validating user:', error);
        results[mapping.targetEmail!] = false;
      }
    }
    
    setValidationResults(results);
    setIsValidating(false);
    
    // Check if any users need to be created
    const needsCreation = Object.values(results).some(exists => !exists);
    if (needsCreation) {
      setCurrentStep('creation');
      setShowCreation(true);
    } else {
      setCurrentStep('complete');
      if (onMappingComplete) {
        onMappingComplete(userMappings);
      }
    }
  }, [userMappings, targetAdminEmails, onMappingComplete]);

  // Handle creation completion
  const handleCreationComplete = (results: any[]) => {
    setCurrentStep('complete');
    setShowCreation(false);
    
    if (onCreationComplete) {
      onCreationComplete(results);
    }
    
    if (onMappingComplete) {
      onMappingComplete(userMappings);
    }
  };

  // Get mappings that need user creation
  const getMappingsForCreation = (): UserDomainMapping[] => {
    return userMappings.filter(mapping => 
      mapping.targetEmail && !validationResults[mapping.targetEmail]
    );
  };

  // Get step status
  const getStepStatus = (step: string) => {
    switch (step) {
      case 'mapping':
        return currentStep === 'mapping' ? 'current' : (userMappings.length > 0 ? 'completed' : 'pending');
      case 'validation':
        return currentStep === 'validation' ? 'current' : 
               (Object.keys(validationResults).length > 0 ? 'completed' : 'pending');
      case 'creation':
        return currentStep === 'creation' ? 'current' : 
               (currentStep === 'complete' ? 'completed' : 'pending');
      case 'complete':
        return currentStep === 'complete' ? 'completed' : 'pending';
      default:
        return 'pending';
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          {['mapping', 'validation', 'creation', 'complete'].map((step, index) => {
            const status = getStepStatus(step);
            const isActive = status === 'current';
            const isCompleted = status === 'completed';
            
            return (
              <div key={step} className="flex items-center">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                  isCompleted ? 'bg-green-600 border-green-600 text-white' :
                  isActive ? 'bg-blue-600 border-blue-600 text-white' :
                  'bg-gray-100 border-gray-300 text-gray-500'
                }`}>
                  {isCompleted ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <span className="text-sm font-medium">{index + 1}</span>
                  )}
                </div>
                <div className="ml-3">
                  <div className={`text-sm font-medium ${
                    isActive || isCompleted ? 'text-gray-900' : 'text-gray-500'
                  }`}>
                    {step.charAt(0).toUpperCase() + step.slice(1)}
                  </div>
                </div>
                {index < 3 && (
                  <ArrowRight className="h-5 w-5 text-gray-400 mx-4" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mapping Configuration */}
      {currentStep === 'mapping' && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Target className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">User Mapping Configuration</h3>
                <p className="text-gray-600">
                  Configure how {sourceUsers.length} source users map to {targetDomains.length} target domain(s)
                </p>
              </div>
            </div>
            
            {/* Advanced Mapping Explanation */}
            {(mappingType === 'one-to-many' || mappingType === 'many-to-one') && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-yellow-800 mb-2">Advanced Mapping Strategy Active</h4>
                    {mappingType === 'one-to-many' && (
                      <div className="text-sm text-yellow-700">
                        <p className="mb-2"><strong>User Cloning:</strong> Each source user will be duplicated across all target domains.</p>
                        <ul className="list-disc list-inside space-y-1">
                          <li>Source user attributes (name, admin status, org unit) will be preserved</li>
                          <li>Unique email addresses will be generated for each target domain</li>
                          <li>Example: "john.doe@source.com" → "john.doe.target1@target1.com", "john.doe.target2@target2.com"</li>
                          <li>Total users to create: {sourceUsers.length} × {targetDomains.length} = {userMappings.length}</li>
                        </ul>
                      </div>
                    )}
                    {mappingType === 'many-to-one' && (
                      <div className="text-sm text-yellow-700">
                        <p className="mb-2"><strong>User Merging:</strong> Multiple source users with identical first name and last name will be consolidated.</p>
                        <ul className="list-disc list-inside space-y-1">
                          <li>Users are grouped by exact match of first name + last name (case-insensitive)</li>
                          <li>One target user will be created per unique name combination</li>
                          <li>All source emails for that name will be documented for data migration</li>
                          <li>Example: "john.doe@company1.com" + "john.doe@company2.com" → "john.doe@target.com"</li>
                          <li>Unique names found: {new Set(sourceUsers.map(u => `${u.name.givenName}.${u.name.familyName}`)).size}</li>
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            <button
              onClick={validateTargetUsers}
              disabled={userMappings.length === 0}
              className={`px-4 py-2 rounded-lg transition-colors ${
                userMappings.length > 0
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Validate Mappings
            </button>
          </div>

          {/* Mapping Strategy Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h4 className="font-medium text-blue-800 mb-2">
              Strategy: {mappingType.replace('-', ' to ').toUpperCase()}
            </h4>
            <div className="text-sm text-blue-700">
              {mappingType === 'one-to-one' && 'Each source user maps to the primary target domain'}
              {mappingType === 'one-to-many' && `Each source user is cloned to ALL ${targetDomains.length} target domains based on first name and last name`}
              {mappingType === 'many-to-one' && 'Multiple source users with same first name and last name are merged into single target users'}
              {mappingType === 'many-to-many' && 'Complex mapping based on source domain preferences with name-based grouping'}
            </div>
            
            {/* Mapping Statistics */}
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="bg-white rounded px-2 py-1">
                <div className="font-medium text-blue-800">Source Users</div>
                <div className="text-blue-600">{sourceUsers.length}</div>
              </div>
              <div className="bg-white rounded px-2 py-1">
                <div className="font-medium text-blue-800">Target Domains</div>
                <div className="text-blue-600">{targetDomains.length}</div>
              </div>
              <div className="bg-white rounded px-2 py-1">
                <div className="font-medium text-blue-800">Total Mappings</div>
                <div className="text-blue-600">{userMappings.length}</div>
              </div>
              <div className="bg-white rounded px-2 py-1">
                <div className="font-medium text-blue-800">Strategy</div>
                <div className="text-blue-600">
                  {mappingType === 'one-to-many' ? 'Clone All' : 
                   mappingType === 'many-to-one' ? 'Merge Names' : 
                   mappingType === 'many-to-many' ? 'Smart Dist.' : 'Direct'}
                </div>
              </div>
            </div>
          </div>

          {/* User Mappings Table */}
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {userMappings.map((mapping, index) => {
              // Check if this is a merged user (many-to-one scenario)
              const isMergedUser = mappingType === 'many-to-one' && mapping.user.primaryEmail.includes(',');
              // Check if this is a cloned user (one-to-many scenario)
              const isClonedUser = mappingType === 'one-to-many';
              
              return (
                <div key={`${mapping.user.id}-${mapping.targetDomain}-${index}`} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-medium text-gray-900">{mapping.user.name.fullName}</h4>
                        {isClonedUser && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Clone
                          </span>
                        )}
                        {isMergedUser && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                            Merged
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 flex items-center space-x-2">
                        <Mail className="h-4 w-4" />
                        <span className={isMergedUser ? 'font-mono text-xs' : ''}>
                          {isMergedUser ? mapping.user.primaryEmail : mapping.user.primaryEmail}
                        </span>
                        {mapping.user.isAdmin && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            <Shield className="h-3 w-3 mr-1" />
                            Admin
                          </span>
                        )}
                      </div>
                      
                      {/* Show source domain for multi-domain scenarios */}
                      {(mappingType === 'many-to-many' || mappingType === 'many-to-one') && mapping.user.sourceDomain && (
                        <div className="text-xs text-gray-500 mt-1">
                          From: {mapping.user.sourceDomain}
                        </div>
                      )}
                      
                      {/* Show merging details for many-to-one */}
                      {isMergedUser && (
                        <div className="text-xs text-blue-600 mt-1">
                          Merging: {mapping.user.primaryEmail.split(', ').length} accounts with name "{mapping.user.name.fullName}"
                        </div>
                      )}
                      
                      {/* Show cloning details for one-to-many */}
                      {isClonedUser && (
                        <div className="text-xs text-green-600 mt-1">
                          Cloning to {targetDomains.length} target domains
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <ArrowRight className="h-4 w-4 text-gray-400" />
                    
                    <div className="flex items-center space-x-2">
                      <select
                        value={mapping.targetDomain}
                        onChange={(e) => updateMapping(mapping.user.id, e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        disabled={mappingType === 'one-to-many'} // Disable for cloning scenario
                      >
                        {targetDomains.map(domain => (
                          <option key={domain} value={domain}>{domain}</option>
                        ))}
                      </select>
                      
                      <input
                        type="email"
                        value={mapping.targetEmail || ''}
                        onChange={(e) => updateMapping(mapping.user.id, mapping.targetDomain, e.target.value)}
                        placeholder="Target email"
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-64"
                      />
                      
                      {/* Show target domain indicator */}
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        <Building className="h-3 w-3 mr-1" />
                        {mapping.targetDomain}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Validation Results */}
      {currentStep === 'validation' && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-2 bg-yellow-100 rounded-lg">
              {isValidating ? (
                <RefreshCw className="h-6 w-6 text-yellow-600 animate-spin" />
              ) : (
                <CheckCircle className="h-6 w-6 text-yellow-600" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Validation Results</h3>
              <p className="text-gray-600">
                {isValidating ? 'Checking target user existence...' : 'Validation complete'}
              </p>
            </div>
          </div>

          {!isValidating && (
            <>
              {/* Summary Statistics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {Object.values(validationResults).filter(exists => exists).length}
                  </div>
                  <div className="text-sm text-green-700">Already Exist</div>
                </div>
                <div className="bg-red-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {Object.values(validationResults).filter(exists => !exists).length}
                  </div>
                  <div className="text-sm text-red-700">Need Creation</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-blue-600">{userMappings.length}</div>
                  <div className="text-sm text-blue-700">Total Mappings</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {new Set(userMappings.map(m => m.targetDomain)).size}
                  </div>
                  <div className="text-sm text-purple-700">Target Domains</div>
                </div>
              </div>

              {/* Detailed Results */}
              <div className="space-y-3">
                {userMappings.map((mapping, index) => {
                  const exists = validationResults[mapping.targetEmail!];
                  const isMergedUser = mappingType === 'many-to-one' && mapping.user.primaryEmail.includes(',');
                  const isClonedUser = mappingType === 'one-to-many';
                  
                  return (
                    <div key={`${mapping.user.id}-${mapping.targetDomain}-${index}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div>
                          <div className="flex items-center space-x-2">
                            <h4 className="font-medium text-gray-900">{mapping.user.name.fullName}</h4>
                            {isClonedUser && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Clone
                              </span>
                            )}
                            {isMergedUser && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                Merged
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600">{mapping.targetEmail}</div>
                          {isMergedUser && (
                            <div className="text-xs text-orange-600 mt-1">
                              Sources: {mapping.user.primaryEmail.split(', ').length} accounts
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {exists ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Exists
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <UserPlus className="h-3 w-3 mr-1" />
                            Needs Creation
                          </span>
                        )}
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          <Building className="h-3 w-3 mr-1" />
                          {mapping.targetDomain}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Target User Creation */}
      {currentStep === 'creation' && showCreation && (
        <TargetUserCreation
          userMappings={getMappingsForCreation()}
          targetAdminEmails={targetAdminEmails}
          onComplete={handleCreationComplete}
          autoStart={autoStartCreation}
          batchSize={3}
          retryAttempts={3}
        />
      )}

      {/* Completion Summary */}
      {currentStep === 'complete' && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Mapping Complete</h3>
              <p className="text-gray-600">All user mappings are configured and ready for migration</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{userMappings.length}</div>
              <div className="text-sm text-gray-600">Total Mappings</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {Object.values(validationResults).filter(exists => exists).length}
              </div>
              <div className="text-sm text-gray-600">Existing Users</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {Object.values(validationResults).filter(exists => !exists).length}
              </div>
              <div className="text-sm text-gray-600">Created Users</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

UserMappingWithCreation.displayName = 'UserMappingWithCreation';

export default UserMappingWithCreation;
