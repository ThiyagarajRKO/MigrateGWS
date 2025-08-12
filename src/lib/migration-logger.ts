import { WebSocketServer } from 'ws'

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

export interface MigrationProgress {
  service: string
  user: string
  totalItems: number
  processedItems: number
  currentItem?: string
  status: 'starting' | 'in-progress' | 'completed' | 'failed' | 'paused'
  errors?: string[]
  warnings?: string[]
}

/**
 * Real-time migration logger with WebSocket broadcasting
 * Provides centralized logging for all migration operations
 */
export class MigrationLogger {
  private static instance: MigrationLogger
  private wss: WebSocketServer | null = null
  private isInitialized = false

  private constructor() {}

  static getInstance(): MigrationLogger {
    if (!MigrationLogger.instance) {
      MigrationLogger.instance = new MigrationLogger()
    }
    return MigrationLogger.instance
  }

  /**
   * Initialize WebSocket server (if not already running)
   */
  initialize() {
    if (this.isInitialized || this.wss) {
      return
    }

    try {
      this.wss = new WebSocketServer({ 
        port: 8080,
        perMessageDeflate: false,
        path: '/migration-logs'
      })

      this.wss.on('connection', (ws, request) => {
        console.log(`🔌 Migration logger client connected from ${request.socket.remoteAddress}`)
        
        // Send welcome message
        this.sendToClient(ws, {
          type: 'status',
          service: 'system',
          message: 'Connected to migration real-time logger',
          timestamp: new Date().toISOString(),
          details: {
            server: 'Migration Logger WebSocket Server',
            version: '1.0.0',
            capabilities: ['real-time-logs', 'progress-tracking', 'error-monitoring']
          }
        })

        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString())
            if (message.type === 'ping') {
              this.sendToClient(ws, {
                type: 'status',
                service: 'system',
                message: 'pong',
                timestamp: new Date().toISOString()
              })
            }
          } catch (error) {
            console.error('❌ Error parsing WebSocket message:', error)
          }
        })

        ws.on('close', () => {
          console.log('🔌 Migration logger client disconnected')
        })

        ws.on('error', (error) => {
          console.error('❌ Migration logger WebSocket error:', error)
        })
      })

      this.wss.on('error', (error) => {
        console.error('❌ Migration logger server error:', error)
      })

      this.isInitialized = true
      console.log('✅ Migration Logger WebSocket server initialized on port 8080')
    } catch (error) {
      console.error('❌ Failed to initialize Migration Logger WebSocket server:', error)
    }
  }

  /**
   * Send message to a specific WebSocket client
   */
  private sendToClient(ws: any, message: LogMessage) {
    if (ws.readyState === 1) { // WebSocket.OPEN
      ws.send(JSON.stringify(message))
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  private broadcast(message: LogMessage) {
    if (!this.wss) {
      this.initialize()
    }

    if (this.wss) {
      this.wss.clients.forEach((client) => {
        this.sendToClient(client, message)
      })
    }
  }

  /**
   * Log general information
   */
  info(service: string, message: string, details?: any, user?: string) {
    const logMessage: LogMessage = {
      type: 'info',
      level: 'info',
      category: 'migration',
      service,
      user,
      message,
      details,
      timestamp: new Date().toISOString()
    }
    
    console.log(`ℹ️ [${service}] ${message}`, details ? details : '')
    this.broadcast(logMessage)
  }

  /**
   * Log warnings
   */
  warning(service: string, message: string, details?: any, user?: string) {
    const logMessage: LogMessage = {
      type: 'warning',
      level: 'warning',
      category: 'migration',
      service,
      user,
      message,
      details,
      timestamp: new Date().toISOString()
    }
    
    console.warn(`⚠️ [${service}] ${message}`, details ? details : '')
    this.broadcast(logMessage)
  }

  /**
   * Log errors
   */
  error(service: string, message: string, details?: any, user?: string) {
    const logMessage: LogMessage = {
      type: 'error',
      level: 'error',
      category: 'migration',
      service,
      user,
      message,
      details,
      timestamp: new Date().toISOString()
    }
    
    console.error(`❌ [${service}] ${message}`, details ? details : '')
    this.broadcast(logMessage)
  }

  /**
   * Log success messages
   */
  success(service: string, message: string, details?: any, user?: string) {
    const logMessage: LogMessage = {
      type: 'success',
      level: 'success',
      category: 'migration',
      service,
      user,
      message,
      details,
      timestamp: new Date().toISOString()
    }
    
    console.log(`✅ [${service}] ${message}`, details ? details : '')
    this.broadcast(logMessage)
  }

  /**
   * Log migration progress
   */
  progress(service: string, user: string, progress: MigrationProgress) {
    const percentage = Math.round((progress.processedItems / progress.totalItems) * 100)
    
    const logMessage: LogMessage = {
      type: 'progress',
      level: 'info',
      category: 'migration',
      service,
      user,
      message: `Migration progress: ${percentage}% (${progress.processedItems}/${progress.totalItems})`,
      progress: percentage,
      details: progress,
      timestamp: new Date().toISOString()
    }
    
    console.log(`📊 [${service}] ${user}: ${percentage}% complete`)
    this.broadcast(logMessage)
  }

  /**
   * Log API-specific messages
   */
  api(service: string, message: string, details?: any, user?: string, level: 'info' | 'warning' | 'error' = 'info') {
    const logMessage: LogMessage = {
      type: 'log',
      level,
      category: 'api',
      service,
      user,
      message,
      details,
      timestamp: new Date().toISOString()
    }
    
    const icon = level === 'error' ? '❌' : level === 'warning' ? '⚠️' : 'ℹ️'
    console.log(`${icon} [API:${service}] ${message}`, details ? details : '')
    this.broadcast(logMessage)
  }

  /**
   * Log authentication/delegation issues
   */
  auth(service: string, message: string, details?: any, user?: string, level: 'info' | 'warning' | 'error' = 'info') {
    const logMessage: LogMessage = {
      type: 'log',
      level,
      category: 'auth',
      service,
      user,
      message,
      details,
      timestamp: new Date().toISOString()
    }
    
    const icon = level === 'error' ? '🔒' : level === 'warning' ? '🔐' : '🔓'
    console.log(`${icon} [AUTH:${service}] ${message}`, details ? details : '')
    this.broadcast(logMessage)
  }

  /**
   * Log validation issues
   */
  validation(service: string, message: string, details?: any, user?: string, level: 'info' | 'warning' | 'error' = 'warning') {
    const logMessage: LogMessage = {
      type: 'log',
      level,
      category: 'validation',
      service,
      user,
      message,
      details,
      timestamp: new Date().toISOString()
    }
    
    const icon = level === 'error' ? '❌' : '⚠️'
    console.log(`${icon} [VALIDATION:${service}] ${message}`, details ? details : '')
    this.broadcast(logMessage)
  }

  /**
   * Get server status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      clientCount: this.wss?.clients.size || 0,
      port: 8080,
      path: '/migration-logs'
    }
  }
}

// Export singleton instance
export const migrationLogger = MigrationLogger.getInstance()

// Auto-initialize when imported
migrationLogger.initialize()
