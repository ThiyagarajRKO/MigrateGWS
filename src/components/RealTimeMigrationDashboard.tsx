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
  AlertCircle
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
            {progress}%
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
                    {task.progress}%
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

export default function RealTimeMigrationDashboard() {
  const [isConnected, setIsConnected] = useState(true);
  const [selectedTask, setSelectedTask] = useState<MigrationTask | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  // Mock data - in real implementation, this would come from WebSocket/SSE
  const [jobProgress] = useState<JobProgress>({
    jobId: 'job-123',
    status: 'running',
    progress: 67,
    totalTasks: 2450,
    completedTasks: 1641,
    failedTasks: 23,
    skippedTasks: 0,
    startedAt: new Date(),
    lastUpdatedAt: new Date(),
    estimatedTimeRemaining: 120, // 2 hours in minutes
    serviceProgress: {
      gmail: { completed: 850, total: 1200, failed: 12, progress: 71 },
      drive: { completed: 450, total: 600, failed: 5, progress: 75 },
      calendar: { completed: 200, total: 300, failed: 3, progress: 67 },
      contacts: { completed: 120, total: 150, failed: 2, progress: 80 },
      chat: { completed: 21, total: 200, failed: 1, progress: 11 },
      groups: { completed: 0, total: 0, failed: 0, progress: 0 },
      photos: { completed: 0, total: 0, failed: 0, progress: 0 }
    }
  });

  const [orchestratorMetrics] = useState<OrchestratorMetrics>({
    totalJobs: 24,
    activeJobs: 6,
    completedJobs: 18,
    failedJobs: 0,
    totalTasks: 15678,
    tasksPerSecond: 142,
    averageJobDuration: 45.6,
    microservices: [
      {
        service: 'gmail',
        status: 'healthy',
        lastHeartbeat: new Date(),
        version: '1.2.3',
        tasksInQueue: 145,
        tasksProcessing: 8,
        errorRate: 0.2,
        avgProcessingTime: 1.4
      },
      {
        service: 'drive',
        status: 'healthy',
        lastHeartbeat: new Date(),
        version: '1.2.3',
        tasksInQueue: 89,
        tasksProcessing: 12,
        errorRate: 0.8,
        avgProcessingTime: 2.1
      }
    ] as MicroserviceHealth[],
    queueDepth: {
      gmail: 145,
      drive: 89,
      calendar: 23,
      contacts: 12,
      chat: 56,
      groups: 8,
      photos: 234
    }
  });

  const [mockTasks] = useState<MigrationTask[]>([
    {
      id: 'task-1',
      jobId: 'job-123',
      tenantId: 'tenant-456',
      userId: 'user1@domain.com',
      service: 'gmail',
      status: 'completed',
      progress: 100,
      startedAt: new Date(Date.now() - 5 * 60 * 1000),
      completedAt: new Date(Date.now() - 1 * 60 * 1000),
      retryCount: 0,
      idempotencyKey: 'key-1',
      metadata: {}
    },
    {
      id: 'task-2',
      jobId: 'job-123',
      tenantId: 'tenant-456',
      userId: 'user2@domain.com',
      service: 'drive',
      status: 'running',
      progress: 45,
      startedAt: new Date(Date.now() - 3 * 60 * 1000),
      retryCount: 0,
      idempotencyKey: 'key-2',
      metadata: {}
    },
    {
      id: 'task-3',
      jobId: 'job-123',
      tenantId: 'tenant-456',
      userId: 'user3@domain.com',
      service: 'calendar',
      status: 'failed',
      progress: 0,
      startedAt: new Date(Date.now() - 10 * 60 * 1000),
      errorMessage: 'API quota exceeded',
      retryCount: 2,
      idempotencyKey: 'key-3',
      metadata: {}
    }
  ]);

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
      queued: orchestratorMetrics.queueDepth[service] || 0
    };
  };

  const getServiceProgress = (service: ServiceName) => {
    const progress = jobProgress.serviceProgress[service];
    if (!progress || progress.total === 0) return 0;
    return Math.round((progress.completed / progress.total) * 100);
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
              <div className="text-2xl font-bold text-primary-600">{jobProgress.progress}%</div>
              <div className="text-sm text-secondary-600">Overall Progress</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-success-600">{jobProgress.completedTasks}</div>
              <div className="text-sm text-secondary-600">Completed Tasks</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-info-600">{orchestratorMetrics.tasksPerSecond}</div>
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
        <TaskLog tasks={mockTasks} onTaskSelect={setSelectedTask} />

        {/* Microservice Health */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Server className="h-5 w-5 text-primary-600" />
              <span>Microservice Health</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {orchestratorMetrics.microservices.map((microservice) => (
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
                    <div className="font-medium">{microservice.errorRate}%</div>
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
              <span className="text-lg font-bold text-secondary-900">{orchestratorMetrics.totalJobs}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-secondary-700">Active Jobs</span>
              <span className="text-lg font-bold text-info-600">{orchestratorMetrics.activeJobs}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-secondary-700">Completed</span>
              <span className="text-lg font-bold text-success-600">{orchestratorMetrics.completedJobs}</span>
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
              <span className="text-lg font-bold text-primary-600">{orchestratorMetrics.averageJobDuration}min</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-secondary-700">Throughput</span>
              <span className="text-lg font-bold text-success-600">{orchestratorMetrics.tasksPerSecond}/s</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-secondary-700">Queue Depth</span>
              <span className="text-lg font-bold text-warning-600">
                {Object.values(orchestratorMetrics.queueDepth).reduce((a, b) => a + b, 0)}
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
