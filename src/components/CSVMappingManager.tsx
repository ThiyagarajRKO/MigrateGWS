'use client'

import React, { useState } from 'react'
import { Upload, Download, FileText, AlertCircle, CheckCircle2 } from 'lucide-react'
import { UserMapping } from './UserMappingVisualizer'
import { parseMappingsFromCSV, generateCSVFromMappings, generateSampleMappingsCSV } from '@/lib/mapping-utils'

interface CSVMappingManagerProps {
  mappings: UserMapping[]
  onMappingsChange: (mappings: UserMapping[]) => void
  className?: string
}

export default function CSVMappingManager({ 
  mappings, 
  onMappingsChange, 
  className = '' 
}: CSVMappingManagerProps) {
  const [importError, setImportError] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState<string | null>(null)

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const csvText = e.target?.result as string
        const parsedMappings = parseMappingsFromCSV(csvText)
        
        onMappingsChange([...mappings, ...parsedMappings])
        setImportSuccess(`Successfully imported ${parsedMappings.length} user mappings`)
        setImportError(null)
        
        // Clear success message after 3 seconds
        setTimeout(() => setImportSuccess(null), 3000)
      } catch (error) {
        setImportError(error instanceof Error ? error.message : 'Failed to parse CSV file')
        setImportSuccess(null)
      }
    }
    reader.readAsText(file)
  }

  const handleExport = () => {
    if (mappings.length === 0) {
      setImportError('No mappings to export')
      setTimeout(() => setImportError(null), 3000)
      return
    }

    const csvContent = generateCSVFromMappings(mappings)
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = `user-mappings-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    setImportSuccess(`Exported ${mappings.length} user mappings`)
    setTimeout(() => setImportSuccess(null), 3000)
  }

  const handleDownloadSample = () => {
    const sampleCSV = generateSampleMappingsCSV()
    const blob = new Blob([sampleCSV], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = 'sample-user-mappings.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const clearMappings = () => {
    if (confirm('Are you sure you want to clear all mappings?')) {
      onMappingsChange([])
      setImportSuccess('All mappings cleared')
      setTimeout(() => setImportSuccess(null), 3000)
    }
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">CSV Mapping Manager</h3>
        </div>
        <div className="text-sm text-gray-500">
          {mappings.length} mapping{mappings.length !== 1 ? 's' : ''} loaded
        </div>
      </div>

      {/* Status Messages */}
      {importError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
          <span className="text-sm text-red-700">{importError}</span>
        </div>
      )}

      {importSuccess && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
          <span className="text-sm text-green-700">{importSuccess}</span>
        </div>
      )}

      {/* CSV Format Info */}
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
        <h4 className="text-sm font-medium text-blue-900 mb-2">CSV Format</h4>
        <div className="text-xs text-blue-800 font-mono">
          sourceAdminEmails,targetEmails,mappingType,scenario,notes,targetExists
        </div>
        <div className="text-xs text-blue-700 mt-1">
          • Use semicolons (;) to separate multiple emails within a field<br />
          • mappingType: merge, split, direct, or create<br />
          • targetExists: true or false
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Import CSV */}
        <div className="relative">
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors">
            <Upload className="h-4 w-4" />
            Import CSV
          </button>
        </div>

        {/* Export CSV */}
        <button
          onClick={handleExport}
          disabled={mappings.length === 0}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-md text-sm font-medium transition-colors"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>

        {/* Download Sample */}
        <button
          onClick={handleDownloadSample}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-sm font-medium transition-colors"
        >
          <FileText className="h-4 w-4" />
          Sample CSV
        </button>

        {/* Clear All */}
        <button
          onClick={clearMappings}
          disabled={mappings.length === 0}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-md text-sm font-medium transition-colors"
        >
          <AlertCircle className="h-4 w-4" />
          Clear All
        </button>
      </div>

      {/* Quick Stats */}
      {mappings.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="font-semibold text-gray-900">
                {mappings.filter(m => m.mappingType === 'merge').length}
              </div>
              <div className="text-gray-600">Merge</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-gray-900">
                {mappings.filter(m => m.mappingType === 'split').length}
              </div>
              <div className="text-gray-600">Split</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-gray-900">
                {mappings.filter(m => m.mappingType === 'direct').length}
              </div>
              <div className="text-gray-600">Direct</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-gray-900">
                {mappings.filter(m => m.mappingType === 'create').length}
              </div>
              <div className="text-gray-600">Create</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
