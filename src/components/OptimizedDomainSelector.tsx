'use client';

import React from 'react';
import { Globe, CheckCircle, XCircle, Clock, RefreshCw, Zap, AlertTriangle } from 'lucide-react';
import { useFastDomainLoader } from '@/hooks/useFastDomainLoader';

interface OptimizedDomainSelectorProps {
  onDomainSelect?: (domain: string) => void;
  selectedDomain?: string;
  className?: string;
  showMetrics?: boolean;
}

export function OptimizedDomainSelector({
  onDomainSelect,
  selectedDomain,
  className = '',
  showMetrics = false,
}: OptimizedDomainSelectorProps) {
  const {
    domains,
    loading,
    error,
    loadingStage,
    metrics,
    loadDomains,
    refresh,
  } = useFastDomainLoader({
    timeout: 15000,
    maxRetries: 2,
    enableMetrics: showMetrics,
  });

  // Auto-load domains on mount
  React.useEffect(() => {
    loadDomains();
  }, [loadDomains]);

  // Render loading state
  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <Globe className="absolute inset-0 m-auto h-4 w-4 text-blue-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">
              {loadingStage === 'connecting' && 'Connecting to Google Workspace...'}
              {loadingStage === 'fetching' && 'Fetching domain information...'}
            </p>
            <p className="text-xs text-gray-500">
              Enhanced loading with timeout protection
            </p>
          </div>
          {metrics && (
            <div className="text-xs text-gray-400">
              {Math.round((Date.now() - metrics.startTime) / 1000)}s
            </div>
          )}
        </div>
        
        {/* Progress indicators */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            {loadingStage === 'connecting' ? (
              <Clock className="h-4 w-4 text-yellow-500 animate-pulse" />
            ) : (
              <CheckCircle className="h-4 w-4 text-green-500" />
            )}
            <span className="text-xs text-gray-600">Establishing secure connection</span>
          </div>
          <div className="flex items-center space-x-2">
            {loadingStage === 'fetching' ? (
              <Clock className="h-4 w-4 text-yellow-500 animate-pulse" />
            ) : loadingStage === 'complete' ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <div className="h-4 w-4 rounded-full border border-gray-300" />
            )}
            <span className="text-xs text-gray-600">Loading domain data</span>
          </div>
        </div>

        {/* Performance hint */}
        <div className="flex items-center space-x-2 p-2 bg-blue-50 rounded-lg">
          <Zap className="h-4 w-4 text-blue-500" />
          <span className="text-xs text-blue-700">
            {metrics?.cacheHit 
              ? 'Loading from cache for faster performance'
              : 'First-time load with enhanced error handling'
            }
          </span>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center space-x-3">
          <XCircle className="h-8 w-8 text-red-500" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-900">Domain Loading Failed</p>
            <p className="text-xs text-red-600">{error}</p>
          </div>
        </div>
        
        {/* Error actions */}
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            Retry
          </button>
          
          <button 
            onClick={() => window.location.reload()}
            className="px-3 py-2 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Refresh Page
          </button>
        </div>

        {/* Troubleshooting tips */}
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
            <div>
              <h4 className="text-xs font-medium text-yellow-800">Troubleshooting Tips:</h4>
              <ul className="text-xs text-yellow-700 mt-1 space-y-1">
                <li>• Check your internet connection</li>
                <li>• Ensure you're signed in to Google Workspace</li>
                <li>• Verify you have domain administrator permissions</li>
                <li>• Try refreshing the page if the error persists</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Performance metrics for debugging */}
        {showMetrics && metrics && (
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <h4 className="text-xs font-medium text-gray-700 mb-2">Performance Details</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>Total Time: {metrics.totalTime}ms</div>
              <div>Retry Count: {metrics.retryCount}</div>
              {metrics.connectionTime && <div>Connection: {metrics.connectionTime}ms</div>}
              {metrics.fetchTime && <div>Fetch: {metrics.fetchTime}ms</div>}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Render success state with domains
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Success header with metrics */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <CheckCircle className="h-5 w-5 text-green-500" />
          <span className="text-sm font-medium text-gray-900">
            {domains.length} domain{domains.length !== 1 ? 's' : ''} loaded
          </span>
          {metrics && (
            <div className="flex items-center space-x-1 text-xs text-gray-500">
              <Zap className="h-3 w-3" />
              <span>{metrics.totalTime}ms</span>
              {metrics.cacheHit && <span>(cached)</span>}
            </div>
          )}
        </div>
        
        <button
          onClick={refresh}
          disabled={loading}
          className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
          title="Refresh domains"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Domain list */}
      <div className="space-y-2">
        {domains.map((domain) => (
          <div
            key={domain.domainName}
            onClick={() => onDomainSelect?.(domain.domainName)}
            className={`p-3 border rounded-lg cursor-pointer transition-all duration-200 ${
              selectedDomain === domain.domainName
                ? 'border-blue-500 bg-blue-50 shadow-sm'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Globe className={`h-4 w-4 ${
                  domain.isPrimary ? 'text-blue-600' : 'text-gray-500'
                }`} />
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-900">
                      {domain.domainName}
                    </span>
                    {domain.isPrimary && (
                      <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">
                        Primary
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-4 mt-1">
                    <span className={`text-xs ${
                      domain.verified ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {domain.verified ? '✓ Verified' : '✗ Not verified'}
                    </span>
                    <span className="text-xs text-gray-500">
                      Created: {new Date(domain.creationTime).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
              
              {selectedDomain === domain.domainName && (
                <CheckCircle className="h-5 w-5 text-blue-600" />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Performance metrics */}
      {showMetrics && metrics && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <h4 className="text-xs font-medium text-green-700 mb-2">Loading Performance</h4>
          <div className="grid grid-cols-3 gap-2 text-xs text-green-600">
            <div>Total: {metrics.totalTime}ms</div>
            <div>Source: {metrics.cacheHit ? 'Cache' : 'Network'}</div>
            <div>Retries: {metrics.retryCount}</div>
          </div>
        </div>
      )}
    </div>
  );
}
