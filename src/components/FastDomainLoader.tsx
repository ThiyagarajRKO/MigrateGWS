'use client';

import { useState, useEffect } from 'react';
import { Globe, CheckCircle, XCircle, Clock } from 'lucide-react';

interface Domain {
  domainName: string;
  isPrimary: boolean;
  verified: boolean;
  creationTime: string;
}

interface FastDomainLoaderProps {
  onDomainsLoaded?: (domains: Domain[]) => void;
  className?: string;
}

export default function FastDomainLoader({ onDomainsLoaded, className = '' }: FastDomainLoaderProps) {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingStage, setLoadingStage] = useState<'connecting' | 'fetching' | 'complete' | 'timeout'>('connecting');
  const [startTime, setStartTime] = useState<number>(Date.now());

  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;
    
    const loadDomains = async () => {
      try {
        setStartTime(Date.now());
        setLoadingStage('connecting');
        
        // Set a timeout for the entire operation
        timeoutId = setTimeout(() => {
          if (isMounted) {
            setLoadingStage('timeout');
            setError('Domain loading is taking longer than expected. Please check your connection.');
          }
        }, 20000); // 20 second total timeout
        
        // Shorter delay for better perceived performance
        await new Promise(resolve => setTimeout(resolve, 200));
        
        if (!isMounted) return;
        
        setLoadingStage('fetching');
        
        const controller = new AbortController();
        const fetchTimeout = setTimeout(() => controller.abort(), 15000); // 15 second fetch timeout
        
        const response = await fetch('/api/google-workspace?action=domains', {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          },
          signal: controller.signal
        });
        
        clearTimeout(fetchTimeout);
        
        if (!isMounted) return;
        
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch domains');
        }

        if (data.domains) {
          setDomains(data.domains);
          setLoadingStage('complete');
          onDomainsLoaded?.(data.domains);
        } else {
          throw new Error('No domains found in response');
        }
      } catch (err: any) {
        if (!isMounted) return;
        console.error('Error loading domains:', err);
        setError(err.message || 'Failed to load domains');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadDomains();

    return () => {
      isMounted = false;
    };
  }, [onDomainsLoaded]);

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <Globe className="absolute inset-0 m-auto h-4 w-4 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">
              {loadingStage === 'connecting' && 'Connecting to Google Workspace...'}
              {loadingStage === 'fetching' && 'Fetching domain information...'}
            </p>
            <p className="text-xs text-gray-500">This may take a few moments</p>
          </div>
        </div>
        
        {/* Progress indicators */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            {loadingStage === 'connecting' ? (
              <Clock className="h-4 w-4 text-yellow-500 animate-pulse" />
            ) : (
              <CheckCircle className="h-4 w-4 text-green-500" />
            )}
            <span className="text-xs text-gray-600">Establishing connection</span>
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
      </div>
    );
  }

  if (error) {
    return (
      <div className={`space-y-3 ${className}`}>
        <div className="flex items-center space-x-3">
          <XCircle className="h-8 w-8 text-red-500" />
          <div>
            <p className="text-sm font-medium text-red-900">Failed to load domains</p>
            <p className="text-xs text-red-600">{error}</p>
          </div>
        </div>
        <button 
          onClick={() => window.location.reload()}
          className="text-xs text-blue-600 hover:text-blue-700 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center space-x-3">
        <CheckCircle className="h-8 w-8 text-green-500" />
        <div>
          <p className="text-sm font-medium text-gray-900">
            {domains.length} domain{domains.length !== 1 ? 's' : ''} loaded
          </p>
          <p className="text-xs text-gray-500">Ready for migration configuration</p>
        </div>
      </div>
      
      <div className="space-y-2">
        {domains.slice(0, 3).map((domain, index) => (
          <div key={index} className="flex items-center space-x-2 text-xs">
            <div className={`h-2 w-2 rounded-full ${domain.isPrimary ? 'bg-blue-500' : 'bg-gray-400'}`} />
            <span className="text-gray-700">{domain.domainName}</span>
            {domain.isPrimary && <span className="text-blue-600 font-medium">Primary</span>}
            {domain.verified && <CheckCircle className="h-3 w-3 text-green-500" />}
          </div>
        ))}
        {domains.length > 3 && (
          <p className="text-xs text-gray-500">+ {domains.length - 3} more domains</p>
        )}
      </div>
    </div>
  );
}
