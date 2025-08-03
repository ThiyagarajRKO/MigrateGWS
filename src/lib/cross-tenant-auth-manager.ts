/**
 * Cross-Tenant Authentication Manager
 * Similar to MigrateOps backend routes logic for handling sequential cross-tenant authentication
 */

export interface AuthenticationSession {
  sessionId: string;
  sourceCompleted: boolean;
  targetCompleted: boolean;
  sourceTokens?: any;
  targetTokens?: any;
  sourceDomains?: string[];
  targetDomains?: string[];
  status: 'pending' | 'source-complete' | 'target-complete' | 'complete' | 'error';
  error?: string;
}

class CrossTenantAuthManager {
  private sessions: Map<string, AuthenticationSession> = new Map();
  private callbacks: Map<string, (session: AuthenticationSession) => void> = new Map();

  createSession(sessionId: string): AuthenticationSession {
    const session: AuthenticationSession = {
      sessionId,
      sourceCompleted: false,
      targetCompleted: false,
      status: 'pending'
    };
    
    this.sessions.set(sessionId, session);
    console.log(`[AuthManager] Created session: ${sessionId}`);
    return session;
  }

  getSession(sessionId: string): AuthenticationSession | undefined {
    return this.sessions.get(sessionId);
  }

  updateSourceAuth(sessionId: string, domains: string[], tokens?: any): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.error(`[AuthManager] Session not found: ${sessionId}`);
      return false;
    }

    session.sourceCompleted = true;
    session.sourceDomains = domains;
    session.sourceTokens = tokens;
    session.status = 'source-complete';

    console.log(`[AuthManager] Source auth completed for session: ${sessionId}`, { domains });
    this.notifyCallback(sessionId, session);
    
    return true;
  }

  updateTargetAuth(sessionId: string, domains: string[], tokens?: any): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.error(`[AuthManager] Session not found: ${sessionId}`);
      return false;
    }

    session.targetCompleted = true;
    session.targetDomains = domains;
    session.targetTokens = tokens;
    session.status = 'complete';

    console.log(`[AuthManager] Target auth completed for session: ${sessionId}`, { domains });
    this.notifyCallback(sessionId, session);
    
    return true;
  }

  registerCallback(sessionId: string, callback: (session: AuthenticationSession) => void): void {
    this.callbacks.set(sessionId, callback);
    console.log(`[AuthManager] Registered callback for session: ${sessionId}`);
  }

  unregisterCallback(sessionId: string): void {
    this.callbacks.delete(sessionId);
    console.log(`[AuthManager] Unregistered callback for session: ${sessionId}`);
  }

  private notifyCallback(sessionId: string, session: AuthenticationSession): void {
    const callback = this.callbacks.get(sessionId);
    if (callback) {
      try {
        callback(session);
      } catch (error) {
        console.error(`[AuthManager] Error in callback for session ${sessionId}:`, error);
      }
    }
  }

  isComplete(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    return session?.status === 'complete' || false;
  }

  shouldTriggerTarget(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    return session?.status === 'source-complete' || false;
  }

  cleanup(sessionId: string): void {
    this.sessions.delete(sessionId);
    this.callbacks.delete(sessionId);
    console.log(`[AuthManager] Cleaned up session: ${sessionId}`);
  }
}

// Singleton instance
export const crossTenantAuthManager = new CrossTenantAuthManager();
