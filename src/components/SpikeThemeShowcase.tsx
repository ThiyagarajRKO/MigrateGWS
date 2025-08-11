/**
 * Spike Theme Showcase Component
 * Demonstrates all UI components with the Spike Bootstrap Admin Dashboard theme
 */

'use client';

import React, { useState } from 'react';
import { 
  Button
} from './ui/button';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent 
} from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Select } from './ui/select';
import { 
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell
} from './ui/table';
import { Progress } from './ui/progress';
import { Alert } from './ui/alert';
import { 
  User, 
  Mail, 
  Calendar, 
  Settings, 
  CheckCircle, 
  AlertTriangle, 
  Info,
  Download,
  Upload,
  Search,
  Filter
} from 'lucide-react';

export default function SpikeThemeShowcase() {
  const [inputValue, setInputValue] = useState('');
  const [selectValue, setSelectValue] = useState('');

  return (
    <div className="min-h-screen bg-secondary-50 p-8">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-secondary-900 mb-4">
            Spike Theme Showcase
          </h1>
          <p className="text-lg text-secondary-600 max-w-2xl mx-auto">
            Explore all the UI components styled with the Spike Bootstrap Admin Dashboard theme.
            This comprehensive showcase demonstrates the design system in action.
          </p>
        </div>

        {/* Buttons Section */}
        <Card>
          <CardHeader>
            <CardTitle>Buttons</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-secondary-900 mb-4">Button Variants</h3>
              <div className="flex flex-wrap gap-4">
                <Button variant="primary">Primary Button</Button>
                <Button variant="secondary">Secondary Button</Button>
                <Button variant="outline">Outline Button</Button>
                <Button variant="ghost">Ghost Button</Button>
                <Button variant="link">Link Button</Button>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-secondary-900 mb-4">Status Buttons</h3>
              <div className="flex flex-wrap gap-4">
                <Button variant="success">Success Button</Button>
                <Button variant="warning">Warning Button</Button>
                <Button variant="danger">Danger Button</Button>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-secondary-900 mb-4">Button Sizes</h3>
              <div className="flex flex-wrap items-center gap-4">
                <Button size="sm">Small</Button>
                <Button size="md">Medium</Button>
                <Button size="lg">Large</Button>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-secondary-900 mb-4">Button States</h3>
              <div className="flex flex-wrap gap-4">
                <Button loading>Loading Button</Button>
                <Button disabled>Disabled Button</Button>
                <Button>
                  <Download className="h-4 w-4 mr-2" />
                  With Icon
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cards Section */}
        <Card>
          <CardHeader>
            <CardTitle>Cards</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center mb-2">
                    <User className="h-5 w-5 text-primary-600" />
                  </div>
                  <CardTitle>User Management</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-secondary-600">
                    Manage users across your organization with advanced controls and permissions.
                  </p>
                  <Button variant="outline" size="sm" className="mt-4">
                    Learn More
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="w-10 h-10 bg-success-100 rounded-lg flex items-center justify-center mb-2">
                    <Mail className="h-5 w-5 text-success-600" />
                  </div>
                  <CardTitle>Email Migration</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-secondary-600">
                    Seamlessly migrate email data between Google Workspace domains.
                  </p>
                  <Button variant="success" size="sm" className="mt-4">
                    Start Migration
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="w-10 h-10 bg-warning-100 rounded-lg flex items-center justify-center mb-2">
                    <Settings className="h-5 w-5 text-warning-600" />
                  </div>
                  <CardTitle>Configuration</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-secondary-600">
                    Configure migration settings and customize the process for your needs.
                  </p>
                  <Button variant="warning" size="sm" className="mt-4">
                    Configure
                  </Button>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>

        {/* Badges Section */}
        <Card>
          <CardHeader>
            <CardTitle>Badges</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-secondary-900 mb-4">Status Badges</h3>
                <div className="flex flex-wrap gap-4">
                  <Badge variant="primary">Primary</Badge>
                  <Badge variant="success">Success</Badge>
                  <Badge variant="warning">Warning</Badge>
                  <Badge variant="danger">Danger</Badge>
                  <Badge variant="info">Info</Badge>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-secondary-900 mb-4">Migration Statuses</h3>
                <div className="flex flex-wrap gap-4">
                  <Badge variant="success">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Completed
                  </Badge>
                  <Badge variant="warning">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    In Progress
                  </Badge>
                  <Badge variant="danger">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Failed
                  </Badge>
                  <Badge variant="info">
                    <Info className="h-3 w-3 mr-1" />
                    Pending
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Form Elements Section */}
        <Card>
          <CardHeader>
            <CardTitle>Form Elements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <Input
                  label="Email Address"
                  placeholder="Enter your email"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  helper="We'll never share your email with anyone else."
                />
              </div>
              
              <div>
                <Input
                  label="Password"
                  type="password"
                  placeholder="Enter your password"
                  error="Password must be at least 8 characters long"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <Select
                  label="Migration Type"
                  value={selectValue}
                  onChange={(e) => setSelectValue(e.target.value)}
                  options={[
                    { value: '', label: 'Select migration type...' },
                    { value: 'full', label: 'Full Migration' },
                    { value: 'partial', label: 'Partial Migration' },
                    { value: 'email-only', label: 'Email Only' },
                    { value: 'drive-only', label: 'Drive Only' }
                  ]}
                />
              </div>
              
              <div>
                <Select
                  label="Priority Level"
                  options={[
                    { value: '', label: 'Select priority...' },
                    { value: 'low', label: 'Low Priority' },
                    { value: 'medium', label: 'Medium Priority' },
                    { value: 'high', label: 'High Priority' },
                    { value: 'urgent', label: 'Urgent' }
                  ]}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Progress Section */}
        <Card>
          <CardHeader>
            <CardTitle>Progress Indicators</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-secondary-900 mb-4">Progress Bars</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium text-secondary-700">Email Migration</span>
                    <span className="text-sm text-secondary-500">75%</span>
                  </div>
                  <Progress value={75} variant="default" />
                </div>
                
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium text-secondary-700">Drive Migration</span>
                    <span className="text-sm text-secondary-500">100%</span>
                  </div>
                  <Progress value={100} variant="success" />
                </div>
                
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium text-secondary-700">Calendar Migration</span>
                    <span className="text-sm text-secondary-500">45%</span>
                  </div>
                  <Progress value={45} variant="warning" />
                </div>
                
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium text-secondary-700">Failed Migration</span>
                    <span className="text-sm text-secondary-500">25%</span>
                  </div>
                  <Progress value={25} variant="danger" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="text-center">
          <div className="flex justify-center gap-4">
            <Button size="lg">
              <Upload className="h-4 w-4 mr-2" />
              Start New Migration
            </Button>
            <Button variant="outline" size="lg">
              <Search className="h-4 w-4 mr-2" />
              Browse Migrations
            </Button>
            <Button variant="secondary" size="lg">
              <Filter className="h-4 w-4 mr-2" />
              View Reports
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
