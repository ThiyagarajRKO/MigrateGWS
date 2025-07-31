'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { 
  Database, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight,
  Shield,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface LoginForm {
  email: string;
  password: string;
  rememberMe: boolean;
}

export default function LoginPage() {
  const { signInWithGoogle, signInWithEmail, error, isLoading, isAuthenticated, clearError } = useAuth();
  
  const [formData, setFormData] = useState<LoginForm>({
    email: '',
    password: '',
    rememberMe: false
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      window.location.href = '/dashboard';
    }
  }, [isAuthenticated]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    // Clear error when user starts typing
    if (error) clearError();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    await signInWithEmail(formData.email, formData.password);
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    await signInWithGoogle();
    setIsGoogleLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="flex min-h-screen">
        {/* Left Side - Branding & Features */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-indigo-700 p-12 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative z-10 flex flex-col justify-between w-full">
            <div>
              <div className="flex items-center mb-12">
                <Database className="h-10 w-10 mr-4" />
                <div>
                  <h1 className="text-2xl font-bold">GWS Migration Platform</h1>
                  <p className="text-blue-100">Secure Google Workspace Migration</p>
                </div>
              </div>

              <div className="space-y-8">
                <div>
                  <h2 className="text-3xl font-bold mb-6">
                    Migrate Your Google Workspace with Confidence
                  </h2>
                  <p className="text-blue-100 text-lg leading-relaxed">
                    Seamlessly transfer your Gmail, Drive, Calendar, and other Google Workspace 
                    data between domains with our enterprise-grade migration platform.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center">
                    <CheckCircle className="h-6 w-6 mr-3 text-green-300" />
                    <span className="text-blue-100">Cross-tenant migration support</span>
                  </div>
                  <div className="flex items-center">
                    <CheckCircle className="h-6 w-6 mr-3 text-green-300" />
                    <span className="text-blue-100">Advanced domain & user mapping</span>
                  </div>
                  <div className="flex items-center">
                    <CheckCircle className="h-6 w-6 mr-3 text-green-300" />
                    <span className="text-blue-100">Real-time progress monitoring</span>
                  </div>
                  <div className="flex items-center">
                    <CheckCircle className="h-6 w-6 mr-3 text-green-300" />
                    <span className="text-blue-100">Comprehensive audit reports</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center text-blue-200">
              <Shield className="h-5 w-5 mr-2" />
              <span className="text-sm">Enterprise-grade security & compliance</span>
            </div>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            {/* Mobile Logo */}
            <div className="flex items-center justify-center mb-8 lg:hidden">
              <Database className="h-8 w-8 text-blue-600 mr-3" />
              <div className="text-center">
                <h1 className="text-xl font-bold text-gray-900">GWS Migration Platform</h1>
                <p className="text-gray-600 text-sm">Secure Google Workspace Migration</p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-8">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome Back</h2>
                <p className="text-gray-600">Sign in to manage your migrations</p>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                  <span className="text-red-700 text-sm">{error}</span>
                </div>
              )}

              {/* Google Login Button */}
              <button
                onClick={handleGoogleLogin}
                disabled={isGoogleLoading || isLoading}
                className="w-full mb-6 bg-white border border-gray-300 rounded-lg px-4 py-3 flex items-center justify-center hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isGoogleLoading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                ) : (
                  <>
                    <svg className="h-5 w-5 mr-3" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Continue with Google Workspace
                  </>
                )}
              </button>

              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Or continue with email</span>
                </div>
              </div>

              {/* Email/Password Form */}
              <form onSubmit={handleLogin} className="space-y-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="admin@demo.com"
                      className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={handleInputChange}
                      placeholder="demo123"
                      className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                      ) : (
                        <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <input
                      id="rememberMe"
                      name="rememberMe"
                      type="checkbox"
                      checked={formData.rememberMe}
                      onChange={handleInputChange}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="rememberMe" className="ml-2 block text-sm text-gray-700">
                      Remember me
                    </label>
                  </div>
                  <Link href="/forgot-password" className="text-sm text-blue-600 hover:text-blue-500">
                    Forgot password?
                  </Link>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || isGoogleLoading}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                >
                  {isLoading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    <>
                      Sign In
                      <ArrowRight className="h-5 w-5 ml-2" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-8 text-center">
                <p className="text-sm text-gray-600">
                  Don&apos;t have an account?{' '}
                  <Link href="/register" className="text-blue-600 hover:text-blue-500 font-medium">
                    Request Access
                  </Link>
                </p>
              </div>

              {/* Demo Credentials */}
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Demo Credentials:</h3>
                <div className="text-xs text-gray-600 space-y-1">
                  <p><strong>Email:</strong> admin@demo.com</p>
                  <p><strong>Password:</strong> demo123</p>
                </div>
              </div>
            </div>

            <div className="mt-8 text-center text-sm text-gray-500">
              <p>© 2025 GWS Migration Platform. All rights reserved.</p>
              <div className="mt-2 space-x-4">
                <Link href="/privacy" className="hover:text-gray-700">Privacy Policy</Link>
                <Link href="/terms" className="hover:text-gray-700">Terms of Service</Link>
                <Link href="/support" className="hover:text-gray-700">Support</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
