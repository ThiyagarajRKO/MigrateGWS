/**
 * Example Component: COOP-Safe OAuth Authentication
 * 
 * This component demonstrates how to use the new COOP-safe popup management
 * system to handle OAuth authentication without Cross-Origin-Opener-Policy errors.
 */

'use client';

import React, { useState, useCallback } from 'react';
import { Shield, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { useOAuth } from '@/hooks/useOAuth';
import { createPopupManager } from '@/lib/popup-manager';

interface COOPSafeOAuthExampleProps {
  clientId?: string;
  redirectUri?: string;
  scope?: string;
}

export const COOPSafeOAuthExample: React.FC<COOPSafeOAuthExampleProps> = ({
  clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
  redirectUri = `${window.location.origin}/auth/callback`,
  scope = 'openid email profile'
}) => {
  const [manualResult, setManualResult] = useState<any>(null);
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualLoading, setManualLoading] = useState(false);

  // Example 1: Using the useOAuth hook (Recommended for React components)
  const oAuth = useOAuth({
    debug: true,
    onSuccess: (result) => {
      console.log('✅ OAuth Hook Success:', result);
    },
    onError: (error) => {
      console.error('❌ OAuth Hook Error:', error);
    }
  });

  // Example 2: Manual popup manager usage (For custom implementations)
  const authenticateManually = useCallback(async () => {
    setManualLoading(true);
    setManualError(null);
    setManualResult(null);

    try {
      const popupManager = createPopupManager();
      
      // Build OAuth URL
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: scope,
        response_type: 'code',
        access_type: 'offline',
        prompt: 'consent'
      });
      
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

      const result = await new Promise<any>((resolve, reject) => {
        popupManager.open(authUrl, {
          windowName: 'manual_oauth_example',
          windowFeatures: 'width=600,height=700,scrollbars=yes,resizable=yes',
          timeout: 300000,
          debug: true,
          onSuccess: (data) => {
            console.log('✅ Manual OAuth Success:', data);
            resolve(data);
          },
          onError: (error) => {
            console.error('❌ Manual OAuth Error:', error);
            reject(error);
          },
          onTimeout: () => {
            reject(new Error('OAuth authentication timeout'));
          },
          onMessage: (event) => {
            console.log('📨 OAuth Message:', event.data);
            
            // Handle OAuth callback
            if (event.data?.type === 'oauth_callback' && event.data?.url) {
              const url = new URL(event.data.url);
              const code = url.searchParams.get('code');
              const error = url.searchParams.get('error');
              
              if (error) {
                reject(new Error(error));
              } else if (code) {
                resolve({ success: true, code, url: event.data.url });
              }
            }
          }
        });
      });

      setManualResult(result);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      setManualError(errorMessage);
    } finally {
      setManualLoading(false);
    }
  }, [clientId, redirectUri, scope]);

  // Example 3: Hook-based authentication
  const authenticateWithHook = useCallback(async () => {
    try {
      const result = await oAuth.authenticate({
        clientId,
        redirectUri,
        scope,
        responseType: 'code',
        accessType: 'offline',
        prompt: 'consent'
      });
      
      console.log('🎉 Hook authentication result:', result);
    } catch (error) {
      console.error('💥 Hook authentication error:', error);
    }
  }, [oAuth, clientId, redirectUri, scope]);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="text-center">
        <Shield className="w-16 h-16 mx-auto mb-4 text-blue-600" />
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          COOP-Safe OAuth Authentication
        </h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          This example demonstrates how to handle OAuth authentication without 
          Cross-Origin-Opener-Policy (COOP) errors using our new popup management system.
        </p>
      </div>

      {/* Configuration Display */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-2">OAuth Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="font-medium">Client ID:</span>
            <p className="text-gray-600 truncate">{clientId || 'Not configured'}</p>
          </div>
          <div>
            <span className="font-medium">Redirect URI:</span>
            <p className="text-gray-600 truncate">{redirectUri}</p>
          </div>
          <div>
            <span className="font-medium">Scope:</span>
            <p className="text-gray-600">{scope}</p>
          </div>
        </div>
      </div>

      {/* Example 1: React Hook */}
      <div className="border rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-bold">1</div>
          <h3 className="text-xl font-semibold">React Hook Method (Recommended)</h3>
        </div>
        
        <p className="text-gray-600 mb-4">
          Uses the <code className="bg-gray-100 px-2 py-1 rounded">useOAuth</code> hook for 
          declarative OAuth management with built-in state handling.
        </p>

        <button
          onClick={authenticateWithHook}
          disabled={oAuth.isLoading || !clientId}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-6 py-2 rounded-lg 
                     flex items-center gap-2 transition-colors"
        >
          {oAuth.isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Authenticating...
            </>
          ) : (
            <>
              <ExternalLink className="w-4 h-4" />
              Authenticate with Hook
            </>
          )}
        </button>

        {oAuth.error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-red-900">Authentication Error</p>
              <p className="text-red-700 text-sm">{oAuth.error}</p>
            </div>
          </div>
        )}

        {oAuth.isPopupOpen && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-900">
              🔄 Popup is open - complete authentication in the popup window
            </p>
            <button
              onClick={oAuth.closePopup}
              className="mt-2 text-blue-600 hover:text-blue-800 text-sm underline"
            >
              Cancel Authentication
            </button>
          </div>
        )}
      </div>

      {/* Example 2: Manual Implementation */}
      <div className="border rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-sm font-bold">2</div>
          <h3 className="text-xl font-semibold">Manual Popup Manager</h3>
        </div>
        
        <p className="text-gray-600 mb-4">
          Direct usage of <code className="bg-gray-100 px-2 py-1 rounded">createPopupManager()</code> for 
          custom implementations with full control over the authentication flow.
        </p>

        <button
          onClick={authenticateManually}
          disabled={manualLoading || !clientId}
          className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-300 text-white px-6 py-2 rounded-lg 
                     flex items-center gap-2 transition-colors"
        >
          {manualLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Authenticating...
            </>
          ) : (
            <>
              <ExternalLink className="w-4 h-4" />
              Authenticate Manually
            </>
          )}
        </button>

        {manualError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-red-900">Manual Authentication Error</p>
              <p className="text-red-700 text-sm">{manualError}</p>
            </div>
          </div>
        )}

        {manualResult && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
            <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-green-900">Manual Authentication Success</p>
              <pre className="text-green-700 text-sm mt-1 bg-green-100 p-2 rounded overflow-x-auto">
                {JSON.stringify(manualResult, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* Benefits Section */}
      <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-lg p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">COOP-Safe Benefits</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-gray-900">No COOP Errors</p>
              <p className="text-gray-600 text-sm">Eliminates "Cross-Origin-Opener-Policy would block the window.close call" errors</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-gray-900">Reliable Cleanup</p>
              <p className="text-gray-600 text-sm">Automatic resource cleanup prevents memory leaks and hanging popups</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-gray-900">Message-Based Detection</p>
              <p className="text-gray-600 text-sm">Uses postMessage for cross-origin communication instead of direct property access</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-gray-900">Type-Safe Implementation</p>
              <p className="text-gray-600 text-sm">Full TypeScript support with comprehensive error handling</p>
            </div>
          </div>
        </div>
      </div>

      {/* Code Examples */}
      <div className="border rounded-lg p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Code Examples</h3>
        
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-gray-900 mb-2">React Hook Usage:</h4>
            <pre className="bg-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
{`const { authenticate, isLoading, error } = useOAuth({
  onSuccess: (result) => console.log('Success:', result),
  onError: (error) => console.error('Error:', error)
});

const result = await authenticate({
  clientId: 'your-client-id',
  redirectUri: 'your-redirect-uri',
  scope: 'openid email profile'
});`}
            </pre>
          </div>

          <div>
            <h4 className="font-medium text-gray-900 mb-2">Manual Implementation:</h4>
            <pre className="bg-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
{`const popupManager = createPopupManager();

await popupManager.open(authUrl, {
  timeout: 300000,
  onSuccess: (data) => console.log('Success:', data),
  onError: (error) => console.error('Error:', error),
  onMessage: (event) => {
    // Handle OAuth callback messages
    if (event.data?.type === 'oauth_callback') {
      // Process callback data
    }
  }
});`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default COOPSafeOAuthExample;
