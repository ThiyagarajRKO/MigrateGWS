'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Settings, 
  Users, 
  Database, 
  Shield, 
  Calendar, 
  Mail, 
  HardDrive, 
  MessageSquare, 
  Image, 
  CheckCircle,
  Circle,
  ArrowLeft,
  Save,
  RefreshCw
} from 'lucide-react';
import { UserMapping } from '@/components/UserMapping';

interface MigrationService {
  id: string;
  name: string;
  icon: React.ElementType;
  description: string;
  enabled: boolean;
  options: {
    [key: string]: any;
  };
}

interface MigrationSettings {
  name: string;
  description: string;
  sourceDomain: string;
  targetDomains: string[];
  sourceAdminEmail: string;
  targetAdminEmails: { [domain: string]: string };
  services: MigrationService[];
  userMappings: any[];
  scheduleSettings: {
    startTime: string;
    batchSize: number;
    throttleDelay: number;
  };
  notificationSettings: {
    emailNotifications: boolean;
    webhookUrl: string;
    notifyOnCompletion: boolean;
    notifyOnErrors: boolean;
  };
}

export default function MigrationSettingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'general' | 'services' | 'users' | 'schedule' | 'notifications'>('general');
  const [saving, setSaving] = useState(false);
  
  const [settings, setSettings] = useState<MigrationSettings>({
    name: '',
    description: '',
    sourceDomain: '',
    targetDomains: [],
    sourceAdminEmail: '',
    targetAdminEmails: {},
    services: [
      {
        id: 'gmail',
        name: 'Gmail',
        icon: Mail,
        description: 'Migrate emails, labels, and settings',
        enabled: true,
        options: {
          includeTrash: false,
          includeSpam: false,
          preserveLabels: true,
          maxEmailsPerBatch: 100
        }
      },
      {
        id: 'drive',
        name: 'Google Drive',
        icon: HardDrive,
        description: 'Migrate files, folders, and sharing permissions',
        enabled: true,
        options: {
          preserveSharing: true,
          includeRevisions: false,
          maxFileSize: 5000,
          skipGoogleFormats: false
        }
      },
      {
        id: 'calendar',
        name: 'Google Calendar',
        icon: Calendar,
        description: 'Migrate calendars, events, and sharing settings',
        enabled: true,
        options: {
          includePrimaryCalendar: true,
          includeSecondaryCalendars: true,
          preserveInvitations: true
        }
      },
      {
        id: 'contacts',
        name: 'Google Contacts',
        icon: Users,
        description: 'Migrate contact lists and groups',
        enabled: false,
        options: {
          includeContactGroups: true,
          mergeContacts: false
        }
      },
      {
        id: 'photos',
        name: 'Google Photos',
        icon: Image,
        description: 'Migrate photos and albums',
        enabled: false,
        options: {
          preserveAlbums: true,
          includeSharedAlbums: false
        }
      },
      {
        id: 'chat',
        name: 'Google Chat',
        icon: MessageSquare,
        description: 'Migrate chat history and files',
        enabled: false,
        options: {
          includeChatHistory: true,
          includeFiles: true
        }
      }
    ],
    userMappings: [],
    scheduleSettings: {
      startTime: '',
      batchSize: 10,
      throttleDelay: 1000
    },
    notificationSettings: {
      emailNotifications: true,
      webhookUrl: '',
      notifyOnCompletion: true,
      notifyOnErrors: true
    }
  });

  const handleServiceToggle = (serviceId: string) => {
    setSettings(prev => ({
      ...prev,
      services: prev.services.map(service => 
        service.id === serviceId 
          ? { ...service, enabled: !service.enabled }
          : service
      )
    }));
  };

  const handleServiceOptionChange = (serviceId: string, option: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      services: prev.services.map(service => 
        service.id === serviceId 
          ? { 
              ...service, 
              options: { ...service.options, [option]: value }
            }
          : service
      )
    }));
  };

  const handleUserMappingsComplete = useCallback((mappings: any[]) => {
    setSettings(prev => ({
      ...prev,
      userMappings: mappings
    }));
  }, []);

  const saveMigrationSettings = async () => {
    setSaving(true);
    try {
      // Here you would save to your backend/database
      console.log('Saving migration settings:', settings);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Redirect to migrations list or show success message
      router.push('/migrations');
    } catch (error) {
      console.error('Failed to save migration settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'services', label: 'Services', icon: Database },
    { id: 'users', label: 'User Mappings', icon: Users },
    { id: 'schedule', label: 'Schedule', icon: Calendar },
    { id: 'notifications', label: 'Notifications', icon: Mail },
  ] as const;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Migration Settings</h1>
                <p className="text-sm text-gray-600">Configure services, options, and user mappings</p>
              </div>
            </div>
            
            <button
              onClick={saveMigrationSettings}
              disabled={saving}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>Save Settings</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:w-64 flex-shrink-0">
            <nav className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center space-x-3 px-3 py-2 text-left rounded-lg transition-colors ${
                      activeTab === tab.id
                        ? 'bg-blue-50 text-blue-600 border-r-2 border-blue-600'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="font-medium">{tab.label}</span>
                    {tab.id === 'users' && settings.userMappings.length > 0 && (
                      <CheckCircle className="h-4 w-4 text-green-500 ml-auto" />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            <div className="bg-white rounded-lg shadow-sm">
              {/* General Settings */}
              {activeTab === 'general' && (
                <div className="p-6">
                  <h2 className="text-lg font-medium text-gray-900 mb-6">General Settings</h2>
                  
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Migration Name
                      </label>
                      <input
                        type="text"
                        value={settings.name}
                        onChange={(e) => setSettings(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g., Marketing Team Migration"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Description
                      </label>
                      <textarea
                        value={settings.description}
                        onChange={(e) => setSettings(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Describe the purpose and scope of this migration..."
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Source Domain
                        </label>
                        <input
                          type="text"
                          value={settings.sourceDomain}
                          onChange={(e) => setSettings(prev => ({ ...prev, sourceDomain: e.target.value }))}
                          placeholder="source.com"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Source Admin Email
                        </label>
                        <input
                          type="email"
                          value={settings.sourceAdminEmail}
                          onChange={(e) => setSettings(prev => ({ ...prev, sourceAdminEmail: e.target.value }))}
                          placeholder="admin@source.com"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Target Domains (one per line)
                      </label>
                      <textarea
                        value={settings.targetDomains.join('\n')}
                        onChange={(e) => setSettings(prev => ({ 
                          ...prev, 
                          targetDomains: e.target.value.split('\n').filter(d => d.trim()) 
                        }))}
                        placeholder="target1.com&#10;target2.com"
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Services Settings */}
              {activeTab === 'services' && (
                <div className="p-6">
                  <h2 className="text-lg font-medium text-gray-900 mb-6">Migration Services</h2>
                  <p className="text-sm text-gray-600 mb-6">
                    Select which Google Workspace services to migrate and configure their options.
                  </p>
                  
                  <div className="space-y-6">
                    {settings.services.map((service) => {
                      const Icon = service.icon as React.ComponentType<{ className?: string }>;
                      return (
                        <div key={service.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-3">
                              <Icon className="h-6 w-6 text-blue-600" />
                              <div>
                                <h3 className="font-medium text-gray-900">{service.name}</h3>
                                <p className="text-sm text-gray-600">{service.description}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleServiceToggle(service.id)}
                              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                                service.enabled ? 'bg-blue-600' : 'bg-gray-200'
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                  service.enabled ? 'translate-x-5' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </div>
                          
                          {service.enabled && (
                            <div className="space-y-3 pl-9">
                              {Object.entries(service.options).map(([option, value]) => (
                                <div key={option} className="flex items-center justify-between">
                                  <span className="text-sm text-gray-700 capitalize">
                                    {option.replace(/([A-Z])/g, ' $1').toLowerCase()}
                                  </span>
                                  {typeof value === 'boolean' ? (
                                    <input
                                      type="checkbox"
                                      checked={value}
                                      onChange={(e) => handleServiceOptionChange(service.id, option, e.target.checked)}
                                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                    />
                                  ) : typeof value === 'number' ? (
                                    <input
                                      type="number"
                                      value={value}
                                      onChange={(e) => handleServiceOptionChange(service.id, option, parseInt(e.target.value))}
                                      className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                  ) : (
                                    <input
                                      type="text"
                                      value={value}
                                      onChange={(e) => handleServiceOptionChange(service.id, option, e.target.value)}
                                      className="w-32 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* User Mappings */}
              {activeTab === 'users' && (
                <div className="p-6">
                  <div className="mb-6">
                    <h2 className="text-lg font-medium text-gray-900">User Mappings</h2>
                    <p className="text-sm text-gray-600 mt-1">
                      Configure how users from the source domain will be mapped to target domains.
                    </p>
                  </div>
                  
                  <UserMapping
                    sourceDomain={settings.sourceDomain}
                    targetDomains={settings.targetDomains}
                    sourceAdminEmail={settings.sourceAdminEmail}
                    targetAdminEmails={settings.targetAdminEmails}
                    onMappingComplete={handleUserMappingsComplete}
                  />
                </div>
              )}

              {/* Schedule Settings */}
              {activeTab === 'schedule' && (
                <div className="p-6">
                  <h2 className="text-lg font-medium text-gray-900 mb-6">Schedule Settings</h2>
                  
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Start Time (optional)
                      </label>
                      <input
                        type="datetime-local"
                        value={settings.scheduleSettings.startTime}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          scheduleSettings: { ...prev.scheduleSettings, startTime: e.target.value }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">Leave empty to start immediately</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Batch Size
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={settings.scheduleSettings.batchSize}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          scheduleSettings: { ...prev.scheduleSettings, batchSize: parseInt(e.target.value) }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">Number of users to process simultaneously</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Throttle Delay (ms)
                      </label>
                      <input
                        type="number"
                        min="100"
                        max="10000"
                        step="100"
                        value={settings.scheduleSettings.throttleDelay}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          scheduleSettings: { ...prev.scheduleSettings, throttleDelay: parseInt(e.target.value) }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">Delay between API calls to avoid rate limits</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Notification Settings */}
              {activeTab === 'notifications' && (
                <div className="p-6">
                  <h2 className="text-lg font-medium text-gray-900 mb-6">Notification Settings</h2>
                  
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-gray-900">Email Notifications</h3>
                        <p className="text-sm text-gray-600">Receive email updates about migration progress</p>
                      </div>
                      <button
                        onClick={() => setSettings(prev => ({
                          ...prev,
                          notificationSettings: { 
                            ...prev.notificationSettings, 
                            emailNotifications: !prev.notificationSettings.emailNotifications 
                          }
                        }))}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                          settings.notificationSettings.emailNotifications ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            settings.notificationSettings.emailNotifications ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Webhook URL (optional)
                      </label>
                      <input
                        type="url"
                        value={settings.notificationSettings.webhookUrl}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          notificationSettings: { ...prev.notificationSettings, webhookUrl: e.target.value }
                        }))}
                        placeholder="https://your-webhook-url.com/migration-updates"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={settings.notificationSettings.notifyOnCompletion}
                          onChange={(e) => setSettings(prev => ({
                            ...prev,
                            notificationSettings: { 
                              ...prev.notificationSettings, 
                              notifyOnCompletion: e.target.checked 
                            }
                          }))}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label className="ml-2 text-sm text-gray-700">
                          Notify when migration completes
                        </label>
                      </div>
                      
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={settings.notificationSettings.notifyOnErrors}
                          onChange={(e) => setSettings(prev => ({
                            ...prev,
                            notificationSettings: { 
                              ...prev.notificationSettings, 
                              notifyOnErrors: e.target.checked 
                            }
                          }))}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label className="ml-2 text-sm text-gray-700">
                          Notify on errors and failures
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
