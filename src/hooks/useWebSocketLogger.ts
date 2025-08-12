import { useState, useEffect, useCallback, useRef } from 'react'

export interface LogMessage {
  type: 'log' | 'progress' | 'error' | 'success' | 'warning' | 'info' | 'status'
  level?: 'info' | 'warning' | 'error' | 'success'
  category?: 'api' | 'migration' | 'auth' | 'validation' | 'delegation' | 'system'
  service: string
  user?: string
  message: string
  details?: any
  progress?: number
  timestamp: string
  sessionId?: string
}

export interface UseWebSocketLoggerOptions {
  autoConnect?: boolean
  reconnectAttempts?: number
  reconnectInterval?: number
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: Event) => void
  onMessage?: (message: LogMessage) => void
}

export interface WebSocketLoggerState {
  isConnected: boolean
  isConnecting: boolean
  logs: LogMessage[]
  error: string | null
  connectionAttempts: number
  lastMessage: LogMessage | null
}

/**
 * React hook for connecting to migration WebSocket logger
 * Provides real-time log streaming and connection management
 */
export function useWebSocketLogger(options: UseWebSocketLoggerOptions = {}) {
  const {
    autoConnect = true,
    reconnectAttempts = 5,
    reconnectInterval = 3000,
    onConnect,
    onDisconnect,
    onError,
    onMessage
  } = options

  const [state, setState] = useState<WebSocketLoggerState>({
    isConnected: false,
    isConnecting: false,
    logs: [],
    error: null,
    connectionAttempts: 0,
    lastMessage: null
  })

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const connectionAttemptsRef = useRef(0)

  /**
   * Connect to WebSocket server
   */
  const connect = useCallback(() => {
    if (state.isConnected || state.isConnecting) {
      return
    }

    setState(prev => ({ ...prev, isConnecting: true, error: null }))

    try {
      const ws = new WebSocket('ws://localhost:8080/migration-logs')
      wsRef.current = ws

      ws.onopen = () => {
        console.log('✅ Connected to migration logger WebSocket')
        connectionAttemptsRef.current = 0
        setState(prev => ({
          ...prev,
          isConnected: true,
          isConnecting: false,
          error: null,
          connectionAttempts: 0
        }))
        onConnect?.()
      }

      ws.onmessage = (event) => {
        try {
          const message: LogMessage = JSON.parse(event.data)
          
          setState(prev => ({
            ...prev,
            logs: [...prev.logs, message].slice(-1000), // Keep last 1000 logs
            lastMessage: message
          }))

          onMessage?.(message)
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error)
        }
      }

      ws.onclose = (event) => {
        console.log('🔌 WebSocket connection closed:', event.code, event.reason)
        wsRef.current = null
        setState(prev => ({
          ...prev,
          isConnected: false,
          isConnecting: false
        }))
        onDisconnect?.()

        // Attempt reconnection if not manually closed
        if (event.code !== 1000 && connectionAttemptsRef.current < reconnectAttempts) {
          connectionAttemptsRef.current++
          setState(prev => ({
            ...prev,
            connectionAttempts: connectionAttemptsRef.current
          }))

          console.log(`🔄 Attempting to reconnect (${connectionAttemptsRef.current}/${reconnectAttempts})...`)
          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, reconnectInterval)
        }
      }

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error)
        setState(prev => ({
          ...prev,
          error: 'WebSocket connection error',
          isConnecting: false
        }))
        onError?.(error)
      }

    } catch (error) {
      console.error('❌ Failed to create WebSocket connection:', error)
      setState(prev => ({
        ...prev,
        error: 'Failed to create WebSocket connection',
        isConnecting: false
      }))
    }
  }, [state.isConnected, state.isConnecting, reconnectAttempts, reconnectInterval, onConnect, onDisconnect, onError, onMessage])

  /**
   * Disconnect from WebSocket server
   */
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect')
      wsRef.current = null
    }

    connectionAttemptsRef.current = reconnectAttempts // Prevent auto-reconnect
    setState(prev => ({
      ...prev,
      isConnected: false,
      isConnecting: false,
      error: null
    }))
  }, [reconnectAttempts])

  /**
   * Send message to WebSocket server
   */
  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
    }
  }, [])

  /**
   * Clear all logs
   */
  const clearLogs = useCallback(() => {
    setState(prev => ({
      ...prev,
      logs: [],
      lastMessage: null
    }))
  }, [])

  /**
   * Filter logs by criteria
   */
  const filterLogs = useCallback((
    filter: {
      service?: string
      user?: string
      type?: string
      level?: string
      category?: string
    }
  ) => {
    return state.logs.filter(log => {
      if (filter.service && log.service !== filter.service) return false
      if (filter.user && log.user !== filter.user) return false
      if (filter.type && log.type !== filter.type) return false
      if (filter.level && log.level !== filter.level) return false
      if (filter.category && log.category !== filter.category) return false
      return true
    })
  }, [state.logs])

  /**
   * Get logs for specific service
   */
  const getServiceLogs = useCallback((service: string) => {
    return filterLogs({ service })
  }, [filterLogs])

  /**
   * Get logs for specific user
   */
  const getUserLogs = useCallback((user: string) => {
    return filterLogs({ user })
  }, [filterLogs])

  /**
   * Get error logs only
   */
  const getErrorLogs = useCallback(() => {
    return filterLogs({ level: 'error' })
  }, [filterLogs])

  /**
   * Get progress logs only
   */
  const getProgressLogs = useCallback(() => {
    return filterLogs({ type: 'progress' })
  }, [filterLogs])

  /**
   * Send ping to test connection
   */
  const ping = useCallback(() => {
    sendMessage({ type: 'ping', timestamp: new Date().toISOString() })
  }, [sendMessage])

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect()
    }

    // Cleanup on unmount
    return () => {
      disconnect()
    }
  }, [autoConnect]) // Only run on mount

  return {
    // State
    ...state,
    
    // Actions
    connect,
    disconnect,
    sendMessage,
    clearLogs,
    ping,
    
    // Utilities
    filterLogs,
    getServiceLogs,
    getUserLogs,
    getErrorLogs,
    getProgressLogs,
    
    // Status
    isReconnecting: state.connectionAttempts > 0 && state.connectionAttempts < reconnectAttempts
  }
}
