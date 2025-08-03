'use client';

import React from 'react';
import { 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Shield,
  User,
  Building,
  Key,
  RefreshCw
} from 'lucide-react';
import { useCrossTenantAuth } from '@/lib/cross-tenant-auth-context';
import { useAuthenticationRequirements } from '@/hooks/useCrossTenantGoogleAPI';

interface CrossTenantAuthStatusProps {
  scenario: string;
  className?: string;
}

export function CrossTenantAuthStatus({ scenario, className = '' }: CrossTenantAuthStatusProps) {
  const {
    isSourceAuthenticated,
    isTargetAuthenticated,
    isCrossTenantComplete,
    sourceAdminEmail,
    targetAdminEmail,
    sourceTokens,
    targetTokens,
    session,
    refreshTokens
  } = useCrossTenantAuth();

  const requirements = useAuthenticationRequirements(scenario);

  if (scenario !== 'cross-tenant') {
    return null;
  }

  const getTokenStatus = (tokens: any) => {
    if (!tokens) return { status: 'missing', color: 'text-red-500' };
    if (tokens.expiry_date && Date.now() >= tokens.expiry_date) {
      return { status: 'expired', color: 'text-orange-500' };
    }
    return { status: 'valid', color: 'text-green-500' };
  };

  const sourceTokenStatus = getTokenStatus(sourceTokens);
  const targetTokenStatus = getTokenStatus(targetTokens);

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <Shield className="h-5 w-5 text-blue-600" />
        <h3 className="text-lg font-semibold">Cross-Tenant Authentication Status</h3>
        <button
          onClick={refreshTokens}
          className="ml-auto p-1 hover:bg-gray-100 rounded"
          title="Refresh token status"
        >
          <RefreshCw className="h-4 w-4 text-gray-500" />
        </button>
      </div>

      <div className="space-y-4">
        {/* Overall Status */}
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          {isCrossTenantComplete ? (
            <>
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="font-medium text-green-700">Cross-Tenant Authentication Complete</p>
                <p className="text-sm text-green-600">Both source and target admins are authenticated</p>
              </div>
            </>
          ) : (
            <>
              <AlertCircle className="h-5 w-5 text-orange-500" />
              <div>
                <p className="font-medium text-orange-700">Authentication In Progress</p>
                <p className="text-sm text-orange-600">
                  {requirements.missingAuth.length > 0 
                    ? `Missing: ${requirements.missingAuth.join(', ')} authentication`
                    : 'Completing authentication setup...'
                  }
                </p>
              </div>
            </>
          )}
        </div>

        {/* Source Admin Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-blue-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-3">
              <Building className="h-4 w-4 text-blue-600" />
              <h4 className="font-medium text-blue-700">Source Admin</h4>
              {isSourceAuthenticated && <CheckCircle className="h-4 w-4 text-green-500" />}
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <User className="h-3 w-3 text-gray-400" />
                <span className="text-gray-600">Admin:</span>
                <span className={sourceAdminEmail ? 'text-gray-900 font-mono' : 'text-gray-400'}>
                  {sourceAdminEmail || 'Not authenticated'}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <Key className="h-3 w-3 text-gray-400" />
                <span className="text-gray-600">Token:</span>
                <span className={sourceTokenStatus.color}>
                  {sourceTokenStatus.status}
                </span>
              </div>

              {sourceTokens && (
                <div className="text-xs text-gray-500 mt-2">
                  <p>Expires: {sourceTokens.expiry_date ? new Date(sourceTokens.expiry_date).toLocaleString() : 'Never'}</p>
                  <p>Scope: {sourceTokens.scope || 'Default'}</p>
                </div>
              )}
            </div>
          </div>

          {/* Target Admin Status */}
          <div className="border border-purple-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-3">
              <Building className="h-4 w-4 text-purple-600" />
              <h4 className="font-medium text-purple-700">Target Admin</h4>
              {isTargetAuthenticated && <CheckCircle className="h-4 w-4 text-green-500" />}
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <User className="h-3 w-3 text-gray-400" />
                <span className="text-gray-600">Admin:</span>
                <span className={targetAdminEmail ? 'text-gray-900 font-mono' : 'text-gray-400'}>
                  {targetAdminEmail || 'Not authenticated'}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <Key className="h-3 w-3 text-gray-400" />
                <span className="text-gray-600">Token:</span>
                <span className={targetTokenStatus.color}>
                  {targetTokenStatus.status}
                </span>
              </div>

              {targetTokens && (
                <div className="text-xs text-gray-500 mt-2">
                  <p>Expires: {targetTokens.expiry_date ? new Date(targetTokens.expiry_date).toLocaleString() : 'Never'}</p>
                  <p>Scope: {targetTokens.scope || 'Default'}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Session Information */}
        {session && (
          <div className="border-t pt-3">
            <h5 className="font-medium text-gray-700 mb-2">Session Details</h5>
            <div className="text-xs text-gray-500 space-y-1">
              <p>Session ID: <span className="font-mono">{session.sessionId}</span></p>
              <p>Status: <span className="font-medium">{session.status}</span></p>
              <p>Created: {new Date(session.createdAt).toLocaleString()}</p>
              {session.updatedAt !== session.createdAt && (
                <p>Updated: {new Date(session.updatedAt).toLocaleString()}</p>
              )}
            </div>
          </div>
        )}

        {/* Migration Capabilities */}
        {isCrossTenantComplete && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <h5 className="font-medium text-green-700">Ready for Migration</h5>
            </div>
            <p className="text-sm text-green-600">
              Both source and target administrators are authenticated. You can now proceed with domain-wide delegation setup and migration configuration.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default CrossTenantAuthStatus;
