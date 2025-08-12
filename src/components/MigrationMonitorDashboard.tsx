/**
 * Real-time Migration Monitoring Dashboard
 * Displays live logs from WebSocket server
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { Activity, AlertTriangle, CheckCircle, Clock, Server, Wifi, WifiOff } from 'lucide-react';

interface LogEntry {
  type: string;
  level: 'error' | 'warning' | 'success' | 'info';
  category?: string;
  service: string;
  message: string;
  details?: any;
  timestamp: string;
  clientId?: string;
}

interface ConnectionStats {
  connected: boolean;
  clientId: string | null;
  connectTime: Date | null;
  messageCount: number;
  lastPing: Date | null;
}

export default function MigrationMonitorDashboard() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connection, setConnection] = useState<ConnectionStats>({
    connected: false,
    clientId: null,
    connectTime: null,
    messageCount: 0,
    lastPing: null
  });
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (isAutoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isAutoScroll]);

  // WebSocket connection
  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket('ws://localhost:3002/logs');
      wsRef.current = ws;

      ws.onopen = () => {
        setConnection(prev => ({
          ...prev,
          connected: true,
          connectTime: new Date(),
          messageCount: 0
        }));
        console.log('✅ Connected to migration logs WebSocket');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          setConnection(prev => ({
            ...prev,
            messageCount: prev.messageCount + 1,
            lastPing: data.type === 'pong' ? new Date() : prev.lastPing,
            clientId: data.clientId || prev.clientId
          }));

          if (data.type === 'log') {
            setLogs(prev => [...prev, data].slice(-100)); // Keep last 100 logs
          } else if (data.type === 'welcome') {
            console.log('📡 Welcome:', data.message);
          }
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        setConnection(prev => ({
          ...prev,
          connected: false,
          clientId: null
        }));
        console.log('🔌 WebSocket connection closed');
        
        // Reconnect after 3 seconds
        setTimeout(connect, 3000);
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
      };
    };

    connect();

    // Cleanup
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Send ping every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const clearLogs = () => {
    setLogs([]);
  };

  const getServiceIcon = (service: string) => {
    switch (service) {
      case 'forms': return '📋';
      case 'drive': return '📁';
      case 'gmail': return '📧';
      case 'calendar': return '📅';
      case 'contacts': return '👥';
      case 'photos': return '📸';
      case 'chat': return '💬';
      case 'system': return '⚙️';
      default: return '🔧';
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'info': default: return <Activity className="w-4 h-4 text-blue-500" />;
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'border-l-red-500 bg-red-50 dark:bg-red-950/20';
      case 'warning': return 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/20';
      case 'success': return 'border-l-green-500 bg-green-50 dark:bg-green-950/20';
      case 'info': default: return 'border-l-blue-500 bg-blue-50 dark:bg-blue-950/20';
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getLogStats = () => {
    const stats = logs.reduce((acc, log) => {
      acc[log.level] = (acc[log.level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total: logs.length,
      errors: stats.error || 0,
      warnings: stats.warning || 0,
      success: stats.success || 0,
      info: stats.info || 0
    };
  };

  const stats = getLogStats();

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Activity className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Migration Monitor
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Real-time Google Workspace migration logs
            </p>
          </div>
        </div>

        {/* Connection Status */}
        <div className="flex items-center space-x-3">
          <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg ${
            connection.connected 
              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' 
              : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
          }`}>
            {connection.connected ? (
              <Wifi className="w-4 h-4" />
            ) : (
              <WifiOff className="w-4 h-4" />
            )}
            <span className="text-sm font-medium">
              {connection.connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border">
          <div className="flex items-center space-x-2">
            <Server className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Total</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Errors</span>
          </div>
          <p className="text-2xl font-bold text-red-600">{stats.errors}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-yellow-500" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Warnings</span>
          </div>
          <p className="text-2xl font-bold text-yellow-600">{stats.warnings}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Success</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{stats.success}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-blue-500" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Info</span>
          </div>
          <p className="text-2xl font-bold text-blue-600">{stats.info}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-purple-500" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Messages</span>
          </div>
          <p className="text-2xl font-bold text-purple-600">{connection.messageCount}</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-4 rounded-lg border">
        <div className="flex items-center space-x-4">
          <button
            onClick={clearLogs}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Clear Logs
          </button>
          
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={isAutoScroll}
              onChange={(e) => setIsAutoScroll(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">Auto-scroll</span>
          </label>
        </div>

        <div className="text-sm text-gray-500 dark:text-gray-400">
          {connection.connected && connection.connectTime && (
            <span>Connected since {connection.connectTime.toLocaleTimeString()}</span>
          )}
          {connection.clientId && (
            <span className="ml-4">Client: {connection.clientId}</span>
          )}
        </div>
      </div>

      {/* Logs */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Live Migration Logs
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Real-time logs from Google Workspace migration services
          </p>
        </div>

        <div className="h-96 overflow-y-auto p-4 space-y-3">
          {logs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
              <div className="text-center">
                <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Waiting for migration logs...</p>
                <p className="text-sm mt-1">
                  {connection.connected 
                    ? 'Connected to WebSocket server' 
                    : 'Connecting to WebSocket server...'}
                </p>
              </div>
            </div>
          ) : (
            logs.map((log, index) => (
              <div
                key={index}
                className={`border-l-4 p-4 rounded-r-lg ${getLevelColor(log.level)}`}
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {getLevelIcon(log.level)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-lg">{getServiceIcon(log.service)}</span>
                      <span className="px-2 py-1 bg-gray-200 dark:bg-gray-700 text-xs font-medium rounded uppercase">
                        {log.service}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatTime(log.timestamp)}
                      </span>
                    </div>
                    
                    <p className="text-gray-900 dark:text-white font-medium mb-2">
                      {log.message}
                    </p>
                    
                    {log.details && (
                      <details className="mt-2">
                        <summary className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer hover:text-gray-800 dark:hover:text-gray-200">
                          Show details
                        </summary>
                        <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-900 rounded text-xs overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
}
