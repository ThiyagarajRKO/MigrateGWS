'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { DriveQuotaManager } from '@/components/DriveQuotaManager';
import { DriveQuotaManager as EnhancedDriveQuotaManager } from '@/components/EnhancedDriveQuotaManager';
import RealTimeMigrationLogger from '@/components/RealTimeMigrationLogger';
import MigrationProgressSimulator from '@/components/MigrationProgressSimulator';
import { migrationLogger } from '@/lib/migration-websocket-logger';
import { 
  BarChart3, 
  Users, 
  Database, 
  Calendar, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Plus,
  LogOut,
  User,
  Shield,
  Settings,
  Shuffle,
  Mail,
  FolderOpen,
  UserCheck,
  Camera,
  MessageSquare,
  FileText,
  ExternalLink,
  TrendingUp,
  Activity,
  Zap,
  Wifi,
  WifiOff,
  Server,
  Monitor,
  PlayCircle,
  StopCircle,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react';

interface MigrationStats {
  total: number;
  active: number;
  completed: number;
  failed: number;
}

interface RecentMigration {
  id: string;
  name: string;
  source: string;
  target: string;
  status: 'running' | 'completed' | 'failed' | 'pending';
  progress: number;
  createdAt: string;
  services: string[];
  userCount: number;
  logUrl: string;
}

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

interface SystemHealth {
  formsAPI: 'operational' | 'degraded' | 'failed';
  driveAPI: 'operational' | 'degraded' | 'failed';
  websocket: 'connected' | 'disconnected' | 'reconnecting';
  lastCheck: Date;
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  
  const [stats] = useState<MigrationStats>({
    total: 24,
    active: 3,
    completed: 18,
    failed: 3
  });

  // Real-time monitoring state
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connection, setConnection] = useState<ConnectionStats>({
    connected: false,
    clientId: null,
    connectTime: null,
    messageCount: 0,
    lastPing: null
  });
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    formsAPI: 'operational',
    driveAPI: 'operational',
    websocket: 'disconnected',
    lastCheck: new Date()
  });
  const [showLiveMonitor, setShowLiveMonitor] = useState(false);
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const [recentMigrations] = useState<RecentMigration[]>([
    {
      id: '1',
      name: 'Marketing Team Migration',
      source: 'oldcompany.com',
      target: 'newcompany.com',
      status: 'running',
      progress: 65,
      createdAt: '2024-01-15T10:30:00Z',
      services: ['Gmail', 'Drive', 'Calendar', 'Contacts'],
      userCount: 45,
      logUrl: '/migrations/1/logs'
    },
    {
      id: '2',
      name: 'Sales Department Migration',
      source: 'sales.oldcompany.com',
      target: 'sales.newcompany.com',
      status: 'completed',
      progress: 100,
      createdAt: '2024-01-14T14:20:00Z',
      services: ['Gmail', 'Drive', 'Calendar'],
      userCount: 28,
      logUrl: '/migrations/2/logs'
    },
    {
      id: '3',
      name: 'Engineering Team Migration',
      source: 'dev.oldcompany.com',
      target: 'engineering.newcompany.com',
      status: 'failed',
      progress: 25,
      createdAt: '2024-01-13T09:15:00Z',
      services: ['Gmail', 'Drive'],
      userCount: 67,
      logUrl: '/migrations/3/logs'
    }
  ]);

  // Auto-scroll to bottom of logs
  useEffect(() => {
    if (isAutoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isAutoScroll]);

  // WebSocket connection for real-time monitoring
  useEffect(() => {
    if (!showLiveMonitor) return;

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
        setSystemHealth(prev => ({ ...prev, websocket: 'connected' }));
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
            setLogs(prev => [...prev, data].slice(-50)); // Keep last 50 logs
            
            // Update system health based on logs
            if (data.service === 'forms' && data.level === 'error') {
              setSystemHealth(prev => ({ ...prev, formsAPI: 'failed', lastCheck: new Date() }));
            } else if (data.service === 'forms' && data.level === 'success') {
              setSystemHealth(prev => ({ ...prev, formsAPI: 'operational', lastCheck: new Date() }));
            } else if (data.service === 'drive' && data.level === 'warning') {
              setSystemHealth(prev => ({ ...prev, driveAPI: 'degraded', lastCheck: new Date() }));
            }
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
        setSystemHealth(prev => ({ ...prev, websocket: 'disconnected' }));
        console.log('🔌 WebSocket connection closed');
        
        // Reconnect after 3 seconds if monitoring is still enabled
        if (showLiveMonitor) {
          setTimeout(connect, 3000);
          setSystemHealth(prev => ({ ...prev, websocket: 'reconnecting' }));
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setSystemHealth(prev => ({ ...prev, websocket: 'disconnected' }));
      };
    };

    connect();

    // Cleanup
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [showLiveMonitor]);

  // Send ping every 30 seconds
  useEffect(() => {
    if (!showLiveMonitor) return;
    
    const interval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [showLiveMonitor]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Clock className="h-4 w-4 text-info-600" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-success-600" />;
      case 'failed':
        return <AlertTriangle className="h-4 w-4 text-danger-600" />;
      default:
        return <Clock className="h-4 w-4 text-secondary-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return 'info';
      case 'completed':
        return 'success';
      case 'failed':
        return 'danger';
      default:
        return 'primary';
    }
  };

  const getServiceIcon = (service: string) => {
    switch (service.toLowerCase()) {
      case 'gmail':
        return <Mail className="h-3 w-3 text-primary-600" />;
      case 'drive':
        return <FolderOpen className="h-3 w-3 text-primary-600" />;
      case 'calendar':
        return <Calendar className="h-3 w-3 text-primary-600" />;
      case 'contacts':
        return <UserCheck className="h-3 w-3 text-primary-600" />;
      case 'photos':
        return <Camera className="h-3 w-3 text-primary-600" />;
      case 'chat':
        return <MessageSquare className="h-3 w-3 text-primary-600" />;
      case 'forms':
        return <FileText className="h-3 w-3 text-primary-600" />;
      case 'system':
        return <Settings className="h-3 w-3 text-primary-600" />;
      default:
        return <Settings className="h-3 w-3 text-primary-600" />;
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

  const clearLogs = () => {
    setLogs([]);
  };

  const toggleLiveMonitor = () => {
    setShowLiveMonitor(!showLiveMonitor);
    if (!showLiveMonitor) {
      setLogs([]); // Clear logs when enabling monitor
    }
  };

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'operational':
      case 'connected':
        return 'text-green-600 bg-green-100';
      case 'degraded':
      case 'reconnecting':
        return 'text-yellow-600 bg-yellow-100';
      case 'failed':
      case 'disconnected':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const logStats = getLogStats();

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-secondary-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-secondary-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center">
                <div className="p-2 bg-primary-500 rounded-lg mr-3">
                  <Database className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-secondary-900">Migration Dashboard</h1>
                  <p className="text-xs text-secondary-600">Monitor and manage your workspace migrations</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 bg-primary-100 rounded-full flex items-center justify-center">
                    <User className="h-3 w-3 text-primary-600" />
                  </div>
                  <span className="text-xs font-medium text-secondary-700">{user?.name || 'Admin User'}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={signOut} title="Sign out">
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Start Migration Button */}
          <div className="mb-6">
            <Link href="/migrations/new">
              <Button size="lg">
                <Plus className="h-4 w-4 mr-2" />
                Start Migration
              </Button>
            </Link>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="hover:shadow-lg transition-all duration-200">
              <CardContent className="p-4">
                <div className="flex items-center">
                  <div className="p-2 bg-primary-500 rounded-lg">
                    <BarChart3 className="h-5 w-5 text-white" />
                  </div>
                  <div className="ml-3">
                    <p className="text-xl font-bold text-secondary-900">{stats.total}</p>
                    <p className="text-xs text-secondary-600">Total Migrations</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-all duration-200">
              <CardContent className="p-4">
                <div className="flex items-center">
                  <div className="p-2 bg-info-500 rounded-lg">
                    <Activity className="h-5 w-5 text-white" />
                  </div>
                  <div className="ml-3">
                    <p className="text-xl font-bold text-secondary-900">{stats.active}</p>
                    <p className="text-xs text-secondary-600">Active Migrations</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-all duration-200">
              <CardContent className="p-4">
                <div className="flex items-center">
                  <div className="p-2 bg-success-500 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-white" />
                  </div>
                  <div className="ml-3">
                    <p className="text-xl font-bold text-secondary-900">{stats.completed}</p>
                    <p className="text-xs text-secondary-600">Completed</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-all duration-200">
              <CardContent className="p-4">
                <div className="flex items-center">
                  <div className="p-2 bg-danger-500 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-white" />
                  </div>
                  <div className="ml-3">
                    <p className="text-xl font-bold text-secondary-900">{stats.failed}</p>
                    <p className="text-xs text-secondary-600">Failed</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Real-time System Health & Monitoring */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* System Health Status */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-green-500 rounded-lg">
                      <Monitor className="h-5 w-5 text-white" />
                    </div>
                    <CardTitle>System Health</CardTitle>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleLiveMonitor}
                    className="flex items-center space-x-2"
                  >
                    {showLiveMonitor ? (
                      <>
                        <EyeOff className="h-4 w-4" />
                        <span>Disable Monitor</span>
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4" />
                        <span>Enable Live Monitor</span>
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <FileText className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium">Forms API</span>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getHealthStatusColor(systemHealth.formsAPI)}`}>
                      {systemHealth.formsAPI}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <FolderOpen className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium">Drive API</span>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getHealthStatusColor(systemHealth.driveAPI)}`}>
                      {systemHealth.driveAPI}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {connection.connected ? (
                        <Wifi className="h-4 w-4 text-green-600" />
                      ) : (
                        <WifiOff className="h-4 w-4 text-red-600" />
                      )}
                      <span className="text-sm font-medium">WebSocket</span>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getHealthStatusColor(systemHealth.websocket)}`}>
                      {systemHealth.websocket}
                    </span>
                  </div>

                  {connection.connected && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="text-xs text-gray-600 space-y-1">
                        <p>Client ID: {connection.clientId}</p>
                        <p>Messages: {connection.messageCount}</p>
                        <p>Connected: {connection.connectTime?.toLocaleTimeString()}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Live Log Statistics */}
            <Card>
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-500 rounded-lg">
                    <Activity className="h-5 w-5 text-white" />
                  </div>
                  <CardTitle>Live Log Statistics</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold text-gray-900">{logStats.total}</p>
                    <p className="text-xs text-gray-600">Total Events</p>
                  </div>
                  <div className="text-center p-3 bg-red-50 rounded-lg">
                    <p className="text-2xl font-bold text-red-600">{logStats.errors}</p>
                    <p className="text-xs text-red-600">Errors</p>
                  </div>
                  <div className="text-center p-3 bg-yellow-50 rounded-lg">
                    <p className="text-2xl font-bold text-yellow-600">{logStats.warnings}</p>
                    <p className="text-xs text-yellow-600">Warnings</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{logStats.success}</p>
                    <p className="text-xs text-green-600">Success</p>
                  </div>
                </div>

                {showLiveMonitor && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearLogs}
                        className="text-red-600 hover:text-red-700"
                      >
                        Clear Logs
                      </Button>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={isAutoScroll}
                          onChange={(e) => setIsAutoScroll(e.target.checked)}
                          className="rounded"
                        />
                        <span className="text-sm text-gray-600">Auto-scroll</span>
                      </label>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Live Migration Logs */}
          {showLiveMonitor && (
            <Card className="mb-6">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-purple-500 rounded-lg">
                      <Zap className="h-5 w-5 text-white" />
                    </div>
                    <CardTitle>Live Migration Logs</CardTitle>
                  </div>
                  <div className="flex items-center space-x-2">
                    {connection.connected ? (
                      <div className="flex items-center space-x-2 text-green-600">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-sm font-medium">Live</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2 text-red-600">
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        <span className="text-sm font-medium">Disconnected</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-80 overflow-y-auto bg-gray-50 rounded-lg p-4 space-y-3">
                  {logs.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-500">
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
                        className={`border-l-4 p-3 rounded-r-lg ${getLevelColor(log.level)}`}
                      >
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0 mt-0.5">
                            {getLevelIcon(log.level)}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              <span className="text-sm">{getServiceIcon(log.service)}</span>
                              <span className="px-2 py-1 bg-gray-200 text-xs font-medium rounded uppercase">
                                {log.service}
                              </span>
                              <span className="text-xs text-gray-500">
                                {formatTime(log.timestamp)}
                              </span>
                            </div>
                            
                            <p className="text-gray-900 font-medium text-sm mb-1">
                              {log.message}
                            </p>
                            
                            {log.details && (
                              <details className="mt-2">
                                <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-800">
                                  Show details
                                </summary>
                                <pre className="mt-1 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
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
              </CardContent>
            </Card>
          )}

          {/* Migration Progress Simulator */}
          <div className="mb-6">
            <MigrationProgressSimulator />
          </div>

          {/* Quick Actions for non-Google users */}
          {user?.provider !== 'google' && (
            <div className="mb-8">
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center">
                    <Shield className="h-6 w-6 text-primary-600 mr-3" />
                    <div>
                      <h3 className="text-base font-medium text-secondary-900">Google Workspace Required</h3>
                      <p className="text-secondary-600 text-sm leading-relaxed">
                        To use migration features, please sign in with a Google Workspace account that has admin privileges.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Recent Migrations */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-primary-500 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-white" />
                  </div>
                  <CardTitle>Recent Migrations</CardTitle>
                </div>
                <Link 
                  href="/migrations" 
                  className="text-sm text-primary-600 hover:text-primary-700 font-semibold transition-colors"
                >
                  View All
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentMigrations.map((migration) => (
                  <div 
                    key={migration.id} 
                    className="border border-secondary-200 rounded-lg p-5 hover:shadow-md hover:border-primary-200 transition-all bg-secondary-50/50"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center">
                          {getStatusIcon(migration.status)}
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-secondary-900">{migration.name}</h4>
                          <p className="text-xs text-secondary-600 font-medium">
                            {migration.source} → {migration.target}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Badge variant={getStatusBadge(migration.status) as any}>
                          {migration.status}
                        </Badge>
                        <Link 
                          href={migration.logUrl}
                          className="text-primary-600 hover:text-primary-800 text-xs font-medium flex items-center space-x-1 bg-primary-50 px-2 py-1 rounded-lg hover:bg-primary-100 transition-colors"
                        >
                          <FileText className="h-3 w-3" />
                          <span>Logs</span>
                          <ExternalLink className="h-2 w-2" />
                        </Link>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-6 mb-4">
                      <div>
                        <p className="text-xs font-semibold text-gray-700 mb-2">Services</p>
                        <div className="flex flex-wrap gap-2">
                          {migration.services.map((service, index) => (
                            <div key={index} className="flex items-center space-x-1 bg-gradient-to-r from-blue-50 to-blue-100 px-3 py-1 rounded-lg text-xs border border-blue-200/50">
                              {getServiceIcon(service)}
                              <span className="text-blue-700 font-semibold">{service}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-700 mb-2">Users</p>
                        <div className="flex items-center space-x-2">
                          <div className="p-1 bg-gradient-to-br from-gray-100 to-gray-200 rounded">
                            <Users className="h-4 w-4 text-gray-600" />
                          </div>
                          <span className="text-sm font-semibold text-gray-900">{migration.userCount} users</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-secondary-700 font-semibold">
                        Progress: {migration.progress}% complete
                      </div>
                      <div className="w-32">
                        <Progress 
                          value={migration.progress} 
                          variant={migration.status === 'failed' ? 'danger' : migration.status === 'completed' ? 'success' : 'default'}
                          size="sm"
                        />
                      </div>
                    </div>

                    {/* Enhanced Drive Quota Manager for active migrations with Drive service */}
                    {migration.status === 'running' && migration.services.includes('Drive') && (
                      <div className="mt-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200/50">
                        <EnhancedDriveQuotaManager
                          migrationId={migration.id}
                          isActive={true}
                          onQuotaError={(error) => {
                            console.log(`Quota error for migration ${migration.id}:`, error);
                            migrationLogger.log({
                              level: 'error',
                              category: 'api',
                              service: 'drive',
                              message: 'Drive quota exceeded in migration',
                              details: {
                                migrationId: migration.id,
                                migrationName: migration.name,
                                error
                              }
                            });
                          }}
                          onQuotaRecovered={() => {
                            console.log(`Quota recovered for migration ${migration.id}`);
                            migrationLogger.log({
                              level: 'success',
                              category: 'api',
                              service: 'drive',
                              message: 'Drive quota recovered - migration resumed',
                              details: {
                                migrationId: migration.id,
                                migrationName: migration.name
                              }
                            });
                          }}
                          onQuotaWarning={(usage) => {
                            console.log(`Quota warning for migration ${migration.id}: ${usage}%`);
                            migrationLogger.log({
                              level: 'warning',
                              category: 'api',
                              service: 'drive',
                              message: 'Drive quota usage warning',
                              details: {
                                migrationId: migration.id,
                                usage: `${usage}%`,
                                threshold: '80%'
                              }
                            });
                          }}
                          showDetailedStats={true}
                          autoRefresh={true}
                          refreshInterval={5000}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              {recentMigrations.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-primary-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <Database className="h-8 w-8 text-primary-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-secondary-900 mb-2">No migrations yet</h3>
                  <p className="text-secondary-600 mb-6">Get started by creating your first migration</p>
                  <Button size="lg" className="shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
                    <Link href="/migrations/new" className="flex items-center space-x-2">
                      <Plus className="h-4 w-4" />
                      <span>Create Migration</span>
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
        
        {/* Real-time Migration Logger */}
        <RealTimeMigrationLogger />
      </div>
    </ProtectedRoute>
  );
}
