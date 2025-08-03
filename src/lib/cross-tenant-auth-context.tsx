'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { multiAdminAuthManager, type AuthenticationSession } from '@/lib/multi-admin-auth-manager';

interface AdminTokens {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
  scope?: string;
  token_type?: string;
  stored_at: string;
  updated_at?: string;
  adminEmail?: string;
  role?: 'source' | 'target';
  sessionId?: string;
}

interface CrossTenantAuthContextType {
  // Session management
  currentSessionId: string | null;
  setCurrentSessionId: (sessionId: string | null) => void;
  
  // Authentication status
  isSourceAuthenticated: boolean;
  isTargetAuthenticated: boolean;
  isCrossTenantComplete: boolean;
  
  // Tokens
  sourceTokens: AdminTokens | null;
  targetTokens: AdminTokens | null;
  
  // Admin information
  sourceAdminEmail: string | null;
  targetAdminEmail: string | null;
  
  // Utility methods
  getSourceTokens: () => AdminTokens | null;
  getTargetTokens: () => AdminTokens | null;
  refreshTokens: () => void;
  clearSession: () => void;
  
  // Session data
  session: AuthenticationSession | null;
}

const CrossTenantAuthContext = createContext<CrossTenantAuthContextType | undefined>(undefined);

interface CrossTenantAuthProviderProps {
  children: ReactNode;
}

export function CrossTenantAuthProvider({ children }: CrossTenantAuthProviderProps) {
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<AuthenticationSession | null>(null);
  const [sourceTokens, setSourceTokens] = useState<AdminTokens | null>(null);
  const [targetTokens, setTargetTokens] = useState<AdminTokens | null>(null);

  // Update session data when sessionId changes
  useEffect(() => {
    if (!currentSessionId) {
      setSession(null);
      setSourceTokens(null);
      setTargetTokens(null);
      return;
    }

    const sessionData = multiAdminAuthManager.getSession(currentSessionId);
    setSession(sessionData);

    if (sessionData) {
      // Get tokens from the session
      const tokens = multiAdminAuthManager.getCrossTenantTokens(currentSessionId);
      setSourceTokens(tokens.sourceTokens);
      setTargetTokens(tokens.targetTokens);

      // Register for session updates
      const handleSessionUpdate = (updatedSession: AuthenticationSession) => {
        console.log('[CrossTenantAuth] Session update received:', updatedSession);
        setSession(updatedSession);
        
        // Update tokens
        const updatedTokens = multiAdminAuthManager.getCrossTenantTokens(currentSessionId);
        setSourceTokens(updatedTokens.sourceTokens);
        setTargetTokens(updatedTokens.targetTokens);
      };

      multiAdminAuthManager.registerCallback(currentSessionId, handleSessionUpdate);

      // Cleanup callback on unmount or sessionId change
      return () => {
        multiAdminAuthManager.unregisterCallback(currentSessionId, handleSessionUpdate);
      };
    }
  }, [currentSessionId]);

  // Computed values
  const isSourceAuthenticated = Boolean(sourceTokens && sourceTokens.access_token && session?.sourceCompleted);
  const isTargetAuthenticated = Boolean(targetTokens && targetTokens.access_token && session?.targetCompleted);
  const isCrossTenantComplete = isSourceAuthenticated && isTargetAuthenticated;

  const sourceAdminEmail = sourceTokens?.adminEmail || session?.sourceAdmin?.email || null;
  const targetAdminEmail = targetTokens?.adminEmail || session?.targetAdmin?.email || null;

  // Utility methods
  const getSourceTokens = (): AdminTokens | null => {
    if (!currentSessionId) return null;
    return multiAdminAuthManager.getTokensByRole(currentSessionId, 'source');
  };

  const getTargetTokens = (): AdminTokens | null => {
    if (!currentSessionId) return null;
    return multiAdminAuthManager.getTokensByRole(currentSessionId, 'target');
  };

  const refreshTokens = () => {
    if (!currentSessionId) return;
    const tokens = multiAdminAuthManager.getCrossTenantTokens(currentSessionId);
    setSourceTokens(tokens.sourceTokens);
    setTargetTokens(tokens.targetTokens);
  };

  const clearSession = () => {
    setCurrentSessionId(null);
    setSession(null);
    setSourceTokens(null);
    setTargetTokens(null);
  };

  const contextValue: CrossTenantAuthContextType = {
    currentSessionId,
    setCurrentSessionId,
    isSourceAuthenticated,
    isTargetAuthenticated,
    isCrossTenantComplete,
    sourceTokens,
    targetTokens,
    sourceAdminEmail,
    targetAdminEmail,
    getSourceTokens,
    getTargetTokens,
    refreshTokens,
    clearSession,
    session
  };

  return (
    <CrossTenantAuthContext.Provider value={contextValue}>
      {children}
    </CrossTenantAuthContext.Provider>
  );
}

export function useCrossTenantAuth() {
  const context = useContext(CrossTenantAuthContext);
  if (context === undefined) {
    throw new Error('useCrossTenantAuth must be used within a CrossTenantAuthProvider');
  }
  return context;
}

// Hook specifically for getting tokens with validation
export function useCrossTenantTokens() {
  const context = useCrossTenantAuth();
  
  const getValidSourceTokens = (): AdminTokens | null => {
    const tokens = context.getSourceTokens();
    if (!tokens) return null;
    
    // Check if token is expired
    if (tokens.expiry_date && Date.now() >= tokens.expiry_date) {
      console.warn('[CrossTenantAuth] Source token is expired');
      return null;
    }
    
    return tokens;
  };

  const getValidTargetTokens = (): AdminTokens | null => {
    const tokens = context.getTargetTokens();
    if (!tokens) return null;
    
    // Check if token is expired
    if (tokens.expiry_date && Date.now() >= tokens.expiry_date) {
      console.warn('[CrossTenantAuth] Target token is expired');
      return null;
    }
    
    return tokens;
  };

  return {
    ...context,
    getValidSourceTokens,
    getValidTargetTokens,
    hasValidSourceTokens: Boolean(getValidSourceTokens()),
    hasValidTargetTokens: Boolean(getValidTargetTokens()),
    hasValidTokens: Boolean(getValidSourceTokens() && getValidTargetTokens())
  };
}
