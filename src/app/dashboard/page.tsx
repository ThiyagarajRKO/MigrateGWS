'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
  Zap
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

export default function Dashboard() {
  const { user, signOut } = useAuth();
  
  const [stats] = useState<MigrationStats>({
    total: 24,
    active: 3,
    completed: 18,
    failed: 3
  });

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
      default:
        return <Settings className="h-3 w-3 text-primary-600" />;
    }
  };

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
      </div>
    </ProtectedRoute>
  );
}
