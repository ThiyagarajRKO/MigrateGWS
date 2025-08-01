'use client'

import React, { useState } from 'react'
import { Copy, CheckCircle, AlertCircle, ExternalLink, ChevronDown, ChevronRight, Shield, Clock, Settings, Key, ArrowRight, Users } from 'lucide-react'
import DomainWideDelegationSetup from './DomainWideDelegationSetup'

interface ServiceAccountSetupProps {
  sourceAccount?: string
  destAccount?: string
  onComplete?: () => void
  className?: string
}

interface StepBase {
  title: string
  description: string
  details: string[]
  estimatedTime?: string
}

interface StepWithUrl extends StepBase {
  action: string
  url: string
}

interface StepWithCopy extends StepBase {
  copyText: string
  copyLabel: string
}

type Step = StepBase | StepWithUrl | StepWithCopy

const hasUrl = (step: Step): step is StepWithUrl => 'url' in step
const hasCopy = (step: Step): step is StepWithCopy => 'copyText' in step

export default function ServiceAccountSetup({ 
  sourceAccount, 
  destAccount, 
  onComplete, 
  className = '' 
}: ServiceAccountSetupProps) {
  const [copiedStep, setCopiedStep] = useState<string | null>(null)
  const [expandedSteps, setExpandedSteps] = useState<{ [key: string]: boolean }>({
    '1': true // Expand Step 1 by default
  })
  const [completedSteps, setCompletedSteps] = useState<{ [key: string]: boolean }>({})
  const [showDWDSetup, setShowDWDSetup] = useState(false)
  const [delegationSetup, setDelegationSetup] = useState<any>(null)
  const [setupLoading, setSetupLoading] = useState(false)
  const [setupError, setSetupError] = useState<string | null>(null)

  // Service account client ID - will be fetched dynamically
  const serviceAccountClientId = delegationSetup?.source?.clientId || '114333598950671892438'
  
  // Required OAuth scopes for complete Google Workspace migration
  const requiredScopes = [
    'https://www.googleapis.com/auth/admin.directory.user',
    'https://www.googleapis.com/auth/admin.directory.group',
    'https://www.googleapis.com/auth/admin.directory.domain.readonly',
    'https://www.googleapis.com/auth/admin.directory.orgunit',
    'https://www.googleapis.com/auth/admin.directory.resource.calendar',
    'https://www.googleapis.com/auth/apps.groups.migration',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive.metadata',
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/drive.metadata.readonly',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.insert',
    'https://www.googleapis.com/auth/gmail.settings.basic',
    'https://www.googleapis.com/auth/gmail.settings.sharing',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/contacts',
    'https://www.googleapis.com/auth/contacts.readonly'
  ]

  // Function to generate delegation setup
  const generateDelegationSetup = async () => {
    if (!sourceAccount || !destAccount) {
      setSetupError('Source and destination admin emails are required')
      return
    }

    setSetupLoading(true)
    setSetupError(null)

    try {
      const response = await fetch('/api/v1/delegation/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceAdminEmail: sourceAccount,
          destAdminEmail: destAccount
        })
      })

      const data = await response.json()

      if (data.success) {
        setDelegationSetup(data)
        console.log('Delegation setup generated:', data)
      } else {
        setSetupError(data.error || 'Failed to generate delegation setup')
      }
    } catch (error) {
      console.error('Error generating delegation setup:', error)
      setSetupError('Failed to generate delegation setup')
    } finally {
      setSetupLoading(false)
    }
  }

  const steps: { [key: string]: Step } = {
    '1': {
      title: '🔧 Domain-Wide Delegation Setup Process',
      description: 'Complete guide for configuring domain-wide delegation for Google Workspace migration',
      estimatedTime: '10-15 minutes',
      details: [
        '� **Overview**',
        'This guide provides step-by-step instructions to configure domain-wide delegation for Google Workspace, enabling service accounts to impersonate users and access their Drive files.',
        '',
        '🎯 **Current Status**',
        delegationSetup ? '✅ **Setup instructions generated**' : '❌ **Setup instructions not generated yet**',
        delegationSetup ? '✅ **Client IDs available**' : '❌ **Client IDs not generated**',
        '✅ **Service account and scopes ready**',
        '',
        delegationSetup ? '' : '⚠️ **Important**: Click "Generate Setup Instructions" above to get your unique client IDs before proceeding.',
        '',
        '📊 **Configuration Details**',
        '',
        '**Service Account Information:**',
        delegationSetup?.source?.email ? `• **Email**: \`${delegationSetup.source.email}\`` : '• **Email**: `Will be generated when you click "Generate Setup Instructions"`',
        delegationSetup?.source?.clientId ? `• **Client ID**: \`${delegationSetup.source.clientId}\`` : '• **Client ID**: `Will be generated when you click "Generate Setup Instructions"`',
        delegationSetup?.source?.projectId ? `• **Project**: \`${delegationSetup.source.projectId}\`` : '• **Project**: `Will be generated when you click "Generate Setup Instructions"`',
        '',
        '**Domains to Configure:**',
        sourceAccount ? `1. **Source Domain**: \`${sourceAccount.split('@')[1]}\`` : '1. **Source Domain**: `Not specified`',
        sourceAccount ? `   • **Admin**: \`${sourceAccount}\`` : '   • **Admin**: `Not specified`',
        destAccount ? `2. **Destination Domain**: \`${destAccount.split('@')[1]}\`` : '2. **Destination Domain**: `Not specified`',
        destAccount ? `   • **Admin**: \`${destAccount}\`` : '   • **Admin**: `Not specified`',
        '',
        '**Setup Instructions**',
        '',
        '**Step 1: Access Google Admin Console**',
        '',
        '1. **Navigate to**: https://admin.google.com',
        '2. **Sign in** as the domain administrator:',
        '   • For `rrgokuldham.com`: Sign in as `admin@rrgokuldham.com`',
        '   • For `openplots.co.in`: Sign in as `info@openplots.co.in`',
        '',
        '**Step 2: Navigate to Domain-wide Delegation**',
        '',
        '1. In the Admin Console, go to:',
        '   ```',
        '   Security → API Controls → Domain-wide delegation',
        '   ```',
        '',
        '2. Click **"Manage Domain Wide Delegation"**',
        '',
        '**Step 3: Add Service Account Authorization**',
        '',
        '1. Click **"Add new"** or **"Add"**',
        '',
        '2. **Enter Client ID**: `114333598950671892438`',
        '',
        '3. **Enter OAuth Scopes** (see copyable section below)',
        '',
        '4. Click **"Authorize"**',
        '',
        '**Step 4: Verify Configuration**',
        '',
        '1. The service account should now appear in the list',
        '2. Verify the Client ID matches: `114333598950671892438`',
        '3. Verify scopes include Drive permissions',
        '',
        '✅ **Verification Process**',
        '',
        'After completing the setup, verify it works:',
        '',
        '**Expected Results After Setup:**',
        '• ✅ Authentication successful for test users',
        '• ✅ Drive files detected and accessible',
        '• ✅ Domain-wide delegation working',
        '',
        '🔧 **Troubleshooting**',
        '',
        '**Common Issues:**',
        '',
        '1. **"Request is missing required authentication credential"**',
        '   • **Cause**: Domain-wide delegation not configured',
        '   • **Solution**: Complete the setup steps above',
        '',
        '2. **"unauthorized_client"**',
        '   • **Cause**: Service account not authorized',
        '   • **Solution**: Verify Client ID and scopes are correct',
        '',
        '3. **"access_denied"**',
        '   • **Cause**: Insufficient permissions or wrong scopes',
        '   • **Solution**: Check scopes match exactly',
        '',
        '📋 **Scope Details**',
        '',
        '**Required Scopes for Drive Migration:**',
        '• `https://www.googleapis.com/auth/drive` - Full Drive access',
        '• `https://www.googleapis.com/auth/drive.readonly` - Read-only access',
        '• `https://www.googleapis.com/auth/drive.metadata.readonly` - Metadata access',
        '',
        '**Additional Scopes for Complete Migration:**',
        '• Gmail scopes for email migration',
        '• Calendar scopes for calendar migration',
        '• Contacts scopes for contact migration',
        '• Admin Directory scopes for user management',
        '',
        '🚨 **Important Notes**',
        '',
        '1. **Domain Admin Required**: Only domain administrators can configure delegation',
        '2. **Security Implications**: Domain-wide delegation grants broad access',
        '3. **Propagation Time**: Changes may take a few minutes to propagate',
        '4. **Both Domains**: Configure for both source and destination domains',
        '',
        '🔄 **Alternative: OAuth2 Approach**',
        '',
        'If domain-wide delegation cannot be configured, use OAuth2 migration:',
        '',
        '**Benefits:**',
        '• ✅ No admin configuration required',
        '• ✅ Works immediately',
        '• ✅ Same authentication as Gmail migration',
        '',
        '**Required OAuth Scopes for Complete Migration:**'
      ]
    } as StepBase,
    '2': {
      title: 'Access Google Admin Console',
      description: 'Open the Google Admin Console with your super admin account',
      action: 'Open Admin Console',
      url: 'https://admin.google.com',
      estimatedTime: '1 minute',
      details: [
        'Log in to admin.google.com with your Google Workspace super admin account',
        'You must be a super admin to configure domain-wide delegation',
        'If you don\'t see the Security section, you may not have admin privileges',
        'Ensure your account has "Security" management permissions'
      ]
    } as StepWithUrl,
    '3': {
      title: 'Navigate to Domain-wide Delegation',
      description: 'Go to Security > API Controls > Domain-wide Delegation',
      estimatedTime: '30 seconds',
      details: [
        'In the Admin Console, click on "Security" in the left sidebar',
        'Click on "API Controls"',
        'Click on "Domain-wide Delegation"',
        'You should see a list of authorized clients (may be empty initially)',
        'This page shows all applications that have domain-wide access'
      ]
    } as StepBase,
    '4': {
      title: 'Add Service Account Client ID',
      description: 'Add the service account client ID for domain-wide delegation',
      copyText: serviceAccountClientId,
      copyLabel: 'Service Account Client ID',
      estimatedTime: '1 minute',
      details: [
        'Click the "Add new" button in the Domain-wide Delegation page',
        `In the "Client ID" field, paste the service account client ID: **${serviceAccountClientId}**`,
        'This client ID identifies our migration service to Google',
        'The Client ID is the unique identifier from your service account',
        'Make sure to copy the entire ID without any extra spaces',
        '',
        '**Service Account Details:**',
        delegationSetup?.source?.email ? `• **Email**: \`${delegationSetup.source.email}\`` : '• **Email**: `gws-permission@gws-migration-463208.iam.gserviceaccount.com`',
        `• **Client ID**: \`${serviceAccountClientId}\``,
        delegationSetup?.source?.projectId ? `• **Project**: \`${delegationSetup.source.projectId}\`` : '• **Project**: `gws-migration-463208`'
      ]
    } as StepWithCopy,
    '5': {
      title: 'Configure Comprehensive OAuth Scopes',
      description: 'Add all required OAuth scopes for complete Google Workspace migration',
      copyText: requiredScopes.join(','),
      copyLabel: 'Complete OAuth Scopes (comma-separated)',
      estimatedTime: '2 minutes',
      details: [
        'In the "OAuth scopes" field, paste the comprehensive scopes provided below',
        'These scopes define what our service can access in your Google Workspace',
        '',
        '**Complete migration functionality includes:**',
        '• **Admin Directory**: User, group, and domain management',
        '• **Gmail**: Email migration (read, modify, insert, settings)',
        '• **Drive**: Complete file and folder migration with metadata',
        '• **Calendar**: Calendar event migration and management',
        '• **Contacts**: Contact list migration',
        '• **Groups**: Group migration support',
        '',
        '**Drive-Specific Scopes:**',
        '• `https://www.googleapis.com/auth/drive` - Full Drive access',
        '• `https://www.googleapis.com/auth/drive.readonly` - Read-only access',
        '• `https://www.googleapis.com/auth/drive.metadata.readonly` - Metadata access',
        '• `https://www.googleapis.com/auth/drive.file` - File creation access',
        '',
        '**Important**: Use the exact scope URLs - do not modify them',
        '**Copy and paste** the complete comma-separated list from below'
      ]
    } as StepWithCopy,
    '6': {
      title: 'Authorize and Verify Setup',
      description: 'Complete the configuration and verify domain-wide delegation is working',
      estimatedTime: '3-5 minutes',
      details: [
        'Click "Authorize" to save the domain-wide delegation',
        'The client should now appear in your authorized clients list',
        'Verify the status shows as "Active" or "Authorized"',
        '',
        '✅ **Verification Checklist:**',
        '• Service account appears in delegation list',
        `• Client ID matches: \`${serviceAccountClientId}\``,
        '• All OAuth scopes are correctly configured',
        '• Status shows as "Active"/"Authorized"',
        '',
        '🔧 **Testing the Configuration:**',
        'Our migration service can now access your Google Workspace data',
        'You can test the connection using the migration platform\'s validation tool',
        '',
        '**Expected Results After Setup:**',
        '• ✅ Authentication successful for test users',
        '• ✅ Drive files detected and accessible',
        '• ✅ Domain-wide delegation working',
        '',
        '⚠️ **Troubleshooting Common Issues:**',
        '',
        '**"Request is missing required authentication credential"**',
        '• Cause: Domain-wide delegation not configured',
        '• Solution: Verify all steps completed correctly',
        '',
        '**"unauthorized_client"**',
        '• Cause: Service account not authorized or wrong Client ID',
        `• Solution: Check Client ID is exactly \`${serviceAccountClientId}\``,
        '',
        '**"access_denied"**',
        '• Cause: Insufficient permissions or missing scopes',
        '• Solution: Verify all OAuth scopes are included',
        '',
        '🚨 **Important Security Notes:**',
        '• You can revoke this access at any time from the same page',
        '• Domain-wide delegation grants broad access - use responsibly',
        '• All API calls are logged and auditable',
        '• Changes may take a few minutes to propagate',
        '',
        '🔄 **Configure Both Domains:**',
        'Repeat this process for both source and destination domains:',
        sourceAccount ? `• Source: \`${sourceAccount.split('@')[1]}\` (${sourceAccount})` : '• Source: Not specified',
        destAccount ? `• Destination: \`${destAccount.split('@')[1]}\` (${destAccount})` : '• Destination: Not specified'
      ]
    } as StepBase
  }

  const copyToClipboard = (text: string, stepId: string) => {
    navigator.clipboard.writeText(text)
    setCopiedStep(stepId)
    setTimeout(() => setCopiedStep(null), 2000)
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

  const allStepsCompleted = Object.keys(steps).every(stepId => completedSteps[stepId])
  const completedCount = Object.values(completedSteps).filter(Boolean).length
  const totalSteps = Object.keys(steps).length

  return (
    <div className={`bg-white rounded-lg border border-gray-200 shadow-sm ${className}`}>
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Shield className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">
              Service Account Domain-wide Delegation Setup
            </h3>
            <p className="text-gray-600 mt-1">
              One-time setup required for Google Workspace migration access
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">Progress</div>
            <div className="text-lg font-semibold text-blue-600">
              {completedCount}/{totalSteps}
            </div>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(completedCount / totalSteps) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Generate Setup Button */}
        {!delegationSetup && (sourceAccount && destAccount) && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <Settings className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-medium text-blue-800">Generate Delegation Setup</h4>
                <p className="text-blue-700 text-sm mt-1">
                  Click below to generate unique service account client IDs and setup instructions for your domains.
                </p>
                <button
                  onClick={generateDelegationSetup}
                  disabled={setupLoading}
                  className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {setupLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Key className="w-4 h-4" />
                      Generate Setup Instructions
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Setup Error */}
        {setupError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-red-800">Setup Error</h4>
                <p className="text-red-700 text-sm mt-1">{setupError}</p>
              </div>
            </div>
          </div>
        )}

        {/* Success Message */}
        {delegationSetup && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-green-800">Setup Instructions Generated</h4>
                <p className="text-green-700 text-sm mt-1">
                  Unique client IDs have been generated for your domains. Follow the steps below to complete the setup.
                </p>
                <div className="mt-2 text-sm text-green-600">
                  <div>• Source Domain: {delegationSetup.source?.domain} (Client ID: {delegationSetup.source?.clientId})</div>
                  <div>• Destination Domain: {delegationSetup.destination?.domain} (Client ID: {delegationSetup.destination?.clientId})</div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-amber-800">Important Security Notice</h4>
              <p className="text-amber-700 text-sm mt-1">
                This setup grants our service account access to your Google Workspace data. 
                Only proceed if you trust this migration service. You can revoke access at any time.
              </p>
            </div>
          </div>
        </div>

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
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        <span className="text-sm font-bold">{stepId}</span>
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
                    {hasUrl(step) && (
                      <a
                        href={step.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
                      >
                        {step.action}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    
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
                      {step.details.map((detail, index) => {
                        // Handle empty lines for spacing
                        if (detail === '') {
                          return <div key={index} className="h-2" />
                        }
                        
                        // Handle bold headers
                        if (detail.startsWith('**') && detail.endsWith('**')) {
                          return (
                            <h5 key={index} className="font-semibold text-gray-800 mt-3 mb-1">
                              {detail.slice(2, -2)}
                            </h5>
                          )
                        }
                        
                        // Handle numbered steps
                        if (detail.match(/^\d+\.\s/)) {
                          return (
                            <div key={index} className="font-medium text-gray-800 mt-2 mb-1">
                              {detail}
                            </div>
                          )
                        }
                        
                        // Handle indented items
                        if (detail.startsWith('   •') || detail.startsWith('   ')) {
                          return (
                            <div key={index} className="ml-4 text-sm text-gray-600">
                              {detail}
                            </div>
                          )
                        }
                        
                        // Handle bullet points
                        if (detail.startsWith('•')) {
                          return (
                            <div key={index} className="flex items-start gap-2 mt-1">
                              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mt-2 flex-shrink-0" />
                              <span>{detail.slice(1).trim()}</span>
                            </div>
                          )
                        }
                        
                        // Handle emoji bullets
                        if (/^[🔐📋🔧]/.test(detail)) {
                          return (
                            <div key={index} className="flex items-start gap-2 mt-1">
                              <span className="mt-0.5">{detail.slice(0, 2)}</span>
                              <span>{detail.slice(2).trim()}</span>
                            </div>
                          )
                        }
                        
                        // Regular text
                        return (
                          <div key={index} className="mt-1">
                            {detail}
                          </div>
                        )
                      })}
                    </div>

                    {hasCopy(step) && (
                      <div className="mt-4 p-3 bg-gray-50 rounded border">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                            <Key className="w-4 h-4" />
                            {step.copyLabel}
                          </span>
                          <button
                            onClick={() => copyToClipboard(step.copyText!, `${stepId}-copy`)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                          >
                            {copiedStep === `${stepId}-copy` ? (
                              <>
                                <CheckCircle className="w-3 h-3" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                Copy
                              </>
                            )}
                          </button>
                        </div>
                        <code className="text-xs font-mono text-gray-800 break-all block bg-white p-2 rounded border">
                          {step.copyText}
                        </code>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {allStepsCompleted && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <h4 className="font-medium text-green-800">Setup Complete!</h4>
                <p className="text-green-700 text-sm mt-1">
                  Domain-wide delegation has been configured. You can now proceed with the migration setup.
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-3">
              {onComplete && (
                <button
                  onClick={onComplete}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                  Continue to Migration Setup
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
              {(sourceAccount || destAccount) && (
                <button
                  onClick={() => setShowDWDSetup(!showDWDSetup)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Users className="w-4 h-4" />
                  {showDWDSetup ? 'Hide' : 'Show'} Advanced DWD Setup
                </button>
              )}
            </div>
          </div>
        )}

        {/* Advanced Domain-wide Delegation Setup */}
        {showDWDSetup && (sourceAccount || destAccount) && (
          <div className="mt-6">
            <DomainWideDelegationSetup
              sourceAccount={sourceAccount}
              destAccount={destAccount}
              onComplete={onComplete}
            />
          </div>
        )}
      </div>
    </div>
  )
}
