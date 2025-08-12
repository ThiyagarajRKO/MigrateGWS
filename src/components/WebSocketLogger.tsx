'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Activity, 
  Wifi, 
  WifiOff, 
  Trash2, 
  Download,
  Filter,
  Search
} from 'lucide-react'

interface MigrationLogEvent {
  timestamp: string
  level: 'info' | 'warning' | 'error' | 'success'
  category: 'delegation' | 'api' | 'migration' | 'system'
  service?: 'gmail' | 'drive' | 'calendar' | 'groups' | 'photos' | 'forms'
  domain?: string
  message: string
  details?: any
  sessionId?: string
  migrationId?: string
}

interface WebSocketLoggerProps {
  sessionId?: string
  maxLogs?: number
  autoScroll?: boolean
  showFilters?: boolean
}

export function WebSocketLogger({ 
  sessionId, 
  maxLogs = 200, 
  autoScroll = true,
  showFilters = true 
}: WebSocketLoggerProps) {
  const [logs, setLogs] = useState<MigrationLogEvent[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [filter, setFilter] = useState<{
    level?: string
    category?: string
    service?: string
    search?: string
  }>({})
  
  const wsRef = useRef<WebSocket | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    connectWebSocket()
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [sessionId])

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs, autoScroll])

  const connectWebSocket = () => {
    try {
      const wsUrl = `ws://localhost:3001/migration-logs${sessionId ? `?sessionId=${sessionId}` : ''}`
      wsRef.current = new WebSocket(wsUrl)

      wsRef.current.onopen = () => {
        setIsConnected(true)
        console.log('✅ WebSocket connected to migration logger')
      }

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          
          if (data.type === 'log-event') {
            setLogs(prevLogs => {
              const newLogs = [...prevLogs, data.event]
              return newLogs.slice(-maxLogs)
            })
          } else if (data.type === 'log-history') {
            setLogs(data.logs || [])
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      wsRef.current.onclose = () => {
        setIsConnected(false)
        console.log('🔌 WebSocket disconnected from migration logger')
        
        // Auto-reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket()
        }, 3000)
      }

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error)
        setIsConnected(false)
      }

      // Send ping every 30 seconds to keep connection alive
      const pingInterval = setInterval(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'ping' }))
        }
      }, 30000)

      // Cleanup ping interval when connection closes
      wsRef.current.addEventListener('close', () => {
        clearInterval(pingInterval)
      })

    } catch (error) {
      console.error('Failed to connect WebSocket:', error)
      setIsConnected(false)
    }
  }

  const clearLogs = () => {
    setLogs([])
  }

  const downloadLogs = () => {
    const logData = logs.map(log => ({
      ...log,
      detailsString: log.details ? JSON.stringify(log.details, null, 2) : undefined
    }))
    
    const blob = new Blob([JSON.stringify(logData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `migration-logs-${new Date().toISOString().slice(0, 19)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const filteredLogs = logs.filter(log => {
    if (filter.level && log.level !== filter.level) return false
    if (filter.category && log.category !== filter.category) return false
    if (filter.service && log.service !== filter.service) return false
    if (filter.search && !log.message.toLowerCase().includes(filter.search.toLowerCase())) return false
    return true
  })

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'danger'
      case 'warning': return 'warning'
      case 'success': return 'success'
      case 'info': return 'info'
      default: return 'outline'
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'delegation': return '🔐'
      case 'api': return '🌐'
      case 'migration': return '📦'
      case 'system': return '⚙️'
      default: return '📋'
    }
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            <h3 className="text-lg font-semibold">Migration Logs</h3>
            {isConnected ? (
              <div className="flex items-center gap-1 text-green-600">
                <Wifi className="h-4 w-4" />
                <span className="text-sm">Connected</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-red-600">
                <WifiOff className="h-4 w-4" />
                <span className="text-sm">Disconnected</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant="outline">{filteredLogs.length} logs</Badge>
            <Button variant="outline" size="sm" onClick={downloadLogs}>
              <Download className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={clearLogs}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-2 pt-2">
            <select
              className="px-2 py-1 text-sm border rounded"
              value={filter.level || ''}
              onChange={(e) => setFilter(prev => ({ ...prev, level: e.target.value || undefined }))}
            >
              <option value="">All Levels</option>
              <option value="info">Info</option>
              <option value="success">Success</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
            </select>

            <select
              className="px-2 py-1 text-sm border rounded"
              value={filter.category || ''}
              onChange={(e) => setFilter(prev => ({ ...prev, category: e.target.value || undefined }))}
            >
              <option value="">All Categories</option>
              <option value="delegation">Delegation</option>
              <option value="api">API</option>
              <option value="migration">Migration</option>
              <option value="system">System</option>
            </select>

            <select
              className="px-2 py-1 text-sm border rounded"
              value={filter.service || ''}
              onChange={(e) => setFilter(prev => ({ ...prev, service: e.target.value || undefined }))}
            >
              <option value="">All Services</option>
              <option value="gmail">Gmail</option>
              <option value="drive">Drive</option>
              <option value="calendar">Calendar</option>
              <option value="groups">Groups</option>
              <option value="photos">Photos</option>
              <option value="forms">Forms</option>
            </select>

            <div className="flex items-center gap-1">
              <Search className="h-4 w-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search logs..."
                className="px-2 py-1 text-sm border rounded"
                value={filter.search || ''}
                onChange={(e) => setFilter(prev => ({ ...prev, search: e.target.value || undefined }))}
              />
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent>
        <div className="h-96 overflow-y-auto" ref={scrollRef}>
          <div className="space-y-2">
            {filteredLogs.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                {logs.length === 0 ? 'No logs yet...' : 'No logs match current filters'}
              </div>
            ) : (
              filteredLogs.map((log, index) => (
                <div key={index} className="flex gap-3 p-3 bg-gray-50 rounded-lg text-sm">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-xs text-gray-500 font-mono">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    
                    <Badge variant={getLevelColor(log.level)} className="text-xs">
                      {log.level}
                    </Badge>
                    
                    <span className="text-sm">
                      {getCategoryIcon(log.category)}
                    </span>
                    
                    {log.service && (
                      <Badge variant="outline" className="text-xs">
                        {log.service}
                      </Badge>
                    )}
                    
                    {log.domain && (
                      <span className="text-xs text-blue-600 font-mono">
                        {log.domain}
                      </span>
                    )}
                    
                    <span className="flex-1 min-w-0">
                      {log.message}
                    </span>
                  </div>
                  
                  {log.details && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-blue-600">Details</summary>
                      <pre className="mt-1 p-2 bg-white rounded border text-xs overflow-x-auto">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
