'use client'

import React, { useState, memo, useMemo, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { DomainMappingConfig } from '@/types/migration-scenarios'
import { DomainMapping } from '@/types/config'
import { validateMappings, getSourceDomains, getTargetDomains, isOneToMany, isManyToOne, isOneToOne, getMappingType, getMappingAnalysis } from '@/utils/domainMappingHelpers'
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
  domainMapping?: DomainMapping | DomainMappingConfig | string // Support multiple formats: simple mapping, legacy config, or JSON string
  onComplete?: () => void
  onVerificationStatusChange?: (isVerified: boolean) => void // New callback for verification status
  onAdminEmailChange?: (email: string) => void // For single super admin scenario
  onsourceAdminEmailChange?: (email: string) => void // For cross-tenant source email
  ondestAdminEmailChange?: (email: string) => void // For cross-tenant dest email
  onsourceAdminEmailsChange?: (emails: {[domain: string]: string}) => void // For multiple source domains
  ondestAdminEmailsChange?: (emails: {[domain: string]: string}) => void // For multiple dest domains
  onUserDiscoveryReady?: (data: {
    sourceDomains: string[];
    targetDomains: string[];
    adminEmails: {[domain: string]: string};
    scenario: 'single-super-admin' | 'cross-tenant';
    verificationToken?: string;
    domainMapping: DomainMapping; // Include the processed domain mapping
  }) => void // Callback for when user discovery should be triggered
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

// Required OAuth scopes for complete Google Workspace migration - COMPREHENSIVE LIST
const REQUIRED_SCOPES = [
  // Admin Directory API - Complete organizational management
  'https://www.googleapis.com/auth/admin.directory.orgunit',
  'https://www.googleapis.com/auth/admin.directory.orgunit.readonly',
  'https://www.googleapis.com/auth/admin.directory.group',
  'https://www.googleapis.com/auth/admin.directory.group.readonly',
  'https://www.googleapis.com/auth/admin.directory.group.member',
  'https://www.googleapis.com/auth/admin.directory.group.member.readonly',
  'https://www.googleapis.com/auth/admin.directory.user',
  'https://www.googleapis.com/auth/admin.directory.user.readonly',
  'https://www.googleapis.com/auth/admin.directory.domain',
  'https://www.googleapis.com/auth/admin.directory.domain.readonly',
  'https://www.googleapis.com/auth/admin.directory.customer.readonly',
  'https://www.googleapis.com/auth/admin.directory.resource.calendar',
  'https://www.googleapis.com/auth/admin.directory.resource.calendar.readonly',
  'https://www.googleapis.com/auth/admin.directory.rolemanagement.readonly',
  
  // Admin Reports API - Usage and audit data
  'https://www.googleapis.com/auth/admin.reports.usage.readonly',
  'https://www.googleapis.com/auth/admin.reports.audit.readonly',
  
  // Google Drive API - Complete file and metadata management
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.metadata',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.photos.readonly',
  
  // Gmail API - Complete email management (including legacy mail scope)
  'https://mail.google.com/',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.labels',
  'https://www.googleapis.com/auth/gmail.settings.basic',
  'https://www.googleapis.com/auth/gmail.settings.sharing',
  
  // Calendar API - Calendar and events management
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events.readonly',
  'https://www.googleapis.com/auth/calendar.settings.readonly',
  
  // Groups Migration and Settings
  'https://www.googleapis.com/auth/apps.groups.migration',
  'https://www.googleapis.com/auth/apps.groups.settings',
  
  // Contacts API - Contact management
  'https://www.googleapis.com/auth/contacts',
  'https://www.googleapis.com/auth/contacts.readonly',
  
  // User Info and Profile
  'https://www.googleapis.com/auth/userinfo.email',
  
  // Google Sites (legacy scope)
  'https://sites.google.com/feeds',
  
  // Email Settings (legacy scope)
  'https://apps-apis.google.com/a/feeds/emailsettings/2.0/',
  
  // Google Chat API - Complete chat and messaging
  'https://www.googleapis.com/auth/chat.bot',
  'https://www.googleapis.com/auth/chat.spaces',
  'https://www.googleapis.com/auth/chat.spaces.create',
  'https://www.googleapis.com/auth/chat.spaces.readonly',
  'https://www.googleapis.com/auth/chat.memberships',
  'https://www.googleapis.com/auth/chat.memberships.app',
  'https://www.googleapis.com/auth/chat.memberships.readonly',
  'https://www.googleapis.com/auth/chat.messages',
  'https://www.googleapis.com/auth/chat.messages.create',
  'https://www.googleapis.com/auth/chat.messages.reactions',
  'https://www.googleapis.com/auth/chat.messages.reactions.create',
  'https://www.googleapis.com/auth/chat.messages.reactions.readonly',
  'https://www.googleapis.com/auth/chat.messages.readonly',
  'https://www.googleapis.com/auth/chat.users.readstate',
  'https://www.googleapis.com/auth/chat.users.readstate.readonly',
  'https://www.googleapis.com/auth/chat.admin.spaces.readonly',
  'https://www.googleapis.com/auth/chat.admin.spaces',
  'https://www.googleapis.com/auth/chat.admin.memberships.readonly',
  'https://www.googleapis.com/auth/chat.admin.memberships',
  'https://www.googleapis.com/auth/chat.app.spaces',
  'https://www.googleapis.com/auth/chat.app.spaces.create',
  'https://www.googleapis.com/auth/chat.app.memberships',
  'https://www.googleapis.com/auth/chat.customemojis',
  'https://www.googleapis.com/auth/chat.customemojis.readonly',
  'https://www.googleapis.com/auth/chat.users.spacesettings',
  'https://www.googleapis.com/auth/chat.import',
  
  // Google Photos API - Complete photo library management
  'https://www.googleapis.com/auth/photoslibrary',
  'https://www.googleapis.com/auth/photoslibrary.readonly',
  'https://www.googleapis.com/auth/photoslibrary.sharing',
  'https://www.googleapis.com/auth/photoslibrary.appendonly',
  'https://www.googleapis.com/auth/photoslibrary.readonly.appcreateddata',
  'https://www.googleapis.com/auth/photoslibrary.edit.appcreateddata',
  'https://www.googleapis.com/auth/photospicker.mediaitems.readonly',
  
  // Google Slides API - Presentation management
  'https://www.googleapis.com/auth/presentations.readonly',
  'https://www.googleapis.com/auth/presentations',
  
  // Google Forms API - Forms management
  'https://www.googleapis.com/auth/forms.body.readonly',
  'https://www.googleapis.com/auth/forms.responses.readonly',
  
  // Google Apps Script API - Script management
  'https://www.googleapis.com/auth/script.projects.readonly',
  'https://www.googleapis.com/auth/script.webapp.deploy.readonly',
  
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

// Source account verification interfaces - REMOVED

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
  onsourceAdminEmailChange,
  ondestAdminEmailChange,
  onsourceAdminEmailsChange,
  ondestAdminEmailsChange,
  onUserDiscoveryReady,
  className = '',
  style
}: DomainWideDelegationSetupProps) {
  
  // Convert domain mapping to our standard format
  const standardDomainMapping = useMemo((): DomainMapping => {
    console.log('[DomainWideDelegationSetup] Processing domain mapping:', {
      rawDomainMapping: domainMapping,
      type: typeof domainMapping,
      hasType: typeof domainMapping === 'object' && domainMapping && 'type' in domainMapping,
      stringified: JSON.stringify(domainMapping, null, 2)
    });

    if (!domainMapping) return {};
    
    try {
      // Handle JSON string
      if (typeof domainMapping === 'string') {
        const parsed = JSON.parse(domainMapping);
        console.log('[DomainWideDelegationSetup] Parsed JSON string:', parsed);
        return parsed;
      }
      
      // Handle direct DomainMapping (Record<string, string[]>) - ONLY EXPLICIT MAPPING
      if (typeof domainMapping === 'object' && !('type' in domainMapping)) {
        console.log('[DomainWideDelegationSetup] Using direct domain mapping:', domainMapping);
        return domainMapping as DomainMapping;
      }
      
      // For DomainMappingConfig, don't auto-convert - require explicit mapping
      console.log('[DomainWideDelegationSetup] DomainMappingConfig provided but automatic conversion disabled. Please provide explicit domain mapping.');
      return {};
      
    } catch (error) {
      console.error('[DomainWideDelegationSetup] Error processing domain mapping:', error);
      return {};
    }
  }, [domainMapping]);

  // Validate the standard domain mapping
  const domainMappingValid = useMemo(() => {
    try {
      validateMappings(standardDomainMapping);
      return true;
    } catch (error) {
      console.error('[DomainWideDelegationSetup] Domain mapping validation failed:', error);
      return false;
    }
  }, [standardDomainMapping]);

  console.log('[DomainWideDelegationSetup] Domain mapping processed:', {
    originalType: typeof domainMapping,
    originalHasType: typeof domainMapping === 'object' && domainMapping && 'type' in domainMapping,
    originalDomainMapping: domainMapping,
    standardMapping: standardDomainMapping,
    isValid: domainMappingValid,
    sourceDomains: getSourceDomains(standardDomainMapping),
    targetDomains: getTargetDomains(standardDomainMapping),
    mappingType: getMappingType(standardDomainMapping),
    analysisResult: getMappingAnalysis(standardDomainMapping)
  });

  const router = useRouter()
  const { user } = useAuth() // Get authenticated user
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
  
  // Source account verification state - REMOVED
  
  // Extract admin email from OAuth authentication
  const authenticatedAdminEmail = useMemo(() => {
    return user?.email || ''
  }, [user?.email])
  
  // Determine final admin email (prioritize props, fallback to OAuth)
  const finalAdminEmail = useMemo(() => {
    if (migrationScenario === 'single-super-admin') {
      return adminEmail || authenticatedAdminEmail
    }
    return authenticatedAdminEmail
  }, [adminEmail, authenticatedAdminEmail, migrationScenario])
  
  // Extract domain from admin email
  const adminDomain = useMemo(() => {
    if (!finalAdminEmail) return ''
    return finalAdminEmail.split('@')[1] || ''
  }, [finalAdminEmail])
  
  // Input state for when no admin emails are provided as props
  const [inputsourceAdminEmail, setInputsourceAdminEmail] = useState<string>('')
  const [inputdestAdminEmail, setInputdestAdminEmail] = useState<string>('')
  const [inputAdminEmail, setInputAdminEmail] = useState<string>('')
  const [multiDomainAdminEmails, setMultiDomainAdminEmails] = useState<Record<string, string>>({})

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

  // DISABLED: Load cached admin emails into input state to prevent domain auto-population
  useEffect(() => {
    console.log('[DomainWideDelegationSetup] Auto-loading of cached admin emails disabled to prevent domain auto-population');
    // DISABLED: Only populate input state if no props are provided and inputs are empty
    // This was causing domain fields to auto-populate with test domains from cache
    // Original logic disabled to prevent unwanted domain auto-population
  }, [persistedVerifications, adminEmail, sourceAccount, destAccount, sourceAccounts, destAccounts, inputAdminEmail, inputsourceAdminEmail, inputdestAdminEmail])

  // Load admin email from authentication token for Single Super Admin scenario
  useEffect(() => {
    // Only load from auth token if:
    // 1. Migration scenario is single super admin
    // 2. No admin email is provided as prop
    // 3. No input admin email is set
    // 4. User is authenticated and has an email
    if (migrationScenario === 'single-super-admin' && 
        !adminEmail && 
        !inputAdminEmail && 
        user?.email) {
      console.log('[DomainWideDelegationSetup] Loading admin email from authentication token:', user.email);
      setInputAdminEmail(user.email);
      
      // Also notify parent component of the loaded email
      if (onAdminEmailChange) {
        onAdminEmailChange(user.email);
      }
    }
  }, [migrationScenario, adminEmail, inputAdminEmail, user?.email, onAdminEmailChange])

  // Generate verification key for persistence
  const getVerificationKey = useCallback((adminEmail: string, sourceAdminEmail?: string, destAdminEmail?: string, scenario?: string) => {
    const emails = [adminEmail, sourceAdminEmail, destAdminEmail]
      .filter(email => email && email.trim() !== '') // Filter out empty strings and whitespace
      .sort()
    // Use consistent '-' separator format
    return `${scenario || 'unknown'}-${emails.join('-')}`
  }, [])

  // Check if current configuration is already verified
  const isCurrentConfigurationVerified = useCallback(() => {
    const effectiveAdminEmail = adminEmail || inputAdminEmail || undefined;
    const effectiveSourceAccount = sourceAccount || inputsourceAdminEmail || undefined;
    const effectiveDestAccount = destAccount || inputdestAdminEmail || undefined;
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
    adminEmail, inputAdminEmail, sourceAccount, inputsourceAdminEmail, destAccount, inputdestAdminEmail,
    destAccounts, sourceAccounts, migrationScenario, persistedVerifications, getVerificationKey
  ])

  // Save verification status to localStorage
  const saveVerificationStatus = useCallback((adminEmail: string, sourceAdminEmail?: string, destAdminEmail?: string, scenario?: string, verified: boolean = true) => {
    try {
      const key = getVerificationKey(adminEmail, sourceAdminEmail, destAdminEmail, scenario)
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
        sourceAdminEmail: sourceAdminEmail ? '***@' + sourceAdminEmail.split('@')[1] : undefined,
        destAdminEmail: destAdminEmail ? '***@' + destAdminEmail.split('@')[1] : undefined
      })
    } catch (error) {
      console.error('[DomainWideDelegationSetup] Error saving verification status:', error)
    }
  }, [persistedVerifications, getVerificationKey])

  // Clean up malformed verification keys from localStorage
  const cleanupMalformedKeys = useCallback(() => {
    try {
      const cleanedVerifications: {[key: string]: any} = {}
      let hasChanges = false
      
      Object.entries(persistedVerifications).forEach(([key, value]) => {
        // Check if key is well-formed - handle both old (|) and new (-) formats
        const isOldFormat = key.includes('|');
        const keyParts = isOldFormat ? key.split('|') : key.split('-');
        const [scenario, ...emailParts] = keyParts;
        const validEmailParts = emailParts.filter(part => part && part.trim() !== '' && part.includes('@'));
        
        console.log('[DomainWideDelegationSetup] Checking key validity:', {
          key,
          isOldFormat,
          scenario,
          validEmailParts: validEmailParts.length,
          emailParts
        });
        
        // Only keep keys that have valid structure
        if ((scenario === 'single-super-admin' && validEmailParts.length === 1) ||
            (scenario === 'cross-tenant' && validEmailParts.length === 2)) {
          cleanedVerifications[key] = value
        } else {
          console.log('[DomainWideDelegationSetup] Removing malformed key:', key)
          hasChanges = true
        }
      })
      
      if (hasChanges) {
        setPersistedVerifications(cleanedVerifications)
        localStorage.setItem('gws-verification-status', JSON.stringify(cleanedVerifications))
        console.log('[DomainWideDelegationSetup] Cleaned up malformed verification keys')
      }
    } catch (error) {
      console.error('[DomainWideDelegationSetup] Error cleaning up verification keys:', error)
    }
  }, [persistedVerifications])

  // Run cleanup on component mount
  useEffect(() => {
    cleanupMalformedKeys()
  }, [cleanupMalformedKeys])

  // Clear verification status for current configuration
  const clearCurrentVerificationStatus = useCallback(() => {
    const effectiveAdminEmail = adminEmail || inputAdminEmail || undefined;
    const effectiveSourceAccount = sourceAccount || inputsourceAdminEmail || undefined;
    const effectiveDestAccount = destAccount || inputdestAdminEmail || undefined;
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
    adminEmail, inputAdminEmail, sourceAccount, inputsourceAdminEmail, destAccount, inputdestAdminEmail,
    destAccounts, sourceAccounts, migrationScenario, persistedVerifications, getVerificationKey
  ])

  // Source account verification functions - REMOVED

  // Load cached verification status when source account email is available - REMOVED

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
    const effectiveSourceAccount = sourceAccount || inputsourceAdminEmail || undefined;
    const effectiveDestAccount = destAccount || inputdestAdminEmail || undefined;
    const hasMultipleDestAccounts = Object.keys(destAccounts || {}).length > 0;
    const hasMultipleSourceAccounts = Object.keys(sourceAccounts || {}).length > 0;
    
    // Determine migration scenario
    const isSingleSuperAdmin = migrationScenario === 'single-super-admin' || 
                              (effectiveAdminEmail && !effectiveSourceAccount && !effectiveDestAccount && !hasMultipleDestAccounts && !hasMultipleSourceAccounts);
    
    if (isSingleSuperAdmin) {
      // For single super admin, we now require both source and dest verification (same domain, same admin)
      return delegationStatus.source.verified && delegationStatus.dest.verified
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
    inputsourceAdminEmail,
    destAccount,
    inputdestAdminEmail,
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
    // Handle both old format "scenario|email1|email2" and new format "scenario-email1-email2"
    const isOldFormat = mostRecentKey.includes('|');
    const keyParts = isOldFormat ? mostRecentKey.split('|') : mostRecentKey.split('-');
    const [scenario, ...emailParts] = keyParts;
    
    // Filter out empty email parts that might have been created by malformed keys
    const validEmailParts = emailParts.filter(part => part && part.trim() !== '' && part.includes('@'));
    
    console.log('[DomainWideDelegationSetup] Parsing verification key:', {
      key: mostRecentKey,
      isOldFormat,
      scenario,
      emailParts,
      validEmailParts
    });
    
    if (scenario === 'single-super-admin' && validEmailParts.length > 0) {
      const adminInfo = {
        type: 'single-super-admin' as const,
        adminEmail: validEmailParts[0],
        scenario: verification.migrationScenario,
        timestamp: verification.timestamp
      };
      console.log('[DomainWideDelegationSetup] Extracted single super admin info:', adminInfo);
      return adminInfo;
    } else if (scenario === 'cross-tenant' && validEmailParts.length >= 2) {
      // For cross-tenant, we have source and dest emails (sorted)
      const adminInfo = {
        type: 'cross-tenant' as const,
        sourceAdminEmail: validEmailParts[0],
        destAdminEmail: validEmailParts[1],
        scenario: verification.migrationScenario,
        timestamp: verification.timestamp
      };
      console.log('[DomainWideDelegationSetup] Extracted cross-tenant info:', adminInfo);
      return adminInfo;
    }

    console.log('[DomainWideDelegationSetup] Could not parse verification key:', mostRecentKey, 'valid email parts:', validEmailParts);
    return null;
  }, [persistedVerifications])

  // Get effective admin info for display (either from props, input state, auth token, or cache)
  const getEffectiveAdminInfo = useCallback(() => {
    // For Single Super Admin scenario, prioritize auth token if no props are provided
    if (migrationScenario === 'single-super-admin') {
      const effectiveAdminEmail = adminEmail || inputAdminEmail || (user?.email && !adminEmail ? user.email : undefined);
      
      if (effectiveAdminEmail) {
        return {
          hasPropsData: !!adminEmail,
          hasInputData: !!inputAdminEmail,
          hasAuthData: !adminEmail && !inputAdminEmail && !!user?.email,
          adminEmail: effectiveAdminEmail,
          sourceAccount: undefined,
          destAccount: undefined,
          sourceAccounts: {},
          destAccounts: {}
        };
      }
    }

    // For Cross-Tenant scenario, handle as before
    if (migrationScenario === 'cross-tenant') {
      // First check if we have admin emails from props
      if (sourceAccount || destAccount || Object.keys(sourceAccounts || {}).length > 0 || Object.keys(destAccounts || {}).length > 0) {
        return {
          hasPropsData: true,
          adminEmail: undefined,
          sourceAccount,
          destAccount,
          sourceAccounts,
          destAccounts
        };
      }

      // Check if we have admin emails from input state
      if (inputsourceAdminEmail || inputdestAdminEmail) {
        return {
          hasPropsData: false,
          hasInputData: true,
          adminEmail: undefined,
          sourceAccount: inputsourceAdminEmail,
          destAccount: inputdestAdminEmail,
          sourceAccounts: {},
          destAccounts: {}
        };
      }
    }

    // Check if we have cached admin info
    const cachedInfo = getCachedAdminInfo();
    if (cachedInfo) {
      return {
        hasPropsData: false,
        hasInputData: false,
        cachedInfo,
        adminEmail: cachedInfo.type === 'single-super-admin' ? cachedInfo.adminEmail : undefined,
        sourceAccount: cachedInfo.type === 'cross-tenant' ? cachedInfo.sourceAdminEmail : undefined,
        destAccount: cachedInfo.type === 'cross-tenant' ? cachedInfo.destAdminEmail : undefined,
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
  }, [adminEmail, sourceAccount, destAccount, sourceAccounts, destAccounts, inputAdminEmail, inputsourceAdminEmail, inputdestAdminEmail, getCachedAdminInfo])

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
        inputMatchesCache = inputsourceAdminEmail === cachedInfo.sourceAdminEmail && inputdestAdminEmail === cachedInfo.destAdminEmail;
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
        source: inputsourceAdminEmail,
        dest: inputdestAdminEmail
      }
    });
    return fromCache;
  }, [getCachedAdminInfo, inputAdminEmail, inputsourceAdminEmail, inputdestAdminEmail])

  // Helper function to check if we have ANY cached verification data (for showing banner)
  const hasCachedVerification = useCallback(() => {
    const cachedInfo = getCachedAdminInfo();
    return cachedInfo !== null && cachedInfo !== undefined;
  }, [getCachedAdminInfo])

  // Domain mapping context helpers
  const getDomainMappingContext = useMemo(() => {
    console.log('[getDomainMappingContext] Starting analysis with:', {
      standardDomainMapping,
      isEmpty: Object.keys(standardDomainMapping).length === 0,
      entries: Object.entries(standardDomainMapping),
      migrationScenario
    });

    // DISABLED: No explicit domain mapping provided - manual mapping required
    if (Object.keys(standardDomainMapping).length === 0) {
      console.log('[getDomainMappingContext] No explicit domain mapping provided - manual domain mapping required');
      
      // DISABLED: Automatic domain derivation from admin emails
      // This requires users to explicitly configure domain mappings instead of auto-generating them
      return null;
    }

    const sourceDomains = getSourceDomains(standardDomainMapping);
    const targetDomains = getTargetDomains(standardDomainMapping);
    
    // Use the improved helper functions for accurate detection
    const isMultiTarget = isOneToMany(standardDomainMapping);
    const isMultiSource = isManyToOne(standardDomainMapping);
    const isCrossTenant = migrationScenario === 'cross-tenant';
    
    // Debug logging
    console.log('[DomainMappingContext] Domain analysis:', {
      standardDomainMapping,
      sourceDomains,
      targetDomains,
      sourceCount: sourceDomains.length,
      targetCount: targetDomains.length,
      isOneToOne: isOneToOne(standardDomainMapping),
      isOneToMany: isOneToMany(standardDomainMapping),
      isManyToOne: isManyToOne(standardDomainMapping),
      mappingType: getMappingType(standardDomainMapping),
      isMultiSource,
      isMultiTarget,
      isCrossTenant,
      // Enhanced debug info
      actualTargetDomains: targetDomains,
      actualSourceDomains: sourceDomains,
      rawMappingEntries: Object.entries(standardDomainMapping)
    });
    
    // Calculate complexity level
    const getComplexityLevel = () => {
      if (isCrossTenant && (isMultiTarget || isMultiSource)) return 'Very High'
      if (isCrossTenant) return 'High'
      if (isMultiTarget || isMultiSource) return 'Medium'
      return 'Low'
    }
    
    // Determine type based on structure using helper functions
    let type: string = getMappingType(standardDomainMapping);
    
    if (isCrossTenant) {
      type = `cross-tenant-${type}`;
    }
    
    // Generate detailed description with domain lists for complex mappings
    const generateDescription = () => {
      const mappingType = getMappingType(standardDomainMapping);
      
      // Log for debugging
      console.log('[DomainMappingContext] Generating description:', {
        sourceDomains,
        targetDomains,
        mappingType,
        sourceCount: sourceDomains.length,
        targetCount: targetDomains.length,
        standardDomainMapping,
        detailedMapping: Object.entries(standardDomainMapping).map(([source, targets]) => ({
          source,
          targets,
          targetCount: targets.length
        }))
      });

      if (mappingType === 'many-to-one') {
        // Many-to-one: List all source domains → single target
        return `Many-to-One Migration: Multiple sources consolidating to single target`;
      } else if (mappingType === 'one-to-many') {
        // One-to-many: Single source → List all target domains
        return `One-to-Many Migration: Single source splitting to multiple targets`;
      } else if (mappingType === 'one-to-one') {
        // True one-to-one: Single source → Single target
        return `One-to-One Migration: Direct domain-to-domain transfer`;
      } else if (mappingType === 'unsupported') {
        // Unsupported mapping pattern
        return `Unsupported Migration Pattern: Complex mapping not supported`;
      } else if (mappingType === 'empty') {
        return `No Domain Mapping: Please configure domain mapping first`;
      } else {
        // Fallback - shouldn't happen but just in case
        return `Migration Setup: ${sourceDomains.length} source(s) → ${targetDomains.length} target(s)`;
      }
    };

    return {
      type,
      description: generateDescription(),
      sourceDomains,
      targetDomains,
      multiTargetConfig: [], // Not used in simple format
      isMultiTarget,
      isMultiSource,
      isCrossTenant,
      complexity: getComplexityLevel()
    }
  }, [standardDomainMapping, migrationScenario])

  // Helper function to get display text for migration scenario
  const getMigrationScenarioDisplayText = useCallback(() => {
    if (migrationScenario === 'single-super-admin') {
      return 'single super admin';
    } else if (migrationScenario === 'cross-tenant') {
      return 'cross-tenant';
    } else if (getDomainMappingContext?.type) {
      // Fallback to domain mapping type if scenario not specified
      return getDomainMappingContext.type.replace('-', ' ');
    }
    return 'migration';
  }, [migrationScenario, getDomainMappingContext?.type]);

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
        hasInputsourceAdminEmail: !!inputsourceAdminEmail,
        isPersistentVerification: isPersistent,
        verificationSource: isPersistent ? 'persistent' : 'current-session'
      })
      onVerificationStatusChange(verificationStatus)
      
      // DISABLED: Auto-sync cached admin emails to prevent domain auto-population
      // if (verificationStatus && isPersistent) {
      //   const cachedInfo = getCachedAdminInfo()
      //   if (cachedInfo) {
      //     console.log('[DomainWideDelegationSetup] Would sync cached admin emails, but auto-sync disabled to prevent domain auto-population:', cachedInfo)
      //     
      //     if (cachedInfo.type === 'single-super-admin' && cachedInfo.adminEmail) {
      //       if (onAdminEmailChange) {
      //         onAdminEmailChange(cachedInfo.adminEmail)
      //       }
      //     } else if (cachedInfo.type === 'cross-tenant') {
      //       if (cachedInfo.sourceAdminEmail && onsourceAdminEmailChange) {
      //         onsourceAdminEmailChange(cachedInfo.sourceAdminEmail)
      //       }
      //       if (cachedInfo.destAdminEmail && ondestAdminEmailChange) {
      //         ondestAdminEmailChange(cachedInfo.destAdminEmail)
      //       }
      //     }
      //   }
      // }
    }
  }, [isVerificationSuccessful, onVerificationStatusChange, isCurrentConfigurationVerified, getCachedAdminInfo, onAdminEmailChange, onsourceAdminEmailChange, ondestAdminEmailChange])

  // Trigger user discovery when domain mapping and verification are ready
  const triggerUserDiscovery = useCallback(() => {
    if (!onUserDiscoveryReady || !migrationScenario || !domainMappingValid) {
      console.log('[DomainWideDelegationSetup] User discovery not ready:', {
        hasCallback: !!onUserDiscoveryReady,
        hasMigrationScenario: !!migrationScenario,
        domainMappingValid,
        standardMapping: standardDomainMapping
      });
      return;
    }

    const sourceDomains = getSourceDomains(standardDomainMapping);
    const targetDomains = getTargetDomains(standardDomainMapping);
    const adminEmails: {[domain: string]: string} = {};

    // Build admin emails based on migration scenario
    if (migrationScenario === 'single-super-admin') {
      const effectiveAdminEmail = adminEmail || inputAdminEmail || user?.email;
      if (effectiveAdminEmail) {
        sourceDomains.forEach(domain => {
          adminEmails[domain] = effectiveAdminEmail;
        });
      }
    } else if (migrationScenario === 'cross-tenant') {
      if (sourceAccount || inputsourceAdminEmail) {
        const sourceEmail = sourceAccount || inputsourceAdminEmail;
        const sourceDomain = sourceEmail.split('@')[1];
        if (sourceDomains.includes(sourceDomain)) {
          adminEmails[sourceDomain] = sourceEmail;
        }
      }
      
      if (destAccount || inputdestAdminEmail) {
        const destEmail = destAccount || inputdestAdminEmail;
        const destDomain = destEmail.split('@')[1];
        if (targetDomains.includes(destDomain)) {
          adminEmails[destDomain] = destEmail;
        }
      }
    }

    // Add multi-domain admin emails
    Object.entries(multiDomainAdminEmails).forEach(([domain, email]) => {
      if (email && (sourceDomains.includes(domain) || targetDomains.includes(domain))) {
        adminEmails[domain] = email;
      }
    });

    console.log('[DomainWideDelegationSetup] Triggering user discovery:', {
      sourceDomains,
      targetDomains,
      adminEmails: Object.keys(adminEmails),
      domainMapping: standardDomainMapping,
      scenario: migrationScenario
    });

    onUserDiscoveryReady({
      sourceDomains,
      targetDomains,
      adminEmails,
      scenario: migrationScenario,
      domainMapping: standardDomainMapping
    });
  }, [
    onUserDiscoveryReady,
    migrationScenario,
    domainMappingValid,
    standardDomainMapping,
    adminEmail,
    inputAdminEmail,
    user?.email,
    sourceAccount,
    inputsourceAdminEmail,
    destAccount,
    inputdestAdminEmail,
    multiDomainAdminEmails
  ]);

  // Call onComplete when verification is successful
  useEffect(() => {
    const isVerified = isVerificationSuccessful()
    if (onComplete && isVerified) {
      console.log('[DomainWideDelegationSetup] Calling onComplete - verification successful')
      onComplete()
      
      // Also trigger user discovery when verification is complete
      if (domainMappingValid) {
        triggerUserDiscovery();
      }
    }
  }, [isVerificationSuccessful, onComplete, domainMappingValid, triggerUserDiscovery])

  // DISABLED: Notify parent component when admin emails change to prevent domain auto-population
  useEffect(() => {
    console.log('[DomainWideDelegationSetup] Auto-sync of input admin email disabled to prevent domain auto-population');
    // DISABLED: Auto-sync input admin email to parent
    // if (onAdminEmailChange) {
    //   onAdminEmailChange(inputAdminEmail || '')
    // }
  }, [inputAdminEmail, onAdminEmailChange])

  useEffect(() => {
    console.log('[DomainWideDelegationSetup] Auto-sync of input source email disabled to prevent domain auto-population');
    // DISABLED: Auto-sync input source email to parent
    // if (onsourceAdminEmailChange) {
    //   onsourceAdminEmailChange(inputsourceAdminEmail || '')
    // }
  }, [inputsourceAdminEmail, onsourceAdminEmailChange])

  useEffect(() => {
    console.log('[DomainWideDelegationSetup] Auto-sync of input dest email disabled to prevent domain auto-population');
    // DISABLED: Auto-sync input dest email to parent
    // if (ondestAdminEmailChange) {
    //   ondestAdminEmailChange(inputdestAdminEmail || '')
    // }
  }, [inputdestAdminEmail, ondestAdminEmailChange])

  // DISABLED: Initial sync of admin emails when component mounts or props change to prevent domain auto-population
  useEffect(() => {
    console.log('[DomainWideDelegationSetup] Auto-sync of prop admin email disabled to prevent domain auto-population');
    // DISABLED: Auto-sync prop admin email to parent
    // if (onAdminEmailChange) {
    //   onAdminEmailChange(adminEmail || '')
    // }
  }, [adminEmail, onAdminEmailChange])

  useEffect(() => {
    console.log('[DomainWideDelegationSetup] Auto-sync of prop source account disabled to prevent domain auto-population');
    // DISABLED: Auto-sync prop source account to parent
    // if (onsourceAdminEmailChange) {
    //   onsourceAdminEmailChange(sourceAccount || '')
    // }
  }, [sourceAccount, onsourceAdminEmailChange])

  useEffect(() => {
    console.log('[DomainWideDelegationSetup] Auto-sync of prop dest account disabled to prevent domain auto-population');
    // DISABLED: Auto-sync prop dest account to parent
    // if (ondestAdminEmailChange) {
    //   ondestAdminEmailChange(destAccount || '')
    // }
  }, [destAccount, ondestAdminEmailChange])

  useEffect(() => {
    console.log('[DomainWideDelegationSetup] Auto-sync of prop source accounts disabled to prevent domain auto-population');
    // DISABLED: Auto-sync prop source accounts to parent
    // if (onsourceAdminEmailsChange) {
    //   onsourceAdminEmailsChange(sourceAccounts || {})
    // }
  }, [sourceAccounts, onsourceAdminEmailsChange])

  useEffect(() => {
    console.log('[DomainWideDelegationSetup] Auto-sync of prop dest accounts disabled to prevent domain auto-population');
    // DISABLED: Auto-sync prop dest accounts to parent
    // if (ondestAdminEmailsChange) {
    //   ondestAdminEmailsChange(destAccounts || {})
    // }
  }, [destAccounts, ondestAdminEmailsChange])

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
          
          // DISABLED: Auto-sync cached admin emails to prevent domain auto-population
          // Also sync cached admin emails to parent if we have them
          // const cachedInfo = getCachedAdminInfo()
          // if (cachedInfo) {
          //   console.log('[DomainWideDelegationSetup] Auto-sync disabled - cached admin emails available but not syncing:', cachedInfo)
          //   
          //   if (cachedInfo.type === 'single-super-admin' && cachedInfo.adminEmail) {
          //     if (onAdminEmailChange) {
          //       onAdminEmailChange(cachedInfo.adminEmail)
          //     }
          //   } else if (cachedInfo.type === 'cross-tenant') {
          //     if (cachedInfo.sourceAdminEmail && onsourceAdminEmailChange) {
          //       onsourceAdminEmailChange(cachedInfo.sourceAdminEmail)
          //     }
          //     if (cachedInfo.destAdminEmail && ondestAdminEmailChange) {
          //       ondestAdminEmailChange(cachedInfo.destAdminEmail)
          //     }
          //   }
          // }
        } else {
          // DISABLED: Auto-sync cached admin emails to prevent domain auto-population
          // Even if not verified from cache, sync any cached admin emails for display
          // const cachedInfo = getCachedAdminInfo()
          // if (cachedInfo) {
          //   console.log('[DomainWideDelegationSetup] Auto-sync disabled - cached admin emails available but not syncing for display:', cachedInfo)
          //   
          //   if (cachedInfo.type === 'single-super-admin' && cachedInfo.adminEmail) {
          //     if (onAdminEmailChange) {
          //       onAdminEmailChange(cachedInfo.adminEmail)
          //     }
          //   } else if (cachedInfo.type === 'cross-tenant') {
          //     if (cachedInfo.sourceAdminEmail && onsourceAdminEmailChange) {
          //       onsourceAdminEmailChange(cachedInfo.sourceAdminEmail)
          //     }
          //     if (cachedInfo.destAdminEmail && ondestAdminEmailChange) {
          //       ondestAdminEmailChange(cachedInfo.destAdminEmail)
          //     }
          //   }
          // }
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
    
    // DISABLED: Auto-sync cached admin emails to prevent domain auto-population
    // Sync cached admin emails
    // const cachedInfo = getCachedAdminInfo()
    // if (cachedInfo) {
    //   console.log('[DomainWideDelegationSetup] Auto-sync disabled - cached admin emails available after verification change:', cachedInfo)
    //   
    //   if (cachedInfo.type === 'single-super-admin' && cachedInfo.adminEmail) {
    //     console.log('[DomainWideDelegationSetup] Would call onAdminEmailChange with cached admin email:', cachedInfo.adminEmail)
    //     if (onAdminEmailChange) {
    //       onAdminEmailChange(cachedInfo.adminEmail)
    //     }
    //   } else if (cachedInfo.type === 'cross-tenant') {
    //     if (cachedInfo.sourceAdminEmail && onsourceAdminEmailChange) {
    //       console.log('[DomainWideDelegationSetup] Would call onsourceAdminEmailChange with cached source email:', cachedInfo.sourceAdminEmail)
    //       onsourceAdminEmailChange(cachedInfo.sourceAdminEmail)
    //     }
    //     if (cachedInfo.destAdminEmail && ondestAdminEmailChange) {
    //       console.log('[DomainWideDelegationSetup] Would call ondestAdminEmailChange with cached dest email:', cachedInfo.destAdminEmail)
    //       ondestAdminEmailChange(cachedInfo.destAdminEmail)
    //     }
    //   }
    // } else {
    //   console.log('[DomainWideDelegationSetup] No cached admin info found when persistent verifications changed')
    // }
  }, [persistedVerifications, onVerificationStatusChange, isCurrentConfigurationVerified, getCachedAdminInfo, onAdminEmailChange, onsourceAdminEmailChange, ondestAdminEmailChange])

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
    const effectiveSourceAccount = sourceAccount || inputsourceAdminEmail || undefined;
    const effectiveDestAccount = destAccount || inputdestAdminEmail || undefined;
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
        const invalidsourceAdminEmails = Object.entries(sourceAccounts || {}).filter(([domain, email]) => 
          email && email.trim() !== '' && !emailRegex.test(email.trim())
        );
        if (invalidsourceAdminEmails.length > 0) {
          const invalidDomains = invalidsourceAdminEmails.map(([domain]) => domain).join(', ');
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
        const invaliddestAdminEmails = Object.entries(destAccounts || {}).filter(([domain, email]) => 
          email && email.trim() !== '' && !emailRegex.test(email.trim())
        );
        if (invaliddestAdminEmails.length > 0) {
          const invalidDomains = invaliddestAdminEmails.map(([domain]) => domain).join(', ');
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
      inputsourceAdminEmail,
      destAccount,
      inputdestAdminEmail,
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
          const firstsourceAdminEmail = sourceAccounts[firstSourceDomain]
          requestPayload.sourceAdminEmail = firstsourceAdminEmail?.trim() || ''
          requestPayload.sourceAccounts = sourceAccounts
        }
        
        // Handle single destination or multiple destinations
        if (effectiveDestAccount) {
          requestPayload.destAdminEmail = effectiveDestAccount.trim()
        } else if (hasMultipleDestAccounts) {
          // For multiple destinations, we'll use the first one for the API call
          // In a real scenario, you might want to handle this differently
          const firstDestDomain = Object.keys(destAccounts)[0]
          const firstdestAdminEmail = destAccounts[firstDestDomain]
          requestPayload.destAdminEmail = firstdestAdminEmail?.trim() || ''
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
    const effectiveSourceAccount = sourceAccount || inputsourceAdminEmail || undefined;
    const effectiveDestAccount = destAccount || inputdestAdminEmail || undefined;
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
      // Proceed with domain-wide delegation verification using input values
      console.log('[Delegation Verify] Starting delegation verification directly with input values:', {
        effectiveAdminEmail,
        effectiveSourceAccount,
        effectiveDestAccount,
        isSingleSuperAdmin,
        isCrossTenant
      })
      let requestPayload: any
      let apiUrl: string

      if (isSingleSuperAdmin) {
        requestPayload = {
          adminEmail: effectiveAdminEmail,
          migrationScenario: 'single-super-admin'
        }
        apiUrl = `${API_BASE_URL}/api/v1/delegation/verify`
      } else {
        // Cross-tenant scenario - use the same verification endpoint as single super admin
        console.log('[Delegation Verify] Using same verification endpoint as single super admin for cross-tenant')
        
        requestPayload = {
          migrationScenario: 'cross-tenant'
        }
        
        // Add source account details
        if (effectiveSourceAccount) {
          requestPayload.sourceAdminEmail = effectiveSourceAccount.trim()
        } else if (hasMultipleSourceAccounts) {
          // For multiple sources, use the first one for verification
          const firstSourceDomain = Object.keys(sourceAccounts)[0]
          const firstSourceAdminEmail = sourceAccounts[firstSourceDomain]
          requestPayload.sourceAdminEmail = firstSourceAdminEmail?.trim() || ''
          requestPayload.sourceAccounts = sourceAccounts
        }
        
        // Add destination account details
        if (effectiveDestAccount) {
          requestPayload.destAdminEmail = effectiveDestAccount.trim()
        } else if (hasMultipleDestAccounts) {
          // For multiple destinations, use the first one for verification
          const firstDestDomain = Object.keys(destAccounts)[0]
          const firstDestAdminEmail = destAccounts[firstDestDomain]
          requestPayload.destAdminEmail = firstDestAdminEmail?.trim() || ''
          requestPayload.destAccounts = destAccounts
        }
        
        apiUrl = `${API_BASE_URL}/api/v1/delegation/verify`
      }
      
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

      if (data.success && (data.verification || data.message)) {
        if (isSingleSuperAdmin) {
          // Handle single super admin verification - set both source and dest with same admin email
          const domainVerified = data.verification.domain?.verified || false
          setDelegationStatus({
            source: {
              configured: data.verification.domain?.testResults?.length > 0 || false,
              verified: domainVerified,
              error: data.verification.domain?.testResults?.[0]?.error
            },
            dest: {
              configured: data.verification.domain?.testResults?.length > 0 || false,
              verified: domainVerified,
              error: data.verification.domain?.testResults?.[0]?.error
            }
          })
          
          // Save verification status for single super admin if successful
          if (domainVerified && effectiveAdminEmail) {
            saveVerificationStatus(effectiveAdminEmail, undefined, undefined, 'single-super-admin', true)
          }
        } else {
          // Handle cross-tenant verification - same structure as single super admin
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
        
        // Set delegation status to failed for both scenarios
        setDelegationStatus({
          source: { configured: false, verified: false, error: errorMessage },
          dest: { configured: false, verified: false, error: errorMessage }
        })
        setError(errorMessage)
      }
    } catch (error) {
      console.error('[Delegation Verify] Error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Verification failed'
      
      // Set delegation status to failed for both scenarios
      setDelegationStatus({
        source: { configured: false, verified: false, error: errorMessage },
        dest: { configured: false, verified: false, error: errorMessage }
      })
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
    const effectiveSourceAccount = sourceAccount || inputsourceAdminEmail || undefined;
    const effectiveDestAccount = destAccount || inputdestAdminEmail || undefined;
    const hasMultipleDestAccounts = Object.keys(destAccounts || {}).length > 0;
    const hasMultipleSourceAccounts = Object.keys(sourceAccounts || {}).length > 0;

    // For single super admin, show both source and dest status similar to cross-tenant
    const isSingleSuperAdmin = delegationSetupData?.migrationScenario === 'single-super-admin' || 
                              (effectiveAdminEmail && !effectiveSourceAccount && !effectiveDestAccount && !hasMultipleDestAccounts && !hasMultipleSourceAccounts);

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
            {isSingleSuperAdmin && domain === 'source' ? 'Source Domain (Super Admin)' : 
             isSingleSuperAdmin && domain === 'dest' ? 'Target Domain (Same Admin)' : label}
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
                          <h4 className="font-semibold text-gray-900 mb-2">🗺️ Your Migration Scenario:</h4>
                          <div className="text-gray-600 space-y-3">
                            <div className="font-medium text-lg text-gray-800">{getDomainMappingContext.description}</div>
                            
                            {/* Debug logging for domain display */}
                            {(() => {
                              console.log('[DomainWideDelegationSetup] Rendering domain mapping:', {
                                sourceDomains: getDomainMappingContext.sourceDomains,
                                targetDomains: getDomainMappingContext.targetDomains,
                                description: getDomainMappingContext.description,
                                type: getDomainMappingContext.type,
                                complexity: getDomainMappingContext.complexity
                              });
                              return null;
                            })()}
                            
                            {/* Enhanced domain mapping visualization */}
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
                              <div className="text-sm font-semibold text-gray-700 mb-2">📋 Domain Mapping Details:</div>
                              
                              {/* Source Domains */}
                              <div className="flex items-start space-x-2">
                                <span className="text-xs font-medium text-blue-700 min-w-[60px]">Source{getDomainMappingContext.sourceDomains.length > 1 ? 's' : ''}:</span>
                                <div className="flex flex-wrap gap-1">
                                  {getDomainMappingContext.sourceDomains.map((domain, index) => (
                                    <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                                      {domain}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              
                              {/* Arrow separator */}
                              <div className="flex justify-center">
                                <span className="text-gray-400 font-bold text-lg">↓</span>
                              </div>
                              
                              {/* Target Domains */}
                              <div className="flex items-start space-x-2">
                                <span className="text-xs font-medium text-green-700 min-w-[60px]">Target{getDomainMappingContext.targetDomains.length > 1 ? 's' : ''}:</span>
                                <div className="flex flex-wrap gap-1">
                                  {getDomainMappingContext.targetDomains.map((domain, index) => (
                                    <span key={index} className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                                      {domain}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                            
                            {/* Complexity and stats */}
                            <div className="text-sm text-slate-600 font-medium bg-slate-50 px-3 py-2 rounded">
                              <span className="text-purple-700">Complexity: {getDomainMappingContext.complexity}</span> | 
                              <span className="text-blue-700 ml-1">Sources: {getDomainCount().source}</span> | 
                              <span className="text-green-700 ml-1">Targets: {getDomainCount().target}</span>
                            </div>
                            
                            {getDomainMappingContext.isCrossTenant && (
                              <div className="text-orange-700 text-sm font-medium bg-orange-50 border border-orange-200 rounded p-2">
                                ⚠️ Cross-tenant migration requires separate domain setups
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2"> 🔧 Setup Requirements:</h4>
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
                  <p className="text-gray-700 text-sm mb-3">{getDomainMappingContext.description}</p>
                  
                  {/* Source and Target Domain Lists */}
                  <div className="space-y-3 text-sm">
                    {/* Source Domains */}
                    <div>
                      <span className="text-gray-700 font-semibold block mb-1">
                        Source Domain{getDomainMappingContext.sourceDomains.length > 1 ? 's' : ''} ({getDomainMappingContext.sourceDomains.length}):
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {getDomainMappingContext.sourceDomains.map((domain, index) => (
                          <span 
                            key={index}
                            className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-md font-medium border border-blue-200"
                          >
                            {domain}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    {/* Target Domains */}
                    <div>
                      <span className="text-gray-700 font-semibold block mb-1">
                        Target Domain{getDomainMappingContext.targetDomains.length > 1 ? 's' : ''} ({getDomainMappingContext.targetDomains.length}):
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {getDomainMappingContext.targetDomains.map((domain, index) => (
                          <span 
                            key={index}
                            className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs rounded-md font-medium border border-green-200"
                          >
                            {domain}
                          </span>
                        ))}
                      </div>
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
                {/* Single Super Admin scenario - only show when single super admin */}
                {migrationScenario === 'single-super-admin' && effectiveAdminInfo.adminEmail && (
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
                      Single super admin migration scenario - full domain access
                    </div>
                  </div>
                )}

                {/* Cross-tenant scenario - only show when cross-tenant */}
                {migrationScenario === 'cross-tenant' && (
                  <>
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
                  </>
                )}
              </div>
            </div>
          );
        })()}

        {/* Source Account Verification Section - REMOVED */}

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
                    Configure domain-wide delegation for your <strong>{getMigrationScenarioDisplayText()}</strong> migration.
                    {getDomainMappingContext.isCrossTenant ? 
                      ' Automated setup will generate service accounts and instructions for both domains.' :
                      ' Automated setup will generate service account and instructions for your domain.'
                    }
                    {getDomainMappingContext.complexity === 'Very High' && (
                      <> This complex migration requires careful configuration.</>
                    )}
                  </>
                ) : (
                  <>
                    Configure domain-wide delegation for your Google Workspace migration.
                    <span className="text-orange-600 font-semibold"> Manual domain mapping required</span> - 
                    please configure your domain mappings first before proceeding with delegation setup.
                  </>
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
                      setInputsourceAdminEmail('')
                      setInputdestAdminEmail('')
                      
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
                    For your <strong>{getMigrationScenarioDisplayText()}</strong> migration scenario:
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
                  <div className="mb-3">
                    <strong>Migration Strategy:</strong> {getDomainMappingContext.description}
                  </div>
                  
                  {/* Show domain lists for complex mappings */}
                  {(getDomainMappingContext.isMultiTarget || getDomainMappingContext.isMultiSource) && (
                    <div className="space-y-2 mb-3">
                      {getDomainMappingContext.isMultiSource && (
                        <div>
                          <span className="font-semibold text-blue-700">Source Domains:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {getDomainMappingContext.sourceDomains.map((domain, index) => (
                              <span key={index} className="inline-block px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded border border-blue-200">
                                {domain}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {getDomainMappingContext.isMultiTarget && (
                        <div>
                          <span className="font-semibold text-green-700">Target Domains:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {getDomainMappingContext.targetDomains.map((domain, index) => (
                              <span key={index} className="inline-block px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded border border-green-200">
                                {domain}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Requirements based on domain mapping */}
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
                {/* Single Super Admin Option - only show for single super admin scenario */}
                {migrationScenario === 'single-super-admin' && (
                  <div>
                    <label className="block text-base font-bold text-gray-800 mb-2 flex items-center gap-2">
                      Super Admin Email *
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
                      Required: Super admin with access to all domains in the workspace
                    </p>
                  </div>
                )}

                {/* Cross-Tenant Options - only show for cross-tenant scenario */}
                {migrationScenario === 'cross-tenant' && (
                  <>
                    {/* Cross-Tenant Options */}
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <label className="block text-base font-bold text-gray-800 mb-2 flex items-center gap-2">
                          Source Domain Admin Email *
                          {inputsourceAdminEmail && isAdminEmailFromCache() && (
                            <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full font-medium">
                              From Cache
                            </span>
                          )}
                        </label>
                        <input
                          type="email"
                          value={inputsourceAdminEmail}
                          onChange={(e) => setInputsourceAdminEmail(e.target.value)}
                          placeholder={getDomainMappingContext?.sourceDomains[0] ? 
                            `admin@${getDomainMappingContext.sourceDomains[0]}` : 
                            'admin@source-domain.com'
                          }
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                            inputsourceAdminEmail && isAdminEmailFromCache() 
                              ? 'border-green-300 bg-green-50' 
                              : 'border-blue-200'
                          }`}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-base font-bold text-gray-800 mb-2 flex items-center gap-2">
                          Destination Domain Admin Email *
                          {inputdestAdminEmail && isAdminEmailFromCache() && (
                            <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full font-medium">
                              From Cache
                            </span>
                          )}
                        </label>
                        <input
                          type="email"
                          value={inputdestAdminEmail}
                          onChange={(e) => setInputdestAdminEmail(e.target.value)}
                          placeholder={getDomainMappingContext?.targetDomains[0] ? 
                            `admin@${getDomainMappingContext.targetDomains[0]}` : 
                            'admin@dest-domain.com'
                          }
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                            inputdestAdminEmail && isAdminEmailFromCache() 
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
                              : `Source: ${cachedInfo.sourceAdminEmail}, Dest: ${cachedInfo.destAdminEmail}`
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
              <div className="grid gap-4 md:grid-cols-2">
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
                          href={delegationSetupData.setupInstructions?.domain?.adminConsoleUrl || '#'} 
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
                            onClick={() => copyToClipboard(delegationSetupData.setupInstructions?.domain?.adminConsoleUrl || '', 'admin-url')}
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
                          {delegationSetupData.setupInstructions?.domain?.adminConsoleUrl || ''}
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
                          onClick={() => copyToClipboard(delegationSetupData.setupInstructions?.domain?.clientId || '', 'step4-client-id')}
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
                        {delegationSetupData.setupInstructions?.domain?.clientId || 'Client ID not available'}
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
                          <span className="text-sm font-bold text-blue-800"> All Scopes (Recommended):</span>
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
                           Copy this complete list for full migration functionality
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
                        <span className="text-sm font-bold text-gray-800"> Client ID Reference</span>
                        <button
                          onClick={() => copyToClipboard(delegationSetupData.setupInstructions?.domain?.clientId || '', 'ref-client-id')}
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
                        {delegationSetupData.setupInstructions?.domain?.clientId || 'Client ID not available'}
                      </code>
                    </div>
                  
                  <div className="p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-gray-800"> OAuth Scopes Reference</span>
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
                       {delegationSetupData.scopes.length} total scopes • Use Step 5 above for detailed options
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
                            onClick={() => copyToClipboard(delegationSetupData.setupInstructions?.source?.clientId || '', 'source-client-id')}
                            className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                          >
                            {copiedItem === 'source-client-id' ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                        <code className="text-sm font-mono text-gray-800 break-all block bg-gray-50 p-3 rounded border">
                          {delegationSetupData.setupInstructions?.source?.clientId || 'Client ID not available'}
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
                            onClick={() => copyToClipboard(delegationSetupData.setupInstructions?.destination?.clientId || '', 'dest-client-id')}
                            className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                          >
                            {copiedItem === 'dest-client-id' ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                        <code className="text-sm font-mono text-gray-800 break-all block bg-gray-50 p-3 rounded border">
                          {delegationSetupData.setupInstructions?.destination?.clientId || 'Client ID not available'}
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
                <div className="grid gap-4 md:grid-cols-2">
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
                      Your <strong>{getMigrationScenarioDisplayText()}</strong> migration configuration is complete.
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
