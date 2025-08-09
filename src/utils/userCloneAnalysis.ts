/**
 * User Clone Analysis Utilities
 * Integrates target user discovery API to identify cloned vs uncloned users
 */

import { discoverTargetUsers, getTargetUsersForDomain, TargetUser, TargetDomainConfig } from './targetDomainConfig';
import { GoogleWorkspaceService } from '@/lib/google-workspace';

export interface SourceUser {
  id: string;
  primaryEmail: string;
  name: {
    givenName: string;
    familyName: string;
    fullName: string;
  };
  isAdmin: boolean;
  isDelegatedAdmin?: boolean;
  lastLoginTime?: string;
  creationTime: string;
  suspended: boolean;
  orgUnitPath: string;
  sourceDomain: string;
}

export interface UserCloneMatch {
  sourceUser: SourceUser;
  targetUser?: TargetUser;
  matchType: 'exact_email' | 'name_match' | 'custom_mapping' | 'no_match';
  matchConfidence: number; // 0-100
  isAlreadyCloned: boolean;
}

export interface CloneAnalysisResult {
  totalSourceUsers: number;
  totalTargetUsers: number;
  alreadyCloned: UserCloneMatch[];
  needsCloning: UserCloneMatch[];
  conflictingUsers: UserCloneMatch[];
  unmappedTargetUsers: TargetUser[];
  cloneStatus: {
    clonedCount: number;
    pendingCount: number;
    conflictCount: number;
    clonePercentage: number;
  };
}

export interface CloneAnalysisOptions {
  matchingStrategy: 'email_exact' | 'email_prefix' | 'name_based' | 'custom';
  includeSuspended: boolean;
  customMappings?: { [sourceEmail: string]: string }; // source email -> target email
  serviceAccount?: {
    clientEmail: string;
    privateKey: string;
    projectId?: string;
    clientId?: string;
  };
}

/**
 * Discovers source users from the source domain
 */
export const discoverSourceUsers = async (
  sourceDomain: string,
  sourceAdminEmail: string,
  options?: {
    includeSuspended?: boolean;
    maxResults?: number;
    serviceAccount?: {
      clientEmail: string;
      privateKey: string;
      projectId?: string;
      clientId?: string;
    };
  }
): Promise<{
  success: boolean;
  users: SourceUser[];
  error?: string;
  totalCount: number;
}> => {
  try {
    console.log(`Discovering source users for domain ${sourceDomain}`);

    // Create service account credentials for the source domain admin
    const serviceAccountCredentials = {
      clientEmail: options?.serviceAccount?.clientEmail || process.env.GOOGLE_CLIENT_EMAIL || '',
      privateKey: options?.serviceAccount?.privateKey || process.env.GOOGLE_PRIVATE_KEY || '',
      subjectEmail: sourceAdminEmail
    };

    const gwsService = new GoogleWorkspaceService(serviceAccountCredentials, true);
    
    // Get users using the same API pattern
    const users = await gwsService.getUsers(sourceDomain, options?.maxResults || 1000);

    // Filter suspended users if not requested
    const filteredUsers = options?.includeSuspended 
      ? users 
      : users.filter(user => !user.suspended);

    // Convert to SourceUser format
    const sourceUsers: SourceUser[] = filteredUsers.map(user => ({
      id: user.id,
      primaryEmail: user.primaryEmail,
      name: {
        givenName: user.name.givenName,
        familyName: user.name.familyName,
        fullName: user.name.fullName,
      },
      isAdmin: user.isAdmin,
      isDelegatedAdmin: user.isDelegatedAdmin,
      lastLoginTime: user.lastLoginTime,
      creationTime: user.creationTime,
      suspended: user.suspended,
      orgUnitPath: user.orgUnitPath,
      sourceDomain: sourceDomain
    }));

    return {
      success: true,
      users: sourceUsers,
      totalCount: sourceUsers.length
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error discovering source users for ${sourceDomain}:`, error);
    
    return {
      success: false,
      users: [],
      error: errorMessage,
      totalCount: 0
    };
  }
};

/**
 * Analyzes user clone status by comparing source and target domains
 */
export const analyzeUserCloneStatus = async (
  sourceDomain: string,
  sourceAdminEmail: string,
  targetDomains: string[],
  targetAdminEmails: TargetDomainConfig,
  options: CloneAnalysisOptions
): Promise<CloneAnalysisResult> => {
  console.log(`Analyzing user clone status: ${sourceDomain} -> [${targetDomains.join(', ')}]`);

  // Step 1: Discover source users
  const sourceResult = await discoverSourceUsers(sourceDomain, sourceAdminEmail, {
    includeSuspended: options.includeSuspended,
    serviceAccount: options.serviceAccount
  });

  if (!sourceResult.success) {
    throw new Error(`Failed to discover source users: ${sourceResult.error}`);
  }

  // Step 2: Discover target users
  const targetResult = await discoverTargetUsers(targetDomains, targetAdminEmails, {
    includeSuspended: options.includeSuspended,
    serviceAccount: options.serviceAccount
  });

  if (!targetResult.success) {
    console.warn('Some target domains failed during discovery:', targetResult.errors);
  }

  // Step 3: Perform clone analysis
  return performCloneMatching(sourceResult.users, targetResult.allUsers, options);
};

/**
 * Performs user matching to identify cloned vs uncloned users
 */
export const performCloneMatching = (
  sourceUsers: SourceUser[],
  targetUsers: TargetUser[],
  options: CloneAnalysisOptions
): CloneAnalysisResult => {
  const alreadyCloned: UserCloneMatch[] = [];
  const needsCloning: UserCloneMatch[] = [];
  const conflictingUsers: UserCloneMatch[] = [];
  const unmappedTargetUsers: TargetUser[] = [...targetUsers];

  sourceUsers.forEach(sourceUser => {
    const match = findBestMatch(sourceUser, targetUsers, options);
    
    if (match.targetUser) {
      // Remove matched target user from unmapped list
      const targetIndex = unmappedTargetUsers.findIndex(
        tu => tu.primaryEmail === match.targetUser!.primaryEmail
      );
      if (targetIndex >= 0) {
        unmappedTargetUsers.splice(targetIndex, 1);
      }

      // Determine if this is a conflict (multiple possible matches)
      const allMatches = findAllMatches(sourceUser, targetUsers, options);
      if (allMatches.length > 1) {
        conflictingUsers.push(match);
      } else {
        alreadyCloned.push(match);
      }
    } else {
      needsCloning.push(match);
    }
  });

  const cloneStatus = {
    clonedCount: alreadyCloned.length,
    pendingCount: needsCloning.length,
    conflictCount: conflictingUsers.length,
    clonePercentage: Math.round((alreadyCloned.length / sourceUsers.length) * 100)
  };

  return {
    totalSourceUsers: sourceUsers.length,
    totalTargetUsers: targetUsers.length,
    alreadyCloned,
    needsCloning,
    conflictingUsers,
    unmappedTargetUsers,
    cloneStatus
  };
};

/**
 * Finds the best match for a source user in target users
 */
export const findBestMatch = (
  sourceUser: SourceUser,
  targetUsers: TargetUser[],
  options: CloneAnalysisOptions
): UserCloneMatch => {
  let bestMatch: TargetUser | undefined;
  let matchType: UserCloneMatch['matchType'] = 'no_match';
  let matchConfidence = 0;

  // Check custom mappings first
  if (options.customMappings && options.customMappings[sourceUser.primaryEmail]) {
    const mappedEmail = options.customMappings[sourceUser.primaryEmail];
    bestMatch = targetUsers.find(tu => tu.primaryEmail === mappedEmail);
    if (bestMatch) {
      matchType = 'custom_mapping';
      matchConfidence = 100;
    }
  }

  // If no custom mapping found, try other strategies
  if (!bestMatch) {
    switch (options.matchingStrategy) {
      case 'email_exact':
        bestMatch = targetUsers.find(tu => tu.primaryEmail === sourceUser.primaryEmail);
        if (bestMatch) {
          matchType = 'exact_email';
          matchConfidence = 100;
        }
        break;

      case 'email_prefix':
        const sourcePrefix = sourceUser.primaryEmail.split('@')[0];
        bestMatch = targetUsers.find(tu => tu.primaryEmail.startsWith(sourcePrefix + '@'));
        if (bestMatch) {
          matchType = 'exact_email';
          matchConfidence = 90;
        }
        break;

      case 'name_based':
        bestMatch = targetUsers.find(tu => 
          tu.name.fullName.toLowerCase() === sourceUser.name.fullName.toLowerCase() ||
          (tu.name.givenName.toLowerCase() === sourceUser.name.givenName.toLowerCase() &&
           tu.name.familyName.toLowerCase() === sourceUser.name.familyName.toLowerCase())
        );
        if (bestMatch) {
          matchType = 'name_match';
          matchConfidence = 80;
        }
        break;

      case 'custom':
        // Try multiple strategies in order of preference
        bestMatch = targetUsers.find(tu => tu.primaryEmail === sourceUser.primaryEmail);
        if (bestMatch) {
          matchType = 'exact_email';
          matchConfidence = 100;
        } else {
          const sourcePrefix = sourceUser.primaryEmail.split('@')[0];
          bestMatch = targetUsers.find(tu => tu.primaryEmail.startsWith(sourcePrefix + '@'));
          if (bestMatch) {
            matchType = 'exact_email';
            matchConfidence = 90;
          } else {
            bestMatch = targetUsers.find(tu => 
              tu.name.fullName.toLowerCase() === sourceUser.name.fullName.toLowerCase()
            );
            if (bestMatch) {
              matchType = 'name_match';
              matchConfidence = 75;
            }
          }
        }
        break;
    }
  }

  return {
    sourceUser,
    targetUser: bestMatch,
    matchType,
    matchConfidence,
    isAlreadyCloned: !!bestMatch
  };
};

/**
 * Finds all possible matches for a source user (to detect conflicts)
 */
export const findAllMatches = (
  sourceUser: SourceUser,
  targetUsers: TargetUser[],
  options: CloneAnalysisOptions
): TargetUser[] => {
  const matches: TargetUser[] = [];

  // Check custom mapping
  if (options.customMappings && options.customMappings[sourceUser.primaryEmail]) {
    const mappedEmail = options.customMappings[sourceUser.primaryEmail];
    const customMatch = targetUsers.find(tu => tu.primaryEmail === mappedEmail);
    if (customMatch) matches.push(customMatch);
  }

  // Check email exact match
  const emailMatch = targetUsers.find(tu => tu.primaryEmail === sourceUser.primaryEmail);
  if (emailMatch && !matches.includes(emailMatch)) matches.push(emailMatch);

  // Check name-based matches
  const nameMatches = targetUsers.filter(tu => 
    tu.name.fullName.toLowerCase() === sourceUser.name.fullName.toLowerCase() &&
    !matches.includes(tu)
  );
  matches.push(...nameMatches);

  return matches;
};

/**
 * Generates clone suggestions for users that need cloning
 */
export const generateCloneSuggestions = (
  needsCloning: UserCloneMatch[],
  targetDomains: string[]
): {
  user: SourceUser;
  suggestedTargetEmail: string;
  suggestedTargetDomain: string;
  reasoning: string;
}[] => {
  return needsCloning.map(match => {
    const sourceUser = match.sourceUser;
    const sourcePrefix = sourceUser.primaryEmail.split('@')[0];
    
    // Try to suggest the first available target domain
    const suggestedTargetDomain = targetDomains[0] || 'target.domain.com';
    const suggestedTargetEmail = `${sourcePrefix}@${suggestedTargetDomain}`;
    
    return {
      user: sourceUser,
      suggestedTargetEmail,
      suggestedTargetDomain,
      reasoning: `Preserve username '${sourcePrefix}' in target domain '${suggestedTargetDomain}'`
    };
  });
};

/**
 * Validates clone analysis results and provides recommendations
 */
export const validateCloneAnalysis = (result: CloneAnalysisResult): {
  isValid: boolean;
  warnings: string[];
  recommendations: string[];
} => {
  const warnings: string[] = [];
  const recommendations: string[] = [];

  // Check for high conflict rate
  if (result.conflictingUsers.length > result.totalSourceUsers * 0.1) {
    warnings.push(`High conflict rate: ${result.conflictingUsers.length} users have multiple possible matches`);
    recommendations.push('Review conflicting users and create custom mappings to resolve ambiguity');
  }

  // Check for low clone percentage
  if (result.cloneStatus.clonePercentage < 50) {
    warnings.push(`Low clone percentage: Only ${result.cloneStatus.clonePercentage}% of users are already cloned`);
    recommendations.push('Consider bulk user creation for remaining users before proceeding with data migration');
  }

  // Check for unmapped target users
  if (result.unmappedTargetUsers.length > 0) {
    warnings.push(`${result.unmappedTargetUsers.length} target users are not mapped to any source user`);
    recommendations.push('Review unmapped target users - they may be pre-existing accounts or test accounts');
  }

  // Check for admin users in needs cloning
  const adminUsersNeedingCloning = result.needsCloning.filter(match => match.sourceUser.isAdmin);
  if (adminUsersNeedingCloning.length > 0) {
    warnings.push(`${adminUsersNeedingCloning.length} admin users need cloning`);
    recommendations.push('Prioritize creating admin accounts before proceeding with migration');
  }

  return {
    isValid: warnings.length === 0,
    warnings,
    recommendations
  };
};

/**
 * Exports clone analysis results to various formats
 */
export const exportCloneAnalysis = (
  result: CloneAnalysisResult,
  format: 'json' | 'csv' | 'summary'
): string => {
  switch (format) {
    case 'json':
      return JSON.stringify(result, null, 2);
      
    case 'csv':
      const csvLines: string[] = [
        'Source Email,Source Name,Target Email,Target Name,Match Type,Confidence,Status,Target Domain'
      ];
      
      // Add already cloned users
      result.alreadyCloned.forEach(match => {
        csvLines.push([
          match.sourceUser.primaryEmail,
          match.sourceUser.name.fullName,
          match.targetUser?.primaryEmail || '',
          match.targetUser?.name.fullName || '',
          match.matchType,
          match.matchConfidence.toString(),
          'Already Cloned',
          match.targetUser?.targetDomain || ''
        ].join(','));
      });
      
      // Add users needing cloning
      result.needsCloning.forEach(match => {
        csvLines.push([
          match.sourceUser.primaryEmail,
          match.sourceUser.name.fullName,
          '',
          '',
          'no_match',
          '0',
          'Needs Cloning',
          ''
        ].join(','));
      });
      
      return csvLines.join('\n');
      
    case 'summary':
      return `Clone Analysis Summary
======================
Total Source Users: ${result.totalSourceUsers}
Total Target Users: ${result.totalTargetUsers}
Already Cloned: ${result.cloneStatus.clonedCount} (${result.cloneStatus.clonePercentage}%)
Needs Cloning: ${result.cloneStatus.pendingCount}
Conflicts: ${result.cloneStatus.conflictCount}
Unmapped Target Users: ${result.unmappedTargetUsers.length}

Clone Status: ${result.cloneStatus.clonePercentage >= 80 ? 'READY' : result.cloneStatus.clonePercentage >= 50 ? 'PARTIAL' : 'NEEDS_WORK'}`;
      
    default:
      return JSON.stringify(result, null, 2);
  }
};
