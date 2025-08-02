'use client'

import React, { useState } from 'react'
import { User, Users, Plus, Minus, ArrowRight, CheckCircle, AlertTriangle, Mail, Save, X } from 'lucide-react'
import { UserMapping } from './UserMappingVisualizer'

interface IndividualUserMapperProps {
  onSaveMapping: (mapping: UserMapping) => void
  onCancel?: () => void
  initialMapping?: UserMapping
  className?: string
}

export default function IndividualUserMapper({ 
  onSaveMapping, 
  onCancel, 
  initialMapping,
  className = '' 
}: IndividualUserMapperProps) {
  const [sourceUsers, setSourceUsers] = useState<string[]>(
    initialMapping?.sourceUsers || ['']
  )
  const [targetUsers, setTargetUsers] = useState<string[]>(
    initialMapping ? 
      Array.isArray(initialMapping.targetUser) ? initialMapping.targetUser : [initialMapping.targetUser]
      : ['']
  )
  const [targetExists, setTargetExists] = useState(initialMapping?.targetUserExists || false)
  const [scenario, setScenario] = useState(initialMapping?.scenario || '')
  const [notes, setNotes] = useState(initialMapping?.notes || '')

  // Auto-detect mapping type
  const getMappingType = (): UserMapping['mappingType'] => {
    const validSources = sourceUsers.filter(u => u.trim())
    const validTargets = targetUsers.filter(u => u.trim())
    
    if (validSources.length > 1 && validTargets.length === 1) return 'merge'
    if (validSources.length === 1 && validTargets.length > 1) return 'split'
    if (validSources.length === 1 && validTargets.length === 1) return 'direct'
    return 'create'
  }

  // Auto-generate scenario description
  const generateScenario = () => {
    const mappingType = getMappingType()
    const validSources = sourceUsers.filter(u => u.trim())
    const validTargets = targetUsers.filter(u => u.trim())
    const existsText = targetExists ? 'Target Exists' : 'Target Not Exists'
    
    switch (mappingType) {
      case 'merge':
        return `Multi-source → Single Target (${existsText})`
      case 'split':
        return `Single Source → Multi Target (${existsText})`
      case 'direct':
        return `Direct Migration (1:1) (${existsText})`
      case 'create':
        return `Create New User (${existsText})`
      default:
        return `${validSources.length} → ${validTargets.length} Mapping (${existsText})`
    }
  }

  const addSourceUser = () => {
    setSourceUsers([...sourceUsers, ''])
  }

  const removeSourceUser = (index: number) => {
    if (sourceUsers.length > 1) {
      setSourceUsers(sourceUsers.filter((_, i) => i !== index))
    }
  }

  const updateSourceUser = (index: number, value: string) => {
    const updated = [...sourceUsers]
    updated[index] = value
    setSourceUsers(updated)
  }

  const addTargetUser = () => {
    setTargetUsers([...targetUsers, ''])
  }

  const removeTargetUser = (index: number) => {
    if (targetUsers.length > 1) {
      setTargetUsers(targetUsers.filter((_, i) => i !== index))
    }
  }

  const updateTargetUser = (index: number, value: string) => {
    const updated = [...targetUsers]
    updated[index] = value
    setTargetUsers(updated)
  }

  const validateEmails = (emails: string[]): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emails.filter(e => e.trim()).every(email => emailRegex.test(email.trim()))
  }

  const isValid = () => {
    const validSources = sourceUsers.filter(u => u.trim())
    const validTargets = targetUsers.filter(u => u.trim())
    
    return validSources.length > 0 && 
           validTargets.length > 0 && 
           validateEmails(validSources) && 
           validateEmails(validTargets)
  }

  const handleSave = () => {
    if (!isValid()) return
    
    const validSources = sourceUsers.filter(u => u.trim())
    const validTargets = targetUsers.filter(u => u.trim())
    
    const mapping: UserMapping = {
      sourceUsers: validSources,
      targetUser: validTargets.length === 1 ? validTargets[0] : validTargets,
      targetUserExists: targetExists,
      mappingType: getMappingType(),
      scenario: scenario || generateScenario(),
      notes: notes || undefined
    }
    
    onSaveMapping(mapping)
  }

  const mappingType = getMappingType()
  const validSources = sourceUsers.filter(u => u.trim())
  const validTargets = targetUsers.filter(u => u.trim())

  return (
    <div className={`bg-white/95 backdrop-blur-sm rounded-xl border border-blue-100 shadow-lg hover:shadow-xl transition-all duration-200 p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-lg">
            <User className="h-5 w-5 text-white" />
          </div>
          <h3 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
            {initialMapping ? 'Edit User Mapping' : 'Create User Mapping'}
          </h3>
        </div>
        {onCancel && (
          <button
            onClick={onCancel}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Mapping Type Preview */}
      <div className="mb-6 p-4 bg-gradient-to-r from-slate-50 to-blue-50 rounded-xl border border-blue-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-700">Mapping Type:</span>
          <span className={`px-3 py-1 rounded-full text-xs font-bold border-2 ${
            mappingType === 'merge' ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white border-purple-300' :
            mappingType === 'split' ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white border-orange-300' :
            mappingType === 'direct' ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white border-blue-300' :
            'bg-gradient-to-r from-green-500 to-green-600 text-white border-green-300'
          }`}>
            {mappingType.toUpperCase()}
          </span>
        </div>
        <div className="text-sm text-gray-600 font-medium">
          {validSources.length} source user{validSources.length !== 1 ? 's' : ''} → {validTargets.length} target user{validTargets.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="space-y-6">
        {/* Source Users Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
                <Users className="h-4 w-4 text-white" />
              </div>
              <label className="text-sm font-semibold text-gray-700">
                Source Users
              </label>
            </div>
            <button
              onClick={addSourceUser}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200 font-medium border border-blue-200 hover:border-blue-300"
            >
              <Plus className="h-4 w-4" />
              Add Source
            </button>
          </div>
          
          <div className="space-y-2">
            {sourceUsers.map((email, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => updateSourceUser(index, e.target.value)}
                    placeholder="user@source-domain.com"
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white/80 backdrop-blur-sm"
                  />
                </div>
                {sourceUsers.length > 1 && (
                  <button
                    onClick={() => removeSourceUser(index)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          
          {!validateEmails(sourceUsers) && sourceUsers.some(u => u.trim()) && (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <AlertTriangle className="h-4 w-4" />
              Please enter valid email addresses
            </div>
          )}
        </div>

        {/* Arrow Indicator */}
        <div className="flex justify-center">
          <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-slate-50 to-blue-50 rounded-full border border-blue-100 shadow-sm">
            <ArrowRight className={`h-5 w-5 ${
              mappingType === 'merge' ? 'text-purple-600' :
              mappingType === 'split' ? 'text-orange-600' :
              mappingType === 'direct' ? 'text-blue-600' :
              'text-green-600'
            }`} />
            <span className="text-sm font-semibold text-gray-700">Maps to</span>
          </div>
        </div>

        {/* Target Users Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-gradient-to-br from-green-500 to-green-600 rounded-lg">
                <User className="h-4 w-4 text-white" />
              </div>
              <label className="text-sm font-semibold text-gray-700">
                Target Users
              </label>
            </div>
            <button
              onClick={addTargetUser}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-green-600 hover:bg-green-50 rounded-lg transition-all duration-200 font-medium border border-green-200 hover:border-green-300"
            >
              <Plus className="h-4 w-4" />
              Add Target
            </button>
          </div>
          
          <div className="space-y-2">
            {targetUsers.map((email, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => updateTargetUser(index, e.target.value)}
                    placeholder="user@target-domain.com"
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 bg-white/80 backdrop-blur-sm"
                  />
                </div>
                {targetUsers.length > 1 && (
                  <button
                    onClick={() => removeTargetUser(index)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          
          {!validateEmails(targetUsers) && targetUsers.some(u => u.trim()) && (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <AlertTriangle className="h-4 w-4" />
              Please enter valid email addresses
            </div>
          )}
        </div>

        {/* Target Exists Toggle */}
        <div className="space-y-3">
          <label className="text-sm font-semibold text-gray-700">Target User Status</label>
          <div className="flex items-center space-x-6">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="radio"
                name="targetExists"
                checked={targetExists}
                onChange={() => setTargetExists(true)}
                className="text-green-600 focus:ring-green-500"
              />
              <div className="p-1.5 bg-gradient-to-br from-green-500 to-green-600 rounded-lg group-hover:shadow-md transition-all duration-200">
                <CheckCircle className="h-3 w-3 text-white" />
              </div>
              <span className="text-sm text-gray-700 font-medium">Target user already exists</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="radio"
                name="targetExists"
                checked={!targetExists}
                onChange={() => setTargetExists(false)}
                className="text-gray-600 focus:ring-gray-500"
              />
              <div className="p-1.5 bg-gradient-to-br from-gray-500 to-gray-600 rounded-lg group-hover:shadow-md transition-all duration-200">
                <User className="h-3 w-3 text-white" />
              </div>
              <span className="text-sm text-gray-700 font-medium">Will create new user</span>
            </label>
          </div>
        </div>

        {/* Scenario Description */}
        <div className="space-y-2">
          <label htmlFor="scenario" className="text-sm font-semibold text-gray-700">
            Scenario Description
          </label>
          <input
            id="scenario"
            type="text"
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
            placeholder={generateScenario()}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white/80 backdrop-blur-sm"
          />
          <div className="text-xs text-gray-500 font-medium">
            Leave empty to auto-generate based on mapping type
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <label htmlFor="notes" className="text-sm font-semibold text-gray-700">
            Notes (Optional)
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any additional notes about this mapping..."
            rows={3}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white/80 backdrop-blur-sm resize-none"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-6 border-t border-blue-100">
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-6 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all duration-200 font-medium border border-gray-200"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!isValid()}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white rounded-xl transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 disabled:hover:scale-100"
          >
            <Save className="h-4 w-4" />
            Save Mapping
          </button>
        </div>

        {/* Validation Summary */}
        {!isValid() && (validSources.length > 0 || validTargets.length > 0) && (
          <div className="p-4 bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-xl shadow-sm">
            <div className="flex items-center gap-2 text-sm text-red-700 mb-2">
              <div className="p-1 bg-red-100 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </div>
              <span className="font-semibold">Validation Issues:</span>
            </div>
            <ul className="text-sm text-red-600 space-y-1 font-medium">
              {validSources.length === 0 && <li>• At least one source user is required</li>}
              {validTargets.length === 0 && <li>• At least one target user is required</li>}
              {!validateEmails(validSources) && <li>• Source emails must be valid</li>}
              {!validateEmails(validTargets) && <li>• Target emails must be valid</li>}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
