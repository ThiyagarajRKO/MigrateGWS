/**
 * Multi-Admin Authentication Manager
 * Adapted from successful MigrateOps backend implementation
 */

interface AdminTokens {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
  scope?: string;
  token_type?: string;
  stored_at: string;
  updated_at?: string;
  // Additional cross-tenant specific fields
  adminEmail?: string;
  role?: 'source' | 'target';
  sessionId?: string;
}

interface AdminInfo {
  email: string;
  domain: string;
  shortDomain: string;
  role: string;
  displayName?: string;
  notes?: string;
  lastUpdated: string;
  metadata?: Record<string, any>;
}

interface AuthenticationSession {
  sessionId: string;
  status: 'pending' | 'source-complete' | 'target-complete' | 'complete' | 'failed';
  sourceAdmin?: AdminInfo;
  targetAdmin?: AdminInfo;
  sourceCompleted: boolean;
  targetCompleted: boolean;
  sourceDomains?: string[];
  targetDomains?: string[];
  callbacks: ((session: AuthenticationSession) => void)[];
  createdAt: string;
  updatedAt: string;
  // Cross-tenant token tracking
  sourceTokens?: AdminTokens;
  targetTokens?: AdminTokens;
  scenario?: 'cross-tenant' | 'single-super-admin';
}

export class MultiAdminAuthManager {
  private static instance: MultiAdminAuthManager;
  private sessions: Map<string, AuthenticationSession> = new Map();
  private adminTokens: Map<string, AdminTokens> = new Map();
  private adminInfo: Map<string, AdminInfo> = new Map();

  private constructor() {
    this.loadFromStorage();
  }

  static getInstance(): MultiAdminAuthManager {
    if (!MultiAdminAuthManager.instance) {
      MultiAdminAuthManager.instance = new MultiAdminAuthManager();
    }
    return MultiAdminAuthManager.instance;
  }

  private loadFromStorage(): void {
    try {
      // Check if we're in a browser environment
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
        console.log('MultiAdminAuthManager: Server-side environment detected, skipping localStorage load');
        return;
      }

      // Load admin tokens from localStorage
      const tokensData = localStorage.getItem('gws-admin-tokens');
      if (tokensData) {
        const tokens = JSON.parse(tokensData);
        Object.entries(tokens).forEach(([email, tokenData]) => {
          this.adminTokens.set(email, tokenData as AdminTokens);
        });
      }

      // Load admin info from localStorage
      const adminData = localStorage.getItem('gws-admin-info');
      if (adminData) {
        const admins = JSON.parse(adminData);
        Object.entries(admins).forEach(([email, adminInfo]) => {
          this.adminInfo.set(email, adminInfo as AdminInfo);
        });
      }

      console.log('MultiAdminAuthManager: Loaded from storage', {
        tokens: this.adminTokens.size,
        admins: this.adminInfo.size
      });
    } catch (error) {
      console.error('Error loading admin data from storage:', error);
    }
  }

  private saveToStorage(): void {
    try {
      // Check if we're in a browser environment
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
        console.log('MultiAdminAuthManager: Server-side environment detected, skipping localStorage save');
        return;
      }

      // Save admin tokens
      const tokensObj = Object.fromEntries(this.adminTokens);
      localStorage.setItem('gws-admin-tokens', JSON.stringify(tokensObj));

      // Save admin info
      const adminObj = Object.fromEntries(this.adminInfo);
      localStorage.setItem('gws-admin-info', JSON.stringify(adminObj));

      console.log('MultiAdminAuthManager: Saved to storage');
    } catch (error) {
      console.error('Error saving admin data to storage:', error);
    }
  }

  createSession(sessionId: string, scenario?: 'cross-tenant' | 'single-super-admin'): AuthenticationSession {
    const session: AuthenticationSession = {
      sessionId,
      status: 'pending',
      sourceCompleted: false,
      targetCompleted: false,
      callbacks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      scenario
    };

    this.sessions.set(sessionId, session);
    console.log(`Created ${scenario || 'default'} authentication session:`, sessionId);
    return session;
  }

  getSession(sessionId: string): AuthenticationSession | null {
    return this.sessions.get(sessionId) || null;
  }

  registerCallback(sessionId: string, callback: (session: AuthenticationSession) => void): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.callbacks.push(callback);
    }
  }

  unregisterCallback(sessionId: string, callback?: (session: AuthenticationSession) => void): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      if (callback) {
        session.callbacks = session.callbacks.filter(cb => cb !== callback);
      } else {
        session.callbacks = [];
      }
    }
  }

  extractDomainInfo(adminEmail: string): { domain: string; shortDomain: string } {
    const domain = adminEmail.split('@')[1];
    return {
      domain,
      shortDomain: domain.split('.')[0]
    };
  }

  storeAdminTokens(adminEmail: string, tokens: Partial<AdminTokens>, role?: 'source' | 'target', sessionId?: string): void {
    const existingTokens = this.adminTokens.get(adminEmail);
    
    // Ensure we have required fields
    if (!tokens.access_token && !existingTokens?.access_token) {
      throw new Error('access_token is required');
    }

    const updatedTokens: AdminTokens = {
      access_token: tokens.access_token || existingTokens?.access_token || '',
      refresh_token: tokens.refresh_token || existingTokens?.refresh_token,
      expiry_date: tokens.expiry_date || existingTokens?.expiry_date,
      scope: tokens.scope || existingTokens?.scope,
      token_type: tokens.token_type || existingTokens?.token_type || 'Bearer',
      stored_at: existingTokens?.stored_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      adminEmail,
      role,
      sessionId
    };

    this.adminTokens.set(adminEmail, updatedTokens);
    
    // Store tokens in the session for cross-tenant scenarios
    if (sessionId && role) {
      const session = this.sessions.get(sessionId);
      if (session) {
        if (role === 'source') {
          session.sourceTokens = updatedTokens;
        } else if (role === 'target') {
          session.targetTokens = updatedTokens;
        }
        session.updatedAt = new Date().toISOString();
        this.sessions.set(sessionId, session);
      }
    }
    
    this.saveToStorage();

    console.log(`Stored ${role || 'admin'} tokens for:`, adminEmail);
  }

  getAdminTokens(adminEmail: string): AdminTokens | null {
    return this.adminTokens.get(adminEmail) || null;
  }

  // Get tokens by role for cross-tenant scenarios
  getTokensByRole(sessionId: string, role: 'source' | 'target'): AdminTokens | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    if (role === 'source') {
      return session.sourceTokens || null;
    } else if (role === 'target') {
      return session.targetTokens || null;
    }

    return null;
  }

  // Get all tokens for a cross-tenant session
  getCrossTenantTokens(sessionId: string): { sourceTokens: AdminTokens | null; targetTokens: AdminTokens | null } {
    const session = this.sessions.get(sessionId);
    return {
      sourceTokens: session?.sourceTokens || null,
      targetTokens: session?.targetTokens || null
    };
  }

  // Check if both source and target are authenticated
  isCrossTenantComplete(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    const hasSourceTokens = session.sourceTokens && session.sourceTokens.access_token;
    const hasTargetTokens = session.targetTokens && session.targetTokens.access_token;
    
    return Boolean(hasSourceTokens && hasTargetTokens && session.sourceCompleted && session.targetCompleted);
  }

  updateAdminInfo(adminEmail: string, info: Partial<AdminInfo>): AdminInfo {
    const domainInfo = this.extractDomainInfo(adminEmail);
    const existingInfo = this.adminInfo.get(adminEmail) || {};

    const updatedInfo: AdminInfo = {
      email: adminEmail,
      domain: domainInfo.domain,
      shortDomain: domainInfo.shortDomain,
      role: 'admin',
      displayName: adminEmail.split('@')[0],
      ...existingInfo,
      ...info,
      lastUpdated: new Date().toISOString()
    };

    this.adminInfo.set(adminEmail, updatedInfo);
    this.saveToStorage();

    console.log('Updated admin info for:', adminEmail);
    return updatedInfo;
  }

  getAdminInfo(adminEmail: string): AdminInfo | null {
    return this.adminInfo.get(adminEmail) || null;
  }

  validateAdminToken(adminEmail: string): { valid: boolean; reason?: string; tokens?: AdminTokens } {
    const tokens = this.getAdminTokens(adminEmail);

    if (!tokens) {
      return { valid: false, reason: 'No tokens found' };
    }

    if (tokens.expiry_date && Date.now() >= tokens.expiry_date) {
      return { valid: false, reason: 'Token expired' };
    }

    return { valid: true, tokens };
  }

  updateSourceAuth(sessionId: string, adminEmail: string, domains: string[]): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.error('Session not found:', sessionId);
      return false;
    }

    console.log('Updating source auth for session:', sessionId, { adminEmail, domains });

    // Update admin info
    const adminInfo = this.updateAdminInfo(adminEmail, {
      role: 'source_admin'
    });

    // Update session
    session.sourceAdmin = adminInfo;
    session.sourceDomains = domains;
    session.sourceCompleted = true;
    session.status = session.targetCompleted ? 'complete' : 'source-complete';
    session.updatedAt = new Date().toISOString();

    // Trigger callbacks
    session.callbacks.forEach(callback => {
      try {
        callback({ ...session });
      } catch (error) {
        console.error('Error in session callback:', error);
      }
    });

    console.log('Source auth updated. Session status:', session.status);
    return true;
  }

  updateTargetAuth(sessionId: string, adminEmail: string, domains: string[]): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.error('Session not found:', sessionId);
      return false;
    }

    console.log('Updating target auth for session:', sessionId, { adminEmail, domains });

    // Update admin info
    const adminInfo = this.updateAdminInfo(adminEmail, {
      role: 'target_admin'
    });

    // Update session
    session.targetAdmin = adminInfo;
    session.targetDomains = domains;
    session.targetCompleted = true;
    session.status = session.sourceCompleted ? 'complete' : 'target-complete';
    session.updatedAt = new Date().toISOString();

    // Trigger callbacks
    session.callbacks.forEach(callback => {
      try {
        callback({ ...session });
      } catch (error) {
        console.error('Error in session callback:', error);
      }
    });

    console.log('Target auth updated. Session status:', session.status);
    return true;
  }

  getAllAdmins(): Array<AdminInfo & { isAuthenticated: boolean; tokenValid: boolean }> {
    const admins: Array<AdminInfo & { isAuthenticated: boolean; tokenValid: boolean }> = [];
    
    // Get all admin emails from both tokens and info
    const allEmails = new Set([
      ...Array.from(this.adminTokens.keys()),
      ...Array.from(this.adminInfo.keys())
    ]);

    allEmails.forEach(email => {
      const adminInfo = this.getAdminInfo(email);
      const tokenValidation = this.validateAdminToken(email);

      if (adminInfo) {
        admins.push({
          ...adminInfo,
          isAuthenticated: !!this.getAdminTokens(email),
          tokenValid: tokenValidation.valid
        });
      }
    });

    return admins;
  }

  getDomainGroups(): Record<string, Array<AdminInfo & { isAuthenticated: boolean; tokenValid: boolean }>> {
    const allAdmins = this.getAllAdmins();
    const domainGroups: Record<string, Array<AdminInfo & { isAuthenticated: boolean; tokenValid: boolean }>> = {};

    allAdmins.forEach(admin => {
      if (!domainGroups[admin.domain]) {
        domainGroups[admin.domain] = [];
      }
      domainGroups[admin.domain].push(admin);
    });

    return domainGroups;
  }

  removeAdminAuth(adminEmail: string): void {
    this.adminTokens.delete(adminEmail);
    this.adminInfo.delete(adminEmail);
    this.saveToStorage();
    console.log('Removed admin authentication for:', adminEmail);
  }

  cleanup(sessionId: string): void {
    this.sessions.delete(sessionId);
    console.log('Cleaned up session:', sessionId);
  }

  // Enhanced method to handle OAuth callbacks with better error handling
  handleOAuthCallback(sessionIdParam: string, authType: 'source' | 'target', domains: string[], adminEmail?: string): {
    success: boolean;
    reason: string;
  } {
    console.log('Handling OAuth callback:', { sessionIdParam, authType, domains, adminEmail });

    // Extract base session ID (remove _source or _target suffix)
    const sessionId = sessionIdParam.replace(/_(source|target)$/, '');
    
    // Generate admin email if not provided
    const effectiveAdminEmail = adminEmail || `admin@${domains[0] || `${authType}.com`}`;
    
    try {
      if (authType === 'source') {
        const success = this.updateSourceAuth(sessionId, effectiveAdminEmail, domains);
        if (success) {
          return {
            success: true,
            reason: 'Source authentication updated successfully'
          };
        }
        return { success: false, reason: 'Failed to update source authentication' };
        
      } else if (authType === 'target') {
        const success = this.updateTargetAuth(sessionId, effectiveAdminEmail, domains);
        return {
          success: success,
          reason: success ? 'Target authentication updated successfully' : 'Failed to update target authentication'
        };
      }

      return { success: false, reason: 'Invalid auth type' };
    } catch (error) {
      console.error('Error in OAuth callback handling:', error);
      return { 
        success: false, 
        reason: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  getStatus(): {
    totalSessions: number;
    activeSessions: number;
    totalAdmins: number;
    authenticatedAdmins: number;
    domainCount: number;
  } {
    const allAdmins = this.getAllAdmins();
    const domainGroups = this.getDomainGroups();

    return {
      totalSessions: this.sessions.size,
      activeSessions: Array.from(this.sessions.values()).filter(s => s.status !== 'complete' && s.status !== 'failed').length,
      totalAdmins: allAdmins.length,
      authenticatedAdmins: allAdmins.filter(a => a.isAuthenticated).length,
      domainCount: Object.keys(domainGroups).length
    };
  }
}

// Export singleton instance
export const multiAdminAuthManager = MultiAdminAuthManager.getInstance();

// Export types
export type { AdminTokens, AdminInfo, AuthenticationSession };
