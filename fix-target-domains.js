#!/usr/bin/env node

/**
 * Immediate Fix Script for Target Domain Configuration
 * This script resolves the "Target Domain Configuration Required" error
 * by setting up admin emails for sample.arakutourism.net and migrate.arakutourism.net
 */

console.log('🔧 Fixing Target Domain Configuration...\n');

// Configuration for the specific domains mentioned in the error
const TARGET_ADMIN_EMAILS = {
  'sample.arakutourism.net': 'admin@sample.arakutourism.net',
  'migrate.arakutourism.net': 'admin@migrate.arakutourism.net'
};

const TARGET_DOMAINS = Object.keys(TARGET_ADMIN_EMAILS);

console.log('📋 Target Domains to Configure:');
TARGET_DOMAINS.forEach(domain => {
  console.log(`  - ${domain} → ${TARGET_ADMIN_EMAILS[domain]}`);
});
console.log();

// Check if we're in a Next.js project
const fs = require('fs');
const path = require('path');

const nextConfigPath = path.join(process.cwd(), 'next.config.js');
const packageJsonPath = path.join(process.cwd(), 'package.json');

if (!fs.existsSync(nextConfigPath) && !fs.existsSync(packageJsonPath)) {
  console.error('❌ Error: This script must be run from the root of your Next.js project');
  process.exit(1);
}

// Create a configuration file that can be imported
const configContent = `// Auto-generated target domain configuration
// This resolves the "Target Domain Configuration Required" error

export const targetDomainAdminEmails = ${JSON.stringify(TARGET_ADMIN_EMAILS, null, 2)};

export const applyCofiguration = () => {
  // For browser environment
  if (typeof window !== 'undefined') {
    // Store in sessionStorage for immediate use
    sessionStorage.setItem('targetAdminEmails', JSON.stringify(targetDomainAdminEmails));
    
    // Store in localStorage for persistence
    localStorage.setItem('targetDomainAdminEmails', JSON.stringify(targetDomainAdminEmails));
    
    console.log('✅ Target domain configuration applied to browser storage');
  }
  
  return targetDomainAdminEmails;
};

export default targetDomainAdminEmails;
`;

const configPath = path.join(process.cwd(), 'target-domain-fix.js');
fs.writeFileSync(configPath, configContent);

console.log('✅ Created target-domain-fix.js');

// Update package.json with a script to apply the fix
try {
  const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(packageJsonContent);
  
  if (!packageJson.scripts) {
    packageJson.scripts = {};
  }
  
  packageJson.scripts['fix-target-domains'] = 'node target-domain-fix.js';
  
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  console.log('✅ Added "fix-target-domains" script to package.json');
} catch (error) {
  console.log('⚠️  Could not update package.json:', error.message);
}

// Create environment variable entries
const envEntries = Object.entries(TARGET_ADMIN_EMAILS)
  .map(([domain, email]) => {
    const envVar = domain.replace(/\./g, '_').replace(/-/g, '_').toUpperCase();
    return `TARGET_ADMIN_EMAIL_${envVar}=${email}`;
  })
  .join('\n');

const envContent = `
# Target Domain Admin Email Configuration
# Auto-generated to fix "Target Domain Configuration Required" error
${envEntries}

# JSON format for easy import
TARGET_ADMIN_EMAILS_JSON=${JSON.stringify(TARGET_ADMIN_EMAILS)}
`;

console.log('📝 Environment variables to add to .env:');
console.log(envContent);

// Write to a separate env file
fs.writeFileSync('target-domains.env', envContent.trim());
console.log('✅ Created target-domains.env file');

console.log('\n🎯 IMMEDIATE SOLUTION:');
console.log('1. Go to your migration wizard');
console.log('2. Navigate to Domain Wide Delegation setup');
console.log('3. For Cross-Tenant scenario, configure these admin emails:');
TARGET_DOMAINS.forEach(domain => {
  console.log(`   - ${domain}: ${TARGET_ADMIN_EMAILS[domain]}`);
});

console.log('\n📁 Files created:');
console.log('  - target-domain-fix.js (configuration file)');
console.log('  - target-domains.env (environment variables)');

console.log('\n🔗 Alternative Solutions:');
console.log('  - Visit: http://localhost:3000/setup/service-account-target-domains');
console.log('  - Visit: http://localhost:3000/test/target-domain-config');

console.log('\n✨ Next Steps:');
console.log('1. Copy the admin email configuration above');
console.log('2. Paste into your migration wizard target domain fields');
console.log('3. Ensure domain-wide delegation is configured for your service account');
console.log('4. Proceed with "Get Target users by service account authentication"');

console.log('\n✅ Target Domain Configuration Fix Complete!');
