'use client';

import { useState } from 'react';
import UserMappingWithCreation from '../../../components/UserMappingWithCreation';
import { Users, Copy, Merge, ArrowRight, UserPlus } from 'lucide-react';

// Sample users for demonstration
const sampleUsers = [
  {
    id: '1',
    primaryEmail: 'john.doe@company-a.com',
    name: { fullName: 'John Doe', givenName: 'John', familyName: 'Doe' },
    isAdmin: true,
    suspended: false,
    lastLoginTime: '2024-01-15T10:30:00Z',
    creationTime: '2023-01-01T00:00:00Z',
    orgUnitPath: '/Marketing',
    customerId: 'C123456',
    sourceDomain: 'company-a.com'
  },
  {
    id: '2',
    primaryEmail: 'john.doe@company-b.com',
    name: { fullName: 'John Doe', givenName: 'John', familyName: 'Doe' },
    isAdmin: false,
    suspended: false,
    lastLoginTime: '2024-01-10T09:15:00Z',
    creationTime: '2023-02-01T00:00:00Z',
    orgUnitPath: '/Sales',
    customerId: 'C789012',
    sourceDomain: 'company-b.com'
  },
  {
    id: '3',
    primaryEmail: 'jane.smith@company-a.com',
    name: { fullName: 'Jane Smith', givenName: 'Jane', familyName: 'Smith' },
    isAdmin: false,
    suspended: false,
    lastLoginTime: '2024-01-12T14:20:00Z',
    creationTime: '2023-01-15T00:00:00Z',
    orgUnitPath: '/Engineering',
    customerId: 'C123456',
    sourceDomain: 'company-a.com'
  },
  {
    id: '4',
    primaryEmail: 'mike.wilson@company-c.com',
    name: { fullName: 'Mike Wilson', givenName: 'Mike', familyName: 'Wilson' },
    isAdmin: true,
    suspended: false,
    lastLoginTime: '2024-01-14T16:45:00Z',
    creationTime: '2023-03-01T00:00:00Z',
    orgUnitPath: '/IT',
    customerId: 'C345678',
    sourceDomain: 'company-c.com'
  }
];

const targetDomains = ['newcorp.com', 'newcorp-eu.com', 'newcorp-asia.com'];
const targetAdminEmails: Record<string, string> = {
  'newcorp.com': 'admin@newcorp.com',
  'newcorp-eu.com': 'admin@newcorp-eu.com',
  'newcorp-asia.com': 'admin@newcorp-asia.com'
};

export default function AdvancedUserMappingDemo() {
  const [selectedStrategy, setSelectedStrategy] = useState<'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many'>('one-to-many');
  const [showDemo, setShowDemo] = useState(false);

  const strategies = [
    {
      id: 'one-to-one' as const,
      name: 'One-to-One',
      icon: <ArrowRight className="h-5 w-5" />,
      description: 'Simple direct mapping to primary target domain',
      example: 'john@source.com → john@target.com',
      color: 'blue'
    },
    {
      id: 'one-to-many' as const,
      name: 'One-to-Many (Cloning)',
      icon: <Copy className="h-5 w-5" />,
      description: 'Clone each user to ALL target domains',
      example: 'john@source.com → john.newcorp@newcorp.com, john.newcorp-eu@newcorp-eu.com',
      color: 'green'
    },
    {
      id: 'many-to-one' as const,
      name: 'Many-to-One (Merging)',
      icon: <Merge className="h-5 w-5" />,
      description: 'Merge users with same first+last name',
      example: 'john.doe@company-a.com + john.doe@company-b.com → john.doe@target.com',
      color: 'orange'
    },
    {
      id: 'many-to-many' as const,
      name: 'Many-to-Many',
      icon: <Users className="h-5 w-5" />,
      description: 'Smart distribution based on source domains',
      example: 'Users distributed based on source domain preferences',
      color: 'purple'
    }
  ];

  const getStrategyColor = (color: string) => {
    const colors = {
      blue: 'bg-blue-100 text-blue-800 border-blue-200',
      green: 'bg-green-100 text-green-800 border-green-200',
      orange: 'bg-orange-100 text-orange-800 border-orange-200',
      purple: 'bg-purple-100 text-purple-800 border-purple-200'
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Advanced User Mapping Strategies Demo
          </h1>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Explore how different mapping strategies handle multi-domain user migration scenarios
            with intelligent cloning and merging based on first name and last name.
          </p>
        </div>

        {/* Sample Data */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Sample Data</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-gray-700 mb-3">Source Users ({sampleUsers.length})</h3>
              <div className="space-y-2">
                {sampleUsers.map(user => (
                  <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">{user.name.fullName}</div>
                      <div className="text-sm text-gray-600">{user.primaryEmail}</div>
                      <div className="text-xs text-gray-500">From: {user.sourceDomain}</div>
                    </div>
                    {user.isAdmin && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        Admin
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-700 mb-3">Target Domains ({targetDomains.length})</h3>
              <div className="space-y-2">
                {targetDomains.map((domain, index) => (
                  <div key={domain} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div>
                      <div className="font-medium text-blue-900">{domain}</div>
                      <div className="text-sm text-blue-700">Admin: {targetAdminEmails[domain]}</div>
                    </div>
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Target {index + 1}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Strategy Selection */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Select Mapping Strategy</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {strategies.map(strategy => (
              <button
                key={strategy.id}
                onClick={() => setSelectedStrategy(strategy.id)}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  selectedStrategy === strategy.id
                    ? getStrategyColor(strategy.color) + ' border-current'
                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center space-x-2 mb-2">
                  {strategy.icon}
                  <h3 className="font-medium">{strategy.name}</h3>
                </div>
                <p className="text-sm mb-2">{strategy.description}</p>
                <div className="text-xs opacity-75 font-mono">
                  {strategy.example}
                </div>
              </button>
            ))}
          </div>
          
          <div className="mt-6 flex justify-center">
            <button
              onClick={() => setShowDemo(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
            >
              <UserPlus className="h-5 w-5" />
              <span>Start {strategies.find(s => s.id === selectedStrategy)?.name} Demo</span>
            </button>
          </div>
        </div>

        {/* Strategy Details */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            {strategies.find(s => s.id === selectedStrategy)?.name} Strategy Details
          </h2>
          
          <div className="space-y-4">
            {selectedStrategy === 'one-to-many' && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-medium text-green-800 mb-2">User Cloning Logic</h3>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• Each source user creates {targetDomains.length} target users (one per domain)</li>
                  <li>• Email format: "username.domain@targetdomain.com" to prevent conflicts</li>
                  <li>• All user attributes preserved (admin status, org unit, etc.)</li>
                  <li>• Total users created: {sampleUsers.length} × {targetDomains.length} = {sampleUsers.length * targetDomains.length}</li>
                </ul>
              </div>
            )}
            
            {selectedStrategy === 'many-to-one' && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <h3 className="font-medium text-orange-800 mb-2">User Merging Logic</h3>
                <ul className="text-sm text-orange-700 space-y-1">
                  <li>• Users grouped by exact first name + last name match (case-insensitive)</li>
                  <li>• John Doe from multiple domains becomes one "john.doe@target.com"</li>
                  <li>• Admin status combined (true if ANY source user is admin)</li>
                  <li>• All source emails documented for data migration reference</li>
                  <li>• Unique names: {new Set(sampleUsers.map(u => `${u.name.givenName}.${u.name.familyName}`)).size} users will be created</li>
                </ul>
              </div>
            )}
            
            {selectedStrategy === 'many-to-many' && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h3 className="font-medium text-purple-800 mb-2">Smart Distribution Logic</h3>
                <ul className="text-sm text-purple-700 space-y-1">
                  <li>• Users grouped by source domain first</li>
                  <li>• Each source domain group maps to corresponding target domain</li>
                  <li>• Load balancing across target domains when source domains exceed targets</li>
                  <li>• Preserves organizational structure and domain relationships</li>
                </ul>
              </div>
            )}
            
            {selectedStrategy === 'one-to-one' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-800 mb-2">Direct Mapping Logic</h3>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Simple 1:1 mapping to primary target domain</li>
                  <li>• Email format: "username@targetdomain.com"</li>
                  <li>• All users mapped to: {targetDomains[0]}</li>
                  <li>• Fastest and simplest migration approach</li>
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Interactive Demo */}
        {showDemo && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Live Demo: {strategies.find(s => s.id === selectedStrategy)?.name}
              </h2>
              <button
                onClick={() => setShowDemo(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Close Demo
              </button>
            </div>
            
            <UserMappingWithCreation
              sourceUsers={sampleUsers}
              targetDomains={targetDomains}
              targetAdminEmails={targetAdminEmails}
              mappingType={selectedStrategy}
              autoStartCreation={false}
              onMappingComplete={(mappings) => {
                console.log('Mapping completed:', mappings);
              }}
              onCreationComplete={(results) => {
                console.log('Creation completed:', results);
              }}
            />
          </div>
        )}

        {/* Best Practices */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Best Practices & Considerations</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-gray-800 mb-3">🎯 When to Use Each Strategy</h3>
              <ul className="text-sm text-gray-600 space-y-2">
                <li><strong>One-to-One:</strong> Simple domain consolidation</li>
                <li><strong>One-to-Many:</strong> Geographic distribution, backup users</li>
                <li><strong>Many-to-One:</strong> Company mergers, duplicate user cleanup</li>
                <li><strong>Many-to-Many:</strong> Complex organizational restructuring</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-800 mb-3">⚠️ Important Notes</h3>
              <ul className="text-sm text-gray-600 space-y-2">
                <li><strong>Name Matching:</strong> Based on exact first+last name</li>
                <li><strong>Email Conflicts:</strong> Automatically resolved with domain prefixes</li>
                <li><strong>Admin Rights:</strong> Preserved and combined intelligently</li>
                <li><strong>Data Migration:</strong> All source emails tracked for data transfer</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
