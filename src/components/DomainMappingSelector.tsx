'use client';

import { useState, useEffect } from 'react';
import { 
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  Info,
  Users,
  Building,
  GitBranch,
  Network,
  Loader2
} from 'lucide-react';
import { 
  DomainMappingType, 
  DomainMappingConfig, 
  DomainMappingOption, 
  DOMAIN_MAPPING_OPTIONS,
  getSupportedMappingTypes,
  MigrationScenario 
} from '@/types/migration-scenarios';
import { useDomains } from '@/hooks/useGoogleWorkspaceDomains';

interface DomainMappingSelectorProps {
  selectedScenario: MigrationScenario;
  selectedMapping: DomainMappingConfig | null;
  onMappingSelect: (mapping: DomainMappingConfig) => void;
}

export function DomainMappingSelector({ 
  selectedScenario, 
  selectedMapping, 
  onMappingSelect 
}: DomainMappingSelectorProps) {
  const { domains, loading: domainsLoading, error: domainsError } = useDomains();
  
  const [selectedType, setSelectedType] = useState<DomainMappingType | null>(
    selectedMapping?.type || null
  );
  const [sourceDomains, setSourceDomains] = useState<string[]>(
    selectedMapping?.sourceDomains || ['']
  );
  const [targetDomain, setTargetDomain] = useState(
    selectedMapping?.targetDomain || ''
  );
  const [targetDomains, setTargetDomains] = useState<string[]>(
    selectedMapping?.targetDomains || (selectedMapping?.type === 'one-to-many' ? ['', ''] : [''])
  );
  const [preserveAlias, setPreserveAlias] = useState(
    selectedMapping?.preserveSourceAsAlias || false
  );
  const [conflictResolution, setConflictResolution] = useState<'prefix' | 'suffix' | 'manual'>(
    selectedMapping?.conflictResolution || 'prefix'
  );
  const [distributionRule, setDistributionRule] = useState<'department' | 'alphabetical' | 'custom'>(
    selectedMapping?.distributionRule || 'department'
  );

  // Sync state when selectedMapping prop changes
  useEffect(() => {
    if (selectedMapping) {
      setSelectedType(selectedMapping.type);
      setSourceDomains(selectedMapping.sourceDomains);
      setTargetDomain(selectedMapping.targetDomain || '');
      setTargetDomains(selectedMapping.targetDomains || (selectedMapping.type === 'one-to-many' ? ['', ''] : ['']));
      setPreserveAlias(selectedMapping.preserveSourceAsAlias || false);
      setConflictResolution(selectedMapping.conflictResolution || 'prefix');
      setDistributionRule(selectedMapping.distributionRule || 'department');
    }
  }, [selectedMapping]);

  const supportedMappings = getSupportedMappingTypes(selectedScenario);

  const getIcon = (type: DomainMappingType) => {
    switch (type) {
      case 'one-to-one': return Users;
      case 'one-to-many': return Building;
      case 'many-to-one': return GitBranch;
      case 'subdomain': return Network;
      default: return Users;
    }
  };

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'Low': return 'bg-green-100 text-green-800 border-green-200';
      case 'Medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'High': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const handleTypeSelect = (option: DomainMappingOption) => {
    setSelectedType(option.type);
    
    // Reset domains based on type
    if (option.type === 'many-to-one') {
      setSourceDomains(['', '']); // Start with 2 domains for many-to-one
    } else {
      setSourceDomains(['']); // Single domain for other types
    }
    
    if (option.type === 'one-to-many') {
      setTargetDomains(['', '']); // Start with 2 target domains for one-to-many
    } else {
      setTargetDomains(['']); // Single target for other types
    }
  };

  const addSourceDomain = () => {
    setSourceDomains([...sourceDomains, '']);
  };

  const removeSourceDomain = (index: number) => {
    setSourceDomains(sourceDomains.filter((_, i) => i !== index));
  };

  const updateSourceDomain = (index: number, value: string) => {
    const newDomains = [...sourceDomains];
    newDomains[index] = value;
    setSourceDomains(newDomains);
  };

  const addTargetDomain = () => {
    setTargetDomains([...targetDomains, '']);
  };

  const removeTargetDomain = (index: number) => {
    setTargetDomains(targetDomains.filter((_, i) => i !== index));
  };

  const updateTargetDomain = (index: number, value: string) => {
    const newDomains = [...targetDomains];
    newDomains[index] = value;
    setTargetDomains(newDomains);
  };

  const handleConfirm = () => {
    const isOneToMany = selectedType === 'one-to-many';
    const effectiveTargetDomains = isOneToMany ? targetDomains.filter(d => d.trim()) : [];
    const effectiveTargetDomain = isOneToMany ? '' : targetDomain.trim();
    
    if (!selectedType || sourceDomains.some(d => !d.trim())) {
      return;
    }
    
    if (isOneToMany && effectiveTargetDomains.length === 0) {
      return;
    }
    
    if (!isOneToMany && !effectiveTargetDomain) {
      return;
    }

    const selectedOption = DOMAIN_MAPPING_OPTIONS.find(opt => opt.type === selectedType);
    if (!selectedOption) return;

    const config: DomainMappingConfig = {
      type: selectedType,
      sourceDomains: sourceDomains.filter(d => d.trim()),
      targetDomain: effectiveTargetDomain,
      targetDomains: isOneToMany ? effectiveTargetDomains : undefined,
      preserveSourceAsAlias: preserveAlias,
      conflictResolution: selectedOption.requiresConflictHandling ? conflictResolution : undefined,
      distributionRule: isOneToMany ? distributionRule : undefined,
      description: selectedOption.description
    };

    onMappingSelect(config);
  };

  const canConfirm = () => {
    if (!selectedType || sourceDomains.some(d => !d.trim())) return false;
    
    if (selectedType === 'one-to-many') {
      return targetDomains.some(d => d.trim());
    } else {
      return targetDomain.trim() !== '';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Choose Domain Mapping Type
        </h3>
        <p className="text-gray-600 text-sm">
          Domain mapping determines how usernames and email addresses transition from source to destination domains.
        </p>
      </div>

      {/* Mapping Type Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {supportedMappings.map((option) => {
          const Icon = getIcon(option.type);
          const isSelected = selectedType === option.type;
          
          return (
            <div
              key={option.type}
              className={`border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${
                isSelected 
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => handleTypeSelect(option)}
            >
              <div className="flex items-start space-x-3">
                <Icon className={`h-6 w-6 mt-1 ${isSelected ? 'text-blue-600' : 'text-gray-400'}`} />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900">{option.title}</h4>
                    <span className={`px-2 py-1 text-xs font-medium rounded border ${getComplexityColor(option.complexity)}`}>
                      {option.complexity}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{option.description}</p>
                  <div className="text-xs text-blue-600 font-mono bg-blue-50 px-2 py-1 rounded">
                    {option.example}
                  </div>
                  
                  {isSelected && (
                    <div className="mt-4 space-y-3">
                      <div>
                        <h5 className="text-sm font-medium text-green-700 mb-1">✅ Advantages:</h5>
                        <ul className="text-xs text-green-600 space-y-1">
                          {option.advantages.map((advantage, idx) => (
                            <li key={idx}>• {advantage}</li>
                          ))}
                        </ul>
                      </div>
                      
                      <div>
                        <h5 className="text-sm font-medium text-yellow-700 mb-1">⚠️ Considerations:</h5>
                        <ul className="text-xs text-yellow-600 space-y-1">
                          {option.considerations.map((consideration, idx) => (
                            <li key={idx}>• {consideration}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Configuration Form */}
      {selectedType && (
        <div className="bg-gray-50 rounded-lg p-6 space-y-4">
          <h4 className="font-medium text-gray-900">Configure Domain Mapping</h4>
          
          {/* Source Domains */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Source Domain{sourceDomains.length > 1 ? 's' : ''}
            </label>
            
            {domainsLoading && (
              <div className="flex items-center space-x-2 text-gray-500 mb-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Loading domains...</span>
              </div>
            )}
            
            {domainsError && (
              <div className="flex items-center space-x-2 text-red-600 mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <AlertTriangle className="h-4 w-4" />
                <div className="text-sm">
                  <p className="font-medium">Unable to load domains</p>
                  <p>{domainsError}</p>
                  {domainsError.includes('Not authenticated') && (
                    <p className="mt-1 text-xs">
                      Please ensure you're logged in with a Google Workspace super admin account that has domain management permissions.
                    </p>
                  )}
                </div>
              </div>
            )}
            
            {sourceDomains.map((domain, index) => (
              <div key={index} className="flex items-center space-x-2 mb-2">
                <select
                  value={domain}
                  onChange={(e) => updateSourceDomain(index, e.target.value)}
                  disabled={domainsLoading || !!domainsError}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                >
                  <option value="">Select a domain...</option>
                  {domains.map((d) => (
                    <option key={d.domainName} value={d.domainName}>
                      {d.domainName} {d.isPrimary ? '(Primary)' : ''}
                    </option>
                  ))}
                </select>
                {sourceDomains.length > 1 && (
                  <button
                    onClick={() => removeSourceDomain(index)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            
            {selectedType === 'many-to-one' && (
              <button
                onClick={addSourceDomain}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                + Add another source domain
              </button>
            )}
          </div>

          {/* Target Domain(s) */}
          <div className="text-xs text-gray-500 mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
            <div>Current mapping type: <strong>{selectedType || 'none'}</strong></div>
            <div>Target domains count: <strong>{targetDomains.length}</strong></div>
            <div>Available domains: <strong>{domains.length}</strong></div>
            <div>Selected mapping prop: <strong>{selectedMapping?.type || 'none'}</strong></div>
            <div>Is one-to-many check: <strong>{(selectedType === 'one-to-many').toString()}</strong></div>
          </div>
          {selectedType === 'one-to-many' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Domains
              </label>
              {domainsLoading && (
                <div className="flex items-center space-x-2 text-gray-500 mb-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Loading domains...</span>
                </div>
              )}
              {targetDomains.map((domain, index) => (
                <div key={index} className="flex items-center space-x-2 mb-2">
                  <select
                    value={domain}
                    onChange={(e) => updateTargetDomain(index, e.target.value)}
                    disabled={domainsLoading || !!domainsError}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  >
                    <option value="">Select a domain...</option>
                    {domains.map((d) => (
                      <option key={d.domainName} value={d.domainName}>
                        {d.domainName} {d.isPrimary ? '(Primary)' : ''}
                      </option>
                    ))}
                  </select>
                  {targetDomains.length > 1 && (
                    <button
                      onClick={() => removeTargetDomain(index)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={addTargetDomain}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                + Add another target domain
              </button>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Domain
              </label>
              {domainsLoading && (
                <div className="flex items-center space-x-2 text-gray-500 mb-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Loading domains...</span>
                </div>
              )}
              <select
                value={targetDomain}
                onChange={(e) => setTargetDomain(e.target.value)}
                disabled={domainsLoading || !!domainsError}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              >
                <option value="">Select a domain...</option>
                {domains.map((d) => (
                  <option key={d.domainName} value={d.domainName}>
                    {d.domainName} {d.isPrimary ? '(Primary)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Alias Option */}
          {selectedType === 'one-to-one' && (
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={preserveAlias}
                onChange={(e) => setPreserveAlias(e.target.checked)}
                className="mr-2"
              />
              <label className="text-sm text-gray-700">
                Preserve source domain as alias
              </label>
            </div>
          )}

          {/* Conflict Resolution */}
          {selectedType === 'many-to-one' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Conflict Resolution Strategy
              </label>
              <select
                value={conflictResolution}
                onChange={(e) => setConflictResolution(e.target.value as 'prefix' | 'suffix' | 'manual')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="prefix">Add domain prefix (john.brandA@target.com)</option>
                <option value="suffix">Add domain suffix (john-brandA@target.com)</option>
                <option value="manual">Manual resolution during migration</option>
              </select>
            </div>
          )}

          {/* Distribution Rule */}
          {selectedType === 'one-to-many' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                User Distribution Strategy
              </label>
              <select
                value={distributionRule}
                onChange={(e) => setDistributionRule(e.target.value as 'department' | 'alphabetical' | 'custom')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="department">By Department/Role</option>
                <option value="alphabetical">Alphabetical Distribution</option>
                <option value="custom">Custom Assignment Rules</option>
              </select>
            </div>
          )}

          {/* Preview */}
          {canConfirm() && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h5 className="font-medium text-blue-900 mb-2">Mapping Preview:</h5>
              <div className="space-y-1 text-sm">
                {selectedType === 'one-to-many' ? (
                  // One-to-many preview
                  <div className="space-y-2">
                    {sourceDomains.filter(d => d.trim()).map((source, idx) => (
                      <div key={idx}>
                        <div className="flex items-center text-blue-800 font-mono">
                          <span>users@{source}</span>
                          <ArrowRight className="h-4 w-4 mx-2" />
                          <span>Multiple target domains</span>
                        </div>
                        <div className="ml-6 text-xs text-blue-600">
                          {targetDomains.filter(d => d.trim()).map((target, tidx) => (
                            <div key={tidx}>→ user@{target} ({distributionRule} rule)</div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  // Other mapping types preview
                  sourceDomains.filter(d => d.trim()).map((source, idx) => (
                    <div key={idx} className="flex items-center text-blue-800 font-mono">
                      <span>user@{source}</span>
                      <ArrowRight className="h-4 w-4 mx-2" />
                      <span>
                        {selectedType === 'many-to-one' && conflictResolution === 'prefix' 
                          ? `user.${source.split('.')[0]}@${targetDomain}`
                          : selectedType === 'many-to-one' && conflictResolution === 'suffix'
                          ? `user-${source.split('.')[0]}@${targetDomain}`
                          : `user@${targetDomain}`}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleConfirm}
              disabled={!canConfirm()}
              className={`px-6 py-2 rounded-md font-medium ${
                canConfirm()
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Confirm Domain Mapping
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
