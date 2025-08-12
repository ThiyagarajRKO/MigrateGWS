/**
 * WebSocket API Route for Next.js
 * Handles real-time migration logging via WebSocket
 */

import { NextApiRequest } from 'next';
import { WebSocketServer } from 'ws';

// Store WebSocket server instance
let wss: WebSocketServer | null = null;

export default function handler(req: NextApiRequest, res: any) {
  if (!res.socket.server.wss) {
    console.log('🚀 Starting WebSocket server...');
    
    const wss = new WebSocketServer({ 
      port: 3001,
      path: '/migration-logs'
    });

    wss.on('connection', function connection(ws, request) {
      console.log('🔌 WebSocket client connected');
      
      // Send welcome message
      ws.send(JSON.stringify({
        type: 'welcome',
        message: 'Connected to Migration WebSocket Logger',
        timestamp: new Date().toISOString(),
        server: 'Next.js API Route'
      }));

      // Send initial test logs
      setTimeout(() => {
        const testLogs = [
          {
            type: 'log',
            level: 'error',
            category: 'api',
            service: 'forms',
            message: 'Forms API 403 Insufficient permissions detected',
            details: {
              status: 403,
              error: 'Insufficient permissions',
              endpoint: 'forms.list',
              solution: 'Add Forms API scopes to domain-wide delegation'
            },
            timestamp: new Date().toISOString()
          },
          {
            type: 'log',
            level: 'warning',
            category: 'api',
            service: 'drive',
            message: 'Drive API quota approaching limit',
            details: {
              quotaUsage: '85%',
              requestsPerMinute: 850,
              limit: 1000
            },
            timestamp: new Date().toISOString()
          },
          {
            type: 'log',
            level: 'info',
            category: 'delegation',
            service: 'forms',
            message: 'Checking domain-wide delegation setup...',
            details: {
              requiredScopes: [
                'https://www.googleapis.com/auth/forms',
                'https://www.googleapis.com/auth/forms.body',
                'https://www.googleapis.com/auth/forms.responses.readonly'
              ]
            },
            timestamp: new Date().toISOString()
          }
        ];

        testLogs.forEach((log, index) => {
          setTimeout(() => {
            console.log(`📤 Broadcasting log: ${log.message}`);
            ws.send(JSON.stringify(log));
          }, index * 2000);
        });
      }, 1000);

      // Handle incoming messages
      ws.on('message', function message(data) {
        try {
          const parsed = JSON.parse(data.toString());
          console.log('📥 Received message:', parsed);
          
          if (parsed.type === 'ping') {
            ws.send(JSON.stringify({ 
              type: 'pong', 
              timestamp: new Date().toISOString() 
            }));
          }
        } catch (error) {
          console.log('📥 Received raw message:', data.toString());
        }
      });

      ws.on('close', function close() {
        console.log('🔌 WebSocket client disconnected');
      });

      ws.on('error', function error(err) {
        console.error('❌ WebSocket error:', err);
      });
    });

    res.socket.server.wss = wss;
    console.log('✅ WebSocket server initialized on port 3001');
  }

  res.status(200).json({ 
    message: 'WebSocket server running',
    endpoint: 'ws://localhost:3001/migration-logs',
    status: 'active'
  });
}

// Next.js 14 route segment config
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
