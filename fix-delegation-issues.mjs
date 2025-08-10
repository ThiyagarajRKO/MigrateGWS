#!/usr/bin/env node

/**
 * Fix Domain-Wide Delegation Issues
 * This script helps diagnose and fix delegation configuration
 */

import fs from 'fs';
import path from 'path';

console.log('🔧 Fixing Domain-Wide Delegation Issues');
console.log('='.repeat(50));

// Check current configuration
function checkCurrentSetup() {
  console.log('\n📋 Current Setup Analysis:');
  
  // Check service account key
  const keyPath = './source-service-account-key.json';
  if (fs.existsSync(keyPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    console.log('✅ Service Account Configuration:');
    console.log(`   Email: ${serviceAccount.client_email}`);
    console.log(`   Client ID: ${serviceAccount.client_id}`);
    console.log(`   Project: ${serviceAccount.project_id}`);
    
    return serviceAccount;
  } else {
    console.log('❌ Service account key file not found');
    return null;
  }
}

// Generate delegation setup commands
function generateSetupCommands(serviceAccount) {
  console.log('\n🛠️  IMMEDIATE ACTIONS REQUIRED:');
  console.log('='.repeat(40));
  
  console.log('\n1️⃣ ADMIN CONSOLE SETUP:');
  console.log('   → Open: https://admin.google.com');
  console.log('   → Domain: migrate.arakutourism.net');
  console.log('   → Path: Security → API Controls → Domain-wide delegation');
  
  console.log('\n2️⃣ ADD DELEGATION ENTRY:');
  console.log(`   Client ID: ${serviceAccount.client_id}`);
  console.log('   Scopes: https://www.googleapis.com/auth/admin.directory.user,https://www.googleapis.com/auth/admin.directory.user.readonly,https://www.googleapis.com/auth/admin.directory.domain.readonly');
  
  console.log('\n3️⃣ VERIFICATION COMMANDS:');
  console.log('   → npm run verify-delegation');
  console.log('   → node verify-delegation-setup-complete.mjs');
  
  console.log('\n4️⃣ TEST DELEGATION:');
  console.log('   → node test-delegation.mjs');
  console.log('   → Check API endpoint: /api/v1/delegation/verify');
}

// Create quick fix script for testing
function createTestingFixScript() {
  const testFixScript = `#!/usr/bin/env node

/**
 * Quick Testing Fix - Simulate Delegation Success
 * WARNING: This is for testing only! Real delegation must be configured.
 */

console.log('🧪 Creating Testing Environment');
console.log('⚠️  WARNING: This simulates delegation for testing only!');

// Create a test verification token
const testToken = {
  domains: ['migrate.arakutourism.net'],
  adminEmails: { 'migrate.arakutourism.net': 'admin@migrate.arakutourism.net' },
  scenario: 'single-super-admin',
  delegationStatus: {
    source: { verified: true },  // Simulated
    dest: { verified: true }     // Simulated
  },
  timestamp: new Date().toISOString(),
  isTestMode: true
};

// Save test token
import fs from 'fs';
fs.writeFileSync('test-verification-token.json', JSON.stringify(testToken, null, 2));

console.log('✅ Test verification token created');
console.log('🔍 File: test-verification-token.json');
console.log('');
console.log('📋 To use in your app:');
console.log('1. Load this token instead of generating new one');
console.log('2. Set delegation status to verified in tests');
console.log('3. Remember: This is simulation only!');
console.log('');
console.log('🎯 Real fix still required:');
console.log('→ Configure actual domain-wide delegation');
console.log('→ Run: node verify-delegation-setup-complete.mjs');
`;

  fs.writeFileSync('create-test-delegation-fix.mjs', testFixScript);
  console.log('\n🧪 Created: create-test-delegation-fix.mjs');
  console.log('   → Run this for testing environment setup');
}

// Main execution
function main() {
  const serviceAccount = checkCurrentSetup();
  
  if (!serviceAccount) {
    console.log('\n❌ Cannot proceed without service account configuration');
    return;
  }
  
  generateSetupCommands(serviceAccount);
  createTestingFixScript();
  
  console.log('\n🎯 SUMMARY - THREE PATHS FORWARD:');
  console.log('='.repeat(45));
  console.log('');
  console.log('🏃‍♂️ IMMEDIATE TESTING:');
  console.log('   → node create-test-delegation-fix.mjs');
  console.log('   → Use test token for development');
  console.log('');
  console.log('🔧 PROPER SETUP:');
  console.log('   → Configure delegation in Admin Console');
  console.log('   → Run: node verify-delegation-setup-complete.mjs');
  console.log('');
  console.log('🧪 VERIFICATION:');
  console.log('   → Test endpoint: http://localhost:3000/api/v1/delegation/verify');
  console.log('   → Check useVerificationTokenGenerator hook');
  console.log('');
  console.log('📚 Documentation: DOMAIN_WIDE_DELEGATION_SETUP.md');
}

main();
