'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  Database, 
  Zap, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Pause, 
  Play, 
  RefreshCw,
  Mail,
  FolderOpen,
  Calendar,
  Users,
  MessageSquare,
  Camera,
  UserCheck,
  Filter,
  Download,
  Eye,
  BarChart3,
  TrendingUp,
  Server,
  AlertCircle,
  FileText,
  Search,
  Copy,
  ExternalLink
} from 'lucide-react';
import type { 
  JobProgress, 
  MigrationTask, 
  TaskStatus, 
  ServiceName, 
  MicroserviceHealth,
  OrchestratorMetrics 
} from '@/types/migration';

interface ServiceStatsProps {
  service: ServiceName;
  icon: React.ReactNode;
  stats: {
    total: number;
    completed: number;
    running: number;
    failed: number;
    queued: number;
  };
  progress: number;
}

const ServiceStats: React.FC<ServiceStatsProps> = ({ service, icon, stats, progress }) => {
  const getProgressColor = (progress: number) => {
    if (progress >= 80) return 'success';
    if (progress >= 50) return 'warning';
    return 'info';
  };

  return (
    <Card className="hover:shadow-lg transition-all duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
              {icon}
            </div>
            <div>
              <CardTitle className="text-base capitalize">{service}</CardTitle>
              <div className="text-xs text-secondary-600">
                {stats.completed}/{stats.total} completed
              </div>
            </div>
          </div>
          <Badge variant={getProgressColor(progress)} className="text-xs">
            {Math.round(progress)}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Progress value={progress} className="h-2" />
        
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex justify-between">
            <span className="text-secondary-600">Running:</span>
            <span className="font-medium text-info-600">{stats.running}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-secondary-600">Queued:</span>
            <span className="font-medium text-warning-600">{stats.queued}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-secondary-600">Failed:</span>
            <span className="font-medium text-danger-600">{stats.failed}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-secondary-600">Success:</span>
            <span className="font-medium text-success-600">{stats.completed}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

interface TaskLogProps {
  tasks: MigrationTask[];
  onTaskSelect: (task: MigrationTask) => void;
}

const TaskLog: React.FC<TaskLogProps> = ({ tasks, onTaskSelect }) => {
  const [filter, setFilter] = useState<TaskStatus | 'all'>('all');
  
  const filteredTasks = tasks.filter(task => 
    filter === 'all' ? true : task.status === filter
  );

  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-success-500" />;
      case 'running':
        return <Zap className="h-4 w-4 text-info-500" />;
      case 'failed':
        return <AlertTriangle className="h-4 w-4 text-danger-500" />;
      case 'retrying':
        return <RefreshCw className="h-4 w-4 text-warning-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-secondary-500" />;
    }
  };

  const getStatusBadge = (status: TaskStatus) => {
    const variants = {
      completed: 'success',
      running: 'info',
      failed: 'danger',
      retrying: 'warning',
      pending: 'secondary',
      cancelled: 'secondary',
      skipped: 'secondary',
      queued: 'secondary'
    } as const;
    
    return <Badge variant={variants[status as keyof typeof variants] || 'secondary'} className="text-xs">{status}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5 text-primary-600" />
            <span>Task Monitor</span>
            <Badge variant="info" className="ml-2">{filteredTasks.length} tasks</Badge>
          </CardTitle>
          
          <div className="flex items-center space-x-2">
            <select 
              className="text-sm border border-secondary-300 rounded px-2 py-1"
              value={filter}
              onChange={(e) => setFilter(e.target.value as TaskStatus | 'all')}
            >
              <option value="all">All Tasks</option>
              <option value="running">Running</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
            </select>
            <Button size="sm" variant="outline">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredTasks.map((task) => (
            <div 
              key={task.id}
              onClick={() => onTaskSelect(task)}
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-secondary-50 cursor-pointer transition-colors"
            >
              <div className="flex items-center space-x-3">
                {getStatusIcon(task.status)}
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium">{task.userId}</span>
                    <Badge variant="outline" className="text-xs">{task.service}</Badge>
                  </div>
                  <div className="text-xs text-secondary-600">
                    {task.startedAt ? new Date(task.startedAt).toLocaleTimeString() : 'Not started'}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                {getStatusBadge(task.status)}
                {task.status === 'running' && (
                  <div className="text-xs text-secondary-600">
                    {Math.round(task.progress)}%
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

interface MigrationLogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warning' | 'error' | 'success';
  service: ServiceName | 'system';
  userId?: string;
  message: string;
  details?: string;
  action?: string;
  metadata?: Record<string, any>;
}

interface MigrationLogProps {
  logs: MigrationLogEntry[];
  maxEntries?: number;
  onExportLogs?: () => void;
}

const MigrationLog: React.FC<MigrationLogProps> = ({ 
  logs, 
  maxEntries = 100,
  onExportLogs 
}) => {
  const [filter, setFilter] = useState<'all' | 'info' | 'warning' | 'error' | 'success'>('all');
  const [serviceFilter, setServiceFilter] = useState<'all' | ServiceName | 'system'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  
  const filteredLogs = logs
    .filter(log => filter === 'all' || log.level === filter)
    .filter(log => serviceFilter === 'all' || log.service === serviceFilter)
    .filter(log => 
      searchTerm === '' || 
      log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.userId?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .slice(-maxEntries)
    .reverse();

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <FileText className="h-4 w-4 text-blue-500" />;
    }
  };

  const getLevelBadge = (level: string) => {
    const variants = {
      success: 'success',
      warning: 'warning', 
      error: 'danger',
      info: 'info'
    } as const;
    
    return <Badge variant={variants[level as keyof typeof variants] || 'info'} className="text-xs">{level}</Badge>;
  };

  const getServiceIcon = (service: string) => {
    const icons = {
      gmail: <Mail className="h-4 w-4" />,
      drive: <FolderOpen className="h-4 w-4" />,
      calendar: <Calendar className="h-4 w-4" />,
      contacts: <Users className="h-4 w-4" />,
      chat: <MessageSquare className="h-4 w-4" />,
      photos: <Camera className="h-4 w-4" />,
      groups: <UserCheck className="h-4 w-4" />,
      system: <Server className="h-4 w-4" />
    };
    return icons[service as keyof typeof icons] || <Activity className="h-4 w-4" />;
  };

  const copyLogEntry = (log: MigrationLogEntry) => {
    const logText = `[${log.timestamp.toISOString()}] [${log.level.toUpperCase()}] [${log.service}] ${log.userId ? `[${log.userId}] ` : ''}${log.message}${log.details ? `\nDetails: ${log.details}` : ''}`;
    navigator.clipboard.writeText(logText);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-primary-600" />
            <span>Migration Logs</span>
            <Badge variant="info" className="ml-2">{filteredLogs.length} entries</Badge>
          </CardTitle>
          
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search logs..."
                className="text-sm border border-gray-300 rounded pl-8 pr-3 py-1 w-40"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <select 
              className="text-sm border border-gray-300 rounded px-2 py-1"
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
            >
              <option value="all">All Levels</option>
              <option value="info">Info</option>
              <option value="success">Success</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
            </select>
            
            <select 
              className="text-sm border border-gray-300 rounded px-2 py-1"
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value as any)}
            >
              <option value="all">All Services</option>
              <option value="system">System</option>
              <option value="gmail">Gmail</option>
              <option value="drive">Drive</option>
              <option value="calendar">Calendar</option>
              <option value="contacts">Contacts</option>
              <option value="chat">Chat</option>
              <option value="photos">Photos</option>
              <option value="groups">Groups</option>
            </select>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setAutoScroll(!autoScroll)}
              className={autoScroll ? 'bg-blue-50' : ''}
            >
              <Eye className="h-4 w-4" />
            </Button>
            
            {onExportLogs && (
              <Button size="sm" variant="outline" onClick={onExportLogs}>
                <Download className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1 max-h-96 overflow-y-auto font-mono text-xs">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No log entries match the current filters</p>
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div 
                key={log.id}
                className="flex items-start space-x-2 p-2 border-l-2 hover:bg-gray-50 group"
                style={{
                  borderLeftColor: 
                    log.level === 'error' ? '#ef4444' :
                    log.level === 'warning' ? '#f59e0b' :
                    log.level === 'success' ? '#10b981' :
                    '#3b82f6'
                }}
              >
                <div className="flex items-center space-x-1 min-w-20">
                  {getLevelIcon(log.level)}
                  <span className="text-gray-500">
                    {log.timestamp.toLocaleTimeString()}
                  </span>
                </div>
                
                <div className="flex items-center space-x-1 min-w-16">
                  {getServiceIcon(log.service)}
                  <span className="text-gray-600 capitalize text-xs">
                    {log.service}
                  </span>
                </div>
                
                {log.userId && (
                  <div className="min-w-32">
                    <span className="text-purple-600 text-xs font-medium">
                      {log.userId}
                    </span>
                  </div>
                )}
                
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    {getLevelBadge(log.level)}
                    <span className={`${
                      log.level === 'error' ? 'text-red-700' :
                      log.level === 'warning' ? 'text-yellow-700' :
                      log.level === 'success' ? 'text-green-700' :
                      'text-gray-700'
                    }`}>
                      {log.message}
                    </span>
                  </div>
                  
                  {log.details && (
                    <div className="mt-1 text-gray-600 text-xs pl-2 border-l border-gray-200">
                      {log.details}
                    </div>
                  )}
                  
                  {log.action && (
                    <div className="mt-1">
                      <span className="text-blue-600 text-xs font-medium">
                        Action: {log.action}
                      </span>
                    </div>
                  )}
                </div>
                
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyLogEntry(log)}
                    className="h-6 w-6 p-0"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

interface RealTimeMigrationDashboardProps {
  migrationStatus?: {
    id: string;
    status: 'running' | 'completed' | 'failed' | 'paused';
    overallProgress: number;
    serviceProgress?: Record<string, {
      progress: number;
      status: 'pending' | 'running' | 'completed' | 'failed';
      itemsProcessed: number;
      totalItems: number;
      errors: string[];
    }>;
    userProgress?: Record<string, {
      progress: number;
      currentService: string;
      status: 'pending' | 'processing' | 'completed' | 'failed';
      servicesCompleted: string[];
      errors: string[];
    }>;
    startTime?: string;
    estimatedCompletion?: string;
  };
  selectedUsers?: Array<{
    primaryEmail: string;
    sourceEmail: string;
    name?: { fullName?: string };
  }>;
  services?: string[];
  tasks?: MigrationTask[];
  logs?: MigrationLogEntry[];
  orchestratorMetrics?: OrchestratorMetrics;
}

export default function RealTimeMigrationDashboard({ 
  migrationStatus, 
  selectedUsers = [], 
  services = ['gmail', 'drive', 'calendar', 'contacts', 'chat', 'groups', 'photos'],
  tasks = [],
  logs = [],
  orchestratorMetrics
}: RealTimeMigrationDashboardProps = {}) {
  const [isConnected, setIsConnected] = useState(true);
  const [selectedTask, setSelectedTask] = useState<MigrationTask | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  // Use real migration data when available, fall back to mock data
  const mapMigrationStatusToTaskStatus = (status: string): TaskStatus => {
    switch (status) {
      case 'running': return 'running';
      case 'completed': return 'completed';
      case 'failed': return 'failed';
      case 'paused': return 'pending'; // Map paused to pending for compatibility
      default: return 'pending';
    }
  };

  const jobProgress: JobProgress = migrationStatus ? {
    jobId: migrationStatus.id,
    status: mapMigrationStatusToTaskStatus(migrationStatus.status),
    progress: migrationStatus.overallProgress,
    totalTasks: selectedUsers.length * services.length,
    completedTasks: Math.round((migrationStatus.overallProgress / 100) * selectedUsers.length * services.length),
    failedTasks: Object.values(migrationStatus.serviceProgress || {}).reduce((sum, service) => sum + service.errors.length, 0),
    skippedTasks: 0,
    startedAt: migrationStatus.startTime ? new Date(migrationStatus.startTime) : new Date(),
    lastUpdatedAt: new Date(),
    estimatedTimeRemaining: migrationStatus.estimatedCompletion ? 
      Math.max(0, Math.round((new Date(migrationStatus.estimatedCompletion).getTime() - Date.now()) / (1000 * 60))) : 
      120,
    serviceProgress: services.reduce((acc, service) => {
      const serviceData = migrationStatus.serviceProgress?.[service] || {
        progress: 0,
        itemsProcessed: 0,
        totalItems: selectedUsers.length,
        errors: []
      };
      acc[service as ServiceName] = {
        completed: serviceData.itemsProcessed,
        total: serviceData.totalItems,
        failed: serviceData.errors.length,
        progress: serviceData.progress
      };
      return acc;
    }, {} as Record<ServiceName, any>)
  } : {
    // Fallback mock data when no real migration status is available
    jobId: 'job-123',
    status: 'running' as TaskStatus,
    progress: 67,
    totalTasks: 2450,
    completedTasks: 1641,
    failedTasks: 23,
    skippedTasks: 0,
    startedAt: new Date(),
    lastUpdatedAt: new Date(),
    estimatedTimeRemaining: 120,
    serviceProgress: {
      gmail: { completed: 850, total: 1200, failed: 12, progress: 71 },
      drive: { completed: 450, total: 600, failed: 5, progress: 75 },
      calendar: { completed: 200, total: 300, failed: 3, progress: 67 },
      contacts: { completed: 120, total: 150, failed: 2, progress: 80 },
      chat: { completed: 21, total: 200, failed: 1, progress: 11 },
      groups: { completed: 0, total: 0, failed: 0, progress: 0 },
      photos: { completed: 0, total: 0, failed: 0, progress: 0 }
    }
  };

  // Use real orchestrator metrics when available, fall back to calculated values
  const defaultOrchestratorMetrics: OrchestratorMetrics = {
    totalJobs: 1,
    activeJobs: migrationStatus?.status === 'running' ? 1 : 0,
    completedJobs: migrationStatus?.status === 'completed' ? 1 : 0,
    failedJobs: migrationStatus?.status === 'failed' ? 1 : 0,
    totalTasks: selectedUsers.length * services.length,
    tasksPerSecond: 12,
    averageJobDuration: 45.6,
    microservices: services.map(service => ({
      service: service as ServiceName,
      status: 'healthy' as const,
      lastHeartbeat: new Date(),
      version: '1.0.0',
      tasksInQueue: tasks.filter(t => t.service === service && t.status === 'pending').length,
      tasksProcessing: tasks.filter(t => t.service === service && t.status === 'running').length,
      errorRate: tasks.filter(t => t.service === service && t.status === 'failed').length / Math.max(tasks.filter(t => t.service === service).length, 1) * 100,
      avgProcessingTime: 2.1
    })),
    queueDepth: services.reduce((acc, service) => ({
      ...acc,
      [service]: tasks.filter(t => t.service === service && t.status === 'pending').length
    }), {} as Record<ServiceName, number>)
  };

  const currentOrchestratorMetrics = orchestratorMetrics || defaultOrchestratorMetrics;

  // Use real tasks when available, fall back to generated tasks based on migration status
  const generateDefaultTasks = (): MigrationTask[] => {
    if (!migrationStatus || selectedUsers.length === 0) return [];
    
    return selectedUsers.flatMap((user, userIndex) => 
      services.map((service, serviceIndex) => ({
        id: `task-${userIndex}-${serviceIndex}`,
        jobId: migrationStatus.id,
        tenantId: 'default-tenant',
        userId: user.sourceEmail,
        service: service as ServiceName,
        status: (migrationStatus.userProgress?.[user.sourceEmail]?.status === 'completed' ? 'completed' :
                migrationStatus.userProgress?.[user.sourceEmail]?.status === 'processing' ? 'running' :
                migrationStatus.userProgress?.[user.sourceEmail]?.status === 'failed' ? 'failed' :
                'pending') as TaskStatus,
        progress: migrationStatus.userProgress?.[user.sourceEmail]?.progress || 0,
        startedAt: migrationStatus.startTime ? new Date(migrationStatus.startTime) : new Date(),
        retryCount: 0,
        idempotencyKey: `${user.sourceEmail}-${service}`,
        metadata: {}
      }))
    );
  };

  const currentTasks = tasks.length > 0 ? tasks : generateDefaultTasks();

  const serviceIcons = {
    gmail: <Mail className="h-5 w-5 text-primary-600" />,
    drive: <FolderOpen className="h-5 w-5 text-primary-600" />,
    calendar: <Calendar className="h-5 w-5 text-primary-600" />,
    contacts: <UserCheck className="h-5 w-5 text-primary-600" />,
    chat: <MessageSquare className="h-5 w-5 text-primary-600" />,
    groups: <Users className="h-5 w-5 text-primary-600" />,
    photos: <Camera className="h-5 w-5 text-primary-600" />
  };

  const getServiceStats = (service: ServiceName) => {
    const progress = jobProgress.serviceProgress[service];
    if (!progress) return { total: 0, completed: 0, running: 0, failed: 0, queued: 0 };
    
    const running = Math.max(0, progress.total - progress.completed - progress.failed);
    return {
      total: progress.total,
      completed: progress.completed,
      running: running,
      failed: progress.failed,
      queued: currentOrchestratorMetrics.queueDepth[service] || 0
    };
  };

  const getServiceProgress = (service: ServiceName) => {
    const progress = jobProgress.serviceProgress[service];
    if (!progress || progress.total === 0) return 0;
    return Math.round((progress.completed / progress.total) * 100);
  };

  // Use real logs when available, fall back to generated logs based on migration status
  const generateDefaultLogs = (): MigrationLogEntry[] => {
    if (!migrationStatus) return [];
    
    const defaultLogs: MigrationLogEntry[] = [];
    
    // System startup log
    defaultLogs.push({
      id: 'system-start',
      timestamp: migrationStatus.startTime ? new Date(migrationStatus.startTime) : new Date(),
      level: 'info',
      service: 'system',
      message: `Migration started for ${selectedUsers.length} users`,
      details: `Initializing migration workflow with selected services: ${services.join(', ')}`,
      action: 'Migration initialization'
    });

    // Generate logs based on user progress
    selectedUsers.forEach((user, index) => {
      const userProgress = migrationStatus.userProgress?.[user.sourceEmail];
      if (!userProgress) return;
      
      userProgress.servicesCompleted?.forEach(service => {
        defaultLogs.push({
          id: `${user.sourceEmail}-${service}-completed`,
          timestamp: new Date(Date.now() - (selectedUsers.length - index) * 30000),
          level: 'success',
          service: service as ServiceName,
          userId: user.sourceEmail,
          message: `${service.charAt(0).toUpperCase() + service.slice(1)} migration completed successfully`,
          details: `Migration completed for ${user.name?.fullName || user.sourceEmail}`,
          action: `${service} migration`
        });
      });

      // Add error logs for any errors
      userProgress.errors?.forEach((error, errorIndex) => {
        defaultLogs.push({
          id: `${user.sourceEmail}-error-${errorIndex}`,
          timestamp: new Date(Date.now() - (selectedUsers.length - index) * 20000 - errorIndex * 5000),
          level: 'error',
          service: userProgress.currentService as ServiceName || 'system',
          userId: user.sourceEmail,
          message: error,
          details: `Error occurred during ${userProgress.currentService} migration for ${user.name?.fullName || user.sourceEmail}`,
          action: 'Error handling'
        });
      });
    });

    return defaultLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  };

  const currentLogs = logs.length > 0 ? logs : generateDefaultLogs();

  const handleExportLogs = () => {
    const logData = currentLogs.map(log => ({
      timestamp: log.timestamp.toISOString(),
      level: log.level,
      service: log.service,
      userId: log.userId || '',
      message: log.message,
      details: log.details || '',
      action: log.action || ''
    }));
    
    const csvContent = [
      ['Timestamp', 'Level', 'Service', 'User ID', 'Message', 'Details', 'Action'],
      ...logData.map(log => [
        log.timestamp,
        log.level,
        log.service,
        log.userId,
        log.message,
        log.details,
        log.action
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `migration-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      // Simulate real-time updates
      console.log('Refreshing dashboard data...');
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-3">
              <Activity className="h-6 w-6 text-primary-600" />
              <span>Real-Time Migration Dashboard</span>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success-500' : 'bg-danger-500'}`} />
                <span className="text-sm text-secondary-600">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </CardTitle>
            
            <div className="flex items-center space-x-2">
              <Button
                size="sm"
                variant={autoRefresh ? 'primary' : 'outline'}
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                {autoRefresh ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {autoRefresh ? 'Pause' : 'Resume'}
              </Button>
              <Button size="sm" variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary-600">{Math.round(jobProgress.progress)}%</div>
              <div className="text-sm text-secondary-600">Overall Progress</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-success-600">{jobProgress.completedTasks}</div>
              <div className="text-sm text-secondary-600">Completed Tasks</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-info-600">{currentOrchestratorMetrics.tasksPerSecond}</div>
              <div className="text-sm text-secondary-600">Tasks/Second</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-danger-600">{jobProgress.failedTasks}</div>
              <div className="text-sm text-secondary-600">Failed Tasks</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Service Progress Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(Object.keys(serviceIcons) as ServiceName[]).map((service) => (
          <ServiceStats
            key={service}
            service={service}
            icon={serviceIcons[service]}
            stats={getServiceStats(service)}
            progress={getServiceProgress(service)}
          />
        ))}
      </div>

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Task Log */}
        <TaskLog tasks={currentTasks} onTaskSelect={setSelectedTask} />

        {/* Microservice Health */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Server className="h-5 w-5 text-primary-600" />
              <span>Microservice Health</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentOrchestratorMetrics.microservices.map((microservice) => (
              <div key={microservice.service} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  {serviceIcons[microservice.service]}
                  <div>
                    <div className="text-sm font-medium capitalize">{microservice.service}</div>
                    <div className="text-xs text-secondary-600">v{microservice.version}</div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4 text-xs">
                  <div className="text-center">
                    <div className="font-medium">{microservice.tasksInQueue}</div>
                    <div className="text-secondary-600">Queue</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium">{microservice.tasksProcessing}</div>
                    <div className="text-secondary-600">Processing</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium">{Math.round(microservice.errorRate)}%</div>
                    <div className="text-secondary-600">Error Rate</div>
                  </div>
                  <Badge 
                    variant={
                      microservice.status === 'healthy' ? 'success' : 
                      microservice.status === 'degraded' ? 'warning' : 'danger'
                    }
                    className="text-xs"
                  >
                    {microservice.status}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Migration Logs - Full Width */}
      <MigrationLog 
        logs={currentLogs}
        maxEntries={50}
        onExportLogs={handleExportLogs}
      />

      {/* System Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center space-x-2">
              <BarChart3 className="h-4 w-4 text-primary-600" />
              <span>Job Statistics</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-secondary-700">Total Jobs</span>
              <span className="text-lg font-bold text-secondary-900">{currentOrchestratorMetrics.totalJobs}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-secondary-700">Active Jobs</span>
              <span className="text-lg font-bold text-info-600">{currentOrchestratorMetrics.activeJobs}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-secondary-700">Completed</span>
              <span className="text-lg font-bold text-success-600">{currentOrchestratorMetrics.completedJobs}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-success-600" />
              <span>Performance</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-secondary-700">Avg Duration</span>
              <span className="text-lg font-bold text-primary-600">{currentOrchestratorMetrics.averageJobDuration}min</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-secondary-700">Throughput</span>
              <span className="text-lg font-bold text-success-600">{currentOrchestratorMetrics.tasksPerSecond}/s</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-secondary-700">Queue Depth</span>
              <span className="text-lg font-bold text-warning-600">
                {Object.values(currentOrchestratorMetrics.queueDepth).reduce((a, b) => a + b, 0)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center space-x-2">
              <Clock className="h-4 w-4 text-info-600" />
              <span>Timing</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <div className="text-sm text-secondary-700">Started</div>
              <div className="text-sm font-medium">
                {jobProgress.startedAt?.toLocaleString()}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-secondary-700">ETA</div>
              <div className="text-sm font-medium">
                {jobProgress.estimatedTimeRemaining ? 
                  `${jobProgress.estimatedTimeRemaining} minutes` : 
                  'Calculating...'
                }
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
