/**
 * WebSocket Real-Time Migration Logging System (JavaScript Version)
 * Provides live updates for delegation validation and migration progress
 */

import { WebSocketServer } from 'ws'

class MigrationLogger {
  constructor() {
    this.wss = null
    this.isInitialized = false
    this.logBuffer = []
    this.maxBufferSize = 1000
  }

  initialize() {
    if (this.isInitialized) return

    try {
      // Create WebSocket server
      this.wss = new WebSocketServer({ 
        port: 3002,  // Use different port to avoid conflicts
        path: '/migration-logs'
      })

      this.wss.on('connection', (ws, request) => {
        const url = new URL(request.url, 'ws://localhost:3001')
        const sessionId = url.searchParams.get('sessionId')

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
      console.log('🚀 Migration WebSocket Logger initialized on port 3002')
    } catch (error) {
      console.error('Failed to initialize WebSocket logger:', error)
    }
  }

  log(event) {
    const logEvent = {
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

  consoleLog(event) {
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

  broadcast(event) {
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

  getLevelIcon(level) {
    switch (level) {
      case 'info': return 'ℹ️'
      case 'warning': return '⚠️'
      case 'error': return '❌'
      case 'success': return '✅'
      default: return '📝'
    }
  }

  getCategoryIcon(category) {
    switch (category) {
      case 'delegation': return '🔐'
      case 'api': return '🌐'
      case 'migration': return '📦'
      case 'system': return '⚙️'
      default: return '📋'
    }
  }

  // Convenience methods for different log types
  delegation(message, details, domain) {
    this.log({
      level: 'info',
      category: 'delegation',
      message,
      details,
      domain
    })
  }

  delegationSuccess(message, details, domain) {
    this.log({
      level: 'success',
      category: 'delegation',
      message,
      details,
      domain
    })
  }

  delegationError(message, error, domain) {
    this.log({
      level: 'error',
      category: 'delegation',
      message,
      details: error,
      domain
    })
  }

  apiCall(service, message, details, domain) {
    this.log({
      level: 'info',
      category: 'api',
      service,
      message,
      details,
      domain
    })
  }

  apiSuccess(service, message, details, domain) {
    this.log({
      level: 'success',
      category: 'api',
      service,
      message,
      details,
      domain
    })
  }

  apiError(service, message, error, domain) {
    this.log({
      level: 'error',
      category: 'api',
      service,
      message,
      details: error,
      domain
    })
  }

  migration(service, message, migrationId, details) {
    this.log({
      level: 'info',
      category: 'migration',
      service,
      message,
      migrationId,
      details
    })
  }

  migrationSuccess(service, message, migrationId, details) {
    this.log({
      level: 'success',
      category: 'migration',
      service,
      message,
      migrationId,
      details
    })
  }

  migrationError(service, message, migrationId, error) {
    this.log({
      level: 'error',
      category: 'migration',
      service,
      message,
      migrationId,
      details: error
    })
  }

  system(message, details) {
    this.log({
      level: 'info',
      category: 'system',
      message,
      details
    })
  }

  systemError(message, error) {
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
export const migrationLogger = new MigrationLogger()
