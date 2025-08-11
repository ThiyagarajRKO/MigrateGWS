/**
 * Real-time Migration Status WebSocket Handler
 * Provides live updates for migration progress with tenant isolation
 */

import { WebSocket } from 'ws';
import { Migration, MigrationJob, MigrationLog } from '../../lib/database/schema';

interface WebSocketClient {
  id: string;
  tenantId: string;
  migrationId?: string;
  ws: WebSocket;
  lastPing: number;
}

interface MigrationUpdate {
  type: 'progress' | 'status' | 'error' | 'log' | 'quota';
  migrationId: string;
  data: any;
  timestamp: string;
}

export class MigrationWebSocketManager {
  private clients: Map<string, WebSocketClient> = new Map();
  private tenantClients: Map<string, Set<string>> = new Map();
  private pingInterval: NodeJS.Timeout;

  constructor() {
    // Start ping/pong to keep connections alive
    this.pingInterval = setInterval(() => {
      this.pingClients();
    }, 30000); // 30 seconds
  }

  /**
   * Handle new WebSocket connection
   */
  handleConnection(ws: WebSocket, tenantId: string, migrationId?: string): string {
    const clientId = this.generateClientId();
    
    const client: WebSocketClient = {
      id: clientId,
      tenantId,
      migrationId,
      ws,
      lastPing: Date.now()
    };

    // Store client
    this.clients.set(clientId, client);
    
    // Index by tenant
    if (!this.tenantClients.has(tenantId)) {
      this.tenantClients.set(tenantId, new Set());
    }
    this.tenantClients.get(tenantId)!.add(clientId);

    // Set up WebSocket event handlers
    this.setupWebSocketHandlers(client);

    // Send initial connection confirmation
    this.sendToClient(clientId, {
      type: 'connection',
      data: { 
        clientId, 
        tenantId, 
        migrationId,
        message: 'Connected to migration status stream'
      }
    });

    console.log(`WebSocket client connected: ${clientId} (tenant: ${tenantId})`);
    return clientId;
  }

  /**
   * Set up WebSocket event handlers for a client
   */
  private setupWebSocketHandlers(client: WebSocketClient): void {
    client.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleClientMessage(client, message);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });

    client.ws.on('pong', () => {
      client.lastPing = Date.now();
    });

    client.ws.on('close', () => {
      this.removeClient(client.id);
    });

    client.ws.on('error', (error) => {
      console.error(`WebSocket error for client ${client.id}:`, error);
      this.removeClient(client.id);
    });
  }

  /**
   * Handle messages from clients
   */
  private handleClientMessage(client: WebSocketClient, message: any): void {
    switch (message.type) {
      case 'subscribe_migration':
        client.migrationId = message.migrationId;
        this.sendToClient(client.id, {
          type: 'subscription',
          data: { migrationId: message.migrationId, subscribed: true }
        });
        break;

      case 'unsubscribe_migration':
        client.migrationId = undefined;
        this.sendToClient(client.id, {
          type: 'subscription',
          data: { migrationId: message.migrationId, subscribed: false }
        });
        break;

      case 'ping':
        this.sendToClient(client.id, { type: 'pong', data: { timestamp: Date.now() } });
        break;

      default:
        console.warn(`Unknown message type: ${message.type}`);
    }
  }

  /**
   * Broadcast migration update to relevant clients
   */
  broadcastMigrationUpdate(update: MigrationUpdate): void {
    // Get migration details to determine tenant
    this.getMigrationTenant(update.migrationId).then(tenantId => {
      if (!tenantId) return;

      const tenantClientIds = this.tenantClients.get(tenantId);
      if (!tenantClientIds) return;

      tenantClientIds.forEach(clientId => {
        const client = this.clients.get(clientId);
        if (!client) return;

        // Send to all clients of the tenant, or specific migration subscribers
        if (!client.migrationId || client.migrationId === update.migrationId) {
          this.sendToClient(clientId, {
            type: 'migration_update',
            data: update
          });
        }
      });
    });
  }

  /**
   * Broadcast progress update
   */
  broadcastProgress(migrationId: string, progress: any): void {
    const update: MigrationUpdate = {
      type: 'progress',
      migrationId,
      data: progress,
      timestamp: new Date().toISOString()
    };

    this.broadcastMigrationUpdate(update);
  }

  /**
   * Broadcast status change
   */
  broadcastStatusChange(migrationId: string, status: string, details?: any): void {
    const update: MigrationUpdate = {
      type: 'status',
      migrationId,
      data: { status, details },
      timestamp: new Date().toISOString()
    };

    this.broadcastMigrationUpdate(update);
  }

  /**
   * Broadcast error
   */
  broadcastError(migrationId: string, error: string, context?: any): void {
    const update: MigrationUpdate = {
      type: 'error',
      migrationId,
      data: { error, context },
      timestamp: new Date().toISOString()
    };

    this.broadcastMigrationUpdate(update);
  }

  /**
   * Broadcast log entry
   */
  broadcastLog(migrationId: string, log: MigrationLog): void {
    const update: MigrationUpdate = {
      type: 'log',
      migrationId,
      data: log,
      timestamp: new Date().toISOString()
    };

    this.broadcastMigrationUpdate(update);
  }

  /**
   * Broadcast quota update
   */
  broadcastQuotaUpdate(tenantId: string, quotaData: any): void {
    const tenantClientIds = this.tenantClients.get(tenantId);
    if (!tenantClientIds) return;

    const update = {
      type: 'quota_update',
      data: quotaData,
      timestamp: new Date().toISOString()
    };

    tenantClientIds.forEach(clientId => {
      this.sendToClient(clientId, update);
    });
  }

  /**
   * Send message to specific client
   */
  private sendToClient(clientId: string, message: any): void {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      client.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error(`Error sending message to client ${clientId}:`, error);
      this.removeClient(clientId);
    }
  }

  /**
   * Remove client and clean up
   */
  private removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Remove from tenant index
    const tenantClientIds = this.tenantClients.get(client.tenantId);
    if (tenantClientIds) {
      tenantClientIds.delete(clientId);
      if (tenantClientIds.size === 0) {
        this.tenantClients.delete(client.tenantId);
      }
    }

    // Remove from main index
    this.clients.delete(clientId);

    console.log(`WebSocket client disconnected: ${clientId}`);
  }

  /**
   * Ping all clients to keep connections alive
   */
  private pingClients(): void {
    const now = Date.now();
    const staleClients: string[] = [];

    this.clients.forEach((client, clientId) => {
      if (now - client.lastPing > 60000) { // 60 seconds without pong
        staleClients.push(clientId);
      } else if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.ping();
        } catch (error) {
          staleClients.push(clientId);
        }
      }
    });

    // Remove stale clients
    staleClients.forEach(clientId => {
      this.removeClient(clientId);
    });
  }

  /**
   * Get tenant ID for a migration (mock implementation)
   */
  private async getMigrationTenant(migrationId: string): Promise<string | null> {
    // This would query your database to get the tenant for a migration
    // For now, return a mock tenant
    return 'demo';
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get connection stats
   */
  getStats(): { totalClients: number; tenantCounts: Record<string, number> } {
    const tenantCounts: Record<string, number> = {};
    
    this.tenantClients.forEach((clients, tenantId) => {
      tenantCounts[tenantId] = clients.size;
    });

    return {
      totalClients: this.clients.size,
      tenantCounts
    };
  }

  /**
   * Cleanup on shutdown
   */
  shutdown(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    this.clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.close();
      }
    });

    this.clients.clear();
    this.tenantClients.clear();
  }
}

// Global WebSocket manager instance
export const wsManager = new MigrationWebSocketManager();

export default wsManager;
