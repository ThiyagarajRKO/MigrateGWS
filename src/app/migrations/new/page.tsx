'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  Database, 
  ArrowLeft, 
  Users, 
  Settings,
  MapPin,
  Play,
  Save,
  Upload,
  Download
} from 'lucide-react';

interface DomainMapping {
  id: string;
  source: string;
  target: string;
}

interface UserMapping {
  id: string;
  domainMappingId: string;
  sourceUser: string;
  targetUser: string;
}

interface MigrationConfig {
  name: string;
  description: string;
  services: string[];
  domainMappings: DomainMapping[];
  userMappings: UserMapping[];
}

export default function NewMigrationPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [config, setConfig] = useState<MigrationConfig>({
    name: '',
    description: '',
    services: [],
    domainMappings: [],
    userMappings: []
  });

  const availableServices = [
    'Gmail',
    'Google Drive',
    'Google Calendar',
    'Google Contacts',
    'Google Photos',
    'Google Chat',
    'Shared Drives'
  ];

  const steps = [
    { id: 1, name: 'Basic Info', icon: Settings },
    { id: 2, name: 'Domain Mapping', icon: MapPin },
    { id: 3, name: 'User Mapping', icon: Users },
    { id: 4, name: 'Review & Launch', icon: Play }
  ];

  const addDomainMapping = () => {
    const newMapping: DomainMapping = {
      id: Date.now().toString(),
      source: '',
      target: ''
    };
    setConfig(prev => ({
      ...prev,
      domainMappings: [...prev.domainMappings, newMapping]
    }));
  };

  const updateDomainMapping = (id: string, field: 'source' | 'target', value: string) => {
    setConfig(prev => ({
      ...prev,
      domainMappings: prev.domainMappings.map(mapping =>
        mapping.id === id ? { ...mapping, [field]: value } : mapping
      )
    }));
  };

  const removeDomainMapping = (id: string) => {
    setConfig(prev => ({
      ...prev,
      domainMappings: prev.domainMappings.filter(mapping => mapping.id !== id),
      userMappings: prev.userMappings.filter(mapping => mapping.domainMappingId !== id)
    }));
  };

  const addUserMapping = (domainMappingId: string) => {
    const newMapping: UserMapping = {
      id: Date.now().toString(),
      domainMappingId,
      sourceUser: '',
      targetUser: ''
    };
    setConfig(prev => ({
      ...prev,
      userMappings: [...prev.userMappings, newMapping]
    }));
  };

  const updateUserMapping = (id: string, field: 'sourceUser' | 'targetUser', value: string) => {
    setConfig(prev => ({
      ...prev,
      userMappings: prev.userMappings.map(mapping =>
        mapping.id === id ? { ...mapping, [field]: value } : mapping
      )
    }));
  };

  const removeUserMapping = (id: string) => {
    setConfig(prev => ({
      ...prev,
      userMappings: prev.userMappings.filter(mapping => mapping.id !== id)
    }));
  };

  const renderBasicInfo = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Migration Name *
        </label>
        <input
          type="text"
          value={config.name}
          onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
          placeholder="e.g., Marketing Team Migration"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Description
        </label>
        <textarea
          value={config.description}
          onChange={(e) => setConfig(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Brief description of this migration..."
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Services to Migrate *
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {availableServices.map((service) => (
            <label key={service} className="flex items-center">
              <input
                type="checkbox"
                checked={config.services.includes(service)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setConfig(prev => ({ ...prev, services: [...prev.services, service] }));
                  } else {
                    setConfig(prev => ({ ...prev, services: prev.services.filter(s => s !== service) }));
                  }
                }}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">{service}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  const renderDomainMapping = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">Domain Mappings</h3>
        <div className="flex space-x-2">
          <button
            onClick={addDomainMapping}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm"
          >
            Add Domain
          </button>
          <button className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 text-sm flex items-center">
            <Upload className="h-4 w-4 mr-1" />
            Import CSV
          </button>
        </div>
      </div>

      {config.domainMappings.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
          <MapPin className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No domain mappings</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by adding your first domain mapping.</p>
          <button
            onClick={addDomainMapping}
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Add Domain Mapping
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {config.domainMappings.map((mapping) => (
            <div key={mapping.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Source Domain</label>
                  <input
                    type="text"
                    value={mapping.source}
                    onChange={(e) => updateDomainMapping(mapping.id, 'source', e.target.value)}
                    placeholder="source-domain.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
                <div className="text-gray-400">→</div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Target Domain</label>
                  <input
                    type="text"
                    value={mapping.target}
                    onChange={(e) => updateDomainMapping(mapping.id, 'target', e.target.value)}
                    placeholder="target-domain.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
                <button
                  onClick={() => removeDomainMapping(mapping.id)}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderUserMapping = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">User Mappings</h3>
        <button className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 text-sm flex items-center">
          <Upload className="h-4 w-4 mr-1" />
          Import CSV
        </button>
      </div>

      {config.domainMappings.map((domainMapping) => (
        <div key={domainMapping.id} className="border border-gray-200 rounded-lg p-4">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-medium text-gray-900">
              {domainMapping.source} → {domainMapping.target}
            </h4>
            <button
              onClick={() => addUserMapping(domainMapping.id)}
              className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
            >
              Add User
            </button>
          </div>

          {config.userMappings
            .filter(mapping => mapping.domainMappingId === domainMapping.id)
            .map((userMapping) => (
              <div key={userMapping.id} className="flex items-center space-x-4 mb-2">
                <div className="flex-1">
                  <input
                    type="text"
                    value={userMapping.sourceUser}
                    onChange={(e) => updateUserMapping(userMapping.id, 'sourceUser', e.target.value)}
                    placeholder={`user@${domainMapping.source}`}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
                <div className="text-gray-400">→</div>
                <div className="flex-1">
                  <input
                    type="text"
                    value={userMapping.targetUser}
                    onChange={(e) => updateUserMapping(userMapping.id, 'targetUser', e.target.value)}
                    placeholder={`user@${domainMapping.target}`}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
                <button
                  onClick={() => removeUserMapping(userMapping.id)}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  Remove
                </button>
              </div>
            ))}

          {config.userMappings.filter(mapping => mapping.domainMappingId === domainMapping.id).length === 0 && (
            <p className="text-sm text-gray-500 italic">No user mappings defined for this domain.</p>
          )}
        </div>
      ))}

      {config.domainMappings.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Users className="mx-auto h-8 w-8 text-gray-400 mb-2" />
          <p>Please configure domain mappings first to add user mappings.</p>
        </div>
      )}
    </div>
  );

  const renderReview = () => (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-900 mb-2">Migration Summary</h3>
        <div className="text-sm text-blue-800 space-y-1">
          <p><strong>Name:</strong> {config.name || 'Untitled Migration'}</p>
          <p><strong>Services:</strong> {config.services.join(', ') || 'None selected'}</p>
          <p><strong>Domain Mappings:</strong> {config.domainMappings.length}</p>
          <p><strong>User Mappings:</strong> {config.userMappings.length}</p>
        </div>
      </div>

      {config.domainMappings.map((domainMapping) => (
        <div key={domainMapping.id} className="border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2">
            {domainMapping.source} → {domainMapping.target}
          </h4>
          <div className="space-y-1">
            {config.userMappings
              .filter(mapping => mapping.domainMappingId === domainMapping.id)
              .map((userMapping) => (
                <div key={userMapping.id} className="text-sm text-gray-600">
                  {userMapping.sourceUser} → {userMapping.targetUser}
                </div>
              ))}
          </div>
        </div>
      ))}

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="font-medium text-yellow-900 mb-2">Pre-Migration Checklist</h4>
        <div className="space-y-2 text-sm text-yellow-800">
          <div className="flex items-center">
            <input type="checkbox" className="h-4 w-4 text-blue-600 mr-2" />
            <span>OAuth credentials configured for source and target domains</span>
          </div>
          <div className="flex items-center">
            <input type="checkbox" className="h-4 w-4 text-blue-600 mr-2" />
            <span>Target users have sufficient storage quotas</span>
          </div>
          <div className="flex items-center">
            <input type="checkbox" className="h-4 w-4 text-blue-600 mr-2" />
            <span>All mappings have been verified</span>
          </div>
          <div className="flex items-center">
            <input type="checkbox" className="h-4 w-4 text-blue-600 mr-2" />
            <span>Backup strategy is in place</span>
          </div>
        </div>
      </div>
    </div>
  );

  const isStepValid = (step: number) => {
    switch (step) {
      case 1:
        return config.name && config.services.length > 0;
      case 2:
        return config.domainMappings.length > 0 && 
               config.domainMappings.every(m => m.source && m.target);
      case 3:
        return true; // User mappings are optional
      case 4:
        return true;
      default:
        return false;
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
              <Link href="/dashboard" className="text-gray-600 hover:text-blue-600">Dashboard</Link>
              <Link href="/migrations" className="text-gray-600 hover:text-blue-600">Migrations</Link>
              <Link href="/settings" className="text-gray-600 hover:text-blue-600">Settings</Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="flex items-center mb-8">
          <Link href="/migrations" className="mr-4">
            <ArrowLeft className="h-6 w-6 text-gray-600 hover:text-gray-900" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">New Migration</h1>
            <p className="text-gray-600 mt-1">Configure your Google Workspace migration</p>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step) => {
              const Icon = step.icon;
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;
              
              return (
                <div key={step.id} className="flex items-center">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                    isActive 
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : isCompleted
                      ? 'border-green-600 bg-green-600 text-white'
                      : 'border-gray-300 bg-white text-gray-400'
                  }`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className={`ml-2 text-sm font-medium ${
                    isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-500'
                  }`}>
                    {step.name}
                  </span>
                  {step.id < steps.length && (
                    <div className={`mx-4 h-0.5 w-16 ${
                      isCompleted ? 'bg-green-600' : 'bg-gray-300'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          {currentStep === 1 && renderBasicInfo()}
          {currentStep === 2 && renderDomainMapping()}
          {currentStep === 3 && renderUserMapping()}
          {currentStep === 4 && renderReview()}
        </div>

        {/* Navigation */}
        <div className="flex justify-between">
          <button
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            disabled={currentStep === 1}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>

          <div className="flex space-x-4">
            <button className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center">
              <Save className="h-4 w-4 mr-2" />
              Save Draft
            </button>
            
            {currentStep < steps.length ? (
              <button
                onClick={() => setCurrentStep(Math.min(steps.length, currentStep + 1))}
                disabled={!isStepValid(currentStep)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            ) : (
              <button
                disabled={!isStepValid(currentStep)}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                <Play className="h-4 w-4 mr-2" />
                Start Migration
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
