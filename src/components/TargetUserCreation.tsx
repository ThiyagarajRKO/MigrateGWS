'use client';

import { useState, useEffect, memo, useCallback } from 'react';
import { 
  Users, 
  UserPlus, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  Clock,
  Shield,
  Mail,
  Building,
  Pause,
  Play,
  RotateCcw
} from 'lucide-react';

interface User {
  id: string;
  primaryEmail: string;
  name: {
    fullName: string;
    givenName: string;
    familyName: string;
  };
  isAdmin: boolean;
  suspended: boolean;
  lastLoginTime?: string;
  creationTime: string;
  orgUnitPath: string;
  customerId: string;
  sourceDomain?: string;
  targetDomain?: string;
  targetEmail?: string;
}

interface UserDomainMapping {
  user: User;
  targetDomain: string;
  targetEmail?: string;
}

interface UserCreationResult {
  mapping: UserDomainMapping;
  status: 'pending' | 'creating' | 'created' | 'exists' | 'error' | 'skipped';
  targetUser?: User;
  error?: string;
  createdAt?: Date;
}

interface UserCreationProgress {
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  currentOperation?: string;
  estimatedTimeRemaining?: number;
  startTime?: Date;
}

interface TargetUserCreationProps {
  userMappings: UserDomainMapping[];
  targetAdminEmails: {[domain: string]: string};
  onProgress?: (progress: UserCreationProgress) => void;
  onComplete?: (results: UserCreationResult[]) => void;
  onError?: (error: string) => void;
  autoStart?: boolean;
  batchSize?: number;
  retryAttempts?: number;
}

export const TargetUserCreation = memo(function TargetUserCreation({
  userMappings,
  targetAdminEmails,
  onProgress,
  onComplete,
  onError,
  autoStart = false,
  batchSize = 5,
  retryAttempts = 3
}: TargetUserCreationProps) {
  const [results, setResults] = useState<UserCreationResult[]>([]);
  const [progress, setProgress] = useState<UserCreationProgress>({
    total: 0,
    completed: 0,
    failed: 0,
    skipped: 0
  });
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentBatch, setCurrentBatch] = useState(0);
  const [showDetails, setShowDetails] = useState(false);

  // Initialize results when userMappings change
  useEffect(() => {
    const initialResults: UserCreationResult[] = userMappings.map(mapping => ({
      mapping,
      status: 'pending'
    }));
    setResults(initialResults);
    setProgress(prev => ({
      ...prev,
      total: userMappings.length,
      completed: 0,
      failed: 0,
      skipped: 0
    }));
  }, [userMappings]);

  // Auto-start if enabled
  useEffect(() => {
    if (autoStart && userMappings.length > 0 && !isRunning) {
      startCreation();
    }
  }, [autoStart, userMappings]);

  // Check if user exists in target domain
  const checkUserExists = useCallback(async (targetEmail: string, targetDomain: string): Promise<User | null> => {
    try {
      const adminEmail = targetAdminEmails[targetDomain];
      if (!adminEmail) {
        throw new Error(`No admin email configured for domain: ${targetDomain}`);
      }

      const response = await fetch('/api/google-workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'check-user',
          data: { email: targetEmail, domain: targetDomain, adminEmail }
        })
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.exists ? data.user : null;
    } catch (error) {
      console.error('Error checking user existence:', error);
      return null;
    }
  }, [targetAdminEmails]);

  // Create user in target domain
  const createUser = useCallback(async (mapping: UserDomainMapping, retryCount = 0): Promise<User> => {
    const adminEmail = targetAdminEmails[mapping.targetDomain];
    if (!adminEmail) {
      throw new Error(`No admin email configured for domain: ${mapping.targetDomain}`);
    }

    const userData = {
      primaryEmail: mapping.targetEmail || `${mapping.user.primaryEmail.split('@')[0]}@${mapping.targetDomain}`,
      name: {
        givenName: mapping.user.name.givenName,
        familyName: mapping.user.name.familyName
      },
      password: generateSecurePassword(),
      changePasswordAtNextLogin: true,
      orgUnitPath: mapping.user.orgUnitPath || '/',
      suspended: false
    };

    try {
      const response = await fetch('/api/google-workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-user',
          data: {
            domain: mapping.targetDomain,
            adminEmail,
            userData
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to create user: ${response.statusText}`);
      }

      const data = await response.json();
      return data.user;
    } catch (error: any) {
      if (retryCount < retryAttempts) {
        console.log(`Retrying user creation for ${userData.primaryEmail} (attempt ${retryCount + 1}/${retryAttempts})`);
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount))); // Exponential backoff
        return createUser(mapping, retryCount + 1);
      }
      throw error;
    }
  }, [targetAdminEmails, retryAttempts]);

  // Generate secure temporary password
  const generateSecurePassword = (): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  // Process a single user mapping
  const processMapping = useCallback(async (resultIndex: number): Promise<void> => {
    if (isPaused) return;

    const currentResult = results[resultIndex];
    if (!currentResult || currentResult.status !== 'pending') return;

    // Update status to creating
    setResults(prev => prev.map((r, i) => 
      i === resultIndex ? { ...r, status: 'creating' as const } : r
    ));

    setProgress(prev => ({
      ...prev,
      currentOperation: `Creating ${currentResult.mapping.targetEmail || currentResult.mapping.user.primaryEmail}...`
    }));

    try {
      // Check if user already exists
      const targetEmail = currentResult.mapping.targetEmail || 
        `${currentResult.mapping.user.primaryEmail.split('@')[0]}@${currentResult.mapping.targetDomain}`;
      
      const existingUser = await checkUserExists(targetEmail, currentResult.mapping.targetDomain);
      
      if (existingUser) {
        // User already exists
        setResults(prev => prev.map((r, i) => 
          i === resultIndex ? {
            ...r,
            status: 'exists' as const,
            targetUser: existingUser
          } : r
        ));
        
        setProgress(prev => ({
          ...prev,
          skipped: prev.skipped + 1
        }));
      } else {
        // Create new user
        const newUser = await createUser(currentResult.mapping);
        
        setResults(prev => prev.map((r, i) => 
          i === resultIndex ? {
            ...r,
            status: 'created' as const,
            targetUser: newUser,
            createdAt: new Date()
          } : r
        ));
        
        setProgress(prev => ({
          ...prev,
          completed: prev.completed + 1
        }));
      }
    } catch (error: any) {
      console.error('Error processing user mapping:', error);
      
      setResults(prev => prev.map((r, i) => 
        i === resultIndex ? {
          ...r,
          status: 'error' as const,
          error: error.message || 'Unknown error occurred'
        } : r
      ));
      
      setProgress(prev => ({
        ...prev,
        failed: prev.failed + 1
      }));
    }
  }, [results, isPaused, checkUserExists, createUser]);

  // Start the creation process
  const startCreation = useCallback(async () => {
    if (isRunning || userMappings.length === 0) return;

    setIsRunning(true);
    setIsPaused(false);
    
    const startTime = new Date();
    setProgress(prev => ({
      ...prev,
      startTime,
      completed: 0,
      failed: 0,
      skipped: 0
    }));

    try {
      // Process in batches to avoid rate limiting
      for (let i = 0; i < results.length; i += batchSize) {
        if (isPaused) break;
        
        setCurrentBatch(Math.floor(i / batchSize) + 1);
        
        const batch = Array.from({ length: Math.min(batchSize, results.length - i) }, (_, j) => i + j);
        
        // Process batch concurrently
        await Promise.all(batch.map(processMapping));
        
        // Small delay between batches to prevent rate limiting
        if (i + batchSize < results.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // Notify completion
      if (onComplete) {
        onComplete(results);
      }
    } catch (error: any) {
      console.error('Error in user creation process:', error);
      if (onError) {
        onError(error.message || 'User creation process failed');
      }
    } finally {
      setIsRunning(false);
      setProgress(prev => ({
        ...prev,
        currentOperation: undefined
      }));
    }
  }, [isRunning, userMappings, results, batchSize, isPaused, processMapping, onComplete, onError]);

  // Pause/Resume functionality
  const togglePause = () => {
    setIsPaused(!isPaused);
  };

  // Reset and restart
  const resetAndRestart = () => {
    setIsRunning(false);
    setIsPaused(false);
    setCurrentBatch(0);
    
    const resetResults: UserCreationResult[] = userMappings.map(mapping => ({
      mapping,
      status: 'pending'
    }));
    setResults(resetResults);
    
    setProgress({
      total: userMappings.length,
      completed: 0,
      failed: 0,
      skipped: 0
    });
    
    setTimeout(startCreation, 100);
  };

  // Update progress callback
  useEffect(() => {
    if (onProgress) {
      const estimatedTimeRemaining = progress.startTime && progress.completed > 0 
        ? ((Date.now() - progress.startTime.getTime()) / progress.completed) * (progress.total - progress.completed - progress.failed - progress.skipped)
        : undefined;
      
      onProgress({
        ...progress,
        estimatedTimeRemaining
      });
    }
  }, [progress, onProgress]);

  // Get status color
  const getStatusColor = (status: UserCreationResult['status']) => {
    switch (status) {
      case 'pending': return 'text-gray-500 bg-gray-100';
      case 'creating': return 'text-blue-600 bg-blue-100';
      case 'created': return 'text-green-600 bg-green-100';
      case 'exists': return 'text-yellow-600 bg-yellow-100';
      case 'error': return 'text-red-600 bg-red-100';
      case 'skipped': return 'text-gray-500 bg-gray-100';
      default: return 'text-gray-500 bg-gray-100';
    }
  };

  // Get status icon
  const getStatusIcon = (status: UserCreationResult['status']) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'creating': return <RefreshCw className="h-4 w-4 animate-spin" />;
      case 'created': return <CheckCircle className="h-4 w-4" />;
      case 'exists': return <Users className="h-4 w-4" />;
      case 'error': return <AlertCircle className="h-4 w-4" />;
      case 'skipped': return <Clock className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <UserPlus className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Target User Creation</h2>
              <p className="text-gray-600">
                Creating {userMappings.length} users across {Object.keys(targetAdminEmails).length} target domains
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                showDetails ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {showDetails ? 'Hide Details' : 'Show Details'}
            </button>
            
            {!isRunning && (
              <button
                onClick={startCreation}
                disabled={userMappings.length === 0}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  userMappings.length > 0
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                <Play className="h-4 w-4 mr-2 inline" />
                Start Creation
              </button>
            )}
            
            {isRunning && (
              <>
                <button
                  onClick={togglePause}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                >
                  {isPaused ? <Play className="h-4 w-4 mr-2 inline" /> : <Pause className="h-4 w-4 mr-2 inline" />}
                  {isPaused ? 'Resume' : 'Pause'}
                </button>
                
                <button
                  onClick={resetAndRestart}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <RotateCcw className="h-4 w-4 mr-2 inline" />
                  Restart
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Progress Overview */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{progress.total}</div>
            <div className="text-sm text-gray-600">Total Users</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{progress.completed}</div>
            <div className="text-sm text-gray-600">Created</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{progress.skipped}</div>
            <div className="text-sm text-gray-600">Already Exist</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{progress.failed}</div>
            <div className="text-sm text-gray-600">Failed</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
          <div 
            className="bg-green-600 h-3 rounded-full transition-all duration-500"
            style={{ 
              width: `${progress.total > 0 ? ((progress.completed + progress.skipped + progress.failed) / progress.total) * 100 : 0}%` 
            }}
          />
        </div>

        {/* Current Operation */}
        {progress.currentOperation && (
          <div className="text-sm text-gray-600 mb-2">
            {progress.currentOperation}
          </div>
        )}

        {/* Batch Progress */}
        {isRunning && (
          <div className="text-sm text-gray-600">
            Processing batch {currentBatch} of {Math.ceil(progress.total / batchSize)}
            {progress.estimatedTimeRemaining && (
              <span className="ml-2">
                • ETA: {Math.ceil(progress.estimatedTimeRemaining / 1000 / 60)} minutes
              </span>
            )}
          </div>
        )}
      </div>

      {/* Detailed Results */}
      {showDetails && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Creation Details</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {results.map((result, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${getStatusColor(result.status)}`}>
                    {getStatusIcon(result.status)}
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{result.mapping.user.name.fullName}</h4>
                    <div className="text-sm text-gray-600">
                      {result.mapping.user.primaryEmail} → {result.mapping.targetEmail || `${result.mapping.user.primaryEmail.split('@')[0]}@${result.mapping.targetDomain}`}
                    </div>
                    {result.error && (
                      <div className="text-sm text-red-600 mt-1">{result.error}</div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(result.status)}`}>
                    {result.status.charAt(0).toUpperCase() + result.status.slice(1)}
                  </span>
                  {result.mapping.user.isAdmin && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      <Shield className="h-3 w-3 mr-1" />
                      Admin
                    </span>
                  )}
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    <Building className="h-3 w-3 mr-1" />
                    {result.mapping.targetDomain}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Domain Summary */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Domain Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.keys(targetAdminEmails).map(domain => {
            const domainResults = results.filter(r => r.mapping.targetDomain === domain);
            const created = domainResults.filter(r => r.status === 'created').length;
            const exists = domainResults.filter(r => r.status === 'exists').length;
            const failed = domainResults.filter(r => r.status === 'error').length;
            
            return (
              <div key={domain} className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">{domain}</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Total:</span>
                    <span>{domainResults.length}</span>
                  </div>
                  <div className="flex justify-between text-green-600">
                    <span>Created:</span>
                    <span>{created}</span>
                  </div>
                  <div className="flex justify-between text-yellow-600">
                    <span>Existing:</span>
                    <span>{exists}</span>
                  </div>
                  <div className="flex justify-between text-red-600">
                    <span>Failed:</span>
                    <span>{failed}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

TargetUserCreation.displayName = 'TargetUserCreation';

export default TargetUserCreation;
