/**
 * Real-time Migration Status WebSocket Server
 * Provides live updates for migration progress, job status, and system metrics
 */

import type { WebSocket as WSType, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { URL } from 'url';
import { Migration, MigrationJob, TenantUser } from '../../lib/database/schema';

interface WebSocketClient {
  ws: WSType;
  tenantId: string;
  userId: string;
  subscriptions: Set<string>;
  lastActivity: Date;
}

interface WebSocketMessage {
  type: 'subscribe' | 'unsubscribe' | 'ping' | 'get_status';
  data: any;
}

interface StatusUpdate {
  type: 'migration_progress' | 'job_status' | 'system_metrics' | 'error' | 'notification';
  migrationId?: string;
  jobId?: string;
  data: any;
  timestamp: string;
}

export class MigrationWebSocketServer {
  private wss?: WebSocketServer;
  private clients: Map<string, WebSocketClient> = new Map();
  private heartbeatInterval?: NodeJS.Timeout;

  constructor(port: number = 8080) {
    // Dynamic import for Node.js environment
    this.initializeServer(port);
  }

  private async initializeServer(port: number) {
    try {
      const { WebSocketServer: WSS } = await import('ws');
      this.wss = new WSS({ 
        port,
        verifyClient: this.verifyClient.bind(this)
      });
      
      this.wss.on('connection', this.handleConnection.bind(this));
      this.startHeartbeat();
      
      console.log(`Migration WebSocket server started on port ${port}`);
    } catch (error) {
      console.error('Failed to initialize WebSocket server:', error);
      throw error;
    }
  }

  /**
   * Verify client connection (authentication and tenant validation)
   */
  private async verifyClient(info: { origin: string; secure: boolean; req: IncomingMessage }): Promise<boolean> {
    try {
      const url = new URL(info.req.url || '', `http://${info.req.headers.host}`);
      const tenantId = url.searchParams.get('tenant');
      const token = url.searchParams.get('token');

      if (!tenantId || !token) {
        console.log('WebSocket: Missing tenant or token');
        return false;
      }

      // Validate tenant and token
      const isValid = await this.validateClientAuth(tenantId, token);
      return isValid;
    } catch (error) {
      console.error('WebSocket client verification error:', error);
      return false;
    }
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WSType, request: IncomingMessage) {
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    const tenantId = url.searchParams.get('tenant')!;
    const userId = url.searchParams.get('userId') || 'anonymous';
    
    const clientId = this.generateClientId();
    const client: WebSocketClient = {
      ws,
      tenantId,
      userId,
      subscriptions: new Set(),
      lastActivity: new Date()
    };

    this.clients.set(clientId, client);
    console.log(`WebSocket client connected: ${clientId} (tenant: ${tenantId})`);

    // Send welcome message
    this.sendToClient(clientId, {
      type: 'system_metrics',
      data: { 
        status: 'connected',
        clientId,
        serverTime: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });

    // Handle messages
    ws.on('message', (data: any) => this.handleMessage(clientId, data));
    
    // Handle disconnection
    ws.on('close', () => this.handleDisconnection(clientId));
    
    // Handle errors
    ws.on('error', (error: any) => this.handleError(clientId, error));
  }

  /**
   * Handle incoming messages from clients
   */
  private handleMessage(clientId: string, data: any) {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.lastActivity = new Date();

    try {
      const dataString = Buffer.isBuffer(data) ? data.toString() : String(data);
      const message: WebSocketMessage = JSON.parse(dataString);
      
      switch (message.type) {
        case 'subscribe':
          this.handleSubscribe(clientId, message.data);
          break;
        case 'unsubscribe':
          this.handleUnsubscribe(clientId, message.data);
          break;
        case 'ping':
          this.handlePing(clientId);
          break;
        case 'get_status':
          this.handleGetStatus(clientId, message.data);
          break;
        default:
          console.log(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error(`Error handling message from ${clientId}:`, error);
      this.sendError(clientId, 'Invalid message format');
    }
  }

  /**
   * Handle subscription requests
   */
  private handleSubscribe(clientId: string, data: { channel: string; migrationId?: string }) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const channel = data.migrationId ? 
      `${data.channel}:${data.migrationId}` : 
      data.channel;

    client.subscriptions.add(channel);
    
    this.sendToClient(clientId, {
      type: 'notification',
      data: { 
        message: `Subscribed to ${channel}`,
        channel
      },
      timestamp: new Date().toISOString()
    });

    console.log(`Client ${clientId} subscribed to ${channel}`);
  }

  /**
   * Handle unsubscribe requests
   */
  private handleUnsubscribe(clientId: string, data: { channel: string; migrationId?: string }) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const channel = data.migrationId ? 
      `${data.channel}:${data.migrationId}` : 
      data.channel;

    client.subscriptions.delete(channel);
    
    this.sendToClient(clientId, {
      type: 'notification',
      data: { 
        message: `Unsubscribed from ${channel}`,
        channel
      },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handle ping requests
   */
  private handlePing(clientId: string) {
    this.sendToClient(clientId, {
      type: 'system_metrics',
      data: { 
        pong: true,
        serverTime: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handle status requests
   */
  private async handleGetStatus(clientId: string, data: { migrationId?: string }) {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      if (data.migrationId) {
        // Get specific migration status
        const status = await this.getMigrationStatus(client.tenantId, data.migrationId);
        this.sendToClient(clientId, {
          type: 'migration_progress',
          migrationId: data.migrationId,
          data: status,
          timestamp: new Date().toISOString()
        });
      } else {
        // Get all active migrations for tenant
        const migrations = await this.getActiveMigrations(client.tenantId);
        this.sendToClient(clientId, {
          type: 'system_metrics',
          data: { 
            activeMigrations: migrations,
            count: migrations.length
          },
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      this.sendError(clientId, 'Failed to get status');
    }
  }

  /**
   * Handle client disconnection
   */
  private handleDisconnection(clientId: string) {
    const client = this.clients.get(clientId);
    if (client) {
      console.log(`WebSocket client disconnected: ${clientId} (tenant: ${client.tenantId})`);
      this.clients.delete(clientId);
    }
  }

  /**
   * Handle client errors
   */
  private handleError(clientId: string, error: Error) {
    console.error(`WebSocket client error ${clientId}:`, error);
    this.sendError(clientId, error.message);
  }

  /**
   * Send message to specific client
   */
  private sendToClient(clientId: string, message: StatusUpdate) {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === 1) { // 1 = OPEN state for ws library
      try {
        client.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error(`Error sending to client ${clientId}:`, error);
        this.clients.delete(clientId);
      }
    }
  }

  /**
   * Send error message to client
   */
  private sendError(clientId: string, message: string) {
    this.sendToClient(clientId, {
      type: 'error',
      data: { error: message },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast migration progress update
   */
  public broadcastMigrationProgress(tenantId: string, migrationId: string, progress: any) {
    const channel = `migration_progress:${migrationId}`;
    const message: StatusUpdate = {
      type: 'migration_progress',
      migrationId,
      data: progress,
      timestamp: new Date().toISOString()
    };

    this.broadcastToTenant(tenantId, channel, message);
  }

  /**
   * Broadcast job status update
   */
  public broadcastJobStatus(tenantId: string, jobId: string, status: any) {
    const channel = `job_status:${jobId}`;
    const message: StatusUpdate = {
      type: 'job_status',
      jobId,
      data: status,
      timestamp: new Date().toISOString()
    };

    this.broadcastToTenant(tenantId, channel, message);
  }

  /**
   * Broadcast system metrics
   */
  public broadcastSystemMetrics(tenantId: string, metrics: any) {
    const channel = 'system_metrics';
    const message: StatusUpdate = {
      type: 'system_metrics',
      data: metrics,
      timestamp: new Date().toISOString()
    };

    this.broadcastToTenant(tenantId, channel, message);
  }

  /**
   * Broadcast to all clients in a tenant subscribed to a channel
   */
  private broadcastToTenant(tenantId: string, channel: string, message: StatusUpdate) {
    for (const [clientId, client] of this.clients.entries()) {
      if (client.tenantId === tenantId && client.subscriptions.has(channel)) {
        this.sendToClient(clientId, message);
      }
    }
  }

  /**
   * Start heartbeat to clean up inactive connections
   */
  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      const now = new Date();
      const timeout = 5 * 60 * 1000; // 5 minutes

      for (const [clientId, client] of this.clients.entries()) {
        if (now.getTime() - client.lastActivity.getTime() > timeout) {
          console.log(`Removing inactive client: ${clientId}`);
          if (client.ws && typeof client.ws.terminate === 'function') {
            client.ws.terminate();
          }
          this.clients.delete(clientId);
        }
      }
    }, 60000); // Check every minute
  }

  /**
   * Stop the WebSocket server
   */
  public stop() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    if (this.wss) {
      this.wss.close(() => {
        console.log('Migration WebSocket server stopped');
      });
    }
  }

  /**
   * Get current connection stats
   */
  public getStats() {
    const tenantCounts = new Map<string, number>();
    
    for (const client of this.clients.values()) {
      tenantCounts.set(
        client.tenantId, 
        (tenantCounts.get(client.tenantId) || 0) + 1
      );
    }

    return {
      totalConnections: this.clients.size,
      tenantConnections: Object.fromEntries(tenantCounts),
      serverStartTime: new Date().toISOString()
    };
  }

  // Helper methods (would integrate with database)
  private async validateClientAuth(tenantId: string, token: string): Promise<boolean> {
    // Mock implementation
    return tenantId && token ? true : false;
  }

  private async getMigrationStatus(tenantId: string, migrationId: string): Promise<any> {
    // Mock implementation
    return {
      id: migrationId,
      status: 'running',
      progress: 65,
      usersCompleted: 130,
      usersTotal: 200
    };
  }

  private async getActiveMigrations(tenantId: string): Promise<any[]> {
    // Mock implementation
    return [
      { id: 'mig_001', name: 'Test Migration', status: 'running', progress: 45 }
    ];
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton instance
let wsServer: MigrationWebSocketServer | null = null;

/**
 * Get or create WebSocket server instance
 */
export function getWebSocketServer(): MigrationWebSocketServer {
  if (!wsServer) {
    wsServer = new MigrationWebSocketServer();
  }
  return wsServer;
}

/**
 * Initialize WebSocket server (call this from your main application)
 */
export function initializeWebSocketServer(port?: number): MigrationWebSocketServer {
  if (wsServer) {
    console.log('WebSocket server already initialized');
    return wsServer;
  }
  
  wsServer = new MigrationWebSocketServer(port);
  return wsServer;
}

export default MigrationWebSocketServer;
