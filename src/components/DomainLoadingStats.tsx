'use client';

import { useState, useEffect } from 'react';

interface PerformanceMetrics {
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'loading' | 'success' | 'error';
  error?: string;
}

interface DomainLoadingStatsProps {
  metrics: PerformanceMetrics;
  className?: string;
}

export function DomainLoadingStats({ metrics, className = '' }: DomainLoadingStatsProps) {
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    if (metrics.status === 'loading') {
      const interval = setInterval(() => {
        setCurrentTime(Date.now());
      }, 100);
      return () => clearInterval(interval);
    }
  }, [metrics.status]);

  if (metrics.status === 'loading') {
    const elapsed = ((currentTime - metrics.startTime) / 1000).toFixed(1);
    return (
      <div className={`text-xs text-gray-500 animate-pulse ${className}`}>
        Loading domains... ({elapsed}s)
      </div>
    );
  }

  const durationText = metrics.duration ? `${(metrics.duration / 1000).toFixed(1)}s` : 'N/A';
  
  return (
    <div className={`text-xs ${metrics.status === 'success' ? 'text-green-600' : 'text-red-600'} ${className}`}>
      {metrics.status === 'success' ? (
        <>✓ Domains loaded in {durationText}</>
      ) : (
        <>✗ Failed to load domains after {durationText}</>
      )}
    </div>
  );
}
