/**
 * Quick Fix Script for Target Domain Configuration
 * Run this in your browser console or import it into your application
 */

// Extend Window interface for TypeScript
declare global {
  interface Window {
    setTargetAdminEmails?: (emails: {[domain: string]: string}) => void;
    quickFixTargetDomainConfig?: () => {[domain: string]: string};
    TARGET_DOMAIN_QUICK_FIX?: {[domain: string]: string};
  }
}

// Default admin email configuration for the domains mentioned in the error
const QUICK_FIX_CONFIG = {
  'sample.arakutourism.net': 'admin@sample.arakutourism.net',
  'migrate.arakutourism.net': 'admin@migrate.arakutourism.net'
};

/**
 * Browser Console Quick Fix
 * Run this in your browser console on the migration wizard page
 */
function quickFixTargetDomainConfig() {
  // Try to find and update the target admin emails state
  const targetDomains = ['sample.arakutourism.net', 'migrate.arakutourism.net'];
  
  console.log('🔧 Quick Fix: Configuring target domain admin emails...');
  console.log('Target Domains:', targetDomains);
  console.log('Admin Emails:', QUICK_FIX_CONFIG);
  
  // This assumes you're on a React page with state management
  // You would need to call the appropriate state setter function
  if (window.setTargetAdminEmails) {
    window.setTargetAdminEmails(QUICK_FIX_CONFIG);
    console.log('✅ Target admin emails configured via window.setTargetAdminEmails');
  } else {
    console.log('⚠️  Please manually set the target admin emails in your application:');
    console.log(JSON.stringify(QUICK_FIX_CONFIG, null, 2));
  }
  
  return QUICK_FIX_CONFIG;
}

/**
 * Next.js Application Integration
 * Use this in your application code
 */
export function configureTargetDomainAdmins() {
  return {
    targetDomains: ['sample.arakutourism.net', 'migrate.arakutourism.net'],
    adminEmails: QUICK_FIX_CONFIG,
    instructions: [
      'Replace admin emails with actual super admin addresses',
      'Ensure domain-wide delegation is configured',
      'Import this config in your migration wizard'
    ]
  };
}

/**
 * Environment Variable Format
 */
export function getEnvVariableFormat() {
  return Object.entries(QUICK_FIX_CONFIG)
    .map(([domain, email]) => {
      const envVar = domain.replace(/\./g, '_').toUpperCase();
      return `TARGET_ADMIN_EMAIL_${envVar}=${email}`;
    })
    .join('\n');
}

// Browser console usage
if (typeof window !== 'undefined') {
  window.quickFixTargetDomainConfig = quickFixTargetDomainConfig;
  window.TARGET_DOMAIN_QUICK_FIX = QUICK_FIX_CONFIG;
  console.log('🔧 Quick fix functions available:');
  console.log('  - quickFixTargetDomainConfig()');
  console.log('  - window.TARGET_DOMAIN_QUICK_FIX');
}

export default QUICK_FIX_CONFIG;
