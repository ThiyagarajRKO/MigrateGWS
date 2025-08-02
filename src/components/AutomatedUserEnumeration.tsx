'use client'

import React, { useState } from 'react'
import { Users, Download, Settings, AlertCircle, CheckCircle } from 'lucide-react'
import { useUserEnumeration } from '@/hooks/useUserEnumeration'
import { GWSUser } from '@/types'

interface AutomatedUserEnumerationProps {
  domain: string
  adminEmail: string
  onUsersEnumerated?: (users: GWSUser[]) => void
}

export default function AutomatedUserEnumeration({
  domain,
  adminEmail,
  onUsersEnumerated
}: AutomatedUserEnumerationProps) {
  const {
    enumerateUsers,
    enumerateUsersInBatches,
    loading,
    error,
    progress,
    currentBatch,
    reset
  } = useUserEnumeration()

  const [enumeratedUsers, setEnumeratedUsers] = useState<GWSUser[]>([])
  const [options, setOptions] = useState({
    includeSuspended: false,
    includeArchived: false,
    orgUnitPath: ''
  })
  const [automationMode, setAutomationMode] = useState<'all' | 'batches'>('all')

  const handleStartEnumeration = async () => {
    reset()
    setEnumeratedUsers([])

    if (automationMode === 'all') {
      const result = await enumerateUsers({
        domain,
        adminEmail,
        ...options,
        orgUnitPath: options.orgUnitPath || undefined
      }, (users, totalFetched) => {
        console.log(`Progress: ${totalFetched} users enumerated`)
      })

      if (result) {
        setEnumeratedUsers(result.users)
        onUsersEnumerated?.(result.users)
      }
    } else {
      const result = await enumerateUsersInBatches({
        domain,
        adminEmail,
        ...options,
        orgUnitPath: options.orgUnitPath || undefined
      }, 100, (batch, batchNumber, totalFetched) => {
        console.log(`Batch ${batchNumber}: ${batch.length} users, Total: ${totalFetched}`)
        setEnumeratedUsers(prev => [...prev, ...batch])
      })

      if (result) {
        onUsersEnumerated?.(result.users)
      }
    }
  }

  const exportUsers = () => {
    const csvContent = [
      'Email,Name,Admin,Suspended,OrgUnit,Creation Time',
      ...enumeratedUsers.map(user => 
        `${user.primaryEmail},"${user.name.fullName}",${user.isAdmin},${user.suspended},"${user.orgUnitPath}","${user.creationTime}"`
      )
    ].join('\\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${domain}-users-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="bg-white rounded-lg border p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Users className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            Automated User Enumeration
          </h3>
        </div>
        <div className="text-sm text-gray-500">
          Domain: {domain}
        </div>
      </div>

      {/* Configuration Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Settings className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Enumeration Options</span>
          </div>
          
          <div className="space-y-3">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={options.includeSuspended}
                onChange={(e) => setOptions(prev => ({ ...prev, includeSuspended: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Include suspended users</span>
            </label>
            
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={options.includeArchived}
                onChange={(e) => setOptions(prev => ({ ...prev, includeArchived: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Include archived users</span>
            </label>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Organization Unit Path (optional)
              </label>
              <input
                type="text"
                value={options.orgUnitPath}
                onChange={(e) => setOptions(prev => ({ ...prev, orgUnitPath: e.target.value }))}
                placeholder="/Sales, /Engineering, etc."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">Automation Mode</span>
          </div>
          
          <div className="space-y-2">
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                name="automationMode"
                value="all"
                checked={automationMode === 'all'}
                onChange={(e) => setAutomationMode(e.target.value as 'all' | 'batches')}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Enumerate all users at once</span>
            </label>
            
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                name="automationMode"
                value="batches"
                checked={automationMode === 'batches'}
                onChange={(e) => setAutomationMode(e.target.value as 'all' | 'batches')}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Process in batches (100 users/batch)</span>
            </label>
          </div>
        </div>
      </div>

      {/* Progress and Actions */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button
            onClick={handleStartEnumeration}
            disabled={loading}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              loading
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {loading ? 'Enumerating...' : 'Start User Enumeration'}
          </button>

          {enumeratedUsers.length > 0 && (
            <button
              onClick={exportUsers}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              <Download className="h-4 w-4" />
              <span>Export CSV ({enumeratedUsers.length} users)</span>
            </button>
          )}
        </div>

        {loading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>Progress: {progress}%</span>
              {currentBatch > 0 && <span>Batch: {currentBatch}</span>}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex items-start space-x-2">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-red-800">{error.error}</h4>
              <p className="text-sm text-red-700">{error.message}</p>
              {error.details && (
                <ul className="text-sm text-red-700 list-disc list-inside space-y-1">
                  {error.details.map((detail, index) => (
                    <li key={index}>{detail}</li>
                  ))}
                </ul>
              )}
              {error.actionRequired && (
                <div className="bg-red-100 rounded p-2 mt-2">
                  <p className="text-sm font-medium text-red-800">{error.actionRequired}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Results Summary */}
      {enumeratedUsers.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <div className="flex items-start space-x-2">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-green-800">
                Successfully enumerated {enumeratedUsers.length} users
              </h4>
              <div className="text-sm text-green-700 space-y-1">
                <p>Active users: {enumeratedUsers.filter(u => !u.suspended).length}</p>
                <p>Admin users: {enumeratedUsers.filter(u => u.isAdmin).length}</p>
                <p>Suspended users: {enumeratedUsers.filter(u => u.suspended).length}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick User List */}
      {enumeratedUsers.length > 0 && enumeratedUsers.length <= 10 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Enumerated Users:</h4>
          <div className="bg-gray-50 rounded-md p-3 max-h-40 overflow-y-auto">
            {enumeratedUsers.map((user, index) => (
              <div key={user.id} className="text-sm text-gray-600 py-1">
                {index + 1}. {user.primaryEmail} ({user.name.fullName})
                {user.isAdmin && <span className="ml-2 text-blue-600 font-medium">Admin</span>}
                {user.suspended && <span className="ml-2 text-red-600 font-medium">Suspended</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
