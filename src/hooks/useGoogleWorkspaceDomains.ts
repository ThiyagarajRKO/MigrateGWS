'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';

export interface Domain {
  domainName: string;
  isPrimary: boolean;
  verified: boolean;
  creationTime: string;
  aliases?: string[];
}

export function useDomains() {
  const { user } = useAuth();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDomains = async () => {
    if (!user) {
      setError('User not authenticated');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/google-workspace?action=domains', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch domains');
      }

      if (data.domains) {
        setDomains(data.domains);
      } else {
        setError('No domains found in response');
      }
    } catch (err: any) {
      console.error('Error fetching domains:', err);
      setError(err.message || 'Failed to fetch domains');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchDomains();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return {
    domains,
    loading,
    error,
    refetch: fetchDomains
  };
}

export function useUsers(domain?: string) {
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async (targetDomain?: string) => {
    if (!user) {
      setError('User not authenticated');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const url = targetDomain 
        ? `/api/google-workspace?action=users&domain=${encodeURIComponent(targetDomain)}`
        : '/api/google-workspace?action=users';
      
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch users');
      }

      if (data.users) {
        setUsers(data.users);
      } else {
        setError('No users found in response');
      }
    } catch (err: any) {
      console.error('Error fetching users:', err);
      setError(err.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && domain) {
      fetchUsers(domain);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, domain]);

  return {
    users,
    loading,
    error,
    refetch: fetchUsers
  };
}
