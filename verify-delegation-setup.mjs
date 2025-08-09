#!/usr/bin/env node

/**
 * Quick setup verification for domain-wide delegation
 * This script helps verify that domain-wide delegation is properly configured
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadServiceAccount() {
  const serviceAccountPath = join(__dirname, 'source-service-account-key.json');
  if (!existsSync(serviceAccountPath)) {
    console.log('❌ Service account key file not found at:', serviceAccountPath);
    return null;
  }
  
  try {
    const serviceAccountKey = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    return serviceAccountKey;
  } catch (error) {
    console.log('❌ Error loading service account key:', error.message);
    return null;
  }
}

function checkSetup() {
  console.log('🔧 Domain-Wide Delegation Setup Verification\n');
  
  const serviceAccountKey = loadServiceAccount();
  if (!serviceAccountKey) {
    console.log('Cannot proceed without service account key.');
    return;
  }
  
  console.log('📋 Service Account Information:');
  console.log(`   Client ID: ${serviceAccountKey.client_id}`);
  console.log(`   Client Email: ${serviceAccountKey.client_email}`);
  console.log(`   Project ID: ${serviceAccountKey.project_id}`);
  
  console.log('\n✅ Required Configuration Steps:');
  console.log('\n1. **Enable Google Workspace APIs** (if not already done):');
  console.log('   • Go to: https://console.cloud.google.com/apis/dashboard');
  console.log('   • Enable: Admin SDK API');
  console.log('   • Enable: Google Workspace Admin API');
  
  console.log('\n2. **Configure Domain-Wide Delegation in Google Admin Console**:');
  console.log('   • Go to: https://admin.google.com');
  console.log('   • Navigate to: Security > API Controls > Domain-wide delegation');
  console.log('   • Click "Add new"');
  console.log(`   • Client ID: ${serviceAccountKey.client_id}`);
  console.log('   • OAuth Scopes (copy and paste exactly):');
  console.log('     https://www.googleapis.com/auth/admin.directory.user,https://www.googleapis.com/auth/admin.directory.domain,https://www.googleapis.com/auth/admin.directory.orgunit');
  
  console.log('\n3. **Verify Admin Permissions**:');
  console.log('   • Ensure your admin account has "Super Admin" privileges');
  console.log('   • For cross-tenant migration, verify admin permissions in each target domain');
  
  console.log('\n4. **Test Setup**:');
  console.log('   • After configuring delegation, wait 10-15 minutes for changes to propagate');
  console.log('   • Re-run the diagnostic script: node debug-cloning-failure.mjs <domain> <admin-email>');
  
  console.log('\n⚠️  **Common Issues**:');
  console.log('   • Incorrect OAuth scopes (must match exactly)');
  console.log('   • Wrong Client ID (use the numeric Client ID, not email)');
  console.log('   • Admin email lacks super admin privileges');
  console.log('   • Changes not yet propagated (wait 10-15 minutes)');
  
  console.log('\n📖 **Documentation Links**:');
  console.log('   • Domain-wide delegation: https://developers.google.com/admin-sdk/directory/v1/guides/delegation');
  console.log('   • Admin SDK API: https://developers.google.com/admin-sdk');
  console.log('   • OAuth scopes: https://developers.google.com/identity/protocols/oauth2/scopes#admin-sdk');
}

checkSetup();
