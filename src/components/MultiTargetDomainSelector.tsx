'use client';

import { useState, useEffect, memo } from 'react';
import {
  Plus,
  Trash2,
  Globe,
  AlertTriangle,
  CheckCircle,
  Info,
  Target,
  Users,
  ArrowRight,
  Loader2,
  Copy,
  ExternalLink
} from 'lucide-react';
import { TargetDomainConfig, getAvailableTargetDomains } from '@/types/migration-scenarios';

interface Domain {
  domainName: string;
  isPrimary?: boolean;
  verified?: boolean;
}

interface MultiTargetDomainSelectorProps {
  availableDomains: Domain[];
  selectedTargets: TargetDomainConfig[];
  onTargetsChange: (targets: TargetDomainConfig[]) => void;
  loading?: boolean;
  error?: string | null;
  className?: string;
  minTargets?: number;
  maxTargets?: number;
  excludedSourceDomains?: string[];
}

export const MultiTargetDomainSelector = memo(function MultiTargetDomainSelector({
  availableDomains = [],
  selectedTargets = [],
  onTargetsChange,
  loading = false,
  error = null,
  className = '',
  minTargets = 1,
  maxTargets = 10,
  excludedSourceDomains = []
}: MultiTargetDomainSelectorProps) {
  const [targets, setTargets] = useState<TargetDomainConfig[]>(
    selectedTargets.length > 0 
      ? selectedTargets 
      : [createEmptyTarget()]
  );

  function createEmptyTarget(): TargetDomainConfig {
    return {
      domain: '',
      conflictResolution: 'prefix',
      preserveGroups: true,
      emailForwarding: true
    };
  }

  // Get available domains for target selection (excluding source domains and already selected targets)
  const getAvailableDomainsForIndex = (currentIndex: number) => {
    const otherSelectedDomains = targets
      .map(t => t.domain)
      .filter((domain, idx) => idx !== currentIndex && domain.trim() !== '');
    
    const allExcludedDomains = [
      ...excludedSourceDomains.filter(d => d.trim() !== ''),
      ...otherSelectedDomains
    ];

    return getAvailableTargetDomains(availableDomains, allExcludedDomains);
  };

  useEffect(() => {
    if (selectedTargets.length > 0) {
      setTargets(selectedTargets);
    }
  }, [selectedTargets]);

  useEffect(() => {
    onTargetsChange(targets);
  }, [targets, onTargetsChange]);

  const addTarget = () => {
    if (targets.length < maxTargets) {
      setTargets([...targets, createEmptyTarget()]);
    }
  };

  const removeTarget = (index: number) => {
    if (targets.length > minTargets) {
      setTargets(targets.filter((_, i) => i !== index));
    }
  };

  const updateTarget = (index: number, updates: Partial<TargetDomainConfig>) => {
    const newTargets = [...targets];
    newTargets[index] = { ...newTargets[index], ...updates };
    setTargets(newTargets);
  };

  const getDomainIcon = (domain: string) => {
    const domainInfo = availableDomains.find(d => d.domainName === domain);
    if (!domainInfo) return <Globe className="h-4 w-4 text-gray-400" />;
    
    if (domainInfo.isPrimary) {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    }
    
    return <Globe className="h-4 w-4 text-blue-600" />;
  };

  const isConfigValid = () => {
    return targets.length >= minTargets && 
           targets.every(target => 
             target.domain.trim() !== '' && 
             availableDomains.some(d => d.domainName === target.domain)
           );
  };

  const hasEmptyTargets = () => {
    return targets.some(target => target.domain.trim() === '');
  };

  const hasInvalidTargets = () => {
    return targets.some(target => 
      target.domain.trim() !== '' && 
      !availableDomains.some(d => d.domainName === target.domain)
    );
  };

  const getUniqueTargets = () => {
    const seen = new Set();
    return targets.filter(target => {
      if (seen.has(target.domain)) {
        return false;
      }
      seen.add(target.domain);
      return true;
    });
  };

  const hasDuplicates = targets.length !== getUniqueTargets().length;

  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Target className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-gray-900">
              Multiple Target Domains
            </h3>
            <p className="text-gray-600 mt-1">
              Configure multiple destination domains for your migration
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">Targets</div>
            <div className="text-lg font-semibold text-blue-600">
              {targets.length}/{maxTargets}
            </div>
          </div>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">Error:</span>
              <span>{error}</span>
            </div>
          </div>
        )}

        {hasDuplicates && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2 text-yellow-800">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">Warning:</span>
              <span>Duplicate target domains detected. Each domain should be unique.</span>
            </div>
          </div>
        )}

        {loading && (
          <div className="mt-4 flex items-center gap-2 text-gray-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading available domains...</span>
          </div>
        )}
      </div>

      <div className="p-6">
        {/* Target Domain Configuration */}
        <div className="space-y-6">
          {targets.map((target, index) => (
            <div
              key={index}
              className={`border rounded-lg p-5 ${
                target.domain && !availableDomains.some(d => d.domainName === target.domain)
                  ? 'border-red-200 bg-red-50'
                  : target.domain
                  ? 'border-green-200 bg-green-50'
                  : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
                    {index + 1}
                  </div>
                  <h4 className="font-medium text-gray-900">
                    Target Domain {index + 1}
                  </h4>
                  {target.domain && getDomainIcon(target.domain)}
                </div>
                
                {targets.length > minTargets && (
                  <button
                    onClick={() => removeTarget(index)}
                    className="p-2 text-red-600 hover:text-red-800 hover:bg-red-100 rounded-lg transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {/* Domain Selection */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Target Domain
                    </label>
                    <select
                      value={target.domain}
                      onChange={(e) => updateTarget(index, { domain: e.target.value })}
                      disabled={loading}
                      required
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 ${
                        target.domain === '' 
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                          : !getAvailableDomainsForIndex(index).some(d => d.domainName === target.domain) && !availableDomains.some(d => d.domainName === target.domain)
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                          : 'border-green-300 focus:border-green-500 focus:ring-green-500'
                      }`}
                    >
                      <option value="">Select a domain...</option>
                      {getAvailableDomainsForIndex(index).map((domain) => (
                        <option 
                          key={domain.domainName} 
                          value={domain.domainName}
                        >
                          {domain.domainName} {domain.isPrimary ? '(Primary)' : ''}
                        </option>
                      ))}
                    </select>
                    {target.domain === '' && (
                      <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Please select a target domain
                      </p>
                    )}
                    {target.domain && !getAvailableDomainsForIndex(index).some(d => d.domainName === target.domain) && excludedSourceDomains.includes(target.domain) && (
                      <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        This domain is already selected as a source domain
                      </p>
                    )}
                    {target.domain && !availableDomains.some(d => d.domainName === target.domain) && !excludedSourceDomains.includes(target.domain) && (
                      <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        This domain is not available or verified
                      </p>
                    )}
                    {target.domain && availableDomains.some(d => d.domainName === target.domain) && !excludedSourceDomains.includes(target.domain) && (
                      <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Domain verified and available
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Conflict Resolution
                    </label>
                    <select
                      value={target.conflictResolution}
                      onChange={(e) => updateTarget(index, { 
                        conflictResolution: e.target.value as 'prefix' | 'suffix' | 'manual' 
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="prefix">Add Prefix</option>
                      <option value="suffix">Add Suffix</option>
                      <option value="manual">Manual Resolution</option>
                    </select>
                  </div>
                </div>

                {/* Options */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Migration Options
                    </label>
                    <div className="space-y-3">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={target.preserveGroups}
                          onChange={(e) => updateTarget(index, { preserveGroups: e.target.checked })}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Preserve Groups</span>
                      </label>

                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={target.emailForwarding}
                          onChange={(e) => updateTarget(index, { emailForwarding: e.target.checked })}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Email Forwarding</span>
                      </label>
                    </div>
                  </div>

                  {target.domain && (
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Info className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-800">Domain Info</span>
                      </div>
                      <div className="text-xs text-blue-700 space-y-1">
                        <div>Domain: {target.domain}</div>
                        <div>Conflicts: {target.conflictResolution}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Add Target Button */}
        {targets.length < maxTargets && (
          <div className="mt-6">
            <button
              onClick={addTarget}
              disabled={loading || hasEmptyTargets()}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg transition-colors ${
                hasEmptyTargets() 
                  ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                  : 'border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600'
              } disabled:opacity-50`}
            >
              <Plus className="h-5 w-5" />
              Add Another Target Domain
            </button>
            {hasEmptyTargets() && (
              <p className="text-sm text-amber-600 mt-2 flex items-center gap-1">
                <Info className="h-3 w-3" />
                Please fill in all existing target domains before adding more
              </p>
            )}
          </div>
        )}

        {/* Summary */}
        {targets.length > 1 && (
          <div className="mt-6 p-4 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <h4 className="font-medium text-green-800">Migration Summary</h4>
            </div>
            <div className="text-sm text-green-700 space-y-1">
              <div>✅ {targets.length} target domains configured</div>
              <div>✅ {targets.filter(t => t.emailForwarding).length} domains with email forwarding</div>
              <div>✅ {targets.filter(t => t.preserveGroups).length} domains preserving groups</div>
              {isConfigValid() && (
                <div className="mt-2 text-green-800 font-medium">
                  🎉 Configuration is ready for migration!
                </div>
              )}
            </div>
          </div>
        )}

        {/* Validation Status */}
        {!isConfigValid() && targets.some(t => t.domain || hasEmptyTargets() || hasInvalidTargets()) && (
          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2 text-yellow-800 mb-2">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">Configuration Issues</span>
            </div>
            <div className="text-sm text-yellow-700 space-y-1">
              {hasEmptyTargets() && (
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-yellow-600 rounded-full"></span>
                  Some target domains are not selected
                </div>
              )}
              {hasInvalidTargets() && (
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-yellow-600 rounded-full"></span>
                  Some selected domains are not available or verified
                </div>
              )}
              {hasDuplicates && (
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-yellow-600 rounded-full"></span>
                  Duplicate domains detected - each domain must be unique
                </div>
              )}
              {targets.length < minTargets && (
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-yellow-600 rounded-full"></span>
                  At least {minTargets} target domain{minTargets > 1 ? 's are' : ' is'} required
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

MultiTargetDomainSelector.displayName = 'MultiTargetDomainSelector';

export default MultiTargetDomainSelector;
