import { useCallback } from 'react';
import { useVerificationToken } from './useVerificationToken';
import { generateVerificationToken } from '@/lib/verification-token';

export interface UseVerificationTokenGeneratorOptions {
  /** Enable debug logging */
  debug?: boolean;
  /** Component name for debug logging */
  componentName?: string;
  /** Session storage key */
  storageKey?: string;
}

export interface UseVerificationTokenGeneratorReturn {
  /** Current token from storage or prop */
  token: string | null;
  /** Whether a token is available */
  hasToken: boolean;
  /** Source of the token */
  tokenSource: 'prop' | 'storage' | 'none';
  /** Generate and store a new verification token */
  generateAndStoreToken: (
    domains: string[],
    adminEmails: Record<string, string>,
    migrationScenario: 'single-super-admin' | 'cross-tenant',
    delegationStatus: { source: { verified: boolean }; dest: { verified: boolean } }
  ) => string | null;
  /** Clear token from storage */
  clearToken: () => void;
  /** Store an existing token */
  storeToken: (token: string) => void;
}

/**
 * Custom hook for generating and managing verification tokens in delegation setup
 * 
 * @param options Configuration options
 * @returns Token generation and management interface
 */
export function useVerificationTokenGenerator(
  options: UseVerificationTokenGeneratorOptions = {}
): UseVerificationTokenGeneratorReturn {
  const {
    debug = false,
    componentName = 'TokenGenerator',
    storageKey = 'dwd_verification_token'
  } = options;

  const {
    token,
    hasToken,
    tokenSource,
    storeToken,
    clearToken
  } = useVerificationToken({
    storageKey,
    debug,
    componentName
  });

  const generateAndStoreToken = useCallback((
    domains: string[],
    adminEmails: Record<string, string>,
    migrationScenario: 'single-super-admin' | 'cross-tenant',
    delegationStatus: { source: { verified: boolean }; dest: { verified: boolean } }
  ): string | null => {
    try {
      // Validate that delegation is verified
      const isVerified = migrationScenario === 'single-super-admin' 
        ? delegationStatus.source.verified && delegationStatus.dest.verified
        : delegationStatus.source.verified && delegationStatus.dest.verified;

      if (!isVerified) {
        if (debug) {
          console.log(`[useVerificationTokenGenerator:${componentName}] Skipping token generation - delegation not verified:`, {
            sourceVerified: delegationStatus.source.verified,
            destVerified: delegationStatus.dest.verified,
            scenario: migrationScenario
          });
        }
        // Clear any existing token when delegation is not verified
        clearToken();
        return null;
      }

      // Generate new verification token
      const newToken = generateVerificationToken(
        domains,
        adminEmails,
        migrationScenario,
        delegationStatus
      );

      // Store the token
      storeToken(newToken);

      if (debug) {
        console.log(`[useVerificationTokenGenerator:${componentName}] Generated and stored verification token:`, {
          tokenLength: newToken.length,
          verifiedDomains: domains.length,
          adminEmailsCount: Object.keys(adminEmails).length,
          scenario: migrationScenario,
          sourceVerified: delegationStatus.source.verified,
          destVerified: delegationStatus.dest.verified
        });
      }

      return newToken;
    } catch (error) {
      if (debug) {
        console.error(`[useVerificationTokenGenerator:${componentName}] Failed to generate verification token:`, error);
      }
      return null;
    }
  }, [storeToken, clearToken, debug, componentName]);

  return {
    token,
    hasToken,
    tokenSource,
    generateAndStoreToken,
    clearToken,
    storeToken
  };
}
