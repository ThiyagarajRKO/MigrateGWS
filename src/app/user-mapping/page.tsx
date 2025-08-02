'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  UserPlus, 
  List, 
  Eye, 
  Users,
  ArrowLeft,
  Database,
  FileText,
  Settings,
  Plus,
  Search
} from 'lucide-react';
import IndividualUserMapper from '@/components/IndividualUserMapper';
import UserMappingVisualizer, { UserMapping } from '@/components/UserMappingVisualizer';
import CSVMappingManager from '@/components/CSVMappingManager';
import UserDiscoveryMapping from '@/components/UserMapping';

export default function UserMappingPage() {
  const searchParams = useSearchParams();
  const [mappings, setMappings] = useState<UserMapping[]>([]);
  const [showMapper, setShowMapper] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'discovery' | 'individual' | 'bulk' | 'csv'>('discovery');

  // Handle tab parameter from URL
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['discovery', 'individual', 'bulk', 'csv'].includes(tab)) {
      setActiveTab(tab as 'discovery' | 'individual' | 'bulk' | 'csv');
    }
  }, [searchParams]);

  const handleSaveMapping = (mapping: UserMapping) => {
    if (editingIndex !== null) {
      const updated = [...mappings];
      updated[editingIndex] = mapping;
      setMappings(updated);
      setEditingIndex(null);
    } else {
      setMappings([...mappings, mapping]);
    }
    setShowMapper(false);
  };

  const handleEditMapping = (index: number) => {
    setEditingIndex(index);
    setShowMapper(true);
    setActiveTab('individual');
  };

  const handleDeleteMapping = (index: number) => {
    setMappings(mappings.filter((_, i) => i !== index));
  };

  const handleCancel = () => {
    setShowMapper(false);
    setEditingIndex(null);
  };

  const currentMapping = editingIndex !== null ? mappings[editingIndex] : undefined;

  const tabs = [
    { id: 'discovery' as const, label: 'User Discovery', icon: Search },
    { id: 'individual' as const, label: 'Individual Mapper', icon: UserPlus },
    { id: 'bulk' as const, label: 'Bulk Manager', icon: List },
    { id: 'csv' as const, label: 'CSV Import/Export', icon: FileText }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl shadow-sm border-b border-blue-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            <div className="flex items-center gap-4">
              <Link
                href="/migrations"
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-lg">
                  <Database className="h-6 w-6 text-white" />
                </div>
                <span className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                  MigrateGWS
                </span>
              </div>
            </div>
            <nav className="hidden md:flex items-center space-x-8">
              <Link href="/dashboard" className="text-gray-600 hover:text-blue-600 font-medium transition-colors duration-200">
                Dashboard
              </Link>
              <Link href="/migrations" className="text-blue-600 font-medium">
                Migrations
              </Link>
              <Link href="/settings" className="text-gray-600 hover:text-blue-600 font-medium transition-colors duration-200">
                Settings
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-lg">
              <Users className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
              User Mapping
            </h1>
          </div>
          <p className="text-gray-600 max-w-3xl font-medium">
            Create and manage user mappings for Google Workspace migrations. Define how users from source domains 
            will be mapped to target domains with support for merge, split, direct, and create scenarios.
          </p>
        </div>

        {/* Stats Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white/95 backdrop-blur-sm rounded-xl border border-blue-100 p-4 text-center shadow-lg hover:shadow-xl transition-all duration-200">
            <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">{mappings.length}</div>
            <div className="text-sm text-gray-600 font-medium">Total Mappings</div>
          </div>
          <div className="bg-white/95 backdrop-blur-sm rounded-xl border border-blue-100 p-4 text-center shadow-lg hover:shadow-xl transition-all duration-200">
            <div className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-purple-700 bg-clip-text text-transparent">
              {mappings.filter(m => m.mappingType === 'merge').length}
            </div>
            <div className="text-sm text-gray-600 font-medium">Merge</div>
          </div>
          <div className="bg-white/95 backdrop-blur-sm rounded-xl border border-blue-100 p-4 text-center shadow-lg hover:shadow-xl transition-all duration-200">
            <div className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-orange-700 bg-clip-text text-transparent">
              {mappings.filter(m => m.mappingType === 'split').length}
            </div>
            <div className="text-sm text-gray-600 font-medium">Split</div>
          </div>
          <div className="bg-white/95 backdrop-blur-sm rounded-xl border border-blue-100 p-4 text-center shadow-lg hover:shadow-xl transition-all duration-200">
            <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">
              {mappings.filter(m => m.mappingType === 'direct').length}
            </div>
            <div className="text-sm text-gray-600 font-medium">Direct</div>
          </div>
          <div className="bg-white/95 backdrop-blur-sm rounded-xl border border-blue-100 p-4 text-center shadow-lg hover:shadow-xl transition-all duration-200">
            <div className="text-2xl font-bold bg-gradient-to-r from-green-600 to-green-700 bg-clip-text text-transparent">
              {mappings.filter(m => m.targetUserExists).length}
            </div>
            <div className="text-sm text-gray-600 font-medium">Existing Targets</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white/95 backdrop-blur-sm rounded-xl border border-blue-100 shadow-lg mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-6">
            {/* User Discovery Tab */}
            {activeTab === 'discovery' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                      User Discovery & Cloning
                    </h3>
                    <p className="text-gray-600 text-sm mt-1">
                      Discover users from source domain and automatically clone missing users to target domains
                    </p>
                  </div>
                </div>
                <UserDiscoveryMapping />
              </div>
            )}

            {/* Individual Mapper Tab */}
            {activeTab === 'individual' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                    Individual User Mapper
                  </h3>
                  {!showMapper && (
                    <button
                      onClick={() => setShowMapper(true)}
                      className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105"
                    >
                      <UserPlus className="h-4 w-4" />
                      Create New Mapping
                    </button>
                  )}
                </div>

                {showMapper ? (
                  <IndividualUserMapper
                    onSaveMapping={handleSaveMapping}
                    onCancel={handleCancel}
                    initialMapping={currentMapping}
                  />
                ) : (
                  <div className="text-center py-8">
                    <div className="p-4 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl inline-block mb-4 shadow-lg">
                      <UserPlus className="h-12 w-12 text-white" />
                    </div>
                    <p className="text-gray-600 font-medium">
                      Click "Create New Mapping" to start building user mappings with the guided interface.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Bulk Manager Tab */}
            {activeTab === 'bulk' && (
              <div className="space-y-6">
                <h3 className="text-lg font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                  Bulk User Mapping Manager
                </h3>
                
                {mappings.length > 0 ? (
                  <UserMappingVisualizer
                    mappings={mappings}
                    onUpdateMapping={handleEditMapping}
                    onDeleteMapping={handleDeleteMapping}
                    showEditControls={true}
                  />
                ) : (
                  <div className="text-center py-12">
                    <div className="p-4 bg-gradient-to-br from-gray-600 to-gray-700 rounded-2xl inline-block mb-4 shadow-lg">
                      <List className="h-12 w-12 text-white" />
                    </div>
                    <h4 className="text-lg font-bold text-gray-900 mb-2">No mappings created yet</h4>
                    <p className="text-gray-600 mb-6 font-medium">
                      Create your first mapping using the Individual Mapper or CSV Import.
                    </p>
                    <button
                      onClick={() => setActiveTab('individual')}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105"
                    >
                      <UserPlus className="h-5 w-5" />
                      Create First Mapping
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* CSV Import/Export Tab */}
            {activeTab === 'csv' && (
              <div className="space-y-6">
                <h3 className="text-lg font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                  CSV Import/Export Manager
                </h3>
                <CSVMappingManager 
                  mappings={mappings}
                  onMappingsChange={setMappings}
                />
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 shadow-lg">
          <h3 className="text-lg font-bold bg-gradient-to-r from-blue-900 to-indigo-900 bg-clip-text text-transparent mb-4">
            Quick Actions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              href="/migrations/new"
              className="flex items-center gap-3 p-4 bg-white/80 rounded-lg hover:bg-white/90 transition-all duration-200 border border-blue-100"
            >
              <div className="p-2 bg-gradient-to-br from-green-600 to-green-700 rounded-lg">
                <Plus className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">Start Migration</div>
                <div className="text-sm text-gray-600">Begin a new migration project</div>
              </div>
            </Link>
            
            <button
              onClick={() => setActiveTab('discovery')}
              className="flex items-center gap-3 p-4 bg-white/80 rounded-lg hover:bg-white/90 transition-all duration-200 border border-blue-100"
            >
              <div className="p-2 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg">
                <Search className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">Discover Users</div>
                <div className="text-sm text-gray-600">Find and clone source users</div>
              </div>
            </button>
            
            <button
              onClick={() => setActiveTab('csv')}
              className="flex items-center gap-3 p-4 bg-white/80 rounded-lg hover:bg-white/90 transition-all duration-200 border border-blue-100"
            >
              <div className="p-2 bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">Import CSV</div>
                <div className="text-sm text-gray-600">Bulk import user mappings</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
