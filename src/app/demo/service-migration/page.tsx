'use client';

import { useState } from 'react';
import { ArrowLeft, Settings } from 'lucide-react';
import UserMappingWithCreation from '../../../components/UserMappingWithCreation';

// Mock data for demonstration
const mockSourceUsers = [
  {
    id: '1',
    primaryEmail: 'john.doe@source.com',
    name: { fullName: 'John Doe', givenName: 'John', familyName: 'Doe' },
    isAdmin: true,
    suspended: false,
    creationTime: '2023-01-15T10:00:00Z',
    orgUnitPath: '/',
    customerId: 'customer1',
    sourceDomain: 'source.com'
  },
  {
    id: '2', 
    primaryEmail: 'jane.smith@source.com',
    name: { fullName: 'Jane Smith', givenName: 'Jane', familyName: 'Smith' },
    isAdmin: false,
    suspended: false,
    creationTime: '2023-02-20T14:30:00Z',
    orgUnitPath: '/Sales',
    customerId: 'customer1',
    sourceDomain: 'source.com'
  },
  {
    id: '3',
    primaryEmail: 'bob.wilson@source.com', 
    name: { fullName: 'Bob Wilson', givenName: 'Bob', familyName: 'Wilson' },
    isAdmin: false,
    suspended: false,
    creationTime: '2023-03-10T09:15:00Z',
    orgUnitPath: '/Engineering',
    customerId: 'customer1',
    sourceDomain: 'source.com'
  },
  {
    id: '4',
    primaryEmail: 'alice.brown@source.com',
    name: { fullName: 'Alice Brown', givenName: 'Alice', familyName: 'Brown' },
    isAdmin: false,
    suspended: false,
    creationTime: '2023-04-05T16:45:00Z',
    orgUnitPath: '/Marketing',
    customerId: 'customer1',
    sourceDomain: 'source.com'
  }
];

const scenarios = [
  {
    id: 'one-to-one',
    name: 'One-to-One Migration',
    description: 'Single source domain to single target domain',
    targetDomains: ['target.com'],
    mappingType: 'one-to-one' as const
  },
  {
    id: 'one-to-many',
    name: 'Clone Users Across Domains',
    description: 'Clone each user to multiple target domains',
    targetDomains: ['target1.com', 'target2.com', 'target3.com'],
    mappingType: 'one-to-many' as const
  },
  {
    id: 'many-to-one',
    name: 'Merge to Single Domain',
    description: 'Merge users from multiple sources to one target',
    targetDomains: ['merged.com'],
    mappingType: 'many-to-one' as const
  }
];

export default function ServiceMigrationDemoPage() {
  const [selectedScenario, setSelectedScenario] = useState(scenarios[0]);
  const [migrationResults, setMigrationResults] = useState<any>(null);

  const mockTargetAdminEmails = {
    'target.com': 'admin@target.com',
    'target1.com': 'admin@target1.com', 
    'target2.com': 'admin@target2.com',
    'target3.com': 'admin@target3.com',
    'merged.com': 'admin@merged.com'
  };

  const handleServiceMigrationReady = (selections: any[]) => {
    console.log('Service migration selections:', selections);
    setMigrationResults(selections);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => window.history.back()}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-5 w-5" />
                <span>Back</span>
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Service Migration Demo</h1>
                <p className="mt-1 text-sm text-gray-500">
                  Demo of user mapping with service migration selection
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Settings className="h-5 w-5 text-gray-600" />
              <span className="text-sm text-gray-600">Configuration</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Scenario Selection */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Migration Scenario</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {scenarios.map(scenario => (
              <button
                key={scenario.id}
                onClick={() => setSelectedScenario(scenario)}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  selectedScenario.id === scenario.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <h3 className={`font-medium mb-2 ${
                  selectedScenario.id === scenario.id ? 'text-blue-900' : 'text-gray-900'
                }`}>
                  {scenario.name}
                </h3>
                <p className={`text-sm ${
                  selectedScenario.id === scenario.id ? 'text-blue-700' : 'text-gray-600'
                }`}>
                  {scenario.description}
                </p>
                <div className="mt-2 text-xs text-gray-500">
                  Target domains: {scenario.targetDomains.join(', ')}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Current Configuration */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
          <h3 className="font-medium text-blue-900 mb-2">Current Configuration</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="font-medium text-blue-900">Source Users:</span>
              <span className="text-blue-800 ml-2">{mockSourceUsers.length}</span>
            </div>
            <div>
              <span className="font-medium text-blue-900">Target Domains:</span>
              <span className="text-blue-800 ml-2">{selectedScenario.targetDomains.length}</span>
            </div>
            <div>
              <span className="font-medium text-blue-900">Mapping Type:</span>
              <span className="text-blue-800 ml-2">{selectedScenario.mappingType.replace('-', ' to ')}</span>
            </div>
            <div>
              <span className="font-medium text-blue-900">Service Selection:</span>
              <span className="text-blue-800 ml-2">Enabled</span>
            </div>
          </div>
        </div>

        {/* User Mapping with Service Selection */}
        <UserMappingWithCreation
          sourceUsers={mockSourceUsers}
          targetDomains={selectedScenario.targetDomains}
          targetAdminEmails={mockTargetAdminEmails}
          mappingType={selectedScenario.mappingType}
          enableServiceSelection={true}
          autoStartCreation={false}
          onServiceMigrationReady={handleServiceMigrationReady}
          onMappingComplete={(mappings) => {
            console.log('User mappings completed:', mappings);
          }}
          onCreationComplete={(results) => {
            console.log('User creation completed:', results);
          }}
        />

        {/* Migration Results */}
        {migrationResults && (
          <div className="mt-8 bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Migration Ready</h2>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <h3 className="font-medium text-green-900 mb-2">Selected for Migration</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-2xl font-bold text-green-600">{migrationResults.length}</div>
                  <div className="text-green-700">Source Users</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-600">
                    {migrationResults.reduce((sum: number, r: any) => sum + r.targetMappings.length, 0)}
                  </div>
                  <div className="text-blue-700">Target Users</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-600">
                    {migrationResults.reduce((sum: number, r: any) => sum + r.selectedServices.length, 0)}
                  </div>
                  <div className="text-purple-700">Total Services</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-orange-600">
                    {migrationResults.reduce((sum: number, r: any) => sum + (r.selectedServices.length * r.targetMappings.length), 0)}
                  </div>
                  <div className="text-orange-700">Migration Jobs</div>
                </div>
              </div>
            </div>

            {/* Detailed Results */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Migration Details</h4>
              {migrationResults.map((result: any, index: number) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h5 className="font-medium text-gray-900">{result.sourceUser.name.fullName}</h5>
                      <p className="text-sm text-gray-600">{result.sourceUser.primaryEmail}</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      result.migrationPriority === 'high' ? 'bg-red-100 text-red-800' :
                      result.migrationPriority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {result.migrationPriority} priority
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Target Users:</span>
                      <ul className="mt-1 space-y-1">
                        {result.targetMappings.map((mapping: any, idx: number) => (
                          <li key={idx} className="text-gray-600">
                            {mapping.targetEmail}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Services:</span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {result.selectedServices.map((service: string) => (
                          <span key={service} className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                            {service}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <button className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium">
                Start Migration Process
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
