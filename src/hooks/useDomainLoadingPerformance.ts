'use client';

import { useState } from 'react';

interface PerformanceMetrics {
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'loading' | 'success' | 'error';
  error?: string;
}

export function useDomainLoadingPerformance() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    startTime: Date.now(),
    status: 'loading'
  });

  const markStart = () => {
    setMetrics({
      startTime: Date.now(),
      status: 'loading'
    });
  };

  const markSuccess = () => {
    const endTime = Date.now();
    setMetrics(prev => ({
      ...prev,
      endTime,
      duration: endTime - prev.startTime,
      status: 'success'
    }));
  };

  const markError = (error: string) => {
    const endTime = Date.now();
    setMetrics(prev => ({
      ...prev,
      endTime,
      duration: endTime - prev.startTime,
      status: 'error',
      error
    }));
  };

  return {
    metrics,
    markStart,
    markSuccess,
    markError
  };
}
