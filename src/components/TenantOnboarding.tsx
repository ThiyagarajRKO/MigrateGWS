'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Alert } from '@/components/ui/alert';
import { 
  Building2, 
  Shield, 
  Key, 
  CheckCircle2, 
  AlertTriangle, 
  Copy, 
  ExternalLink,
  ArrowRight,
  Settings,
  Database,
  Zap,
  Clock,
  Info,
  Eye,
  EyeOff
} from 'lucide-react';

interface TenantOnboardingData {
  tenantId: string;
  tenantName: string;
  adminEmail: string;
  sourceDomain: string;
  targetDomain: string;
  currentStep: number;
  oauthCompleted: boolean;
  dwdConfigured: boolean;
  servicesEnabled: string[];
  testMigrationCompleted: boolean;
}

interface OnboardingStepProps {
  step: number;
  title: string;
  description: string;
  status: 'pending' | 'current' | 'completed' | 'error';
  icon: React.ReactNode;
  children?: React.ReactNode;
}

const OnboardingStep: React.FC<OnboardingStepProps> = ({ 
  step, 
  title, 
  description, 
  status, 
  icon, 
  children 
}) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-success-500" />;
      case 'current':
        return <Clock className="h-5 w-5 text-info-500" />;
      case 'error':
        return <AlertTriangle className="h-5 w-5 text-danger-500" />;
      default:
        return <div className="h-5 w-5 rounded-full border-2 border-secondary-300" />;
    }
  };

  const getCardClass = () => {
    switch (status) {
      case 'completed':
        return 'border-l-4 border-success-500 bg-success-50';
      case 'current':
        return 'border-l-4 border-info-500 bg-info-50 shadow-lg';
      case 'error':
        return 'border-l-4 border-danger-500 bg-danger-50';
      default:
        return 'border-l-4 border-secondary-300 bg-secondary-50';
    }
  };

  return (
    <Card className={getCardClass()}>
      <CardHeader className="pb-3">
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white shadow-sm">
            <span className="text-sm font-bold text-secondary-700">{step}</span>
          </div>
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              {icon}
              <CardTitle className="text-base">{title}</CardTitle>
              {getStatusIcon()}
            </div>
            <p className="text-sm text-secondary-600 mt-1">{description}</p>
          </div>
        </div>
      </CardHeader>
      {children && (
        <CardContent className="pt-0">
          {children}
        </CardContent>
      )}
    </Card>
  );
};

interface CodeBlockProps {
  code: string;
  language?: string;
  copyable?: boolean;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ code, language = 'bash', copyable = true }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative">
      <pre className="bg-secondary-900 text-secondary-100 p-4 rounded-lg text-sm overflow-x-auto">
        <code>{code}</code>
      </pre>
      {copyable && (
        <Button
          size="sm"
          variant="outline"
          className="absolute top-2 right-2 h-8 w-8 p-0"
          onClick={handleCopy}
        >
          {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      )}
    </div>
  );
};

export default function TenantOnboarding() {
  const [tenantData, setTenantData] = useState<TenantOnboardingData>({
    tenantId: '',
    tenantName: '',
    adminEmail: '',
    sourceDomain: '',
    targetDomain: '',
    currentStep: 1,
    oauthCompleted: false,
    dwdConfigured: false,
    servicesEnabled: [],
    testMigrationCompleted: false
  });

  const [showServiceAccountKey, setShowServiceAccountKey] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  const serviceAccountClientId = "1234567890123456789012";
  const requiredScopes = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/contacts",
    "https://www.googleapis.com/auth/admin.directory.user",
    "https://www.googleapis.com/auth/admin.directory.group"
  ];

  const dwdInstructions = `1. Open Google Admin Console (admin.google.com)
2. Navigate to Security > API Controls > Domain-wide Delegation
3. Click "Add new" and enter these details:
   - Client ID: ${serviceAccountClientId}
   - OAuth Scopes: ${requiredScopes.join(', ')}
4. Click "Authorize"`;

  const handleInputChange = (field: keyof TenantOnboardingData, value: string) => {
    setTenantData(prev => ({ ...prev, [field]: value }));
  };

  const handleOAuthAuthorization = () => {
    // Simulate OAuth flow
    const oauthUrl = `https://accounts.google.com/oauth/v2/auth?client_id=${serviceAccountClientId}&scope=${encodeURIComponent(requiredScopes.join(' '))}&response_type=code&redirect_uri=${encodeURIComponent('https://yourdomain.com/oauth/callback')}`;
    window.open(oauthUrl, '_blank');
    
    // In real implementation, this would be handled by the OAuth callback
    setTimeout(() => {
      setTenantData(prev => ({ ...prev, oauthCompleted: true }));
      setCurrentStep(3);
    }, 2000);
  };

  const handleDWDVerification = () => {
    // Simulate DWD verification
    setTenantData(prev => ({ ...prev, dwdConfigured: true }));
    setCurrentStep(4);
  };

  const handleTestMigration = () => {
    // Simulate test migration
    setTenantData(prev => ({ ...prev, testMigrationCompleted: true }));
    setCurrentStep(5);
  };

  const getStepStatus = (step: number) => {
    if (step < currentStep) return 'completed';
    if (step === currentStep) return 'current';
    return 'pending';
  };

  // Define step configuration for the compact stepper
  const stepConfig = [
    {
      id: 1,
      title: "Tenant Registration",
      description: "Register your organization and configure basic settings",
      icon: Database,
      details: "Set up organization name, admin email, source and target domains",
      estimatedTime: "2-3 minutes",
      requirements: ["Organization details", "Valid admin email", "Domain information"]
    },
    {
      id: 2,
      title: "OAuth Authorization",
      description: "Authorize our application to access your Google Workspace",
      icon: Shield,
      details: "Grant necessary permissions through Google's OAuth flow",
      estimatedTime: "1-2 minutes",
      requirements: ["Google Workspace admin access", "Required API scopes"]
    },
    {
      id: 3,
      title: "Domain-wide Delegation",
      description: "Configure domain-wide delegation in your Google Admin Console",
      icon: Key,
      details: "Set up service account delegation for administrative access",
      estimatedTime: "3-5 minutes",
      requirements: ["Google Admin Console access", "Service account credentials"]
    },
    {
      id: 4,
      title: "Service Configuration",
      description: "Select which Google Workspace services to migrate",
      icon: Settings,
      details: "Choose from Gmail, Drive, Calendar, Contacts, Chat, Groups, Photos",
      estimatedTime: "1-2 minutes",
      requirements: ["Service selection", "Migration preferences"]
    },
    {
      id: 5,
      title: "Test Migration",
      description: "Run a test migration to validate the configuration",
      icon: Zap,
      details: "Validate setup with a small sample data migration",
      estimatedTime: "2-3 minutes",
      requirements: ["Completed configuration", "Test data available"]
    }
  ];

  return (
    <div className="space-y-6">
      {/* Compact Stepper Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-3 mb-4">
            <Building2 className="h-6 w-6 text-primary-600" />
            <span>Tenant Onboarding</span>
            <Badge variant="info" className="ml-auto">Step {currentStep} of 5</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={(currentStep / 5) * 100} className="mb-6" />
          
          {/* Compact Horizontal Stepper */}
          <div className="overflow-x-auto pb-4">
            <div className="flex items-center justify-between min-w-max px-4">
              {stepConfig.map((step, index) => {
                const isActive = currentStep === step.id;
                const isCompleted = currentStep > step.id;
                const Icon = step.icon;
                
                return (
                  <div key={step.id} className="flex items-center group relative">
                    {/* Step Circle */}
                    <div 
                      className={`relative flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all duration-200 ${
                        isCompleted 
                          ? 'bg-green-500 border-green-500 text-white shadow-lg' 
                          : isActive 
                          ? 'bg-primary-500 border-primary-500 text-white shadow-lg' 
                          : 'bg-gray-100 border-gray-300 text-gray-400 hover:bg-gray-200 hover:border-gray-400'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="h-6 w-6" />
                      ) : (
                        <Icon className="h-5 w-5" />
                      )}
                      
                      {/* Hover Tooltip */}
                      <div className="absolute bottom-full mb-3 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-50">
                        <div className="bg-gray-900 text-white text-xs rounded-lg px-4 py-3 shadow-xl whitespace-nowrap max-w-sm">
                          <div className="font-semibold text-center mb-1">{step.title}</div>
                          <div className="text-gray-300 text-center mb-2">{step.description}</div>
                          
                          <div className="space-y-1 text-left">
                            <div className="flex justify-between">
                              <span className="text-gray-400">Status:</span>
                              <span className={`font-medium ${
                                isCompleted ? 'text-green-400' :
                                isActive ? 'text-blue-400' :
                                'text-gray-300'
                              }`}>
                                {isCompleted ? 'Completed' : isActive ? 'In Progress' : 'Pending'}
                              </span>
                            </div>
                            
                            <div className="flex justify-between">
                              <span className="text-gray-400">Est. Time:</span>
                              <span className="text-gray-300">{step.estimatedTime}</span>
                            </div>
                            
                            <div className="mt-2 pt-2 border-t border-gray-700">
                              <div className="text-gray-400 text-center mb-1">Details</div>
                              <div className="text-gray-300 text-center text-xs">{step.details}</div>
                            </div>
                            
                            <div className="mt-2 pt-2 border-t border-gray-700">
                              <div className="text-gray-400 text-center mb-1">Requirements</div>
                              <div className="space-y-1">
                                {step.requirements.map((req, idx) => (
                                  <div key={idx} className="text-gray-300 text-xs flex items-center">
                                    <div className="w-1 h-1 bg-gray-500 rounded-full mr-2"></div>
                                    {req}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                          
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Step Label */}
                    <div className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 text-center">
                      <div className="text-xs font-medium text-gray-900 whitespace-nowrap">
                        Step {step.id}
                      </div>
                      <div className="text-xs text-gray-500 whitespace-nowrap max-w-20 truncate">
                        {step.title.split(' ')[0]}
                      </div>
                    </div>
                    
                    {/* Connector Line */}
                    {index < stepConfig.length - 1 && (
                      <div 
                        className={`flex-1 h-0.5 mx-4 transition-colors duration-300 min-w-16 ${
                          stepConfig[index + 1].id <= currentStep 
                            ? 'bg-green-400' 
                            : isActive || isCompleted
                            ? 'bg-primary-400'
                            : 'bg-gray-300'
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          
          <p className="text-sm text-secondary-700 mt-6 text-center">
            Complete the following steps to set up your Google Workspace migration tenant.
          </p>
        </CardContent>
      </Card>

      {/* Step 1: Tenant Registration */}
      <OnboardingStep
        step={1}
        title="Tenant Registration"
        description="Register your organization and configure basic settings"
        status={getStepStatus(1)}
        icon={<Database className="h-5 w-5 text-primary-600" />}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-1">
                Organization Name
              </label>
              <Input
                placeholder="Acme Corporation"
                value={tenantData.tenantName || ''}
                onChange={(e) => handleInputChange('tenantName', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-1">
                Admin Email
              </label>
              <Input
                placeholder="admin@acme.com"
                type="email"
                value={tenantData.adminEmail || ''}
                onChange={(e) => handleInputChange('adminEmail', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-1">
                Source Domain
              </label>
              <Input
                placeholder="old-domain.com"
                value={tenantData.sourceDomain || ''}
                onChange={(e) => handleInputChange('sourceDomain', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-1">
                Target Domain
              </label>
              <Input
                placeholder="new-domain.com"
                value={tenantData.targetDomain || ''}
                onChange={(e) => handleInputChange('targetDomain', e.target.value)}
              />
            </div>
          </div>
          
          {currentStep === 1 && (
            <Button 
              onClick={() => setCurrentStep(2)}
              className="mt-4"
              disabled={!tenantData.tenantName || !tenantData.adminEmail}
            >
              Continue to OAuth Setup
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </OnboardingStep>

      {/* Step 2: OAuth Authorization */}
      <OnboardingStep
        step={2}
        title="OAuth Authorization"
        description="Authorize our application to access your Google Workspace"
        status={getStepStatus(2)}
        icon={<Shield className="h-5 w-5 text-primary-600" />}
      >
        <div className="space-y-4">
          <Alert variant="info">
            <Info className="h-4 w-4" />
            <div className="ml-3">
              You'll be redirected to Google's authorization page to grant the necessary permissions.
            </div>
          </Alert>

          <div className="bg-secondary-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-secondary-900 mb-2">Required Scopes:</h4>
            <ul className="text-sm text-secondary-700 space-y-1">
              {requiredScopes.map((scope, index) => (
                <li key={index} className="flex items-center space-x-2">
                  <CheckCircle2 className="h-3 w-3 text-success-500" />
                  <span className="font-mono text-xs">{scope}</span>
                </li>
              ))}
            </ul>
          </div>

          {currentStep === 2 && !tenantData.oauthCompleted && (
            <Button onClick={handleOAuthAuthorization} className="w-full">
              <Shield className="h-4 w-4 mr-2" />
              Start OAuth Authorization
              <ExternalLink className="h-4 w-4 ml-2" />
            </Button>
          )}

          {tenantData.oauthCompleted && (
            <div className="flex items-center space-x-2 p-3 bg-success-50 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-success-500" />
              <span className="text-sm font-medium text-success-700">OAuth authorization completed successfully</span>
            </div>
          )}
        </div>
      </OnboardingStep>

      {/* Step 3: Domain-wide Delegation */}
      <OnboardingStep
        step={3}
        title="Domain-wide Delegation Configuration"
        description="Configure domain-wide delegation in your Google Admin Console"
        status={getStepStatus(3)}
        icon={<Key className="h-5 w-5 text-primary-600" />}
      >
        <div className="space-y-4">
          <Alert variant="warning">
            <Settings className="h-4 w-4" />
            <div className="ml-3">
              You need Super Admin privileges in your Google Workspace to complete this step.
            </div>
          </Alert>

          <div>
            <h4 className="text-sm font-medium text-secondary-900 mb-2">Service Account Client ID:</h4>
            <div className="flex items-center space-x-2">
              <code className="bg-secondary-100 px-3 py-2 rounded text-sm font-mono flex-1">
                {serviceAccountClientId}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigator.clipboard.writeText(serviceAccountClientId)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-secondary-900 mb-2">Configuration Instructions:</h4>
            <CodeBlock code={dwdInstructions} copyable={false} />
          </div>

          {currentStep === 3 && !tenantData.dwdConfigured && (
            <div className="space-y-2">
              <Button onClick={handleDWDVerification} className="w-full">
                <Key className="h-4 w-4 mr-2" />
                Verify DWD Configuration
              </Button>
              <p className="text-xs text-secondary-600 text-center">
                Click after completing the configuration in Admin Console
              </p>
            </div>
          )}

          {tenantData.dwdConfigured && (
            <div className="flex items-center space-x-2 p-3 bg-success-50 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-success-500" />
              <span className="text-sm font-medium text-success-700">Domain-wide delegation configured successfully</span>
            </div>
          )}
        </div>
      </OnboardingStep>

      {/* Step 4: Service Configuration */}
      <OnboardingStep
        step={4}
        title="Service Configuration"
        description="Select which Google Workspace services to migrate"
        status={getStepStatus(4)}
        icon={<Settings className="h-5 w-5 text-primary-600" />}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {['gmail', 'drive', 'calendar', 'contacts', 'chat', 'groups', 'photos'].map((service) => (
              <div key={service} className="flex items-center space-x-2 p-3 border rounded-lg">
                <input
                  type="checkbox"
                  id={service}
                  className="h-4 w-4 text-primary-600 border-secondary-300 rounded"
                  defaultChecked={['gmail', 'drive', 'calendar', 'contacts'].includes(service)}
                />
                <label htmlFor={service} className="text-sm font-medium text-secondary-700 capitalize">
                  {service}
                </label>
              </div>
            ))}
          </div>

          {currentStep === 4 && (
            <Button onClick={() => setCurrentStep(5)} className="w-full">
              <Settings className="h-4 w-4 mr-2" />
              Configure Services
            </Button>
          )}
        </div>
      </OnboardingStep>

      {/* Step 5: Test Migration */}
      <OnboardingStep
        step={5}
        title="Test Migration"
        description="Run a test migration to validate the configuration"
        status={getStepStatus(5)}
        icon={<Zap className="h-5 w-5 text-primary-600" />}
      >
        <div className="space-y-4">
          <Alert variant="info">
            <Info className="h-4 w-4" />
            <div className="ml-3">
              We'll migrate a small sample of data to ensure everything is working correctly.
            </div>
          </Alert>

          {currentStep === 5 && !tenantData.testMigrationCompleted && (
            <Button onClick={handleTestMigration} className="w-full">
              <Zap className="h-4 w-4 mr-2" />
              Start Test Migration
            </Button>
          )}

          {tenantData.testMigrationCompleted && (
            <div className="space-y-3">
              <div className="flex items-center space-x-2 p-3 bg-success-50 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-success-500" />
                <span className="text-sm font-medium text-success-700">Test migration completed successfully</span>
              </div>
              
              <Button className="w-full" size="lg">
                Complete Onboarding & Start Full Migration
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}
        </div>
      </OnboardingStep>
    </div>
  );
}
