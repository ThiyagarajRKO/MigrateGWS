'use client'

import React, { useState, useEffect } from 'react'
import { useWebSocketLogger, type LogMessage } from '@/hooks/useWebSocketLogger'
import { 
  Activity, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Info, 
  Clock,
  Server,
  Users,
  Database,
  Mail,
  Calendar,
  FileText,
  HardDrive,
  Contact,
  Phone,
  MessageSquare,
  Image,
  Presentation,
  Sheet,
  Filter,
  Eye,
  EyeOff,
  Download,
  Trash2,
  Pause,
  Play
} from 'lucide-react'

interface MigrationProgress {
  service: string
  user: string
  totalItems: number
  processedItems: number
  currentItem?: string
  status: 'starting' | 'in-progress' | 'completed' | 'failed' | 'paused'
  errors?: string[]
  warnings?: string[]
}

const serviceIcons = {
  drive: HardDrive,
  calendar: Calendar,
  contacts: Contact,
  gmail: Mail,
  chat: MessageSquare,
  photos: Image,
  forms: FileText,
  presentations: Presentation,
  spreadsheets: Sheet,
  admin: Server,
  auth: Users,
  api: Database,
  validation: CheckCircle,
  system: Activity
}

const levelIcons = {
  info: Info,
  warning: AlertTriangle,
  error: XCircle,
  success: CheckCircle,
  progress: Activity
}

const levelColors = {
  info: 'text-blue-500 bg-blue-50 border-blue-200',
  warning: 'text-yellow-500 bg-yellow-50 border-yellow-200',
  error: 'text-red-500 bg-red-50 border-red-200',
  success: 'text-green-500 bg-green-50 border-green-200',
  progress: 'text-purple-500 bg-purple-50 border-purple-200'
}

export default function RealTimeMigrationLogger() {
  const { 
    isConnected, 
    logs, 
    connect, 
    disconnect, 
    clearLogs,
    filterLogs 
  } = useWebSocketLogger()

  const [isExpanded, setIsExpanded] = useState(true)
  const [isPaused, setIsPaused] = useState(false)
  const [filters, setFilters] = useState({
    services: [] as string[],
    levels: [] as string[],
    users: [] as string[]
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [progressData] = useState<Record<string, MigrationProgress>>({})

  // Get unique values for filters
  const uniqueServices = [...new Set(logs.map((m: LogMessage) => m.service))]
  const uniqueLevels = [...new Set(logs.map((m: LogMessage) => m.level || m.type))]
  const uniqueUsers = [...new Set(logs.map((m: LogMessage) => m.user).filter(Boolean))]

  // Apply filters to messages
  const filteredMessages = filterLogs({
    service: filters.services.length > 0 ? filters.services[0] : undefined,
    level: filters.levels.length > 0 ? filters.levels[0] : undefined,
    user: filters.users.length > 0 ? filters.users[0] : undefined
  }).filter((message: LogMessage) => {
    if (searchTerm) {
      return message.message.toLowerCase().includes(searchTerm.toLowerCase())
    }
    return true
  })

  useEffect(() => {
    if (!isConnected && !isPaused) {
      connect()
    }
    return () => {
      if (isConnected) {
        disconnect()
      }
    }
  }, [isConnected, isPaused, connect, disconnect])

  const handleToggleConnection = () => {
    if (isPaused) {
      setIsPaused(false)
      connect()
    } else {
      setIsPaused(true)
      disconnect()
    }
  }

  const handleFilterToggle = (type: 'services' | 'levels' | 'users', value: string) => {
    setFilters(prev => ({
      ...prev,
      [type]: prev[type].includes(value)
        ? prev[type].filter(item => item !== value)
        : [...prev[type], value]
    }))
  }

  const handleExportLogs = () => {
    const exportData = {
      timestamp: new Date().toISOString(),
      totalMessages: filteredMessages.length,
      messages: filteredMessages,
      progressData
    }
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `migration-logs-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const renderProgressBar = (progress: MigrationProgress) => {
    const percentage = progress.totalItems > 0 
      ? Math.round((progress.processedItems / progress.totalItems) * 100)
      : 0

    const statusColors = {
      starting: 'bg-blue-500',
      'in-progress': 'bg-purple-500',
      completed: 'bg-green-500',
      failed: 'bg-red-500',
      paused: 'bg-yellow-500'
    }

    return (
      <div className="mb-4 p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            {React.createElement(serviceIcons[progress.service as keyof typeof serviceIcons] || Activity, {
              className: "w-4 h-4 text-gray-600"
            })}
            <span className="font-medium text-sm capitalize">{progress.service}</span>
            <span className="text-xs text-gray-500">
              {progress.user}
            </span>
          </div>
          <span className={`px-2 py-1 text-xs rounded-full capitalize ${
            progress.status === 'completed' ? 'bg-green-100 text-green-800' :
            progress.status === 'failed' ? 'bg-red-100 text-red-800' :
            progress.status === 'in-progress' ? 'bg-purple-100 text-purple-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {progress.status}
          </span>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
          <div 
            className={`h-2 rounded-full transition-all duration-300 ${statusColors[progress.status]}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        
        <div className="flex justify-between text-xs text-gray-600">
          <span>{progress.processedItems} / {progress.totalItems} items</span>
          <span>{percentage}%</span>
        </div>
        
        {progress.currentItem && (
          <div className="mt-1 text-xs text-gray-500 truncate">
            Current: {progress.currentItem}
          </div>
        )}
        
        {progress.errors && progress.errors.length > 0 && (
          <div className="mt-2 text-xs text-red-600">
            {progress.errors.length} error(s)
          </div>
        )}
      </div>
    )
  }

  const renderLogMessage = (message: LogMessage, index: number) => {
    const effectiveLevel = message.level || message.type
    const LevelIcon = levelIcons[effectiveLevel as keyof typeof levelIcons] || Info
    const ServiceIcon = serviceIcons[message.service as keyof typeof serviceIcons] || Activity
    const effectiveColor = levelColors[effectiveLevel as keyof typeof levelColors] || levelColors.info

    return (
      <div 
        key={`${message.timestamp}-${index}`}
        className={`p-3 border rounded-lg mb-2 ${effectiveColor}`}
      >
        <div className="flex items-start space-x-3">
          <div className="flex items-center space-x-2 flex-shrink-0">
            <LevelIcon className="w-4 h-4" />
            <ServiceIcon className="w-4 h-4" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              <span className="font-medium text-sm capitalize">{message.service}</span>
              {message.user && (
                <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                  {message.user}
                </span>
              )}
              <span className="text-xs text-gray-500">
                {new Date(message.timestamp).toLocaleTimeString()}
              </span>
            </div>
            
            <div className="text-sm">{message.message}</div>
            
            {message.details && (
              <details className="mt-2">
                <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-800">
                  View details
                </summary>
                <pre className="text-xs bg-gray-50 p-2 rounded mt-1 overflow-x-auto">
                  {JSON.stringify(message.details, null, 2)}
                </pre>
              </details>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (!isExpanded) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsExpanded(true)}
          className={`p-3 rounded-full shadow-lg transition-colors ${
            isConnected ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-500 hover:bg-gray-600'
          } text-white`}
        >
          <Activity className="w-6 h-6" />
          {logs.length > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center">
              {logs.length > 99 ? '99+' : logs.length}
            </span>
          )}
        </button>
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 max-h-[600px] bg-white rounded-lg shadow-xl border border-gray-300 z-50">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity className="w-5 h-5 text-gray-700" />
            <h3 className="font-semibold text-gray-900">Migration Logger</h3>
            <div className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-red-500'
            }`} />
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={handleToggleConnection}
              className={`p-1 rounded hover:bg-gray-200 ${
                isPaused ? 'text-red-500' : 'text-green-500'
              }`}
              title={isPaused ? 'Resume logging' : 'Pause logging'}
            >
              {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>
            
            <button
              onClick={handleExportLogs}
              className="p-1 rounded hover:bg-gray-200 text-gray-600"
              title="Export logs"
            >
              <Download className="w-4 h-4" />
            </button>
            
            <button
              onClick={clearLogs}
              className="p-1 rounded hover:bg-gray-200 text-gray-600"
              title="Clear logs"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            
            <button
              onClick={() => setIsExpanded(false)}
              className="p-1 rounded hover:bg-gray-200 text-gray-600"
            >
              <EyeOff className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-2 flex items-center space-x-4 text-xs text-gray-600">
          <span>Messages: {filteredMessages.length}</span>
          <span>Progress: {Object.keys(progressData).length}</span>
          <span>Status: {isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>

      {/* Progress Section */}
      {Object.keys(progressData).length > 0 && (
        <div className="p-4 border-b border-gray-200 bg-blue-50">
          <h4 className="font-medium text-sm text-gray-900 mb-2">Active Migrations</h4>
          <div className="max-h-32 overflow-y-auto">
            {Object.entries(progressData).map(([key, progress]) => 
              renderProgressBar(progress)
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <input
          type="text"
          placeholder="Search logs..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        
        <div className="mt-2 space-y-2">
          {/* Service Filters */}
          {uniqueServices.length > 0 && (
            <div>
              <span className="text-xs font-medium text-gray-600">Services:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {uniqueServices.map((service: string) => (
                  <button
                    key={service}
                    onClick={() => handleFilterToggle('services', service)}
                    className={`px-2 py-1 text-xs rounded capitalize ${
                      filters.services.includes(service)
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {service}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Level Filters */}
          <div>
            <span className="text-xs font-medium text-gray-600">Levels:</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {uniqueLevels.map((level: string) => (
                <button
                  key={level}
                  onClick={() => handleFilterToggle('levels', level)}
                  className={`px-2 py-1 text-xs rounded capitalize ${
                    filters.levels.includes(level)
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto max-h-64 p-4">
        {filteredMessages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No logs yet</p>
            <p className="text-xs">Migration logs will appear here in real-time</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredMessages.slice(-50).map((message, index) => renderLogMessage(message, index))}
          </div>
        )}
      </div>
    </div>
  )
}
