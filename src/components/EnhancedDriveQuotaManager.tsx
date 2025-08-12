/**
 * Enhanced Drive API Quota Management Component
 * Handles quota exceeded errors and provides real-time monitoring with WebSocket integration
 */

'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { 
  HardDrive, 
  AlertTriangle, 
  Clock, 
  RefreshCw,
  TrendingUp,
  Database,
  Zap,
  CheckCircle,
  XCircle,
  Activity,
  Pause,
  Play,
  Settings,
  Wifi,
  WifiOff
} from 'lucide-react'

interface DriveQuotaError {
  error: string
  failedFiles: number
  remainingFiles: number
  quotaType: 'requests_per_minute' | 'requests_per_day' | 'storage' | 'bandwidth'
  resetTime?: string
  retryAfter?: number
  status: number
  endpoint?: string
}

interface QuotaUsage {
  requestsThisMinute: number
  requestsToday: number
  lastReset: number
  windowStart: number
}

interface DriveQuotaStatus {
  requestsPerMinute: {
    used: number
    limit: number
    resetTime: string
    percentage: number
  }
  requestsPerDay: {
    used: number
    limit: number
    resetTime: string
    percentage: number
  }
  storage: {
    used: string
    limit: string
    percentage: number
  }
  bandwidth: {
    used: string
    limit: string
    percentage: number
  }
  health: 'healthy' | 'warning' | 'critical' | 'quota_exceeded'
  lastUpdate: string
  isMonitoring: boolean
  retryQueue: Array<{
    fileId: string
    fileName: string
    retryAt: string
    attempts: number
  }>
}

interface DriveQuotaManagerProps {
  migrationId: string
  isActive: boolean
  onQuotaError?: (error: DriveQuotaError) => void
  onQuotaRecovered?: () => void
  onQuotaWarning?: (usage: number) => void
  showDetailedStats?: boolean
  autoRefresh?: boolean
  refreshInterval?: number
}

export function DriveQuotaManager({ 
  migrationId,
  isActive,
  onQuotaError, 
  onQuotaRecovered,
  onQuotaWarning,
  showDetailedStats = true,
  autoRefresh = true,
  refreshInterval = 5000
}: DriveQuotaManagerProps) {
  const [quotaStatus, setQuotaStatus] = useState<DriveQuotaStatus>({
    requestsPerMinute: {
      used: 0,
      limit: 1000,
      resetTime: new Date(Date.now() + 60000).toISOString(),
      percentage: 0
    },
    requestsPerDay: {
      used: 0,
      limit: 1000000,
      resetTime: new Date(Date.now() + 86400000).toISOString(),
      percentage: 0
    },
    storage: {
      used: '0 GB',
      limit: '15 GB',
      percentage: 0
    },
    bandwidth: {
      used: '0 GB',
      limit: '750 GB',
      percentage: 0
    },
    health: 'healthy',
    lastUpdate: new Date().toISOString(),
    isMonitoring: false,
    retryQueue: []
  })
  
  const [quotaErrors, setQuotaErrors] = useState<DriveQuotaError[]>([])
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [wsConnected, setWsConnected] = useState(false)
  const [retryStrategy, setRetryStrategy] = useState<{
    attempts: number
    nextRetry: Date | null
    backoffMultiplier: number
  }>({
    attempts: 0,
    nextRetry: null,
    backoffMultiplier: 1
  })

  // WebSocket connection for real-time quota monitoring
  useEffect(() => {
    if (!isActive || !autoRefresh) return

    const ws = new WebSocket('ws://localhost:3002/logs')

    ws.onopen = () => {
      setWsConnected(true)
      setIsMonitoring(true)
      console.log('📊 Drive quota monitor connected to WebSocket')
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        
        if (data.type === 'log' && data.service === 'drive') {
          handleDriveLogEvent(data)
        }
      } catch (error) {
        console.error('WebSocket message parse error:', error)
      }
    }

    ws.onclose = () => {
      setWsConnected(false)
      setIsMonitoring(false)
      console.log('📊 Drive quota monitor disconnected')
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      setWsConnected(false)
    }

    return () => {
      ws.close()
    }
  }, [isActive, autoRefresh])

  // Auto-refresh quota status
  useEffect(() => {
    if (!autoRefresh || !isActive) return

    const interval = setInterval(() => {
      refreshQuotaStatus()
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [autoRefresh, isActive, refreshInterval])

  const handleDriveLogEvent = useCallback((event: any) => {
    // Update quota usage from logs
    if (event.details && event.details.quotaUsage) {
      updateQuotaFromUsage(event.details.quotaUsage)
    }

    // Handle quota errors
    if (event.level === 'error' && event.details) {
      const details = event.details

      if (details.error?.includes('quota') || 
          details.error?.includes('Quota exceeded') ||
          details.status === 429) {
        
        const quotaError: DriveQuotaError = {
          error: details.error || 'Quota exceeded',
          failedFiles: details.failedFiles || 0,
          remainingFiles: details.remainingFiles || 0,
          quotaType: determineQuotaType(details.error || ''),
          resetTime: details.resetTime,
          retryAfter: details.retryAfter || calculateRetryDelay(),
          status: details.status || 429,
          endpoint: details.endpoint
        }

        addQuotaError(quotaError)
        onQuotaError?.(quotaError)
        implementRetryStrategy(quotaError)
      }
    }

    // Handle successful recovery
    if (event.level === 'success' && retryStrategy.attempts > 0) {
      handleQuotaRecovery()
    }
  }, [onQuotaError, retryStrategy])

  const updateQuotaFromUsage = (usage: QuotaUsage) => {
    setQuotaStatus(prev => {
      const minutePercentage = (usage.requestsThisMinute / 1000) * 100
      const dayPercentage = (usage.requestsToday / 1000000) * 100
      
      let health: 'healthy' | 'warning' | 'critical' | 'quota_exceeded' = 'healthy'
      
      if (minutePercentage > 95) {
        health = 'quota_exceeded'
      } else if (minutePercentage > 80) {
        health = 'critical'
      } else if (minutePercentage > 60) {
        health = 'warning'
      }

      // Trigger warning callback
      if (minutePercentage > 80 && prev.requestsPerMinute.percentage <= 80) {
        onQuotaWarning?.(minutePercentage)
      }

      return {
        ...prev,
        requestsPerMinute: {
          ...prev.requestsPerMinute,
          used: usage.requestsThisMinute,
          percentage: minutePercentage,
          resetTime: new Date(usage.lastReset + 60000).toISOString()
        },
        requestsPerDay: {
          ...prev.requestsPerDay,
          used: usage.requestsToday,
          percentage: dayPercentage
        },
        health,
        lastUpdate: new Date().toISOString()
      }
    })
  }

  const determineQuotaType = (error: string): DriveQuotaError['quotaType'] => {
    if (error.includes('requests per minute') || error.includes('rate limit')) {
      return 'requests_per_minute'
    }
    if (error.includes('requests per day')) {
      return 'requests_per_day'
    }
    if (error.includes('storage') || error.includes('space')) {
      return 'storage'
    }
    if (error.includes('bandwidth')) {
      return 'bandwidth'
    }
    return 'requests_per_minute' // Default
  }

  const calculateRetryDelay = (): number => {
    const baseDelay = 60000 // 1 minute
    const maxDelay = 3600000 // 1 hour
    const delay = Math.min(
      baseDelay * Math.pow(2, retryStrategy.attempts),
      maxDelay
    )
    return delay
  }

  const addQuotaError = (error: DriveQuotaError) => {
    setQuotaErrors(prev => [...prev.slice(-9), error]) // Keep last 10 errors
    
    setQuotaStatus(prev => ({
      ...prev,
      health: 'quota_exceeded',
      lastUpdate: new Date().toISOString()
    }))
  }

  const implementRetryStrategy = (error: DriveQuotaError) => {
    const delay = error.retryAfter || calculateRetryDelay()
    const nextRetry = new Date(Date.now() + delay)
    
    setRetryStrategy(prev => ({
      attempts: prev.attempts + 1,
      nextRetry,
      backoffMultiplier: prev.backoffMultiplier * 2
    }))

    // Add to retry queue
    if (error.endpoint) {
      setQuotaStatus(prev => ({
        ...prev,
        retryQueue: [...prev.retryQueue, {
          fileId: `file-${Date.now()}`,
          fileName: error.endpoint || 'unknown',
          retryAt: nextRetry.toISOString(),
          attempts: retryStrategy.attempts + 1
        }]
      }))
    }
  }

  const handleQuotaRecovery = () => {
    onQuotaRecovered?.()
    
    setRetryStrategy({
      attempts: 0,
      nextRetry: null,
      backoffMultiplier: 1
    })

    setQuotaStatus(prev => ({
      ...prev,
      health: prev.requestsPerMinute.percentage > 80 ? 'warning' : 'healthy',
      retryQueue: []
    }))
  }

  const refreshQuotaStatus = async () => {
    try {
      // Simulate API call to get quota status
      const response = await fetch(`/api/drive/quota?migrationId=${migrationId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.quotaUsage) {
          updateQuotaFromUsage(data.quotaUsage)
        }
      }
    } catch (error) {
      console.error('Failed to refresh quota status:', error)
    }
  }

  const toggleMonitoring = () => {
    setIsMonitoring(!isMonitoring)
  }

  const clearErrors = () => {
    setQuotaErrors([])
  }

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy': return 'text-green-600 bg-green-100'
      case 'warning': return 'text-yellow-600 bg-yellow-100'
      case 'critical': return 'text-orange-600 bg-orange-100'
      case 'quota_exceeded': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getProgressVariant = (percentage: number) => {
    if (percentage > 90) return 'danger'
    if (percentage > 70) return 'warning'
    return 'default'
  }

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString()
  }

  return (
    <div className="space-y-4">
      {/* Main Quota Status Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-500 rounded-lg">
                <HardDrive className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Drive API Quota</h3>
                <p className="text-sm text-gray-600">
                  Migration: {migrationId} • {isActive ? 'Active' : 'Inactive'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Badge className={getHealthColor(quotaStatus.health)}>
                {quotaStatus.health.replace('_', ' ')}
              </Badge>
              
              <div className="flex items-center space-x-1 text-sm text-gray-500">
                {wsConnected ? (
                  <Wifi className="h-4 w-4 text-green-500" />
                ) : (
                  <WifiOff className="h-4 w-4 text-red-500" />
                )}
                <span>{wsConnected ? 'Connected' : 'Disconnected'}</span>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={toggleMonitoring}
              >
                {isMonitoring ? (
                  <>
                    <Pause className="h-4 w-4 mr-1" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-1" />
                    Monitor
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Requests Per Minute */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Requests Per Minute</span>
              <span className="text-sm text-gray-600">
                {quotaStatus.requestsPerMinute.used} / {quotaStatus.requestsPerMinute.limit}
              </span>
            </div>
            <Progress 
              value={quotaStatus.requestsPerMinute.percentage} 
              variant={getProgressVariant(quotaStatus.requestsPerMinute.percentage) as any}
              className="h-2"
            />
            <div className="text-xs text-gray-500">
              Resets at {formatTime(quotaStatus.requestsPerMinute.resetTime)}
            </div>
          </div>

          {/* Requests Per Day */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Requests Per Day</span>
              <span className="text-sm text-gray-600">
                {quotaStatus.requestsPerDay.used} / {quotaStatus.requestsPerDay.limit}
              </span>
            </div>
            <Progress 
              value={quotaStatus.requestsPerDay.percentage} 
              variant={getProgressVariant(quotaStatus.requestsPerDay.percentage) as any}
              className="h-2"
            />
          </div>

          {/* Retry Queue */}
          {quotaStatus.retryQueue.length > 0 && (
            <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="flex items-center space-x-2 mb-2">
                <Clock className="h-4 w-4 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-800">
                  Retry Queue ({quotaStatus.retryQueue.length} items)
                </span>
              </div>
              {retryStrategy.nextRetry && (
                <p className="text-xs text-yellow-700">
                  Next retry: {formatTime(retryStrategy.nextRetry.toISOString())}
                </p>
              )}
            </div>
          )}

          {/* Recent Errors */}
          {quotaErrors.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Recent Quota Errors</span>
                <Button variant="ghost" size="sm" onClick={clearErrors}>
                  Clear
                </Button>
              </div>
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {quotaErrors.slice(-3).map((error, index) => (
                  <div key={index} className="text-xs p-2 bg-red-50 rounded border border-red-200">
                    <div className="font-medium text-red-800">{error.error}</div>
                    <div className="text-red-600">
                      Failed: {error.failedFiles} • Remaining: {error.remainingFiles}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="text-xs text-gray-500">
              Last update: {formatTime(quotaStatus.lastUpdate)}
            </div>
            <Button variant="ghost" size="sm" onClick={refreshQuotaStatus}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Stats (if enabled) */}
      {showDetailedStats && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-gray-600" />
              <span className="font-medium">Detailed Statistics</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Storage Used:</span>
                <span className="ml-2 font-medium">{quotaStatus.storage.used}</span>
              </div>
              <div>
                <span className="text-gray-600">Bandwidth Used:</span>
                <span className="ml-2 font-medium">{quotaStatus.bandwidth.used}</span>
              </div>
              <div>
                <span className="text-gray-600">Retry Attempts:</span>
                <span className="ml-2 font-medium">{retryStrategy.attempts}</span>
              </div>
              <div>
                <span className="text-gray-600">Error Count:</span>
                <span className="ml-2 font-medium">{quotaErrors.length}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
