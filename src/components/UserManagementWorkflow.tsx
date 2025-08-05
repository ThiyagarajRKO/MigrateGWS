'use client';

import { useState, useEffect, memo, useCallback } from 'react';
import { UserMappingRelationship, UserMappingConfig } from '@/types';
import { DomainMappingConfig } from '@/types/migration-scenarios';
import { 
  Users, 
  UserPlus, 
  Search, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  ArrowRight,
  Target,
  Building,
  Shield,
  Mail,
  Eye,
  EyeOff,
  Filter,
  Download,
  Play,
  Pause,
  RotateCcw,
  XCircle,
  Clock,
  TrendingUp,
  Database,
  Zap
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
  // Additional properties for merged users
  sourceUsers?: User[];
  mergedFromDomains?: string[];
}

interface UserMapping {
  user: User;
  targetDomain: string;
  targetEmail: string;
  status?: 'pending' | 'creating' | 'created' | 'failed' | 'exists';
  error?: string;
}

interface CreationResult {
  success: boolean;
  user: User;
  targetEmail: string;
  targetDomain: string;
  error?: string;
  userId?: string;
}

interface UserManagementWorkflowProps {
  sourceDomains: string[];
  targetDomains: string[];
  sourceAdminEmails?: {[domain: string]: string};
  sourceAdminEmail?: string;
  targetAdminEmails: {[domain: string]: string};
  mappingType?: 'one-to-one' | 'one-to-many' | 'many-to-one';
  migrationScenario?: 'single-super-admin' | 'cross-tenant';
  domainMapping?: DomainMappingConfig;
  userMappingStrategy?: UserMappingRelationship;
  userMappingConfig?: UserMappingConfig;
  onComplete?: (results: {
    discoveredUsers: User[];
    createdUsers: CreationResult[];
    mappings: UserMapping[];
  }) => void;
}

type WorkflowStep = 'discovery' | 'mapping' | 'creation' | 'complete';

export const UserManagementWorkflow = memo(function UserManagementWorkflow({
  sourceDomains,
  targetDomains,
  sourceAdminEmails,
  sourceAdminEmail,
  targetAdminEmails,
  mappingType,
  migrationScenario,
  domainMapping,
  userMappingStrategy,
  userMappingConfig,
  onComplete
}: UserManagementWorkflowProps) {
  // Core state
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('discovery');
  const [discoveredUsers, setDiscoveredUsers] = useState<User[]>([]);
  const [userMappings, setUserMappings] = useState<UserMapping[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  
  // Debug useEffect to track domain mapping changes
  useEffect(() => {
    console.log('[UserManagementWorkflow] Domain mapping received:', {
      domainMapping,
      migrationScenario,
      userMappingStrategy,
      userMappingConfig,
      timestamp: new Date().toISOString()
    });
  }, [domainMapping, migrationScenario, userMappingStrategy, userMappingConfig]);
  
  // Discovery state
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryProgress, setDiscoveryProgress] = useState<{[domain: string]: {loading: boolean, users: User[], error?: string}}>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Creation state
  const [isCreating, setIsCreating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [creationResults, setCreationResults] = useState<CreationResult[]>([]);
  const [currentBatch, setCurrentBatch] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<string>('');
  
  // Configuration
  const batchSize = 3; // Small batches to avoid rate limiting
  const retryAttempts = 3;
  
  // Helper functions
  const normalizeUserName = (user: User): string => {
    const cleanName = (name: string): string => {
      return name?.toLowerCase().trim().replace(/[^a-z0-9]/g, '') || '';
    };
    
    const firstName = cleanName(user.name.givenName);
    const lastName = cleanName(user.name.familyName);
    
    if (firstName && lastName) {
      return `${firstName}.${lastName}`;
    } else if (firstName) {
      return firstName;
    } else if (lastName) {
      return lastName;
    } else {
      // Fallback to email username
      const emailUsername = user.primaryEmail.split('@')[0];
      return cleanName(emailUsername) || 'user';
    }
  };

  const getEffectiveTargetAdminEmails = (): {[domain: string]: string} => {
    // For single-super-admin scenario, use the same source admin email for all target domains
    if (migrationScenario === 'single-super-admin' && sourceAdminEmail) {
      const effectiveEmails: {[domain: string]: string} = {};
      targetDomains.forEach(domain => {
        effectiveEmails[domain] = sourceAdminEmail;
      });
      
      console.log('Single Super Admin - Effective target admin emails:', {
        migrationScenario,
        sourceAdminEmail,
        targetDomains,
        effectiveEmails
      });
      
      return effectiveEmails;
    }
    
    // For cross-tenant or when no source admin email, use the provided target admin emails
    console.log('Cross-tenant - Using provided target admin emails:', {
      migrationScenario,
      targetAdminEmails
    });
    
    return targetAdminEmails;
  };

  const generateTargetEmail = (user: User, targetDomain: string): string => {
    // Clean and validate name components
    const cleanName = (name: string): string => {
      return name?.toLowerCase().trim().replace(/[^a-z0-9]/g, '') || '';
    };
    
    const firstName = cleanName(user.name.givenName);
    const lastName = cleanName(user.name.familyName);
    
    let emailBase = '';
    
    // Generate email base based on available name components
    if (firstName && lastName) {
      emailBase = `${firstName}.${lastName}`;
    } else if (firstName) {
      emailBase = firstName;
    } else if (lastName) {
      emailBase = lastName;
    } else {
      // Fallback to original email username if no valid name components
      const fallbackBase = user.primaryEmail.split('@')[0];
      emailBase = cleanName(fallbackBase) || 'user';
    }
    
    // Ensure emailBase is not empty and doesn't start/end with dots
    emailBase = emailBase.replace(/^\.+|\.+$/g, '').replace(/\.{2,}/g, '.') || 'user';
    
    switch (mappingType) {
      case 'one-to-many':
        // Use standard firstname.lastname format for multi-target scenarios
        return `${emailBase}@${targetDomain}`;
      case 'many-to-one':
        // Use firstname.lastname for merging scenarios
        return `${emailBase}@${targetDomain}`;
      default:
        // Standard firstname.lastname@domain format
        return `${emailBase}@${targetDomain}`;
    }
  };

  const hasValidTargetAdminEmails = (): { isValid: boolean, missingDomains: string[] } => {
    const effectiveTargetAdminEmails = getEffectiveTargetAdminEmails();
    const selectedMappings = userMappings.filter(mapping => 
      selectedUsers.has(mapping.user.id)
    );
    
    const requiredDomains = selectedMappings
      .map(m => m.targetDomain)
      .filter((domain, index, arr) => arr.indexOf(domain) === index); // unique domains
    
    const missingDomains = requiredDomains.filter(domain => !effectiveTargetAdminEmails[domain]);
    
    return {
      isValid: missingDomains.length === 0,
      missingDomains
    };
  };

  const hasValidAdminEmails = (): boolean => {
    return sourceDomains.every(domain => {
      const adminEmail = sourceAdminEmails?.[domain] || sourceAdminEmail;
      return adminEmail && adminEmail.trim() !== '';
    });
  };

  const generateInitialMappings = useCallback((users: User[]): UserMapping[] => {
    if (users.length === 0 || targetDomains.length === 0) return [];

    const mappings: UserMapping[] = [];

    switch (mappingType) {
      case 'one-to-one':
        users.forEach(user => {
          mappings.push({
            user,
            targetDomain: targetDomains[0],
            targetEmail: generateTargetEmail(user, targetDomains[0]),
            status: 'pending'
          });
        });
        break;

      case 'one-to-many':
        users.forEach(user => {
          targetDomains.forEach(targetDomain => {
            mappings.push({
              user,
              targetDomain,
              targetEmail: generateTargetEmail(user, targetDomain),
              status: 'pending'
            });
          });
        });
        break;

      case 'many-to-one':
        const usersByName = new Map<string, User[]>();
        users.forEach(user => {
          const nameKey = normalizeUserName(user);
          if (!usersByName.has(nameKey)) {
            usersByName.set(nameKey, []);
          }
          usersByName.get(nameKey)!.push(user);
        });

        console.log('Merging users from multiple source domains:', {
          totalUsers: users.length,
          uniqueNames: usersByName.size,
          mergingDetails: Array.from(usersByName.entries()).map(([name, users]) => ({
            name,
            sourceUsers: users.map(u => ({ email: u.primaryEmail, domain: u.sourceDomain })),
            count: users.length
          }))
        });

        usersByName.forEach((usersWithSameName, nameKey) => {
          // Find the primary user (prefer admin, then most recent, then first)
          const primaryUser = usersWithSameName.find(u => u.isAdmin) || 
                             usersWithSameName.sort((a, b) => 
                               new Date(b.creationTime).getTime() - new Date(a.creationTime).getTime()
                             )[0];
          
          // Collect all source emails and domains
          const sourceAdminEmails = usersWithSameName.map(u => u.primaryEmail);
          const sourceDomains = usersWithSameName.map(u => u.sourceDomain).filter(Boolean);
          const allEmails = sourceAdminEmails.join(', ');
          
          // Merge user properties
          const mergedUser: User = {
            ...primaryUser,
            id: `merged-${nameKey}-${usersWithSameName.map(u => u.id).join('-')}`,
            primaryEmail: allEmails, // Show all source emails
            name: {
              fullName: primaryUser.name.fullName,
              givenName: primaryUser.name.givenName,
              familyName: primaryUser.name.familyName
            },
            isAdmin: usersWithSameName.some(u => u.isAdmin), // True if any source user is admin
            suspended: usersWithSameName.every(u => u.suspended), // Only suspended if all are suspended
            sourceDomain: sourceDomains.join(', '), // Show all source domains
            // Custom properties for tracking merge
            sourceUsers: usersWithSameName,
            mergedFromDomains: sourceDomains
          } as User & { sourceUsers: User[], mergedFromDomains: string[] };
          
          mappings.push({
            user: mergedUser,
            targetDomain: targetDomains[0],
            targetEmail: generateTargetEmail(primaryUser, targetDomains[0]),
            status: 'pending'
          });
        });
        break;

      default:
        users.forEach((user, index) => {
          mappings.push({
            user,
            targetDomain: targetDomains[index % targetDomains.length],
            targetEmail: generateTargetEmail(user, targetDomains[index % targetDomains.length]),
            status: 'pending'
          });
        });
    }

    return mappings;
  }, [targetDomains, mappingType]);

  // User Discovery
  const discoverUsers = async () => {
    setIsDiscovering(true);
    setDiscoveryProgress({});
    
    console.log('Starting user discovery:', {
      sourceDomains,
      sourceAdminEmails,
      sourceAdminEmail
    });
    
    const allUsers: User[] = [];
    
    for (const domain of sourceDomains) {
      setDiscoveryProgress(prev => ({
        ...prev,
        [domain]: { loading: true, users: [] }
      }));

      try {
        const adminEmail = sourceAdminEmails?.[domain] || sourceAdminEmail;
        console.log(`Discovering users for ${domain} with admin email: ${adminEmail}`);
        
        if (!adminEmail) {
          throw new Error(`No admin email configured for domain ${domain}. Please complete the delegation setup first.`);
        }

        // First, verify delegation is properly configured using service account
        console.log(`Verifying delegation for ${domain} with admin email: ${adminEmail}`);
        const verificationParams = new URLSearchParams({
          action: 'test-connection',
          domain,
          adminEmail
        });

        const verificationResponse = await fetch(`/api/google-workspace?${verificationParams}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include'
        });

        const verificationData = await verificationResponse.json();
        console.log(`Delegation verification for ${domain}:`, { 
          status: verificationResponse.status, 
          data: verificationData 
        });

        if (!verificationResponse.ok) {
          throw new Error(`Delegation not verified for ${domain}: ${verificationData.error || verificationData.message || 'Domain-wide delegation not configured'}`); 
        }

        console.log(`✅ Delegation verified for ${domain}, proceeding with user discovery`);

        // Now proceed with user discovery

        const params = new URLSearchParams({
          action: 'all-users',
          domain,
          includeSuspended: 'false',
          adminEmail
        });

        const usersResponse = await fetch(`/api/google-workspace?${params}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include'
        });

        const data = await usersResponse.json();

        console.log(`API Response for ${domain}:`, { 
          status: usersResponse.status, 
          statusText: usersResponse.statusText,
          data 
        });

        if (!usersResponse.ok) {
          throw new Error(data.error || data.message || `Failed to fetch users: ${usersResponse.statusText}`);
        }

        const domainUsers = data.users.map((user: any) => ({
          ...user,
          sourceDomain: domain
        }));

        allUsers.push(...domainUsers);
        
        setDiscoveryProgress(prev => ({
          ...prev,
          [domain]: { loading: false, users: domainUsers }
        }));
      } catch (error) {
        console.error(`Error discovering users for ${domain}:`, error);
        setDiscoveryProgress(prev => ({
          ...prev,
          [domain]: { 
            loading: false, 
            users: [], 
            error: error instanceof Error ? error.message : 'Unknown error' 
          }
        }));
      }
    }

    setDiscoveredUsers(allUsers);
    setSelectedUsers(new Set(allUsers.map(u => u.id)));
    
    // Generate initial mappings and validate emails
    const mappings = generateInitialMappings(allUsers);
    
    // Log any potentially problematic email mappings
    mappings.forEach(mapping => {
      if (!validateEmail(mapping.targetEmail)) {
        console.warn(`Invalid target email generated: ${mapping.targetEmail} for user ${mapping.user.primaryEmail}`);
      }
    });
    
    setUserMappings(mappings);
    
    setIsDiscovering(false);
    
    if (allUsers.length > 0) {
      setCurrentStep('mapping');
    }
  };

  // User Creation
  const createTargetUser = async (mapping: UserMapping): Promise<CreationResult> => {
    // Use effective target admin emails (which handles single-super-admin scenario)
    const effectiveTargetAdminEmails = getEffectiveTargetAdminEmails();
    const adminEmail = effectiveTargetAdminEmails[mapping.targetDomain];
    
    if (!adminEmail) {
      const availableDomains = Object.keys(effectiveTargetAdminEmails);
      const errorMessage = `No admin email configured for target domain "${mapping.targetDomain}". ` +
        `Available configured domains: [${availableDomains.join(', ')}]. ` +
        `Please configure admin email for "${mapping.targetDomain}" in the delegation setup.`;
      
      console.error('Target admin email configuration error:', {
        targetDomain: mapping.targetDomain,
        configuredDomains: availableDomains,
        effectiveTargetAdminEmails,
        migrationScenario
      });
      
      return {
        success: false,
        user: mapping.user,
        targetEmail: mapping.targetEmail,
        targetDomain: mapping.targetDomain,
        error: errorMessage
      };
    }

    try {
      // Handle merged users - use primary user's recovery email or first source email
      const recoveryEmail = mapping.user.sourceUsers && mapping.user.sourceUsers.length > 0 
        ? mapping.user.sourceUsers[0].primaryEmail 
        : mapping.user.primaryEmail.split(', ')[0]; // Take first email if comma-separated

      // Validate required name fields with better error handling
      const cleanName = (name: string): string => {
        return name?.trim().replace(/[^a-zA-Z0-9\s]/g, '') || '';
      };
      
      const givenName = cleanName(mapping.user.name.givenName);
      const familyName = cleanName(mapping.user.name.familyName);
      
      if (!givenName && !familyName) {
        console.warn(`User ${mapping.user.primaryEmail} has no valid name components, using email-based username`);
      }
      
      // Use email username as fallback if both names are missing
      const emailUsername = mapping.user.primaryEmail.split('@')[0];
      const finalGivenName = givenName || emailUsername;
      const finalFamilyName = familyName || 'User';

      // Validate the target email before proceeding
      if (!validateEmail(mapping.targetEmail)) {
        throw new Error(`Generated target email "${mapping.targetEmail}" is invalid. Please check user name components for ${mapping.user.primaryEmail}`);
      }

      const userData = {
        primaryEmail: mapping.targetEmail,
        name: {
          givenName: finalGivenName,
          familyName: finalFamilyName
        },
        password: generateSecurePassword(),
        changePasswordAtNextLogin: true,
        orgUnitPath: mapping.user.orgUnitPath || '/',
        suspended: false
      };

      // Add notes about merged sources if applicable
      if (mapping.user.sourceUsers && mapping.user.sourceUsers.length > 1) {
        console.log(`Creating merged user ${mapping.targetEmail} from ${mapping.user.sourceUsers.length} source accounts:`, 
          mapping.user.sourceUsers.map(u => `${u.primaryEmail} (${u.sourceDomain})`));
      }

      console.log('Creating user with data:', {
        targetEmail: mapping.targetEmail,
        targetDomain: mapping.targetDomain,
        adminEmail,
        userData: userData,
        originalUser: {
          email: mapping.user.primaryEmail,
          givenName: mapping.user.name.givenName,
          familyName: mapping.user.name.familyName
        }
      });

      const response = await fetch('/api/google-workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-user',
          data: {
            userData: userData,
            adminEmail,
            domain: mapping.targetDomain
          }
        })
      });

      const result = await response.json();

      console.log('API Response:', {
        status: response.status,
        statusText: response.statusText,
        result: result
      });

      if (!response.ok) {
        const errorMsg = result.message || result.error || `Failed to create user: ${response.statusText}`;
        throw new Error(errorMsg);
      }

      console.log(`Successfully created user: ${mapping.targetEmail} in ${mapping.targetDomain}`);

      return {
        success: true,
        user: mapping.user,
        targetEmail: mapping.targetEmail,
        targetDomain: mapping.targetDomain,
        userId: result.user?.id || result.id
      };
    } catch (error) {
      console.error(`Failed to create user ${mapping.targetEmail} in ${mapping.targetDomain}:`, error);
      
      let errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Provide more helpful error messages for common domain limitations
      if (errorMessage.includes('Domain user limit reached') || errorMessage.includes('user limit')) {
        errorMessage = `Domain user limit reached for ${mapping.targetDomain}. Please contact Google Workspace Support to increase your user limit, or remove some users before proceeding with migration.`;
      } else if (errorMessage.includes('Entity already exists') || errorMessage.includes('already exists')) {
        errorMessage = `User ${mapping.targetEmail} already exists in ${mapping.targetDomain}. This user has already been created or migrated previously.`;
      } else if (errorMessage.includes('quotaExceeded') || errorMessage.includes('quota')) {
        errorMessage = `API quota exceeded for ${mapping.targetDomain}. Please wait and try again later, or contact Google Workspace Support for quota adjustments.`;
      } else if (errorMessage.includes('userEmailRequired') || errorMessage.includes('Invalid Input: primary_user_email')) {
        errorMessage = `Invalid email format: ${mapping.targetEmail}. Please check the user's name components and try again.`;
      } else if (errorMessage.includes('forbidden') || errorMessage.includes('insufficient permissions')) {
        errorMessage = `Insufficient permissions to create users in ${mapping.targetDomain}. Please verify domain-wide delegation and admin permissions.`;
      }
      
      return {
        success: false,
        user: mapping.user,
        targetEmail: mapping.targetEmail,
        targetDomain: mapping.targetDomain,
        error: errorMessage
      };
    }
  };

  const generateSecurePassword = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    return Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[a-zA-Z0-9][a-zA-Z0-9._-]*[a-zA-Z0-9]@[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
    
    // Check for common invalid patterns
    if (email.includes('..') || email.startsWith('.') || email.endsWith('.') || 
        email.includes('.-') || email.includes('-.') || email.includes('--')) {
      return false;
    }
    
    return emailRegex.test(email);
  };

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const createAllUsers = async () => {
    const selectedMappings = userMappings.filter(mapping => 
      selectedUsers.has(mapping.user.id)
    );

    if (selectedMappings.length === 0) return;

    // Check for domain user limits before starting
    const domainUserCounts = new Map<string, number>();
    selectedMappings.forEach(mapping => {
      const count = domainUserCounts.get(mapping.targetDomain) || 0;
      domainUserCounts.set(mapping.targetDomain, count + 1);
    });

    // Log domain capacity information
    console.log('User creation planning:', {
      totalMappings: selectedMappings.length,
      domainBreakdown: Array.from(domainUserCounts.entries()).map(([domain, count]) => ({
        domain,
        usersToCreate: count
      }))
    });

    // Validate all target domains have admin emails configured using effective emails
    const effectiveTargetAdminEmails = getEffectiveTargetAdminEmails();
    const missingAdminEmails = selectedMappings
      .map(m => m.targetDomain)
      .filter((domain, index, arr) => arr.indexOf(domain) === index) // unique domains
      .filter(domain => !effectiveTargetAdminEmails[domain]);

    if (missingAdminEmails.length > 0) {
      const errorMessage = migrationScenario === 'single-super-admin' 
        ? `Single Super Admin scenario requires source admin email to be configured. Missing configuration for target domains: ${missingAdminEmails.join(', ')}.`
        : `Missing admin email configuration for target domains: ${missingAdminEmails.join(', ')}. Please configure these in the delegation setup before proceeding.`;
      
      // Update all mappings to failed status with error message
      setUserMappings(prev => prev.map(mapping => 
        missingAdminEmails.includes(mapping.targetDomain)
          ? { ...mapping, status: 'failed' as const, error: errorMessage }
          : mapping
      ));
      
      console.error('Target domain admin email validation failed:', {
        missingDomains: missingAdminEmails,
        configuredDomains: Object.keys(effectiveTargetAdminEmails),
        migrationScenario,
        sourceAdminEmail
      });
      
      return;
    }

    setIsCreating(true);
    setIsPaused(false);
    setCreationResults([]);
    setStartTime(new Date());
    
    // Group mappings by user to ensure simultaneous creation across all target domains
    const userGroups: UserMapping[][] = [];
    const processedUsers = new Set<string>();
    
    selectedMappings.forEach(mapping => {
      if (!processedUsers.has(mapping.user.id)) {
        // Get all mappings for this user (all target domains)
        const userMappings = selectedMappings.filter(m => m.user.id === mapping.user.id);
        userGroups.push(userMappings);
        processedUsers.add(mapping.user.id);
      }
    });
    
    // Create batches from user groups
    const batches: UserMapping[][] = [];
    for (let i = 0; i < userGroups.length; i += batchSize) {
      // Each batch contains multiple user groups, but we flatten the mappings
      const batchGroups = userGroups.slice(i, i + batchSize);
      const flattenedBatch = batchGroups.flat();
      batches.push(flattenedBatch);
    }
    
    setTotalBatches(batches.length);

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      if (isPaused) {
        break;
      }

      setCurrentBatch(batchIndex + 1);
      
      // Update mappings status to 'creating'
      setUserMappings(prev => prev.map(mapping => 
        batches[batchIndex].some(batchMapping => 
          batchMapping.user.id === mapping.user.id && 
          batchMapping.targetDomain === mapping.targetDomain
        )
          ? { ...mapping, status: 'creating' as const }
          : mapping
      ));

      const batchPromises = batches[batchIndex].map(async (mapping) => {
        console.log(`Creating user ${mapping.user.name.fullName} in domain ${mapping.targetDomain} as ${mapping.targetEmail}`);
        
        let result: CreationResult;
        let attempts = 0;

        do {
          attempts++;
          result = await createTargetUser(mapping);
          
          if (!result.success && attempts < retryAttempts) {
            console.log(`Retry ${attempts} for ${mapping.targetEmail} in ${mapping.targetDomain}`);
            await delay(Math.pow(2, attempts) * 1000); // Exponential backoff
          }
        } while (!result.success && attempts < retryAttempts);

        console.log(`${result.success ? 'Success' : 'Failed'}: ${mapping.targetEmail} in ${mapping.targetDomain}`);

        // Update mapping status
        setUserMappings(prev => prev.map(m => 
          m.user.id === mapping.user.id && m.targetDomain === mapping.targetDomain
            ? { 
                ...m, 
                status: result.success ? 'created' as const : 'failed' as const,
                error: result.error 
              }
            : m
        ));

        return result;
      });

      const batchResults = await Promise.all(batchPromises);
      setCreationResults(prev => [...prev, ...batchResults]);

      // Calculate ETA
      if (startTime) {
        const elapsed = Date.now() - startTime.getTime();
        const completedBatches = batchIndex + 1;
        const remainingBatches = batches.length - completedBatches;
        const avgTimePerBatch = elapsed / completedBatches;
        const eta = avgTimePerBatch * remainingBatches;
        
        if (eta > 0) {
          const minutes = Math.floor(eta / 60000);
          const seconds = Math.floor((eta % 60000) / 1000);
          setEstimatedTimeRemaining(`${minutes}m ${seconds}s`);
        } else {
          setEstimatedTimeRemaining('Complete');
        }
      }

      // Add delay between batches to respect rate limits
      if (batchIndex < batches.length - 1) {
        await delay(2000);
      }
    }

    setIsCreating(false);
    setCurrentStep('complete');
  };

  const filteredUsers = discoveredUsers.filter(user =>
    user.name.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.primaryEmail.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const selectAllFiltered = () => {
    setSelectedUsers(new Set(filteredUsers.map(u => u.id)));
  };

  const clearSelection = () => {
    setSelectedUsers(new Set());
  };

  // Statistics
  const stats = {
    total: userMappings.length,
    created: creationResults.filter(r => r.success).length,
    failed: creationResults.filter(r => !r.success).length,
    pending: userMappings.filter(m => m.status === 'pending').length
  };

  useEffect(() => {
    if (currentStep === 'complete' && onComplete) {
      onComplete({
        discoveredUsers,
        createdUsers: creationResults,
        mappings: userMappings
      });
    }
  }, [currentStep, discoveredUsers, creationResults, userMappings, onComplete]);

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">User Management Workflow</h2>
            <p className="text-gray-600">Discover, map, and create users in a single integrated process</p>
          </div>
          
          {/* Step Indicator */}
          <div className="flex items-center space-x-2">
            {[
              { step: 'discovery', icon: Search, label: 'Discover' },
              { step: 'mapping', icon: Target, label: 'Map' },
              { step: 'creation', icon: UserPlus, label: 'Create' },
              { step: 'complete', icon: CheckCircle, label: 'Complete' }
            ].map(({ step, icon: Icon, label }, index) => {
              const isActive = currentStep === step;
              const isCompleted = ['discovery', 'mapping', 'creation', 'complete'].indexOf(currentStep) > index;
              
              return (
                <div key={step} className="flex items-center">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                    isCompleted ? 'bg-green-600 border-green-600 text-white' :
                    isActive ? 'bg-blue-600 border-blue-600 text-white' :
                    'bg-gray-100 border-gray-300 text-gray-500'
                  }`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className={`ml-2 text-sm font-medium ${
                    isActive || isCompleted ? 'text-gray-900' : 'text-gray-500'
                  }`}>
                    {label}
                  </span>
                  {index < 3 && <ArrowRight className="h-4 w-4 text-gray-400 mx-3" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Statistics */}
        {(currentStep === 'creation' || currentStep === 'complete') && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
              <div className="text-sm text-blue-700">Total Users</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-600">{stats.created}</div>
              <div className="text-sm text-green-700">Created</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
              <div className="text-sm text-yellow-700">Pending</div>
            </div>
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
              <div className="text-sm text-red-700">Failed</div>
            </div>
          </div>
        )}
      </div>

      {/* Step 1: Discovery */}
      {currentStep === 'discovery' && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Search className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">User Discovery</h3>
                <p className="text-gray-600">
                  Discovering users from {sourceDomains.length} source domain(s)
                </p>
              </div>
            </div>
            
            <button
              onClick={discoverUsers}
              disabled={isDiscovering || !hasValidAdminEmails()}
              className={`px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
                isDiscovering || !hasValidAdminEmails()
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isDiscovering ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span>{isDiscovering ? 'Discovering...' : 'Start Discovery'}</span>
            </button>
          </div>

          {/* Admin Email Configuration Status */}
          {!hasValidAdminEmails() && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <span className="font-medium text-yellow-900">Admin Email Configuration Required</span>
              </div>
              <div className="mt-2 text-sm text-yellow-800">
                <p>Please configure admin emails for the following domains in the delegation setup step:</p>
                <ul className="mt-1 list-disc list-inside">
                  {sourceDomains.map(domain => {
                    const adminEmail = sourceAdminEmails?.[domain] || sourceAdminEmail;
                    return (
                      <li key={domain}>
                        {domain}: {adminEmail || 'Not configured'}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )}

          {/* Domain Progress */}
          {Object.keys(discoveryProgress).length > 0 && (
            <div className="space-y-3">
              {sourceDomains.map(domain => {
                const progress = discoveryProgress[domain];
                if (!progress) return null;

                return (
                  <div key={domain} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Database className="h-5 w-5 text-gray-600" />
                      <div>
                        <div className="font-medium text-gray-900">{domain}</div>
                        {progress.error && (
                          <div className="text-sm text-red-600">{progress.error}</div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {progress.loading ? (
                        <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />
                      ) : progress.error ? (
                        <XCircle className="h-4 w-4 text-red-600" />
                      ) : (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      )}
                      <span className="text-sm font-medium text-gray-600">
                        {progress.users.length} users
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Discovery Results */}
          {discoveredUsers.length > 0 && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-900">
                  Discovery Complete: {discoveredUsers.length} users found
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Mapping & Selection */}
      {currentStep === 'mapping' && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Target className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">User Mapping & Selection</h3>
                <p className="text-gray-600">
                  Configure mappings for {userMappings.length} user mappings ({mappingType})
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="px-3 py-2 text-gray-600 hover:text-gray-800 transition-colors flex items-center space-x-2"
              >
                <Filter className="h-4 w-4" />
                <span>Filters</span>
              </button>
              
              <button
                onClick={() => setCurrentStep('creation')}
                disabled={selectedUsers.size === 0}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  selectedUsers.size > 0
                    ? 'bg-purple-600 text-white hover:bg-purple-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Create {selectedUsers.size} Users
              </button>
            </div>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Search Users</label>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by name or email..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
                
                <div className="flex items-end space-x-2">
                  <button
                    onClick={selectAllFiltered}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    Select All Filtered
                  </button>
                  <button
                    onClick={clearSelection}
                    className="px-3 py-2 text-gray-600 hover:text-gray-800 transition-colors text-sm"
                  >
                    Clear All
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Selection Summary */}
          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Users selected:</span>
                <span className="font-medium">{selectedUsers.size}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Target accounts to create:</span>
                <span className="font-medium">{userMappings.filter(m => selectedUsers.has(m.user.id)).length}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Strategy:</span>
                <span className="font-medium">{mappingType?.replace('-', ' to ').toUpperCase() || 'Not specified'}</span>
              </div>
            </div>
            
            {/* Show single super admin info */}
            {migrationScenario === 'single-super-admin' && sourceAdminEmail && (
              <div className="mt-2 pt-2 border-t border-gray-200">
                <div className="text-sm text-green-700">
                  <span className="font-medium">Single Super Admin Mode:</span> Using {sourceAdminEmail} for all target domain operations
                </div>
              </div>
            )}
            
            {/* Show merged users count if applicable */}
            {Array.from(selectedUsers).some(userId => {
              const user = discoveredUsers.find(u => u.id === userId);
              return user?.sourceUsers && user.sourceUsers.length > 1;
            }) && (
              <div className="mt-2 pt-2 border-t border-gray-200">
                <div className="text-sm text-blue-700">
                  <span className="font-medium">
                    {Array.from(selectedUsers).filter(userId => {
                      const user = discoveredUsers.find(u => u.id === userId);
                      return user?.sourceUsers && user.sourceUsers.length > 1;
                    }).length}
                  </span> merged users (combining accounts from multiple source domains)
                </div>
              </div>
            )}
          </div>

          {/* User List */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {/* Group users and show all their target mappings */}
            {Array.from(new Set(filteredUsers.map(u => u.id))).map(userId => {
              const user = filteredUsers.find(u => u.id === userId);
              if (!user) return null;
              
              const userMappingsForThisUser = userMappings.filter(m => m.user.id === userId);
              
              return (
                <div key={userId} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={selectedUsers.has(userId)}
                        onChange={() => toggleUserSelection(userId)}
                        className="h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                      />
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium text-gray-900">{user.name.fullName}</h4>
                          {user.isAdmin && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              <Shield className="h-3 w-3 mr-1" />
                              Admin
                            </span>
                          )}
                          {user.sourceUsers && user.sourceUsers.length > 1 && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              Merged from {user.sourceUsers.length} sources
                            </span>
                          )}
                        </div>
                        
                        {/* Show merged user information or regular email */}
                        {user.sourceUsers && user.sourceUsers.length > 1 ? (
                          <div className="text-sm text-gray-600">
                            <div>Primary: {user.sourceUsers[0]?.primaryEmail}</div>
                            <div className="text-xs text-gray-500">
                              Also from: {user.sourceUsers.slice(1).map(u => `${u.primaryEmail} (${u.sourceDomain})`).join(', ')}
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-gray-600">{user.primaryEmail}</div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <ArrowRight className="h-4 w-4 text-gray-400" />
                      <div className="text-right">
                        {userMappingsForThisUser.length === 1 ? (
                          <div>
                            <div className="font-medium text-gray-900">{userMappingsForThisUser[0].targetEmail}</div>
                            <div className="text-sm text-gray-600">{userMappingsForThisUser[0].targetDomain}</div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="text-sm font-medium text-gray-900">
                              {userMappingsForThisUser.length} target domains
                            </div>
                            {userMappingsForThisUser.map((mapping, idx) => (
                              <div key={idx} className="text-xs text-gray-600">
                                {mapping.targetEmail}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Show multiple target domains if applicable */}
                  {userMappingsForThisUser.length > 1 && (
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <div className="text-sm text-gray-600 mb-1">Target domains:</div>
                      <div className="flex flex-wrap gap-2">
                        {userMappingsForThisUser.map((mapping, idx) => (
                          <span key={idx} className="inline-flex items-center px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-xs">
                            {mapping.targetDomain}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 3: Creation */}
      {currentStep === 'creation' && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <UserPlus className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Target User Creation</h3>
                <p className="text-gray-600">
                  {isCreating ? 'Creating users in target domains...' : 'Ready to create users'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              {isCreating && (
                <button
                  onClick={() => setIsPaused(!isPaused)}
                  className="px-3 py-2 text-gray-600 hover:text-gray-800 transition-colors flex items-center space-x-2"
                >
                  {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                  <span>{isPaused ? 'Resume' : 'Pause'}</span>
                </button>
              )}
              
              {!isCreating && (
                <button
                  onClick={createAllUsers}
                  disabled={selectedUsers.size === 0 || !hasValidTargetAdminEmails().isValid}
                  className={`px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
                    selectedUsers.size > 0 && hasValidTargetAdminEmails().isValid
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <Zap className="h-4 w-4" />
                  <span>Start Creation</span>
                </button>
              )}
            </div>
          </div>

          {/* Target Admin Email Validation Error */}
          {!hasValidTargetAdminEmails().isValid && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <span className="font-medium text-red-900">
                  {migrationScenario === 'single-super-admin' 
                    ? 'Source Admin Email Configuration Required'
                    : 'Target Domain Admin Configuration Required'
                  }
                </span>
              </div>
              <div className="mt-2 text-sm text-red-800">
                {migrationScenario === 'single-super-admin' ? (
                  <div>
                    <p>For Single Super Admin migration, the same admin email manages both source and target domains.</p>
                    <p className="mt-1">
                      {sourceAdminEmail 
                        ? `Using admin email: ${sourceAdminEmail} for all target domains.`
                        : 'Please configure the source admin email in the delegation setup step.'
                      }
                    </p>
                    {!sourceAdminEmail && (
                      <p className="mt-2 font-medium">
                        Target domains that will use this admin email: {hasValidTargetAdminEmails().missingDomains.join(', ')}
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <p>Admin emails are missing for the following target domains:</p>
                    <ul className="mt-1 list-disc list-inside">
                      {hasValidTargetAdminEmails().missingDomains.map(domain => (
                        <li key={domain}>
                          <span className="font-medium">{domain}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2">Please configure admin emails for these domains in the delegation setup step before proceeding with user creation.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Progress Bar */}
          {isCreating && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  Processing batch {currentBatch} of {totalBatches}
                </span>
                {estimatedTimeRemaining && (
                  <span className="text-sm text-gray-600">
                    ETA: {estimatedTimeRemaining}
                  </span>
                )}
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(currentBatch / totalBatches) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Creation Results */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {userMappings
              .filter(mapping => selectedUsers.has(mapping.user.id))
              .map(mapping => (
                <div key={`${mapping.user.id}-${mapping.targetDomain}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${
                      mapping.status === 'created' ? 'bg-green-500' :
                      mapping.status === 'failed' ? 'bg-red-500' :
                      mapping.status === 'creating' ? 'bg-yellow-500 animate-pulse' :
                      'bg-gray-300'
                    }`} />
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-medium text-gray-900">{mapping.user.name.fullName}</h4>
                        {mapping.user.sourceUsers && mapping.user.sourceUsers.length > 1 && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            Merged
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600">{mapping.targetEmail}</div>
                      {mapping.user.sourceUsers && mapping.user.sourceUsers.length > 1 && (
                        <div className="text-xs text-blue-600 mt-1">
                          From {mapping.user.sourceUsers.length} source accounts
                        </div>
                      )}
                      {mapping.error && (
                        <div className="text-sm text-red-600 max-w-md">
                          {mapping.error}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {mapping.status === 'created' && <CheckCircle className="h-4 w-4 text-green-600" />}
                    {mapping.status === 'failed' && <XCircle className="h-4 w-4 text-red-600" />}
                    {mapping.status === 'creating' && <RefreshCw className="h-4 w-4 text-yellow-600 animate-spin" />}
                    {mapping.status === 'pending' && <Clock className="h-4 w-4 text-gray-400" />}
                    
                    <span className={`text-sm font-medium ${
                      mapping.status === 'created' ? 'text-green-600' :
                      mapping.status === 'failed' ? 'text-red-600' :
                      mapping.status === 'creating' ? 'text-yellow-600' :
                      'text-gray-500'
                    }`}>
                      {mapping.status ? mapping.status.charAt(0).toUpperCase() + mapping.status.slice(1) : 'Pending'}
                    </span>
                  </div>
                </div>
              ))}
          </div>

          {/* Error Summary */}
          {creationResults.some(r => !r.success) && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center space-x-2 mb-3">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <span className="font-medium text-red-900">Creation Issues Summary</span>
              </div>
              
              {/* Group errors by type */}
              {(() => {
                const errorGroups = new Map<string, string[]>();
                creationResults.filter(r => !r.success).forEach(result => {
                  if (result.error) {
                    let errorType = 'Unknown Error';
                    if (result.error.includes('Domain user limit reached')) {
                      errorType = 'Domain User Limit Reached';
                    } else if (result.error.includes('already exists')) {
                      errorType = 'User Already Exists';
                    } else if (result.error.includes('quota')) {
                      errorType = 'API Quota Exceeded';
                    } else if (result.error.includes('Invalid email')) {
                      errorType = 'Invalid Email Format';
                    } else if (result.error.includes('permissions')) {
                      errorType = 'Permission Issues';
                    }
                    
                    if (!errorGroups.has(errorType)) {
                      errorGroups.set(errorType, []);
                    }
                    errorGroups.get(errorType)!.push(`${result.targetEmail} (${result.targetDomain})`);
                  }
                });

                return Array.from(errorGroups.entries()).map(([errorType, affectedUsers]) => (
                  <div key={errorType} className="mb-3 last:mb-0">
                    <div className="text-sm font-medium text-red-800 mb-1">{errorType}:</div>
                    <div className="text-sm text-red-700 pl-4">
                      {errorType === 'Domain User Limit Reached' && (
                        <div className="mb-2 p-2 bg-red-100 rounded text-xs">
                          <strong>Solution:</strong> Contact Google Workspace Support to increase user limits for affected domains, 
                          or remove existing inactive users to free up space.
                        </div>
                      )}
                      {errorType === 'User Already Exists' && (
                        <div className="mb-2 p-2 bg-yellow-100 rounded text-xs">
                          <strong>Note:</strong> These users have already been created in the target domain. 
                          You can skip them or update their information if needed.
                        </div>
                      )}
                      <ul className="list-disc list-inside space-y-1">
                        {affectedUsers.map((user, idx) => (
                          <li key={idx} className="text-xs">{user}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
        </div>
      )}

      {/* Step 4: Complete */}
      {currentStep === 'complete' && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-center mb-6">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-green-100 rounded-full">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Workflow Complete</h3>
            <p className="text-gray-600">
              Successfully processed {discoveredUsers.length} users with {stats.created} created and {stats.failed} failed
            </p>
          </div>

          {/* Final Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{discoveredUsers.length}</div>
              <div className="text-sm text-gray-600">Users Discovered</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.created}</div>
              <div className="text-sm text-gray-600">Users Created</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
              <div className="text-sm text-gray-600">Creation Failed</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

UserManagementWorkflow.displayName = 'UserManagementWorkflow';

export default UserManagementWorkflow;
