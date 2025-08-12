/**
 * Simple WebSocket Real-time Logger
 * For viewing migration logs in real-time
 */

import WebSocket, { WebSocketServer } from 'ws';
import { createServer } from 'http';

console.log('🚀 Starting Migration WebSocket Logger...\n');

// Create HTTP server
const server = createServer();

// Create WebSocket server
const wss = new WebSocketServer({ 
  server: server,
  path: '/logs'
});

let clientCount = 0;
const clients = new Set();

// Handle WebSocket connections
wss.on('connection', function connection(ws, request) {
  clientCount++;
  const clientId = `client-${clientCount}`;
  clients.add(ws);
  
  console.log(`🔌 Client connected: ${clientId} (Total: ${clients.size})`);
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'welcome',
    message: `Connected to Migration Logger (ID: ${clientId})`,
    timestamp: new Date().toISOString(),
    clientId: clientId
  }));

  // Send initial demo logs
  setTimeout(() => {
    sendLog(ws, 'info', 'system', 'WebSocket connection established');
    sendLog(ws, 'warning', 'forms', 'Forms API 403 error detected');
    sendLog(ws, 'error', 'forms', 'Insufficient permissions for forms.list()');
    sendLog(ws, 'info', 'delegation', 'Checking domain-wide delegation setup...');
  }, 1000);

  // Handle client messages
  ws.on('message', function message(data) {
    try {
      const msg = JSON.parse(data.toString());
      console.log(`📥 Message from ${clientId}:`, msg);
      
      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });

  // Handle disconnection
  ws.on('close', function close() {
    clients.delete(ws);
    console.log(`🔌 Client disconnected: ${clientId} (Remaining: ${clients.size})`);
  });

  ws.on('error', function error(err) {
    console.error(`❌ WebSocket error for ${clientId}:`, err);
    clients.delete(ws);
  });
});

// Broadcast to all clients
function broadcast(data) {
  const message = JSON.stringify(data);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Send log to specific client or all clients
function sendLog(ws, level, category, message, details = {}) {
  const logData = {
    type: 'log',
    level: level,
    category: category,
    message: message,
    details: details,
    timestamp: new Date().toISOString()
  };

  if (ws) {
    ws.send(JSON.stringify(logData));
  } else {
    broadcast(logData);
  }

  // Also log to console
  const icon = level === 'error' ? '❌' : level === 'warning' ? '⚠️' : level === 'success' ? '✅' : 'ℹ️';
  console.log(`${icon} [${category.toUpperCase()}] ${message}`);
}

// Serve simple HTML client
server.on('request', (req, res) => {
  if (req.url === '/' || req.url === '/client') {
    const clientHTML = `
<!DOCTYPE html>
<html>
<head>
    <title>Migration WebSocket Logs</title>
    <style>
        body { 
            font-family: 'Consolas', 'Monaco', monospace; 
            background: #0d1117; 
            color: #f0f6fc; 
            margin: 0; 
            padding: 20px; 
        }
        .header { 
            background: #21262d; 
            padding: 20px; 
            border-radius: 8px; 
            margin-bottom: 20px; 
            border: 1px solid #30363d;
        }
        .status { 
            padding: 4px 12px; 
            border-radius: 16px; 
            font-size: 12px; 
            font-weight: bold; 
        }
        .connected { background: #238636; color: #fff; }
        .disconnected { background: #da3633; color: #fff; }
        .logs { 
            background: #0d1117; 
            border: 1px solid #30363d; 
            border-radius: 8px; 
            padding: 20px; 
            height: 600px; 
            overflow-y: auto; 
            font-size: 14px; 
            line-height: 1.6;
        }
        .log-entry { 
            margin-bottom: 12px; 
            padding: 8px 12px; 
            border-radius: 6px; 
            background: #161b22;
            border-left: 4px solid #30363d;
        }
        .log-entry.error { border-left-color: #f85149; }
        .log-entry.warning { border-left-color: #d29922; }
        .log-entry.success { border-left-color: #3fb950; }
        .log-entry.info { border-left-color: #58a6ff; }
        .timestamp { color: #7d8590; font-size: 12px; }
        .category { 
            background: #21262d; 
            padding: 2px 8px; 
            border-radius: 12px; 
            font-size: 10px; 
            text-transform: uppercase; 
            margin: 0 8px 0 0; 
        }
        .category.forms { background: #1f6feb; }
        .category.drive { background: #238636; }
        .category.delegation { background: #8957e5; }
        .category.system { background: #6e7681; }
        .message { margin-top: 4px; }
        .details { 
            margin-top: 8px; 
            padding: 8px; 
            background: #0d1117; 
            border-radius: 4px; 
            font-size: 12px; 
            color: #7d8590; 
        }
        .controls { 
            margin-bottom: 20px; 
            padding: 15px; 
            background: #21262d; 
            border-radius: 8px; 
            border: 1px solid #30363d;
        }
        button { 
            background: #238636; 
            color: white; 
            border: none; 
            padding: 8px 16px; 
            border-radius: 6px; 
            cursor: pointer; 
            margin-right: 10px; 
            font-size: 14px;
        }
        button:hover { background: #2ea043; }
        .ping { background: #1f6feb; }
        .ping:hover { background: #388bfd; }
        .clear { background: #da3633; }
        .clear:hover { background: #e5534b; }
        pre { margin: 0; white-space: pre-wrap; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 Migration WebSocket Logger</h1>
        <p>Status: <span id="status" class="status disconnected">Connecting...</span></p>
        <p>URL: <code>ws://localhost:3001/logs</code></p>
    </div>

    <div class="controls">
        <button onclick="clearLogs()" class="clear">🗑️ Clear</button>
        <button onclick="pingServer()" class="ping">📡 Ping</button>
        <button onclick="reconnect()">🔄 Reconnect</button>
        <button onclick="testLogs()">🧪 Test Logs</button>
    </div>

    <div class="logs" id="logs"></div>

    <script>
        let ws;
        let logCount = 0;

        function connect() {
            ws = new WebSocket('ws://localhost:3001/logs');
            
            ws.onopen = function() {
                document.getElementById('status').textContent = 'Connected';
                document.getElementById('status').className = 'status connected';
                addSystemLog('🔌 Connected to WebSocket server');
            };
            
            ws.onmessage = function(event) {
                try {
                    const data = JSON.parse(event.data);
                    
                    if (data.type === 'welcome') {
                        addSystemLog('📡 ' + data.message);
                    } else if (data.type === 'log') {
                        addLogEntry(data);
                    } else if (data.type === 'pong') {
                        addSystemLog('🏓 Pong received');
                    } else {
                        addLogEntry(data);
                    }
                } catch (error) {
                    console.error('Error parsing message:', error);
                }
            };
            
            ws.onclose = function() {
                document.getElementById('status').textContent = 'Disconnected';
                document.getElementById('status').className = 'status disconnected';
                addSystemLog('🔌 Connection closed');
                
                setTimeout(() => {
                    addSystemLog('🔄 Reconnecting...');
                    connect();
                }, 3000);
            };
            
            ws.onerror = function(error) {
                addSystemLog('❌ Connection error');
                console.error('WebSocket error:', error);
            };
        }

        function addLogEntry(data) {
            logCount++;
            const logsContainer = document.getElementById('logs');
            const entry = document.createElement('div');
            entry.className = 'log-entry ' + (data.level || 'info');
            
            const timestamp = new Date(data.timestamp).toLocaleTimeString();
            const category = data.category || 'system';
            const level = data.level || 'info';
            const icon = getIcon(level);
            
            entry.innerHTML = \`
                <div class="timestamp">\${timestamp} • Log #\${logCount}</div>
                <div class="message">
                    <span class="category \${category}">\${category}</span>
                    \${icon} \${data.message}
                </div>
                \${data.details && Object.keys(data.details).length > 0 ? 
                    \`<div class="details"><pre>\${JSON.stringify(data.details, null, 2)}</pre></div>\` : 
                    ''
                }
            \`;
            
            logsContainer.appendChild(entry);
            logsContainer.scrollTop = logsContainer.scrollHeight;
            
            // Limit entries to prevent memory issues
            while (logsContainer.children.length > 200) {
                logsContainer.removeChild(logsContainer.firstChild);
            }
        }

        function addSystemLog(message) {
            addLogEntry({
                type: 'log',
                level: 'info',
                category: 'system',
                message: message,
                timestamp: new Date().toISOString()
            });
        }

        function getIcon(level) {
            switch(level) {
                case 'error': return '❌';
                case 'warning': return '⚠️';
                case 'success': return '✅';
                case 'info': default: return 'ℹ️';
            }
        }

        function clearLogs() {
            document.getElementById('logs').innerHTML = '';
            logCount = 0;
            addSystemLog('🗑️ Logs cleared');
        }

        function pingServer() {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'ping' }));
                addSystemLog('📡 Ping sent');
            } else {
                addSystemLog('❌ Not connected');
            }
        }

        function reconnect() {
            if (ws) ws.close();
            connect();
        }

        function testLogs() {
            addLogEntry({
                level: 'error',
                category: 'forms',
                message: 'Forms API call failed with 403 Insufficient permissions',
                details: { status: 403, endpoint: 'forms.list', error: 'Insufficient permissions' },
                timestamp: new Date().toISOString()
            });

            setTimeout(() => {
                addLogEntry({
                    level: 'info',
                    category: 'delegation',
                    message: 'Checking domain-wide delegation for Forms API scopes',
                    details: { requiredScopes: ['forms', 'forms.body', 'forms.responses.readonly'] },
                    timestamp: new Date().toISOString()
                });
            }, 1000);

            setTimeout(() => {
                addLogEntry({
                    level: 'success',
                    category: 'forms',
                    message: 'Forms API working after delegation fix',
                    details: { formsFound: 12, responseTime: '850ms' },
                    timestamp: new Date().toISOString()
                });
            }, 2000);
        }

        // Connect when page loads
        connect();
    </script>
</body>
</html>`;
    
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(clientHTML);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

// Start server
const PORT = 3001;
server.listen(PORT, () => {
  console.log(`🚀 WebSocket Logger running on port ${PORT}`);
  console.log(`📡 WebSocket: ws://localhost:${PORT}/logs`);
  console.log(`🌐 Web Client: http://localhost:${PORT}/client`);
  console.log('');
  console.log('💡 Open the web client in your browser to see real-time logs!');
  console.log('');
});

// Demo: Send some sample logs periodically
let counter = 1;
setInterval(() => {
  const sampleLogs = [
    { level: 'info', category: 'delegation', message: `Testing Forms API delegation (${counter})` },
    { level: 'error', category: 'forms', message: 'Forms API 403 Insufficient permissions', details: { status: 403, retryAfter: 5000 } },
    { level: 'success', category: 'drive', message: 'Drive API quota management working' },
    { level: 'warning', category: 'system', message: 'High memory usage detected' }
  ];
  
  const randomLog = sampleLogs[Math.floor(Math.random() * sampleLogs.length)];
  sendLog(null, randomLog.level, randomLog.category, randomLog.message, randomLog.details);
  counter++;
}, 5000);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down WebSocket logger...');
  wss.close(() => {
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  });
});
