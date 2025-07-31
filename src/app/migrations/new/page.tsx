'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { ScenarioSelector } from '@/components/ScenarioSelector';
import { MigrationProgress } from '@/components/MigrationProgress';
import { 
  MigrationScenario, 
  MigrationStatus,
  createMigrationScenario,
  SINGLE_SUPER_ADMIN_STEPS,
  CROSS_TENANT_STEPS
} from '@/types/migration-scenarios';
import { ArrowLeft, ArrowRight } from 'lucide-react';

type WizardStep = 'scenario' | 'configuration' | 'review' | 'migration';

export default function NewMigration() {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState<WizardStep>('scenario');
  const [selectedScenario, setSelectedScenario] = useState<MigrationScenario | null>(null);
  const [migrationConfig, setMigrationConfig] = useState({
    sourceDomain: '',
    targetDomain: '',
    services: [] as string[],
    userMappings: [] as Array<{ sourceEmail: string; targetEmail: string }>,
    migrationOptions: {
      preserveLabels: true,
      migrateFolderStructure: true,
      enableDeltaSync: false,
      migrateSharedDrives: true,
      maintainPermissions: true,
    }
  });

  const [migrationStatus, setMigrationStatus] = useState<MigrationStatus | null>(null);

  const handleScenarioSelect = (scenario: MigrationScenario) => {
    setSelectedScenario(scenario);
    setCurrentStep('configuration');
  };

  const handleServiceToggle = (service: string) => {
    setMigrationConfig(prev => ({
      ...prev,
      services: prev.services.includes(service)
        ? prev.services.filter(s => s !== service)
        : [...prev.services, service]
    }));
  };

  const handleNext = () => {
    switch (currentStep) {
      case 'scenario':
        setCurrentStep('configuration');
        break;
      case 'configuration':
        setCurrentStep('review');
        break;
      case 'review':
        startMigration();
        break;
    }
  };

  const handleBack = () => {
    switch (currentStep) {
      case 'configuration':
        setCurrentStep('scenario');
        break;
      case 'review':
        setCurrentStep('configuration');
        break;
      case 'migration':
        setCurrentStep('review');
        break;
    }
  };

  const startMigration = () => {
    if (!selectedScenario) return;

    const scenario = {
      type: selectedScenario,
      steps: selectedScenario === 'single-super-admin' 
        ? SINGLE_SUPER_ADMIN_STEPS 
        : CROSS_TENANT_STEPS
    };

    const status: MigrationStatus = {
      id: `migration-${Date.now()}`,
      scenarioType: selectedScenario,
      status: 'running',
      currentStep: scenario.steps[0].id,
      startTime: new Date().toISOString(),
      estimatedCompletion: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(), // 6 hours from now
      overallProgress: 0,
      errors: []
    };

    setMigrationStatus(status);
    setCurrentStep('migration');
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'scenario':
        return (
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">
              Choose Migration Scenario
            </h2>
            <ScenarioSelector 
              selectedScenario={selectedScenario} 
              onScenarioSelect={handleScenarioSelect} 
            />
          </div>
        );

      case 'configuration':
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Configure Migration Settings
            </h2>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2">
                Selected Scenario: {selectedScenario === 'single-super-admin' ? 'Single Super Admin Migration' : 'Cross-Tenant Migration'}
              </h3>
              <p className="text-sm text-blue-800">
                {selectedScenario === 'single-super-admin' 
                  ? 'Migrate multiple domains using a single super admin account with comprehensive admin privileges.'
                  : 'Migrate data between separate Google Workspace tenants with independent authentication.'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Source Domain
                </label>
                <input
                  type="text"
                  value={migrationConfig.sourceDomain}
                  onChange={(e) => setMigrationConfig(prev => ({ ...prev, sourceDomain: e.target.value }))}
                  placeholder="source.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target Domain
                </label>
                <input
                  type="text"
                  value={migrationConfig.targetDomain}
                  onChange={(e) => setMigrationConfig(prev => ({ ...prev, targetDomain: e.target.value }))}
                  placeholder="target.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-4">
                Services to Migrate
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {['Gmail', 'Drive', 'Calendar', 'Contacts', 'Photos', 'Chat'].map(service => (
                  <label key={service} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={migrationConfig.services.includes(service)}
                      onChange={() => handleServiceToggle(service)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">{service}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Migration Options</h3>
              <div className="space-y-3">
                {Object.entries(migrationConfig.migrationOptions).map(([key, value]) => (
                  <label key={key} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={value}
                      onChange={(e) => setMigrationConfig(prev => ({
                        ...prev,
                        migrationOptions: {
                          ...prev.migrationOptions,
                          [key]: e.target.checked
                        }
                      }))}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">
                      {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        );

      case 'review':
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Review Migration Configuration
            </h2>
            
            <div className="bg-gray-50 rounded-lg p-6 space-y-4">
              <div>
                <h3 className="font-medium text-gray-900">Migration Scenario</h3>
                <p className="text-gray-600">
                  {selectedScenario === 'single-super-admin' ? 'Single Super Admin Migration' : 'Cross-Tenant Migration'}
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="font-medium text-gray-900">Source Domain</h3>
                  <p className="text-gray-600">{migrationConfig.sourceDomain}</p>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Target Domain</h3>
                  <p className="text-gray-600">{migrationConfig.targetDomain}</p>
                </div>
              </div>
              
              <div>
                <h3 className="font-medium text-gray-900">Services</h3>
                <p className="text-gray-600">{migrationConfig.services.join(', ') || 'None selected'}</p>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-medium text-yellow-900 mb-2">⚠️ Important Notes</h3>
              <ul className="text-sm text-yellow-800 space-y-1">
                <li>• Ensure you have proper administrative access to both domains</li>
                <li>• Migration will process all selected services automatically</li>
                <li>• Users will receive notifications about the migration process</li>
                <li>• This process cannot be easily reversed once started</li>
              </ul>
            </div>
          </div>
        );

      case 'migration':
        if (!selectedScenario || !migrationStatus) return null;
        
        const scenario = {
          type: selectedScenario,
          steps: selectedScenario === 'single-super-admin' 
            ? SINGLE_SUPER_ADMIN_STEPS 
            : CROSS_TENANT_STEPS
        };

        return (
          <MigrationProgress 
            migrationStatus={migrationStatus}
            steps={scenario.steps}
            onStepAction={(stepId, action) => {
              console.log(`Step action: ${action} on step ${stepId}`);
              // TODO: Implement step action handling
            }}
          />
        );

      default:
        return null;
    }
  };

  const getStepNumber = () => {
    switch (currentStep) {
      case 'scenario': return 1;
      case 'configuration': return 2;
      case 'review': return 3;
      case 'migration': return 4;
      default: return 1;
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'scenario':
        return selectedScenario !== null;
      case 'configuration':
        return migrationConfig.sourceDomain && migrationConfig.targetDomain && migrationConfig.services.length > 0;
      case 'review':
        return true;
      default:
        return false;
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Progress Steps */}
          <div className="mb-8">
            <div className="flex items-center justify-center">
              {['Scenario', 'Configuration', 'Review', 'Migration'].map((step, index) => (
                <div key={step} className="flex items-center">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                    index + 1 <= getStepNumber() 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-300 text-gray-700'
                  }`}>
                    {index + 1}
                  </div>
                  <span className={`ml-2 text-sm font-medium ${
                    index + 1 <= getStepNumber() ? 'text-blue-600' : 'text-gray-500'
                  }`}>
                    {step}
                  </span>
                  {index < 3 && (
                    <div className={`w-16 h-0.5 mx-4 ${
                      index + 1 < getStepNumber() ? 'bg-blue-600' : 'bg-gray-300'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900">
                Create New Migration
              </h1>
              {currentStep !== 'scenario' && (
                <p className="text-gray-600 mt-1">
                  Step {getStepNumber()} of 4
                </p>
              )}
            </div>

            {renderStepContent()}

            {/* Navigation */}
            {currentStep !== 'migration' && (
              <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
                <button
                  onClick={handleBack}
                  disabled={currentStep === 'scenario'}
                  className={`flex items-center px-4 py-2 text-sm font-medium rounded-md ${
                    currentStep === 'scenario'
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </button>

                <button
                  onClick={handleNext}
                  disabled={!canProceed()}
                  className={`flex items-center px-6 py-2 text-sm font-medium rounded-md ${
                    canProceed()
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {currentStep === 'review' ? 'Start Migration' : 'Next'}
                  <ArrowRight className="h-4 w-4 ml-1" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
