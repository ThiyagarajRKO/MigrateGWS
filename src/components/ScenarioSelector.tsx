'use client';

import { useState, useEffect, memo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Building, 
  ArrowRightLeft, 
  Shield, 
  Users, 
  CheckCircle,
  Clock,
  Info,
  ExternalLink,
  Copy,
  Settings,
  Target,
  GitBranch,
  Shuffle,
  Network
} from 'lucide-react';
import { 
  MigrationScenario, 
  getScenarioDescription, 
  getEstimatedTotalDuration, 
  SINGLE_SUPER_ADMIN_STEPS, 
  CROSS_TENANT_STEPS
} from '@/types/migration-scenarios';

interface ScenarioSelectorProps {
  selectedScenario: MigrationScenario | null;
  onScenarioSelect: (scenario: MigrationScenario) => void;
  onStartGmailMigration?: () => void;
}

export const ScenarioSelector = memo(function ScenarioSelector({ selectedScenario, onScenarioSelect, onStartGmailMigration }: ScenarioSelectorProps) {
  const router = useRouter();
  const [showSetup, setShowSetup] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [isStartingMigration, setIsStartingMigration] = useState(false);
  const [serviceAccountInfo, setServiceAccountInfo] = useState<{
    clientId: string;
    email: string;
    available: boolean;
  } | null>(null);
  const [loadingServiceAccount, setLoadingServiceAccount] = useState(false);

  const fetchServiceAccountInfo = async () => {
    setLoadingServiceAccount(true);
    try {
      const response = await fetch('/api/google-workspace?action=service-account-info');
      if (response.ok) {
        const data = await response.json();
        setServiceAccountInfo(data);
      }
    } catch (error) {
      console.error('Failed to fetch service account info:', error);
    } finally {
      setLoadingServiceAccount(false);
    }
  };

  // Fetch service account info when component mounts or scenario is selected
  useEffect(() => {
    if (selectedScenario) {
      fetchServiceAccountInfo();
    }
  }, [selectedScenario]);

  const handleStartGmailMigration = async () => {
    if (!selectedScenario) return;
    
    setIsStartingMigration(true);
    try {
      // Call the parent's migration handler if provided
      if (onStartGmailMigration) {
        await onStartGmailMigration();
      } else {
        // Navigate to migrations page using Next.js router
        router.push(`/migrations/new?service=gmail&scenario=${selectedScenario}`);
      }
    } catch (error) {
      console.error('Failed to start Gmail migration:', error);
    } finally {
      setIsStartingMigration(false);
    }
  };

  // OAuth scopes for domain-wide delegation
  const REQUIRED_SCOPES = [
    'https://www.googleapis.com/auth/admin.directory.user',
    'https://www.googleapis.com/auth/admin.directory.domain', 
    'https://www.googleapis.com/auth/admin.directory.group',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/contacts.readonly'
  ];

  const handleCopy = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(type);
      setTimeout(() => setCopiedText(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const openAdminConsole = () => {
    window.open('https://admin.google.com/ac/owl/domainwidedelegation', '_blank');
  };
  const scenarios = [
    {
      type: 'single-super-admin' as MigrationScenario,
      title: 'Single Super Admin (1:1)',
      subtitle: 'One Domain to One Domain',
      description: 'Map and migrate data between two domains under the same Google Workspace account',
      icon: Building,
      complexity: 'Low',
      steps: SINGLE_SUPER_ADMIN_STEPS.length,
      estimatedTime: getEstimatedTotalDuration(SINGLE_SUPER_ADMIN_STEPS),
      requirements: [
        'Single Google Workspace Super Admin account',
        'Two verified domains in one workspace',
        'Domain-wide delegation enabled',
        'Appropriate API scopes configured'
      ],
      benefits: [
        'Simplified authentication (single admin)',
        'Native domain management within workspace',
        'Faster migration due to same-tenant operations',
        'Easier permission management'
      ]
    },
    {
      type: 'cross-tenant' as MigrationScenario,
      title: 'Cross-Tenant Migration (1:1)',
      subtitle: 'Between Separate Google Workspace Accounts',
      description: 'Fully migrate data between two separate Google Workspace accounts/domains',
      icon: ArrowRightLeft,
      complexity: 'High',
      steps: CROSS_TENANT_STEPS.length,
      estimatedTime: getEstimatedTotalDuration(CROSS_TENANT_STEPS),
      requirements: [
        'Super Admin access to source workspace',
        'Super Admin access to destination workspace',
        'Dual OAuth authentication setup',
        'Intermediate secure storage for data transfer'
      ],
      benefits: [
        'Complete organizational separation',
        'Full data ownership transfer',
        'Independent billing and management',
        'Enhanced security isolation'
      ]
    }
  ];

  return (
    <div className="space-y-6">

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {scenarios.map((scenario) => {
          const Icon = scenario.icon;
          const isSelected = selectedScenario === scenario.type;
          
          return (
            <div
              key={scenario.type}
              onClick={() => onScenarioSelect(scenario.type)}
              className={`relative cursor-pointer rounded-lg border-2 p-6 transition-all hover:shadow-lg ${
                isSelected
                  ? 'border-blue-600 bg-blue-50 shadow-lg'
                  : 'border-gray-200 bg-white hover:border-blue-300'
              }`}
            >
              {isSelected && (
                <div className="absolute top-4 right-4">
                  <CheckCircle className="h-6 w-6 text-blue-600" />
                </div>
              )}

              <div className="flex items-start space-x-4 mb-4">
                <div className={`p-3 rounded-lg ${isSelected ? 'bg-blue-600' : 'bg-gray-100'}`}>
                  <Icon className={`h-6 w-6 ${isSelected ? 'text-white' : 'text-gray-600'}`} />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{scenario.title}</h3>
                  <p className="text-sm text-gray-500">{scenario.subtitle}</p>
                </div>
              </div>

              <p className="text-gray-700 mb-4">{scenario.description}</p>

              <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Complexity:</span>
                  <span className={`ml-2 px-2 py-1 rounded text-xs ${
                    scenario.complexity === 'Very High' 
                      ? 'bg-red-200 text-red-900'
                      : scenario.complexity === 'High' 
                      ? 'bg-red-100 text-red-800' 
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {scenario.complexity}
                  </span>
                </div>
                <div className="flex items-center">
                  <Clock className="h-4 w-4 text-gray-500 mr-1" />
                  <span className="text-gray-600">{scenario.estimatedTime}</span>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2 flex items-center">
                    <Shield className="h-4 w-4 mr-1" />
                    Requirements
                  </h4>
                  <ul className="space-y-1">
                    {scenario.requirements.map((req, index) => (
                      <li key={index} className="text-sm text-gray-600 flex items-start">
                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mt-2 mr-2 flex-shrink-0" />
                        {req}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-2 flex items-center">
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Benefits
                  </h4>
                  <ul className="space-y-1">
                    {scenario.benefits.map((benefit, index) => (
                      <li key={index} className="text-sm text-gray-600 flex items-start">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2 mr-2 flex-shrink-0" />
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>{scenario.steps} migration steps</span>
                  <span className="flex items-center">
                    <Info className="h-4 w-4 mr-1" />
                    Automated workflow
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {selectedScenario && (
        <div className="mt-6 p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Shield className="h-5 w-5 mr-2 text-blue-600" />
            Domain-wide Delegation Setup
          </h3>

          {/* Direct Link Section */}
          <div className="mb-6">
            <h4 className="font-medium text-gray-900 mb-3">Direct Link to Domain-wide Delegation:</h4>
            <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
              <code className="flex-1 text-sm text-gray-700">
                https://admin.google.com/ac/owl/domainwidedelegation
              </code>
              <button
                onClick={() => handleCopy('https://admin.google.com/ac/owl/domainwidedelegation', 'link')}
                className="flex items-center space-x-1 px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm transition-colors"
              >
                <Copy className="h-4 w-4" />
                <span>{copiedText === 'link' ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Client ID Section */}
          <div className="mb-6">
            <h4 className="font-medium text-gray-900 mb-3">Service Account Client ID</h4>
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-900">Client ID</span>
                {serviceAccountInfo?.clientId && (
                  <button
                    onClick={() => handleCopy(serviceAccountInfo.clientId, 'clientId')}
                    className="flex items-center space-x-1 px-3 py-1 bg-blue-200 hover:bg-blue-300 rounded text-sm transition-colors"
                  >
                    <Copy className="h-4 w-4" />
                    <span>{copiedText === 'clientId' ? 'Copied!' : 'Copy'}</span>
                  </button>
                )}
              </div>
              <div className="text-sm text-blue-800 bg-blue-100 p-2 rounded font-mono break-all">
                {loadingServiceAccount 
                  ? 'Loading...' 
                  : serviceAccountInfo?.clientId || 'Service account not configured'
                }
              </div>
              <p className="text-xs text-blue-700 mt-2">
                This is the Client ID from your service account JSON file that you'll enter in the Google Admin Console.
              </p>
              {serviceAccountInfo?.email && (
                <p className="text-xs text-blue-600 mt-1">
                  Service Account: {serviceAccountInfo.email}
                </p>
              )}
            </div>
          </div>

          {/* OAuth Scopes Section */}
          <div className="mb-6">
            <h4 className="font-medium text-gray-900 mb-3">Required OAuth Scopes</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">All scopes (comma-separated)</span>
                <button
                  onClick={() => handleCopy(REQUIRED_SCOPES.join(','), 'scopes')}
                  className="flex items-center space-x-1 px-3 py-1 bg-green-200 hover:bg-green-300 rounded text-sm transition-colors"
                >
                  <Copy className="h-4 w-4" />
                  <span>{copiedText === 'scopes' ? 'Copied!' : 'Copy All'}</span>
                </button>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg max-h-32 overflow-y-auto">
                <code className="text-xs text-gray-700 break-all">
                  {REQUIRED_SCOPES.join(',')}
                </code>
              </div>
              <p className="text-xs text-gray-600">
                Copy and paste this comma-separated list of scopes into the OAuth scopes field in the Google Admin Console.
              </p>
            </div>
          </div>

          {/* Quick Access Section */}
          <div className="mb-6">
            <h4 className="font-medium text-gray-900 mb-3">Quick Access to Domain-wide Delegation</h4>
            <p className="text-sm text-gray-600 mb-3">
              Click the button below to go directly to the Domain-wide Delegation page in your Google Admin Console:
            </p>
            <button
              onClick={openAdminConsole}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              <span>Open Google Admin Console</span>
            </button>
            <div className="flex items-start space-x-2 mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <Info className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-yellow-800">
                Make sure you're signed in with a super admin account that has domain management permissions.
              </p>
            </div>
          </div>

          {/* Integration Note */}
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <h5 className="font-medium text-green-900 mb-1">Automatic Setup Available</h5>
                <p className="text-sm text-green-800">
                  This setup process can be automated. Click "Generate Setup Instructions" in the service account setup to get your specific Client ID and follow the guided configuration.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

ScenarioSelector.displayName = 'ScenarioSelector';

export default ScenarioSelector;
