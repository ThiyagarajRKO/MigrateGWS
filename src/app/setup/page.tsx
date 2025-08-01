'use client'

import React, { useState } from 'react'
import { ChevronRight, Shield, Settings, CheckCircle, Users, Database, ArrowRight, Info, AlertTriangle } from 'lucide-react'
import ServiceAccountSetup from '../../components/ServiceAccountSetup'
import DomainWideDelegationSetup from '../../components/DomainWideDelegationSetup'

type SetupPhase = 'overview' | 'delegation' | 'advanced' | 'complete'

export default function SetupPage() {
  const [currentPhase, setCurrentPhase] = useState<SetupPhase>('overview')
  const [sourceAccount, setSourceAccount] = useState('')
  const [destAccount, setDestAccount] = useState('')

  const handlePhaseComplete = () => {
    switch (currentPhase) {
      case 'overview':
        setCurrentPhase('delegation')
        break
      case 'delegation':
        setCurrentPhase('advanced')
        break
      case 'advanced':
        setCurrentPhase('complete')
        break
    }
  }

  const handleDelegationComplete = () => {
    setCurrentPhase('complete')
  }

  const handleContinueToMigration = () => {
    window.location.href = '/migrations/new'
  }

  const renderPhaseContent = () => {
    switch (currentPhase) {
      case 'overview':
        return (
          <div className="space-y-8">
            {/* Header */}
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl">
                  <Shield className="h-10 w-10 text-blue-600" />
                </div>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                Google Workspace Migration Setup
              </h1>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Configure secure access for your Google Workspace to Google Workspace migration
              </p>
            </div>

            {/* Account Input */}
            <div className="max-w-2xl mx-auto bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                Migration Account Configuration
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Source Domain Admin Email (Optional)
                  </label>
                  <input
                    type="email"
                    value={sourceAccount}
                    onChange={(e) => setSourceAccount(e.target.value)}
                    placeholder="admin@source-company.com"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Super admin email for the source Google Workspace domain
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Destination Domain Admin Email (Optional)
                  </label>
                  <input
                    type="email"
                    value={destAccount}
                    onChange={(e) => setDestAccount(e.target.value)}
                    placeholder="admin@destination-company.com"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Super admin email for the destination Google Workspace domain
                  </p>
                </div>
              </div>

              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-medium text-blue-800">Optional Configuration</h3>
                    <p className="text-sm text-blue-700 mt-1">
                      Providing admin emails enables automated setup instructions. You can also configure manually using the step-by-step guide.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Setup Overview */}
            <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Shield className="h-5 w-5 text-blue-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">Security Setup</h3>
                </div>
                <p className="text-gray-600 text-sm">
                  Configure domain-wide delegation and service accounts for secure access to both Google Workspace environments.
                </p>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Database className="h-5 w-5 text-green-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">Data Access</h3>
                </div>
                <p className="text-gray-600 text-sm">
                  Enable comprehensive access to Gmail, Drive, Calendar, Contacts, and other Google Workspace services.
                </p>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Settings className="h-5 w-5 text-purple-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">Migration Ready</h3>
                </div>
                <p className="text-gray-600 text-sm">
                  Verify configuration and begin your secure, automated Google Workspace migration process.
                </p>
              </div>
            </div>

            {/* Continue Button */}
            <div className="text-center">
              <button
                onClick={handlePhaseComplete}
                className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-lg hover:shadow-xl flex items-center gap-2 mx-auto"
              >
                Continue to Setup
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )

      case 'delegation':
        return (
          <div className="space-y-8">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                Domain-wide Delegation Configuration
              </h1>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Set up secure access permissions for both domains
              </p>
            </div>

            <div className="max-w-6xl mx-auto">
              <DomainWideDelegationSetup
                sourceAccount={sourceAccount}
                destAccount={destAccount}
                onComplete={handlePhaseComplete}
              />
            </div>
          </div>
        )

      case 'advanced':
        return (
          <div className="space-y-8">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                Advanced Configuration
              </h1>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Complete the service account setup process
              </p>
            </div>

            <div className="max-w-4xl mx-auto">
              <ServiceAccountSetup
                sourceAccount={sourceAccount}
                destAccount={destAccount}
                onComplete={handlePhaseComplete}
              />
            </div>
          </div>
        )

      case 'complete':
        return (
          <div className="space-y-8">
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl">
                  <CheckCircle className="h-10 w-10 text-green-600" />
                </div>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                Setup Complete!
              </h1>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Your Google Workspace migration platform is now configured and ready to use.
              </p>
            </div>

            <div className="max-w-2xl mx-auto bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Next Steps</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-blue-600">1</span>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">Create Migration Project</h3>
                    <p className="text-sm text-gray-600">Start a new migration project and configure your migration settings.</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-blue-600">2</span>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">Test Connection</h3>
                    <p className="text-sm text-gray-600">Verify that both domains are accessible and ready for migration.</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-blue-600">3</span>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">Begin Migration</h3>
                    <p className="text-sm text-gray-600">Start your secure, automated Google Workspace migration process.</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <a
                  href="/dashboard"
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-center font-medium"
                >
                  Go to Dashboard
                </a>
                <a
                  href="/migrations/new"
                  className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-center font-medium"
                >
                  Create Migration
                </a>
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Phase Progress */}
        <div className="mb-12">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between relative">
              {/* Progress Line */}
              <div className="absolute top-6 left-0 right-0 h-0.5 bg-gray-200">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-500"
                  style={{ width: `${(['overview', 'delegation', 'advanced', 'complete'].indexOf(currentPhase) / 3) * 100}%` }}
                />
              </div>
              
              {/* Phase Steps */}
              {[
                { key: 'overview', title: 'Overview', icon: Info },
                { key: 'delegation', title: 'Delegation', icon: Shield },
                { key: 'advanced', title: 'Advanced', icon: Settings },
                { key: 'complete', title: 'Complete', icon: CheckCircle }
              ].map(({ key, title, icon: Icon }, index) => {
                const isActive = key === currentPhase
                const isCompleted = ['overview', 'delegation', 'advanced', 'complete'].indexOf(currentPhase) > index
                
                return (
                  <div key={key} className="relative flex flex-col items-center">
                    <div className={`relative z-10 flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all duration-300 ${
                      isCompleted 
                        ? 'bg-gradient-to-r from-blue-500 to-indigo-600 border-blue-500 text-white shadow-lg' 
                        : isActive
                        ? 'bg-white border-blue-500 text-blue-600 shadow-lg ring-4 ring-blue-100'
                        : 'bg-white border-gray-300 text-gray-400'
                    }`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    
                    <div className="mt-3 text-center">
                      <div className={`text-sm font-semibold ${
                        isActive ? 'text-blue-600' : isCompleted ? 'text-gray-900' : 'text-gray-500'
                      }`}>
                        {title}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Phase Content */}
        {renderPhaseContent()}
      </div>
    </div>
  )
}
