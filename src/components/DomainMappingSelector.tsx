'use client';

import React from 'react';
import { useState, useEffect, memo } from 'react';
import { 
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  Info,
  Users,
  Building,
  GitBranch,
  Network,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { 
  DomainMappingType, 
  DomainMappingConfig, 
  DomainMappingOption, 
  DOMAIN_MAPPING_OPTIONS,
  getSupportedMappingTypes,
  MigrationScenario,
  TargetDomainConfig,
  getAvailableTargetDomains,
  getAvailableSourceDomains,
  validateNoDomainConflicts,
  isMultiTargetMapping,
  isMultiSourceMapping
} from '@/types/migration-scenarios';
import { useFastDomainLoader } from '@/hooks/useFastDomainLoader';
import { DomainLoadingStats } from './DomainLoadingStats';

interface DomainMappingSelectorProps {
  selectedScenario: MigrationScenario;
  selectedMapping: DomainMappingConfig | null;
  onMappingSelect: (mapping: DomainMappingConfig) => void;
  discoveredDomains?: string[];
}

export const DomainMappingSelector = memo(function DomainMappingSelector({ 
  selectedScenario, 
  selectedMapping, 
  onMappingSelect,
  discoveredDomains = []
}: DomainMappingSelectorProps) {
  const { domains, loading: domainsLoading, error: domainsError, loadDomains: refetchDomains, metrics } = useFastDomainLoader({
    timeout: 15000,
    maxRetries: 2,
    enableMetrics: true,
  });

  // Auto-load domains on mount
  useEffect(() => {
    refetchDomains();
  }, [refetchDomains]);
  
  const [selectedType, setSelectedType] = useState<DomainMappingType | null>(
    null // DISABLED: selectedMapping?.type || null - Force manual type selection
  );
  const [sourceDomains, setSourceDomains] = useState<string[]>(
    [''] // DISABLED: selectedMapping?.sourceDomains || [''] - Force manual domain selection
  );
  const [targetDomain, setTargetDomain] = useState(
    '' // DISABLED: selectedMapping?.targetDomain || '' - Force manual target selection
  );
  const [targetDomains, setTargetDomains] = useState<string[]>(() => {
    // DISABLED: Auto-population from selectedMapping - Force manual selection
    // if (selectedMapping?.targetDomains && selectedMapping.targetDomains.length > 0) {
    //   return selectedMapping.targetDomains;
    // }
    // if (selectedMapping?.multiTargetConfig && selectedMapping.multiTargetConfig.length > 0) {
    //   return selectedMapping.multiTargetConfig.map(config => config.domain);
    // }
    return [''] // Force empty for manual selection: selectedMapping?.type === 'one-to-many' ? ['', ''] : [''];
  });
  const [multiTargetConfig, setMultiTargetConfig] = useState<TargetDomainConfig[]>(() => {
    // DISABLED: Auto-population from selectedMapping - Force manual config
    // if (selectedMapping?.multiTargetConfig && selectedMapping.multiTargetConfig.length > 0) {
    //   return selectedMapping.multiTargetConfig;
    // }
    return [];
  });
  const [preserveAlias, setPreserveAlias] = useState(
    false // DISABLED: selectedMapping?.preserveSourceAsAlias || false - Force manual configuration
  );
  const [conflictResolution, setConflictResolution] = useState<'prefix' | 'suffix' | 'manual'>(
    'prefix' // DISABLED: selectedMapping?.conflictResolution || 'prefix' - Force manual configuration
  );
  const [hasAutoSelectedPrimary, setHasAutoSelectedPrimary] = useState(false);

  // Auto-select primary domain as source when domains are loaded - DISABLED FOR MANUAL MAPPING
  useEffect(() => {
    console.log('[DomainMappingSelector] Auto-select disabled for manual mapping:', {
      domainsLength: domains.length,
      selectedMapping: !!selectedMapping,
      hasAutoSelectedPrimary,
      selectedType,
      availableDomains: domains.map(d => ({ name: d.domainName, isPrimary: d.isPrimary }))
    });
    
    // DISABLED: Manual domain mapping required - users must explicitly select domains
    // if (domains.length > 0 && !selectedMapping && !hasAutoSelectedPrimary) {
    //   const primaryDomain = domains.find(domain => domain.isPrimary);
    //   if (primaryDomain) {
    //     console.log('[DomainMappingSelector] Auto-selecting primary domain:', {
    //       primaryDomainName: primaryDomain.domainName,
    //       selectedType
    //     });
    //     
    //     // Auto-select primary domain regardless of mapping type selection status
    //     // This ensures the primary domain is selected as soon as domains are loaded
    //     setSourceDomains([primaryDomain.domainName]);
    //     console.log('[DomainMappingSelector] Auto-selected primary domain as source:', primaryDomain.domainName);
    //     
    //     setHasAutoSelectedPrimary(true);
    //   } else {
    //     console.log('[DomainMappingSelector] No primary domain found in domains:', domains.map(d => ({ name: d.domainName, isPrimary: d.isPrimary })));
    //   }
    // }
  }, [domains, selectedMapping, hasAutoSelectedPrimary]); // Removed selectedType dependency since we want this to work without type selection

  // Sync state when selectedMapping prop changes - DISABLED FOR MANUAL MAPPING
  useEffect(() => {
    // DISABLED: Auto-population from selectedMapping prop - users must manually select all domains
    // if (selectedMapping) {
    //   setSelectedType(selectedMapping.type);
    //   setSourceDomains(selectedMapping.sourceDomains);
    //   setTargetDomain(selectedMapping.targetDomain || '');
    //   
    //   // Handle target domains array properly
    //   if (selectedMapping.targetDomains && selectedMapping.targetDomains.length > 0) {
    //     setTargetDomains(selectedMapping.targetDomains);
    //   } else if (selectedMapping.multiTargetConfig && selectedMapping.multiTargetConfig.length > 0) {
    //     setTargetDomains(selectedMapping.multiTargetConfig.map(config => config.domain));
    //   } else {
    //     setTargetDomains(selectedMapping.type === 'one-to-many' ? ['', ''] : ['']);
    //   }
    //   
    //   setMultiTargetConfig(selectedMapping.multiTargetConfig || []);
    //   setPreserveAlias(selectedMapping.preserveSourceAsAlias || false);
    //   setConflictResolution(selectedMapping.conflictResolution || 'prefix');
    // }
    
    console.log('[DomainMappingSelector] selectedMapping sync disabled for manual domain selection');
  }, [selectedMapping]);

  const supportedMappings = getSupportedMappingTypes(selectedScenario);

  const getIcon = (type: DomainMappingType) => {
    switch (type) {
      case 'one-to-one': return Users;
      case 'one-to-many': return Building;
      case 'many-to-one': return GitBranch;
      case 'cross-tenant-single': return Network;
      case 'cross-tenant-multi-target': return Network;
      case 'cross-tenant-multi-source': return Network;
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
    console.log('[DomainMappingSelector] handleTypeSelect called:', { 
      optionType: option.type, 
      currentSourceDomains: sourceDomains,
      availableDomains: domains.map(d => d.domainName),
      primaryDomain: domains.find(d => d.isPrimary)?.domainName 
    });
    
    setSelectedType(option.type);
    
    // DISABLED: Primary domain auto-selection - manual selection required
    // No primary domain logic - all domains start empty for manual selection
    
    if (isMultiSourceMapping(option.type)) {
      // For multi-source mappings, start with empty domains for manual selection
      setSourceDomains(['', '']); // Start with empty domains
      console.log('[DomainMappingSelector] Set multi-source domains (manual):', ['', '']);
    } else {
      // For single source mappings, start with empty domain for manual selection  
      setSourceDomains(['']);
      console.log('[DomainMappingSelector] Set single source domain (manual):', ['']);
    }
    
    if (isMultiTargetMapping(option.type)) {
      setTargetDomains(['', '']); // Start with 2 target domains for multi-target mappings
      setMultiTargetConfig([]); // Reset multi-target config
    } else {
      setTargetDomains(['']); // Single target for other types
      setMultiTargetConfig([]); // Reset multi-target config
    }
    
    // DISABLED: Auto-selection flag setting - manual selection only
    // if (primaryDomainName) {
    //   setHasAutoSelectedPrimary(true);
    // }
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
    if (!selectedType) return;
    
    const validSourceDomains = sourceDomains.filter(d => d.trim());
    if (validSourceDomains.length === 0) return;
    
    // For single super admin, don't validate target domains
    if (selectedScenario === 'single-super-admin') {
      const selectedOption = DOMAIN_MAPPING_OPTIONS.find(opt => opt.type === selectedType);
      if (!selectedOption) return;

      const config: DomainMappingConfig = {
        type: selectedType,
        sourceDomains: validSourceDomains,
        targetDomain: '', // Not used in single super admin
        targetDomains: validSourceDomains, // Use same domains as both source and target
        preserveSourceAsAlias: preserveAlias,
        description: `Single Super Admin Migration: ${validSourceDomains.join(', ')}`
      };

      onMappingSelect(config);
      return;
    }
    
    // For cross-tenant scenarios, validate target domains
    const isOneToMany = selectedType === 'one-to-many';
    const effectiveTargetDomains = isOneToMany ? targetDomains.filter(d => d.trim()) : [];
    const effectiveTargetDomain = isOneToMany ? '' : targetDomain.trim();
    
    if (isOneToMany && effectiveTargetDomains.length === 0 && multiTargetConfig.length === 0) {
      return;
    }
    
    if (!isOneToMany && !effectiveTargetDomain) {
      return;
    }

    const selectedOption = DOMAIN_MAPPING_OPTIONS.find(opt => opt.type === selectedType);
    if (!selectedOption) return;

    const config: DomainMappingConfig = {
      type: selectedType,
      sourceDomains: validSourceDomains,
      targetDomain: effectiveTargetDomain,
      targetDomains: isOneToMany ? effectiveTargetDomains : undefined,
      multiTargetConfig: isOneToMany && multiTargetConfig.length > 0 ? multiTargetConfig : undefined,
      preserveSourceAsAlias: preserveAlias,
      conflictResolution: selectedOption.requiresConflictHandling ? conflictResolution : undefined,
      description: selectedOption.description
    };

    onMappingSelect(config);
  };

  const canConfirm = () => {
    if (!selectedType) return false;
    
    // For single super admin, only need selected domains
    if (selectedScenario === 'single-super-admin') {
      const validSourceDomains = sourceDomains.filter(d => d.trim() !== '');
      return validSourceDomains.length > 0;
    }
    
    // For cross-tenant, validate source domains
    if (sourceDomains.some(d => !d.trim())) return false;
    
    // Multi-source validation: require more than 1 source domain
    if (isMultiSourceMapping(selectedType)) {
      const validSourceDomains = sourceDomains.filter(d => d.trim() !== '');
      if (validSourceDomains.length < 2) return false;
    }
    
    // Check for domain conflicts (source domains cannot be target domains) - only for cross-tenant
    const allTargetDomains = selectedType === 'one-to-many' 
      ? (multiTargetConfig.length > 0 
          ? multiTargetConfig.map(config => config.domain) 
          : targetDomains)
      : [targetDomain];
    
    const { isValid } = validateNoDomainConflicts(sourceDomains, allTargetDomains);
    if (!isValid) return false;
    
    // Multi-target validation
    if (isMultiTargetMapping(selectedType)) {
      // Check if using multi-target config or target domains
      if (multiTargetConfig.length > 0) {
        const validTargetConfigs = multiTargetConfig.filter(config => config.domain.trim() !== '');
        return validTargetConfigs.length >= 2 && multiTargetConfig.every(config => config.domain.trim() !== '');
      } else {
        const validTargetDomains = targetDomains.filter(d => d.trim() !== '');
        return validTargetDomains.length >= 2;
      }
    } else {
      return targetDomain.trim() !== '';
    }
  };

  // Get available domains for source selection (excluding already selected targets)
  const getAvailableSourceDomainsForIndex = (currentIndex: number) => {
    const allTargetDomains = selectedType === 'one-to-many' 
      ? (multiTargetConfig.length > 0 
          ? multiTargetConfig.map(config => config.domain) 
          : targetDomains)
      : [targetDomain].filter(d => d.trim() !== ''); // Filter out empty target domain
    
    const otherSourceDomains = sourceDomains.filter((_, idx) => idx !== currentIndex);
    const validTargetDomains = allTargetDomains.filter(d => d.trim() !== '');
    const availableDomains = getAvailableSourceDomains(domains, validTargetDomains, otherSourceDomains);
    
    // Debug logging
    console.log('[DomainMappingSelector] Source domain filtering for index', currentIndex, {
      allDomains: domains.map(d => d.domainName),
      validTargetDomains,
      otherSourceDomains,
      availableSourceDomains: availableDomains.map(d => d.domainName)
    });
    
    return availableDomains;
  };

  // Get available domains for target selection (excluding already selected sources)
  const getAvailableTargetDomainsForIndex = (currentIndex: number) => {
    const otherTargetDomains = targetDomains.filter((_, idx) => idx !== currentIndex);
    return getAvailableTargetDomains(domains, sourceDomains, otherTargetDomains);
  };

  // Get available domains for single target selection (excluding all selected sources)
  const getAvailableTargetDomainsForSingle = () => {
    const validSourceDomains = sourceDomains.filter(d => d.trim() !== '');
    const availableDomains = getAvailableTargetDomains(domains, validSourceDomains, []);
    
    // Debug logging
    console.log('[DomainMappingSelector] Target domain filtering:', {
      allDomains: domains.map(d => d.domainName),
      validSourceDomains,
      availableTargetDomains: availableDomains.map(d => d.domainName)
    });
    
    return availableDomains;
  };

  // Check for domain conflicts and show warning (not applicable for single super admin)
  const getDomainConflicts = () => {
    if (selectedScenario === 'single-super-admin') {
      return { isValid: true, conflicts: [] };
    }
    
    const allTargetDomains = selectedType === 'one-to-many' 
      ? (multiTargetConfig.length > 0 
          ? multiTargetConfig.map(config => config.domain) 
          : targetDomains)
      : [targetDomain];
    
    return validateNoDomainConflicts(sourceDomains, allTargetDomains);
  };

  const domainConflicts = getDomainConflicts();

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
          
          {/* Domain Conflict Warning */}
          {!domainConflicts.isValid && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 text-red-800">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-medium">Domain Conflict Detected:</span>
              </div>
              <p className="text-red-700 mt-1">
                The following domains are selected as both source and target: <strong>{domainConflicts.conflicts.join(', ')}</strong>
              </p>
              <p className="text-red-600 text-sm mt-1">
                Please choose different domains for source and target to avoid conflicts.
              </p>
            </div>
          )}
          
          {/* Domain Selection - Different UI for Single Super Admin */}
          {selectedScenario === 'single-super-admin' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Available Domains
              </label>
              <p className="text-sm text-gray-600 mb-4">
                Select the domains you have access to. In Single Super Admin mode, you can migrate users across all accessible domains.
              </p>
              
              {domainsLoading && (
                <div className="flex items-center justify-between space-x-2 text-gray-500 mb-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="flex items-center space-x-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Loading domains...</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {metrics ? `Loaded in ${metrics.totalTime}ms${metrics.cacheHit ? ' (cached)' : ''}` : 'Loading...'}
                  </div>
                </div>
              )}
              
              {domainsError && (
                <div className="flex items-center justify-between space-x-2 text-red-600 mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
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
                  <button
                    onClick={() => refetchDomains()}
                    disabled={domainsLoading}
                    className="flex items-center space-x-1 px-3 py-1 text-sm bg-red-100 hover:bg-red-200 rounded-md transition-colors disabled:opacity-50"
                    title="Retry loading domains"
                  >
                    <RefreshCw className={`h-3 w-3 ${domainsLoading ? 'animate-spin' : ''}`} />
                    <span>Retry</span>
                  </button>
                </div>
              )}
              
              <div className="space-y-2">
                {domains.map((domain, index) => (
                  <div key={domain.domainName} className="flex items-center p-3 border rounded-lg hover:bg-gray-50">
                    <input
                      type="checkbox"
                      id={`domain-${index}`}
                      checked={sourceDomains.includes(domain.domainName)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSourceDomains([...sourceDomains.filter(d => d !== ''), domain.domainName]);
                        } else {
                          setSourceDomains(sourceDomains.filter(d => d !== domain.domainName));
                        }
                      }}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor={`domain-${index}`} className="ml-3 flex-1 cursor-pointer">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-900 font-medium">{domain.domainName}</span>
                        <div className="flex items-center space-x-2">
                          {domain.isPrimary && (
                            <span className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-full">
                              Primary
                            </span>
                          )}
                          <span className="text-xs text-gray-500">
                            {domain.verified ? 'Verified' : 'Unverified'}
                          </span>
                        </div>
                      </div>
                    </label>
                  </div>
                ))}
                
                {domains.length === 0 && !domainsLoading && !domainsError && (
                  <div className="text-center p-6 text-gray-500">
                    <Building className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p>No domains found</p>
                    <p className="text-sm">Make sure you have access to Google Workspace domains</p>
                  </div>
                )}
              </div>
              
              {sourceDomains.filter(d => d.trim()).length > 0 && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center space-x-2 text-green-800">
                    <CheckCircle className="h-4 w-4" />
                    <span className="font-medium">Selected Domains:</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {sourceDomains.filter(d => d.trim()).map((domain) => (
                      <span key={domain} className="px-2 py-1 text-sm bg-green-100 text-green-800 rounded-md">
                        {domain}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Regular Source Domains for Cross-Tenant */
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Source Domain{sourceDomains.length > 1 ? 's' : ''}
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Manual selection required - domains are no longer auto-selected
              </p>
              
              {domainsLoading && (
                <div className="flex items-center justify-between space-x-2 text-gray-500 mb-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="flex items-center space-x-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Loading domains...</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {metrics ? `Loaded in ${metrics.totalTime}ms${metrics.cacheHit ? ' (cached)' : ''}` : 'Loading...'}
                  </div>
                </div>
              )}
              
              {domainsError && (
                <div className="flex items-center justify-between space-x-2 text-red-600 mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
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
                  <button
                    onClick={() => refetchDomains()}
                    disabled={domainsLoading}
                    className="flex items-center space-x-1 px-3 py-1 text-sm bg-red-100 hover:bg-red-200 rounded-md transition-colors disabled:opacity-50"
                    title="Retry loading domains"
                  >
                    <RefreshCw className={`h-3 w-3 ${domainsLoading ? 'animate-spin' : ''}`} />
                    <span>Retry</span>
                  </button>
                </div>
              )}
              
              {sourceDomains.map((domain, index) => (
                <div key={index} className="flex items-center space-x-2 mb-2">
                  <div className="flex-1">
                    <select
                      value={domain}
                      onChange={(e) => updateSourceDomain(index, e.target.value)}
                      disabled={domainsLoading || !!domainsError}
                      required
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 ${
                        domain === '' 
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                          : 'border-green-300 focus:border-green-500 focus:ring-green-500'
                      }`}
                    >
                      <option value="">Select a domain...</option>
                      {getAvailableSourceDomainsForIndex(index).map((d) => (
                        <option key={d.domainName} value={d.domainName}>
                          {d.domainName} {d.isPrimary ? '(Primary)' : ''}
                        </option>
                      ))}
                    </select>
                    {domain === '' && (
                      <p className="text-xs text-red-600 mt-1">Please select a source domain</p>
                    )}
                  </div>
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
              
              {isMultiSourceMapping(selectedType) && (
                <button
                  onClick={addSourceDomain}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  + Add another source domain
                </button>
              )}
              
              {/* Multi-source validation message */}
              {isMultiSourceMapping(selectedType) && (
                <div className="mt-2">
                  {(() => {
                    const validSourceDomains = sourceDomains.filter(d => d.trim() !== '');
                    if (validSourceDomains.length < 2) {
                      return (
                        <div className="flex items-center space-x-2 text-amber-600 p-2 bg-amber-50 border border-amber-200 rounded-md">
                          <Info className="h-4 w-4" />
                          <p className="text-sm">
                            This migration type requires at least 2 source domains. Please add more domains.
                          </p>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              )}
            </div>
          )}

          {/* Target Domain(s) - Hidden for Single Super Admin */}
          {selectedScenario !== 'single-super-admin' && (
            selectedType === 'one-to-many' ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700">
                    Target Domains Configuration
                  </label>
                </div>
                
                {/* Target Domain Selection */}
                <div>
                    {domainsLoading && (
                      <div className="flex items-center space-x-2 text-gray-500 mb-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Loading domains...</span>
                      </div>
                    )}
                    
                    {targetDomains.map((domain, index) => (
                      <div key={index} className="flex items-center space-x-2 mb-2">
                        <div className="flex-1">
                          <select
                            value={domain}
                            onChange={(e) => updateTargetDomain(index, e.target.value)}
                            disabled={domainsLoading || !!domainsError}
                            required
                            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 ${
                              domain === '' 
                                ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                                : 'border-green-300 focus:border-green-500 focus:ring-green-500'
                            }`}
                          >
                            <option value="">Select a domain...</option>
                            {getAvailableTargetDomainsForIndex(index).map((d) => (
                              <option key={d.domainName} value={d.domainName}>
                                {d.domainName} {d.isPrimary ? '(Primary)' : ''}
                              </option>
                            ))}
                          </select>
                          {domain === '' && (
                            <p className="text-xs text-red-600 mt-1">Please select a target domain</p>
                          )}
                        </div>
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
                    
                    {/* Multi-target validation message */}
                    {isMultiTargetMapping(selectedType) && (
                      <div className="mt-2">
                        {(() => {
                          const validTargetDomains = targetDomains.filter(d => d.trim() !== '');
                          if (validTargetDomains.length < 2) {
                            return (
                              <div className="flex items-center space-x-2 text-amber-600 p-2 bg-amber-50 border border-amber-200 rounded-md">
                                <Info className="h-4 w-4" />
                                <p className="text-sm">
                                  This migration type requires at least 2 target domains. Please add more domains.
                                </p>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    )}
                  </div>
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
                  required
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 ${
                    targetDomain === '' 
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                      : 'border-green-300 focus:border-green-500 focus:ring-green-500'
                  }`}
                >
                  <option value="">Select a domain...</option>
                  {getAvailableTargetDomainsForSingle().map((d) => (
                    <option key={d.domainName} value={d.domainName}>
                      {d.domainName} {d.isPrimary ? '(Primary)' : ''}
                    </option>
                  ))}
                </select>
                {targetDomain === '' && (
                  <p className="text-xs text-red-600 mt-1">Please select a target domain</p>
                )}
              </div>
            )
          )}

          {/* Alias Option - Hidden for Single Super Admin */}
          {selectedScenario !== 'single-super-admin' && selectedType === 'one-to-one' && (
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

          {/* Conflict Resolution - Hidden for Single Super Admin */}
          {selectedScenario !== 'single-super-admin' && selectedType === 'many-to-one' && (
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

          {/* Preview */}
          {canConfirm() && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h5 className="font-medium text-blue-900 mb-2">
                {selectedScenario === 'single-super-admin' ? 'Domain Access Preview:' : 'Mapping Preview:'}
              </h5>
              <div className="space-y-1 text-sm">
                {selectedScenario === 'single-super-admin' ? (
                  // Single Super Admin preview - show accessible domains
                  <div className="space-y-2">
                    <div className="text-blue-800">
                      <span className="font-medium">Available Domains for Migration:</span>
                    </div>
                    <div className="ml-4 space-y-1">
                      {sourceDomains.filter(d => d.trim()).map((domain, idx) => (
                        <div key={idx} className="flex items-center text-blue-700 font-mono">
                          <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                          <span>{domain}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 text-xs text-blue-600">
                      Users can be migrated between any of these domains or within the same domain.
                    </div>
                  </div>
                ) : selectedType === 'one-to-many' ? (
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
                            <div key={tidx}>-&gt; user@{target}</div>
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
});

DomainMappingSelector.displayName = 'DomainMappingSelector';

export default DomainMappingSelector;
