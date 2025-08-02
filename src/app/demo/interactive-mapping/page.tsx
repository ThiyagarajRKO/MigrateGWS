'use client'

import React, { useState } from 'react'
import { Plus, Trash2, Edit3, Save, X } from 'lucide-react'
import UserMappingVisualizer, { UserMapping } from '@/components/UserMappingVisualizer'

interface MappingEditorProps {
  mapping: UserMapping
  onSave: (mapping: UserMapping) => void
  onCancel: () => void
}

const MappingEditor: React.FC<MappingEditorProps> = ({ mapping, onSave, onCancel }) => {
  const [editedMapping, setEditedMapping] = useState<UserMapping>(mapping)

  const handleSourceUsersChange = (value: string) => {
    const users = value.split(',').map(email => email.trim()).filter(email => email)
    setEditedMapping(prev => ({ ...prev, sourceUsers: users }))
  }

  const handleTargetUserChange = (value: string) => {
    const users = value.split(',').map(email => email.trim()).filter(email => email)
    setEditedMapping(prev => ({ 
      ...prev, 
      targetUser: users.length === 1 ? users[0] : users 
    }))
  }

  return (
    <div className="bg-white border-2 border-blue-200 rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Edit Mapping</h3>
        <div className="flex space-x-2">
          <button
            onClick={() => onSave(editedMapping)}
            className="flex items-center space-x-1 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>Save</span>
          </button>
          <button
            onClick={onCancel}
            className="flex items-center space-x-1 px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            <X className="w-4 h-4" />
            <span>Cancel</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Source Users (comma-separated)
          </label>
          <textarea
            value={editedMapping.sourceUsers.join(', ')}
            onChange={(e) => handleSourceUsersChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
            placeholder="user1@source.com, user2@source.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Target Users (comma-separated)
          </label>
          <textarea
            value={Array.isArray(editedMapping.targetUser) 
              ? editedMapping.targetUser.join(', ') 
              : editedMapping.targetUser
            }
            onChange={(e) => handleTargetUserChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
            placeholder="user@target.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Mapping Type
          </label>
          <select
            value={editedMapping.mappingType}
            onChange={(e) => setEditedMapping(prev => ({ 
              ...prev, 
              mappingType: e.target.value as UserMapping['mappingType'] 
            }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="direct">Direct</option>
            <option value="merge">Merge</option>
            <option value="split">Split</option>
            <option value="create">Create</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Target User Exists
          </label>
          <select
            value={editedMapping.targetUserExists.toString()}
            onChange={(e) => setEditedMapping(prev => ({ 
              ...prev, 
              targetUserExists: e.target.value === 'true' 
            }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Scenario Description
          </label>
          <input
            type="text"
            value={editedMapping.scenario}
            onChange={(e) => setEditedMapping(prev => ({ ...prev, scenario: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., Multi-source ➝ Single Target"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notes (optional)
          </label>
          <textarea
            value={editedMapping.notes || ''}
            onChange={(e) => setEditedMapping(prev => ({ ...prev, notes: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={2}
            placeholder="Additional notes about this mapping..."
          />
        </div>
      </div>
    </div>
  )
}

export default function InteractiveUserMappingDemo() {
  const [mappings, setMappings] = useState<UserMapping[]>([
    {
      sourceUsers: ["alice@company-a.com", "alice@company-b.com"],
      targetUser: "alice@newcorp.com",
      targetUserExists: true,
      mappingType: "merge",
      scenario: "Multi-source ➝ Single Target (Target Exists)",
      notes: "Merging identities from different domains."
    },
    {
      sourceUsers: ["john@company-a.com"],
      targetUser: ["john.sales@newcorp.com", "john.marketing@newcorp.com"],
      targetUserExists: false,
      mappingType: "split",
      scenario: "Single Source ➝ Multi Target (Target Not Exists)",
      notes: "Splitting one source user into multiple target identities."
    }
  ])

  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  const addNewMapping = () => {
    const newMapping: UserMapping = {
      sourceUsers: ["user@source.com"],
      targetUser: "user@target.com",
      targetUserExists: false,
      mappingType: "direct",
      scenario: "New Mapping",
      notes: ""
    }
    setMappings([...mappings, newMapping])
    setEditingIndex(mappings.length)
  }

  const deleteMapping = (index: number) => {
    setMappings(mappings.filter((_, i) => i !== index))
    if (editingIndex === index) {
      setEditingIndex(null)
    }
  }

  const saveMapping = (index: number, updatedMapping: UserMapping) => {
    const newMappings = [...mappings]
    newMappings[index] = updatedMapping
    setMappings(newMappings)
    setEditingIndex(null)
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Interactive User Mapping Builder
          </h1>
          <p className="text-gray-600 mb-4">
            Create, edit, and visualize user mappings for Google Workspace migrations.
          </p>
          
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-500">
              {mappings.length} mapping{mappings.length !== 1 ? 's' : ''} configured
            </div>
            <button
              onClick={addNewMapping}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Mapping</span>
            </button>
          </div>
        </div>

        {/* Mapping Editor */}
        {editingIndex !== null && (
          <div className="mb-8">
            <MappingEditor
              mapping={mappings[editingIndex]}
              onSave={(updatedMapping) => saveMapping(editingIndex, updatedMapping)}
              onCancel={() => setEditingIndex(null)}
            />
          </div>
        )}

        {/* Mapping List with Edit Controls */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Configured Mappings
          </h2>
          <div className="space-y-4">
            {mappings.map((mapping, index) => (
              <div key={index} className="bg-white rounded-lg border p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-4">
                    <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                    <span className="text-sm text-gray-700">{mapping.scenario}</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      mapping.mappingType === 'merge' ? 'bg-purple-100 text-purple-800' :
                      mapping.mappingType === 'split' ? 'bg-orange-100 text-orange-800' :
                      mapping.mappingType === 'direct' ? 'bg-blue-100 text-blue-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {mapping.mappingType}
                    </span>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setEditingIndex(index)}
                      className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                      title="Edit mapping"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteMapping(index)}
                      className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                      title="Delete mapping"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  {mapping.sourceUsers.length} source → {
                    Array.isArray(mapping.targetUser) ? mapping.targetUser.length : 1
                  } target
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Visualizer */}
        {mappings.length > 0 && (
          <UserMappingVisualizer mappings={mappings} />
        )}

        {mappings.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <Plus className="w-16 h-16 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No mappings configured
            </h3>
            <p className="text-gray-500 mb-4">
              Add your first user mapping to get started.
            </p>
            <button
              onClick={addNewMapping}
              className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Create First Mapping
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
