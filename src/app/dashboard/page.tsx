'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useGetDomains, useGetUsers, useValidateAccess } from '@/hooks/useGoogleWorkspaceAPI';
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
  Shield
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
  const { data: domainsData, getDomains } = useGetDomains();
  const { data: usersData, getUsers } = useGetUsers();
  const { data: validationData, validateAccess } = useValidateAccess();
  
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
      source: 'marketing@oldcompany.com',
      target: 'marketing@newcompany.com',
      status: 'running',
      progress: 75,
      createdAt: '2025-07-31T08:00:00Z'
    },
    {
      id: '2',
      name: 'Sales Department',
      source: 'sales@oldcompany.com',
      target: 'sales@newcompany.com',
      status: 'completed',
      progress: 100,
      createdAt: '2025-07-30T14:30:00Z'
    },
    {
      id: '3',
      name: 'IT Infrastructure',
      source: 'it@oldcompany.com',
      target: 'it@newcompany.com',
      status: 'failed',
      progress: 45,
      createdAt: '2025-07-29T09:15:00Z'
    }
  ]);

  // Load Google Workspace data
  useEffect(() => {
    if (user?.provider === 'google') {
      validateAccess();
      getDomains();
      getUsers();
    }
  }, [user, validateAccess, getDomains, getUsers]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Clock className="h-5 w-5 text-blue-500" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
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
                <Database className="h-8 w-8 text-blue-600 mr-3" />
                <Link href="/">
                  <h1 className="text-2xl font-bold text-gray-900">GWS Migration Platform</h1>
                </Link>
              </div>
              <div className="flex items-center space-x-4">
                <nav className="flex space-x-8">
                  <Link href="/dashboard" className="text-blue-600 font-semibold">Dashboard</Link>
                  <Link href="/migrations" className="text-gray-600 hover:text-blue-600">Migrations</Link>
                  <Link href="/setup" className="text-gray-600 hover:text-blue-600">Setup</Link>
                  <Link href="/settings" className="text-gray-600 hover:text-blue-600">Settings</Link>
                </nav>
                
                {/* User Menu */}
                <div className="flex items-center space-x-4 border-l border-gray-200 pl-4">
                  <div className="flex items-center space-x-2">
                    {user?.avatar ? (
                      <img 
                        src={user.avatar} 
                        alt={user.name}
                        className="h-8 w-8 rounded-full"
                      />
                    ) : (
                      <div className="h-8 w-8 bg-blue-600 rounded-full flex items-center justify-center">
                        <User className="h-4 w-4 text-white" />
                      </div>
                    )}
                    <span className="text-sm font-medium text-gray-700">{user?.name || user?.email}</span>
                    {user?.provider === 'google' && (
                      <div title="Google Workspace Authenticated">
                        <Shield className="h-4 w-4 text-green-600" />
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => signOut()}
                    className="text-gray-600 hover:text-red-600 flex items-center"
                    title="Sign Out"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Page Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-600 mt-1">Monitor your Google Workspace migrations</p>
              {user?.provider === 'google' && validationData?.valid && (
                <p className="text-green-600 text-sm mt-1 flex items-center">
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Google Workspace API access verified
                </p>
              )}
            </div>
            <Link 
              href="/migrations/new"
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-semibold flex items-center"
            >
              <Plus className="h-5 w-5 mr-2" />
              New Migration
            </Link>
          </div>


          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-blue-100">
                  <BarChart3 className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Migrations</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-blue-100">
                  <Clock className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Active</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-green-100">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Completed</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.completed}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-red-100">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Failed</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.failed}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Google Workspace Info */}
          {user?.provider === 'google' && (
            <div className="space-y-6 mb-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Google Workspace Domains</h3>
                  {domainsData?.domains ? (
                    <div className="space-y-2">
                      {domainsData.domains.map((domain: any, index: number) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <span className="font-medium">{domain.domainName}</span>
                          <div className="flex items-center space-x-2">
                            {domain.isPrimary && (
                              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Primary</span>
                            )}
                            {domain.verified && (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">Loading domain information...</p>
                  )}
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">User Count</h3>
                  {usersData?.count !== undefined ? (
                    <div className="flex items-center">
                      <Users className="h-8 w-8 text-blue-600 mr-3" />
                      <div>
                        <p className="text-2xl font-bold text-gray-900">{usersData.count}</p>
                        <p className="text-sm text-gray-500">Google Workspace users</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500">Loading user information...</p>
                  )}
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
                        <h4 className="font-medium text-gray-900">{migration.name}</h4>
                        <p className="text-sm text-gray-500">
                          {migration.source} → {migration.target}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(migration.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(migration.status)}`}>
                        {migration.status}
                      </span>
                      {migration.status === 'running' && (
                        <div className="flex items-center space-x-2">
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full" 
                              style={{ width: `${migration.progress}%` }}
                            ></div>
                          </div>
                          <span className="text-xs text-gray-500">{migration.progress}%</span>
                        </div>
                      )}
                      <Link 
                        href={`/migrations/${migration.id}`}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        View Details
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
