import React, { useState, useCallback } from 'react';
import { 
  Users, 
  UserCheck, 
  UserX, 
  AlertTriangle, 
  Download, 
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Target
} from 'lucide-react';

interface SourceUser {
  id: string;
  primaryEmail: string;
  name: {
    givenName: string;
    familyName: string;
    fullName: string;
  };
  isAdmin: boolean;
  suspended: boolean;
  sourceDomain: string;
}

interface TargetUser {
  id: string;
  primaryEmail: string;
  name: {
    givenName: string;
    familyName: string;
    fullName: string;
  };
  isAdmin: boolean;
  suspended: boolean;
  targetDomain: string;
}

interface UserCloneMatch {
  sourceUser: SourceUser;
  targetUser?: TargetUser;
  matchType: 'exact_email' | 'name_match' | 'custom_mapping' | 'no_match';
  matchConfidence: number;
  isAlreadyCloned: boolean;
}

interface CloneAnalysisResult {
  totalSourceUsers: number;
  totalTargetUsers: number;
  alreadyCloned: UserCloneMatch[];
  needsCloning: UserCloneMatch[];
  conflictingUsers: UserCloneMatch[];
  unmappedTargetUsers: TargetUser[];
  cloneStatus: {
    clonedCount: number;
    pendingCount: number;
    conflictCount: number;
    clonePercentage: number;
  };
}

interface CloneAnalysisConfig {
  sourceDomain: string;
  sourceAdminEmail: string;
  targetDomains: string[];
  targetAdminEmails: { [domain: string]: string };
  matchingStrategy: 'email_exact' | 'email_prefix' | 'name_based' | 'custom';
  includeSuspended: boolean;
  customMappings: { [sourceEmail: string]: string };
}

const UserCloneAnalyzer: React.FC = () => {
  const [config, setConfig] = useState<CloneAnalysisConfig>({
    sourceDomain: '',
    sourceAdminEmail: '',
    targetDomains: ['sample.arakutourism.net', 'migrate.arakutourism.net'],
    targetAdminEmails: {
      'sample.arakutourism.net': 'admin@sample.arakutourism.net',
      'migrate.arakutourism.net': 'admin@migrate.arakutourism.net'
    },
    matchingStrategy: 'custom',
    includeSuspended: false,
    customMappings: {}
  });

  const [analysis, setAnalysis] = useState<CloneAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [cloneSuggestions, setCloneSuggestions] = useState<any[]>([]);
  const [validation, setValidation] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('cloned');

  const runCloneAnalysis = useCallback(async () => {
    if (!config.sourceDomain || !config.sourceAdminEmail) {
      setError('Please provide source domain and admin email');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/user-clone-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'analyze-clone-status',
          sourceDomain: config.sourceDomain,
          sourceAdminEmail: config.sourceAdminEmail,
          targetDomains: config.targetDomains,
          targetAdminEmails: config.targetAdminEmails,
          options: {
            matchingStrategy: config.matchingStrategy,
            includeSuspended: config.includeSuspended,
            customMappings: config.customMappings
          }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setAnalysis(result.analysis);
        setCloneSuggestions(result.cloneSuggestions || []);
        setValidation(result.validation);
      } else {
        setError(result.message || 'Analysis failed');
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run analysis');
    } finally {
      setLoading(false);
    }
  }, [config]);

  const exportAnalysis = useCallback(async (format: 'json' | 'csv' | 'summary') => {
    if (!analysis) return;

    try {
      const response = await fetch('/api/user-clone-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'export-analysis',
          analysisResult: analysis,
          exportFormat: format
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `clone-analysis.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Export failed:', err);
    }
  }, [analysis]);

  const getStatusBadge = (status: string) => {
    const colors = {
      'Already Cloned': 'bg-green-100 text-green-800',
      'Needs Cloning': 'bg-red-100 text-red-800',
      'Conflict': 'bg-yellow-100 text-yellow-800',
      default: 'bg-gray-100 text-gray-800'
    };
    return colors[status as keyof typeof colors] || colors.default;
  };

  const getMatchTypeBadge = (matchType: string) => {
    const colors = {
      'exact_email': 'bg-blue-100 text-blue-800',
      'name_match': 'bg-purple-100 text-purple-800',
      'custom_mapping': 'bg-indigo-100 text-indigo-800',
      'no_match': 'bg-gray-100 text-gray-800',
      default: 'bg-gray-100 text-gray-800'
    };
    return colors[matchType as keyof typeof colors] || colors.default;
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Configuration Panel */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <Target className="h-5 w-5 text-blue-500" />
          <h2 className="text-xl font-semibold">User Clone Analysis</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Source Domain</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={config.sourceDomain}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                setConfig(prev => ({ ...prev, sourceDomain: e.target.value }))
              }
              placeholder="source.domain.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Source Admin Email</label>
            <input
              type="email"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={config.sourceAdminEmail}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                setConfig(prev => ({ ...prev, sourceAdminEmail: e.target.value }))
              }
              placeholder="admin@source.domain.com"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Matching Strategy</label>
            <select 
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={config.matchingStrategy}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => 
                setConfig(prev => ({ ...prev, matchingStrategy: e.target.value as any }))
              }
            >
              <option value="custom">Custom (Try all strategies)</option>
              <option value="email_exact">Email Exact Match</option>
              <option value="email_prefix">Email Prefix Match</option>
              <option value="name_based">Name-Based Match</option>
            </select>
          </div>
          <div className="flex items-center space-x-2 pt-6">
            <input
              type="checkbox"
              id="includeSuspended"
              checked={config.includeSuspended}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                setConfig(prev => ({ ...prev, includeSuspended: e.target.checked }))
              }
              className="h-4 w-4 text-blue-600 rounded"
            />
            <label htmlFor="includeSuspended" className="text-sm font-medium text-gray-700">
              Include Suspended Users
            </label>
          </div>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={runCloneAnalysis} 
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Users className="h-4 w-4" />
            )}
            {loading ? 'Analyzing...' : 'Analyze Clone Status'}
          </button>
          
          {analysis && (
            <div className="flex gap-2">
              <button 
                onClick={() => exportAnalysis('csv')}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </button>
              <button 
                onClick={() => exportAnalysis('json')}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                <Download className="h-4 w-4" />
                Export JSON
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-red-700">{error}</span>
            </div>
          </div>
        )}
      </div>

      {analysis && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Source Users</p>
                  <p className="text-2xl font-bold">{analysis.totalSourceUsers}</p>
                </div>
                <Users className="h-8 w-8 text-blue-500" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Already Cloned</p>
                  <p className="text-2xl font-bold text-green-600">{analysis.cloneStatus.clonedCount}</p>
                </div>
                <UserCheck className="h-8 w-8 text-green-500" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Needs Cloning</p>
                  <p className="text-2xl font-bold text-red-600">{analysis.cloneStatus.pendingCount}</p>
                </div>
                <UserX className="h-8 w-8 text-red-500" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Clone Percentage</p>
                  <p className="text-2xl font-bold">{analysis.cloneStatus.clonePercentage}%</p>
                </div>
                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-sm font-bold text-blue-600">
                    {analysis.cloneStatus.clonePercentage}%
                  </span>
                </div>
              </div>
              <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full" 
                  style={{ width: `${analysis.cloneStatus.clonePercentage}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Validation Alerts */}
          {validation && (
            <div className="space-y-2">
              {validation.warnings.map((warning: string, index: number) => (
                <div key={index} className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    <span className="text-yellow-700">{warning}</span>
                  </div>
                </div>
              ))}
              {validation.recommendations.map((rec: string, index: number) => (
                <div key={index} className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-blue-500" />
                    <span className="text-blue-700">{rec}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tabs */}
          <div className="bg-white rounded-lg shadow-md">
            <div className="border-b border-gray-200">
              <div className="flex space-x-8 px-6">
                {[
                  { id: 'cloned', label: `Already Cloned (${analysis.cloneStatus.clonedCount})`, icon: CheckCircle },
                  { id: 'needs-cloning', label: `Needs Cloning (${analysis.cloneStatus.pendingCount})`, icon: Clock },
                  { id: 'conflicts', label: `Conflicts (${analysis.cloneStatus.conflictCount})`, icon: AlertTriangle },
                  { id: 'unmapped', label: `Unmapped (${analysis.unmappedTargetUsers.length})`, icon: XCircle }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <tab.icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6">
              {activeTab === 'cloned' && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <h3 className="text-lg font-semibold">Users Already Cloned</h3>
                  </div>
                  <div className="space-y-2">
                    {analysis.alreadyCloned.map((match, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-green-50 rounded border">
                        <div>
                          <p className="font-medium">{match.sourceUser.name.fullName}</p>
                          <p className="text-sm text-gray-600">{match.sourceUser.primaryEmail}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm">{match.targetUser?.primaryEmail}</p>
                          <span className={`inline-block px-2 py-1 text-xs rounded ${getMatchTypeBadge(match.matchType)}`}>
                            {match.matchType} ({match.matchConfidence}%)
                          </span>
                        </div>
                      </div>
                    ))}
                    {analysis.alreadyCloned.length === 0 && (
                      <p className="text-gray-500 text-center py-4">No users have been cloned yet</p>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'needs-cloning' && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Clock className="h-5 w-5 text-orange-500" />
                    <h3 className="text-lg font-semibold">Users That Need Cloning</h3>
                  </div>
                  <div className="space-y-2">
                    {analysis.needsCloning.map((match, index) => {
                      const suggestion = cloneSuggestions.find(s => 
                        s.user.primaryEmail === match.sourceUser.primaryEmail
                      );
                      return (
                        <div key={index} className="flex items-center justify-between p-3 bg-red-50 rounded border">
                          <div>
                            <p className="font-medium">{match.sourceUser.name.fullName}</p>
                            <p className="text-sm text-gray-600">{match.sourceUser.primaryEmail}</p>
                            {match.sourceUser.isAdmin && (
                              <span className="inline-block px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded mt-1">
                                Admin User
                              </span>
                            )}
                          </div>
                          <div className="text-right">
                            {suggestion && (
                              <>
                                <p className="text-sm text-blue-600">Suggested: {suggestion.suggestedTargetEmail}</p>
                                <p className="text-xs text-gray-500">{suggestion.reasoning}</p>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {analysis.needsCloning.length === 0 && (
                      <p className="text-gray-500 text-center py-4">All users have been cloned</p>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'conflicts' && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    <h3 className="text-lg font-semibold">Conflicting Users</h3>
                  </div>
                  <div className="space-y-2">
                    {analysis.conflictingUsers.map((match, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-yellow-50 rounded border">
                        <div>
                          <p className="font-medium">{match.sourceUser.name.fullName}</p>
                          <p className="text-sm text-gray-600">{match.sourceUser.primaryEmail}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm">Multiple possible matches</p>
                          <span className="inline-block px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">
                            Requires Review
                          </span>
                        </div>
                      </div>
                    ))}
                    {analysis.conflictingUsers.length === 0 && (
                      <p className="text-gray-500 text-center py-4">No conflicting users found</p>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'unmapped' && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <XCircle className="h-5 w-5 text-gray-500" />
                    <h3 className="text-lg font-semibold">Unmapped Target Users</h3>
                  </div>
                  <div className="space-y-2">
                    {analysis.unmappedTargetUsers.map((user, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded border">
                        <div>
                          <p className="font-medium">{user.name.fullName}</p>
                          <p className="text-sm text-gray-600">{user.primaryEmail}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm">Domain: {user.targetDomain}</p>
                          <span className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded">
                            No Source Match
                          </span>
                        </div>
                      </div>
                    ))}
                    {analysis.unmappedTargetUsers.length === 0 && (
                      <p className="text-gray-500 text-center py-4">All target users are mapped</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserCloneAnalyzer;
