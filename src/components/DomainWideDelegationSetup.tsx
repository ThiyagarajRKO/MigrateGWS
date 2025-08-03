'use client'

import React, { useState, memo, useMemo, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { DomainMappingConfig } from '@/types/migration-scenarios'
import { 
  Copy, 
  CheckCircle, 
  AlertCircle, 
  ExternalLink, 
  Shield, 
  Clock, 
  Settings, 
  Key,
  Users,
  Database,
  Globe,
  RefreshCw,
  Check,
  X,
  Info,
  ArrowRight,
  AlertTriangle
} from 'lucide-react'

interface DomainWideDelegationSetupProps {
  sourceAccount?: string
  sourceAccounts?: {[domain: string]: string} // For multiple source domains
  destAccount?: string
  destAccounts?: {[domain: string]: string} // For multiple target domains
  adminEmail?: string // For single super admin scenario
  migrationScenario?: 'single-super-admin' | 'cross-tenant'
  domainMapping?: DomainMappingConfig // Domain mapping configuration
  onComplete?: () => void
  onVerificationStatusChange?: (isVerified: boolean) => void // New callback for verification status
  onAdminEmailChange?: (email: string) => void // For single super admin scenario
  onSourceEmailChange?: (email: string) => void // For cross-tenant source email
  onDestEmailChange?: (email: string) => void // For cross-tenant dest email
  onSourceEmailsChange?: (emails: {[domain: string]: string}) => void // For multiple source domains
  onDestEmailsChange?: (emails: {[domain: string]: string}) => void // For multiple dest domains
  className?: string
  style?: React.CSSProperties // Add style prop support
}

interface DelegationSetupData {
  success: boolean
  migrationScenario?: 'single-super-admin' | 'cross-tenant'
  // For single super admin scenario
  domain?: {
    clientId: string
    domain: string
    adminEmail: string
  }
  // For cross-tenant scenario  
  source?: {
    clientId: string
    domain: string
    adminEmail: string
  }
  destination?: {
    clientId: string
    domain: string
    adminEmail: string
  }
  scopes: string[]
  scopeChunks?: string[][]
  setupInstructions?: {
    // For single super admin
    domain?: DomainSetupInstructions
    // For cross-tenant
    source?: DomainSetupInstructions
    destination?: DomainSetupInstructions
  }
}

interface DomainSetupInstructions {
  title: string
  clientId: string
  scopes: string[]
  adminConsoleUrl: string
  domain: string
  adminEmail: string
}

interface DelegationStatus {
  source: {
    configured: boolean
    verified: boolean
    error?: string
  }
  dest: {
    configured: boolean
    verified: boolean
    error?: string
  }
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || ''

// Required OAuth scopes for complete Google Workspace migration
const REQUIRED_SCOPES = [
  // Admin Directory API - Core user and domain management
  'https://www.googleapis.com/auth/admin.directory.user',
  'https://www.googleapis.com/auth/admin.directory.user.readonly',
  'https://www.googleapis.com/auth/admin.directory.domain',
  'https://www.googleapis.com/auth/admin.directory.domain.readonly',
  'https://www.googleapis.com/auth/admin.directory.group',
  'https://www.googleapis.com/auth/admin.directory.group.readonly',
  'https://www.googleapis.com/auth/admin.directory.group.member',
  'https://www.googleapis.com/auth/admin.directory.group.member.readonly',
  'https://www.googleapis.com/auth/admin.directory.orgunit',
  'https://www.googleapis.com/auth/admin.directory.orgunit.readonly',
  
  // Gmail API - Email migration
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.labels',
  'https://www.googleapis.com/auth/gmail.settings.basic',
  'https://www.googleapis.com/auth/gmail.settings.sharing',
  
  // Google Drive API - File and folder migration
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/drive.photos.readonly',
  
  // Calendar API - Calendar and events migration
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events.readonly',
  'https://www.googleapis.com/auth/calendar.settings.readonly',
  
  // Contacts API - Contact migration
  'https://www.googleapis.com/auth/contacts.readonly',
  'https://www.googleapis.com/auth/contacts',
  
  // Google Photos API - Photo migration
  'https://www.googleapis.com/auth/photoslibrary.readonly',
  'https://www.googleapis.com/auth/photoslibrary.readonly.appcreateddata',
  
  // Google Chat API - Chat and messaging migration
  'https://www.googleapis.com/auth/chat.bot',
  'https://www.googleapis.com/auth/chat.messages.readonly',
  'https://www.googleapis.com/auth/chat.spaces.readonly',
  
  // Google Slides API - Presentation migration
  'https://www.googleapis.com/auth/presentations.readonly',
  'https://www.googleapis.com/auth/presentations',
  
  // Google Forms API - Forms migration
  'https://www.googleapis.com/auth/forms.body.readonly',
  'https://www.googleapis.com/auth/forms.responses.readonly',
  
  // Google Apps Script API - Script migration
  'https://www.googleapis.com/auth/script.projects.readonly',
  'https://www.googleapis.com/auth/script.webapp.deploy.readonly',
  
  // Admin Reports API - Audit logs and usage reports
  'https://www.googleapis.com/auth/admin.reports.audit.readonly',
  'https://www.googleapis.com/auth/admin.reports.usage.readonly',
  
  // Cloud Identity API - Advanced identity management
  'https://www.googleapis.com/auth/cloud-identity.groups.readonly',
  'https://www.googleapis.com/auth/cloud-identity.orgunits.readonly'
]

// Pre-computed scope chunks for better performance
const SCOPE_CHUNKS_15 = (() => {
  const chunks: string[][] = []
  for (let i = 0; i < REQUIRED_SCOPES.length; i += 15) {
    chunks.push(REQUIRED_SCOPES.slice(i, i + 15))
  }
  return chunks
})()

const chunkScopes = (scopes: string[], chunkSize: number): string[][] => {
  // Use pre-computed chunks if possible
  if (scopes === REQUIRED_SCOPES && chunkSize === 15) {
    return SCOPE_CHUNKS_15
  }
  
  const chunks: string[][] = []
  for (let i = 0; i < scopes.length; i += chunkSize) {
    chunks.push(scopes.slice(i, i + chunkSize))
  }
  return chunks
}

const DomainWideDelegationSetup = memo(function DomainWideDelegationSetup({ 
  sourceAccount, 
  sourceAccounts = {},
  destAccount, 
  destAccounts = {},
  adminEmail,
  migrationScenario,
  domainMapping,
  onComplete,
  onVerificationStatusChange,
  onAdminEmailChange,
  onSourceEmailChange,
  onDestEmailChange,
  onSourceEmailsChange,
  onDestEmailsChange,
  className = '',
  style
}: DomainWideDelegationSetupProps) {
  const router = useRouter()
  const [copiedItem, setCopiedItem] = useState<string | null>(null)
  const [showOverviewTooltip, setShowOverviewTooltip] = useState(false)
  
  // Track initial props state to determine if we should show input section
  const [shouldShowInputSection] = useState(() => {
    // Only show input section if no meaningful admin emails were provided as props
    // Check for both undefined and empty string values
    const hasSourceAccount = sourceAccount && sourceAccount.trim() !== '';
    const hasDestAccount = destAccount && destAccount.trim() !== '';
    const hasAdminEmail = adminEmail && adminEmail.trim() !== '';
    const hasSourceAccounts = Object.keys(sourceAccounts || {}).length > 0 && 
                              Object.values(sourceAccounts || {}).some(email => email && email.trim() !== '');
    const hasDestAccounts = Object.keys(destAccounts || {}).length > 0 && 
                            Object.values(destAccounts || {}).some(email => email && email.trim() !== '');
    
    const shouldShow = !hasSourceAccount && !hasDestAccount && !hasAdminEmail && 
                       !hasSourceAccounts && !hasDestAccounts;
    
    return shouldShow;
  });

  // API integration state
  const [delegationSetupLoading, setDelegationSetupLoading] = useState(false)
  const [delegationVerifyLoading, setDelegationVerifyLoading] = useState(false)
  const [delegationSetupData, setDelegationSetupData] = useState<DelegationSetupData | null>(null)
  const [delegationStatus, setDelegationStatus] = useState<DelegationStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  
  // Input state for when no admin emails are provided as props
  const [inputSourceEmail, setInputSourceEmail] = useState<string>('')
  const [inputDestEmail, setInputDestEmail] = useState<string>('')
  const [inputAdminEmail, setInputAdminEmail] = useState<string>('')

  // Persistent verification status management
  const [persistedVerifications, setPersistedVerifications] = useState<{[key: string]: {
    verified: boolean;
    timestamp: number;
    migrationScenario: string;
  }}>({})

  // Load persisted verifications on component mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('gws-verification-status')
      if (stored) {
        const parsed = JSON.parse(stored)
        // Filter out expired verifications (older than 24 hours)
        const now = Date.now()
        const filtered: {[key: string]: {verified: boolean; timestamp: number; migrationScenario: string}} = {}
        
        Object.entries(parsed).forEach(([key, data]: [string, any]) => {
          if (data && typeof data === 'object' && 
              typeof data.verified === 'boolean' && 
              typeof data.timestamp === 'number' &&
              typeof data.migrationScenario === 'string' &&
              now - data.timestamp < 24 * 60 * 60 * 1000) { // 24 hours
            filtered[key] = data
          }
        })
        
        setPersistedVerifications(filtered)
        
        // Update localStorage with filtered data
        if (Object.keys(filtered).length !== Object.keys(parsed).length) {
          localStorage.setItem('gws-verification-status', JSON.stringify(filtered))
        }
      }
    } catch (error) {
      console.error('[DomainWideDelegationSetup] Error loading persisted verifications:', error)
    }
  }, [])

  // Load cached admin emails into input state when no props are provided
  useEffect(() => {
    // Only populate input state if no props are provided and inputs are empty
    if (!adminEmail && !sourceAccount && !destAccount && 
        Object.keys(sourceAccounts || {}).length === 0 && 
        Object.keys(destAccounts || {}).length === 0 &&
        !inputAdminEmail && !inputSourceEmail && !inputDestEmail) {
      
      // Extract admin emails from persistent verification cache
      const verificationKeys = Object.keys(persistedVerifications);
      if (verificationKeys.length > 0) {
        console.log('[DomainWideDelegationSetup] Loading cached admin emails into input state from keys:', verificationKeys);

        // Get the most recent verification
        const mostRecentKey = verificationKeys.reduce((latest, current) => {
          const latestTimestamp = persistedVerifications[latest]?.timestamp || 0;
          const currentTimestamp = persistedVerifications[current]?.timestamp || 0;
          return currentTimestamp > latestTimestamp ? current : latest;
        });

        const verification = persistedVerifications[mostRecentKey];
        if (verification) {
          console.log('[DomainWideDelegationSetup] Loading from most recent verification key:', mostRecentKey, 'data:', verification);

          // Parse the verification key to extract email information
          const [scenario, ...emailParts] = mostRecentKey.split('-');
          
          if (scenario === 'single-super-admin' && emailParts.length > 0) {
            const adminEmailFromCache = emailParts[0];
            console.log('[DomainWideDelegationSetup] Setting input admin email from cache:', adminEmailFromCache);
            setInputAdminEmail(adminEmailFromCache);
          } else if (scenario === 'cross-tenant' && emailParts.length >= 2) {
            // For cross-tenant, we have source and dest emails (sorted)
            const sourceEmailFromCache = emailParts[0];
            const destEmailFromCache = emailParts[1];
            console.log('[DomainWideDelegationSetup] Setting input emails from cache - source:', sourceEmailFromCache, 'dest:', destEmailFromCache);
            setInputSourceEmail(sourceEmailFromCache);
            setInputDestEmail(destEmailFromCache);
          }
        }
      }
    }
  }, [persistedVerifications, adminEmail, sourceAccount, destAccount, sourceAccounts, destAccounts, inputAdminEmail, inputSourceEmail, inputDestEmail])

  // Generate verification key for persistence
  const getVerificationKey = useCallback((adminEmail: string, sourceEmail?: string, destEmail?: string, scenario?: string) => {
    const emails = [adminEmail, sourceEmail, destEmail].filter(Boolean).sort()
    return `${scenario || 'unknown'}-${emails.join('-')}`
  }, [])

  // Check if current configuration is already verified
  const isCurrentConfigurationVerified = useCallback(() => {
    const effectiveAdminEmail = adminEmail || inputAdminEmail || undefined;
    const effectiveSourceAccount = sourceAccount || inputSourceEmail || undefined;
    const effectiveDestAccount = destAccount || inputDestEmail || undefined;
    const hasMultipleDestAccounts = Object.keys(destAccounts || {}).length > 0;
    const hasMultipleSourceAccounts = Object.keys(sourceAccounts || {}).length > 0;
    
    const isSingleSuperAdmin = migrationScenario === 'single-super-admin' || 
                              (effectiveAdminEmail && !effectiveSourceAccount && !effectiveDestAccount && !hasMultipleDestAccounts && !hasMultipleSourceAccounts);
    
    if (isSingleSuperAdmin && effectiveAdminEmail) {
      const key = getVerificationKey(effectiveAdminEmail, undefined, undefined, 'single-super-admin')
      return persistedVerifications[key]?.verified || false
    } else if (effectiveSourceAccount && effectiveDestAccount) {
      const key = getVerificationKey('', effectiveSourceAccount, effectiveDestAccount, 'cross-tenant')
      return persistedVerifications[key]?.verified || false
    }
    
    return false
  }, [
    adminEmail, inputAdminEmail, sourceAccount, inputSourceEmail, destAccount, inputDestEmail,
    destAccounts, sourceAccounts, migrationScenario, persistedVerifications, getVerificationKey
  ])

  // Save verification status to localStorage
  const saveVerificationStatus = useCallback((adminEmail: string, sourceEmail?: string, destEmail?: string, scenario?: string, verified: boolean = true) => {
    try {
      const key = getVerificationKey(adminEmail, sourceEmail, destEmail, scenario)
      const newVerifications = {
        ...persistedVerifications,
        [key]: {
          verified,
          timestamp: Date.now(),
          migrationScenario: scenario || 'unknown'
        }
      }
      
      setPersistedVerifications(newVerifications)
      localStorage.setItem('gws-verification-status', JSON.stringify(newVerifications))
      
      console.log('[DomainWideDelegationSetup] Saved verification status:', {
        key,
        verified,
        scenario,
        adminEmail: adminEmail ? '***@' + adminEmail.split('@')[1] : undefined,
        sourceEmail: sourceEmail ? '***@' + sourceEmail.split('@')[1] : undefined,
        destEmail: destEmail ? '***@' + destEmail.split('@')[1] : undefined
      })
    } catch (error) {
      console.error('[DomainWideDelegationSetup] Error saving verification status:', error)
    }
  }, [persistedVerifications, getVerificationKey])

  // Clear verification status for current configuration
  const clearCurrentVerificationStatus = useCallback(() => {
    const effectiveAdminEmail = adminEmail || inputAdminEmail || undefined;
    const effectiveSourceAccount = sourceAccount || inputSourceEmail || undefined;
    const effectiveDestAccount = destAccount || inputDestEmail || undefined;
    const hasMultipleDestAccounts = Object.keys(destAccounts || {}).length > 0;
    const hasMultipleSourceAccounts = Object.keys(sourceAccounts || {}).length > 0;
    
    const isSingleSuperAdmin = migrationScenario === 'single-super-admin' || 
                              (effectiveAdminEmail && !effectiveSourceAccount && !effectiveDestAccount && !hasMultipleDestAccounts && !hasMultipleSourceAccounts);
    
    let keyToRemove: string | null = null
    
    if (isSingleSuperAdmin && effectiveAdminEmail) {
      keyToRemove = getVerificationKey(effectiveAdminEmail, undefined, undefined, 'single-super-admin')
    } else if (effectiveSourceAccount && effectiveDestAccount) {
      keyToRemove = getVerificationKey('', effectiveSourceAccount, effectiveDestAccount, 'cross-tenant')
    }
    
    if (keyToRemove && persistedVerifications[keyToRemove]) {
      const newVerifications = { ...persistedVerifications }
      delete newVerifications[keyToRemove]
      setPersistedVerifications(newVerifications)
      localStorage.setItem('gws-verification-status', JSON.stringify(newVerifications))
      
      // Clear current session status as well
      setDelegationStatus(null)
      
      console.log('[DomainWideDelegationSetup] Cleared verification status for key:', keyToRemove)
    }
  }, [
    adminEmail, inputAdminEmail, sourceAccount, inputSourceEmail, destAccount, inputDestEmail,
    destAccounts, sourceAccounts, migrationScenario, persistedVerifications, getVerificationKey
  ])

  // Helper function to check if verification is successful
  const isVerificationSuccessful = useCallback((): boolean => {
    // First check if current configuration is already verified and persisted
    if (isCurrentConfigurationVerified()) {
      return true
    }
    
    // Fall back to current session verification status
    if (!delegationStatus) return false
    
    // Get effective values - use props if available, otherwise use input state
    const effectiveAdminEmail = adminEmail || inputAdminEmail || undefined;
    const effectiveSourceAccount = sourceAccount || inputSourceEmail || undefined;
    const effectiveDestAccount = destAccount || inputDestEmail || undefined;
    const hasMultipleDestAccounts = Object.keys(destAccounts || {}).length > 0;
    const hasMultipleSourceAccounts = Object.keys(sourceAccounts || {}).length > 0;
    
    // Determine migration scenario
    const isSingleSuperAdmin = migrationScenario === 'single-super-admin' || 
                              (effectiveAdminEmail && !effectiveSourceAccount && !effectiveDestAccount && !hasMultipleDestAccounts && !hasMultipleSourceAccounts);
    
    if (isSingleSuperAdmin) {
      return delegationStatus.source.verified
    } else {
      // For cross-tenant scenarios, we need both source and dest verified
      // Note: In a real implementation, you might need to handle multiple source/dest verifications
      // For now, we'll check the primary source and dest verification status
      return delegationStatus.source.verified && delegationStatus.dest.verified
    }
  }, [
    delegationStatus,
    adminEmail,
    inputAdminEmail,
    sourceAccount,
    inputSourceEmail,
    destAccount,
    inputDestEmail,
    destAccounts,
    sourceAccounts,
    migrationScenario,
    isCurrentConfigurationVerified
  ])

  // Get cached admin email information for display
  const getCachedAdminInfo = useCallback(() => {
    // Extract admin emails from persistent verification cache
    const verificationKeys = Object.keys(persistedVerifications);
    if (verificationKeys.length === 0) return null;

    console.log('[DomainWideDelegationSetup] Getting cached admin info from keys:', verificationKeys);

    // Get the most recent verification
    const mostRecentKey = verificationKeys.reduce((latest, current) => {
      const latestTimestamp = persistedVerifications[latest]?.timestamp || 0;
      const currentTimestamp = persistedVerifications[current]?.timestamp || 0;
      return currentTimestamp > latestTimestamp ? current : latest;
    });

    const verification = persistedVerifications[mostRecentKey];
    if (!verification) return null;

    console.log('[DomainWideDelegationSetup] Most recent verification key:', mostRecentKey, 'data:', verification);

    // Parse the verification key to extract email information
    // Format: "scenario-email1-email2-email3" (sorted)
    const [scenario, ...emailParts] = mostRecentKey.split('-');
    
    if (scenario === 'single-super-admin' && emailParts.length > 0) {
      const adminInfo = {
        type: 'single-super-admin' as const,
        adminEmail: emailParts[0],
        scenario: verification.migrationScenario,
        timestamp: verification.timestamp
      };
      console.log('[DomainWideDelegationSetup] Extracted single super admin info:', adminInfo);
      return adminInfo;
    } else if (scenario === 'cross-tenant' && emailParts.length >= 2) {
      // For cross-tenant, we have source and dest emails (sorted)
      const adminInfo = {
        type: 'cross-tenant' as const,
        sourceEmail: emailParts[0],
        destEmail: emailParts[1],
        scenario: verification.migrationScenario,
        timestamp: verification.timestamp
      };
      console.log('[DomainWideDelegationSetup] Extracted cross-tenant info:', adminInfo);
      return adminInfo;
    }

    console.log('[DomainWideDelegationSetup] Could not parse verification key:', mostRecentKey);
    return null;
  }, [persistedVerifications])

  // Get effective admin info for display (either from props, input state, or cache)
  const getEffectiveAdminInfo = useCallback(() => {
    // First check if we have admin emails from props
    if (adminEmail || sourceAccount || destAccount || Object.keys(sourceAccounts || {}).length > 0 || Object.keys(destAccounts || {}).length > 0) {
      return {
        hasPropsData: true,
        adminEmail,
        sourceAccount,
        destAccount,
        sourceAccounts,
        destAccounts
      };
    }

    // Check if we have admin emails from input state
    if (inputAdminEmail || inputSourceEmail || inputDestEmail) {
      return {
        hasPropsData: false,
        hasInputData: true,
        adminEmail: inputAdminEmail,
        sourceAccount: inputSourceEmail,
        destAccount: inputDestEmail,
        sourceAccounts: {},
        destAccounts: {}
      };
    }

    // Check if we have cached admin info
    const cachedInfo = getCachedAdminInfo();
    if (cachedInfo) {
      return {
        hasPropsData: false,
        hasInputData: false,
        cachedInfo,
        adminEmail: cachedInfo.type === 'single-super-admin' ? cachedInfo.adminEmail : undefined,
        sourceAccount: cachedInfo.type === 'cross-tenant' ? cachedInfo.sourceEmail : undefined,
        destAccount: cachedInfo.type === 'cross-tenant' ? cachedInfo.destEmail : undefined,
        sourceAccounts: {},
        destAccounts: {}
      };
    }

    return {
      hasPropsData: false,
      hasInputData: false,
      cachedInfo: null,
      adminEmail: undefined,
      sourceAccount: undefined,
      destAccount: undefined,
      sourceAccounts: {},
      destAccounts: {}
    };
  }, [adminEmail, sourceAccount, destAccount, sourceAccounts, destAccounts, inputAdminEmail, inputSourceEmail, inputDestEmail, getCachedAdminInfo])

  // Helper function to check if admin emails are loaded from cache (not from input)
  const isAdminEmailFromCache = useCallback(() => {
    // Only check if we have cached info, regardless of input state
    const cachedInfo = getCachedAdminInfo();
    const hasCache = cachedInfo !== null && cachedInfo !== undefined;
    
    // Also check if the current input values match the cached values
    // This ensures we only show "from cache" when the values actually came from cache
    let inputMatchesCache = false;
    if (hasCache && cachedInfo) {
      if (cachedInfo.type === 'single-super-admin') {
        inputMatchesCache = inputAdminEmail === cachedInfo.adminEmail;
      } else if (cachedInfo.type === 'cross-tenant') {
        inputMatchesCache = inputSourceEmail === cachedInfo.sourceEmail && inputDestEmail === cachedInfo.destEmail;
      }
    }
    
    const fromCache = hasCache && inputMatchesCache;
    console.log('[DomainWideDelegationSetup] isAdminEmailFromCache:', fromCache, {
      hasCache,
      inputMatchesCache,
      cachedInfo: cachedInfo ? {
        type: cachedInfo.type,
        timestamp: cachedInfo.timestamp
      } : null,
      currentInputs: {
        admin: inputAdminEmail,
        source: inputSourceEmail,
        dest: inputDestEmail
      }
    });
    return fromCache;
  }, [getCachedAdminInfo, inputAdminEmail, inputSourceEmail, inputDestEmail])

  // Helper function to check if we have ANY cached verification data (for showing banner)
  const hasCachedVerification = useCallback(() => {
    const cachedInfo = getCachedAdminInfo();
    return cachedInfo !== null && cachedInfo !== undefined;
  }, [getCachedAdminInfo])

  // Domain mapping context helpers
  const getDomainMappingContext = useMemo(() => {
    if (!domainMapping) return null

    const isMultiTarget = domainMapping.type === 'one-to-many' || domainMapping.type === 'cross-tenant-multi-target'
    const isMultiSource = domainMapping.type === 'many-to-one' || domainMapping.type === 'cross-tenant-multi-source'
    const isCrossTenant = domainMapping.type.includes('cross-tenant')
    
    // Calculate complexity level within the useMemo
    const getComplexityLevel = () => {
      if (isCrossTenant && (isMultiTarget || isMultiSource)) return 'Very High'
      if (isCrossTenant) return 'High'
      if (isMultiTarget || isMultiSource) return 'Medium'
      return 'Low'
    }
    
    return {
      type: domainMapping.type,
      description: domainMapping.description || '',
      sourceDomains: domainMapping.sourceDomains || [],
      targetDomains: domainMapping.targetDomains || [],
      multiTargetConfig: domainMapping.multiTargetConfig || [],
      isMultiTarget,
      isMultiSource,
      isCrossTenant,
      complexity: getComplexityLevel()
    }
  }, [domainMapping])

  const getDomainCount = () => {
    const context = getDomainMappingContext
    if (!context) return { source: 0, target: 0 }
    
    return {
      source: context.sourceDomains.length,
      target: context.isMultiTarget ? 
        (context.multiTargetConfig.length || context.targetDomains.length) : 
        (context.targetDomains.length || 1)
    }
  }

  // Monitor verification status and notify parent component
  useEffect(() => {
    if (onVerificationStatusChange) {
      const verificationStatus = isVerificationSuccessful()
      const isPersistent = isCurrentConfigurationVerified()
      console.log('[DomainWideDelegationSetup] Verification status changed:', verificationStatus, {
        delegationStatus: delegationStatus ? {
          source: { verified: delegationStatus.source.verified, configured: delegationStatus.source.configured },
          dest: { verified: delegationStatus.dest.verified, configured: delegationStatus.dest.configured }
        } : null,
        migrationScenario,
        hasAdminEmail: !!adminEmail,
        hasInputAdminEmail: !!inputAdminEmail,
        hasSourceAccount: !!sourceAccount,
        hasInputSourceEmail: !!inputSourceEmail,
        isPersistentVerification: isPersistent,
        verificationSource: isPersistent ? 'persistent' : 'current-session'
      })
      onVerificationStatusChange(verificationStatus)
      
      // If verification is successful and comes from cache, sync admin emails to parent
      if (verificationStatus && isPersistent) {
        const cachedInfo = getCachedAdminInfo()
        if (cachedInfo) {
          console.log('[DomainWideDelegationSetup] Syncing cached admin emails on verification status change:', cachedInfo)
          
          if (cachedInfo.type === 'single-super-admin' && cachedInfo.adminEmail) {
            if (onAdminEmailChange) {
              onAdminEmailChange(cachedInfo.adminEmail)
            }
          } else if (cachedInfo.type === 'cross-tenant') {
            if (cachedInfo.sourceEmail && onSourceEmailChange) {
              onSourceEmailChange(cachedInfo.sourceEmail)
            }
            if (cachedInfo.destEmail && onDestEmailChange) {
              onDestEmailChange(cachedInfo.destEmail)
            }
          }
        }
      }
    }
  }, [isVerificationSuccessful, onVerificationStatusChange, isCurrentConfigurationVerified, getCachedAdminInfo, onAdminEmailChange, onSourceEmailChange, onDestEmailChange])

  // Call onComplete when verification is successful
  useEffect(() => {
    const isVerified = isVerificationSuccessful()
    if (onComplete && isVerified) {
      console.log('[DomainWideDelegationSetup] Calling onComplete - verification successful')
      onComplete()
    }
  }, [isVerificationSuccessful, onComplete])

  // Notify parent component when admin emails change (including empty values)
  useEffect(() => {
    if (onAdminEmailChange) {
      onAdminEmailChange(inputAdminEmail || '')
    }
  }, [inputAdminEmail, onAdminEmailChange])

  useEffect(() => {
    if (onSourceEmailChange) {
      onSourceEmailChange(inputSourceEmail || '')
    }
  }, [inputSourceEmail, onSourceEmailChange])

  useEffect(() => {
    if (onDestEmailChange) {
      onDestEmailChange(inputDestEmail || '')
    }
  }, [inputDestEmail, onDestEmailChange])

  // Initial sync of admin emails when component mounts or props change (including empty values)
  useEffect(() => {
    if (onAdminEmailChange) {
      onAdminEmailChange(adminEmail || '')
    }
  }, [adminEmail, onAdminEmailChange])

  useEffect(() => {
    if (onSourceEmailChange) {
      onSourceEmailChange(sourceAccount || '')
    }
  }, [sourceAccount, onSourceEmailChange])

  useEffect(() => {
    if (onDestEmailChange) {
      onDestEmailChange(destAccount || '')
    }
  }, [destAccount, onDestEmailChange])

  useEffect(() => {
    if (onSourceEmailsChange) {
      onSourceEmailsChange(sourceAccounts || {})
    }
  }, [sourceAccounts, onSourceEmailsChange])

  useEffect(() => {
    if (onDestEmailsChange) {
      onDestEmailsChange(destAccounts || {})
    }
  }, [destAccounts, onDestEmailsChange])

  // Initial sync of persistent verification status with parent component
  useEffect(() => {
    // Small delay to ensure persistedVerifications state has been loaded
    const timeoutId = setTimeout(() => {
      if (onVerificationStatusChange) {
        const isCurrentlyVerified = isCurrentConfigurationVerified()
        console.log('[DomainWideDelegationSetup] Initial sync - checking verification status:', isCurrentlyVerified)
        
        if (isCurrentlyVerified) {
          console.log('[DomainWideDelegationSetup] Syncing persistent verification status with parent on mount')
          onVerificationStatusChange(true)
          
          // Also sync cached admin emails to parent if we have them
          const cachedInfo = getCachedAdminInfo()
          if (cachedInfo) {
            console.log('[DomainWideDelegationSetup] Syncing cached admin emails to parent:', cachedInfo)
            
            if (cachedInfo.type === 'single-super-admin' && cachedInfo.adminEmail) {
              if (onAdminEmailChange) {
                onAdminEmailChange(cachedInfo.adminEmail)
              }
            } else if (cachedInfo.type === 'cross-tenant') {
              if (cachedInfo.sourceEmail && onSourceEmailChange) {
                onSourceEmailChange(cachedInfo.sourceEmail)
              }
              if (cachedInfo.destEmail && onDestEmailChange) {
                onDestEmailChange(cachedInfo.destEmail)
              }
            }
          }
        } else {
          // Even if not verified from cache, sync any cached admin emails for display
          const cachedInfo = getCachedAdminInfo()
          if (cachedInfo) {
            console.log('[DomainWideDelegationSetup] No cached verification, but syncing cached admin emails for display:', cachedInfo)
            
            if (cachedInfo.type === 'single-super-admin' && cachedInfo.adminEmail) {
              if (onAdminEmailChange) {
                onAdminEmailChange(cachedInfo.adminEmail)
              }
            } else if (cachedInfo.type === 'cross-tenant') {
              if (cachedInfo.sourceEmail && onSourceEmailChange) {
                onSourceEmailChange(cachedInfo.sourceEmail)
              }
              if (cachedInfo.destEmail && onDestEmailChange) {
                onDestEmailChange(cachedInfo.destEmail)
              }
            }
          }
        }
      }
    }, 100) // Small delay to ensure state has been initialized

    return () => clearTimeout(timeoutId)
  }, []) // Empty dependency array to run only on mount

  // Sync verification status and admin emails when persistedVerifications changes
  useEffect(() => {
    // Skip if this is the initial empty state
    if (Object.keys(persistedVerifications).length === 0) return;
    
    console.log('[DomainWideDelegationSetup] persistedVerifications changed, syncing status and emails')
    
    // Check and sync verification status
    if (onVerificationStatusChange) {
      const isCurrentlyVerified = isCurrentConfigurationVerified()
      if (isCurrentlyVerified) {
        console.log('[DomainWideDelegationSetup] Syncing verification status: verified')
        onVerificationStatusChange(true)
      }
    }
    
    // Sync cached admin emails
    const cachedInfo = getCachedAdminInfo()
    if (cachedInfo) {
      console.log('[DomainWideDelegationSetup] Syncing cached admin emails after verification change:', cachedInfo)
      
      if (cachedInfo.type === 'single-super-admin' && cachedInfo.adminEmail) {
        console.log('[DomainWideDelegationSetup] Calling onAdminEmailChange with cached admin email:', cachedInfo.adminEmail)
        if (onAdminEmailChange) {
          onAdminEmailChange(cachedInfo.adminEmail)
        }
      } else if (cachedInfo.type === 'cross-tenant') {
        if (cachedInfo.sourceEmail && onSourceEmailChange) {
          console.log('[DomainWideDelegationSetup] Calling onSourceEmailChange with cached source email:', cachedInfo.sourceEmail)
          onSourceEmailChange(cachedInfo.sourceEmail)
        }
        if (cachedInfo.destEmail && onDestEmailChange) {
          console.log('[DomainWideDelegationSetup] Calling onDestEmailChange with cached dest email:', cachedInfo.destEmail)
          onDestEmailChange(cachedInfo.destEmail)
        }
      }
    } else {
      console.log('[DomainWideDelegationSetup] No cached admin info found when persistent verifications changed')
    }
  }, [persistedVerifications, onVerificationStatusChange, isCurrentConfigurationVerified, getCachedAdminInfo, onAdminEmailChange, onSourceEmailChange, onDestEmailChange])

  const copyToClipboard = (text: string, itemId: string) => {
    navigator.clipboard.writeText(text)
    setCopiedItem(itemId)
    setTimeout(() => setCopiedItem(null), 2000)
  }

  const clearMessages = () => {
    setError(null)
    setSuccessMessage(null)
  }

  // Domain-wide delegation setup API call
  const setupDomainWideDelegation = async () => {
    // Get effective values - use props if available, otherwise use input state
    const effectiveAdminEmail = adminEmail || inputAdminEmail || undefined;
    const effectiveSourceAccount = sourceAccount || inputSourceEmail || undefined;
    const effectiveDestAccount = destAccount || inputDestEmail || undefined;
    const hasMultipleDestAccounts = Object.keys(destAccounts || {}).length > 0;
    const hasMultipleSourceAccounts = Object.keys(sourceAccounts || {}).length > 0;
    
    // Determine migration scenario and validate inputs
    const isSingleSuperAdmin = migrationScenario === 'single-super-admin' || 
                              (effectiveAdminEmail && !effectiveSourceAccount && !effectiveDestAccount && !hasMultipleDestAccounts && !hasMultipleSourceAccounts);
    const isCrossTenant = migrationScenario === 'cross-tenant' || 
                         ((effectiveSourceAccount || hasMultipleSourceAccounts) && (effectiveDestAccount || hasMultipleDestAccounts));

    // Validation based on migration scenarios
    if (isSingleSuperAdmin) {
      // Single Super Admin: Only admin email required, no destination email needed
      if (!effectiveAdminEmail || effectiveAdminEmail.trim() === '') {
        setError('Admin email is required for single super admin scenario. Please enter an admin email above.');
        return;
      }
      
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(effectiveAdminEmail.trim())) {
        setError('Please enter a valid admin email address.');
        return;
      }
    } else if (isCrossTenant) {
      // Cross Tenant: Both source and destination admin emails required
      if (!effectiveSourceAccount && !hasMultipleSourceAccounts) {
        setError('Source admin email is required for cross-tenant migration. Please enter a source admin email above or configure multiple source domains.');
        return;
      }

      // If we have multiple source domains, ensure all have admin emails
      if (hasMultipleSourceAccounts) {
        const missingSourceAdmins = Object.entries(sourceAccounts || {}).filter(([domain, email]) => !email || email.trim() === '');
        if (missingSourceAdmins.length > 0) {
          const missingDomains = missingSourceAdmins.map(([domain]) => domain).join(', ');
          setError(`Admin emails are required for all source domains. Missing admin emails for: ${missingDomains}`);
          return;
        }
        
        // Validate all source admin emails
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const invalidSourceEmails = Object.entries(sourceAccounts || {}).filter(([domain, email]) => 
          email && email.trim() !== '' && !emailRegex.test(email.trim())
        );
        if (invalidSourceEmails.length > 0) {
          const invalidDomains = invalidSourceEmails.map(([domain]) => domain).join(', ');
          setError(`Invalid email addresses found for source domains: ${invalidDomains}`);
          return;
        }
      } else if (effectiveSourceAccount && effectiveSourceAccount.trim() !== '') {
        // Validate single source email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(effectiveSourceAccount.trim())) {
          setError('Please enter a valid source admin email address.');
          return;
        }
      }

      // For cross-tenant, we need either a single destination admin OR multiple destination admins
      if (!effectiveDestAccount && !hasMultipleDestAccounts) {
        setError('Destination admin email is required for cross-tenant migration. Please enter a destination admin email above or configure multiple target domains.');
        return;
      }

      // If we have multiple target domains, ensure all have admin emails
      if (hasMultipleDestAccounts) {
        const missingAdmins = Object.entries(destAccounts || {}).filter(([domain, email]) => !email || email.trim() === '');
        if (missingAdmins.length > 0) {
          const missingDomains = missingAdmins.map(([domain]) => domain).join(', ');
          setError(`Admin emails are required for all target domains. Missing admin emails for: ${missingDomains}`);
          return;
        }
        
        // Validate all destination admin emails
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const invalidDestEmails = Object.entries(destAccounts || {}).filter(([domain, email]) => 
          email && email.trim() !== '' && !emailRegex.test(email.trim())
        );
        if (invalidDestEmails.length > 0) {
          const invalidDomains = invalidDestEmails.map(([domain]) => domain).join(', ');
          setError(`Invalid email addresses found for destination domains: ${invalidDomains}`);
          return;
        }
      } else if (effectiveDestAccount && effectiveDestAccount.trim() !== '') {
        // Validate single destination email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(effectiveDestAccount.trim())) {
          setError('Please enter a valid destination admin email address.');
          return;
        }
      }
    } else {
      // No clear scenario detected
      setError('Please specify admin email(s) for your migration scenario. Enter either a single super admin email or source/destination admin emails for cross-tenant migration.');
      return;
    }

    setDelegationSetupLoading(true)
    setError(null)
    setSuccessMessage(null)
    
    // Debug logging
    console.log('[Setup Domain-wide Delegation] Debugging email values:', {
      adminEmail,
      inputAdminEmail,
      sourceAccount,
      inputSourceEmail,
      destAccount,
      inputDestEmail,
      effectiveAdminEmail,
      effectiveSourceAccount,
      effectiveDestAccount,
      isSingleSuperAdmin,
      isCrossTenant,
      migrationScenario
    })
    
    try {
      let requestPayload: any

      if (isSingleSuperAdmin) {
        requestPayload = {
          adminEmail: effectiveAdminEmail?.trim() || '',
          migrationScenario: 'single-super-admin'
        }
      } else {
        // Cross-tenant scenario
        requestPayload = {
          migrationScenario: 'cross-tenant'
        }
        
        // Handle single source or multiple sources
        if (effectiveSourceAccount) {
          requestPayload.sourceAdminEmail = effectiveSourceAccount.trim()
        } else if (hasMultipleSourceAccounts) {
          // For multiple sources, we'll use the first one for the API call
          // In a real scenario, you might want to handle this differently
          const firstSourceDomain = Object.keys(sourceAccounts)[0]
          const firstSourceEmail = sourceAccounts[firstSourceDomain]
          requestPayload.sourceAdminEmail = firstSourceEmail?.trim() || ''
          requestPayload.sourceAccounts = sourceAccounts
        }
        
        // Handle single destination or multiple destinations
        if (effectiveDestAccount) {
          requestPayload.destAdminEmail = effectiveDestAccount.trim()
        } else if (hasMultipleDestAccounts) {
          // For multiple destinations, we'll use the first one for the API call
          // In a real scenario, you might want to handle this differently
          const firstDestDomain = Object.keys(destAccounts)[0]
          const firstDestEmail = destAccounts[firstDestDomain]
          requestPayload.destAdminEmail = firstDestEmail?.trim() || ''
          requestPayload.destAccounts = destAccounts
        } else {
          // Fallback - this shouldn't happen due to our validation above
          setError('Destination admin email is required for cross-tenant migration.')
          return
        }
      }

      console.log('[Setup Domain-wide Delegation] Final request payload:', requestPayload)

      const response = await fetch(`${API_BASE_URL}/api/v1/delegation/setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Setup failed: ${errorText}`)
      }

      const data = await response.json()

      if (data.success) {
        setDelegationSetupData({
          success: data.success,
          migrationScenario: data.migrationScenario,
          domain: data.domain,
          source: data.source,
          destination: data.destination,
          scopes: data.scopes || REQUIRED_SCOPES,
          scopeChunks: chunkScopes(data.scopes || REQUIRED_SCOPES, 15),
          setupInstructions: data.setupInstructions
        })
        setSuccessMessage('Setup instructions generated successfully!')
        setTimeout(() => setSuccessMessage(null), 5000) // Clear after 5 seconds
      } else {
        throw new Error(data.error || 'Setup generation failed')
      }
    } catch (error) {
      console.error('[Delegation Setup] Error:', error)
      setError(error instanceof Error ? error.message : 'Failed to generate setup instructions')
    } finally {
      setDelegationSetupLoading(false)
    }
  }

  // Domain-wide delegation verification function
  const verifyDomainWideDelegation = async () => {
    // Get effective values - use props if available, otherwise use input state
    const effectiveAdminEmail = adminEmail || inputAdminEmail || undefined;
    const effectiveSourceAccount = sourceAccount || inputSourceEmail || undefined;
    const effectiveDestAccount = destAccount || inputDestEmail || undefined;
    const hasMultipleDestAccounts = Object.keys(destAccounts || {}).length > 0;
    const hasMultipleSourceAccounts = Object.keys(sourceAccounts || {}).length > 0;
    
    // Determine verification scenario based on setup data or props
    const isSingleSuperAdmin = delegationSetupData?.migrationScenario === 'single-super-admin' || 
                              (effectiveAdminEmail && !effectiveSourceAccount && !effectiveDestAccount && !hasMultipleDestAccounts && !hasMultipleSourceAccounts);
    const isCrossTenant = delegationSetupData?.migrationScenario === 'cross-tenant' || 
                         ((effectiveSourceAccount || hasMultipleSourceAccounts) && (effectiveDestAccount || hasMultipleDestAccounts));

    if (isSingleSuperAdmin && !effectiveAdminEmail) {
      setError('Admin email is required for single super admin verification. Please enter an admin email above.');
      return;
    }

    if (isCrossTenant && !effectiveSourceAccount && !hasMultipleSourceAccounts) {
      setError('Source admin email is required for cross-tenant verification. Please enter a source admin email above or configure multiple source domains.');
      return;
    }

    if (isCrossTenant && !effectiveDestAccount && !hasMultipleDestAccounts) {
      setError('At least one destination admin email is required for cross-tenant verification. Please enter a destination admin email above.');
      return;
    }

    if (!isSingleSuperAdmin && !isCrossTenant) {
      setError('Please specify at least one admin email above to verify the configuration.');
      return;
    }

    setDelegationVerifyLoading(true)
    setError(null)
    setSuccessMessage(null)
    
    console.log('[Delegation Verify] Starting verification with payload:', {
      isSingleSuperAdmin,
      isCrossTenant,
      effectiveAdminEmail,
      effectiveSourceAccount,
      effectiveDestAccount,
      hasMultipleSourceAccounts,
      hasMultipleDestAccounts
    })
    
    try {
      let requestPayload: any

      if (isSingleSuperAdmin) {
        requestPayload = {
          adminEmail: effectiveAdminEmail,
          migrationScenario: 'single-super-admin'
        }
      } else {
        // Cross-tenant scenario
        requestPayload = {
          migrationScenario: 'cross-tenant'
        }
        
        // Handle single source or multiple sources
        if (effectiveSourceAccount) {
          requestPayload.sourceAdminEmail = effectiveSourceAccount
          requestPayload.sourceEmail = effectiveSourceAccount
        } else if (hasMultipleSourceAccounts) {
          // For multiple sources, we'll use the first one for the API call
          const firstSourceDomain = Object.keys(sourceAccounts)[0]
          const firstSourceEmail = sourceAccounts[firstSourceDomain]
          requestPayload.sourceAdminEmail = firstSourceEmail
          requestPayload.sourceEmail = firstSourceEmail
          requestPayload.sourceAccounts = sourceAccounts
        }
        
        // Handle single destination or multiple destinations
        if (effectiveDestAccount) {
          requestPayload.destAdminEmail = effectiveDestAccount
          requestPayload.destEmail = effectiveDestAccount
        } else if (hasMultipleDestAccounts) {
          // For multiple destinations, we'll use the first one for the API call
          const firstDestDomain = Object.keys(destAccounts)[0]
          const firstDestEmail = destAccounts[firstDestDomain]
          requestPayload.destAdminEmail = firstDestEmail
          requestPayload.destEmail = firstDestEmail
          requestPayload.destAccounts = destAccounts
        } else {
          // Fallback - this shouldn't happen due to our validation above
          setError('Destination admin email is required for cross-tenant verification.')
          return
        }
      }
      
      const apiUrl = `${API_BASE_URL}/api/v1/delegation/verify`
      console.log('[Delegation Verify] Making API call to:', apiUrl)
      console.log('[Delegation Verify] Request payload:', requestPayload)
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Verification failed: ${errorText}`)
      }

      const data = await response.json()

      if (data.success && data.verification) {
        if (isSingleSuperAdmin) {
          // Handle single domain verification
          const sourceVerified = data.verification.domain?.verified || false
          setDelegationStatus({
            source: {
              configured: data.verification.domain?.testResults?.length > 0 || false,
              verified: sourceVerified,
              error: data.verification.domain?.testResults?.[0]?.error
            },
            dest: {
              configured: false,
              verified: false,
              error: undefined
            }
          })
          
          // Save verification status for single super admin if successful
          if (sourceVerified && effectiveAdminEmail) {
            saveVerificationStatus(effectiveAdminEmail, undefined, undefined, 'single-super-admin', true)
          }
        } else {
          // Handle cross-tenant verification
          const sourceVerified = data.verification.source?.verified || false
          const destVerified = data.verification.destination?.verified || false
          setDelegationStatus({
            source: {
              configured: data.verification.source?.testResults?.length > 0 || false,
              verified: sourceVerified,
              error: data.verification.source?.testResults?.[0]?.error
            },
            dest: {
              configured: data.verification.destination?.testResults?.length > 0 || false,
              verified: destVerified,
              error: data.verification.destination?.testResults?.[0]?.error
            }
          })
          
          // Save verification status for cross-tenant if both successful
          if (sourceVerified && destVerified && effectiveSourceAccount && effectiveDestAccount) {
            saveVerificationStatus('', effectiveSourceAccount, effectiveDestAccount, 'cross-tenant', true)
          }
        }
        setSuccessMessage('Verification completed successfully!')
        setTimeout(() => setSuccessMessage(null), 5000) // Clear after 5 seconds
      } else {
        const errorMessage = data.error || data.message || 'Verification failed'
        if (isSingleSuperAdmin) {
          setDelegationStatus({
            source: { configured: false, verified: false, error: errorMessage },
            dest: { configured: false, verified: false, error: undefined }
          })
        } else {
          setDelegationStatus({
            source: { configured: false, verified: false, error: errorMessage },
            dest: { configured: false, verified: false, error: errorMessage }
          })
        }
        setError(errorMessage)
      }
    } catch (error) {
      console.error('[Delegation Verify] Error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Verification failed'
      if (isSingleSuperAdmin) {
        setDelegationStatus({
          source: { configured: false, verified: false, error: errorMessage },
          dest: { configured: false, verified: false, error: undefined }
        })
      } else {
        setDelegationStatus({
          source: { configured: false, verified: false, error: errorMessage },
          dest: { configured: false, verified: false, error: errorMessage }
        })
      }
      setError(errorMessage)
    } finally {
      setDelegationVerifyLoading(false)
    }
  }

  // Override completion status when verification is successful
  const isVerified = isVerificationSuccessful()
  const allStepsCompleted = isVerified
  
  // Override progress calculation when verification is successful
  const completedCount = isVerified ? 1 : 0
  const totalSteps = 1

  const renderDomainStatus = (domain: 'source' | 'dest', label: string) => {
    const status = delegationStatus?.[domain]
    if (!status) return null

    // Get effective values for determining single super admin scenario
    const effectiveAdminEmail = adminEmail || inputAdminEmail || undefined;
    const effectiveSourceAccount = sourceAccount || inputSourceEmail || undefined;
    const effectiveDestAccount = destAccount || inputDestEmail || undefined;
    const hasMultipleDestAccounts = Object.keys(destAccounts || {}).length > 0;
    const hasMultipleSourceAccounts = Object.keys(sourceAccounts || {}).length > 0;

    // Don't render dest status for single super admin scenario
    const isSingleSuperAdmin = delegationSetupData?.migrationScenario === 'single-super-admin' || 
                              (effectiveAdminEmail && !effectiveSourceAccount && !effectiveDestAccount && !hasMultipleDestAccounts && !hasMultipleSourceAccounts);
    if (domain === 'dest' && isSingleSuperAdmin) return null

    return (
      <div className={`p-5 rounded-xl border shadow-sm ${
        status.verified 
          ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-300/60 shadow-blue-100/50' 
          : status.configured 
          ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200/60 shadow-amber-100/50'
          : 'bg-gradient-to-br from-red-50 to-rose-50 border-red-200/60 shadow-red-100/50'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-semibold flex items-center gap-2">
            <Globe className="h-5 w-5" />
            {isSingleSuperAdmin && domain === 'source' ? 'Domain Status' : label}
          </h4>
          {status.verified ? (
            <CheckCircle className="h-6 w-6 text-blue-600" />
          ) : status.configured ? (
            <AlertCircle className="h-6 w-6 text-amber-600" />
          ) : (
            <X className="h-6 w-6 text-red-600" />
          )}
        </div>
        <div className="text-sm">
          <div className={`font-semibold ${
            status.verified ? 'text-blue-800' : status.configured ? 'text-amber-800' : 'text-red-800'
          }`}>
            {status.verified ? 'Verified & Ready' : status.configured ? 'Configured but Not Verified' : 'Not Configured'}
          </div>
          {status.error && (
            <div className="text-red-700 text-sm mt-1 font-semibold">{status.error}</div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-gradient-to-br from-slate-50 to-blue-50 rounded-2xl border border-blue-200/60 shadow-lg shadow-blue-200/50 ${className}`} style={style}>
      {/* Header */}
      <div className="p-6 border-b border-blue-200/60 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/25">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-gray-800">
                Domain-wide Delegation Setup
              </h2>
              <div className="relative">
                <Info 
                  className="w-5 h-5 text-slate-400 hover:text-gray-600 cursor-help transition-colors duration-200" 
                  onMouseEnter={() => setShowOverviewTooltip(true)}
                  onMouseLeave={() => setShowOverviewTooltip(false)}
                />
                
                {/* Overview Tooltip */}
                {showOverviewTooltip && (
                  <div className="absolute left-0 top-6 z-50 w-96 p-4 bg-white/95 backdrop-blur-sm border border-blue-200 rounded-xl shadow-xl shadow-blue-900/10">
                    <div className="space-y-4 text-base">
                      <div>
                        <h4 className="font-bold text-slate-900 mb-3 text-lg">🔐 What is Domain-wide Delegation?</h4>
                        <p className="text-slate-700 leading-relaxed">
                          Domain-wide Delegation allows a service account to access Google Workspace data on behalf of users across your entire domain without requiring individual user consent.
                        </p>
                      </div>
                      
                      <div>
                        <h4 className="font-bold text-slate-900 mb-3 text-lg">📋 Why do we need it for migration?</h4>
                        <ul className="text-slate-700 space-y-2 leading-relaxed">
                          <li>• Automated access to all user data (Gmail, Drive, Calendar, Contacts, Photos, Chat, etc.)</li>
                          <li>• No individual user authentication required</li>
                          <li>• Comprehensive data migration capabilities</li>
                          <li>• Secure, auditable access control</li>
                        </ul>
                      </div>
                      
                      {getDomainMappingContext && (
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-2">�️ Your Migration Scenario:</h4>
                          <div className="text-gray-600 space-y-1">
                            <div className="font-medium">{getDomainMappingContext.description}</div>
                            <div className="text-sm text-slate-600 font-medium">
                              Complexity: {getDomainMappingContext.complexity} | 
                              Sources: {getDomainCount().source} | 
                              Targets: {getDomainCount().target}
                            </div>
                            {getDomainMappingContext.isCrossTenant && (
                              <div className="text-orange-700 text-sm font-medium">⚠️ Cross-tenant migration requires separate domain setups</div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2">�🔧 Setup Requirements:</h4>
                        <ul className="text-gray-600 space-y-1">
                          <li>• Super Admin access to {getDomainMappingContext?.isCrossTenant ? 'source and target domains' : 'your domain'}</li>
                          <li>• Google Cloud Project with enabled APIs</li>
                          <li>• Service Account with Domain-wide Delegation configured</li>
                          {getDomainMappingContext?.isMultiTarget && <li>• Admin access to all target domains</li>}
                          {getDomainMappingContext?.isMultiSource && <li>• Admin access to all source domains</li>}
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2">⚠️ Security Considerations:</h4>
                        <ul className="text-gray-600 space-y-1">
                          <li>• Only authorize trusted applications</li>
                          <li>• Regularly review delegated access</li>
                          <li>• Can be revoked at any time from Admin Console</li>
                          <li>• All API calls are logged and auditable</li>
                          {getDomainMappingContext?.complexity === 'Very High' && (
                            <li className="text-orange-600">• Consider testing with subset of users first</li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <p className="text-slate-700 mt-2 font-medium text-base">
              Configure secure cross-domain access for Google Workspace migration
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-slate-600 font-semibold">Progress</div>
            <div className="text-xl font-bold text-gray-800">
              {completedCount}/{totalSteps}
            </div>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="mt-4">
          <div className="w-full bg-slate-200 rounded-full h-2.5 shadow-inner">
            <div 
              className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2.5 rounded-full transition-all duration-500 shadow-sm"
              style={{ width: `${(completedCount / totalSteps) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Account Information & Domain Mapping */}
        {(() => {
          const effectiveAdminInfo = getEffectiveAdminInfo();
          const hasAnyAdminInfo = effectiveAdminInfo.hasPropsData || effectiveAdminInfo.cachedInfo;
          
          return (hasAnyAdminInfo || domainMapping) && (
            <div className="mb-6 p-5 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-300/60 rounded-xl shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                Migration Configuration
                {effectiveAdminInfo.cachedInfo && (
                  <span className="ml-2 px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full font-medium">
                    From Cache
                  </span>
                )}
              </h3>
              
              {/* Domain Mapping Information */}
              {domainMapping && getDomainMappingContext && (
                <div className="mb-4 p-4 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/60 rounded-lg shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-gray-800 text-sm">Domain Mapping Strategy</h4>
                    <span className={`px-3 py-1.5 text-xs rounded-full font-semibold shadow-sm ${
                      getDomainMappingContext.complexity === 'Very High' ? 'bg-gradient-to-r from-red-500 to-red-600 text-white' :
                      getDomainMappingContext.complexity === 'High' ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white' :
                      getDomainMappingContext.complexity === 'Medium' ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white' :
                      'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
                    }`}>
                      {getDomainMappingContext.complexity} Complexity
                    </span>
                  </div>
                  <p className="text-gray-700 text-sm mb-2">{getDomainMappingContext.description}</p>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm font-medium">
                    <div>
                      <span className="text-gray-700 font-medium">Source Domains:</span>
                      <span className="text-gray-700 ml-1">{getDomainCount().source}</span>
                    </div>
                    <div>
                      <span className="text-gray-700 font-medium">Target Domains:</span>
                      <span className="text-gray-700 ml-1">{getDomainCount().target}</span>
                    </div>
                  </div>
                  
                  {getDomainMappingContext.isCrossTenant && (
                    <div className="mt-2 flex items-center gap-1 text-sm text-gray-700 font-medium">
                      <AlertCircle className="h-3 w-3" />
                      <span>Cross-tenant migration requires domain-wide delegation setup for both source and destination domains</span>
                    </div>
                  )}
                </div>
              )}
              
              <div className="space-y-4 text-sm">
                {/* Single Super Admin scenario */}
                {(effectiveAdminInfo.adminEmail && !effectiveAdminInfo.sourceAccount && Object.keys(effectiveAdminInfo.sourceAccounts || {}).length === 0 && !effectiveAdminInfo.destAccount && Object.keys(effectiveAdminInfo.destAccounts || {}).length === 0) && (
                  <div>
                    <div className="text-gray-700 font-medium">
                      Super Admin
                      {effectiveAdminInfo.cachedInfo && (
                        <span className="ml-2 text-xs text-green-600 font-medium">
                          (Verified {new Date(effectiveAdminInfo.cachedInfo.timestamp).toLocaleDateString()})
                        </span>
                      )}
                    </div>
                    <div className="text-gray-800">{effectiveAdminInfo.adminEmail}</div>
                    <div className="text-gray-700 text-sm mt-1 font-medium">
                      {getDomainMappingContext?.isCrossTenant ? 
                        'Note: Cross-tenant migrations typically require separate admin accounts for each domain' :
                        'Single domain migration scenario'
                      }
                    </div>
                  </div>
                )}

                {/* Cross-tenant scenario */}
                {/* Single source domain */}
                {effectiveAdminInfo.sourceAccount && Object.keys(effectiveAdminInfo.sourceAccounts || {}).length === 0 && (
                  <div>
                    <div className="text-gray-700 font-medium">
                      Source Domain Admin
                      {effectiveAdminInfo.cachedInfo && (
                        <span className="ml-2 text-xs text-green-600 font-medium">
                          (Verified {new Date(effectiveAdminInfo.cachedInfo.timestamp).toLocaleDateString()})
                        </span>
                      )}
                    </div>
                    <div className="text-gray-800">{effectiveAdminInfo.sourceAccount}</div>
                  </div>
                )}
                
                {/* Multiple source domains */}
                {Object.keys(effectiveAdminInfo.sourceAccounts || {}).length > 0 && (
                  <div>
                    <div className="text-blue-700 font-semibold mb-2">Source Domain Admins</div>
                    <div className="space-y-2">
                      {Object.entries(effectiveAdminInfo.sourceAccounts).map(([domain, email]) => (
                        <div key={domain} className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-100 to-indigo-100 border border-blue-200/60 rounded-lg shadow-sm">
                          <span className="text-blue-700 font-mono text-sm font-bold">{domain}</span>
                          <span className="text-blue-800 text-sm font-medium">{email}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Single destination domain */}
                {effectiveAdminInfo.destAccount && Object.keys(effectiveAdminInfo.destAccounts || {}).length === 0 && (
                  <div>
                    <div className="text-blue-700 font-semibold">
                      Destination Domain Admin
                      {effectiveAdminInfo.cachedInfo && (
                        <span className="ml-2 text-xs text-green-600 font-medium">
                          (Verified {new Date(effectiveAdminInfo.cachedInfo.timestamp).toLocaleDateString()})
                        </span>
                      )}
                    </div>
                    <div className="text-blue-800 font-medium">{effectiveAdminInfo.destAccount}</div>
                  </div>
                )}
                
                {/* Multiple destination domains */}
                {Object.keys(effectiveAdminInfo.destAccounts || {}).length > 0 && (
                  <div>
                    <div className="text-blue-700 font-semibold mb-2">Destination Domain Admins</div>
                    <div className="space-y-2">
                      {Object.entries(effectiveAdminInfo.destAccounts).map(([domain, email]) => (
                        <div key={domain} className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-100 to-indigo-100 border border-blue-300/60 rounded-lg shadow-sm">
                          <span className="text-blue-700 font-mono text-sm font-bold">{domain}</span>
                          <span className="text-blue-800 text-sm font-medium">{email}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Unified Setup Section - Always Available */}
        <div className="mb-6 p-6 bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-50 border border-blue-200/60 rounded-xl shadow-lg shadow-blue-100/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/25">
              <Settings className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-800">
                Domain-wide Delegation Setup
              </h3>
              <p className="text-base text-gray-700 leading-relaxed font-medium">
                {getDomainMappingContext ? (
                  <>
                    Configure domain-wide delegation for your <strong>{getDomainMappingContext.type.replace('-', ' ')}</strong> migration.
                    {getDomainMappingContext.isCrossTenant ? 
                      ' Automated setup will generate service accounts and instructions for both domains.' :
                      ' Automated setup will generate service account and instructions for your domain.'
                    }
                    {getDomainMappingContext.complexity === 'Very High' && (
                      <> This complex migration requires careful configuration.</>
                    )}
                  </>
                ) : (
                  adminEmail && !sourceAccount && !destAccount 
                    ? 'Configure domain-wide delegation for your domain migration.'
                    : (sourceAccount && destAccount)
                      ? 'Configure domain-wide delegation for cross-tenant migration between both domains.'
                      : (sourceAccount || destAccount)
                        ? 'Configure domain-wide delegation for the specified domain.'
                        : 'Configure domain-wide delegation for your Google Workspace migration with automated setup.'
                )}
              </p>
            </div>
          </div>
          
          {/* Admin Email Input Section - Show based on initial props state */}
          {shouldShowInputSection && (
            <div className="mb-4 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200/60 rounded-lg shadow-sm">
              {/* Cache Status Banner */}
              {hasCachedVerification() && (
                <div className="mb-4 p-3 bg-gradient-to-r from-green-100 to-emerald-100 border border-green-300/60 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <h5 className="font-bold text-green-800">Using Cached Configuration</h5>
                  </div>
                  <p className="text-sm text-green-700 font-medium">
                    Previously verified admin emails have been loaded. You can review and modify them below if needed.
                  </p>
                  <button
                    onClick={() => {
                      console.log('[DomainWideDelegationSetup] Clear Cache button clicked - resetting admin emails to empty');
                      
                      // Clear cached admin emails
                      setInputAdminEmail('')
                      setInputSourceEmail('')
                      setInputDestEmail('')
                      
                      // Clear the persistent verification cache
                      setPersistedVerifications({})
                      localStorage.removeItem('gws-verification-status')
                      
                      console.log('[DomainWideDelegationSetup] Cleared cached admin emails and verification status')
                    }}
                    className="mt-2 flex items-center gap-1 px-3 py-1 text-xs bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors duration-200 font-medium"
                  >
                    <X className="h-3 w-3" />
                    Clear Cache & Start Fresh
                  </button>
                </div>
              )}
              
              <h4 className="font-bold text-gray-800 mb-4 text-lg">Domain Administrator Configuration</h4>
              <p className="text-base text-gray-700 mb-4 leading-relaxed">
                {getDomainMappingContext ? (
                  <>
                    For your <strong>{getDomainMappingContext.type.replace('-', ' ')}</strong> migration scenario:
                    {getDomainMappingContext.isCrossTenant ? (
                      <div className="mt-2">
                        <div className="font-semibold">Cross-Tenant Migration Requirements:</div>
                        <div className="ml-2">
                          • Source domain admin email is <strong>required</strong>
                          • Destination domain admin email is <strong>required</strong>
                          {getDomainMappingContext.isMultiTarget && (
                            <div>• Admin emails needed for <strong>all target domains</strong></div>
                          )}
                          {getDomainMappingContext.isMultiSource && (
                            <div>• Admin emails needed for <strong>all source domains</strong></div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2">
                        <div className="font-medium">Single Super Admin Requirements:</div>
                        <div className="ml-2">
                          • Only super admin email is <strong>required</strong>
                          • No destination admin email needed
                          • Must have access to all domains in the migration
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    To generate setup instructions, choose your migration scenario:
                    <div className="mt-2 space-y-1">
                      <div><strong>Single Super Admin:</strong> Use if you have admin access to all domains</div>
                      <div><strong>Cross-Tenant:</strong> Use if migrating between different tenants/organizations</div>
                    </div>
                  </>
                )}
              </p>
              
              {/* Domain mapping specific guidance */}
              {getDomainMappingContext && (
                <div className="mb-4 p-4 bg-gradient-to-r from-gray-100 to-gray-100 border border-gray-300/60 rounded-lg text-sm text-gray-700 shadow-sm font-medium leading-relaxed">
                  <strong>Migration Strategy:</strong> {getDomainMappingContext.description}
                  {getDomainMappingContext.isMultiTarget && (
                    <div className="mt-1">• Multiple target domains require admin access to each destination domain</div>
                  )}
                  {getDomainMappingContext.isMultiSource && (
                    <div className="mt-1">• Multiple source domains require admin access to each source domain</div>
                  )}
                  {getDomainMappingContext.isCrossTenant && (
                    <div className="mt-1">• Cross-tenant migrations require separate OAuth setups for each domain</div>
                  )}
                </div>
              )}
              
              <div className="space-y-3">
                {/* Single Domain Option */}
                {(!getDomainMappingContext || !getDomainMappingContext.isCrossTenant) && (
                  <div>
                    <label className="block text-base font-bold text-gray-800 mb-2 flex items-center gap-2">
                      {getDomainMappingContext?.isMultiTarget || getDomainMappingContext?.isMultiSource ? 
                        'Super Admin Email (access to all domains) *' : 
                        'Single Domain Admin Email *'
                      }
                      {inputAdminEmail && isAdminEmailFromCache() && (
                        <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full font-medium">
                          From Cache
                        </span>
                      )}
                    </label>
                    <input
                      type="email"
                      value={inputAdminEmail}
                      onChange={(e) => setInputAdminEmail(e.target.value)}
                      placeholder="admin@yourdomain.com"
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        inputAdminEmail && isAdminEmailFromCache() 
                          ? 'border-green-300 bg-green-50' 
                          : 'border-blue-200'
                      }`}
                      required
                    />
                    <p className="text-sm text-gray-700 mt-2 font-medium leading-relaxed">
                      {getDomainMappingContext?.isMultiTarget || getDomainMappingContext?.isMultiSource ?
                        'Required: Must have super admin access across all domains in the migration' :
                        'Required: For single domain migration scenarios'
                      }
                    </p>
                  </div>
                )}

                {(!getDomainMappingContext || getDomainMappingContext.isCrossTenant) && (
                  <>
                    {!getDomainMappingContext && (
                      <div className="text-center text-sm text-gray-700 font-bold">OR</div>
                    )}
                    
                    {/* Cross-Tenant Options */}
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <label className="block text-base font-bold text-gray-800 mb-2 flex items-center gap-2">
                          Source Domain Admin Email *
                          {inputSourceEmail && isAdminEmailFromCache() && (
                            <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full font-medium">
                              From Cache
                            </span>
                          )}
                        </label>
                        <input
                          type="email"
                          value={inputSourceEmail}
                          onChange={(e) => setInputSourceEmail(e.target.value)}
                          placeholder={getDomainMappingContext?.sourceDomains[0] ? 
                            `admin@${getDomainMappingContext.sourceDomains[0]}` : 
                            'admin@source-domain.com'
                          }
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                            inputSourceEmail && isAdminEmailFromCache() 
                              ? 'border-green-300 bg-green-50' 
                              : 'border-blue-200'
                          }`}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-base font-bold text-gray-800 mb-2 flex items-center gap-2">
                          Destination Domain Admin Email *
                          {inputDestEmail && isAdminEmailFromCache() && (
                            <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full font-medium">
                              From Cache
                            </span>
                          )}
                        </label>
                        <input
                          type="email"
                          value={inputDestEmail}
                          onChange={(e) => setInputDestEmail(e.target.value)}
                          placeholder={getDomainMappingContext?.targetDomains[0] ? 
                            `admin@${getDomainMappingContext.targetDomains[0]}` : 
                            'admin@dest-domain.com'
                          }
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                            inputDestEmail && isAdminEmailFromCache() 
                              ? 'border-green-300 bg-green-50' 
                              : 'border-blue-200'
                          }`}
                          required
                        />
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 font-medium leading-relaxed">
                      {getDomainMappingContext ? 
                        'Both emails are required for cross-tenant migration scenarios' :
                        'Use these for cross-tenant migration scenarios where you need admin access to both source and destination domains'
                      }
                    </p>
                  </>
                )}
              </div>
            </div>
          )}
          
          <div className="flex flex-wrap gap-3 mb-4">
            <button
              onClick={setupDomainWideDelegation}
              disabled={delegationSetupLoading}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 font-semibold transform hover:scale-105"
            >
              {delegationSetupLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Settings className="h-4 w-4" />
              )}
              Generate Setup Instructions
            </button>


          </div>

            {/* Error and Success Messages */}
            {error && (
              <div className="mb-4 p-4 bg-gradient-to-r from-red-50 to-rose-50 border border-red-200/60 rounded-xl shadow-sm">
                <div className="flex items-center gap-2 text-red-800">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <span className="font-semibold">Error:</span>
                  <span className="font-medium">{error}</span>
                </div>
              </div>
            )}

            {successMessage && (
              <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-300/60 rounded-xl shadow-sm">
                <div className="flex items-center gap-2 text-blue-800">
                  <CheckCircle className="h-5 w-5 text-blue-600" />
                  <span className="font-semibold">Success:</span>
                  <span className="font-medium">{successMessage}</span>
                </div>
              </div>
            )}

            {/* Persistent Verification Status */}
            {isCurrentConfigurationVerified() && (() => {
              const cachedInfo = getCachedAdminInfo();
              return (
                <div className="mb-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-300/60 rounded-xl shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-green-800">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="font-semibold">Already Verified:</span>
                      <span className="font-medium">
                        {cachedInfo && (
                          <>
                            {cachedInfo.type === 'single-super-admin' 
                              ? `Admin: ${cachedInfo.adminEmail}` 
                              : `Source: ${cachedInfo.sourceEmail}, Dest: ${cachedInfo.destEmail}`
                            }
                          </>
                        )}
                        {!cachedInfo && 'This configuration has been successfully verified and is cached for 24 hours'}
                      </span>
                    </div>
                    <button
                      onClick={clearCurrentVerificationStatus}
                      className="flex items-center gap-1 px-3 py-1 text-sm text-green-700 hover:text-green-900 hover:bg-green-100 rounded-lg transition-colors duration-200"
                      title="Clear cached verification and re-verify"
                    >
                      <X className="h-4 w-4" />
                      Re-verify
                    </button>
                  </div>
                  <div className="mt-2 text-sm text-green-700 font-medium">
                    {cachedInfo && (
                      <div className="flex items-center gap-4 text-xs mb-1">
                        <span>Verified: {new Date(cachedInfo.timestamp).toLocaleString()}</span>
                        <span>Type: {cachedInfo.type === 'single-super-admin' ? 'Single Super Admin' : 'Cross-Tenant'}</span>
                      </div>
                    )}
                    <div>
                      Skip verification step - you can proceed directly to user discovery.
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Verification Status */}
            {delegationStatus && (
              <div className={`grid gap-4 ${
                delegationSetupData?.migrationScenario === 'single-super-admin' || 
                (!sourceAccount && !destAccount && adminEmail) 
                  ? 'grid-cols-1' 
                  : 'md:grid-cols-2'
              }`}>
                {renderDomainStatus('source', 'Source Domain')}
                {renderDomainStatus('dest', 'Destination Domain')}
              </div>
            )}
          </div>

        {/* Generated Setup Instructions */}
        {delegationSetupData && (
          <div className="mb-6 p-6 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Key className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-amber-900">
                  Generated Setup Instructions
                </h3>
                <p className="text-base text-amber-800 leading-relaxed font-medium">
                  Follow these step-by-step instructions to configure domain-wide delegation
                </p>
              </div>
            </div>

            {/* Step-by-Step Instructions with Embedded Configuration */}
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-bold text-gray-800 mb-3 text-lg flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Step-by-Step Setup Process
              </h4>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">1</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-base break-words">Go to Google Admin Console</p>
                    <p className="text-gray-700 text-sm font-medium mb-2 break-words">
                      Navigate to{' '}
                      {delegationSetupData.setupInstructions?.domain?.adminConsoleUrl ? (
                        <a 
                          href={delegationSetupData.setupInstructions.domain.adminConsoleUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline font-semibold"
                        >
                          your admin console
                        </a>
                      ) : (
                        <a 
                          href="https://admin.google.com" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline font-semibold"
                        >
                          https://admin.google.com
                        </a>
                      )}
                    </p>
                    {delegationSetupData.setupInstructions?.domain?.adminConsoleUrl && (
                      <div className="mt-2 p-2 bg-blue-100 rounded border">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-blue-800">🔗 Direct Link:</span>
                          <button
                            onClick={() => copyToClipboard(delegationSetupData.setupInstructions!.domain!.adminConsoleUrl, 'admin-url')}
                            className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
                          >
                            {copiedItem === 'admin-url' ? (
                              <>
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                Copy URL
                              </>
                            )}
                          </button>
                        </div>
                        <code className="text-xs font-mono text-blue-800 break-all block mt-1">
                          {delegationSetupData.setupInstructions.domain.adminConsoleUrl}
                        </code>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">2</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-base break-words">Navigate to API Controls</p>
                    <p className="text-gray-700 text-sm font-medium break-words">
                      Go to <strong>Security → API Controls → Domain-wide Delegation</strong>
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">3</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-base break-words">Add New Client</p>
                    <p className="text-gray-700 text-sm font-medium break-words">
                      Click <strong>"Add new"</strong> to create a new domain-wide delegation entry
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">4</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-base break-words">Enter Client ID</p>
                    <p className="text-gray-700 text-sm font-medium mb-2 break-words">
                      Copy and paste this <strong>Client ID</strong> into the Client ID field:
                    </p>
                    <div className="p-3 bg-white rounded border-2 border-blue-300">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-gray-800">📋 Client ID:</span>
                        <button
                          onClick={() => copyToClipboard(delegationSetupData.setupInstructions!.domain!.clientId, 'step4-client-id')}
                          className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors font-semibold"
                        >
                          {copiedItem === 'step4-client-id' ? (
                            <>
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4" />
                              Copy
                            </>
                          )}
                        </button>
                      </div>
                      <code className="text-sm font-mono text-gray-800 break-all block bg-gray-50 p-2 rounded">
                        {delegationSetupData.setupInstructions!.domain!.clientId}
                      </code>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">5</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-base break-words">Add OAuth Scopes</p>
                    <p className="text-gray-700 text-sm font-medium mb-2 break-words">
                      Copy and paste these <strong>OAuth Scopes</strong> into the OAuth scopes field:
                    </p>
                    
                    {/* Scope Chunks in Steps */}
                    <div className="space-y-2 mb-3">
                      <div className="p-2 bg-blue-50 rounded border border-blue-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-bold text-blue-800">🎯 All Scopes (Recommended):</span>
                          <button
                            onClick={() => copyToClipboard(delegationSetupData.scopes.join(','), 'step5-all-scopes')}
                            className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors font-semibold"
                          >
                            {copiedItem === 'step5-all-scopes' ? (
                              <>
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="h-4 w-4" />
                                Copy All
                              </>
                            )}
                          </button>
                        </div>
                        <code className="text-xs font-mono text-blue-800 break-all block bg-white p-2 rounded border max-h-20 overflow-y-auto">
                          {delegationSetupData.scopes.join(',')}
                        </code>
                        <p className="text-xs text-blue-700 mt-1 font-medium">
                          💡 Copy this complete list for full migration functionality
                        </p>
                      </div>
                      
                      {/* Individual Chunks for Alternative */}
                      <div className="border border-gray-200 rounded p-2 bg-gray-50">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-semibold text-gray-700">🔀 Alternative: Individual Chunks</span>
                          <span className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs">
                            {(delegationSetupData.scopeChunks || []).length} chunks
                          </span>
                        </div>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {(delegationSetupData.scopeChunks || []).map((chunk, index) => (
                            <div key={index} className="flex items-center justify-between p-1 bg-white rounded text-xs">
                              <span className="font-medium text-gray-600 truncate flex-1">
                                Chunk {index + 1}: {chunk.slice(0, 2).join(', ')}...
                              </span>
                              <button
                                onClick={() => copyToClipboard(chunk.join(','), `step5-chunk-${index}`)}
                                className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors ml-2"
                              >
                                {copiedItem === `step5-chunk-${index}` ? (
                                  <>
                                    ✓
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-3 w-3" />
                                    Copy
                                  </>
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-gray-600 mt-1">
                          Use chunks if your system has scope input limitations
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">6</div>
                  <div>
                    <p className="font-semibold text-blue-900 text-base">Authorize & Verify</p>
                    <p className="text-blue-800 text-sm font-medium">
                      Click <strong>"Authorize"</strong> to save the configuration, then use the <strong>"Verify Configuration"</strong> button above to test your setup
                    </p>
                    <div className="mt-2 p-2 bg-blue-100 rounded border border-blue-200">
                      <div className="flex items-center gap-2 text-blue-800 text-xs">
                        <span className="font-semibold">✅ Next Step:</span>
                        <span>Click "Verify Configuration" button above once you've completed the setup</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Quick Reference Summary */}
            <div className="mb-6">
              <h4 className="font-bold text-amber-900 mb-4 text-lg flex items-center gap-2">
                <Key className="h-5 w-5" />
                Quick Reference Summary
              </h4>
              <p className="text-amber-800 text-sm font-medium mb-4">
                All configuration values are included in the step-by-step instructions above. Use this section for quick reference only:
              </p>
              
            {/* Single Domain Quick Reference */}
            {delegationSetupData.migrationScenario === 'single-super-admin' && delegationSetupData.setupInstructions?.domain && (
              <div className="space-y-3">
                    <div className="p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-gray-800">📋 Client ID Reference</span>
                        <button
                          onClick={() => copyToClipboard(delegationSetupData.setupInstructions!.domain!.clientId, 'ref-client-id')}
                          className="flex items-center gap-1 px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700 transition-colors"
                        >
                          {copiedItem === 'ref-client-id' ? (
                            <>
                              <Check className="h-3 w-3" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              Copy
                            </>
                          )}
                        </button>
                      </div>
                      <code className="text-xs font-mono text-gray-700 break-all block bg-gray-50 p-2 rounded">
                        {delegationSetupData.setupInstructions.domain.clientId}
                      </code>
                    </div>
                  
                  <div className="p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-gray-800">🎯 OAuth Scopes Reference</span>
                      <button
                        onClick={() => copyToClipboard(delegationSetupData.scopes.join(','), 'ref-scopes')}
                        className="flex items-center gap-1 px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700 transition-colors"
                      >
                        {copiedItem === 'ref-scopes' ? (
                          <>
                            <Check className="h-3 w-3" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            Copy All
                          </>
                        )}
                      </button>
                    </div>
                    <code className="text-xs font-mono text-gray-700 break-all block bg-gray-50 p-2 rounded max-h-16 overflow-y-auto">
                      {delegationSetupData.scopes.join(',')}
                    </code>
                    <p className="text-xs text-gray-600 mt-1">
                      📝 {delegationSetupData.scopes.length} total scopes • Use Step 5 above for detailed options
                    </p>
                  </div>

                  <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ExternalLink className="h-4 w-4 text-blue-600" />
                        <span className="font-bold text-blue-900 text-sm">Admin Console Link</span>
                      </div>
                      <a
                        href={delegationSetupData.setupInstructions.domain.adminConsoleUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors font-semibold"
                      >
                        Open Console
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Cross-Tenant Instructions */}
            {delegationSetupData.migrationScenario === 'cross-tenant' && (
              <>
                {/* Source Domain Instructions */}
                {delegationSetupData.setupInstructions?.source && (
                  <div className="mb-6">
                    <h4 className="font-medium text-amber-800 mb-3">
                      {delegationSetupData.setupInstructions.source.title}
                    </h4>
                    <div className="space-y-3">
                      <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-base font-semibold text-gray-800">Client ID</span>
                          <button
                            onClick={() => copyToClipboard(delegationSetupData.setupInstructions!.source!.clientId, 'source-client-id')}
                            className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                          >
                            {copiedItem === 'source-client-id' ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                        <code className="text-sm font-mono text-gray-800 break-all block bg-gray-50 p-3 rounded border">
                          {delegationSetupData.setupInstructions.source.clientId}
                        </code>
                      </div>
                      
                      <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-base font-semibold text-gray-800">OAuth Scopes</span>
                          <button
                            onClick={() => copyToClipboard(delegationSetupData.scopes.join(','), 'source-scopes')}
                            className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                          >
                            {copiedItem === 'source-scopes' ? 'Copied All!' : 'Copy All'}
                          </button>
                        </div>

                        {/* Individual Scope Chunks for Source */}
                        <div className="space-y-2 mb-3">
                          {(delegationSetupData.scopeChunks || []).map((chunk, index) => (
                            <div key={index} className="border border-gray-200 rounded p-2 bg-gray-50">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-semibold text-gray-600">
                                  Chunk {index + 1}/{delegationSetupData.scopeChunks?.length || 0}
                                </span>
                                <button
                                  onClick={() => copyToClipboard(chunk.join(','), `source-chunk-${index}`)}
                                  className="flex items-center gap-1 px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700 transition-colors"
                                >
                                  {copiedItem === `source-chunk-${index}` ? (
                                    <>
                                      <Check className="h-3 w-3" />
                                      Copied!
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="h-3 w-3" />
                                      Copy
                                    </>
                                  )}
                                </button>
                              </div>
                              <code className="text-xs font-mono text-gray-700 break-all block bg-white p-2 rounded">
                                {chunk.join(',')}
                              </code>
                            </div>
                          ))}
                        </div>

                        <code className="text-sm font-mono text-gray-800 break-all block bg-gray-50 p-3 rounded border">
                          {delegationSetupData.scopes.join(',')}
                        </code>
                      </div>

                      <a
                        href={delegationSetupData.setupInstructions.source.adminConsoleUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Open Admin Console
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                )}

                {/* Destination Domain Instructions */}
                {delegationSetupData.setupInstructions?.destination && (
                  <div>
                    <h4 className="font-medium text-amber-800 mb-3">
                      {delegationSetupData.setupInstructions.destination.title}
                    </h4>
                    <div className="space-y-3">
                      <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-base font-semibold text-gray-800">Client ID</span>
                          <button
                            onClick={() => copyToClipboard(delegationSetupData.setupInstructions!.destination!.clientId, 'dest-client-id')}
                            className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                          >
                            {copiedItem === 'dest-client-id' ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                        <code className="text-sm font-mono text-gray-800 break-all block bg-gray-50 p-3 rounded border">
                          {delegationSetupData.setupInstructions.destination.clientId}
                        </code>
                      </div>
                      
                      <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-base font-semibold text-gray-800">OAuth Scopes</span>
                          <button
                            onClick={() => copyToClipboard(delegationSetupData.scopes.join(','), 'dest-scopes')}
                            className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                          >
                            {copiedItem === 'dest-scopes' ? 'Copied All!' : 'Copy All'}
                          </button>
                        </div>

                        {/* Individual Scope Chunks for Destination */}
                        <div className="space-y-2 mb-3">
                          {(delegationSetupData.scopeChunks || []).map((chunk, index) => (
                            <div key={index} className="border border-gray-200 rounded p-2 bg-gray-50">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-semibold text-gray-600">
                                  Chunk {index + 1}/{delegationSetupData.scopeChunks?.length || 0}
                                </span>
                                <button
                                  onClick={() => copyToClipboard(chunk.join(','), `dest-chunk-${index}`)}
                                  className="flex items-center gap-1 px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700 transition-colors"
                                >
                                  {copiedItem === `dest-chunk-${index}` ? (
                                    <>
                                      <Check className="h-3 w-3" />
                                      Copied!
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="h-3 w-3" />
                                      Copy
                                    </>
                                  )}
                                </button>
                              </div>
                              <code className="text-xs font-mono text-gray-700 break-all block bg-white p-2 rounded">
                                {chunk.join(',')}
                              </code>
                            </div>
                          ))}
                        </div>

                        <code className="text-sm font-mono text-gray-800 break-all block bg-gray-50 p-3 rounded border">
                          {delegationSetupData.scopes.join(',')}
                        </code>
                      </div>

                      <a
                        href={delegationSetupData.setupInstructions.destination.adminConsoleUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Open Admin Console
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Domain-Wide Delegation Verification Section */}
        {delegationSetupData && (
          <div className="mb-6 p-6 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-green-900">
                  Verify Domain-Wide Delegation
                </h3>
                <p className="text-base text-green-800 font-medium leading-relaxed">
                  {delegationSetupData.migrationScenario === 'single-super-admin'
                    ? 'Test the domain-wide delegation configuration for your domain.'
                    : 'Test the domain-wide delegation configuration for both source and destination domains.'
                  }
                </p>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-3 mb-4">
              <button
                onClick={verifyDomainWideDelegation}
                disabled={delegationVerifyLoading}
                className={`flex items-center gap-2 px-6 py-3 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md font-medium ${
                  isCurrentConfigurationVerified() 
                    ? 'bg-amber-600 hover:bg-amber-700' 
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {delegationVerifyLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : isCurrentConfigurationVerified() ? (
                  <RefreshCw className="h-4 w-4" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                {isCurrentConfigurationVerified() 
                  ? `Re-verify ${delegationSetupData.migrationScenario === 'single-super-admin' ? 'Domain' : 'Cross-Tenant'} Configuration`
                  : delegationSetupData.migrationScenario === 'single-super-admin'
                    ? 'Verify Domain Configuration'
                    : 'Verify Cross-Tenant Configuration'
                }
              </button>

              {(delegationStatus || isCurrentConfigurationVerified()) && (
                <button
                  onClick={() => {
                    setDelegationStatus(null)
                    if (isCurrentConfigurationVerified()) {
                      clearCurrentVerificationStatus()
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all duration-200 font-medium"
                >
                  <X className="h-4 w-4" />
                  {isCurrentConfigurationVerified() ? 'Clear Cached Verification' : 'Clear Results'}
                </button>
              )}
            </div>

            {/* Verification Results */}
            {delegationStatus && (
              <div className="mt-4">
                <h4 className="font-medium text-green-800 mb-3 flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Verification Results
                </h4>
                <div className={`grid gap-4 ${
                  delegationSetupData.migrationScenario === 'single-super-admin'
                    ? 'grid-cols-1' 
                    : 'md:grid-cols-2'
                }`}>
                  {renderDomainStatus('source', 'Source Domain')}
                  {renderDomainStatus('dest', 'Destination Domain')}
                </div>
              </div>
            )}

            {/* Verification Tips */}
            <div className="mt-4 p-4 bg-white border border-green-200 rounded-lg">
              <h5 className="font-bold text-green-800 mb-3 flex items-center gap-2 text-lg">
                <Info className="h-5 w-5" />
                Verification Tips
              </h5>
              <ul className="text-base text-green-700 space-y-2 leading-relaxed font-medium">
                <li>• Ensure you have completed all setup steps before verification</li>
                <li>• Domain-wide delegation changes may take a few minutes to propagate</li>
                <li>• If verification fails, double-check the Client ID and OAuth scopes</li>
                {delegationSetupData.migrationScenario === 'cross-tenant' && (
                  <li>• Both source and destination domains must be properly configured</li>
                )}
                <li>• Contact your Google Workspace administrator if you encounter persistent issues</li>
              </ul>
            </div>
          </div>
        )}

        {/* Completion */}
        {allStepsCompleted && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-300 rounded-lg">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-blue-600" />
              <div>
                <h4 className="font-bold text-blue-800 text-xl">
                  Domain-wide Delegation Setup Complete!
                </h4>
                <p className="text-blue-700 text-base mt-2 font-medium leading-relaxed">
                  {getDomainMappingContext ? (
                    <>
                      Your <strong>{getDomainMappingContext.type.replace('-', ' ')}</strong> migration configuration is complete.
                      {getDomainMappingContext.isCrossTenant ? 
                        ' Both source and destination domains should now be configured for secure cross-domain migration.' :
                        ` All ${getDomainCount().source === 1 ? 'domain is' : 'domains are'} now configured for secure migration.`
                      }
                      {getDomainMappingContext.complexity === 'Very High' && (
                        <> Consider running a test migration with a small subset of users first.</>
                      )}
                    </>
                  ) : (
                    'Both domains should now be configured for secure cross-domain migration.'
                  )}
                </p>
                
                {/* Remove this button - the first Continue to Migration Setup button */}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
})

DomainWideDelegationSetup.displayName = 'DomainWideDelegationSetup'

export default DomainWideDelegationSetup
