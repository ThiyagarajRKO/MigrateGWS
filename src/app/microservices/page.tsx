'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Database, 
  Settings, 
  Activity, 
  Building2, 
  BarChart3,
  ArrowRight,
  CheckCircle2
} from 'lucide-react';

// Import our new components
import MigrationArchitecture from '@/components/MigrationArchitecture';
import TenantOnboarding from '@/components/TenantOnboarding';
import JobConfiguration from '@/components/JobConfiguration';
import RealTimeMigrationDashboard from '@/components/RealTimeMigrationDashboard';

type ViewMode = 'overview' | 'onboarding' | 'configure' | 'monitor' | 'architecture';

interface NavigationItem {
  id: ViewMode;
  title: string;
  description: string;
  icon: React.ReactNode;
  badge?: string;
  status?: 'available' | 'in-progress' | 'completed';
}

export default function MicroservicesMigrationPlatform() {
  const [currentView, setCurrentView] = useState<ViewMode>('overview');

  const navigationItems: NavigationItem[] = [
    {
      id: 'overview',
      title: 'Platform Overview',
      description: 'Microservices architecture and system status',
      icon: <Database className="h-5 w-5" />,
      status: 'available'
    },
    {
      id: 'onboarding',
      title: 'Tenant Onboarding',
      description: 'OAuth setup and domain-wide delegation',
      icon: <Building2 className="h-5 w-5" />,
      badge: 'Setup Required',
      status: 'in-progress'
    },
    {
      id: 'configure',
      title: 'Job Configuration',
      description: 'User mapping and service selection',
      icon: <Settings className="h-5 w-5" />,
      status: 'available'
    },
    {
      id: 'monitor',
      title: 'Real-Time Monitoring',
      description: 'Live migration progress and logs',
      icon: <Activity className="h-5 w-5" />,
      badge: 'Live',
      status: 'available'
    },
    {
      id: 'architecture',
      title: 'System Architecture',
      description: 'Detailed system architecture and flows',
      icon: <BarChart3 className="h-5 w-5" />,
      status: 'available'
    }
  ];

  const renderCurrentView = () => {
    switch (currentView) {
      case 'overview':
        return <MigrationArchitecture />;
      case 'onboarding':
        return <TenantOnboarding />;
      case 'configure':
        return <JobConfiguration />;
      case 'monitor':
        return <RealTimeMigrationDashboard />;
      case 'architecture':
        return <MigrationArchitecture />;
      default:
        return <MigrationArchitecture />;
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-success-500" />;
      case 'in-progress':
        return <div className="h-4 w-4 rounded-full bg-warning-500 animate-pulse" />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <Database className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">GWS Migration Platform</h1>
                <p className="text-sm text-gray-600">Enterprise Microservices Architecture</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <Badge variant="success" className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-success-500 rounded-full" />
                <span>System Healthy</span>
              </Badge>
              <Badge variant="info">7 Services Active</Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Navigation Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Navigation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {navigationItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setCurrentView(item.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-all duration-200 ${
                      currentView === item.id
                        ? 'border-primary-500 bg-primary-50 shadow-sm'
                        : 'border-secondary-200 hover:border-secondary-300 hover:bg-secondary-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-2">
                        <div className={`${
                          currentView === item.id ? 'text-primary-600' : 'text-secondary-600'
                        }`}>
                          {item.icon}
                        </div>
                        <span className={`text-sm font-medium ${
                          currentView === item.id ? 'text-primary-900' : 'text-secondary-900'
                        }`}>
                          {item.title}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1">
                        {item.badge && (
                          <Badge 
                            variant={item.badge === 'Live' ? 'success' : 'warning'} 
                            className="text-xs"
                          >
                            {item.badge}
                          </Badge>
                        )}
                        {getStatusIcon(item.status)}
                      </div>
                    </div>
                    <p className={`text-xs ${
                      currentView === item.id ? 'text-primary-700' : 'text-secondary-600'
                    }`}>
                      {item.description}
                    </p>
                  </button>
                ))}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-base">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button size="sm" className="w-full justify-start">
                  <Building2 className="h-4 w-4 mr-2" />
                  Add New Tenant
                </Button>
                <Button size="sm" variant="outline" className="w-full justify-start">
                  <Settings className="h-4 w-4 mr-2" />
                  Create Migration Job
                </Button>
                <Button size="sm" variant="outline" className="w-full justify-start">
                  <Activity className="h-4 w-4 mr-2" />
                  View System Logs
                </Button>
              </CardContent>
            </Card>

            {/* System Status */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-base">System Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-secondary-700">Active Migrations</span>
                  <span className="font-medium text-info-600">6</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-secondary-700">Tasks in Queue</span>
                  <span className="font-medium text-warning-600">567</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-secondary-700">Success Rate</span>
                  <span className="font-medium text-success-600">99.8%</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-secondary-700">Avg Processing</span>
                  <span className="font-medium text-primary-600">1.4s</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3">
            {renderCurrentView()}
          </div>
        </div>
      </div>
    </div>
  );
}
