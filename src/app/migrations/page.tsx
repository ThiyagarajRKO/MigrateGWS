'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  Database, 
  Plus, 
  Search, 
  Filter,
  CheckCircle,
  Clock,
  AlertTriangle,
  Users,
  Calendar,
  MoreHorizontal
} from 'lucide-react';

interface Migration {
  id: string;
  name: string;
  sourceOrg: string;
  targetOrg: string;
  userCount: number;
  services: string[];
  status: 'running' | 'completed' | 'failed' | 'pending' | 'paused';
  progress: number;
  createdAt: string;
  lastUpdated: string;
  createdBy: string;
}

export default function MigrationsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [migrations] = useState<Migration[]>([
    {
      id: '1',
      name: 'Marketing Team Migration',
      sourceOrg: 'old-company.com',
      targetOrg: 'new-company.com',
      userCount: 25,
      services: ['Gmail', 'Drive', 'Calendar'],
      status: 'running',
      progress: 75,
      createdAt: '2025-07-31T08:00:00Z',
      lastUpdated: '2025-07-31T10:30:00Z',
      createdBy: 'admin@company.com'
    },
    {
      id: '2',
      name: 'Sales Department Complete Migration',
      sourceOrg: 'old-sales.com',
      targetOrg: 'unified-company.com',
      userCount: 45,
      services: ['Gmail', 'Drive', 'Calendar', 'Contacts'],
      status: 'completed',
      progress: 100,
      createdAt: '2025-07-30T14:30:00Z',
      lastUpdated: '2025-07-31T09:15:00Z',
      createdBy: 'sales-admin@company.com'
    },
    {
      id: '3',
      name: 'HR Department Migration',
      sourceOrg: 'hr-legacy.com',
      targetOrg: 'new-company.com',
      userCount: 12,
      services: ['Gmail', 'Drive'],
      status: 'failed',
      progress: 25,
      createdAt: '2025-07-30T09:15:00Z',
      lastUpdated: '2025-07-30T11:45:00Z',
      createdBy: 'hr-admin@company.com'
    },
    {
      id: '4',
      name: 'Engineering Team Phase 1',
      sourceOrg: 'dev-company.com',
      targetOrg: 'tech-company.com',
      userCount: 120,
      services: ['Gmail', 'Drive', 'Calendar', 'Chat'],
      status: 'pending',
      progress: 0,
      createdAt: '2025-07-31T15:00:00Z',
      lastUpdated: '2025-07-31T15:00:00Z',
      createdBy: 'dev-admin@company.com'
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
      case 'pending':
        return <Clock className="h-5 w-5 text-gray-500" />;
      case 'paused':
        return <Clock className="h-5 w-5 text-yellow-500" />;
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
      case 'pending':
        return 'bg-gray-100 text-gray-800';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredMigrations = migrations.filter(migration => {
    const matchesSearch = migration.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         migration.sourceOrg.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         migration.targetOrg.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || migration.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Database className="h-8 w-8 text-blue-600 mr-3" />
              <Link href="/">
                <h1 className="text-2xl font-bold text-gray-900">MigrateGWS</h1>
              </Link>
            </div>
            <nav className="flex space-x-8">
              <Link href="/dashboard" className="text-gray-600 hover:text-blue-600">Dashboard</Link>
              <Link href="/migrations" className="text-blue-600 font-semibold">Migrations</Link>
              <Link href="/user-mapping" className="text-gray-600 hover:text-blue-600">User Mapping</Link>
              <Link href="/settings" className="text-gray-600 hover:text-blue-600">Settings</Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Migrations</h1>
            <p className="text-gray-600 mt-1">Manage your Google Workspace migrations</p>
          </div>
          <div className="flex items-center gap-3">
            <Link 
              href="/user-mapping"
              className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 font-semibold flex items-center"
            >
              <Users className="h-5 w-5 mr-2" />
              User Mapping
            </Link>
            <Link 
              href="/migrations/new"
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-semibold flex items-center"
            >
              <Plus className="h-5 w-5 mr-2" />
              New Migration
            </Link>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search migrations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Filter className="h-5 w-5 text-gray-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Status</option>
                  <option value="running">Running</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                  <option value="pending">Pending</option>
                  <option value="paused">Paused</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Migrations List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Migration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Source → Target
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Users & Services
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Progress
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Updated
                  </th>
                  <th className="relative px-6 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredMigrations.map((migration) => (
                  <tr key={migration.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{migration.name}</div>
                        <div className="text-sm text-gray-500">Created by {migration.createdBy}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        <div>{migration.sourceOrg}</div>
                        <div className="text-gray-500">↓</div>
                        <div>{migration.targetOrg}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900">
                        <Users className="h-4 w-4 mr-1" />
                        {migration.userCount}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {migration.services.map((service) => (
                          <span
                            key={service}
                            className="inline-flex px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded"
                          >
                            {service}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(migration.status)}
                        <span className={`ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(migration.status)}`}>
                          {migration.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${migration.progress}%` }}
                          ></div>
                        </div>
                        <span className="text-sm text-gray-900">{migration.progress}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(migration.lastUpdated).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <Link 
                          href={`/migrations/${migration.id}`}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          View
                        </Link>
                        <button className="text-gray-400 hover:text-gray-600">
                          <MoreHorizontal className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {filteredMigrations.length === 0 && (
          <div className="text-center py-12">
            <Database className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No migrations found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your search or filter criteria.' 
                : 'Get started by creating your first migration.'
              }
            </p>
            {!searchTerm && statusFilter === 'all' && (
              <div className="mt-6">
                <Link 
                  href="/migrations/new"
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium inline-flex items-center"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Migration
                </Link>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
