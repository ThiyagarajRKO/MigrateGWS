'use client';

import { useState, useEffect, memo, useCallback, useMemo, useRef } from 'react';
// Import types with fallbacks
import type { UserMappingRelationship, UserMappingConfig } from '@/types/index';
import type { DomainMappingConfig } from '@/types/migration-scenarios';
// Import enhanced verification token utilities
import { 
  generateEnhancedVerificationToken,
  parseEnhancedVerificationToken,
  isEnhancedTokenValidForDomains,
  isTokenCorrupted,
  getAdminEmailFromEnhancedToken,
  type EnhancedVerificationTokenData,
  type DelegationStatus 
} from '@/lib/enhanced-verification-token';
import { 
  Users, 
  UserPlus, 
  Search, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  ArrowRight,
  ArrowLeft,
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
  Zap,
  Copy
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
  // Clone detection properties
  isCloned?: boolean;
  clonedTargetEmails?: string[];
  clonedInDomains?: string[];
  // Exclusion flag
  hasExclude?: boolean;
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
  verificationToken?: string; // Add verification token prop
  useServiceAccount?: boolean; // Add service account flag
  onComplete?: (results: {
    discoveredUsers: User[];
    createdUsers: CreationResult[];
    mappings: UserMapping[];
    sourceToTargetMapping?: any;
    userPairs?: Array<{
      sourceUser: {
        id: string;
        email: string;
        name: string;
        domain: string;
        isAdmin: boolean;
        adminEmail: string;
      };
      targetUser: {
        email: string;
        domain: string;
        adminEmail: string;
        exists: boolean;
        created: boolean;
      };
      mappingId: string;
      status: string;
    }>;
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
  verificationToken, // Extract verification token prop
  useServiceAccount = false, // Extract service account flag
  onComplete
}: UserManagementWorkflowProps) {
  // Core state
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('discovery');
  const [discoveredUsers, setDiscoveredUsers] = useState<User[]>([]);
  const [userMappings, setUserMappings] = useState<UserMapping[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  
  // Render counter for debugging (after state declarations)
  const renderCount = useRef(0);
  renderCount.current += 1;
  console.log('[UserManagementWorkflow] Render #', renderCount.current, 'currentStep:', currentStep);
  
  // Discovery state
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryProgress, setDiscoveryProgress] = useState<{[domain: string]: {loading: boolean, users: User[], error?: string}}>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [isCheckingExistingUsers, setIsCheckingExistingUsers] = useState(false);
  
  // Target domain users state
  const [targetDomainUsers, setTargetDomainUsers] = useState<{[domain: string]: User[]}>({});
  const [targetDiscoveryProgress, setTargetDiscoveryProgress] = useState<{[domain: string]: {loading: boolean, users: User[], error?: string}}>({});
  const [existingUserStatus, setExistingUserStatus] = useState<{[userEmail: string]: {exists: boolean, targetDomain: string, error?: string}}>({});
  const [userCheckCache, setUserCheckCache] = useState<{[cacheKey: string]: {timestamp: number, status: typeof existingUserStatus}}>({});
  
  // Creation state
  const [isCreating, setIsCreating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [creationResults, setCreationResults] = useState<CreationResult[]>([]);
  const [currentBatch, setCurrentBatch] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<string>('');
  const [userCreationSkipped, setUserCreationSkipped] = useState(false);

  // Ref to prevent multiple onComplete calls
  const hasCalledOnComplete = useRef(false);
  
  // Ref to prevent auto-discovery from running multiple times
  const hasAutoStartedDiscovery = useRef(false);

  // Enhanced verification token state and utilities
  const [enhancedTokenData, setEnhancedTokenData] = useState<EnhancedVerificationTokenData | null>(null);
  const [tokenGenerationError, setTokenGenerationError] = useState<string | null>(null);

  // Parse existing verification token if provided
  useEffect(() => {
    if (verificationToken) {
      try {
        console.log('[UserManagementWorkflow] Attempting to parse verification token...');
        console.log('[UserManagementWorkflow] Token length:', verificationToken.length);
        console.log('[UserManagementWorkflow] Token first 50 chars:', verificationToken.substring(0, 50));
        
        // First check if token is corrupted
        if (isTokenCorrupted(verificationToken)) {
          console.warn('[UserManagementWorkflow] Token appears to be corrupted, skipping parse');
          setEnhancedTokenData(null);
          return;
        }
        
        const parsedData = parseEnhancedVerificationToken(verificationToken);
        if (parsedData) {
          setEnhancedTokenData(parsedData);
          console.log('[UserManagementWorkflow] Parsed enhanced verification token:', {
            verificationId: parsedData.verificationId,
            verifiedDomains: parsedData.verifiedDomains,
            timestamp: parsedData.timestamp
          });
        } else {
          console.warn('[UserManagementWorkflow] Failed to parse verification token - token is invalid or corrupted');
          // Don't throw an error, just continue without the token data
          setEnhancedTokenData(null);
        }
      } catch (error) {
        console.error('[UserManagementWorkflow] Error parsing verification token:', error);
        // Reset token data if parsing fails
        setEnhancedTokenData(null);
      }
    } else {
      console.log('[UserManagementWorkflow] No verification token provided');
      setEnhancedTokenData(null);
    }
  }, [verificationToken]);

  // Enhanced verification token utilities
  const enhancedVerificationUtils = {
    generateToken: (domains: string[], adminEmails: { [domain: string]: string }, scenario: 'single-super-admin' | 'cross-tenant') => {
      try {
        const delegationStatus: DelegationStatus = {
          source: { verified: true },
          dest: { verified: true }
        };
        
        const token = generateEnhancedVerificationToken(
          domains,
          adminEmails,
          scenario,
          delegationStatus,
          {
            enableSigning: true,
            enableEncryption: false,
            expirationMinutes: 1440 // 24 hours
          }
        );
        
        // Parse the generated token to get data
        const tokenData = parseEnhancedVerificationToken(token);
        setEnhancedTokenData(tokenData);
        setTokenGenerationError(null);
        
        return token;
      } catch (error) {
        console.error('[UserManagementWorkflow] Failed to generate enhanced verification token:', error);
        setTokenGenerationError(error instanceof Error ? error.message : 'Unknown error');
        return null;
      }
    },
    
    validateToken: (token: string, domains: string[]) => {
      try {
        return isEnhancedTokenValidForDomains(token, domains);
      } catch (error) {
        console.error('[UserManagementWorkflow] Token validation failed:', error);
        return false;
      }
    },
    
    getAdminEmail: (token: string, domain: string) => {
      try {
        return getAdminEmailFromEnhancedToken(token, domain);
      } catch (error) {
        console.error('[UserManagementWorkflow] Failed to get admin email from token:', error);
        return null;
      }
    },
    
    hasValidToken: () => {
      return !!(verificationToken && enhancedTokenData);
    },
    
    getCurrentToken: () => verificationToken,
    
    getTokenData: () => enhancedTokenData
  };
  
  // Service account verification state
  const [isVerifyingServiceAccount, setIsVerifyingServiceAccount] = useState(false);
  const [serviceAccountVerified, setServiceAccountVerified] = useState(false);
  
  // Configuration
  const batchSize = 3; // Small batches to avoid rate limiting
  const retryAttempts = 3;
  
  // Service account verification function
  const verifyServiceAccount = useCallback(async () => {
    if (!useServiceAccount) {
      console.log('[UserManagementWorkflow] Service account not enabled, skipping verification');
      return;
    }

    setIsVerifyingServiceAccount(true);
    console.log('[UserManagementWorkflow] Starting service account verification');

    try {
      // Use the first source domain for verification, or a default domain
      const testDomain = sourceDomains[0] || 'rrgokuldham.com';
      const testAdminEmail = sourceAdminEmails?.[testDomain] || sourceAdminEmail || `admin@${testDomain}`;
      
      console.log('[UserManagementWorkflow] Testing service account with domain:', testDomain, 'admin:', testAdminEmail);

      // Call the verification endpoint with actual domain
      const response = await fetch('/api/v1/delegation/verify', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          domain: testDomain,
          adminEmail: testAdminEmail,
          migrationScenario: migrationScenario || 'cross-tenant',
          useServiceAccount: true
        })
      });

      const verificationData = await response.json();
      console.log('[UserManagementWorkflow] Service account verification response:', verificationData);

      if (response.ok && verificationData.success) {
        setServiceAccountVerified(true);
        console.log('[UserManagementWorkflow] Service account verified successfully for domain:', testDomain);
      } else {
        throw new Error(verificationData.error || verificationData.message || 'Service account verification failed');
      }
    } catch (error) {
      console.error('[UserManagementWorkflow] Service account verification failed:', error);
      setServiceAccountVerified(false);
      // Don't throw error, just log it - we'll fall back to regular admin email validation
    } finally {
      setIsVerifyingServiceAccount(false);
    }
  }, [useServiceAccount, sourceDomains, sourceAdminEmails, sourceAdminEmail, migrationScenario]);

  // Verify service account on mount if enabled
  useEffect(() => {
    if (useServiceAccount && !serviceAccountVerified && !isVerifyingServiceAccount) {
      verifyServiceAccount();
    }
  }, [useServiceAccount, serviceAccountVerified, isVerifyingServiceAccount, verifyServiceAccount]);
  
  // Helper functions
  // Helper function to get users that exist in multiple source domains (for many-to-one)
  const getUsersWithMultiDomainAccounts = (users: User[]): User[] => {
    if (mappingType !== 'many-to-one') return users;
    
    // Group users by normalized name
    const usersByName = new Map<string, User[]>();
    users.forEach(user => {
      const nameKey = normalizeUserName(user);
      if (!usersByName.has(nameKey)) {
        usersByName.set(nameKey, []);
      }
      usersByName.get(nameKey)!.push(user);
    });

    // For many-to-one scenarios, we need to handle different cases:
    // 1. Single Super Admin: Users from different source domains that should be merged
    // 2. Cross-tenant: Users from different organizations/tenants that should be merged
    // 3. Multi-domain consolidation: Users from multiple domains within same org
    
    const multiDomainUsers: User[] = [];
    usersByName.forEach((usersWithSameName, nameKey) => {
      // For many-to-one, we want to show users that can be consolidated
      if (usersWithSameName.length > 1) {
        const uniqueDomains = Array.from(new Set(usersWithSameName.map(u => u.sourceDomain).filter(Boolean)));
        
        // Include users if they exist across multiple domains OR
        // if we have multiple user accounts with same name (potential duplicates)
        if (uniqueDomains.length > 1 || usersWithSameName.length > 1) {
          // These users can be consolidated into a single target account
          multiDomainUsers.push(...usersWithSameName);
        }
      }
    });

    console.log('Multi-domain users for many-to-one migration:', {
      migrationScenario,
      mappingType,
      totalUsers: users.length,
      multiDomainUsers: multiDomainUsers.length,
      sourceDomains: sourceDomains,
      breakdown: Array.from(usersByName.entries())
        .filter(([_, users]) => users.length > 1)
        .map(([name, users]) => ({
          name,
          domains: Array.from(new Set(users.map(u => u.sourceDomain).filter(Boolean))),
          emails: users.map(u => u.primaryEmail),
          count: users.length
        }))
    });

    return multiDomainUsers;
  };

  const normalizeUserName = useCallback((user: User): string => {
    const cleanName = (name: string): string => {
      return name?.toLowerCase().trim().replace(/[^a-z0-9]/g, '') || '';
    };
    
    const firstName = cleanName(user.name.givenName);
    // Don't use period as lastName to avoid double dots in email
    const originalFamilyName = user.name.familyName?.trim() || '';
    const lastName = originalFamilyName === '.' ? '' : cleanName(user.name.familyName);
    
    if (firstName && lastName) {
      return `${firstName}${lastName}`;
    } else if (firstName) {
      return firstName;
    } else if (lastName) {
      return lastName;
    } else {
      // Fallback to email username
      const emailUsername = user.primaryEmail.split('@')[0];
      return cleanName(emailUsername) || 'user';
    }
  }, []);

  const getEffectiveTargetAdminEmails = useCallback((): {[domain: string]: string} => {
    // If service account authentication is enabled, still use real admin emails for impersonation
    if (useServiceAccount) {
      const effectiveEmails: {[domain: string]: string} = {};
      
      // Get all unique target domains from current mappings or provided domains
      const actualTargetDomains = Array.from(new Set(userMappings.map(m => m.targetDomain)));
      const domainsToConfig = actualTargetDomains.length > 0 ? actualTargetDomains : targetDomains;
      
      domainsToConfig.forEach(domain => {
        // For service account auth, we still need real admin emails for impersonation
        // Try to get from targetAdminEmails first, then use common admin patterns
        const realAdminEmail = targetAdminEmails?.[domain] || `admin@${domain}`;
        effectiveEmails[domain] = realAdminEmail;
      });
      
      console.log('[UserManagementWorkflow] Service account - Using real admin emails for impersonation:', {
        useServiceAccount,
        domainsToConfig,
        effectiveEmails
      });
      
      return effectiveEmails;
    }

    // For single-super-admin scenario, use the same source admin email for all target domains
    if (migrationScenario === 'single-super-admin' && sourceAdminEmail) {
      const effectiveEmails: {[domain: string]: string} = {};
      
      // Get all unique target domains from current mappings
      const actualTargetDomains = Array.from(new Set(userMappings.map(m => m.targetDomain)));
      
      // If no mappings yet, fall back to provided target domains
      const domainsToConfig = actualTargetDomains.length > 0 ? actualTargetDomains : targetDomains;
      
      domainsToConfig.forEach(domain => {
        effectiveEmails[domain] = sourceAdminEmail;
      });
      
      console.log('Single Super Admin - Effective target admin emails:', {
        migrationScenario,
        sourceAdminEmail,
        targetDomains,
        actualTargetDomains,
        domainsToConfig,
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
  }, [useServiceAccount, userMappings, targetDomains, targetAdminEmails, migrationScenario, sourceAdminEmail]);

  const generateTargetEmail = (user: User, targetDomain: string): string => {
    // Clean and validate name components, but preserve period in family name if it was the original value
    const cleanName = (name: string): string => {
      return name?.toLowerCase().trim().replace(/[^a-z0-9]/g, '') || '';
    };
    
    const firstName = cleanName(user.name.givenName);
    // Preserve period in family name if it was the original value
    const originalFamilyName = user.name.familyName?.trim() || '';
    const lastName = originalFamilyName === '.' ? '' : cleanName(user.name.familyName); // Don't use period as lastName
    
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
    
    // Ensure emailBase is not empty and doesn't have consecutive dots
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

  const getTargetDomainConfigurationStatus = useCallback((): { isValid: boolean, missingDomains: string[], message?: string } => {
    // If service account authentication is enabled and verified, bypass admin email requirements
    if (useServiceAccount && (serviceAccountVerified || enhancedVerificationUtils.hasValidToken())) {
      console.log('[UserManagementWorkflow] Service account authentication verified - bypassing target domain admin email requirements', {
        serviceAccountVerified,
        hasVerificationToken: enhancedVerificationUtils.hasValidToken(),
        tokenData: enhancedVerificationUtils.getTokenData()
      });
      return { isValid: true, missingDomains: [] };
    }

    // Get all target domains that will be used in mappings
    const allTargetDomains = Array.from(new Set(userMappings.map(m => m.targetDomain)));
    
    if (allTargetDomains.length === 0) {
      return { isValid: true, missingDomains: [] };
    }

    const effectiveTargetAdminEmails = getEffectiveTargetAdminEmails();
    const missingDomains = allTargetDomains.filter(domain => !effectiveTargetAdminEmails[domain]);
    
    if (missingDomains.length === 0) {
      return { isValid: true, missingDomains: [] };
    }

    const message = migrationScenario === 'single-super-admin'
      ? `Single Super Admin scenario detected, but source admin email is not configured for target domains: ${missingDomains.join(', ')}. Please ensure your source admin email has domain-wide delegation rights for these target domains.`
      : `Target domain admin configuration required for: ${missingDomains.join(', ')}. Please configure admin emails for these domains in the delegation setup.`;

    return {
      isValid: false,
      missingDomains,
      message
    };
  }, [useServiceAccount, serviceAccountVerified, enhancedVerificationUtils, userMappings, getEffectiveTargetAdminEmails, migrationScenario]);

  const hasValidAdminEmails = (): boolean => {
    // For single-super-admin scenario, we only need one admin email for all domains
    if (migrationScenario === 'single-super-admin') {
      return !!(sourceAdminEmail && sourceAdminEmail.trim() !== '');
    }
    
    // For cross-tenant scenario, each domain needs its own admin email
    return sourceDomains.every(domain => {
      const adminEmail = sourceAdminEmails?.[domain] || sourceAdminEmail;
      return adminEmail && adminEmail.trim() !== '';
    });
  };

  const generateInitialMappings = useCallback((users: User[]): UserMapping[] => {
    if (users.length === 0) return [];

    const mappings: UserMapping[] = [];

    // Use domain mappings from the auth step if available
    if (domainMapping && (domainMapping.targetDomains?.length || domainMapping.targetDomain)) {
      console.log('Using configured domain mapping:', domainMapping);
      
      const sourceDomains = domainMapping.sourceDomains || [];
      const targetDomains = domainMapping.targetDomains || (domainMapping.targetDomain ? [domainMapping.targetDomain] : []);
      
      if (targetDomains.length === 0) {
        console.log('No target domains configured in domain mapping');
        return mappings;
      }

      // Filter users that belong to the source domains for this mapping
      const mappingUsers = users.filter(user => 
        sourceDomains.length === 0 || sourceDomains.includes(user.sourceDomain || '')
      );
      
      if (mappingUsers.length === 0) {
        console.log(`No users found for source domains: ${sourceDomains.join(', ')}`);
        return mappings;
      }

      // Generate user mappings based on the mapping type
      switch (mappingType) {
        case 'one-to-one':
          mappingUsers.forEach((user, index) => {
            const targetDomain = targetDomains[index % targetDomains.length];
            mappings.push({
              user,
              targetDomain,
              targetEmail: generateTargetEmail(user, targetDomain),
              status: 'pending'
            });
          });
          break;

        case 'one-to-many':
          mappingUsers.forEach(user => {
            targetDomains.forEach((targetDomain: string) => {
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
          // Group users by normalized name for merging
          const usersByName = new Map<string, User[]>();
          mappingUsers.forEach(user => {
            const nameKey = normalizeUserName(user);
            if (!usersByName.has(nameKey)) {
              usersByName.set(nameKey, []);
            }
            usersByName.get(nameKey)!.push(user);
          });

          console.log('Merging users from multiple source domains:', {
            sourceDomains,
            targetDomains,
            totalUsers: mappingUsers.length,
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
            const sourceEmailsList = usersWithSameName.map(u => u.primaryEmail);
            const sourceDomainsForUser = usersWithSameName.map(u => u.sourceDomain).filter(Boolean);
            const allEmails = sourceEmailsList.join(', ');
            const sourceDomainString = sourceDomainsForUser.sort().join(', '); // Sort for consistency
            
            // Merge user properties
            const mergedUser: User = {
              ...primaryUser,
              id: `merged-${nameKey}-${usersWithSameName.map(u => u.id).sort().join('-')}`, // Sort for consistency
              primaryEmail: allEmails, // Show all source emails
              name: {
                fullName: primaryUser.name.fullName,
                givenName: primaryUser.name.givenName,
                familyName: primaryUser.name.familyName
              },
              isAdmin: usersWithSameName.some(u => u.isAdmin), // True if any source user is admin
              suspended: usersWithSameName.every(u => u.suspended), // Only suspended if all are suspended
              sourceDomain: sourceDomainString, // Use consistent sorted string
              // Custom properties for tracking merge
              sourceUsers: usersWithSameName,
              mergedFromDomains: sourceDomainsForUser.sort() // Sort for consistency
            } as User & { sourceUsers: User[], mergedFromDomains: string[] };
            
            // Create mapping to each target domain
            targetDomains.forEach((targetDomain: string) => {
              mappings.push({
                user: mergedUser,
                targetDomain,
                targetEmail: generateTargetEmail(primaryUser, targetDomain),
                status: 'pending'
              });
            });
          });
          break;

        default:
          // Default: round-robin assignment
          mappingUsers.forEach((user, index) => {
            const targetDomain = targetDomains[index % targetDomains.length];
            mappings.push({
              user,
              targetDomain,
              targetEmail: generateTargetEmail(user, targetDomain),
              status: 'pending'
            });
          });
      }

      console.log(`Generated ${mappings.length} user mappings from domain mapping configuration`);
      return mappings;
    }

    // Fallback: Use old logic if no domain mappings are configured
    console.log('No domain mappings configured, using fallback logic with all domains');
    if (targetDomains.length === 0) return [];

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
          const sourceDomainString = sourceDomains.sort().join(', '); // Sort for consistency
          
          // Merge user properties
          const mergedUser: User = {
            ...primaryUser,
            id: `merged-${nameKey}-${usersWithSameName.map(u => u.id).sort().join('-')}`, // Sort for consistency
            primaryEmail: allEmails, // Show all source emails
            name: {
              fullName: primaryUser.name.fullName,
              givenName: primaryUser.name.givenName,
              familyName: primaryUser.name.familyName
            },
            isAdmin: usersWithSameName.some(u => u.isAdmin), // True if any source user is admin
            suspended: usersWithSameName.every(u => u.suspended), // Only suspended if all are suspended
            sourceDomain: sourceDomainString, // Use consistent sorted string
            // Custom properties for tracking merge
            sourceUsers: usersWithSameName,
            mergedFromDomains: sourceDomains.sort() // Sort for consistency
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
  }, [targetDomains, mappingType, domainMapping, generateTargetEmail]);

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
        
        // Generate or use existing verification token to bypass delegation verification
        let activeVerificationToken: string | null = enhancedVerificationUtils.getCurrentToken() || null;
        
        // If no token exists, generate one to bypass delegation verification
        if (!activeVerificationToken) {
          console.log(`[discoverUsers] Generating enhanced verification token for ${domain} to bypass delegation`);
          
          const verifiedDomains = [domain];
          const adminEmails = { [domain]: adminEmail };
          
          const generatedToken = enhancedVerificationUtils.generateToken(
            verifiedDomains,
            adminEmails,
            migrationScenario || 'cross-tenant'
          );
          
          if (generatedToken) {
            activeVerificationToken = generatedToken;
            console.log(`[discoverUsers] Generated enhanced verification token for ${domain}:`, {
              tokenLength: activeVerificationToken.length,
              adminEmail: adminEmail,
              verificationId: enhancedVerificationUtils.getTokenData()?.verificationId
            });
          }
        }
        
        // Use the proper delegation verification endpoint
        const verificationResponse = await fetch('/api/v1/delegation/verify', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            // Include verification token if available
            ...(activeVerificationToken && { 'X-Verification-Token': activeVerificationToken })
          },
          credentials: 'include',
          body: JSON.stringify({
            domain,
            adminEmail,
            migrationScenario: migrationScenario || 'cross-tenant',
            useServiceAccount,
            verificationToken: activeVerificationToken
          })
        });

        const verificationData = await verificationResponse.json();
        console.log(`Delegation verification for ${domain}:`, { 
          status: verificationResponse.status, 
          data: verificationData 
        });

        if (!verificationResponse.ok || !verificationData.success) {
          // If delegation verification fails but we have a verification token, continue anyway
          if (activeVerificationToken) {
            console.log(`[discoverUsers] Delegation verification failed for ${domain}, but continuing with verification token bypass`);
          } else {
            throw new Error(`Delegation not verified for ${domain}: ${verificationData.error || verificationData.message || 'Domain-wide delegation not configured'}`);
          }
        } else {
          console.log(`✅ Delegation verified for ${domain}, proceeding with user discovery`);
        }

        // Now proceed with user discovery
        const params = new URLSearchParams({
          action: 'all-users',
          domain,
          includeSuspended: 'false',
          adminEmail
        });

        const usersResponse = await fetch(`/api/google-workspace?${params}`, {
          method: 'GET',
          headers: { 
            'Content-Type': 'application/json',
            // Include verification token if available
            ...(activeVerificationToken && { 'X-Verification-Token': activeVerificationToken })
          },
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
    // Start with no users selected - user must explicitly select
    setSelectedUsers(new Set());
    
    // Generate initial mappings and validate emails
    const mappings = generateInitialMappings(allUsers);
    
    // Log any potentially problematic email mappings
    mappings.forEach(mapping => {
      if (!validateEmail(mapping.targetEmail)) {
        console.warn(`Invalid target email generated: ${mapping.targetEmail} for user ${mapping.user.primaryEmail}`);
      }
    });
    
    setUserMappings(mappings);
    
    // Check if target users already exist
    await checkExistingTargetUsers(allUsers);
    
    setIsDiscovering(false);
    
    if (allUsers.length > 0) {
      setCurrentStep('mapping');
    }
  };

  // Auto-start discovery when component has necessary configuration
  useEffect(() => {
    // Only auto-start if:
    // 1. We're on the discovery step
    // 2. We have source domains
    // 3. We have admin emails configured
    // 4. We're not already discovering
    // 5. We haven't discovered users yet
    // 6. Service account is verified (if using service account) or not using service account
    // 7. We haven't already auto-started discovery
    const hasRequiredConfig = sourceDomains && sourceDomains.length > 0 && 
                             (sourceAdminEmails || sourceAdminEmail);
    const isReadyForDiscovery = currentStep === 'discovery' && 
                               !isDiscovering && 
                               discoveredUsers.length === 0 &&
                               hasRequiredConfig &&
                               !hasAutoStartedDiscovery.current;
    const serviceAccountReady = !useServiceAccount || serviceAccountVerified;

    if (isReadyForDiscovery && serviceAccountReady) {
      console.log('[UserManagementWorkflow] Auto-starting user discovery...');
      hasAutoStartedDiscovery.current = true;
      discoverUsers();
    }
  }, [currentStep, sourceDomains, sourceAdminEmails, sourceAdminEmail, isDiscovering, discoveredUsers.length, useServiceAccount, serviceAccountVerified, discoverUsers]);

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
      // Preserve period in family name if it was the original value
      const originalFamilyName = mapping.user.name.familyName?.trim() || '';
      const familyName = originalFamilyName === '.' ? '.' : cleanName(mapping.user.name.familyName);
      
      if (!givenName && !familyName) {
        console.warn(`User ${mapping.user.primaryEmail} has no valid name components, using email-based username`);
      }
      
      // Use email username as fallback if both names are missing, but preserve period if it was the original family name
      const emailUsername = mapping.user.primaryEmail.split('@')[0];
      const finalGivenName = givenName || emailUsername;
      const finalFamilyName = familyName || (originalFamilyName === '.' ? '.' : 'User');

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

      // Generate or use existing verification token to bypass domain-wide delegation
      let activeVerificationToken: string | null = enhancedVerificationUtils.getCurrentToken() || null;
      
      // If no token exists, generate one to bypass domain-wide delegation
      if (!activeVerificationToken) {
        console.log('[createTargetUser] No verification token found, generating enhanced token to bypass delegation');
        
        // Prepare domains and admin emails for token generation
        const verifiedDomains = [mapping.targetDomain];
        const adminEmails = { [mapping.targetDomain]: adminEmail };
        
        const generatedToken = enhancedVerificationUtils.generateToken(
          verifiedDomains,
          adminEmails,
          migrationScenario || 'cross-tenant'
        );
        
        if (generatedToken) {
          activeVerificationToken = generatedToken;
          console.log('[createTargetUser] Generated verification token to bypass delegation:', {
            targetDomain: mapping.targetDomain,
            tokenLength: (activeVerificationToken as string)?.length || 0,
            adminEmail: adminEmail
          });
        } else {
          console.warn('[createTargetUser] Failed to generate verification token, proceeding without it');
        }
      } else {
        console.log('[createTargetUser] Using existing enhanced verification token:', {
          tokenSource: 'enhanced-verification',
          tokenLength: activeVerificationToken.length,
          verificationId: enhancedVerificationUtils.getTokenData()?.verificationId
        });
      }

      console.log('Creating user with data:', {
        targetEmail: mapping.targetEmail,
        targetDomain: mapping.targetDomain,
        adminEmail,
        userData: userData,
        hasVerificationToken: !!activeVerificationToken,
        originalUser: {
          email: mapping.user.primaryEmail,
          givenName: mapping.user.name.givenName,
          familyName: mapping.user.name.familyName
        }
      });

      const response = await fetch('/api/google-workspace', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(activeVerificationToken && { 
            'X-Verification-Token': activeVerificationToken,
            'Authorization': `Bearer ${activeVerificationToken}` 
          })
        },
        body: JSON.stringify({
          action: 'create-user',
          data: {
            userData: userData,
            adminEmail,
            domain: mapping.targetDomain,
            verificationToken: activeVerificationToken
          },
          verificationToken: activeVerificationToken
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
      } else if (errorMessage.includes('Domain-wide delegation not configured') || 
                 errorMessage.includes('needs to be authorized in the Google Admin Console')) {
        errorMessage = `Domain-wide delegation required for ${mapping.targetDomain}. Please contact the administrator of ${mapping.targetDomain} to authorize the service account in Google Admin Console.`;
      } else if (errorMessage.includes('Not Authorized to access this resource/api')) {
        errorMessage = `Service account not authorized for ${mapping.targetDomain}. Domain-wide delegation must be configured by the target domain administrator.`;
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
        ? `Single Super Admin scenario detected, but source admin email is not configured. Please ensure you have:
1. Set up a single source admin email in the delegation setup
2. This admin email has domain-wide delegation rights for all target domains: ${missingAdminEmails.join(', ')}
3. Completed the domain-wide delegation setup for target domains

Missing configuration for target domains: ${missingAdminEmails.join(', ')}.`
        : `Target Domain Admin Configuration Required
Admin emails are missing for the following target domains:

${missingAdminEmails.map(domain => `• ${domain}`).join('\n')}

Please configure admin emails for these domains in the delegation setup step before proceeding with user creation.

For cross-tenant migration, each target domain requires its own admin email with domain-wide delegation permissions.`;
      
      // Show user-friendly alert
      alert(errorMessage);
      
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

  const filteredUsers = useMemo(() => 
    discoveredUsers.filter(user =>
      user.name.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.primaryEmail.toLowerCase().includes(searchTerm.toLowerCase())
    ), [discoveredUsers, searchTerm]);

  // Memoize unique user IDs to prevent re-rendering issues
  const uniqueUserIds = useMemo(() => 
    Array.from(new Set(filteredUsers.map(u => u.id))), 
    [filteredUsers]
  );

  const checkExistingTargetUsers = async (users: User[]) => {
    setIsCheckingExistingUsers(true);
    const effectiveTargetAdminEmails = getEffectiveTargetAdminEmails();
    const existingStatus: {[userEmail: string]: {exists: boolean, targetDomain: string, error?: string}} = {};

    // Generate mappings for all users to check
    const mappingsToCheck = generateInitialMappings(users);
    
    // Create cache key for this specific check
    const cacheKey = JSON.stringify({
      mappings: mappingsToCheck.map(m => ({ targetEmail: m.targetEmail, targetDomain: m.targetDomain })).sort(),
      adminEmails: effectiveTargetAdminEmails
    });
    
    // Check if we have a recent cache entry (within 2 minutes)
    const cachedResult = userCheckCache[cacheKey];
    const cacheAge = cachedResult ? Date.now() - cachedResult.timestamp : Infinity;
    const cacheExpiryTime = 2 * 60 * 1000; // 2 minutes
    
    if (cachedResult && cacheAge < cacheExpiryTime) {
      console.log('Using cached user check results (age:', Math.round(cacheAge / 1000), 'seconds)');
      setExistingUserStatus(cachedResult.status);
      setIsCheckingExistingUsers(false);
      
      // Update discovered users with cached clone information
      updateDiscoveredUsersWithCloneInfo(mappingsToCheck, cachedResult.status);
      return;
    }
    
    console.log('Checking existing target users (optimized):', {
      usersCount: users.length,
      mappingsToCheck: mappingsToCheck.length,
      effectiveTargetAdminEmails,
      hasCachedData: !!cachedResult,
      cacheAge: cachedResult ? Math.round(cacheAge / 1000) + 's' : 'none',
      sampleMappings: mappingsToCheck.slice(0, 3).map(m => ({
        targetEmail: m.targetEmail,
        targetDomain: m.targetDomain
      }))
    });

    if (mappingsToCheck.length === 0) {
      console.warn('No mappings to check for existing users');
      setIsCheckingExistingUsers(false);
      return;
    }

    // Group mappings by target domain for batch processing
    const mappingsByDomain = mappingsToCheck.reduce((acc, mapping) => {
      if (!acc[mapping.targetDomain]) {
        acc[mapping.targetDomain] = [];
      }
      acc[mapping.targetDomain].push(mapping);
      return acc;
    }, {} as {[domain: string]: typeof mappingsToCheck});

    console.log('Grouped mappings by domain:', Object.keys(mappingsByDomain).map(domain => ({
      domain,
      count: mappingsByDomain[domain].length
    })));

    // Process domains in parallel with batch checking
    const domainPromises = Object.entries(mappingsByDomain).map(async ([targetDomain, domainMappings]) => {
      const adminEmail = effectiveTargetAdminEmails[targetDomain];
      
      if (!adminEmail) {
        console.warn(`No admin email for target domain: ${targetDomain}`);
        domainMappings.forEach(mapping => {
          existingStatus[mapping.targetEmail] = {
            exists: false,
            targetDomain: mapping.targetDomain,
            error: `No admin email configured for ${targetDomain}`
          };
        });
        return;
      }

      try {
        // Batch check users in this domain
        const userEmails = domainMappings.map(m => m.targetEmail);
        console.log(`Batch checking ${userEmails.length} users in domain: ${targetDomain}`);
        
        const params = new URLSearchParams({
          action: 'batch-check-users',
          domain: targetDomain,
          userEmails: userEmails.join(','),
          adminEmail
        });

        const startTime = Date.now();
        const response = await fetch(`/api/google-workspace?${params}`, {
          method: 'GET',
          headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'max-age=60' // Cache for 1 minute
          },
          credentials: 'include'
        });
        const checkTime = Date.now() - startTime;

        const data = await response.json();
        
        console.log(`Batch check completed for ${targetDomain} in ${checkTime}ms:`, {
          status: response.status,
          totalUsers: userEmails.length,
          existingUsers: data.existingUsers?.length || 0,
          cached: data.cached || false
        });

        if (response.ok && data.existingUsers) {
          // Process batch results
          const existingEmails = new Set(data.existingUsers.map((user: any) => user.primaryEmail));
          
          domainMappings.forEach(mapping => {
            existingStatus[mapping.targetEmail] = {
              exists: existingEmails.has(mapping.targetEmail),
              targetDomain: mapping.targetDomain
            };
          });
        } else {
          // Fallback to individual checks if batch fails
          console.warn(`Batch check failed for ${targetDomain}, falling back to individual checks`);
          
          // Process individual checks in parallel (limited concurrency)
          const individualPromises = domainMappings.map(async (mapping, index) => {
            // Add small delay to prevent rate limiting
            if (index > 0) {
              await new Promise(resolve => setTimeout(resolve, 50 * index));
            }

            try {
              const params = new URLSearchParams({
                action: 'get-user',
                domain: mapping.targetDomain,
                userEmail: mapping.targetEmail,
                adminEmail
              });

              const response = await fetch(`/api/google-workspace?${params}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
              });

              const data = await response.json();
              
              if (response.ok && data.exists && data.user) {
                existingStatus[mapping.targetEmail] = {
                  exists: true,
                  targetDomain: mapping.targetDomain
                };
              } else {
                existingStatus[mapping.targetEmail] = {
                  exists: false,
                  targetDomain: mapping.targetDomain
                };
              }
            } catch (error) {
              console.error(`Error checking user ${mapping.targetEmail}:`, error);
              existingStatus[mapping.targetEmail] = {
                exists: false,
                targetDomain: mapping.targetDomain,
                error: error instanceof Error ? error.message : 'Unknown error'
              };
            }
          });

          await Promise.allSettled(individualPromises);
        }
      } catch (error) {
        console.error(`Error batch checking domain ${targetDomain}:`, error);
        domainMappings.forEach(mapping => {
          existingStatus[mapping.targetEmail] = {
            exists: false,
            targetDomain: mapping.targetDomain,
            error: error instanceof Error ? error.message : 'Network error'
          };
        });
      }
    });

    // Wait for all domain checks to complete
    await Promise.allSettled(domainPromises);

    console.log('Final existing user status (optimized):', {
      totalChecked: Object.keys(existingStatus).length,
      existingCount: Object.values(existingStatus).filter(s => s.exists).length,
      errorCount: Object.values(existingStatus).filter(s => s.error).length
    });
    
    setExistingUserStatus(existingStatus);
    
    // Cache the results for future use
    setUserCheckCache(prev => ({
      ...prev,
      [cacheKey]: {
        timestamp: Date.now(),
        status: existingStatus
      }
    }));
    
    // Update discovered users with clone information
    updateDiscoveredUsersWithCloneInfo(mappingsToCheck, existingStatus);
    
    setIsCheckingExistingUsers(false);
  };

  // Helper function to update discovered users with clone information
  const updateDiscoveredUsersWithCloneInfo = useCallback((mappingsToCheck: any[], existingStatus: typeof existingUserStatus) => {
    setDiscoveredUsers(prev => prev.map(user => {
      const userMappingsForUser = mappingsToCheck.filter(m => m.user.id === user.id);
      const clonedTargetEmails: string[] = [];
      const clonedInDomains: string[] = [];
      
      userMappingsForUser.forEach(mapping => {
        if (existingStatus[mapping.targetEmail]?.exists) {
          clonedTargetEmails.push(mapping.targetEmail);
          clonedInDomains.push(mapping.targetDomain);
        }
      });
      
      const isCloned = clonedTargetEmails.length > 0;
      
      return {
        ...user,
        isCloned,
        clonedTargetEmails: isCloned ? clonedTargetEmails : undefined,
        clonedInDomains: isCloned ? clonedInDomains : undefined
      };
    }));
  }, []);

  // Helper function to check if a user is cloned (has existing target mappings)
  const isUserCloned = useCallback((user: User): boolean => {
    // Check if user has any target mappings that already exist
    const userMappingsForUser = userMappings.filter(m => m.user.id === user.id);
    const hasExistingTargetUsers = userMappingsForUser.some(mapping => 
      existingUserStatus[mapping.targetEmail]?.exists
    );
    
    // Also check the legacy isCloned property for backward compatibility
    const legacyIsCloned = user.isCloned === true;
    const result = legacyIsCloned || hasExistingTargetUsers;
    
    return result;
  }, [userMappings, existingUserStatus]);

  // Helper function to get clone status details
  const getCloneStatusForUser = useCallback((user: User): { isCloned: boolean, clonedInDomains: string[], clonedTargetEmails: string[] } => {
    // Check if user has any target mappings that already exist
    const userMappingsForUser = userMappings.filter(m => m.user.id === user.id);
    const existingMappings = userMappingsForUser.filter(mapping => 
      existingUserStatus[mapping.targetEmail]?.exists
    );
    
    const hasExistingTargetUsers = existingMappings.length > 0;
    const clonedTargetEmails = existingMappings.map(m => m.targetEmail);
    const clonedInDomains = Array.from(new Set(existingMappings.map(m => m.targetDomain)));
    
    return {
      isCloned: user.isCloned || hasExistingTargetUsers,
      clonedInDomains: user.clonedInDomains || clonedInDomains,
      clonedTargetEmails: user.clonedTargetEmails || clonedTargetEmails
    };
  }, [userMappings, existingUserStatus]);

  // Memoize expensive calculations to prevent flickering
  const selectedMappingsCount = useMemo(() => 
    userMappings.filter(m => selectedUsers.has(m.user.id)).length,
    [userMappings, selectedUsers]
  );

  const mergedUsersCount = useMemo(() => 
    Array.from(selectedUsers).filter(userId => {
      const user = discoveredUsers.find(u => u.id === userId);
      return user?.sourceUsers && user.sourceUsers.length > 1;
    }).length,
    [selectedUsers, discoveredUsers]
  );

  const clonedUsers = useMemo(() => 
    discoveredUsers.filter(user => isUserCloned(user)),
    [discoveredUsers, isUserCloned]
  );

  const selectableUsers = useMemo(() => {
    // Filter out users who already exist in target domains
    const filtered = filteredUsers.filter(user => {
      // Check if user has any target mappings that already exist
      const userMappingsForUser = userMappings.filter(m => m.user.id === user.id);
      const hasExistingTargetUsers = userMappingsForUser.some(mapping => 
        existingUserStatus[mapping.targetEmail]?.exists
      );
      
      // Also check the legacy isCloned property for backward compatibility
      const legacyIsCloned = user.isCloned === true;
      
      // Check if user has hasExclude flag set to true
      const hasExcludeFlag = user.hasExclude === true;
      
      // ADDITIONAL CHECK: If user email already exists in any target domain
      // Extract username from source email and check if it exists in target domains
      const userName = user.primaryEmail.split('@')[0];
      const targetDomains = domainMapping?.targetDomains || (domainMapping?.targetDomain ? [domainMapping.targetDomain] : []);
      const hasEmailConflictInTarget = targetDomains.some(targetDomain => {
        const potentialTargetEmail = `${userName}@${targetDomain}`;
        return existingUserStatus[potentialTargetEmail]?.exists;
      });
      
      // If user already exists in any target domain, exclude them from selection
      const shouldExclude = legacyIsCloned || hasExistingTargetUsers || hasEmailConflictInTarget || hasExcludeFlag;
      
      return !shouldExclude;
    });
    
    return filtered;
  }, [filteredUsers, userMappings, existingUserStatus, domainMapping]);

  // Memoized user interaction functions to prevent re-renders
  const toggleUserSelection = useCallback((userId: string) => {
    // Find the user to check if it's cloned or excluded
    const user = discoveredUsers.find(u => u.id === userId);
    
    if (user && isUserCloned(user)) {
      console.log(`Cannot select user ${user.primaryEmail} - user is cloned in target domain(s):`, user.clonedInDomains);
      return; // Don't allow selection of cloned users
    }
    
    if (user && user.hasExclude) {
      console.log(`Cannot select user ${user.primaryEmail} - user is marked for exclusion`);
      return; // Don't allow selection of excluded users
    }
    
    setSelectedUsers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  }, [discoveredUsers, isUserCloned]);

  const selectAllFiltered = useCallback(() => {
    // Only select non-cloned users
    // Use memoized selectableUsers instead of filtering inline
    setSelectedUsers(new Set(selectableUsers.map(u => u.id)));
  }, [selectableUsers]);

  const clearSelection = useCallback(() => {
    setSelectedUsers(new Set());
  }, []);

  // Statistics (memoized to prevent re-calculation)
  const stats = useMemo(() => ({
    total: userMappings.length,
    created: creationResults.filter(r => r.success).length,
    failed: creationResults.filter(r => !r.success).length,
    pending: userMappings.filter(m => m.status === 'pending').length,
    cloned: discoveredUsers.length, // Simplified for now
    selectable: discoveredUsers.length
  }), [userMappings.length, creationResults.length, discoveredUsers.length, userMappings, creationResults]);

  useEffect(() => {
    if ((currentStep === 'complete' || (userCreationSkipped && currentStep === 'creation')) && onComplete && !hasCalledOnComplete.current) {
      // Complete the workflow when we reach step 4 or when user creation is skipped at step 3
      hasCalledOnComplete.current = true;
      
      const selectedMappings = userMappings.filter(mapping => 
        selectedUsers.has(mapping.user.id)
      );
      
      // Create comprehensive source-to-target mapping for services migration
      const sourceToTargetMapping = {
        // Core mapping information
        mappingType,
        migrationScenario,
        userMappingStrategy,
        userMappingConfig,
        
        // Domain mapping information
        sourceDomains,
        targetDomains,
        domainMapping,
        
        // Admin credentials mapping
        sourceAdminEmails,
        sourceAdminEmail,
        targetAdminEmails,
        effectiveTargetAdminEmails: getEffectiveTargetAdminEmails(),
        
        // User mappings organized by scenario
        userMappings: selectedMappings,
        
        // Scenario-specific mappings
        mappingDetails: (() => {
          switch (mappingType) {
            case 'one-to-one':
              return {
                type: 'one-to-one',
                description: migrationScenario === 'single-super-admin' 
                  ? 'Single super admin managing one-to-one user migration across domains'
                  : 'Cross-tenant one-to-one user migration with separate admin credentials',
                userPairs: selectedMappings.map(mapping => ({
                  sourceUser: {
                    email: mapping.user.primaryEmail,
                    domain: mapping.user.sourceDomain,
                    id: mapping.user.id,
                    name: mapping.user.name,
                    isAdmin: mapping.user.isAdmin,
                    adminEmail: sourceAdminEmails?.[mapping.user.sourceDomain!] || sourceAdminEmail
                  },
                  targetUser: {
                    email: mapping.targetEmail,
                    domain: mapping.targetDomain,
                    adminEmail: getEffectiveTargetAdminEmails()[mapping.targetDomain]
                  }
                }))
              };
              
            case 'one-to-many':
              return {
                type: 'one-to-many',
                description: migrationScenario === 'single-super-admin'
                  ? 'Single super admin managing one-to-many user replication across multiple target domains'
                  : 'Cross-tenant one-to-many user replication with separate admin credentials',
                sourceUserGroups: (() => {
                  const groups = new Map<string, typeof selectedMappings>();
                  selectedMappings.forEach(mapping => {
                    const sourceId = mapping.user.id;
                    if (!groups.has(sourceId)) {
                      groups.set(sourceId, []);
                    }
                    groups.get(sourceId)!.push(mapping);
                  });
                  
                  return Array.from(groups.entries()).map(([sourceId, mappings]) => ({
                    sourceUser: {
                      email: mappings[0].user.primaryEmail,
                      domain: mappings[0].user.sourceDomain,
                      id: mappings[0].user.id,
                      name: mappings[0].user.name,
                      isAdmin: mappings[0].user.isAdmin,
                      adminEmail: sourceAdminEmails?.[mappings[0].user.sourceDomain!] || sourceAdminEmail
                    },
                    targetUsers: mappings.map(mapping => ({
                      email: mapping.targetEmail,
                      domain: mapping.targetDomain,
                      adminEmail: getEffectiveTargetAdminEmails()[mapping.targetDomain]
                    }))
                  }));
                })()
              };
              
            case 'many-to-one':
              return {
                type: 'many-to-one',
                description: migrationScenario === 'single-super-admin'
                  ? 'Single super admin managing many-to-one user consolidation across domains'
                  : 'Cross-tenant many-to-one user consolidation with separate admin credentials',
                consolidationGroups: (() => {
                  const groups = new Map<string, typeof selectedMappings>();
                  selectedMappings.forEach(mapping => {
                    // Group by target email (consolidation target)
                    const targetKey = `${mapping.targetEmail}-${mapping.targetDomain}`;
                    if (!groups.has(targetKey)) {
                      groups.set(targetKey, []);
                    }
                    groups.get(targetKey)!.push(mapping);
                  });
                  
                  return Array.from(groups.entries()).map(([targetKey, mappings]) => {
                    const primaryMapping = mappings[0];
                    const sourceUsers = mappings.map(mapping => ({
                      email: mapping.user.primaryEmail,
                      domain: mapping.user.sourceDomain,
                      id: mapping.user.id,
                      name: mapping.user.name,
                      isAdmin: mapping.user.isAdmin,
                      adminEmail: sourceAdminEmails?.[mapping.user.sourceDomain!] || sourceAdminEmail
                    }));
                    
                    // Handle merged users from many-to-one scenarios
                    const mergedSourceUsers = primaryMapping.user.sourceUsers || [primaryMapping.user];
                    const allSourceUsers = mergedSourceUsers.map(user => ({
                      email: user.primaryEmail,
                      domain: user.sourceDomain,
                      id: user.id,
                      name: user.name,
                      isAdmin: user.isAdmin,
                      adminEmail: sourceAdminEmails?.[user.sourceDomain!] || sourceAdminEmail
                    }));
                    
                    return {
                      targetUser: {
                        email: primaryMapping.targetEmail,
                        domain: primaryMapping.targetDomain,
                        adminEmail: getEffectiveTargetAdminEmails()[primaryMapping.targetDomain]
                      },
                      sourceUsers: allSourceUsers,
                      consolidationType: allSourceUsers.length > 1 
                        ? (new Set(allSourceUsers.map(u => u.domain)).size > 1 ? 'multi-domain' : 'duplicate-accounts')
                        : 'single-user'
                    };
                  });
                })()
              };
              
            default:
              return {
                type: 'unknown',
                description: 'Unknown mapping type',
                rawMappings: selectedMappings
              };
          }
        })(),
        
        // Services migration context
        servicesContext: {
          totalUsers: discoveredUsers.length,
          selectedUsers: selectedMappings.length,
          createdUsers: creationResults.filter(r => r.success).length,
          failedUsers: creationResults.filter(r => !r.success).length,
          existingTargetUsers: selectedMappings.filter(mapping => 
            existingUserStatus[mapping.targetEmail]?.exists
          ).length,
          
          // Admin credential strategy
          adminStrategy: migrationScenario === 'single-super-admin' 
            ? {
                type: 'single-super-admin',
                adminEmail: sourceAdminEmail,
                description: 'Using single super admin credentials for both source and target domains'
              }
            : {
                type: 'cross-tenant',
                sourceAdminEmails,
                targetAdminEmails,
                description: 'Using separate admin credentials for each domain/tenant'
              },
          
          // Migration readiness
          readyForServicesMigration: creationResults.filter(r => r.success).length > 0,
          migrationScope: {
            sourceDomains: sourceDomains.length,
            targetDomains: targetDomains.length,
            userAccounts: selectedMappings.length,
            consolidatedAccounts: mappingType === 'many-to-one' 
              ? new Set(selectedMappings.map(m => `${m.targetEmail}-${m.targetDomain}`)).size
              : selectedMappings.length
          }
        }
      };
      
      // Create explicit source-to-target user pairs for services migration
      const sourceToTargetUserPairs = selectedMappings.map(mapping => ({
        sourceUser: {
          id: mapping.user.id,
          email: mapping.user.primaryEmail,
          name: mapping.user.name?.fullName || `${mapping.user.name?.givenName} ${mapping.user.name?.familyName}`.trim(),
          domain: mapping.user.sourceDomain || 'unknown',
          isAdmin: mapping.user.isAdmin,
          adminEmail: sourceAdminEmails?.[mapping.user.sourceDomain!] || sourceAdminEmail || ''
        },
        targetUser: {
          email: mapping.targetEmail,
          domain: mapping.targetDomain,
          adminEmail: getEffectiveTargetAdminEmails()[mapping.targetDomain] || '',
          exists: existingUserStatus[mapping.targetEmail]?.exists || false,
          created: mapping.status === 'created' || false
        },
        mappingId: mapping.user.id,
        status: mapping.status || 'pending'
      }));

      onComplete({
        discoveredUsers,
        createdUsers: creationResults,
        mappings: selectedMappings, // Original mapping structure for backward compatibility
        sourceToTargetMapping, // Comprehensive mapping for services migration
        userPairs: sourceToTargetUserPairs // Explicit source-to-target pairs for easy iteration
      });
    }
  }, [currentStep, userCreationSkipped, onComplete, userMappings, selectedUsers, discoveredUsers, creationResults]);

  // Reset onComplete flag when going back to earlier steps
  useEffect(() => {
    const stepOrder = ['discovery', 'mapping', 'creation', 'complete'];
    const currentStepIndex = stepOrder.indexOf(currentStep);
    if (currentStepIndex < 3) {
      hasCalledOnComplete.current = false;
    }
    // Reset auto-discovery flag when not on discovery step
    if (currentStep !== 'discovery') {
      hasAutoStartedDiscovery.current = false;
    }
  }, [currentStep]);

  // Memoize expensive function calls
  const targetConfigStatus = useMemo(() => getTargetDomainConfigurationStatus(), [getTargetDomainConfigurationStatus]);

  return (
    <div className="space-y-6">
      {/* Step Indicator */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center space-x-2">
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

      {/* Service Account Status Icon - Top Right */}
      {useServiceAccount && (
        <div className="absolute top-4 right-4 z-10">
          <div className={`rounded-full p-2 shadow-md ${
            serviceAccountVerified || enhancedVerificationUtils.hasValidToken()
              ? 'bg-green-100 border border-green-300'
              : isVerifyingServiceAccount
              ? 'bg-yellow-100 border border-yellow-300'
              : 'bg-red-100 border border-red-300'
          }`}>
            {serviceAccountVerified || enhancedVerificationUtils.hasValidToken() ? (
              <Shield className="h-4 w-4 text-green-600" />
            ) : isVerifyingServiceAccount ? (
              <RefreshCw className="h-4 w-4 text-yellow-600 animate-spin" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600" />
            )}
          </div>
        </div>
      )}

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
                  {isDiscovering 
                    ? `Discovering users from ${sourceDomains.length} source domain(s)...`
                    : discoveredUsers.length > 0
                    ? `Found ${discoveredUsers.length} users from ${sourceDomains.length} source domain(s)`
                    : `Auto-discovering users from ${sourceDomains.length} source domain(s)`
                  }
                </p>
              </div>
            </div>
            
            {/* Manual discovery button - now optional since auto-discovery is enabled */}
            {!isDiscovering && discoveredUsers.length === 0 && (
              <button
                onClick={discoverUsers}
                disabled={!hasValidAdminEmails()}
                className={`px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
                  !hasValidAdminEmails()
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
                title="Click to manually trigger discovery if auto-discovery hasn't started"
              >
                <Search className="h-4 w-4" />
                <span>Start Discovery Now</span>
              </button>
            )}
            
            {/* Show refresh button if discovery is complete */}
            {!isDiscovering && discoveredUsers.length > 0 && (
              <button
                onClick={discoverUsers}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
                title="Re-discover users"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Refresh Discovery</span>
              </button>
            )}
            
            {/* Show spinner during discovery */}
            {isDiscovering && (
              <div className="flex items-center space-x-2 text-blue-600">
                <RefreshCw className="h-5 w-5 animate-spin" />
                <span className="font-medium">Discovering...</span>
              </div>
            )}
          </div>

          {/* Admin Email Configuration Status */}
          {!hasValidAdminEmails() && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <span className="font-medium text-yellow-900">Admin Email Configuration Required</span>
              </div>
              <div className="mt-2 text-sm text-yellow-800">
                {migrationScenario === 'single-super-admin' ? (
                  <div>
                    <p>Please configure the super admin email in the delegation setup step:</p>
                    <ul className="mt-1 list-disc list-inside">
                      <li>Super Admin Email: {sourceAdminEmail || 'Not configured'}</li>
                      <li>Manages all domains: {sourceDomains.join(', ')}</li>
                    </ul>
                  </div>
                ) : (
                  <div>
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
                )}
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
            <div className="mt-6 space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-900">
                      Discovery Complete: {discoveredUsers.length} users found
                      {stats.cloned > 0 && (
                        <span className="ml-2 text-sm text-blue-700">
                          ({stats.cloned} already exist in target, {stats.selectable} available for creation)
                        </span>
                      )}
                      {mappingType === 'many-to-one' && (
                        <span className="ml-2 text-sm text-blue-700">
                          ({getUsersWithMultiDomainAccounts(discoveredUsers).length} users can be {
                            migrationScenario === 'single-super-admin' ? 'consolidated' : 'merged across tenants'
                          })
                        </span>
                      )}
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => checkExistingTargetUsers(discoveredUsers)}
                      disabled={isCheckingExistingUsers}
                      className={`px-3 py-2 rounded-lg transition-colors text-sm flex items-center space-x-2 ${
                        isCheckingExistingUsers
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {isCheckingExistingUsers ? (
                        <RefreshCw className="h-3 w-3 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3 w-3" />
                      )}
                      <span>{isCheckingExistingUsers ? 'Checking...' : 'Recheck Targets'}</span>
                    </button>
                    <button
                      onClick={() => {
                        setSelectedUsers(new Set(selectableUsers.map(u => u.id)));
                      }}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                    >
                      Select All Available ({stats.selectable})
                    </button>
                    <button
                      onClick={() => setSelectedUsers(new Set())}
                      className="px-3 py-2 text-gray-600 hover:text-gray-800 transition-colors text-sm"
                    >
                      Clear All
                    </button>
                  </div>
                </div>
                
                {selectedUsers.size > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="text-sm text-blue-700">
                      {selectedUsers.size} of {discoveredUsers.length} users selected for migration
                    </div>
                    {(() => {
                      // Count users with existing target accounts
                      const selectedMappings = userMappings.filter(mapping => 
                        selectedUsers.has(mapping.user.id)
                      );
                      const existingTargetCount = selectedMappings.filter(mapping =>
                        existingUserStatus[mapping.targetEmail]?.exists
                      ).length;
                      
                      if (existingTargetCount > 0) {
                        return (
                          <div className="text-sm text-yellow-700">
                            ⚠️ {existingTargetCount} target account(s) already exist and will be skipped
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                )}
              </div>

              {/* User Selection List */}
              <div className="bg-white border border-gray-200 rounded-lg">
                <div className="p-4 border-b border-gray-200">
                  <h4 className="font-medium text-gray-900">
                    {mappingType === 'many-to-one' 
                      ? (migrationScenario === 'single-super-admin' 
                          ? 'Select Users for Consolidation - Single Super Admin' 
                          : 'Select Users for Cross-Tenant Merge')
                      : 'Select Users for Migration'
                    }
                  </h4>
                  <p className="text-sm text-gray-600">
                    {mappingType === 'many-to-one' 
                      ? (migrationScenario === 'single-super-admin' 
                          ? 'Users shown below exist across multiple domains and will be consolidated into single target accounts using your super admin credentials'
                          : 'Users shown below exist across different tenants/organizations and will be merged into single target accounts during cross-tenant migration')
                      : 'Choose which users to migrate to target domains'
                    }
                  </p>
                </div>
                
                {mappingType === 'many-to-one' && (
                  <div className="p-4 border-b border-gray-200 bg-blue-50">
                    <div className="flex items-center space-x-2 mb-2">
                      <TrendingUp className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-900">
                        Many-to-One Migration Summary - {migrationScenario === 'single-super-admin' ? 'Single Super Admin' : 'Cross-Tenant'} Scenario
                      </span>
                    </div>
                    <div className="text-xs text-blue-800">
                      {(() => {
                        const multiDomainUsers = getUsersWithMultiDomainAccounts(discoveredUsers);
                        const usersByName = new Map<string, User[]>();
                        multiDomainUsers.forEach(user => {
                          const nameKey = normalizeUserName(user);
                          if (!usersByName.has(nameKey)) {
                            usersByName.set(nameKey, []);
                          }
                          usersByName.get(nameKey)!.push(user);
                        });
                        
                        const mergeGroups = Array.from(usersByName.entries()).filter(([_, users]) => {
                          const uniqueDomains = Array.from(new Set(users.map(u => u.sourceDomain).filter(Boolean)));
                          return uniqueDomains.length > 1 || users.length > 1;
                        });
                        
                        return (
                          <div>
                            <p>
                              {migrationScenario === 'single-super-admin' 
                                ? `Found ${mergeGroups.length} user(s) across source domains that will be consolidated into single target accounts:`
                                : `Found ${mergeGroups.length} user(s) from different tenants that will be merged into single target accounts:`
                              }
                            </p>
                            <ul className="mt-1 list-disc list-inside max-h-20 overflow-y-auto">
                              {mergeGroups.slice(0, 5).map(([name, users]) => {
                                const domains = Array.from(new Set(users.map(u => u.sourceDomain).filter(Boolean)));
                                return (
                                  <li key={name}>
                                    <strong>{users[0].name.fullName}</strong> 
                                    {domains.length > 1 
                                      ? ` (${domains.join(', ')})` 
                                      : ` (${users.length} accounts${domains.length > 0 ? ` in ${domains[0]}` : ''})`
                                    }
                                  </li>
                                );
                              })}
                              {mergeGroups.length > 5 && (
                                <li>... and {mergeGroups.length - 5} more</li>
                              )}
                            </ul>
                            <div className="mt-2 text-xs text-blue-700">
                              {migrationScenario === 'single-super-admin' 
                                ? 'These users will be consolidated using your super admin credentials for both source and target access.'
                                : 'These users will be merged during cross-tenant migration with separate admin credentials for each domain.'
                              }
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}
                
                {isCheckingExistingUsers && (
                  <div className="p-4 border-b border-gray-200">
                    <div className="flex items-center space-x-2">
                      <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />
                      <span className="text-sm text-blue-700">Checking existing users in target domains...</span>
                    </div>
                  </div>
                )}
                
                <div className="max-h-96 overflow-y-auto">
                  {(() => {
                    // For many-to-one, show grouped users (merged view)
                    if (mappingType === 'many-to-one') {
                      // Use ALL discovered users, not just multi-domain ones
                      const usersByName = new Map<string, User[]>();
                      
                      // Use selectableUsers instead of discoveredUsers to ensure consistent filtering
                      selectableUsers.forEach(user => {
                        const nameKey = normalizeUserName(user);
                        if (!usersByName.has(nameKey)) {
                          usersByName.set(nameKey, []);
                        }
                        usersByName.get(nameKey)!.push(user);
                      });

                      return Array.from(usersByName.entries())
                        .filter(([nameKey, users]) => {
                          // Filter out groups where ANY target mappings already exist
                          const userMappingsForGroup = userMappings.filter(m => 
                            users.some(u => m.user.id === u.id) || m.user.id === `merged-${nameKey}-${users.map(u => u.id).join('-')}`
                          );
                          
                          // If there are no mappings, show the group
                          if (userMappingsForGroup.length === 0) return true;
                          
                          // If ANY mappings already exist in target, hide this group completely
                          const anyExist = userMappingsForGroup.some(mapping => 
                            existingUserStatus[mapping.targetEmail]?.exists
                          );
                          
                          return !anyExist;
                        })
                        .map(([nameKey, users]) => {
                          // Create a merged user representation
                          const primaryUser = users.find(u => u.isAdmin) || 
                                            users.sort((a, b) => 
                                              new Date(b.creationTime).getTime() - new Date(a.creationTime).getTime()
                                            )[0];
                          
                          const mergedUserId = `merged-${nameKey}-${users.map(u => u.id).join('-')}`;
                          const isSelected = users.some(u => selectedUsers.has(u.id)) || selectedUsers.has(mergedUserId);
                          const userMappingsForUser = userMappings.filter(m => 
                            users.some(u => m.user.id === u.id) || m.user.id === mergedUserId
                          );
                          
                          const uniqueDomains = Array.from(new Set(users.map(u => u.sourceDomain).filter(Boolean)));
                          const consolidationType = uniqueDomains.length > 1 ? 'Multi-Domain' : users.length > 1 ? 'Duplicate Accounts' : 'Single User';
                          
                          return (
                            <div key={nameKey} className="p-4 border-b border-gray-100 last:border-b-0">
                              <div className="flex items-start space-x-3">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {
                                    // Toggle selection for all source users in this group
                                    const allSelected = users.every(u => selectedUsers.has(u.id));
                                    setSelectedUsers(prev => {
                                      const newSet = new Set(prev);
                                      if (allSelected) {
                                        users.forEach(u => newSet.delete(u.id));
                                        newSet.delete(mergedUserId);
                                      } else {
                                        users.forEach(u => newSet.add(u.id));
                                        newSet.add(mergedUserId);
                                      }
                                      return newSet;
                                    });
                                  }}
                                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-1"
                                />
                                
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <div className="font-medium text-gray-900 flex items-center space-x-2">
                                        <span>{primaryUser.name.fullName}</span>
                                        {consolidationType !== 'Single User' && (
                                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                                            consolidationType === 'Multi-Domain' 
                                              ? 'bg-purple-100 text-purple-800' 
                                              : 'bg-blue-100 text-blue-800'
                                          }`}>
                                            <TrendingUp className="h-3 w-3 mr-1" />
                                            {consolidationType}
                                          </span>
                                        )}
                                        {migrationScenario === 'single-super-admin' && (
                                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                                            <Shield className="h-3 w-3 mr-1" />
                                            Super Admin Migration
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-sm text-gray-600 mt-1">
                                        {users.length > 1 ? (
                                          <>
                                            <strong>Source Accounts ({users.length}):</strong>
                                            <div className="ml-2">
                                              {users.map(user => (
                                                <div key={user.id} className="flex items-center space-x-2 text-xs">
                                                  <Mail className="h-3 w-3 text-gray-400" />
                                                  <span>{user.primaryEmail}</span>
                                                  <span className="text-gray-500">({user.sourceDomain || 'unknown'})</span>
                                                  {user.isAdmin && (
                                                    <span className="text-purple-600">
                                                      <Shield className="h-3 w-3 inline" />
                                                    </span>
                                                  )}
                                                  {user.suspended && (
                                                    <span className="text-red-600">
                                                      <XCircle className="h-3 w-3 inline" />
                                                    </span>
                                                  )}
                                                </div>
                                              ))}
                                            </div>
                                          </>
                                        ) : (
                                          <>
                                            <div className="flex items-center space-x-2 text-sm">
                                              <Mail className="h-4 w-4 text-gray-400" />
                                              <span>{primaryUser.primaryEmail}</span>
                                              <span className="text-gray-500">({primaryUser.sourceDomain || 'unknown'})</span>
                                              {primaryUser.isAdmin && (
                                                <span className="text-purple-600">
                                                  <Shield className="h-4 w-4 inline" />
                                                </span>
                                              )}
                                              {primaryUser.suspended && (
                                                <span className="text-red-600">
                                                  <XCircle className="h-4 w-4 inline" />
                                                </span>
                                              )}
                                            </div>
                                          </>
                                        )}
                                        {migrationScenario === 'cross-tenant' && users.length > 1 && (
                                          <div className="mt-2 text-xs text-blue-600">
                                            ℹ️ Cross-tenant migration: Will merge accounts from different organizations
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {/* Target Mappings */}
                                  <div className="mt-3 space-y-2">
                                    <div className="text-xs font-medium text-gray-700">Target Mappings:</div>
                                    {userMappingsForUser.map(mapping => {
                                      const existingStatus = existingUserStatus[mapping.targetEmail];
                                      
                                      return (
                                        <div key={`${mapping.targetEmail}-${mapping.targetDomain}`} 
                                             className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                                          <div className="flex items-center space-x-2">
                                            <Mail className="h-3 w-3 text-gray-400" />
                                            <span className="text-gray-700">{mapping.targetEmail}</span>
                                            <span className="text-gray-500">→ {mapping.targetDomain}</span>
                                          </div>
                                          
                                          <div className="flex items-center space-x-1">
                                            {isCheckingExistingUsers ? (
                                              <div className="flex items-center space-x-1">
                                                <RefreshCw className="h-3 w-3 text-blue-600 animate-spin" />
                                                <span className="text-xs text-blue-700">Checking...</span>
                                              </div>
                                            ) : existingStatus ? (
                                              existingStatus.exists ? (
                                                <div className="flex items-center space-x-1">
                                                  <AlertCircle className="h-3 w-3 text-yellow-600" />
                                                  <span className="text-xs text-yellow-700">Already exists</span>
                                                </div>
                                              ) : existingStatus.error ? (
                                                <div className="flex items-center space-x-1">
                                                  <XCircle className="h-3 w-3 text-red-600" />
                                                  <span className="text-xs text-red-700">Check failed</span>
                                                </div>
                                              ) : (
                                                <div className="flex items-center space-x-1">
                                                  <CheckCircle className="h-3 w-3 text-green-600" />
                                                  <span className="text-xs text-green-700">Available</span>
                                                </div>
                                              )
                                            ) : (
                                              <div className="flex items-center space-x-1">
                                                <Clock className="h-3 w-3 text-gray-400" />
                                                <span className="text-xs text-gray-500">Pending check</span>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        });
                    } else {
                      // For other mapping types, show individual users (already filtered to exclude existing users)
                      return selectableUsers.map(user => {
                        const userMappingsForUser = userMappings.filter(m => m.user.id === user.id);
                        const isSelected = selectedUsers.has(user.id);
                        
                        return (
                          <div key={user.id} className="p-4 border-b border-gray-100 last:border-b-0">
                            <div className="flex items-start space-x-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleUserSelection(user.id)}
                                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-1"
                              />
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <div className="font-medium text-gray-900 flex items-center space-x-2">
                                      <span>{user.name.fullName}</span>
                                    </div>
                                    <div className="text-sm text-gray-600">{user.primaryEmail}</div>
                                    <div className="flex items-center space-x-4 mt-1">
                                      <span className="text-xs text-gray-500">
                                        <Building className="h-3 w-3 inline mr-1" />
                                        {user.sourceDomain || 'unknown'}
                                      </span>
                                      {user.isAdmin && (
                                        <span className="text-xs text-purple-600">
                                          <Shield className="h-3 w-3 inline mr-1" />
                                          Admin
                                        </span>
                                      )}
                                      {user.suspended && (
                                        <span className="text-xs text-red-600">
                                          <XCircle className="h-3 w-3 inline mr-1" />
                                          Suspended
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Target Mappings */}
                                <div className="mt-3 space-y-2">
                                  <div className="text-xs font-medium text-gray-700">Target Mappings:</div>
                                  {userMappingsForUser.map(mapping => {
                                    const existingStatus = existingUserStatus[mapping.targetEmail];
                                    
                                    return (
                                      <div key={`${mapping.targetEmail}-${mapping.targetDomain}`} 
                                           className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                                        <div className="flex items-center space-x-2">
                                          <Mail className="h-3 w-3 text-gray-400" />
                                          <span className="text-gray-700">{mapping.targetEmail}</span>
                                          <span className="text-gray-500">→ {mapping.targetDomain}</span>
                                        </div>
                                        
                                        <div className="flex items-center space-x-1">
                                          {isCheckingExistingUsers ? (
                                            <div className="flex items-center space-x-1">
                                              <RefreshCw className="h-3 w-3 text-blue-600 animate-spin" />
                                              <span className="text-xs text-blue-700">Checking...</span>
                                            </div>
                                          ) : existingStatus ? (
                                            existingStatus.exists ? (
                                              <div className="flex items-center space-x-1">
                                                <AlertCircle className="h-3 w-3 text-yellow-600" />
                                                <span className="text-xs text-yellow-700">Already exists</span>
                                              </div>
                                            ) : existingStatus.error ? (
                                              <div className="flex items-center space-x-1">
                                                <XCircle className="h-3 w-3 text-red-600" />
                                                <span className="text-xs text-red-700">Check failed</span>
                                              </div>
                                            ) : (
                                              <div className="flex items-center space-x-1">
                                                <CheckCircle className="h-3 w-3 text-green-600" />
                                                <span className="text-xs text-green-700">Available</span>
                                              </div>
                                            )
                                          ) : (
                                            <div className="flex items-center space-x-1">
                                              <Clock className="h-3 w-3 text-gray-400" />
                                              <span className="text-xs text-gray-500">Pending check</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      });
                    }
                  })()}
                </div>
              </div>

              {/* Comprehensive User Listings */}
              <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Source Users List */}
              <div className="bg-white border border-gray-200 rounded-lg">
                <div className="p-4 border-b border-gray-200 bg-blue-50">
                  <div className="flex items-center space-x-2">
                    <Users className="h-5 w-5 text-blue-600" />
                    <h4 className="font-medium text-blue-900">Source Users</h4>
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                      {discoveredUsers.length}
                    </span>
                  </div>
                  <p className="text-sm text-blue-700 mt-1">
                    Users discovered in source domains
                  </p>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {discoveredUsers.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      No source users found
                    </div>
                  ) : (
                    discoveredUsers.map((user, index) => (
                      <div key={user.id} className={`p-3 border-b border-gray-100 last:border-b-0 ${
                        isUserCloned(user) ? 'bg-yellow-50' : ''
                      }`}>
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                              user.isAdmin ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                            }`}>
                              {user.name.fullName.charAt(0).toUpperCase()}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {user.name.fullName}
                              </p>
                              {user.isAdmin && (
                                <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                                  Admin
                                </span>
                              )}
                              {isUserCloned(user) && (
                                <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                                  Cloned
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-600 truncate">{user.primaryEmail}</p>
                            <p className="text-xs text-gray-500">{user.sourceDomain || 'unknown'}</p>
                            {user.orgUnitPath && user.orgUnitPath !== '/' && (
                              <p className="text-xs text-gray-500">OU: {user.orgUnitPath}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Target Users List */}
              <div className="bg-white border border-gray-200 rounded-lg">
                <div className="p-4 border-b border-gray-200 bg-green-50">
                  <div className="flex items-center space-x-2">
                    <Target className="h-5 w-5 text-green-600" />
                    <h4 className="font-medium text-green-900">Target Users</h4>
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                      {userMappings.length}
                    </span>
                  </div>
                  <p className="text-sm text-green-700 mt-1">
                    Mapped target user accounts to be created
                  </p>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {userMappings.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      No target mappings configured
                    </div>
                  ) : (
                    userMappings.map((mapping, index) => {
                      const existingStatus = existingUserStatus[mapping.targetEmail];
                      const isExisting = existingStatus?.exists;
                      
                      return (
                        <div key={`${mapping.targetEmail}-${index}`} className={`p-3 border-b border-gray-100 last:border-b-0 ${
                          isExisting ? 'bg-yellow-50' : ''
                        }`}>
                          <div className="flex items-start space-x-3">
                            <div className="flex-shrink-0">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                                isExisting ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                              }`}>
                                {mapping.targetEmail.charAt(0).toUpperCase()}
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {mapping.user.name.fullName}
                                </p>
                                {isExisting && (
                                  <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                                    Exists
                                  </span>
                                )}
                                {isCheckingExistingUsers && (
                                  <RefreshCw className="h-3 w-3 text-blue-600 animate-spin" />
                                )}
                              </div>
                              <p className="text-xs text-gray-600 truncate">{mapping.targetEmail}</p>
                              <p className="text-xs text-gray-500">{mapping.targetDomain}</p>
                              <div className="flex items-center space-x-1 mt-1">
                                <span className="text-xs text-gray-400">Source:</span>
                                <span className="text-xs text-gray-600">{mapping.user.primaryEmail}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Already Cloned Users */}
              <div className="bg-white border border-gray-200 rounded-lg">
                <div className="p-4 border-b border-gray-200 bg-yellow-50">
                  <div className="flex items-center space-x-2">
                    <Copy className="h-5 w-5 text-yellow-600" />
                    <h4 className="font-medium text-yellow-900">Already Cloned</h4>
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                      {stats.cloned}
                    </span>
                  </div>
                  <p className="text-sm text-yellow-700 mt-1">
                    Users that exist in both source and target domains
                  </p>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {stats.cloned === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      No cloned users detected
                    </div>
                  ) : (
                    clonedUsers.map((user, index) => {
                        const cloneInfo = getCloneStatusForUser(user);
                        
                        return (
                          <div key={user.id} className="p-3 border-b border-gray-100 last:border-b-0 bg-yellow-25">
                            <div className="flex items-start space-x-3">
                              <div className="flex-shrink-0">
                                <div className="w-8 h-8 rounded-full bg-yellow-100 text-yellow-700 flex items-center justify-center text-xs font-medium">
                                  {user.name.fullName.charAt(0).toUpperCase()}
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2">
                                  <p className="text-sm font-medium text-gray-900 truncate">
                                    {user.name.fullName}
                                  </p>
                                  <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                                    Cloned
                                  </span>
                                </div>
                                <p className="text-xs text-gray-600 truncate">{user.primaryEmail}</p>
                                <p className="text-xs text-gray-500">Source: {user.sourceDomain || 'unknown'}</p>
                                
                                {/* Show target domains where this user already exists */}
                                {cloneInfo.clonedTargetEmails.length > 0 && (
                                  <div className="mt-1">
                                    <p className="text-xs text-gray-500">Target accounts:</p>
                                    {cloneInfo.clonedTargetEmails.slice(0, 3).map((email: string, idx: number) => (
                                      <p key={idx} className="text-xs text-yellow-700 ml-2">
                                        → {email}
                                      </p>
                                    ))}
                                    {cloneInfo.clonedTargetEmails.length > 3 && (
                                      <p className="text-xs text-yellow-600 ml-2">
                                        ... and {cloneInfo.clonedTargetEmails.length - 3} more
                                      </p>
                                    )}
                                  </div>
                                )}
                                
                                {cloneInfo.clonedInDomains.length > 0 && (
                                  <div className="mt-1">
                                    <p className="text-xs text-gray-500">
                                      Found in: {cloneInfo.clonedInDomains.join(', ')}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>
            </div>

            {/* Summary Statistics */}
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <Users className="h-5 w-5 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">Total Discovered</span>
                </div>
                <p className="text-2xl font-bold text-blue-900 mt-1">{stats.total}</p>
                <p className="text-xs text-blue-700">Source users found</p>
              </div>
              
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <Target className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium text-green-900">Target Mappings</span>
                </div>
                <p className="text-2xl font-bold text-green-900 mt-1">{userMappings.length}</p>
                <p className="text-xs text-green-700">Accounts to create</p>
              </div>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <Copy className="h-5 w-5 text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-900">Already Cloned</span>
                </div>
                <p className="text-2xl font-bold text-yellow-900 mt-1">{stats.cloned}</p>
                <p className="text-xs text-yellow-700">Exist in both domains</p>
              </div>
              
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-purple-600" />
                  <span className="text-sm font-medium text-purple-900">Available</span>
                </div>
                <p className="text-2xl font-bold text-purple-900 mt-1">{stats.selectable}</p>
                <p className="text-xs text-purple-700">Ready for creation</p>
              </div>
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
          </div>

          {/* Migration Status Summary */}
          {!userCreationSkipped && (() => {
            const stats = (() => {
              const total = discoveredUsers.length;
              const selectable = total - discoveredUsers.filter(user => {
                const cloneStatus = getCloneStatusForUser(user);
                return cloneStatus.isCloned;
              }).length;
              // Already Cloned is difference between total users and available for selection
              const cloned = total - selectable;
              const selected = selectedUsers.size;
              const targetAccounts = selectedMappingsCount;
              const pending = total - cloned; // Difference between total users and already created users
              
              return { total, cloned, selectable, selected, targetAccounts, pending };
            })();
            
            return (
              <div className="mb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-700">{stats.total}</div>
                      <div className="text-sm text-blue-600">Total Users</div>
                    </div>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-700">{stats.cloned}</div>
                      <div className="text-sm text-blue-600">Already Cloned</div>
                    </div>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-700">{stats.selectable}</div>
                      <div className="text-sm text-blue-600">Available for Selection</div>
                    </div>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-700">{stats.selected}</div>
                      <div className="text-sm text-blue-600">Users Selected</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
            
            {/* Target Domain Configuration Validation */}
            {(() => {
              const configStatus = getTargetDomainConfigurationStatus();
              if (!configStatus.isValid) {
                return (
                  <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-yellow-900">Target Domain Configuration Required</h4>
                        <p className="text-sm text-yellow-800 mt-1">{configStatus.message}</p>
                        <div className="mt-2">
                          <p className="text-sm font-medium text-yellow-900">Missing admin configuration for:</p>
                          <ul className="mt-1 list-disc list-inside text-sm text-yellow-800">
                            {configStatus.missingDomains.map(domain => (
                              <li key={domain}>{domain}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="mt-3 text-sm text-yellow-800">
                          {migrationScenario === 'single-super-admin' ? (
                            <p>
                              <strong>For Single Super Admin scenario:</strong> Ensure your source admin email has domain-wide delegation rights for all target domains listed above.
                            </p>
                          ) : (
                            <p>
                              <strong>For Cross-Tenant scenario:</strong> Configure individual admin emails for each target domain in the delegation setup step.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            })()}
            
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
                disabled={selectedUsers.size === 0 || !targetConfigStatus.isValid}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  selectedUsers.size > 0 && targetConfigStatus.isValid
                    ? 'bg-purple-600 text-white hover:bg-purple-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
                title={!targetConfigStatus.isValid ? 'Please configure target domain admin emails first' : ''}
              >
                Create {selectedUsers.size} Users
              </button>
              
              <button
                onClick={() => {
                  console.log('=== SKIP USER CREATION BUTTON CLICKED ===');
                  console.log('Setting userCreationSkipped to true');
                  setUserCreationSkipped(true);
                  
                  console.log('onComplete callback available:', !!onComplete);
                  
                  if (onComplete) {
                    console.log('Preparing skip results...');
                    // Skip user creation step and proceed directly to migration settings
                    const selectedMappings = userMappings.filter(mapping => 
                      selectedUsers.has(mapping.user.id)
                    );
                    
                    console.log('Selected mappings count:', selectedMappings.length);
                    console.log('Discovered users count:', discoveredUsers.length);
                    
                    const results = {
                      discoveredUsers,
                      createdUsers: [], // No users created since we skipped
                      mappings: selectedMappings,
                      sourceToTargetMapping: {
                        mappingType,
                        migrationScenario,
                        userMappingStrategy,
                        userMappingConfig,
                        sourceDomains,
                        targetDomains,
                        domainMapping,
                        sourceAdminEmails,
                        sourceAdminEmail,
                        targetAdminEmails,
                        userMappings: selectedMappings,
                        userCreationSkipped: true
                      }
                    };
                    
                    console.log('Calling onComplete with results:', results);
                    console.log('=== CALLING onComplete CALLBACK ===');
                    onComplete(results);
                    console.log('=== onComplete CALLBACK CALLED ===');
                  } else {
                    console.log('No onComplete callback available, setting step to complete');
                    setCurrentStep('complete');
                  }
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center space-x-2"
                title="Skip user creation step and proceed to migration settings"
              >
                <ArrowRight className="h-4 w-4" />
                <span>Skip User Creation</span>
              </button>
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

          {/* Selected User Mappings Display */}
          {selectedUsers.size > 0 && (
            <div className="mb-6 p-4 bg-white border border-gray-200 rounded-lg">
              <div className="flex items-center space-x-2 mb-4">
                <Users className="h-5 w-5 text-gray-700" />
                <h3 className="text-lg font-medium text-gray-900">Selected Users ({selectedUsers.size})</h3>
              </div>
              
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-4 text-sm font-medium text-gray-700 pb-2 border-b border-gray-200">
                  <div>Total Users</div>
                  <div>Admin Users</div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm pb-3 border-b border-gray-200">
                  <div className="font-medium">{selectedUsers.size}</div>
                  <div className="font-medium">
                    {Array.from(selectedUsers).filter(userId => {
                      const user = discoveredUsers.find(u => u.id === userId);
                      return user?.isAdmin;
                    }).length}
                  </div>
                </div>
                
                <div className="text-sm text-gray-600 font-medium mb-3">Users to migrate:</div>
                
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {Array.from(selectedUsers).map(userId => {
                    const user = discoveredUsers.find(u => u.id === userId);
                    if (!user) return null;
                    
                    const userMappingsForUser = userMappings.filter(m => m.user.id === userId);
                    
                    return (
                      <div key={userId} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded">
                        <Mail className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-900 truncate">{user.primaryEmail}</span>
                            <ArrowRight className="h-3 w-3 text-gray-400 flex-shrink-0" />
                            <div className="flex flex-wrap gap-1">
                              {userMappingsForUser.length > 0 ? (
                                userMappingsForUser.map((mapping, idx) => (
                                  <span key={idx} className="text-sm text-blue-600 truncate">
                                    {mapping.targetEmail}
                                  </span>
                                ))
                              ) : (
                                <span className="text-sm text-gray-500 italic">No target mapping</span>
                              )}
                            </div>
                          </div>
                          {user.isAdmin && (
                            <div className="mt-1">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                <Shield className="h-3 w-3 mr-1" />
                                Admin
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

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
                    {mergedUsersCount}
                  </span> merged users (combining accounts from multiple source domains)
                </div>
              </div>
            )}

          {/* Selected User Mappings Display */}
          {selectedUsers.size > 0 && (
            <div className="mb-6 p-4 bg-white border border-gray-200 rounded-lg">
              <div className="flex items-center space-x-2 mb-4">
                <Users className="h-5 w-5 text-gray-700" />
                <h3 className="text-lg font-medium text-gray-900">Selected Users ({selectedUsers.size})</h3>
              </div>
              
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-4 text-sm font-medium text-gray-700 pb-2 border-b border-gray-200">
                  <div>Total Users</div>
                  <div>Admin Users</div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm pb-3 border-b border-gray-200">
                  <div className="font-medium">{selectedUsers.size}</div>
                  <div className="font-medium">
                    {Array.from(selectedUsers).filter(userId => {
                      const user = discoveredUsers.find(u => u.id === userId);
                      return user?.isAdmin;
                    }).length}
                  </div>
                </div>
                
                <div className="text-sm text-gray-600 font-medium mb-3">Users to migrate:</div>
                
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {Array.from(selectedUsers).map(userId => {
                    const user = discoveredUsers.find(u => u.id === userId);
                    if (!user) return null;
                    
                    const userMappingsForUser = userMappings.filter(m => m.user.id === userId);
                    
                    return (
                      <div key={userId} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded">
                        <Mail className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-900 truncate">{user.primaryEmail}</span>
                            <ArrowRight className="h-3 w-3 text-gray-400 flex-shrink-0" />
                            <div className="flex flex-wrap gap-1">
                              {userMappingsForUser.length > 0 ? (
                                userMappingsForUser.map((mapping, idx) => (
                                  <span key={idx} className="text-sm text-blue-600 truncate">
                                    {mapping.targetEmail}
                                  </span>
                                ))
                              ) : (
                                <span className="text-sm text-gray-500 italic">No target mapping</span>
                              )}
                            </div>
                          </div>
                          {user.isAdmin && (
                            <div className="mt-1">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                <Shield className="h-3 w-3 mr-1" />
                                Admin
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* User List */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {/* Group users and show all their target mappings */}
            {uniqueUserIds.map(userId => {
              const user = filteredUsers.find(u => u.id === userId);
              if (!user) return null;
              
              const userMappingsForThisUser = userMappings.filter(m => m.user.id === userId);
              const cloneStatus = getCloneStatusForUser(user);
              const isCloned = cloneStatus.isCloned;
              
              return (
                <div key={userId} className={`border rounded-lg p-3 ${
                  isCloned 
                    ? 'border-blue-200 bg-blue-50' 
                    : 'border-gray-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={selectedUsers.has(userId)}
                        onChange={() => toggleUserSelection(userId)}
                        disabled={isCloned}
                        className={`h-4 w-4 border-gray-300 rounded focus:ring-purple-500 ${
                          isCloned 
                            ? 'text-gray-400 cursor-not-allowed opacity-50' 
                            : 'text-purple-600'
                        }`}
                      />
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className={`font-medium ${
                            isCloned ? 'text-gray-500' : 'text-gray-900'
                          }`}>{user.name.fullName}</h4>
                          {user.isAdmin && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              <Shield className="h-3 w-3 mr-1" />
                              Admin
                            </span>
                          )}
                          {isCloned && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-red-300">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Already Exists
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
                          <div className={`text-sm ${isCloned ? 'text-gray-500' : 'text-gray-600'}`}>
                            <div>Primary: {user.sourceUsers[0]?.primaryEmail}</div>
                            <div className="text-xs text-gray-500">
                              Also from: {user.sourceUsers.slice(1).map(u => `${u.primaryEmail} (${u.sourceDomain})`).join(', ')}
                            </div>
                          </div>
                        ) : (
                          <div className={`text-sm ${isCloned ? 'text-gray-500' : 'text-gray-600'}`}>
                            {user.primaryEmail}
                          </div>
                        )}
                        
                        {/* Show clone information */}
                        {isCloned && (
                          <div className="mt-2 p-2 bg-blue-100 border border-red-300 rounded text-xs">
                            <div className="font-medium text-blue-800 mb-1">User already exists in target domain(s):</div>
                            <div className="space-y-1">
                              {cloneStatus.clonedTargetEmails.map((email, idx) => (
                                <div key={idx} className="text-blue-700">
                                  <Mail className="h-3 w-3 inline mr-1" />
                                  {email} in {cloneStatus.clonedInDomains[idx]}
                                </div>
                              ))}
                            </div>
                            <div className="mt-1 text-blue-600 italic">
                              Selection disabled to prevent duplicate creation
                            </div>
                          </div>
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
              {userCreationSkipped 
                ? `Successfully mapped ${discoveredUsers.length} users for migration (user creation skipped)`
                : `Successfully processed ${discoveredUsers.length} users with ${stats.created} created${stats.failed > 0 ? ` and ${stats.failed} failed` : ''}`
              }
            </p>
          </div>

          {/* Final Summary */}
          {userCreationSkipped ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-5 w-5 text-amber-600" />
                <h4 className="font-medium text-amber-800">User Creation Skipped</h4>
              </div>
              <p className="text-amber-700 text-sm mt-2">
                You chose to skip target user creation. Make sure the target users exist in their respective domains 
                before starting the migration, or they will need to be created manually.
              </p>
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{discoveredUsers.length}</div>
              <div className="text-sm text-gray-600">Users Discovered</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {userCreationSkipped ? selectedUsers.size : stats.created}
              </div>
              <div className="text-sm text-gray-600">
                {userCreationSkipped ? 'Users Selected for Migration' : 'Users Created'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {userCreationSkipped ? 0 : stats.failed}
              </div>
              <div className="text-sm text-gray-600">
                {userCreationSkipped ? 'Creation Skipped' : 'Creation Failed'}
              </div>
            </div>
          </div>
          
          {/* Action Button */}
          <div className="mt-6 text-center">
            <button
              onClick={() => {
                if (onComplete) {
                  // Force trigger the complete callback when button is clicked
                  const selectedMappings = userMappings.filter(mapping => 
                    selectedUsers.has(mapping.user.id)
                  );
                  
                  const results = {
                    discoveredUsers,
                    createdUsers: creationResults,
                    mappings: selectedMappings,
                    sourceToTargetMapping: {
                      mappingType,
                      migrationScenario,
                      userMappingStrategy,
                      userMappingConfig,
                      sourceDomains,
                      targetDomains,
                      domainMapping,
                      sourceAdminEmails,
                      sourceAdminEmail,
                      targetAdminEmails,
                      userMappings: selectedMappings,
                      userCreationSkipped
                    }
                  };
                  
                  onComplete(results);
                }
              }}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center space-x-2 mx-auto"
            >
              <ArrowRight className="h-5 w-5" />
              <span>Complete Workflow</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

UserManagementWorkflow.displayName = 'UserManagementWorkflow';

export default UserManagementWorkflow;
