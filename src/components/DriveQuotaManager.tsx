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
  migrationId?: string
  isActive?: boolean
  onQuotaError?: (error: DriveQuotaError) => void
  onQuotaRecovered?: () => void
  onQuotaWarning?: (usage: number) => void
  showDetailedStats?: boolean
  autoRefresh?: boolean
  refreshInterval?: number
}

export function DriveQuotaManager({ 
  onQuotaError, 
  onQuotaRecovered, 
  migrationId,
  isActive = false 
}: DriveQuotaManagerProps) {
  const [quotaStatus, setQuotaStatus] = useState<DriveQuotaStatus | null>(null)
  const [quotaErrors, setQuotaErrors] = useState<DriveQuotaError[]>([])
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [retryStrategy, setRetryStrategy] = useState<{
    attempts: number
    nextRetry: Date | null
    backoffMultiplier: number
  }>({
    attempts: 0,
    nextRetry: null,
    backoffMultiplier: 1
  })

  // Simulated WebSocket connection for quota monitoring
  useEffect(() => {
    if (!isActive || !isMonitoring) return

    const ws = new WebSocket('ws://localhost:3002/migration-logs')

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        
        if (data.type === 'log-event' && data.event.service === 'drive') {
          handleDriveLogEvent(data.event)
        }
      } catch (error) {
        console.error('WebSocket message parse error:', error)
      }
    }

    ws.onopen = () => {
      console.log('📊 Drive quota monitor connected')
      setIsMonitoring(true)
    }

    ws.onclose = () => {
      console.log('📊 Drive quota monitor disconnected')
      setIsMonitoring(false)
    }

    return () => {
      ws.close()
    }
  }, [isActive, isMonitoring])

  const handleDriveLogEvent = useCallback((event: any) => {
    // Check for quota-related errors
    if (event.level === 'error' && event.details) {
      const details = event.details

      // Handle quota exceeded errors
      if (details.error?.includes('quota') || 
          details.error?.includes('Quota exceeded') ||
          details.status === 429) {
        
        const quotaError: DriveQuotaError = {
          error: details.error || 'Quota exceeded',
          failedFiles: details.failedFiles || 0,
          remainingFiles: details.remainingFiles || 0,
          quotaType: determineQuotaType(details.error),
          resetTime: details.resetTime,
          retryAfter: details.retryAfter || calculateRetryDelay(),
          status: details.status || 429,
          endpoint: details.endpoint
        }

        setQuotaErrors(prev => [...prev, quotaError])
        onQuotaError?.(quotaError)
        
        // Implement exponential backoff
        implementRetryStrategy(quotaError)
      }
    }

    // Handle successful API calls to reset retry strategy
    if (event.level === 'success') {
      resetRetryStrategy()
    }
  }, [onQuotaError])

  const determineQuotaType = (error: string): 'requests_per_minute' | 'requests_per_day' | 'storage' | 'bandwidth' => {
    if (error.includes('requests per minute') || error.includes('rate limit')) {
      return 'requests_per_minute'
    }
    if (error.includes('requests per day') || error.includes('daily quota')) {
      return 'requests_per_day'
    }
    if (error.includes('storage') || error.includes('space')) {
      return 'storage'
    }
    return 'bandwidth'
  }

  const calculateRetryDelay = (): number => {
    // Exponential backoff: 1min, 2min, 4min, 8min, 16min (max)
    const baseDelay = 60000 // 1 minute in milliseconds
    const maxDelay = 960000 // 16 minutes
    const delay = Math.min(baseDelay * Math.pow(2, retryStrategy.attempts), maxDelay)
    return delay
  }

  const implementRetryStrategy = (error: DriveQuotaError) => {
    const delay = error.retryAfter || calculateRetryDelay()
    const nextRetry = new Date(Date.now() + delay)

    setRetryStrategy(prev => ({
      attempts: prev.attempts + 1,
      nextRetry,
      backoffMultiplier: Math.min(prev.backoffMultiplier * 2, 16)
    }))

    // Log quota management strategy via WebSocket
    logQuotaStrategy(error, nextRetry)
  }

  const resetRetryStrategy = () => {
    setRetryStrategy({
      attempts: 0,
      nextRetry: null,
      backoffMultiplier: 1
    })
    onQuotaRecovered?.()
  }

  const logQuotaStrategy = (error: DriveQuotaError, nextRetry: Date) => {
    // This would send logs to WebSocket logger
    console.log('📊 Drive quota strategy:', {
      quotaType: error.quotaType,
      failedFiles: error.failedFiles,
      remainingFiles: error.remainingFiles,
      nextRetry: nextRetry.toISOString(),
      strategy: 'exponential_backoff'
    })
  }

  const getQuotaStatusColor = (percentage: number) => {
    if (percentage >= 90) return 'danger'
    if (percentage >= 75) return 'warning'
    return 'success'
  }

  const formatTimeUntilRetry = () => {
    if (!retryStrategy.nextRetry) return null
    
    const now = new Date()
    const diff = retryStrategy.nextRetry.getTime() - now.getTime()
    
    if (diff <= 0) return 'Ready to retry'
    
    const minutes = Math.ceil(diff / 60000)
    return `${minutes} minutes`
  }

  const startMonitoring = () => {
    setIsMonitoring(true)
  }

  const stopMonitoring = () => {
    setIsMonitoring(false)
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            <h3 className="text-lg font-semibold">Drive API Quota Monitor</h3>
            {isMonitoring ? (
              <Badge variant="success" className="text-xs">
                <Database className="h-3 w-3 mr-1" />
                Monitoring
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs">
                <Database className="h-3 w-3 mr-1" />
                Inactive
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {quotaErrors.length > 0 && (
              <Badge variant="danger" className="text-xs">
                {quotaErrors.length} quota issues
              </Badge>
            )}
            
            {!isMonitoring ? (
              <Button variant="outline" size="sm" onClick={startMonitoring}>
                <Zap className="h-4 w-4 mr-1" />
                Start Monitoring
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={stopMonitoring}>
                <XCircle className="h-4 w-4 mr-1" />
                Stop
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Quota Status Overview */}
        {quotaStatus && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Requests/Min</span>
                <Badge variant={getQuotaStatusColor((quotaStatus.requestsPerMinute.used / quotaStatus.requestsPerMinute.limit) * 100)}>
                  {Math.round((quotaStatus.requestsPerMinute.used / quotaStatus.requestsPerMinute.limit) * 100)}%
                </Badge>
              </div>
              <div className="text-xs text-gray-600">
                {quotaStatus.requestsPerMinute.used.toLocaleString()} / {quotaStatus.requestsPerMinute.limit.toLocaleString()}
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Requests/Day</span>
                <Badge variant={getQuotaStatusColor((quotaStatus.requestsPerDay.used / quotaStatus.requestsPerDay.limit) * 100)}>
                  {Math.round((quotaStatus.requestsPerDay.used / quotaStatus.requestsPerDay.limit) * 100)}%
                </Badge>
              </div>
              <div className="text-xs text-gray-600">
                {quotaStatus.requestsPerDay.used.toLocaleString()} / {quotaStatus.requestsPerDay.limit.toLocaleString()}
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Storage</span>
                <Badge variant={getQuotaStatusColor(quotaStatus.storage.percentage)}>
                  {quotaStatus.storage.percentage}%
                </Badge>
              </div>
              <div className="text-xs text-gray-600">
                {quotaStatus.storage.used} / {quotaStatus.storage.limit}
              </div>
            </div>
          </div>
        )}

        {/* Active Quota Errors */}
        {quotaErrors.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Recent Quota Issues
            </h4>
            
            {quotaErrors.slice(-3).map((error, index) => (
              <div key={index} className="p-3 border-l-4 border-orange-500 bg-orange-50 rounded-r-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-orange-800">
                    {error.quotaType.charAt(0).toUpperCase() + error.quotaType.slice(1)} Quota Exceeded
                  </span>
                  <Badge variant="warning" className="text-xs">
                    {error.failedFiles} files failed
                  </Badge>
                </div>
                
                <div className="text-xs text-orange-700 space-y-1">
                  <div>• Failed: {error.failedFiles} files</div>
                  <div>• Remaining: {error.remainingFiles} files</div>
                  {error.retryAfter && (
                    <div>• Retry after: {Math.round(error.retryAfter / 60000)} minutes</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Retry Strategy Status */}
        {retryStrategy.nextRetry && (
          <div className="p-3 bg-blue-50 border-l-4 border-blue-500 rounded-r-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-blue-800 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Retry Strategy Active
              </span>
              <Badge variant="info" className="text-xs">
                Attempt #{retryStrategy.attempts}
              </Badge>
            </div>
            
            <div className="text-xs text-blue-700 space-y-1">
              <div>• Strategy: Exponential backoff</div>
              <div>• Next retry: {formatTimeUntilRetry()}</div>
              <div>• Backoff multiplier: {retryStrategy.backoffMultiplier}x</div>
            </div>
            
            <div className="mt-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={resetRetryStrategy}
                className="text-xs"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Reset Strategy
              </Button>
            </div>
          </div>
        )}

        {/* Quota Management Recommendations */}
        <div className="p-3 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Quota Optimization Tips
          </h4>
          
          <div className="text-xs text-gray-600 space-y-1">
            <div>• Implement batch processing for large file migrations</div>
            <div>• Use exponential backoff with jitter for retries</div>
            <div>• Monitor quota usage in real-time during migrations</div>
            <div>• Consider upgrading to higher quota limits for large migrations</div>
            <div>• Schedule migrations during off-peak hours</div>
          </div>
        </div>

        {/* WebSocket Connection Status */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Migration ID: {migrationId || 'N/A'}</span>
          <span className="flex items-center gap-1">
            {isMonitoring ? (
              <>
                <CheckCircle className="h-3 w-3 text-green-500" />
                WebSocket Connected
              </>
            ) : (
              <>
                <XCircle className="h-3 w-3 text-red-500" />
                WebSocket Disconnected
              </>
            )}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
