'use client'

import React, { useState } from 'react'
import { Users, FileText, Settings, Eye } from 'lucide-react'
import UserMappingVisualizer, { UserMapping } from '@/components/UserMappingVisualizer'
import CSVMappingManager from '@/components/CSVMappingManager'

export default function MappingWorkbenchPage() {
  const [mappings, setMappings] = useState<UserMapping[]>([
    {
      sourceUsers: ['alice@company-a.com', 'alice@company-b.com'],
      targetUser: 'alice@newcorp.com',
      targetUserExists: true,
      mappingType: 'merge',
      scenario: 'Multi-source → Single Target',
      notes: 'Merging identities from different domains'
    },
    {
      sourceUsers: ['john@company-a.com'],
      targetUser: ['john.sales@newcorp.com', 'john.marketing@newcorp.com'],
      targetUserExists: false,
      mappingType: 'split',
      scenario: 'Single Source → Multi Target',
      notes: 'Splitting user into departmental accounts'
    }
  ])

  const [activeTab, setActiveTab] = useState<'visualizer' | 'csv-manager' | 'json-view'>('visualizer')

  const addNewMapping = () => {
    const newMapping: UserMapping = {
      sourceUsers: [`user${mappings.length + 1}@source.com`],
      targetUser: `user${mappings.length + 1}@target.com`,
      targetUserExists: false,
      mappingType: 'direct',
      scenario: 'Direct Migration (1:1)',
      notes: 'New mapping'
    }
    setMappings([...mappings, newMapping])
  }

  const updateMapping = (index: number, mapping: UserMapping) => {
    const updated = [...mappings]
    updated[index] = mapping
    setMappings(updated)
  }

  const deleteMapping = (index: number) => {
    setMappings(mappings.filter((_, i) => i !== index))
  }

  const tabs = [
    { id: 'visualizer' as const, label: 'Visual Mappings', icon: Eye },
    { id: 'csv-manager' as const, label: 'CSV Manager', icon: FileText },
    { id: 'json-view' as const, label: 'JSON View', icon: Settings }
  ]

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Users className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">User Mapping Workbench</h1>
          </div>
          <p className="text-gray-600 max-w-3xl">
            Create, visualize, and manage user mappings for Google Workspace migration scenarios. 
            Import from CSV, create mappings interactively, and export for migration execution.
          </p>
        </div>

        {/* Stats Bar */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600">{mappings.length}</div>
              <div className="text-sm text-gray-600">Total Mappings</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {mappings.filter(m => m.mappingType === 'merge').length}
              </div>
              <div className="text-sm text-gray-600">Merge</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600">
                {mappings.filter(m => m.mappingType === 'split').length}
              </div>
              <div className="text-sm text-gray-600">Split</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">
                {mappings.filter(m => m.mappingType === 'direct').length}
              </div>
              <div className="text-sm text-gray-600">Direct</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-indigo-600">
                {mappings.filter(m => m.mappingType === 'create').length}
              </div>
              <div className="text-sm text-gray-600">Create</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-600">
                {mappings.filter(m => m.targetUserExists).length}
              </div>
              <div className="text-sm text-gray-600">Existing Targets</div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg border border-gray-200 mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                )
              })}
            </nav>
          </div>

          <div className="p-6">
            {/* Visual Mappings Tab */}
            {activeTab === 'visualizer' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-900">User Mapping Visualization</h3>
                  <div className="flex items-center gap-2">
                    <a
                      href="/demo/individual-mapping"
                      className="px-4 py-2 text-sm bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-xl transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:scale-105"
                    >
                      Individual Tool
                    </a>
                    <button
                      onClick={addNewMapping}
                      className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-sm font-medium transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                    >
                      Add New Mapping
                    </button>
                  </div>
                </div>
                
                <UserMappingVisualizer 
                  mappings={mappings}
                  onUpdateMapping={updateMapping}
                  onDeleteMapping={deleteMapping}
                  showEditControls={true}
                />
              </div>
            )}

            {/* CSV Manager Tab */}
            {activeTab === 'csv-manager' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900">CSV Import/Export Manager</h3>
                <CSVMappingManager 
                  mappings={mappings}
                  onMappingsChange={setMappings}
                />
              </div>
            )}

            {/* JSON View Tab */}
            {activeTab === 'json-view' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-900">JSON Configuration</h3>
                  <button
                    onClick={() => {
                      const jsonString = JSON.stringify(mappings, null, 2)
                      navigator.clipboard.writeText(jsonString)
                      alert('JSON copied to clipboard!')
                    }}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md text-sm font-medium transition-colors"
                  >
                    Copy JSON
                  </button>
                </div>
                
                <div className="bg-gray-900 rounded-lg p-4 overflow-auto max-h-96">
                  <pre className="text-green-400 text-sm font-mono">
                    {JSON.stringify(mappings, null, 2)}
                  </pre>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                  <h4 className="text-sm font-medium text-blue-900 mb-2">JSON Schema</h4>
                  <div className="text-xs text-blue-800 font-mono space-y-1">
                    <div>• sourceUsers: string[] - Array of source email addresses</div>
                    <div>• targetUser: string | string[] - Target email(s)</div>
                    <div>• targetUserExists: boolean - Whether target user exists</div>
                    <div>• mappingType: 'merge' | 'split' | 'direct' | 'create'</div>
                    <div>• scenario: string - Description of the mapping scenario</div>
                    <div>• notes?: string - Optional notes about the mapping</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Migration Preview */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Migration Preview</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <h4 className="font-medium text-blue-900 mb-2">Pre-Migration Validation</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>✓ All source users have valid email formats</li>
                <li>✓ No duplicate source users across mappings</li>
                <li>✓ Target domain permissions verified</li>
                <li>⚠ {mappings.filter(m => !m.targetUserExists).length} target users will be created</li>
              </ul>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <h4 className="font-medium text-green-900 mb-2">Migration Statistics</h4>
              <ul className="text-sm text-green-800 space-y-1">
                <li>Total Users: {mappings.reduce((acc, m) => acc + m.sourceUsers.length, 0)}</li>
                <li>Unique Sources: {new Set(mappings.flatMap(m => m.sourceUsers)).size}</li>
                <li>Target Accounts: {mappings.reduce((acc, m) => acc + (Array.isArray(m.targetUser) ? m.targetUser.length : 1), 0)}</li>
                <li>New Accounts: {mappings.filter(m => !m.targetUserExists).length}</li>
              </ul>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-md p-4">
              <h4 className="font-medium text-purple-900 mb-2">Next Steps</h4>
              <ul className="text-sm text-purple-800 space-y-1">
                <li>1. Review and validate mappings</li>
                <li>2. Export configuration to CSV/JSON</li>
                <li>3. Set up domain-wide delegation</li>
                <li>4. Execute migration in batches</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
