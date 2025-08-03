'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/ProtectedRoute';
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
        return <Clock className="h-4 w-4 text-blue-600" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-blue-600" />;
      case 'failed':
        return <AlertTriangle className="h-4 w-4 text-blue-600" />;
      default:
        return <Clock className="h-4 w-4 text-blue-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getServiceIcon = (service: string) => {
    switch (service.toLowerCase()) {
      case 'gmail':
        return <Mail className="h-3 w-3 text-blue-600" />;
      case 'drive':
        return <FolderOpen className="h-3 w-3 text-blue-600" />;
      case 'calendar':
        return <Calendar className="h-3 w-3 text-blue-600" />;
      case 'contacts':
        return <UserCheck className="h-3 w-3 text-blue-600" />;
      case 'photos':
        return <Camera className="h-3 w-3 text-blue-600" />;
      case 'chat':
        return <MessageSquare className="h-3 w-3 text-blue-600" />;
      default:
        return <Settings className="h-3 w-3 text-blue-600" />;
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div className="flex items-center">
                <div className="p-2 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl mr-4 shadow-lg">
                  <Database className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold text-gray-900">Migration Dashboard</h1>
                  <p className="text-gray-700 font-medium">Monitor and manage your workspace migrations</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="h-4 w-4 text-blue-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-700">{user?.name || 'Admin User'}</span>
                </div>
                <button
                  onClick={signOut}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Sign out"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Start Migration Button */}
          <div className="mb-8">
            <Link 
              href="/migrations/new"
              className="inline-flex items-center bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all font-medium space-x-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              <Plus className="h-5 w-5" />
              <span>Start Migration</span>
            </Link>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
            <div className="bg-white/70 backdrop-blur-sm rounded-xl shadow-sm border border-white/50 p-6 hover:shadow-lg transition-all">
              <div className="flex items-center">
                <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-md">
                  <BarChart3 className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                  <p className="text-sm text-gray-700 font-medium">Total Migrations</p>
                </div>
              </div>
            </div>

            <div className="bg-white/70 backdrop-blur-sm rounded-xl shadow-sm border border-white/50 p-6 hover:shadow-lg transition-all">
              <div className="flex items-center">
                <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-md">
                  <Activity className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
                  <p className="text-sm text-gray-700 font-medium">Active Migrations</p>
                </div>
              </div>
            </div>

            <div className="bg-white/70 backdrop-blur-sm rounded-xl shadow-sm border border-white/50 p-6 hover:shadow-lg transition-all">
              <div className="flex items-center">
                <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-md">
                  <CheckCircle className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-bold text-gray-900">{stats.completed}</p>
                  <p className="text-sm text-gray-700 font-medium">Completed</p>
                </div>
              </div>
            </div>

            <div className="bg-white/70 backdrop-blur-sm rounded-xl shadow-sm border border-white/50 p-6 hover:shadow-lg transition-all">
              <div className="flex items-center">
                <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-md">
                  <AlertTriangle className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-bold text-gray-900">{stats.failed}</p>
                  <p className="text-sm text-gray-700 font-medium">Failed</p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions for non-Google users */}
          {user?.provider !== 'google' && (
            <div className="bg-blue-50 rounded-lg p-5 mb-8 border border-blue-200">
              <div className="flex items-center">
                <Shield className="h-6 w-6 text-blue-600 mr-3" />
                <div>
                  <h3 className="text-base font-medium text-gray-900">Google Workspace Required</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    To use migration features, please sign in with a Google Workspace account that has admin privileges.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Recent Migrations */}
          <div className="bg-white/70 backdrop-blur-sm rounded-xl shadow-sm border border-white/50">
            <div className="px-6 py-5 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Recent Migrations</h3>
                </div>
                <Link 
                  href="/migrations" 
                  className="text-sm text-blue-600 hover:text-blue-700 font-semibold transition-colors"
                >
                  View All
                </Link>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {recentMigrations.map((migration) => (
                  <div 
                    key={migration.id} 
                    className="border border-gray-100 rounded-xl p-5 hover:shadow-md hover:border-blue-200 transition-all bg-gradient-to-r from-white to-gray-50/50"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center">
                          {getStatusIcon(migration.status)}
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900">{migration.name}</h4>
                          <p className="text-xs text-gray-600 font-medium">
                            {migration.source} → {migration.target}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(migration.status)}`}>
                          {migration.status}
                        </span>
                        <Link 
                          href={migration.logUrl}
                          className="text-blue-600 hover:text-blue-800 text-xs font-medium flex items-center space-x-1 bg-blue-50 px-2 py-1 rounded-lg hover:bg-blue-100 transition-colors"
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
                      <div className="text-xs text-gray-700 font-semibold">
                        Progress: {migration.progress}% complete
                      </div>
                      <div className="w-32 bg-gray-200 rounded-full h-2.5 overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-300"
                          style={{ width: `${migration.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {recentMigrations.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <Database className="h-8 w-8 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No migrations yet</h3>
                  <p className="text-gray-600 mb-6">Get started by creating your first migration</p>
                  <Link 
                    href="/migrations/new"
                    className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Migration
                  </Link>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
