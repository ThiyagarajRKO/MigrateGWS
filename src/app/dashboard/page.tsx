'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  BarChart3, 
  Users, 
  Database, 
  Calendar, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Plus
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
      name: 'HR Team Migration',
      source: 'hr@oldcompany.com',
      target: 'people@newcompany.com',
      status: 'failed',
      progress: 25,
      createdAt: '2025-07-30T09:15:00Z'
    }
  ]);

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
            <nav className="flex space-x-8">
              <Link href="/dashboard" className="text-blue-600 font-semibold">Dashboard</Link>
              <Link href="/migrations" className="text-gray-600 hover:text-blue-600">Migrations</Link>
              <Link href="/settings" className="text-gray-600 hover:text-blue-600">Settings</Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-1">Monitor your Google Workspace migrations</p>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <BarChart3 className="h-12 w-12 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Migrations</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <Clock className="h-12 w-12 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active</p>
                <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <CheckCircle className="h-12 w-12 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-gray-900">{stats.completed}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <AlertTriangle className="h-12 w-12 text-red-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Failed</p>
                <p className="text-2xl font-bold text-gray-900">{stats.failed}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Migrations */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Recent Migrations</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {recentMigrations.map((migration) => (
              <div key={migration.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    {getStatusIcon(migration.status)}
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">{migration.name}</h3>
                      <p className="text-sm text-gray-500">
                        {migration.source} → {migration.target}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(migration.status)}`}>
                        {migration.status}
                      </span>
                      {migration.status === 'running' && (
                        <div className="mt-1">
                          <div className="flex items-center">
                            <div className="w-24 bg-gray-200 rounded-full h-2 mr-2">
                              <div 
                                className="bg-blue-600 h-2 rounded-full" 
                                style={{ width: `${migration.progress}%` }}
                              ></div>
                            </div>
                            <span className="text-xs text-gray-500">{migration.progress}%</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <Link 
                      href={`/migrations/${migration.id}`}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
