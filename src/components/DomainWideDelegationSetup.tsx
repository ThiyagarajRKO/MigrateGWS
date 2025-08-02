'use client'

import React, { useState, memo, useMemo } from 'react'
import { DomainMappingConfig } from '@/types/migration-scenarios'
import { 
  Copy, 
  CheckCircle, 
  AlertCircle, 
  ExternalLink, 
  ChevronDown, 
  ChevronRight, 
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
  destAccount?: string
  destAccounts?: {[domain: string]: string} // For multiple target domains
  adminEmail?: string // For single super admin scenario
  migrationScenario?: 'single-super-admin' | 'cross-tenant'
  domainMapping?: DomainMappingConfig // Domain mapping configuration
  onComplete?: () => void
  className?: string
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

const chunkScopes = (scopes: string[], chunkSize: number): string[][] => {
  const chunks: string[][] = []
  for (let i = 0; i < scopes.length; i += chunkSize) {
    chunks.push(scopes.slice(i, i + chunkSize))
  }
  return chunks
}

const DomainWideDelegationSetup = memo(function DomainWideDelegationSetup({ 
  sourceAccount, 
  destAccount, 
  destAccounts = {},
  adminEmail,
  migrationScenario,
  domainMapping,
  onComplete, 
  className = '' 
}: DomainWideDelegationSetupProps) {
  const [copiedItem, setCopiedItem] = useState<string | null>(null)
  const [expandedSteps, setExpandedSteps] = useState<{ [key: string]: boolean }>({})
  const [completedSteps, setCompletedSteps] = useState<{ [key: string]: boolean }>({})
  const [showOverviewTooltip, setShowOverviewTooltip] = useState(false)
  
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

  // Domain mapping context helpers
  const getDomainMappingContext = useMemo(() => {
    if (!domainMapping) return null

    const isMultiTarget = domainMapping.type === 'one-to-many' || domainMapping.type === 'cross-tenant-multi-target'
    const isMultiSource = domainMapping.type === 'many-to-one' || domainMapping.type === 'cross-tenant-multi-source'
    const isCrossTenant = domainMapping.type.includes('cross-tenant')
    
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

  const getComplexityLevel = () => {
    if (!domainMapping) return 'Unknown'
    
    const isMultiTarget = domainMapping.type === 'one-to-many' || domainMapping.type === 'cross-tenant-multi-target'
    const isMultiSource = domainMapping.type === 'many-to-one' || domainMapping.type === 'cross-tenant-multi-source'
    const isCrossTenant = domainMapping.type.includes('cross-tenant')
    
    if (isCrossTenant && (isMultiTarget || isMultiSource)) return 'Very High'
    if (isCrossTenant) return 'High'
    if (isMultiTarget || isMultiSource) return 'Medium'
    return 'Low'
  }

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

  const copyToClipboard = (text: string, itemId: string) => {
    navigator.clipboard.writeText(text)
    setCopiedItem(itemId)
    setTimeout(() => setCopiedItem(null), 2000)
  }

  const clearMessages = () => {
    setError(null)
    setSuccessMessage(null)
  }

  const toggleStep = (stepId: string) => {
    setExpandedSteps(prev => ({
      ...prev,
      [stepId]: !prev[stepId]
    }))
  }

  const markStepComplete = (stepId: string) => {
    setCompletedSteps(prev => ({
      ...prev,
      [stepId]: !prev[stepId]
    }))
  }

  // Domain-wide delegation setup API call
  const setupDomainWideDelegation = async () => {
    // Get effective values - use props if available, otherwise use input state
    const effectiveAdminEmail = adminEmail || inputAdminEmail || undefined;
    const effectiveSourceAccount = sourceAccount || inputSourceEmail || undefined;
    const effectiveDestAccount = destAccount || inputDestEmail || undefined;
    const hasMultipleDestAccounts = Object.keys(destAccounts).length > 0;
    
    // Determine migration scenario and validate inputs
    const isSingleSuperAdmin = migrationScenario === 'single-super-admin' || 
                              (effectiveAdminEmail && !effectiveSourceAccount && !effectiveDestAccount && !hasMultipleDestAccounts);
    const isCrossTenant = migrationScenario === 'cross-tenant' || 
                         (effectiveSourceAccount && (effectiveDestAccount || hasMultipleDestAccounts));

    if (isSingleSuperAdmin && !effectiveAdminEmail) {
      setError('Admin email is required for single super admin scenario. Please enter an admin email above.');
      return;
    }

    if (isCrossTenant && !effectiveSourceAccount) {
      setError('Source admin email is required for cross-tenant migration. Please enter a source admin email above.');
      return;
    }

    if (isCrossTenant && !effectiveDestAccount && !hasMultipleDestAccounts) {
      setError('At least one destination admin email is required for cross-tenant migration. Please enter a destination admin email above.');
      return;
    }

    if (!isSingleSuperAdmin && !isCrossTenant) {
      setError('Please specify at least one admin email above to generate setup instructions.');
      return;
    }

    setDelegationSetupLoading(true)
    setError(null)
    setSuccessMessage(null)
    
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
          sourceAdminEmail: effectiveSourceAccount,
          migrationScenario: 'cross-tenant'
        }
        
        // Handle single destination or multiple destinations
        if (effectiveDestAccount) {
          requestPayload.destAdminEmail = effectiveDestAccount
        } else if (hasMultipleDestAccounts) {
          // For multiple destinations, we'll use the first one for the API call
          // In a real scenario, you might want to handle this differently
          const firstDestDomain = Object.keys(destAccounts)[0]
          const firstDestEmail = destAccounts[firstDestDomain]
          requestPayload.destAdminEmail = firstDestEmail
          requestPayload.destAccounts = destAccounts
        } else {
          // Fallback - this shouldn't happen due to our validation above
          setError('Destination admin email is required for cross-tenant migration.')
          return
        }
      }

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
    const hasMultipleDestAccounts = Object.keys(destAccounts).length > 0;
    
    // Determine verification scenario based on setup data or props
    const isSingleSuperAdmin = delegationSetupData?.migrationScenario === 'single-super-admin' || 
                              (effectiveAdminEmail && !effectiveSourceAccount && !effectiveDestAccount && !hasMultipleDestAccounts);
    const isCrossTenant = delegationSetupData?.migrationScenario === 'cross-tenant' || 
                         (effectiveSourceAccount && (effectiveDestAccount || hasMultipleDestAccounts));

    if (isSingleSuperAdmin && !effectiveAdminEmail) {
      setError('Admin email is required for single super admin verification. Please enter an admin email above.');
      return;
    }

    if (isCrossTenant && !effectiveSourceAccount) {
      setError('Source admin email is required for cross-tenant verification. Please enter a source admin email above.');
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
          sourceAdminEmail: effectiveSourceAccount,
          sourceEmail: effectiveSourceAccount,
          migrationScenario: 'cross-tenant'
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
      
      const response = await fetch(`${API_BASE_URL}/api/v1/delegation/verify`, {
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
          setDelegationStatus({
            source: {
              configured: data.verification.domain?.testResults?.length > 0 || false,
              verified: data.verification.domain?.verified || false,
              error: data.verification.domain?.testResults?.[0]?.error
            },
            dest: {
              configured: false,
              verified: false,
              error: undefined
            }
          })
        } else {
          // Handle cross-tenant verification
          setDelegationStatus({
            source: {
              configured: data.verification.source?.testResults?.length > 0 || false,
              verified: data.verification.source?.verified || false,
              error: data.verification.source?.testResults?.[0]?.error
            },
            dest: {
              configured: data.verification.destination?.testResults?.length > 0 || false,
              verified: data.verification.destination?.verified || false,
              error: data.verification.destination?.testResults?.[0]?.error
            }
          })
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

  const steps = useMemo(() => ({
    'setup': {
      title: 'Setup',
      description: getDomainMappingContext ? 
        `Step-by-step configuration for ${getDomainMappingContext.type.replace('-', ' ')} domain-wide delegation` :
        'Step-by-step configuration for domain-wide delegation',
      estimatedTime: getDomainMappingContext?.complexity === 'Very High' ? '25-35 minutes' :
                     getDomainMappingContext?.complexity === 'High' ? '20-30 minutes' :
                     getDomainMappingContext?.complexity === 'Medium' ? '15-25 minutes' : 
                     '10-20 minutes',
      content: (() => {
        const isSingleDomain = delegationSetupData?.migrationScenario === 'single-super-admin'
        const isCrossTenant = delegationSetupData?.migrationScenario === 'cross-tenant'

        if (isSingleDomain) {
          return [
            '**Configuration Steps**',
            '',
            getDomainMappingContext ? `**Configuring for ${getDomainMappingContext.description}**` : '**Configure Admin Console for Your Domain**',
            delegationSetupData?.setupInstructions?.domain?.adminConsoleUrl
              ? `1. Go to ${delegationSetupData.setupInstructions.domain.adminConsoleUrl}`
              : '1. Go to https://admin.google.com',
            '2. Navigate to Security → API Controls → Domain-wide Delegation',
            '3. Click "Add new" to add a new client',
            delegationSetupData?.setupInstructions?.domain?.clientId
              ? `4. Enter Client ID: ${delegationSetupData.setupInstructions.domain.clientId}`
              : '4. Enter the Service Account Client ID from the generated instructions',
            delegationSetupData?.scopes?.length
              ? `5. Enter OAuth Scopes: ${delegationSetupData.scopes.join(',')}`
              : '5. Enter the required OAuth scopes (see below)',
            '6. Click "Authorize"',
            '',
            getDomainMappingContext?.isMultiTarget ? '**Note:** This configuration will allow access to migrate data to multiple target domains.' : '',
            getDomainMappingContext?.isMultiSource ? '**Note:** This configuration will allow access to migrate data from multiple source domains.' : '',
            !delegationSetupData ? '**Required OAuth Scopes:**' : '**Verification:**',
            !delegationSetupData ? 'If you haven\'t generated setup instructions yet, use the OAuth scopes listed below.' : 'Use the "Verify Configuration" button above to test your setup.'
          ].filter(line => line !== null && line !== '')
        }

        if (isCrossTenant) {
          return [
            '**Configuration Steps**',
            '',
            getDomainMappingContext ? `**Configuring for ${getDomainMappingContext.description}**` : '**Cross-Tenant Domain Configuration**',
            getDomainMappingContext?.isMultiSource ? '⚠️ **Multiple Source Domains:** You\'ll need to repeat these steps for each source domain.' : '',
            getDomainMappingContext?.isMultiTarget ? '⚠️ **Multiple Target Domains:** You\'ll need to repeat these steps for each destination domain.' : '',
            '',
            '**Step 1: Configure Admin Console for Source Domain**',
            delegationSetupData?.setupInstructions?.source?.adminConsoleUrl
              ? `1. Go to ${delegationSetupData.setupInstructions.source.adminConsoleUrl}`
              : '1. Go to https://admin.google.com',
            '2. Navigate to Security → API Controls → Domain-wide Delegation',
            '3. Click "Add new" to add a new client',
            delegationSetupData?.setupInstructions?.source?.clientId
              ? `4. Enter Client ID: ${delegationSetupData.setupInstructions.source.clientId}`
              : '4. Enter the Service Account Client ID from step 2',
            delegationSetupData?.scopes?.length
              ? `5. Enter OAuth Scopes: ${delegationSetupData.scopes.join(',')}`
              : '5. Enter the required OAuth scopes (see below)',
            '6. Click "Authorize"',
            '',
            '**Step 2: Configure Admin Console for Destination Domain**',
            delegationSetupData?.setupInstructions?.destination?.adminConsoleUrl
              ? `1. Go to ${delegationSetupData.setupInstructions.destination.adminConsoleUrl}`
              : '1. Go to https://admin.google.com (for destination domain)',
            '2. Navigate to Security → API Controls → Domain-wide Delegation',
            '3. Click "Add new" to add a new client',
            delegationSetupData?.setupInstructions?.destination?.clientId
              ? `4. Enter Client ID: ${delegationSetupData.setupInstructions.destination.clientId}`
              : '4. Enter the Service Account Client ID from step 2',
            delegationSetupData?.scopes?.length
              ? `5. Enter OAuth Scopes: ${delegationSetupData.scopes.join(',')}`
              : '5. Enter the required OAuth scopes (see below)',
            '6. Click "Authorize"',
            '',
            getDomainMappingContext?.complexity === 'Very High' ? '⚠️ **Complex Migration:** Due to the complexity of this migration, consider testing with a subset of users first.' : '',
            !delegationSetupData ? '**Required OAuth Scopes:**' : '**Verification:**',
            !delegationSetupData ? 'If you haven\'t generated setup instructions yet, use the OAuth scopes listed below.' : 'Use the "Verify Configuration" button above to test your setup.'
          ].filter(line => line !== null && line !== '')
        }

        // Default fallback for no setup data
        return [
          '**Configuration Steps**',
          '',
          getDomainMappingContext ? `**${getDomainMappingContext.description}**` : '**Generate Setup Instructions First**',
          getDomainMappingContext ? 
            `This ${getDomainMappingContext.complexity.toLowerCase()}-complexity migration requires careful domain-wide delegation setup.` :
            '1. Use the "Generate Setup Instructions" button above to create personalized configuration details',
          getDomainMappingContext?.isCrossTenant ? 
            'Cross-tenant migrations require domain-wide delegation setup for both source and destination domains.' :
            '2. The system will determine the appropriate migration scenario based on your account information',
          '3. Follow the step-by-step instructions that will be generated',
          '',
          getDomainMappingContext ? `**For ${getDomainMappingContext.type.replace('-', ' ')} migrations:**` : '',
          getDomainMappingContext?.isMultiTarget ? '• Each target domain requires separate admin console configuration' : '',
          getDomainMappingContext?.isMultiSource ? '• Each source domain requires separate admin console configuration' : '',
          getDomainMappingContext?.isCrossTenant ? '• Cross-tenant authorization requires careful OAuth scope management' : '',
          '**Required OAuth Scopes:**',
          'If you haven\'t generated setup instructions yet, use the OAuth scopes listed below.'
        ].filter(line => line !== null && line !== '')
      })()
    }
  }), [delegationSetupData, getDomainMappingContext])

  const allStepsCompleted = Object.keys(steps).every(stepId => completedSteps[stepId])
  const completedCount = Object.values(completedSteps).filter(Boolean).length
  const totalSteps = Object.keys(steps).length

  const renderDomainStatus = (domain: 'source' | 'dest', label: string) => {
    const status = delegationStatus?.[domain]
    if (!status) return null

    // Get effective values for determining single super admin scenario
    const effectiveAdminEmail = adminEmail || inputAdminEmail || undefined;
    const effectiveSourceAccount = sourceAccount || inputSourceEmail || undefined;
    const effectiveDestAccount = destAccount || inputDestEmail || undefined;
    const hasMultipleDestAccounts = Object.keys(destAccounts).length > 0;

    // Don't render dest status for single super admin scenario
    const isSingleSuperAdmin = delegationSetupData?.migrationScenario === 'single-super-admin' || 
                              (effectiveAdminEmail && !effectiveSourceAccount && !effectiveDestAccount && !hasMultipleDestAccounts);
    if (domain === 'dest' && isSingleSuperAdmin) return null

    return (
      <div className={`p-4 rounded-lg border ${
        status.verified 
          ? 'bg-green-50 border-green-200' 
          : status.configured 
          ? 'bg-yellow-50 border-yellow-200'
          : 'bg-red-50 border-red-200'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-medium flex items-center gap-2">
            <Globe className="h-4 w-4" />
            {isSingleSuperAdmin && domain === 'source' ? 'Domain Status' : label}
          </h4>
          {status.verified ? (
            <CheckCircle className="h-5 w-5 text-green-600" />
          ) : status.configured ? (
            <AlertCircle className="h-5 w-5 text-yellow-600" />
          ) : (
            <X className="h-5 w-5 text-red-600" />
          )}
        </div>
        <div className="text-sm">
          <div className={`font-medium ${
            status.verified ? 'text-green-800' : status.configured ? 'text-yellow-800' : 'text-red-800'
          }`}>
            {status.verified ? 'Verified & Ready' : status.configured ? 'Configured but Not Verified' : 'Not Configured'}
          </div>
          {status.error && (
            <div className="text-red-600 text-xs mt-1">{status.error}</div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Shield className="w-6 h-6 text-indigo-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-gray-900">
                Domain-wide Delegation Setup
              </h2>
              <div className="relative">
                <Info 
                  className="w-5 h-5 text-gray-400 hover:text-gray-600 cursor-help transition-colors" 
                  onMouseEnter={() => setShowOverviewTooltip(true)}
                  onMouseLeave={() => setShowOverviewTooltip(false)}
                />
                
                {/* Overview Tooltip */}
                {showOverviewTooltip && (
                  <div className="absolute left-0 top-6 z-50 w-96 p-4 bg-white border border-gray-200 rounded-lg shadow-xl">
                    <div className="space-y-3 text-sm">
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2">🔐 What is Domain-wide Delegation?</h4>
                        <p className="text-gray-600">
                          Domain-wide Delegation allows a service account to access Google Workspace data on behalf of users across your entire domain without requiring individual user consent.
                        </p>
                      </div>
                      
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2">📋 Why do we need it for migration?</h4>
                        <ul className="text-gray-600 space-y-1">
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
                            <div className="text-xs text-gray-500">
                              Complexity: {getDomainMappingContext.complexity} | 
                              Sources: {getDomainCount().source} | 
                              Targets: {getDomainCount().target}
                            </div>
                            {getDomainMappingContext.isCrossTenant && (
                              <div className="text-orange-600 text-xs">⚠️ Cross-tenant migration requires separate domain setups</div>
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
            <p className="text-gray-600 mt-1">
              Configure secure cross-domain access for Google Workspace migration
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">Progress</div>
            <div className="text-lg font-semibold text-indigo-600">
              {completedCount}/{totalSteps}
            </div>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(completedCount / totalSteps) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Account Information & Domain Mapping */}
        {((sourceAccount || destAccount || adminEmail) || domainMapping) && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-3 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Migration Configuration
            </h3>
            
            {/* Domain Mapping Information */}
            {domainMapping && getDomainMappingContext && (
              <div className="mb-4 p-3 bg-blue-100 border border-blue-300 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-blue-900 text-sm">Domain Mapping Strategy</h4>
                  <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                    getDomainMappingContext.complexity === 'Very High' ? 'bg-red-100 text-red-800' :
                    getDomainMappingContext.complexity === 'High' ? 'bg-orange-100 text-orange-800' :
                    getDomainMappingContext.complexity === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {getDomainMappingContext.complexity} Complexity
                  </span>
                </div>
                <p className="text-blue-800 text-sm mb-2">{getDomainMappingContext.description}</p>
                
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-blue-700 font-medium">Source Domains:</span>
                    <span className="text-blue-800 ml-1">{getDomainCount().source}</span>
                  </div>
                  <div>
                    <span className="text-blue-700 font-medium">Target Domains:</span>
                    <span className="text-blue-800 ml-1">{getDomainCount().target}</span>
                  </div>
                </div>
                
                {getDomainMappingContext.isCrossTenant && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-blue-700">
                    <AlertCircle className="h-3 w-3" />
                    <span>Cross-tenant migration requires domain-wide delegation setup for both source and destination domains</span>
                  </div>
                )}
              </div>
            )}
            
            <div className="space-y-4 text-sm">
              {/* Single Super Admin scenario */}
              {adminEmail && !sourceAccount && !destAccount && (
                <div>
                  <div className="text-blue-700 font-medium">Super Admin</div>
                  <div className="text-blue-800">{adminEmail}</div>
                  <div className="text-blue-600 text-xs mt-1">
                    {getDomainMappingContext?.isCrossTenant ? 
                      'Note: Cross-tenant migrations typically require separate admin accounts for each domain' :
                      'Single domain migration scenario'
                    }
                  </div>
                </div>
              )}

              {/* Cross-tenant scenario */}
              {sourceAccount && (
                <div>
                  <div className="text-blue-700 font-medium">Source Domain Admin</div>
                  <div className="text-blue-800">{sourceAccount}</div>
                </div>
              )}
              
              {/* Single destination domain */}
              {destAccount && Object.keys(destAccounts).length === 0 && (
                <div>
                  <div className="text-blue-700 font-medium">Destination Domain Admin</div>
                  <div className="text-blue-800">{destAccount}</div>
                </div>
              )}
              
              {/* Multiple destination domains */}
              {Object.keys(destAccounts).length > 0 && (
                <div>
                  <div className="text-blue-700 font-medium mb-2">Destination Domain Admins</div>
                  <div className="space-y-2">
                    {Object.entries(destAccounts).map(([domain, email]) => (
                      <div key={domain} className="flex items-center justify-between p-2 bg-blue-50 rounded-lg">
                        <span className="text-blue-600 font-mono text-xs">{domain}</span>
                        <span className="text-blue-800 text-sm">{email}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Automated Setup Section - Always Available */}
        <div className="mb-6 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Settings className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-blue-900">
                Automated Setup
              </h3>
              <p className="text-sm text-blue-700">
                {getDomainMappingContext ? (
                  <>
                    {getDomainMappingContext.isCrossTenant ? 
                      `Generate service accounts and get setup instructions for ${getDomainMappingContext.type.replace('-', ' ')} migration.` :
                      `Generate service account and get setup instructions for ${getDomainMappingContext.type.replace('-', ' ')} migration.`
                    }
                    {getDomainMappingContext.complexity === 'Very High' && (
                      <> This is a complex migration scenario that requires careful configuration.</>
                    )}
                  </>
                ) : (
                  adminEmail && !sourceAccount && !destAccount 
                    ? 'Generate service account and get setup instructions for your domain.'
                    : (sourceAccount && destAccount)
                      ? 'Generate service accounts and get personalized setup instructions for both domains.'
                      : (sourceAccount || destAccount)
                        ? 'Generate service account and get setup instructions for the specified domain.'
                        : 'Generate service account and get setup instructions. You can specify domain administrators in the form below.'
                )}
              </p>
            </div>
          </div>
          
          {/* Admin Email Input Section - Show when no emails are provided */}
          {!sourceAccount && !destAccount && !adminEmail && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-3">Domain Administrator Configuration</h4>
              <p className="text-sm text-blue-700 mb-3">
                {getDomainMappingContext ? (
                  <>
                    For your <strong>{getDomainMappingContext.type.replace('-', ' ')}</strong> migration scenario, 
                    please specify the appropriate domain administrator emails:
                    {getDomainMappingContext.isCrossTenant && (
                      <> You'll need admin access to both source and destination domains.</>
                    )}
                  </>
                ) : (
                  'To generate setup instructions, please specify at least one domain administrator email:'
                )}
              </p>
              
              {/* Domain mapping specific guidance */}
              {getDomainMappingContext && (
                <div className="mb-3 p-2 bg-blue-100 border border-blue-300 rounded text-xs text-blue-800">
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
                    <label className="block text-sm font-medium text-blue-900 mb-1">
                      {getDomainMappingContext?.isMultiTarget || getDomainMappingContext?.isMultiSource ? 
                        'Super Admin Email (with access to all domains)' : 
                        'Single Domain Admin Email'
                      }
                    </label>
                    <input
                      type="email"
                      value={inputAdminEmail}
                      onChange={(e) => setInputAdminEmail(e.target.value)}
                      placeholder="admin@yourdomain.com"
                      className="w-full px-3 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="text-xs text-blue-600 mt-1">
                      {getDomainMappingContext?.isMultiTarget || getDomainMappingContext?.isMultiSource ?
                        'Use this if you have super admin access across all domains in the migration' :
                        'Use this for single domain migration scenarios'
                      }
                    </p>
                  </div>
                )}

                {(!getDomainMappingContext || getDomainMappingContext.isCrossTenant) && (
                  <>
                    {!getDomainMappingContext && (
                      <div className="text-center text-xs text-blue-600 font-medium">OR</div>
                    )}
                    
                    {/* Cross-Tenant Options */}
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium text-blue-900 mb-1">
                          Source Domain Admin Email
                        </label>
                        <input
                          type="email"
                          value={inputSourceEmail}
                          onChange={(e) => setInputSourceEmail(e.target.value)}
                          placeholder={getDomainMappingContext?.sourceDomains[0] ? 
                            `admin@${getDomainMappingContext.sourceDomains[0]}` : 
                            'admin@source-domain.com'
                          }
                          className="w-full px-3 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-blue-900 mb-1">
                          Destination Domain Admin Email
                        </label>
                        <input
                          type="email"
                          value={inputDestEmail}
                          onChange={(e) => setInputDestEmail(e.target.value)}
                          placeholder={getDomainMappingContext?.targetDomains[0] ? 
                            `admin@${getDomainMappingContext.targetDomains[0]}` : 
                            'admin@dest-domain.com'
                          }
                          className="w-full px-3 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-blue-600">
                      {getDomainMappingContext ? 
                        'Required for cross-tenant migration scenarios' :
                        'Use these for cross-tenant migration scenarios'
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
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md font-medium"
            >
              {delegationSetupLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Settings className="h-4 w-4" />
              )}
              Generate Setup Instructions
            </button>

            <button
              onClick={verifyDomainWideDelegation}
              disabled={delegationVerifyLoading}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md font-medium"
            >
              {delegationVerifyLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              Verify Configuration
            </button>
          </div>

            {/* Error and Success Messages */}
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 text-red-800">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium">Error:</span>
                  <span>{error}</span>
                </div>
              </div>
            )}

            {successMessage && (
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-green-800">
                  <CheckCircle className="h-4 w-4" />
                  <span className="font-medium">Success:</span>
                  <span>{successMessage}</span>
                </div>
              </div>
            )}

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
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Key className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-amber-900">
                  Generated Setup Instructions
                </h3>
                <p className="text-sm text-amber-700">
                  Copy the configuration details below to set up domain-wide delegation
                </p>
              </div>
            </div>
            
            {/* Single Domain Instructions */}
            {delegationSetupData.migrationScenario === 'single-super-admin' && delegationSetupData.setupInstructions?.domain && (
              <div className="mb-6">
                <h4 className="font-medium text-amber-800 mb-3">
                  {delegationSetupData.setupInstructions.domain.title}
                </h4>
                <div className="space-y-3">
                  <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Client ID</span>
                      <button
                        onClick={() => copyToClipboard(delegationSetupData.setupInstructions!.domain!.clientId, 'domain-client-id')}
                        className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium"
                      >
                        {copiedItem === 'domain-client-id' ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <code className="text-xs font-mono text-gray-800 break-all block">
                      {delegationSetupData.setupInstructions.domain.clientId}
                    </code>
                  </div>
                  
                  <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">OAuth Scopes</span>
                      <button
                        onClick={() => copyToClipboard(delegationSetupData.scopes.join(','), 'domain-scopes')}
                        className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium"
                      >
                        {copiedItem === 'domain-scopes' ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <code className="text-xs font-mono text-gray-800 break-all block">
                      {delegationSetupData.scopes.join(',')}
                    </code>
                  </div>

                  <a
                    href={delegationSetupData.setupInstructions.domain.adminConsoleUrl}
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
                          <span className="text-sm font-medium text-gray-700">Client ID</span>
                          <button
                            onClick={() => copyToClipboard(delegationSetupData.setupInstructions!.source!.clientId, 'source-client-id')}
                            className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium"
                          >
                            {copiedItem === 'source-client-id' ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                        <code className="text-xs font-mono text-gray-800 break-all block">
                          {delegationSetupData.setupInstructions.source.clientId}
                        </code>
                      </div>
                      
                      <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">OAuth Scopes</span>
                          <button
                            onClick={() => copyToClipboard(delegationSetupData.scopes.join(','), 'source-scopes')}
                            className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium"
                          >
                            {copiedItem === 'source-scopes' ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                        <code className="text-xs font-mono text-gray-800 break-all block">
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
                          <span className="text-sm font-medium text-gray-700">Client ID</span>
                          <button
                            onClick={() => copyToClipboard(delegationSetupData.setupInstructions!.destination!.clientId, 'dest-client-id')}
                            className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium"
                          >
                            {copiedItem === 'dest-client-id' ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                        <code className="text-xs font-mono text-gray-800 break-all block">
                          {delegationSetupData.setupInstructions.destination.clientId}
                        </code>
                      </div>
                      
                      <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">OAuth Scopes</span>
                          <button
                            onClick={() => copyToClipboard(delegationSetupData.scopes.join(','), 'dest-scopes')}
                            className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium"
                          >
                            {copiedItem === 'dest-scopes' ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                        <code className="text-xs font-mono text-gray-800 break-all block">
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
                <h3 className="text-lg font-semibold text-green-900">
                  Verify Domain-Wide Delegation
                </h3>
                <p className="text-sm text-green-700">
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
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md font-medium"
              >
                {delegationVerifyLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                {delegationSetupData.migrationScenario === 'single-super-admin'
                  ? 'Verify Domain Configuration'
                  : 'Verify Cross-Tenant Configuration'
                }
              </button>

              {delegationStatus && (
                <button
                  onClick={() => setDelegationStatus(null)}
                  className="flex items-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all duration-200 font-medium"
                >
                  <X className="h-4 w-4" />
                  Clear Results
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
              <h5 className="font-medium text-green-800 mb-2 flex items-center gap-2">
                <Info className="h-4 w-4" />
                Verification Tips
              </h5>
              <ul className="text-sm text-green-700 space-y-1">
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

        {/* Manual Setup Steps */}
        <div className="space-y-4">
          {Object.entries(steps).map(([stepId, step]) => (
            <div
              key={stepId}
              className={`border rounded-lg transition-all duration-200 ${
                completedSteps[stepId] 
                  ? 'border-green-200 bg-green-50' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${
                      completedSteps[stepId]
                        ? 'border-green-500 bg-green-500 text-white'
                        : 'border-gray-300'
                    }`}>
                      {completedSteps[stepId] ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <span className="text-sm font-bold">{Object.keys(steps).indexOf(stepId) + 1}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{step.title}</h4>
                      <p className="text-gray-600 text-sm">{step.description}</p>
                      {step.estimatedTime && (
                        <div className="flex items-center gap-1 mt-1">
                          <Clock className="w-3 h-3 text-gray-400" />
                          <span className="text-xs text-gray-500">{step.estimatedTime}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => markStepComplete(stepId)}
                      className={`px-3 py-1 text-sm rounded-md transition-colors ${
                        completedSteps[stepId]
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {completedSteps[stepId] ? 'Completed' : 'Mark Complete'}
                    </button>

                    <button
                      onClick={() => toggleStep(stepId)}
                      className="p-1 hover:bg-gray-100 rounded transition-colors"
                    >
                      {expandedSteps[stepId] ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {expandedSteps[stepId] && (
                  <div className="mt-4 pl-11">
                    <div className="prose prose-sm max-w-none text-gray-600">
                      {step.content.map((line, index) => {
                        if (line === '') {
                          return <div key={index} className="h-2" />
                        }
                        
                        if (line.startsWith('**') && line.endsWith('**')) {
                          return (
                            <h5 key={index} className="font-semibold text-gray-800 mt-3 mb-1">
                              {line.slice(2, -2)}
                            </h5>
                          )
                        }
                        
                        if (line.startsWith('•')) {
                          return (
                            <div key={index} className="flex items-start gap-2 mt-1">
                              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mt-2 flex-shrink-0" />
                              <span>{line.slice(1).trim()}</span>
                            </div>
                          )
                        }
                        
                        if (/^[🔐📋🔧⚠️🚀🛠️]/.test(line)) {
                          return (
                            <div key={index} className="flex items-start gap-2 mt-1">
                              <span className="mt-0.5">{line.slice(0, 2)}</span>
                              <span className="font-medium">{line.slice(2).trim()}</span>
                            </div>
                          )
                        }
                        
                        // Handle numbered steps with potential Client ID or OAuth scope injections
                        if (/^\d+\./.test(line)) {
                          const isClientIdLine = line.includes('Enter Client ID:')
                          const isScopeLine = line.includes('Enter OAuth Scopes:')
                          
                          if (isClientIdLine || isScopeLine) {
                            return (
                              <div key={index} className="mt-1 p-2 bg-blue-50 border border-blue-200 rounded">
                                <div className="font-mono text-sm">{line}</div>
                                {(isClientIdLine || isScopeLine) && (
                                  <div className="mt-1 flex items-center gap-2">
                                    <button
                                      onClick={() => {
                                        const textToCopy = isClientIdLine 
                                          ? line.split('Enter Client ID: ')[1] 
                                          : line.split('Enter OAuth Scopes: ')[1]
                                        copyToClipboard(textToCopy, `manual-${isClientIdLine ? 'clientid' : 'scopes'}-${index}`)
                                      }}
                                      className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                                    >
                                      {copiedItem === `manual-${isClientIdLine ? 'clientid' : 'scopes'}-${index}` ? 'Copied!' : 'Copy'}
                                    </button>
                                  </div>
                                )}
                              </div>
                            )
                          }
                        }
                        
                        return (
                          <div key={index} className="mt-1">
                            {line}
                          </div>
                        )
                      })}
                    </div>

                    {stepId === 'setup' && !delegationSetupData && (
                      <div className="mt-4 p-3 bg-gray-50 rounded border">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                            <Key className="w-4 h-4" />
                            Required OAuth Scopes
                          </span>
                          <button
                            onClick={() => copyToClipboard(REQUIRED_SCOPES.join(','), 'manual-scopes')}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                          >
                            {copiedItem === 'manual-scopes' ? (
                              <>
                                <CheckCircle className="w-3 h-3" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                Copy All
                              </>
                            )}
                          </button>
                        </div>
                        <code className="text-xs font-mono text-gray-800 break-all block bg-white p-2 rounded border">
                          {REQUIRED_SCOPES.join(',')}
                        </code>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Completion */}
        {allStepsCompleted && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <h4 className="font-medium text-green-800">
                  Domain-wide Delegation Setup Complete!
                </h4>
                <p className="text-green-700 text-sm mt-1">
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
              </div>
            </div>
            {onComplete && (
              <button
                onClick={onComplete}
                className="mt-3 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                Continue to Migration Setup
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
})

DomainWideDelegationSetup.displayName = 'DomainWideDelegationSetup'

export default DomainWideDelegationSetup
