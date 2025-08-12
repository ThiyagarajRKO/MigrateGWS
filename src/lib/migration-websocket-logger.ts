/**
 * WebSocket Real-Time Migration Logging System
 * Provides live updates for delegation validation and migration progress
 */

import { WebSocketServer } from 'ws'
import { createServer } from 'http'
import { parse } from 'url'

interface MigrationLogEvent {
  timestamp: string
  level: 'info' | 'warning' | 'error' | 'success'
  category: 'delegation' | 'api' | 'migration' | 'system'
  service?: 'gmail' | 'drive' | 'calendar' | 'groups' | 'photos' | 'forms' | 'sites' | 'chat'
  domain?: string
  message: string
  details?: any
  sessionId?: string
  migrationId?: string
}

class MigrationLogger {
  private static instance: MigrationLogger
  private wss: WebSocketServer | null = null
  private isInitialized = false
  private logBuffer: MigrationLogEvent[] = []
  private maxBufferSize = 1000

  private constructor() {}

  static getInstance(): MigrationLogger {
    if (!MigrationLogger.instance) {
      MigrationLogger.instance = new MigrationLogger()
    }
    return MigrationLogger.instance
  }

  initialize(server?: any) {
    if (this.isInitialized) return

    try {
      // Create WebSocket server
      this.wss = new WebSocketServer({ 
        port: 3001,
        path: '/migration-logs'
      })

      this.wss.on('connection', (ws, request) => {
        const url = parse(request.url || '', true)
        const sessionId = url.query.sessionId as string

        console.log(`🔌 WebSocket client connected: ${sessionId || 'anonymous'}`)
        
        // Send buffered logs to new client
        if (this.logBuffer.length > 0) {
          ws.send(JSON.stringify({
            type: 'log-history',
            logs: this.logBuffer.slice(-50) // Send last 50 logs
          }))
        }

        ws.on('message', (message) => {
          try {
            const data = JSON.parse(message.toString())
            if (data.type === 'ping') {
              ws.send(JSON.stringify({ type: 'pong' }))
            }
          } catch (error) {
            console.error('WebSocket message parse error:', error)
          }
        })

        ws.on('close', () => {
          console.log(`🔌 WebSocket client disconnected: ${sessionId || 'anonymous'}`)
        })

        ws.on('error', (error) => {
          console.error('WebSocket error:', error)
        })
      })

      this.isInitialized = true
      console.log('🚀 Migration WebSocket Logger initialized on port 3001')
    } catch (error) {
      console.error('Failed to initialize WebSocket logger:', error)
    }
  }

  log(event: Omit<MigrationLogEvent, 'timestamp'>) {
    const logEvent: MigrationLogEvent = {
      ...event,
      timestamp: new Date().toISOString()
    }

    // Add to buffer
    this.logBuffer.push(logEvent)
    
    // Maintain buffer size
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer = this.logBuffer.slice(-this.maxBufferSize)
    }

    // Console log with formatting
    this.consoleLog(logEvent)

    // Broadcast to WebSocket clients
    this.broadcast(logEvent)
  }

  private consoleLog(event: MigrationLogEvent) {
    const timestamp = new Date(event.timestamp).toLocaleTimeString()
    const levelIcon = this.getLevelIcon(event.level)
    const categoryIcon = this.getCategoryIcon(event.category)
    
    const prefix = `${timestamp} ${levelIcon} ${categoryIcon}`
    const serviceInfo = event.service ? `[${event.service.toUpperCase()}]` : ''
    const domainInfo = event.domain ? `(${event.domain})` : ''
    
    console.log(`${prefix} ${serviceInfo}${domainInfo} ${event.message}`)
    
    if (event.details) {
      console.log('📊 Details:', JSON.stringify(event.details, null, 2))
    }
  }

  private broadcast(event: MigrationLogEvent) {
    if (!this.wss) return

    const message = JSON.stringify({
      type: 'log-event',
      event
    })

    this.wss.clients.forEach((client) => {
      if (client.readyState === client.OPEN) {
        try {
          client.send(message)
        } catch (error) {
          console.error('Failed to send WebSocket message:', error)
        }
      }
    })
  }

  private getLevelIcon(level: MigrationLogEvent['level']): string {
    switch (level) {
      case 'info': return 'ℹ️'
      case 'warning': return '⚠️'
      case 'error': return '❌'
      case 'success': return '✅'
      default: return '📝'
    }
  }

  private getCategoryIcon(category: MigrationLogEvent['category']): string {
    switch (category) {
      case 'delegation': return '🔐'
      case 'api': return '🌐'
      case 'migration': return '📦'
      case 'system': return '⚙️'
      default: return '📋'
    }
  }

  // Convenience methods for different log types
  delegation(message: string, details?: any, domain?: string) {
    this.log({
      level: 'info',
      category: 'delegation',
      message,
      details,
      domain
    })
  }

  delegationSuccess(message: string, details?: any, domain?: string) {
    this.log({
      level: 'success',
      category: 'delegation',
      message,
      details,
      domain
    })
  }

  delegationError(message: string, error?: any, domain?: string) {
    this.log({
      level: 'error',
      category: 'delegation',
      message,
      details: error,
      domain
    })
  }

  apiCall(service: MigrationLogEvent['service'], message: string, details?: any, domain?: string) {
    this.log({
      level: 'info',
      category: 'api',
      service,
      message,
      details,
      domain
    })
  }

  apiSuccess(service: MigrationLogEvent['service'], message: string, details?: any, domain?: string) {
    this.log({
      level: 'success',
      category: 'api',
      service,
      message,
      details,
      domain
    })
  }

  apiError(service: MigrationLogEvent['service'], message: string, error?: any, domain?: string) {
    this.log({
      level: 'error',
      category: 'api',
      service,
      message,
      details: error,
      domain
    })
  }

  migration(service: MigrationLogEvent['service'], message: string, migrationId?: string, details?: any) {
    this.log({
      level: 'info',
      category: 'migration',
      service,
      message,
      migrationId,
      details
    })
  }

  migrationSuccess(service: MigrationLogEvent['service'], message: string, migrationId?: string, details?: any) {
    this.log({
      level: 'success',
      category: 'migration',
      service,
      message,
      migrationId,
      details
    })
  }

  migrationError(service: MigrationLogEvent['service'], message: string, migrationId?: string, error?: any) {
    this.log({
      level: 'error',
      category: 'migration',
      service,
      message,
      migrationId,
      details: error
    })
  }

  system(message: string, details?: any) {
    this.log({
      level: 'info',
      category: 'system',
      message,
      details
    })
  }

  systemError(message: string, error?: any) {
    this.log({
      level: 'error',
      category: 'system',
      message,
      details: error
    })
  }

  close() {
    if (this.wss) {
      this.wss.close()
      this.isInitialized = false
      console.log('🔌 Migration WebSocket Logger closed')
    }
  }
}

// Export singleton instance
export const migrationLogger = MigrationLogger.getInstance()

// Auto-initialize when module is loaded
if (process.env.NODE_ENV === 'development') {
  migrationLogger.initialize()
}
