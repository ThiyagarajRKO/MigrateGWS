'use client'

import React, { useState } from 'react'
import { UserPlus, List, Eye } from 'lucide-react'
import IndividualUserMapper from '@/components/IndividualUserMapper'
import UserMappingVisualizer, { UserMapping } from '@/components/UserMappingVisualizer'

export default function IndividualMappingPage() {
  const [mappings, setMappings] = useState<UserMapping[]>([])
  const [showMapper, setShowMapper] = useState(true)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  const handleSaveMapping = (mapping: UserMapping) => {
    if (editingIndex !== null) {
      // Edit existing mapping
      const updated = [...mappings]
      updated[editingIndex] = mapping
      setMappings(updated)
      setEditingIndex(null)
    } else {
      // Add new mapping
      setMappings([...mappings, mapping])
    }
    setShowMapper(false)
  }

  const handleEditMapping = (index: number) => {
    setEditingIndex(index)
    setShowMapper(true)
  }

  const handleDeleteMapping = (index: number) => {
    setMappings(mappings.filter((_, i) => i !== index))
  }

  const handleCancel = () => {
    setShowMapper(false)
    setEditingIndex(null)
  }

  const currentMapping = editingIndex !== null ? mappings[editingIndex] : undefined

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-lg">
              <UserPlus className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
              Individual User Mapping Tool
            </h1>
          </div>
          <p className="text-gray-600 max-w-3xl font-medium">
            Create and edit user mappings one at a time with this guided interface. 
            Perfect for complex mappings or when you need precise control over each mapping configuration.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white/95 backdrop-blur-sm rounded-xl border border-blue-100 p-4 text-center shadow-lg hover:shadow-xl transition-all duration-200">
            <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">{mappings.length}</div>
            <div className="text-sm text-gray-600 font-medium">Total Mappings</div>
          </div>
          <div className="bg-white/95 backdrop-blur-sm rounded-xl border border-blue-100 p-4 text-center shadow-lg hover:shadow-xl transition-all duration-200">
            <div className="text-2xl font-bold bg-gradient-to-r from-green-600 to-green-700 bg-clip-text text-transparent">
              {mappings.filter(m => m.mappingType === 'merge').length}
            </div>
            <div className="text-sm text-gray-600 font-medium">Merge</div>
          </div>
          <div className="bg-white/95 backdrop-blur-sm rounded-xl border border-blue-100 p-4 text-center shadow-lg hover:shadow-xl transition-all duration-200">
            <div className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-orange-700 bg-clip-text text-transparent">
              {mappings.filter(m => m.mappingType === 'split').length}
            </div>
            <div className="text-sm text-gray-600 font-medium">Split</div>
          </div>
          <div className="bg-white/95 backdrop-blur-sm rounded-xl border border-blue-100 p-4 text-center shadow-lg hover:shadow-xl transition-all duration-200">
            <div className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-purple-700 bg-clip-text text-transparent">
              {mappings.filter(m => m.mappingType === 'direct').length}
            </div>
            <div className="text-sm text-gray-600 font-medium">Direct</div>
          </div>
        </div>

        {/* Toggle View */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowMapper(!showMapper)}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <UserPlus className="h-4 w-4" />
              {showMapper ? 'Hide Mapper' : 'New Mapping'}
            </button>
            
            {mappings.length > 0 && (
              <span className="text-sm text-gray-600 font-medium">
                {mappings.length} mapping{mappings.length !== 1 ? 's' : ''} created
              </span>
            )}
          </div>

          {mappings.length > 0 && (
            <div className="flex items-center gap-2">
              <List className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-600 font-medium">
                View {showMapper ? 'creation tool and ' : ''}saved mappings below
              </span>
            </div>
          )}
        </div>

        {/* Individual User Mapper */}
        {showMapper && (
          <div className="mb-8">
            <IndividualUserMapper
              onSaveMapping={handleSaveMapping}
              onCancel={handleCancel}
              initialMapping={currentMapping}
            />
          </div>
        )}

        {/* Saved Mappings */}
        {mappings.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-gradient-to-br from-gray-600 to-gray-700 rounded-lg">
                <Eye className="h-4 w-4 text-white" />
              </div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">Created Mappings</h2>
            </div>
            
            <UserMappingVisualizer
              mappings={mappings}
              onUpdateMapping={handleEditMapping}
              onDeleteMapping={handleDeleteMapping}
              showEditControls={true}
            />
          </div>
        )}

        {/* Empty State */}
        {mappings.length === 0 && !showMapper && (
          <div className="bg-white/95 backdrop-blur-sm rounded-xl border border-blue-100 p-12 text-center shadow-lg">
            <div className="p-4 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl inline-block mb-4 shadow-lg">
              <UserPlus className="h-12 w-12 text-white" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">No mappings created yet</h3>
            <p className="text-gray-600 mb-6 font-medium">
              Create your first user mapping to get started with the migration process.
            </p>
            <button
              onClick={() => setShowMapper(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <UserPlus className="h-5 w-5" />
              Create First Mapping
            </button>
          </div>
        )}

        {/* Help Section */}
        <div className="mt-8 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 shadow-lg">
          <h3 className="text-lg font-bold bg-gradient-to-r from-blue-900 to-indigo-900 bg-clip-text text-transparent mb-4">How to Use the Individual Mapper</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-blue-800">
            <div>
              <h4 className="font-semibold mb-3 text-blue-900">Mapping Types:</h4>
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                  <strong>Direct (1:1):</strong> One source → One target user
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-600 rounded-full"></div>
                  <strong>Merge:</strong> Multiple sources → One target user
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-orange-600 rounded-full"></div>
                  <strong>Split:</strong> One source → Multiple target users
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                  <strong>Create:</strong> New user creation scenarios
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-blue-900">Features:</h4>
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-indigo-600 rounded-full"></div>
                  Auto-detection of mapping type
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-indigo-600 rounded-full"></div>
                  Email validation
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-indigo-600 rounded-full"></div>
                  Target user existence tracking
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-indigo-600 rounded-full"></div>
                  Custom scenarios and notes
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-indigo-600 rounded-full"></div>
                  Edit existing mappings
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
