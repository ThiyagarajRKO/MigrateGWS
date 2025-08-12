/**
 * WebSocket Migration Logger Server
 * Standalone server for real-time migration logging
 */

import { WebSocketServer } from 'ws';
import { createServer } from 'http';

class MigrationWebSocketServer {
  constructor() {
    this.clients = new Set();
    this.logBuffer = [];
    this.maxBufferSize = 1000;
    this.server = null;
    this.wss = null;
  }

  start(port = 3001) {
    // Create HTTP server
    this.server = createServer();
    
    // Create WebSocket server
    this.wss = new WebSocketServer({ 
      server: this.server,
      path: '/migration-logs'
    });

    this.wss.on('connection', (ws, request) => {
      const clientId = Math.random().toString(36).substr(2, 9);
      
      console.log(`🔌 Client connected: ${clientId}`);
      this.clients.add(ws);

      // Send buffered logs to new client
      ws.send(JSON.stringify({
        type: 'init',
        message: 'Connected to Migration WebSocket Logger',
        bufferedLogs: this.logBuffer.slice(-50), // Last 50 logs
        timestamp: new Date().toISOString(),
        clientId
      }));

      // Handle client messages
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          console.log(`📥 Received from ${clientId}:`, message);
          
          if (message.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
          }
        } catch (error) {
          console.error('Error parsing client message:', error);
        }
      });

      // Handle disconnection
      ws.on('close', () => {
        console.log(`🔌 Client disconnected: ${clientId}`);
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error(`❌ WebSocket error for ${clientId}:`, error);
        this.clients.delete(ws);
      });
    });

    // Start HTTP server
    this.server.listen(port, () => {
      console.log(`🚀 Migration WebSocket Logger running on port ${port}`);
      console.log(`📡 WebSocket endpoint: ws://localhost:${port}/migration-logs`);
      console.log(`🌐 Test client available at: http://localhost:${port}/client`);
    });

    // Serve simple HTML client
    this.server.on('request', (req, res) => {
      if (req.url === '/client' || req.url === '/') {
        this.serveClient(res);
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    // Start demo logging
    this.startDemoLogs();
  }

  serveClient(res) {
    const clientHTML = `
<!DOCTYPE html>
<html>
<head>
    <title>Migration WebSocket Logs - Real-time</title>
    <style>
        body { 
            font-family: 'Courier New', monospace; 
            background: #1a1a1a; 
            color: #00ff00; 
            margin: 0; 
            padding: 20px; 
        }
        .header { 
            background: #333; 
            padding: 15px; 
            border-radius: 8px; 
            margin-bottom: 20px; 
            border-left: 4px solid #00ff00;
        }
        .status { 
            display: inline-block; 
            padding: 4px 8px; 
            border-radius: 4px; 
            font-size: 12px; 
            font-weight: bold; 
        }
        .connected { background: #0f5132; color: #d1e7dd; }
        .disconnected { background: #721c24; color: #f8d7da; }
        .logs { 
            background: #000; 
            border: 1px solid #333; 
            border-radius: 8px; 
            padding: 15px; 
            height: 500px; 
            overflow-y: auto; 
            font-size: 13px; 
            line-height: 1.4;
        }
        .log-entry { 
            margin-bottom: 8px; 
            padding: 4px 0; 
            border-bottom: 1px solid #222; 
        }
        .timestamp { color: #666; font-size: 11px; }
        .level-info { color: #17a2b8; }
        .level-success { color: #28a745; }
        .level-warning { color: #ffc107; }
        .level-error { color: #dc3545; }
        .category { 
            display: inline-block; 
            padding: 2px 6px; 
            border-radius: 3px; 
            font-size: 10px; 
            margin-right: 8px; 
        }
        .category-delegation { background: #6f42c1; }
        .category-api { background: #007bff; }
        .category-migration { background: #28a745; }
        .category-system { background: #6c757d; }
        .controls { 
            margin-bottom: 15px; 
            padding: 10px; 
            background: #333; 
            border-radius: 6px; 
        }
        button { 
            background: #007bff; 
            color: white; 
            border: none; 
            padding: 6px 12px; 
            border-radius: 4px; 
            cursor: pointer; 
            margin-right: 8px; 
        }
        button:hover { background: #0056b3; }
        .clear { background: #dc3545; }
        .clear:hover { background: #a71d2a; }
        .stats { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); 
            gap: 10px; 
            margin-bottom: 15px; 
        }
        .stat-box { 
            background: #333; 
            padding: 10px; 
            border-radius: 6px; 
            text-align: center; 
        }
        .stat-number { 
            font-size: 24px; 
            font-weight: bold; 
            color: #00ff00; 
        }
        .stat-label { 
            font-size: 12px; 
            color: #999; 
            text-transform: uppercase; 
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 Migration WebSocket Logger - Real-time</h1>
        <p>Connection Status: <span id="status" class="status disconnected">Disconnected</span></p>
        <p>WebSocket URL: <code>ws://localhost:3001/migration-logs</code></p>
    </div>

    <div class="stats">
        <div class="stat-box">
            <div class="stat-number" id="totalLogs">0</div>
            <div class="stat-label">Total Logs</div>
        </div>
        <div class="stat-box">
            <div class="stat-number" id="errorCount">0</div>
            <div class="stat-label">Errors</div>
        </div>
        <div class="stat-box">
            <div class="stat-number" id="apiCalls">0</div>
            <div class="stat-label">API Calls</div>
        </div>
        <div class="stat-box">
            <div class="stat-number" id="migrations">0</div>
            <div class="stat-label">Migrations</div>
        </div>
    </div>

    <div class="controls">
        <button onclick="clearLogs()">🗑️ Clear Logs</button>
        <button onclick="downloadLogs()">💾 Download Logs</button>
        <button onclick="pingServer()">📡 Ping Server</button>
        <button onclick="reconnect()">🔄 Reconnect</button>
        <label>
            <input type="checkbox" id="autoScroll" checked> Auto-scroll
        </label>
    </div>

    <div class="logs" id="logs"></div>

    <script>
        let ws = null;
        let logs = [];
        let stats = { total: 0, errors: 0, api: 0, migrations: 0 };

        function connect() {
            ws = new WebSocket('ws://localhost:3001/migration-logs');
            
            ws.onopen = function() {
                document.getElementById('status').textContent = 'Connected';
                document.getElementById('status').className = 'status connected';
                addSystemLog('🔌 Connected to WebSocket server');
            };
            
            ws.onmessage = function(event) {
                try {
                    const data = JSON.parse(event.data);
                    
                    if (data.type === 'init') {
                        addSystemLog(\`📡 \${data.message} (Client ID: \${data.clientId})\`);
                        if (data.bufferedLogs) {
                            data.bufferedLogs.forEach(log => addLogEntry(log));
                        }
                    } else if (data.type === 'log') {
                        addLogEntry(data);
                    } else if (data.type === 'pong') {
                        addSystemLog('🏓 Pong received from server');
                    } else {
                        addLogEntry(data);
                    }
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };
            
            ws.onclose = function() {
                document.getElementById('status').textContent = 'Disconnected';
                document.getElementById('status').className = 'status disconnected';
                addSystemLog('🔌 Disconnected from WebSocket server');
                
                // Auto-reconnect after 3 seconds
                setTimeout(() => {
                    addSystemLog('🔄 Attempting to reconnect...');
                    connect();
                }, 3000);
            };
            
            ws.onerror = function(error) {
                addSystemLog('❌ WebSocket error: ' + error);
            };
        }

        function addLogEntry(logData) {
            const timestamp = new Date().toLocaleTimeString();
            const level = logData.level || 'info';
            const category = logData.category || 'system';
            const service = logData.service || '';
            const message = logData.message || JSON.stringify(logData);
            
            logs.push(logData);
            stats.total++;
            
            if (level === 'error') stats.errors++;
            if (category === 'api') stats.api++;
            if (category === 'migration') stats.migrations++;
            
            updateStats();
            
            const logContainer = document.getElementById('logs');
            const logEntry = document.createElement('div');
            logEntry.className = 'log-entry';
            
            const serviceText = service ? \`[\${service.toUpperCase()}] \` : '';
            const detailsText = logData.details ? \` - \${JSON.stringify(logData.details)}\` : '';
            
            logEntry.innerHTML = \`
                <span class="timestamp">\${timestamp}</span>
                <span class="category category-\${category}">\${category}</span>
                <span class="level-\${level}">\${getLevelIcon(level)} \${serviceText}\${message}</span>
                \${detailsText ? \`<div style="color: #666; font-size: 11px; margin-top: 4px;">\${detailsText}</div>\` : ''}
            \`;
            
            logContainer.appendChild(logEntry);
            
            // Auto-scroll if enabled
            if (document.getElementById('autoScroll').checked) {
                logContainer.scrollTop = logContainer.scrollHeight;
            }
            
            // Limit logs to prevent memory issues
            const maxLogs = 1000;
            if (logContainer.children.length > maxLogs) {
                logContainer.removeChild(logContainer.firstChild);
            }
        }

        function addSystemLog(message) {
            addLogEntry({
                level: 'info',
                category: 'system',
                message: message,
                timestamp: new Date().toISOString()
            });
        }

        function getLevelIcon(level) {
            switch(level) {
                case 'error': return '❌';
                case 'warning': return '⚠️';
                case 'success': return '✅';
                case 'info': default: return 'ℹ️';
            }
        }

        function updateStats() {
            document.getElementById('totalLogs').textContent = stats.total;
            document.getElementById('errorCount').textContent = stats.errors;
            document.getElementById('apiCalls').textContent = stats.api;
            document.getElementById('migrations').textContent = stats.migrations;
        }

        function clearLogs() {
            document.getElementById('logs').innerHTML = '';
            logs = [];
            stats = { total: 0, errors: 0, api: 0, migrations: 0 };
            updateStats();
            addSystemLog('🗑️ Logs cleared');
        }

        function downloadLogs() {
            const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = \`migration-logs-\${new Date().toISOString().split('T')[0]}.json\`;
            a.click();
            URL.revokeObjectURL(url);
            addSystemLog('💾 Logs downloaded');
        }

        function pingServer() {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'ping', timestamp: new Date().toISOString() }));
                addSystemLog('📡 Ping sent to server');
            } else {
                addSystemLog('❌ Cannot ping - not connected');
            }
        }

        function reconnect() {
            if (ws) {
                ws.close();
            }
            connect();
        }

        // Start connection when page loads
        window.onload = function() {
            connect();
            addSystemLog('🚀 WebSocket client started');
        };
    </script>
</body>
</html>`;
    
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(clientHTML);
  }

  // Broadcast log to all connected clients
  broadcast(logData) {
    const message = JSON.stringify({
      type: 'log',
      ...logData,
      timestamp: new Date().toISOString()
    });

    // Add to buffer
    this.logBuffer.push(logData);
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }

    // Send to all clients
    this.clients.forEach(client => {
      if (client.readyState === client.OPEN) {
        client.send(message);
      }
    });

    // Also log to console
    console.log(`📡 [${logData.level?.toUpperCase()}] ${logData.message}`);
  }

  // Demo logging for testing
  startDemoLogs() {
    let counter = 1;
    
    setInterval(() => {
      // Simulate various types of logs
      const logTypes = [
        {
          level: 'info',
          category: 'delegation',
          service: 'forms',
          message: `Testing Forms API delegation (attempt ${counter})`,
          details: { adminUser: 'admin@sourcetech20.com', scopes: ['forms', 'forms.body'] }
        },
        {
          level: 'error',
          category: 'api',
          service: 'forms',
          message: 'Forms API call failed with 403 Insufficient permissions',
          details: { status: 403, endpoint: 'forms.list', retryAfter: 5000 }
        },
        {
          level: 'success',
          category: 'api',
          service: 'drive',
          message: 'Drive API quota management working properly',
          details: { quotaUsage: '65%', requestsPerMinute: 650 }
        },
        {
          level: 'warning',
          category: 'migration',
          service: 'drive',
          message: 'Drive quota approaching limit',
          details: { usage: '85%', remaining: 150 }
        }
      ];

      const randomLog = logTypes[Math.floor(Math.random() * logTypes.length)];
      this.broadcast(randomLog);
      
      counter++;
    }, 3000); // Send a log every 3 seconds
  }

  // Manual logging methods
  log(level, category, service, message, details = {}) {
    this.broadcast({ level, category, service, message, details });
  }

  stop() {
    if (this.wss) {
      this.wss.close();
    }
    if (this.server) {
      this.server.close();
    }
    console.log('🔌 WebSocket server stopped');
  }
}

// Start server if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new MigrationWebSocketServer();
  server.start(3001);

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down WebSocket server...');
    server.stop();
    process.exit(0);
  });
}

export default MigrationWebSocketServer;
