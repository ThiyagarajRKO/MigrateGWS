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

  // Service account client ID - this should be replaced with your actual service account
  const serviceAccountClientId = process.env.NEXT_PUBLIC_SERVICE_ACCOUNT_CLIENT_ID || 'your-service-account-client-id@your-project.iam.gserviceaccount.com'
  
  // Required OAuth scopes for complete Google Workspace migration
  const requiredScopes = [
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

  const steps: { [key: string]: Step } = {
    '1': {
      title: 'OAuth & Scopes - Domain-Wide Delegation Setup',
      description: 'Authenticate as Super Admin with domain-wide delegation',
      estimatedTime: '2-3 minutes',
      details: [
        '🔐 **Authentication Approach**: Use domain-wide delegation for automated access',
        '📋 **Admin SDK + OAuth2**: Configure required scopes for comprehensive migration',
        '🔧 **APIs Used**: Admin SDK, Drive API, Gmail API, Calendar API',
        '',
        '**Step-by-Step Instructions:**',
        '',
        '1. **Access Google Cloud Console**:',
        '   • Go to https://console.cloud.google.com',
        '   • Select your project or create a new one',
        '   • Enable the required APIs (Admin SDK, Gmail, Drive, Calendar)',
        '',
        '2. **Create Service Account**:',
        '   • Navigate to "IAM & Admin" → "Service Accounts"',
        '   • Click "Create Service Account"',
        '   • Name: "gws-migration-service"',
        '   • Description: "Service account for Google Workspace migration"',
        '   • Click "Create and Continue"',
        '',
        '3. **Configure Service Account**:',
        '   • Skip role assignment (we\'ll use domain-wide delegation)',
        '   • Click "Done" to create the service account',
        '   • Click on the created service account',
        '   • Go to "Keys" tab → "Add Key" → "Create new key"',
        '   • Select "JSON" and download the key file',
        '',
        '4. **Enable Domain-Wide Delegation**:',
        '   • In the service account details, click "Advanced settings"',
        '   • Check "Enable Google Workspace Domain-wide Delegation"',
        '   • Product name: "GWS Migration Platform"',
        '   • Save the changes',
        '   • **Copy the Client ID** (you\'ll need this for the next step)',
        '',
        '5. **Configure Google Admin Console**:',
        '   • Go to https://admin.google.com',
        '   • Navigate to Security → API Controls → Domain-wide Delegation',
        '   • Click "Add new"',
        '   • Paste the Service Account Client ID from step 4',
        '   • Add the OAuth scopes (copy from below)',
        '   • Click "Authorize"',
        '',
        '**Important Security Notes:**',
        '• Only Super Admins can configure domain-wide delegation',
        '• This grants programmatic access to all user data in your domain',
        '• Access can be revoked at any time from the Admin Console',
        '• All API calls are logged and auditable',
        '',
        '**Required OAuth Scopes** (copy all):'
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
      title: 'Add New Client Authorization',
      description: 'Click "Add new" to authorize our service account',
      copyText: serviceAccountClientId,
      copyLabel: 'Service Account Client ID',
      estimatedTime: '1 minute',
      details: [
        'Click the "Add new" button in the Domain-wide Delegation page',
        'In the "Client ID" field, paste the service account client ID provided below',
        'This client ID identifies our migration service to Google',
        'The Client ID is the unique identifier from your service account',
        'Make sure to copy the entire ID without any extra spaces'
      ]
    } as StepWithCopy,
    '5': {
      title: 'Configure OAuth Scopes',
      description: 'Add the required OAuth scopes for migration services',
      copyText: requiredScopes.join(','),
      copyLabel: 'OAuth Scopes (comma-separated)',
      estimatedTime: '1 minute',
      details: [
        'In the "OAuth scopes" field, paste the scopes provided below',
        'These scopes define what our service can access in your Google Workspace',
        'All scopes are necessary for complete data migration functionality:',
        '• Admin Directory: User and domain management',
        '• Gmail: Email migration (read and modify)',
        '• Drive: File and folder migration',
        '• Calendar: Calendar event migration',
        '• Contacts: Contact list migration',
        'Use the exact scope URLs - do not modify them'
      ]
    } as StepWithCopy,
    '6': {
      title: 'Authorize and Verify',
      description: 'Save the configuration and verify the setup',
      estimatedTime: '1 minute',
      details: [
        'Click "Authorize" to save the domain-wide delegation',
        'The client should now appear in your authorized clients list',
        'Verify the status shows as "Active" or "Authorized"',
        'Our migration service can now access your Google Workspace data',
        'You can revoke this access at any time from the same page',
        'Test the connection using the migration platform\'s validation tool'
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
