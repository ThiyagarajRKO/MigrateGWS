'use client';

import { useState, useEffect } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { User, UserPlus, CheckCircle, AlertCircle, Loader, Play, Settings, LogIn, LogOut } from 'lucide-react';
import { useVerificationToken } from '@/hooks/useVerificationToken';

interface TestUserData {
  primaryEmail: string;
  name: {
    givenName: string;
    familyName: string;
  };
  password: string;
  changePasswordAtNextLogin: boolean;
  orgUnitPath: string;
  suspended: boolean;
}

interface CreateUserResponse {
  user?: any;
  success: boolean;
  message?: string;
  configurationRequired?: {
    domain: string;
    serviceAccount: string;
    scopes: string[];
    instructions: string[];
    setupGuide: string;
  };
  error?: string;
}

export default function UserCreationTestPage() {
  const { data: session, status } = useSession();
  
  // Verification token hook for service account authentication
  const verificationTokenHook = useVerificationToken({
    tokenProp: undefined,
    storageKey: 'test_page_verification_token',
    debug: true,
    componentName: 'UserCreationTestPage'
  });
  
  const [testData, setTestData] = useState<TestUserData>({
    primaryEmail: 'test.user@sample.arakutourism.net',
    name: {
      givenName: 'Test',
      familyName: 'User'
    },
    password: 'TempPassword123!',
    changePasswordAtNextLogin: true,
    orgUnitPath: '/',
    suspended: false
  });

  const [targetDomain, setTargetDomain] = useState('sample.arakutourism.net');
  const [adminEmail, setAdminEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<CreateUserResponse | null>(null);

  const generateSecurePassword = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    return Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  };

  const handleGeneratePassword = () => {
    setTestData(prev => ({
      ...prev,
      password: generateSecurePassword()
    }));
  };

  // Verify service account and generate verification token
  const verifyServiceAccount = async () => {
    try {
      console.log('Verifying service account...');
      
      const response = await fetch('/api/v1/delegation/verify', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          domain: 'service-account-verification',
          adminEmail: 'gws-permission@gws-migration-463208.iam.gserviceaccount.com',
          migrationScenario: 'service-account',
          useServiceAccount: true
        })
      });

      const verificationData = await response.json();
      console.log('Service account verification response:', verificationData);

      if (response.ok && verificationData.success) {
        // Generate a verification token for service account
        const serviceAccountToken = `service-account-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Store the verification token
        verificationTokenHook.storeToken(serviceAccountToken);
        
        console.log('Service account verified successfully, token stored:', serviceAccountToken);
        return true;
      } else {
        console.error('Service account verification failed:', verificationData.error || verificationData.message);
        return false;
      }
    } catch (error) {
      console.error('Service account verification error:', error);
      return false;
    }
  };

  // Auto-verify service account on component mount
  useEffect(() => {
    if (!verificationTokenHook.hasToken) {
      verifyServiceAccount();
    }
  }, [verificationTokenHook.hasToken]);

  const handleCreateUser = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      console.log('Testing user creation with data:', {
        userData: { ...testData, password: '[REDACTED]' },
        domain: targetDomain,
        adminEmail: adminEmail || undefined
      });

      const response = await fetch('/api/google-workspace', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(verificationTokenHook.token && { 
            'Authorization': `Bearer ${verificationTokenHook.token}` 
          })
        },
        body: JSON.stringify({
          action: 'create-user',
          data: {
            userData: testData,
            adminEmail: adminEmail || undefined,
            domain: targetDomain
          },
          verificationToken: verificationTokenHook.token
        })
      });

      const responseData = await response.json();

      console.log('API Response:', {
        status: response.status,
        statusText: response.statusText,
        data: responseData
      });

      setResult(responseData);

    } catch (error) {
      console.error('Test failed:', error);
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl">
              <UserPlus className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            Target User Creation API Test
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Test the Google Workspace user creation API with domain-wide delegation and service account authentication.
          </p>
        </div>

        {/* Authentication Status */}
        <div className="mb-8">
          <div className={`p-4 rounded-xl border ${
            session 
              ? 'bg-green-50 border-green-200' 
              : 'bg-blue-50 border-blue-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {session ? (
                  <>
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <div>
                      <h3 className="font-medium text-green-900">OAuth Authenticated</h3>
                      <p className="text-sm text-green-700">
                        Signed in as {session.user?.email}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <Settings className="h-5 w-5 text-blue-600" />
                    <div>
                      <h3 className="font-medium text-blue-900">Service Account Mode</h3>
                      <p className="text-sm text-blue-800">
                        Testing with service account authentication (if configured)
                      </p>
                    </div>
                  </>
                )}
              </div>
              <div>
                {session ? (
                  <button
                    onClick={() => signOut()}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-green-800 bg-green-100 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </button>
                ) : (
                  <button
                    onClick={() => signIn('google')}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-800 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <LogIn className="mr-2 h-4 w-4" />
                    Sign In with Google (Optional)
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Service Account Status */}
        <div className="mb-8">
          <div className={`p-4 rounded-xl border ${
            verificationTokenHook.hasToken
              ? 'bg-green-50 border-green-200'
              : 'bg-yellow-50 border-yellow-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {verificationTokenHook.hasToken ? (
                  <>
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <div>
                      <h3 className="font-medium text-green-900">Service Account Verified</h3>
                      <p className="text-sm text-green-700">
                        Token source: {verificationTokenHook.tokenSource}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-yellow-600" />
                    <div>
                      <h3 className="font-medium text-yellow-900">Service Account Verification Pending</h3>
                      <p className="text-sm text-yellow-800">
                        Attempting to verify service account authentication...
                      </p>
                    </div>
                  </>
                )}
              </div>
              <div>
                <button
                  onClick={verifyServiceAccount}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-800 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Re-verify
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Test Configuration */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
              <Settings className="h-5 w-5 mr-2 text-gray-600" />
              Test Configuration
            </h2>

            <div className="space-y-6">
              {/* Target Domain */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target Domain
                </label>
                <input
                  type="text"
                  value={targetDomain}
                  onChange={(e) => setTargetDomain(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="example.com"
                />
              </div>

              {/* Admin Email (Optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Admin Email (Optional)
                  <span className="text-xs text-gray-500 ml-2">Leave empty to use service account</span>
                </label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="admin@example.com"
                />
              </div>

              {/* User Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  User Email to Create
                </label>
                <input
                  type="email"
                  value={testData.primaryEmail}
                  onChange={(e) => setTestData(prev => ({ ...prev, primaryEmail: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="test.user@example.com"
                />
              </div>

              {/* User Name */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={testData.name.givenName}
                    onChange={(e) => setTestData(prev => ({ 
                      ...prev, 
                      name: { ...prev.name, givenName: e.target.value } 
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="First Name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={testData.name.familyName}
                    onChange={(e) => setTestData(prev => ({ 
                      ...prev, 
                      name: { ...prev.name, familyName: e.target.value } 
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Last Name"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Temporary Password
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={testData.password}
                    onChange={(e) => setTestData(prev => ({ ...prev, password: e.target.value }))}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Password"
                  />
                  <button
                    onClick={handleGeneratePassword}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
                  >
                    Generate
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  User will be required to change password at next login
                </p>
              </div>

              {/* Test Button */}
              <button
                onClick={handleCreateUser}
                disabled={isLoading || !testData.primaryEmail || !targetDomain}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-center space-x-2"
              >
                {isLoading ? (
                  <>
                    <Loader className="h-5 w-5 animate-spin" />
                    <span>Creating User...</span>
                  </>
                ) : (
                  <>
                    <Play className="h-5 w-5" />
                    <span>Test User Creation</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Test Results */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
              <User className="h-5 w-5 mr-2 text-gray-600" />
              Test Results
            </h2>

            {result ? (
              <div className="space-y-4">
                {/* Success/Error Status */}
                <div className={`p-4 rounded-lg border ${
                  result.success 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-center space-x-3">
                    {result.success ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-600" />
                    )}
                    <div className="flex-1">
                      <h3 className={`font-medium ${
                        result.success ? 'text-green-900' : 'text-red-900'
                      }`}>
                        {result.success ? 'Success' : 'Failed'}
                      </h3>
                      {result.message && (
                        <p className={`text-sm mt-1 ${
                          result.success ? 'text-green-700' : 'text-red-700'
                        }`}>
                          {result.message}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* User Data */}
                {result.user && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-3">Created User Details:</h4>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="font-medium text-gray-700">ID:</span>
                        <span className="text-gray-600 ml-2 font-mono">{result.user.id}</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Email:</span>
                        <span className="text-gray-600 ml-2">{result.user.primaryEmail}</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Name:</span>
                        <span className="text-gray-600 ml-2">{result.user.name?.fullName || `${result.user.name?.givenName} ${result.user.name?.familyName}`}</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Organization Unit:</span>
                        <span className="text-gray-600 ml-2">{result.user.orgUnitPath}</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Created:</span>
                        <span className="text-gray-600 ml-2">{result.user.creationTime}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Error Details */}
                {result.error && (
                  <div className="bg-red-50 rounded-lg p-4">
                    <h4 className="font-medium text-red-900 mb-2">Error Details:</h4>
                    <p className="text-sm text-red-700">{result.error}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <User className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>Configure test parameters and click "Test User Creation" to see results</p>
              </div>
            )}
          </div>
        </div>

        {/* Additional Information */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">About This Test</h3>
          <div className="text-sm text-blue-800 space-y-2">
            <p>
              This test page allows you to directly test the Google Workspace user creation API with your configured service account.
            </p>
            <p>
              <strong>Authentication Methods:</strong>
            </p>
            <ul className="list-disc ml-6 space-y-1">
              <li><strong>Service Account (Recommended):</strong> Uses environment-configured service account with domain-wide delegation</li>
              <li><strong>OAuth (Optional):</strong> Uses your personal Google account credentials for testing</li>
            </ul>
            <p>
              <strong>Expected Behaviors:</strong>
            </p>
            <ul className="list-disc ml-6 space-y-1">
              <li>If domain-wide delegation is properly configured, the user will be created successfully</li>
              <li>If delegation is not configured, the API will return an error with setup instructions</li>
              <li>The test uses the same API endpoint and authentication flow as the main migration workflow</li>
              <li>Works with both OAuth and service account authentication methods</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
