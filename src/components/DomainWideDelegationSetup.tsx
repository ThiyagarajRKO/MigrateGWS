'use client'

import React, { useState, memo } from 'react'
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
  onComplete?: () => void
  className?: string
}

interface DelegationSetupData {
  success: boolean
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
    source: DomainSetupInstructions
    destination: DomainSetupInstructions
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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000'

// Required OAuth scopes for complete Google Workspace migration
const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/admin.directory.user',
  'https://www.googleapis.com/auth/admin.directory.domain', 
  'https://www.googleapis.com/auth/admin.directory.group',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/contacts.readonly'
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
  onComplete, 
  className = '' 
}: DomainWideDelegationSetupProps) {
  const [copiedItem, setCopiedItem] = useState<string | null>(null)
  const [expandedSteps, setExpandedSteps] = useState<{ [key: string]: boolean }>({
    'overview': true
  })
  const [completedSteps, setCompletedSteps] = useState<{ [key: string]: boolean }>({})
  
  // API integration state
  const [delegationSetupLoading, setDelegationSetupLoading] = useState(false)
  const [delegationVerifyLoading, setDelegationVerifyLoading] = useState(false)
  const [delegationSetupData, setDelegationSetupData] = useState<DelegationSetupData | null>(null)
  const [delegationStatus, setDelegationStatus] = useState<DelegationStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

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
    if (!sourceAccount || !destAccount) {
      setError('Both source and destination accounts are required for delegation setup')
      return
    }

    setDelegationSetupLoading(true)
    setError(null)
    setSuccessMessage(null)
    
    try {
      const requestPayload = {
        sourceAdminEmail: sourceAccount,
        destAdminEmail: destAccount
      }
      
      console.log('[Delegation Setup] Request payload:', requestPayload)

      const response = await fetch(`${API_BASE_URL}/api/v1/delegation/setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      })

      console.log('[Delegation Setup] Response status:', response.status)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('[Delegation Setup] Error response:', errorText)
        throw new Error(`Setup failed: ${errorText}`)
      }

      const data = await response.json()
      console.log('[Delegation Setup] Response:', data)

      if (data.success) {
        setDelegationSetupData({
          success: data.success,
          source: data.source,
          destination: data.destination,
          scopes: data.scopes || REQUIRED_SCOPES,
          scopeChunks: chunkScopes(data.scopes || REQUIRED_SCOPES, 15),
          setupInstructions: data.setupInstructions || {
            source: {
              title: 'Source Domain Setup',
              clientId: data.source?.clientId || '',
              scopes: data.scopes || REQUIRED_SCOPES,
              adminConsoleUrl: 'https://admin.google.com/ac/owl/domainwidedelegation',
              domain: data.source?.domain || '',
              adminEmail: data.source?.adminEmail || ''
            },
            destination: {
              title: 'Destination Domain Setup',
              clientId: data.destination?.clientId || '',
              scopes: data.scopes || REQUIRED_SCOPES,
              adminConsoleUrl: 'https://admin.google.com/ac/owl/domainwidedelegation',
              domain: data.destination?.domain || '',
              adminEmail: data.destination?.adminEmail || ''
            }
          }
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
    if (!sourceAccount || !destAccount) {
      setError('Both source and destination accounts are required for delegation verification')
      return
    }

    setDelegationVerifyLoading(true)
    setError(null)
    setSuccessMessage(null)
    
    try {
      const requestPayload = {
        sourceAdminEmail: sourceAccount,
        destAdminEmail: destAccount,
        sourceEmail: sourceAccount,
        destEmail: destAccount
      }
      
      console.log('[Delegation Verify] Request payload:', requestPayload)
      
      const response = await fetch(`${API_BASE_URL}/api/v1/delegation/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      })

      console.log('[Delegation Verify] Response status:', response.status)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('[Delegation Verify] Error response:', errorText)
        throw new Error(`Verification failed: ${errorText}`)
      }

      const data = await response.json()
      console.log('[Delegation Verify] Response:', data)

      if (data.success && data.verification) {
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
        setSuccessMessage('Verification completed successfully!')
        setTimeout(() => setSuccessMessage(null), 5000) // Clear after 5 seconds
      } else {
        setDelegationStatus({
          source: { configured: false, verified: false, error: data.error || data.message || 'Verification failed' },
          dest: { configured: false, verified: false, error: data.error || data.message || 'Verification failed' }
        })
        setError(data.error || data.message || 'Verification failed')
      }
    } catch (error) {
      console.error('[Delegation Verify] Error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Verification failed'
      setDelegationStatus({
        source: { configured: false, verified: false, error: errorMessage },
        dest: { configured: false, verified: false, error: errorMessage }
      })
      setError(errorMessage)
    } finally {
      setDelegationVerifyLoading(false)
    }
  }

  const steps = {
    'overview': {
      title: 'Domain-wide Delegation Overview',
      description: 'Understanding the setup process for cross-domain migration',
      estimatedTime: '2 minutes reading',
      content: [
        '🔐 **What is Domain-wide Delegation?**',
        'Domain-wide Delegation allows a service account to access Google Workspace data on behalf of users across your entire domain without requiring individual user consent.',
        '',
        '📋 **Why do we need it for migration?**',
        '• Automated access to all user data (Gmail, Drive, Calendar, Contacts)',
        '• No individual user authentication required',
        '• Comprehensive data migration capabilities',
        '• Secure, auditable access control',
        '',
        '🔧 **Setup Requirements:**',
        '• Super Admin access to source and target domains',
        '• Google Cloud Project with enabled APIs',
        '• Service Account with Domain-wide Delegation configured',
        '',
        '⚠️ **Security Considerations:**',
        '• Only authorize trusted applications',
        '• Regularly review delegated access',
        '• Can be revoked at any time from Admin Console',
        '• All API calls are logged and auditable'
      ]
    },
    'automated-setup': {
      title: 'Automated Setup (Recommended)',
      description: 'Generate service account and delegation configuration automatically',
      estimatedTime: '5-10 minutes',
      content: [
        '🚀 **Automated Configuration**',
        'Our platform can automatically generate the required service accounts and provide you with the exact configuration needed for both domains.',
        '',
        '**What this does:**',
        '• Creates service accounts for both domains',
        '• Generates the correct Client IDs',
        '• Provides the exact OAuth scopes needed',
        '• Gives you step-by-step copy-paste instructions',
        '',
        '**Prerequisites:**',
        '• Valid admin email addresses for both domains',
        '• Super admin access to both Google Workspace accounts'
      ]
    },
    'manual-setup': {
      title: 'Manual Setup Instructions',
      description: 'Step-by-step manual configuration for advanced users',
      estimatedTime: '15-20 minutes',
      content: [
        '🛠️ **Manual Configuration Steps**',
        '',
        '**Step 1: Google Cloud Console Setup**',
        '1. Go to https://console.cloud.google.com',
        '2. Select or create a project',
        '3. Enable the following APIs:',
        '   • Admin SDK API',
        '   • Gmail API',
        '   • Google Drive API',
        '   • Calendar API',
        '   • Contacts API',
        '',
        '**Step 2: Create Service Account**',
        '1. Navigate to "IAM & Admin" → "Service Accounts"',
        '2. Click "Create Service Account"',
        '3. Name: "gws-migration-service"',
        '4. Enable "Google Workspace Domain-wide Delegation"',
        '5. Download the JSON key file',
        '',
        '**Step 3: Configure Admin Console**',
        '1. Go to https://admin.google.com',
        '2. Navigate to Security → API Controls → Domain-wide Delegation',
        '3. Add the Service Account Client ID',
        '4. Add the required OAuth scopes (see below)',
        '',
        '**Required OAuth Scopes:**'
      ]
    }
  }

  const allStepsCompleted = Object.keys(steps).every(stepId => completedSteps[stepId])
  const completedCount = Object.values(completedSteps).filter(Boolean).length
  const totalSteps = Object.keys(steps).length

  const renderDomainStatus = (domain: 'source' | 'dest', label: string) => {
    const status = delegationStatus?.[domain]
    if (!status) return null

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
            {label}
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
            <h2 className="text-xl font-semibold text-gray-900">
              Domain-wide Delegation Setup
            </h2>
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
        {/* Account Information */}
        {(sourceAccount || destAccount) && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-3 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Migration Accounts
            </h3>
            <div className="space-y-4 text-sm">
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

        {/* Automated Setup Section */}
        {sourceAccount && destAccount && (
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
                  Generate service accounts and get personalized setup instructions for both domains.
                </p>
              </div>
            </div>
            
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
              <div className="grid md:grid-cols-2 gap-4">
                {renderDomainStatus('source', 'Source Domain')}
                {renderDomainStatus('dest', 'Destination Domain')}
              </div>
            )}
          </div>
        )}

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
                        onClick={() => copyToClipboard(delegationSetupData.setupInstructions!.source.clientId, 'source-client-id')}
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
                        onClick={() => copyToClipboard(delegationSetupData.setupInstructions!.destination.clientId, 'dest-client-id')}
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
                        
                        return (
                          <div key={index} className="mt-1">
                            {line}
                          </div>
                        )
                      })}
                    </div>

                    {stepId === 'manual-setup' && (
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
                <h4 className="font-medium text-green-800">Domain-wide Delegation Setup Complete!</h4>
                <p className="text-green-700 text-sm mt-1">
                  Both domains should now be configured for secure cross-domain migration.
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
