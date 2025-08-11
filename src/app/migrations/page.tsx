'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { 
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell
} from '@/components/ui/table';
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
        return <Clock className="h-5 w-5 text-info-500" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-success-500" />;
      case 'failed':
        return <AlertTriangle className="h-5 w-5 text-danger-500" />;
      case 'pending':
        return <Clock className="h-5 w-5 text-secondary-500" />;
      case 'paused':
        return <Clock className="h-5 w-5 text-warning-500" />;
      default:
        return <Clock className="h-5 w-5 text-secondary-500" />;
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
      case 'pending':
        return 'secondary';
      case 'paused':
        return 'warning';
      default:
        return 'secondary';
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
    <div className="min-h-screen bg-secondary-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-secondary-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Database className="h-7 w-7 text-primary-600 mr-3" />
              <Link href="/">
                <h1 className="text-lg font-bold text-secondary-900">MigrateGWS</h1>
              </Link>
            </div>
            <nav className="flex space-x-6">
              <Link href="/dashboard" className="text-sm text-secondary-600 hover:text-primary-600">Dashboard</Link>
              <Link href="/migrations" className="text-sm text-primary-600 font-semibold">Migrations</Link>
              <Link href="/user-mapping" className="text-sm text-secondary-600 hover:text-primary-600">User Mapping</Link>
              <Link href="/settings" className="text-sm text-secondary-600 hover:text-primary-600">Settings</Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Page Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-secondary-900">Migrations</h1>
            <p className="text-xs text-secondary-600 mt-1">Manage your Google Workspace migrations</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/user-mapping">
              <Button variant="success" size="sm">
                <Users className="h-4 w-4 mr-2" />
                User Mapping
              </Button>
            </Link>
            <Link href="/migrations/new">
              <Button variant="primary" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                New Migration
              </Button>
            </Link>
          </div>
        </div>

        {/* Filters and Search */}
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <Search className="h-4 w-4 text-secondary-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                  <Input
                    type="text"
                    placeholder="Search migrations..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 w-48 text-sm"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Filter className="h-4 w-4 text-secondary-400" />
                  <Select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="text-sm"
                  >
                    <option value="all">All Status</option>
                    <option value="running">Running</option>
                    <option value="completed">Completed</option>
                    <option value="failed">Failed</option>
                    <option value="pending">Pending</option>
                    <option value="paused">Paused</option>
                  </Select>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Migrations List */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <thead className="bg-secondary-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                    Migration
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                    Source → Target
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                    Users & Services
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                    Progress
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                    Last Updated
                  </th>
                  <th className="relative px-4 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-secondary-200">
                {filteredMigrations.map((migration) => (
                  <tr key={migration.id} className="hover:bg-secondary-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-secondary-900">{migration.name}</div>
                        <div className="text-xs text-secondary-500">Created by {migration.createdBy}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm text-secondary-900">
                        <div>{migration.sourceOrg}</div>
                        <div className="text-secondary-500">↓</div>
                        <div>{migration.targetOrg}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center text-sm text-secondary-900">
                        <Users className="h-4 w-4 mr-1" />
                        {migration.userCount}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {migration.services.map((service) => (
                          <Badge
                            key={service}
                            variant="primary"
                            className="text-xs"
                          >
                            {service}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(migration.status)}
                        <Badge
                          variant={getStatusBadge(migration.status) as any}
                          className="ml-2"
                        >
                          {migration.status}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center">
                        <Progress value={migration.progress} className="w-16 mr-2" />
                        <span className="text-xs text-secondary-900">{migration.progress}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-secondary-500">
                      {new Date(migration.lastUpdated).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <Link href={`/migrations/${migration.id}`}>
                          <Button variant="outline" size="sm">
                            View
                          </Button>
                        </Link>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>

        {filteredMigrations.length === 0 && (
          <Card>
            <CardContent className="text-center py-8">
              <Database className="mx-auto h-10 w-10 text-secondary-400" />
              <h3 className="mt-2 text-sm font-medium text-secondary-900">No migrations found</h3>
              <p className="mt-1 text-xs text-secondary-500">
                {searchTerm || statusFilter !== 'all' 
                  ? 'Try adjusting your search or filter criteria.' 
                  : 'Get started by creating your first migration.'
                }
              </p>
              {!searchTerm && statusFilter === 'all' && (
                <div className="mt-4">
                  <Link href="/migrations/new">
                    <Button variant="primary" size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      New Migration
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
