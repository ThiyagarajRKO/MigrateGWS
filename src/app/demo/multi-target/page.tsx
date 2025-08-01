'use client';

import { useState } from 'react';
import { MultiTargetDomainSelector } from '@/components/MultiTargetDomainSelector';
import { TargetDomainConfig } from '@/types/migration-scenarios';

// Demo data for testing
const demoDomainsData = [
  { domainName: 'company.com', isPrimary: true, verified: true },
  { domainName: 'subsidiary1.com', isPrimary: false, verified: true },
  { domainName: 'subsidiary2.com', isPrimary: false, verified: true },
  { domainName: 'newdomain.com', isPrimary: false, verified: true },
  { domainName: 'testdomain.com', isPrimary: false, verified: false }
];

export default function MultiTargetDemoPage() {
  const [selectedTargets, setSelectedTargets] = useState<TargetDomainConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTargetsChange = (targets: TargetDomainConfig[]) => {
    console.log('Target domains updated:', targets);
    setSelectedTargets(targets);
  };

  const simulateError = () => {
    setError(loading ? null : 'Failed to load domains from Google Workspace API');
    setLoading(false);
  };

  const simulateLoading = () => {
    setLoading(!loading);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Multi-Target Domain Selector Demo
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            This component allows users to configure multiple target domains for complex 
            Google Workspace migrations with advanced conflict resolution and options.
          </p>
        </div>

        {/* Demo Controls */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Demo Controls</h3>
          <div className="flex gap-4">
            <button
              onClick={simulateLoading}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                loading
                  ? 'bg-red-100 text-red-700 border border-red-200'
                  : 'bg-blue-100 text-blue-700 border border-blue-200'
              }`}
            >
              {loading ? 'Stop Loading' : 'Simulate Loading'}
            </button>
            <button
              onClick={simulateError}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                error
                  ? 'bg-red-100 text-red-700 border border-red-200'
                  : 'bg-yellow-100 text-yellow-700 border border-yellow-200'
              }`}
            >
              {error ? 'Clear Error' : 'Simulate Error'}
            </button>
          </div>
        </div>

        {/* Component Demo */}
        <MultiTargetDomainSelector
          availableDomains={demoDomainsData}
          selectedTargets={selectedTargets}
          onTargetsChange={handleTargetsChange}
          loading={loading}
          error={error}
          minTargets={1}
          maxTargets={5}
        />

        {/* Configuration Output */}
        {selectedTargets.length > 0 && (
          <div className="mt-8 bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Generated Configuration
            </h3>
            <pre className="bg-gray-50 rounded-lg p-4 text-sm overflow-x-auto">
              {JSON.stringify(selectedTargets, null, 2)}
            </pre>
          </div>
        )}

        {/* Features List */}
        <div className="mt-8 bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Component Features</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Configuration Options</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Multiple target domain selection</li>
                <li>• Conflict resolution strategies</li>
                <li>• Migration options (groups, email forwarding)</li>
                <li>• Domain validation and duplicate detection</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">User Experience</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Intuitive step-by-step configuration</li>
                <li>• Real-time validation and feedback</li>
                <li>• Loading states and error handling</li>
                <li>• Progress tracking and status indicators</li>
                <li>• Responsive design for all devices</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Usage Example */}
        <div className="mt-8 bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Usage Example</h3>
          <pre className="bg-gray-50 rounded-lg p-4 text-sm overflow-x-auto">
{`import { MultiTargetDomainSelector } from '@/components/MultiTargetDomainSelector';
import { TargetDomainConfig } from '@/types/migration-scenarios';

function MyMigrationForm() {
  const [targets, setTargets] = useState<TargetDomainConfig[]>([]);
  
  return (
    <MultiTargetDomainSelector
      availableDomains={domains}
      selectedTargets={targets}
      onTargetsChange={setTargets}
      loading={false}
      error={null}
      minTargets={1}
      maxTargets={5}
    />
  );
}`}
          </pre>
        </div>
      </div>
    </div>
  );
}
