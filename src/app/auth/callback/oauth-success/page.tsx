'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function OAuthSuccessPage() {
  const searchParams = useSearchParams();
  const [shouldClosePopup, setShouldClosePopup] = useState(false);

  useEffect(() => {
    const oauthSuccess = searchParams.get('oauth_success');
    const domainsDiscovered = searchParams.get('domains_discovered');
    const sessionId = searchParams.get('session_id');
    const authType = searchParams.get('auth_type');
    const adminEmail = searchParams.get('admin_email');

    console.log('OAuth Success Page - Parameters:', { 
      oauthSuccess, 
      domainsDiscovered, 
      sessionId, 
      authType, 
      adminEmail 
    });

    if (oauthSuccess === 'true') {
      try {
        // Build the redirect URL for the parent window
        const parentUrl = new URL('/migrations/new', window.location.origin);
        parentUrl.searchParams.set('oauth_success', 'true');
        if (domainsDiscovered) {
          parentUrl.searchParams.set('domains_discovered', domainsDiscovered);
        }
        if (sessionId) {
          parentUrl.searchParams.set('session_id', sessionId);
        }
        if (authType) {
          parentUrl.searchParams.set('auth_type', authType);
        }
        if (adminEmail) {
          parentUrl.searchParams.set('admin_email', adminEmail);
        }

        // Update the parent window's URL and send a message
        if (window.opener) {
          // Use postMessage to communicate with parent window
          window.opener.postMessage({
            type: 'oauth_success',
            oauthSuccess: 'true',
            domainsDiscovered,
            sessionId,
            authType,
            adminEmail
          }, window.location.origin);
          
          // For cross-tenant scenarios, don't redirect the parent window
          // Only use postMessage to communicate the success
          if (!authType || authType === undefined) {
            // This is single super admin - redirect parent window
            window.opener.location.href = parentUrl.toString();
          }
          // For cross-tenant (authType === 'source' or 'target'), don't redirect
        }

        // Determine if we should close the popup
        // For cross-tenant, handle source and target differently
        if (authType === 'source') {
          // Source authentication completed - don't close yet, wait for target
          console.log('Source authentication completed, keeping popup open for target...');
          // Don't set shouldClosePopup - keep the same popup window open
        } else if (authType === 'target') {
          // Target authentication completed - both should be done now, close popup
          console.log('Target authentication completed, closing popup...');
          setShouldClosePopup(true);
        } else {
          // This is single super admin authentication - close immediately
          setShouldClosePopup(true);
        }
      } catch (error) {
        console.error('Error handling OAuth success:', error);
        // Fallback: just close the popup
        setShouldClosePopup(true);
      }
    }
  }, [searchParams]);

  const checkIfBothAuthenticationsComplete = async (sessionId: string | null, currentAuthType: string | null) => {
    if (!sessionId || !currentAuthType) {
      setShouldClosePopup(true);
      return;
    }

    try {
      // Extract base session ID
      const baseSessionId = sessionId.replace('_source', '').replace('_target', '');
      
      console.log('Checking authentication status for both source and target...');
      
      // Check both source and target authentication status
      const [sourceResponse, targetResponse] = await Promise.all([
        fetch(`/api/auth/oauth/discover-domains?sessionId=${baseSessionId}_source`),
        fetch(`/api/auth/oauth/discover-domains?sessionId=${baseSessionId}_target`)
      ]);

      const sourceData = await sourceResponse.json();
      const targetData = await targetResponse.json();

      console.log('Authentication status:', {
        source: sourceData.authenticated,
        target: targetData.authenticated,
        currentAuthType
      });

      // If both are authenticated, we can close the popup
      if (sourceData.authenticated && targetData.authenticated) {
        console.log('Both authentications complete! Closing popup...');
        setShouldClosePopup(true);
      } else {
        // Still waiting for the other authentication - don't close yet
        console.log('Still waiting for other authentication to complete...');
        
        // If this is target auth and source is not complete, something went wrong
        if (currentAuthType === 'target' && !sourceData.authenticated) {
          console.warn('Target completed but source not authenticated - closing anyway');
          setShouldClosePopup(true);
        }
      }
    } catch (error) {
      console.error('Error checking authentication status:', error);
      // On error, close the popup to prevent it from being stuck
      setShouldClosePopup(true);
    }
  };

  useEffect(() => {
    if (shouldClosePopup) {
      setTimeout(() => {
        try {
          // Try to use postMessage to inform parent to close this popup
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage({
              type: 'close_oauth_popup'
            }, window.location.origin);
          }
        } catch (error) {
          console.log('Could not send close message to parent, attempting direct close');
        }
        
        try {
          // Attempt to close the window
          window.close();
        } catch (error) {
          console.log('Could not close popup window due to COOP policy:', error);
          // Show a message to the user instead
          document.body.innerHTML = `
            <div class="min-h-screen flex items-center justify-center bg-gray-50">
              <div class="text-center p-8 bg-white rounded-lg shadow-lg max-w-md">
                <div class="text-green-600 mb-4">
                  <svg class="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                </div>
                <h2 class="text-lg font-medium text-gray-900 mb-2">Authentication Complete!</h2>
                <p class="text-gray-600 mb-4">You can now close this window and return to the main application.</p>
                <button onclick="window.close()" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  Close Window
                </button>
              </div>
            </div>
          `;
        }
      }, 500);
    }
  }, [shouldClosePopup]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <h2 className="text-lg font-medium text-gray-900 mb-2">
          Authentication Successful
        </h2>
        <p className="text-gray-600">
          {shouldClosePopup ? 'Closing window...' : 'Processing authentication...'}
        </p>
      </div>
    </div>
  );
}
