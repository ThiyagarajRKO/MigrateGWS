'use client'

import React, { useState, useEffect } from 'react'
import { MigrationLogger } from '@/lib/migration-logger'

interface ServiceProgress {
  service: string
  displayName: string
  totalItems: number
  processedItems: number
  currentItem: string
  status: 'starting' | 'in-progress' | 'completed' | 'failed' | 'paused'
  estimatedTime: number
  errors: string[]
  warnings: string[]
}

const GOOGLE_WORKSPACE_SERVICES = [
  {
    service: 'gmail',
    displayName: 'Gmail Messages',
    baseItems: 150,
    itemTypes: ['messages', 'labels', 'filters', 'settings'],
    complexity: 2.5 // Higher complexity = slower migration
  },
  {
    service: 'drive',
    displayName: 'Google Drive',
    baseItems: 250,
    itemTypes: ['files', 'folders', 'permissions', 'shared drives'],
    complexity: 3.0
  },
  {
    service: 'calendar',
    displayName: 'Google Calendar',
    baseItems: 45,
    itemTypes: ['events', 'calendars', 'settings', 'acl'],
    complexity: 1.8
  },
  {
    service: 'contacts',
    displayName: 'Google Contacts',
    baseItems: 85,
    itemTypes: ['contacts', 'groups', 'labels'],
    complexity: 1.2
  },
  {
    service: 'photos',
    displayName: 'Google Photos',
    baseItems: 180,
    itemTypes: ['photos', 'albums', 'shared albums'],
    complexity: 2.8
  },
  {
    service: 'chat',
    displayName: 'Google Chat',
    baseItems: 65,
    itemTypes: ['spaces', 'messages', 'memberships'],
    complexity: 2.0
  },
  {
    service: 'forms',
    displayName: 'Google Forms',
    baseItems: 12,
    itemTypes: ['forms', 'responses', 'settings'],
    complexity: 1.5
  },
  {
    service: 'sites',
    displayName: 'Google Sites',
    baseItems: 8,
    itemTypes: ['sites', 'pages', 'permissions'],
    complexity: 2.2
  }
]

export default function MigrationProgressSimulator() {
  const [isRunning, setIsRunning] = useState(false)
  const [services, setServices] = useState<ServiceProgress[]>([])
  const [selectedUser, setSelectedUser] = useState('testuser@migrate.arakutourism.net')
  const [migrationSpeed, setMigrationSpeed] = useState(1) // 1x speed

  const logger = MigrationLogger.getInstance()

  // Initialize services
  useEffect(() => {
    const initialServices = GOOGLE_WORKSPACE_SERVICES.map(service => ({
      service: service.service,
      displayName: service.displayName,
      totalItems: Math.floor(service.baseItems * (0.8 + Math.random() * 0.4)), // ±20% variation
      processedItems: 0,
      currentItem: '',
      status: 'starting' as const,
      estimatedTime: Math.floor(service.baseItems * service.complexity * (2000 / migrationSpeed)), // ms
      errors: [],
      warnings: []
    }))
    setServices(initialServices)
  }, [migrationSpeed])

  const startMigrationSimulation = async () => {
    if (isRunning) return

    setIsRunning(true)
    logger.info('migration', 'Starting comprehensive Google Workspace migration simulation', selectedUser, {
      services: services.map(s => s.service),
      totalItems: services.reduce((sum, s) => sum + s.totalItems, 0),
      estimatedDuration: Math.max(...services.map(s => s.estimatedTime)) + 'ms'
    })

    // Start all services with staggered delays
    const servicePromises = services.map((service, index) => 
      simulateServiceMigration(service, index * 2000) // 2s stagger between services
    )

    try {
      await Promise.all(servicePromises)
      logger.success('migration', 'All services migration completed successfully', selectedUser)
    } catch (error) {
      logger.error('migration', 'Migration simulation failed', selectedUser, { error })
    } finally {
      setIsRunning(false)
    }
  }

  const simulateServiceMigration = async (service: ServiceProgress, delay: number = 0) => {
    // Wait for staggered start
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay))
    }

    const serviceConfig = GOOGLE_WORKSPACE_SERVICES.find(s => s.service === service.service)!
    
    // Update service status to in-progress
    updateServiceStatus(service.service, {
      status: 'in-progress',
      currentItem: `Initializing ${service.displayName} migration...`
    })

    logger.info(service.service, `Starting ${service.displayName} migration`, selectedUser, {
      totalItems: service.totalItems,
      estimatedTime: service.estimatedTime
    })

    // Simulate item-by-item processing
    for (let i = 0; i <= service.totalItems; i++) {
      if (!isRunning) break // Allow cancellation

      const progress = Math.floor((i / service.totalItems) * 100)
      const currentItemType = serviceConfig.itemTypes[Math.floor(Math.random() * serviceConfig.itemTypes.length)]
      const currentItem = `Processing ${currentItemType} ${i}/${service.totalItems}`

      updateServiceStatus(service.service, {
        processedItems: i,
        currentItem: currentItem,
        status: i === service.totalItems ? 'completed' : 'in-progress'
      })

      // Send progress updates
      logger.progress(service.service, `${service.displayName}: ${progress}%`, selectedUser, {
        progress,
        processedItems: i,
        totalItems: service.totalItems,
        currentItem
      })

      // Simulate realistic processing time with complexity
      const baseDelay = 100 / migrationSpeed // Base delay
      const complexityMultiplier = serviceConfig.complexity
      const randomVariation = 0.5 + Math.random() // 50-150% variation
      const processingTime = baseDelay * complexityMultiplier * randomVariation

      await new Promise(resolve => setTimeout(resolve, processingTime))

      // Simulate occasional warnings and errors
      if (Math.random() < 0.05) { // 5% chance of warning
        const warning = `Warning in ${currentItemType}: Size exceeds recommended limit`
        updateServiceStatus(service.service, {
          warnings: [...service.warnings, warning]
        })
        logger.warning(service.service, warning, selectedUser, { item: currentItem })
      }

      if (Math.random() < 0.02) { // 2% chance of error
        const error = `Error processing ${currentItemType}: Permission denied, retrying...`
        updateServiceStatus(service.service, {
          errors: [...service.errors, error]
        })
        logger.error(service.service, error, selectedUser, { item: currentItem, retrying: true })
      }
    }

    if (isRunning) {
      logger.success(service.service, `${service.displayName} migration completed`, selectedUser, {
        totalProcessed: service.totalItems,
        warnings: service.warnings.length,
        errors: service.errors.length
      })
    }
  }

  const updateServiceStatus = (serviceName: string, updates: Partial<ServiceProgress>) => {
    setServices(prev => prev.map(service => 
      service.service === serviceName 
        ? { ...service, ...updates }
        : service
    ))
  }

  const stopMigrationSimulation = () => {
    setIsRunning(false)
    logger.info('migration', 'Migration simulation stopped by user', selectedUser)
    
    // Reset all services to starting state
    setServices(prev => prev.map(service => ({
      ...service,
      processedItems: 0,
      status: 'starting' as const,
      currentItem: '',
      errors: [],
      warnings: []
    })))
  }

  const testSingleService = (serviceName: string) => {
    const service = services.find(s => s.service === serviceName)
    if (!service || isRunning) return

    setIsRunning(true)
    simulateServiceMigration(service, 0).finally(() => setIsRunning(false))
  }

  const getProgressPercentage = (service: ServiceProgress) => {
    return service.totalItems > 0 ? Math.floor((service.processedItems / service.totalItems) * 100) : 0
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg border border-gray-200">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Migration Progress Simulator</h2>
      
      {/* Controls */}
      <div className="mb-6 space-y-4">
        <div className="flex items-center space-x-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">User Email</label>
            <input
              type="email"
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isRunning}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Speed</label>
            <select
              value={migrationSpeed}
              onChange={(e) => setMigrationSpeed(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isRunning}
            >
              <option value={0.5}>0.5x (Slow)</option>
              <option value={1}>1x (Normal)</option>
              <option value={2}>2x (Fast)</option>
              <option value={5}>5x (Very Fast)</option>
            </select>
          </div>
        </div>

        <div className="flex space-x-2">
          {!isRunning ? (
            <button
              onClick={startMigrationSimulation}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Start Full Migration
            </button>
          ) : (
            <button
              onClick={stopMigrationSimulation}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              Stop Migration
            </button>
          )}
        </div>
      </div>

      {/* Service Progress Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {services.map((service) => {
          const progress = getProgressPercentage(service)
          const statusColors = {
            starting: 'bg-gray-100 text-gray-800',
            'in-progress': 'bg-blue-100 text-blue-800',
            completed: 'bg-green-100 text-green-800',
            failed: 'bg-red-100 text-red-800',
            paused: 'bg-yellow-100 text-yellow-800'
          }

          return (
            <div key={service.service} className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm">{service.displayName}</h3>
                <span className={`px-2 py-1 text-xs rounded-full ${statusColors[service.status]}`}>
                  {service.status}
                </span>
              </div>
              
              <div className="mb-2">
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>{service.processedItems} / {service.totalItems}</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${
                      service.status === 'completed' ? 'bg-green-500' :
                      service.status === 'failed' ? 'bg-red-500' :
                      service.status === 'in-progress' ? 'bg-blue-500' :
                      'bg-gray-400'
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {service.currentItem && (
                <p className="text-xs text-gray-600 mb-2 truncate" title={service.currentItem}>
                  {service.currentItem}
                </p>
              )}

              <div className="flex justify-between text-xs">
                {service.errors.length > 0 && (
                  <span className="text-red-600">{service.errors.length} errors</span>
                )}
                {service.warnings.length > 0 && (
                  <span className="text-yellow-600">{service.warnings.length} warnings</span>
                )}
              </div>

              {!isRunning && service.status === 'starting' && (
                <button
                  onClick={() => testSingleService(service.service)}
                  className="mt-2 w-full px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                  Test {service.service}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Summary Stats */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold text-gray-900 mb-2">Migration Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Total Items:</span>
            <span className="ml-2 font-medium">{services.reduce((sum, s) => sum + s.totalItems, 0)}</span>
          </div>
          <div>
            <span className="text-gray-600">Processed:</span>
            <span className="ml-2 font-medium">{services.reduce((sum, s) => sum + s.processedItems, 0)}</span>
          </div>
          <div>
            <span className="text-gray-600">Completed Services:</span>
            <span className="ml-2 font-medium">{services.filter(s => s.status === 'completed').length} / {services.length}</span>
          </div>
          <div>
            <span className="text-gray-600">Overall Progress:</span>
            <span className="ml-2 font-medium">
              {Math.floor((services.reduce((sum, s) => sum + s.processedItems, 0) / services.reduce((sum, s) => sum + s.totalItems, 0)) * 100) || 0}%
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
