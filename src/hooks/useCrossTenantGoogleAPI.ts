'use client';

import { useCrossTenantTokens } from '@/lib/cross-tenant-auth-context';

interface GoogleAPIConfig {
  baseURL?: string;
  version?: string;
}

interface APICallOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  role?: 'source' | 'target';
}

export function useCrossTenantGoogleAPI(config: GoogleAPIConfig = {}) {
  const {
    getValidSourceTokens,
    getValidTargetTokens,
    hasValidSourceTokens,
    hasValidTargetTokens,
    hasValidTokens,
    sourceAdminEmail,
    targetAdminEmail,
    isCrossTenantComplete
  } = useCrossTenantTokens();

  const { baseURL = 'https://www.googleapis.com', version = 'v1' } = config;

  // Get authorization header for a specific role
  const getAuthHeader = (role: 'source' | 'target'): string | null => {
    const tokens = role === 'source' ? getValidSourceTokens() : getValidTargetTokens();
    if (!tokens) return null;
    
    return `Bearer ${tokens.access_token}`;
  };

  // Make authenticated API call
  const makeAPICall = async (
    endpoint: string,
    options: APICallOptions = {}
  ): Promise<Response> => {
    const { method = 'GET', headers = {}, body, role = 'source' } = options;

    const authHeader = getAuthHeader(role);
    if (!authHeader) {
      throw new Error(`No valid ${role} tokens available for API call`);
    }

    const url = endpoint.startsWith('http') ? endpoint : `${baseURL}${endpoint}`;

    const requestHeaders: Record<string, string> = {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
      ...headers
    };

    const requestConfig: RequestInit = {
      method,
      headers: requestHeaders
    };

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      requestConfig.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    console.log(`[CrossTenantAPI] Making ${method} request to:`, url, {
      role,
      adminEmail: role === 'source' ? sourceAdminEmail : targetAdminEmail
    });

    const response = await fetch(url, requestConfig);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[CrossTenantAPI] ${method} ${url} failed:`, response.status, errorText);
      throw new Error(`API call failed: ${response.status} ${response.statusText}`);
    }

    return response;
  };

  // Admin Directory API methods
  const adminDirectory = {
    // List users in domain
    listUsers: async (role: 'source' | 'target' = 'source', domain?: string) => {
      const currentDomain = domain || (role === 'source' ? sourceAdminEmail?.split('@')[1] : targetAdminEmail?.split('@')[1]);
      if (!currentDomain) throw new Error(`No domain available for ${role} admin`);

      const response = await makeAPICall(
        `/admin/directory/v1/users?domain=${currentDomain}&maxResults=500`,
        { role }
      );
      return response.json();
    },

    // Get user details
    getUser: async (userKey: string, role: 'source' | 'target' = 'source') => {
      const response = await makeAPICall(
        `/admin/directory/v1/users/${userKey}`,
        { role }
      );
      return response.json();
    },

    // Create user
    createUser: async (userData: any, role: 'source' | 'target' = 'target') => {
      const response = await makeAPICall(
        '/admin/directory/v1/users',
        { method: 'POST', body: userData, role }
      );
      return response.json();
    },

    // List domains
    listDomains: async (role: 'source' | 'target' = 'source') => {
      const response = await makeAPICall(
        '/admin/directory/v1/customer/my_customer/domains',
        { role }
      );
      return response.json();
    },

    // List groups
    listGroups: async (role: 'source' | 'target' = 'source', domain?: string) => {
      const currentDomain = domain || (role === 'source' ? sourceAdminEmail?.split('@')[1] : targetAdminEmail?.split('@')[1]);
      if (!currentDomain) throw new Error(`No domain available for ${role} admin`);

      const response = await makeAPICall(
        `/admin/directory/v1/groups?domain=${currentDomain}&maxResults=200`,
        { role }
      );
      return response.json();
    }
  };

  // Gmail API methods
  const gmail = {
    // Get user profile
    getProfile: async (userId: string = 'me', role: 'source' | 'target' = 'source') => {
      const response = await makeAPICall(
        `/gmail/v1/users/${userId}/profile`,
        { role }
      );
      return response.json();
    },

    // List messages
    listMessages: async (userId: string = 'me', role: 'source' | 'target' = 'source', query?: string) => {
      const queryParam = query ? `&q=${encodeURIComponent(query)}` : '';
      const response = await makeAPICall(
        `/gmail/v1/users/${userId}/messages?maxResults=100${queryParam}`,
        { role }
      );
      return response.json();
    }
  };

  // Drive API methods
  const drive = {
    // List files
    listFiles: async (role: 'source' | 'target' = 'source', pageSize: number = 100) => {
      const response = await makeAPICall(
        `/drive/v3/files?pageSize=${pageSize}&fields=files(id,name,mimeType,owners,createdTime,modifiedTime)`,
        { role }
      );
      return response.json();
    },

    // Get file metadata
    getFile: async (fileId: string, role: 'source' | 'target' = 'source') => {
      const response = await makeAPICall(
        `/drive/v3/files/${fileId}?fields=*`,
        { role }
      );
      return response.json();
    }
  };

  return {
    // Authentication status
    hasValidSourceTokens,
    hasValidTargetTokens,
    hasValidTokens,
    isCrossTenantComplete,
    sourceAdminEmail,
    targetAdminEmail,
    
    // Raw API methods
    makeAPICall,
    getAuthHeader,
    
    // Service-specific methods
    adminDirectory,
    gmail,
    drive,
    
    // Token information (for debugging)
    getSourceTokenInfo: () => getValidSourceTokens(),
    getTargetTokenInfo: () => getValidTargetTokens()
  };
}

// Hook for checking authentication requirements
export function useAuthenticationRequirements(scenario: string) {
  const { hasValidSourceTokens, hasValidTargetTokens, isCrossTenantComplete } = useCrossTenantTokens();

  const getRequirements = () => {
    switch (scenario) {
      case 'cross-tenant':
        return {
          requiresSourceAuth: true,
          requiresTargetAuth: true,
          isComplete: isCrossTenantComplete,
          missingAuth: [
            !hasValidSourceTokens && 'source',
            !hasValidTargetTokens && 'target'
          ].filter(Boolean)
        };
      case 'single-super-admin':
        return {
          requiresSourceAuth: true,
          requiresTargetAuth: false,
          isComplete: hasValidSourceTokens,
          missingAuth: !hasValidSourceTokens ? ['source'] : []
        };
      default:
        return {
          requiresSourceAuth: false,
          requiresTargetAuth: false,
          isComplete: true,
          missingAuth: []
        };
    }
  };

  return getRequirements();
}

// Hook to access tokens for external API calls
export function useCrossTenantTokenAccess() {
  const { getValidSourceTokens, getValidTargetTokens, sourceAdminEmail, targetAdminEmail } = useCrossTenantTokens();

  return {
    getSourceAccessToken: () => getValidSourceTokens()?.access_token || null,
    getTargetAccessToken: () => getValidTargetTokens()?.access_token || null,
    getSourceTokens: () => getValidSourceTokens(),
    getTargetTokens: () => getValidTargetTokens(),
    sourceAdminEmail,
    targetAdminEmail,
    // Helper to get token for a specific role
    getTokenForRole: (role: 'source' | 'target') => {
      const tokens = role === 'source' ? getValidSourceTokens() : getValidTargetTokens();
      return tokens?.access_token || null;
    }
  };
}
