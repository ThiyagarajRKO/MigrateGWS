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
  Settings
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
      createdAt: '2024-01-15T10:30:00Z'
    },
    {
      id: '2',
      name: 'Sales Department Migration',
      source: 'sales.oldcompany.com',
      target: 'sales.newcompany.com',
      status: 'completed',
      progress: 100,
      createdAt: '2024-01-14T14:20:00Z'
    },
    {
      id: '3',
      name: 'Engineering Team Migration',
      source: 'dev.oldcompany.com',
      target: 'engineering.newcompany.com',
      status: 'failed',
      progress: 25,
      createdAt: '2024-01-13T09:15:00Z'
    }
  ]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Clock className="h-4 w-4 text-blue-600" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center">
                <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl mr-3 shadow-lg">
                  <Database className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Migration Dashboard</h1>
                  <p className="text-sm text-gray-600">Monitor and manage your Google Workspace migrations</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <img 
                    src={user?.avatar || '/default-avatar.png'} 
                    alt={user?.name || 'User'} 
                    className="h-8 w-8 rounded-full"
                  />
                  <span className="text-sm font-medium text-gray-700">{user?.name}</span>
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
          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-3 bg-blue-100 rounded-full">
                  <BarChart3 className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                  <p className="text-sm text-gray-600">Total Migrations</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-3 bg-yellow-100 rounded-full">
                  <Clock className="h-6 w-6 text-yellow-600" />
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
                  <p className="text-sm text-gray-600">Active Migrations</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-3 bg-green-100 rounded-full">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-bold text-gray-900">{stats.completed}</p>
                  <p className="text-sm text-gray-600">Completed</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-3 bg-red-100 rounded-full">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-bold text-gray-900">{stats.failed}</p>
                  <p className="text-sm text-gray-600">Failed</p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mb-8">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Link 
                href="/migrations/new"
                className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer"
              >
                <div className="flex items-center">
                  <Plus className="h-8 w-8 text-blue-600 mr-4" />
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">Start New Migration</h3>
                    <p className="text-xs text-gray-500">Begin a new Google Workspace migration</p>
                  </div>
                </div>
              </Link>

              <Link 
                href="/user-mapping"
                className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer"
              >
                <div className="flex items-center">
                  <Users className="h-8 w-8 text-green-600 mr-4" />
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">User Mapping</h3>
                    <p className="text-xs text-gray-500">Configure user mapping for migration</p>
                  </div>
                </div>
              </Link>

              <Link 
                href="/migrations"
                className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer"
              >
                <div className="flex items-center">
                  <Calendar className="h-8 w-8 text-purple-600 mr-4" />
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">View All Migrations</h3>
                    <p className="text-xs text-gray-500">Monitor migration progress</p>
                  </div>
                </div>
              </Link>
            </div>
          </div>

          {/* Quick Actions for non-Google users */}
          {user?.provider !== 'google' && (
            <div className="bg-blue-50 rounded-lg p-6 mb-8">
              <div className="flex items-center">
                <Shield className="h-6 w-6 text-blue-600 mr-3" />
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Google Workspace Required</h3>
                  <p className="text-gray-600">
                    To use migration features, please sign in with a Google Workspace account that has admin privileges.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Recent Migrations */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Recent Migrations</h3>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {recentMigrations.map((migration) => (
                  <div key={migration.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center space-x-4">
                      {getStatusIcon(migration.status)}
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">{migration.name}</h4>
                        <p className="text-xs text-gray-500">
                          {migration.source} → {migration.target}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(migration.status)}`}>
                          {migration.status}
                        </span>
                        <p className="text-xs text-gray-500 mt-1">{migration.progress}% complete</p>
                      </div>
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            migration.status === 'completed' ? 'bg-green-600' :
                            migration.status === 'failed' ? 'bg-red-600' : 'bg-blue-600'
                          }`}
                          style={{ width: `${migration.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {recentMigrations.length === 0 && (
                <div className="text-center py-12">
                  <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-sm font-medium text-gray-900 mb-2">No migrations yet</h3>
                  <p className="text-sm text-gray-500 mb-4">Get started by creating your first migration</p>
                  <Link 
                    href="/migrations/new"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
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
