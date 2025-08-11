'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Database, 
  GitBranch, 
  Zap, 
  Shield, 
  Activity, 
  Mail, 
  FolderOpen, 
  Calendar, 
  Users, 
  MessageSquare, 
  Camera, 
  UserCheck,
  ArrowRight,
  CheckCircle,
  Clock,
  AlertTriangle,
  Server,
  Network,
  Eye,
  Settings,
  Workflow,
  BarChart3
} from 'lucide-react';

interface MicroserviceCardProps {
  service: {
    name: string;
    icon: React.ReactNode;
    status: 'healthy' | 'degraded' | 'unhealthy';
    tasksInQueue: number;
    tasksProcessing: number;
    description: string;
  };
}

const MicroserviceCard: React.FC<MicroserviceCardProps> = ({ service }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'success';
      case 'degraded': return 'warning';
      case 'unhealthy': return 'danger';
      default: return 'secondary';
    }
  };

  return (
    <Card className="hover:shadow-lg transition-all duration-200 border-l-4 border-primary-500">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
              {service.icon}
            </div>
            <div>
              <CardTitle className="text-base">{service.name}</CardTitle>
              <Badge variant={getStatusColor(service.status)} className="text-xs mt-1">
                {service.status}
              </Badge>
            </div>
          </div>
          <div className="text-right text-xs text-secondary-600">
            <div>Queue: {service.tasksInQueue}</div>
            <div>Processing: {service.tasksProcessing}</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-xs text-secondary-700">{service.description}</p>
      </CardContent>
    </Card>
  );
};

export default function MigrationArchitecture() {
  const [selectedFlow, setSelectedFlow] = useState<'overview' | 'onboarding' | 'execution' | 'monitoring'>('overview');

  const microservices = [
    {
      name: 'Gmail Service',
      icon: <Mail className="h-5 w-5 text-primary-600" />,
      status: 'healthy' as const,
      tasksInQueue: 145,
      tasksProcessing: 8,
      description: 'Email migration with labels, filters, and threading preservation'
    },
    {
      name: 'Drive Service',
      icon: <FolderOpen className="h-5 w-5 text-primary-600" />,
      status: 'healthy' as const,
      tasksInQueue: 89,
      tasksProcessing: 12,
      description: 'File migration with permissions and sharing link preservation'
    },
    {
      name: 'Calendar Service',
      icon: <Calendar className="h-5 w-5 text-primary-600" />,
      status: 'degraded' as const,
      tasksInQueue: 23,
      tasksProcessing: 3,
      description: 'Calendar events with attendee remapping and recurring events'
    },
    {
      name: 'Contacts Service',
      icon: <UserCheck className="h-5 w-5 text-primary-600" />,
      status: 'healthy' as const,
      tasksInQueue: 12,
      tasksProcessing: 2,
      description: 'Contact migration with groups and custom fields'
    },
    {
      name: 'Chat Service',
      icon: <MessageSquare className="h-5 w-5 text-primary-600" />,
      status: 'healthy' as const,
      tasksInQueue: 56,
      tasksProcessing: 4,
      description: 'Chat history and room membership migration'
    },
    {
      name: 'Groups Service',
      icon: <Users className="h-5 w-5 text-primary-600" />,
      status: 'healthy' as const,
      tasksInQueue: 8,
      tasksProcessing: 1,
      description: 'Google Groups with membership and permission migration'
    },
    {
      name: 'Photos Service',
      icon: <Camera className="h-5 w-5 text-primary-600" />,
      status: 'unhealthy' as const,
      tasksInQueue: 234,
      tasksProcessing: 0,
      description: 'Google Photos albums and sharing settings migration'
    }
  ];

  const flowSteps = {
    overview: [
      { title: 'Tenant Registration', description: 'New tenant registers on SaaS platform', icon: <UserCheck className="h-4 w-4" />, status: 'completed' },
      { title: 'OAuth Authorization', description: 'Admin authorizes via OAuth consent screen', icon: <Shield className="h-4 w-4" />, status: 'completed' },
      { title: 'DWD Configuration', description: 'Service account client ID added to Domain-wide Delegation', icon: <Settings className="h-4 w-4" />, status: 'completed' },
      { title: 'Orchestration', description: 'Jobs split by service and queued for processing', icon: <GitBranch className="h-4 w-4" />, status: 'running' },
      { title: 'Microservice Execution', description: 'Parallel processing across all services', icon: <Zap className="h-4 w-4" />, status: 'running' },
      { title: 'Progress Monitoring', description: 'Real-time dashboard updates and logging', icon: <Activity className="h-4 w-4" />, status: 'running' }
    ],
    onboarding: [
      { title: 'Tenant Onboarding', description: 'Initial tenant setup and configuration', icon: <Database className="h-4 w-4" />, status: 'completed' },
      { title: 'OAuth Setup', description: 'Google Workspace OAuth consent and scopes', icon: <Shield className="h-4 w-4" />, status: 'completed' },
      { title: 'DWD Verification', description: 'Verify domain-wide delegation configuration', icon: <CheckCircle className="h-4 w-4" />, status: 'completed' },
      { title: 'Test Migration', description: 'Run test migration with sample data', icon: <Workflow className="h-4 w-4" />, status: 'pending' }
    ],
    execution: [
      { title: 'Job Validation', description: 'Validate migration job configuration', icon: <CheckCircle className="h-4 w-4" />, status: 'completed' },
      { title: 'Task Splitting', description: 'Split job into per-user, per-service tasks', icon: <GitBranch className="h-4 w-4" />, status: 'completed' },
      { title: 'Queue Distribution', description: 'Distribute tasks to service-specific queues', icon: <Network className="h-4 w-4" />, status: 'running' },
      { title: 'Parallel Processing', description: 'Execute tasks across microservices', icon: <Server className="h-4 w-4" />, status: 'running' }
    ],
    monitoring: [
      { title: 'Real-time Status', description: 'Live progress tracking and updates', icon: <Activity className="h-4 w-4" />, status: 'running' },
      { title: 'Log Aggregation', description: 'Centralized logging with filtering', icon: <Eye className="h-4 w-4" />, status: 'running' },
      { title: 'Metrics Dashboard', description: 'Performance metrics and health monitoring', icon: <BarChart3 className="h-4 w-4" />, status: 'running' },
      { title: 'Audit Trail', description: 'Complete audit logs for compliance', icon: <Shield className="h-4 w-4" />, status: 'running' }
    ]
  };

  const getStepStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-success-500" />;
      case 'running':
        return <Clock className="h-4 w-4 text-info-500 animate-spin" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-secondary-500" />;
      case 'failed':
        return <AlertTriangle className="h-4 w-4 text-danger-500" />;
      default:
        return <Clock className="h-4 w-4 text-secondary-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Architecture Overview Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-3">
            <Database className="h-6 w-6 text-primary-600" />
            <span>Microservices Migration Architecture</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-secondary-700 mb-4">
            Enterprise-grade Google Workspace migration system with distributed microservices, 
            shared service account authentication, and real-time monitoring.
          </p>
          
          {/* Flow Selection Tabs */}
          <div className="flex space-x-2 mb-6">
            {(['overview', 'onboarding', 'execution', 'monitoring'] as const).map((flow) => (
              <Button
                key={flow}
                variant={selectedFlow === flow ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setSelectedFlow(flow)}
                className="capitalize"
              >
                {flow}
              </Button>
            ))}
          </div>

          {/* Flow Steps */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {flowSteps[selectedFlow].map((step, index) => (
              <Card key={index} className="border-l-4 border-primary-500">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      {step.icon}
                      <span className="text-sm font-medium">{step.title}</span>
                    </div>
                    {getStepStatusIcon(step.status)}
                  </div>
                  <p className="text-xs text-secondary-600">{step.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Microservices Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-3">
            <Server className="h-5 w-5 text-primary-600" />
            <span>Microservice Status</span>
            <Badge variant="info" className="ml-auto">7 Services</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {microservices.map((service, index) => (
              <MicroserviceCard key={index} service={service} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Architecture Diagram */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-3">
            <Workflow className="h-5 w-5 text-primary-600" />
            <span>Migration Flow Architecture</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-secondary-50 p-6 rounded-lg">
            <pre className="text-xs text-secondary-700 whitespace-pre-wrap overflow-x-auto">
{`┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Tenant         │    │   OAuth          │    │   DWD           │
│   Registration   │───▶│   Authorization  │───▶│   Configuration │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Orchestration Service                        │
│  • Job Validation  • Task Splitting  • Queue Management        │
└─────────────────────────┬───────────────────────────────────────┘
                          │
         ┌────────────────┼────────────────┐
         ▼                ▼                ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│   Gmail     │  │   Drive     │  │  Calendar   │  ···
│ Microservice│  │Microservice │  │Microservice │
└─────────────┘  └─────────────┘  └─────────────┘
         │                │                │
         └────────────────┼────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│              Google Workspace APIs                              │
│         (Shared Service Account + Impersonation)               │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                Real-time Dashboard                              │
│    • Progress Tracking  • Logs  • Metrics  • Audit            │
└─────────────────────────────────────────────────────────────────┘`}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* System Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center space-x-2">
              <Activity className="h-4 w-4 text-primary-600" />
              <span>System Performance</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-secondary-700">Tasks/Second</span>
              <span className="text-lg font-bold text-primary-600">152</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-secondary-700">Queue Depth</span>
              <span className="text-lg font-bold text-warning-600">567</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-secondary-700">Error Rate</span>
              <span className="text-lg font-bold text-success-600">0.2%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center space-x-2">
              <BarChart3 className="h-4 w-4 text-success-600" />
              <span>Active Migrations</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Total Jobs</span>
                <span className="text-sm font-medium">24</span>
              </div>
              <Progress value={78} className="h-2" />
              <div className="text-xs text-secondary-600">18 completed, 6 running</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center space-x-2">
              <Shield className="h-4 w-4 text-info-600" />
              <span>Security & Compliance</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-success-500" />
              <span className="text-sm">DWD Verified</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-success-500" />
              <span className="text-sm">Audit Logging</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-success-500" />
              <span className="text-sm">Data Isolation</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
