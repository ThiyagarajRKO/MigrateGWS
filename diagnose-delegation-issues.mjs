#!/usr/bin/env node

/**
 * Diagnose Domain-Wide Delegation Issues
 * Tests different admin email patterns to find the correct one
 */

import { google } from 'googleapis';
import fs from 'fs';

console.log('🔍 Diagnosing Domain-Wide Delegation Issues');
console.log('='.repeat(50));

const TARGET_DOMAIN = 'migrate.arakutourism.net';
const SERVICE_ACCOUNT_KEY_PATH = './source-service-account-key.json';
const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/admin.directory.user',
  'https://www.googleapis.com/auth/admin.directory.user.readonly',
  'https://www.googleapis.com/auth/admin.directory.domain.readonly'
];

async function testAdminEmail(adminEmail, serviceAccountKey) {
  try {
    console.log(`🔐 Testing admin email: ${adminEmail}`);
    
    const jwtClient = new google.auth.JWT({
      email: serviceAccountKey.client_email,
      key: serviceAccountKey.private_key,
      scopes: REQUIRED_SCOPES,
      subject: adminEmail
    });

    await jwtClient.authorize();
    console.log(`✅ SUCCESS: ${adminEmail} works!`);
    
    // Test actual API call
    const admin = google.admin({ version: 'directory_v1', auth: jwtClient });
    const users = await admin.users.list({
      customer: 'my_customer',
      domain: TARGET_DOMAIN,
      maxResults: 1
    });
    
    console.log(`✅ API CALL SUCCESS: Found ${users.data.users?.length || 0} users`);
    return { success: true, adminEmail, userCount: users.data.users?.length || 0 };
    
  } catch (error) {
    console.log(`❌ FAILED: ${adminEmail} - ${error.message}`);
    return { success: false, adminEmail, error: error.message };
  }
}

async function diagnoseIssue() {
  try {
    // Load service account
    const serviceAccountKey = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_KEY_PATH, 'utf8'));
    console.log(`📋 Service Account: ${serviceAccountKey.client_email}`);
    console.log(`📋 Client ID: ${serviceAccountKey.client_id}`);
    console.log(`📋 Target Domain: ${TARGET_DOMAIN}`);
    
    // Test various admin email patterns
    const adminEmailPatterns = [
      `admin@${TARGET_DOMAIN}`,
      `administrator@${TARGET_DOMAIN}`,
      `superadmin@${TARGET_DOMAIN}`,
      `root@${TARGET_DOMAIN}`,
      `postmaster@${TARGET_DOMAIN}`,
      // Add any known admin emails for this domain
      'admin@arakutourism.net',
      'administrator@arakutourism.net',
      'support@arakutourism.net',
      'contact@arakutourism.net'
    ];
    
    console.log('\n🧪 Testing Admin Email Patterns...');
    console.log('='.repeat(40));
    
    const results = [];
    for (const adminEmail of adminEmailPatterns) {
      const result = await testAdminEmail(adminEmail, serviceAccountKey);
      results.push(result);
      
      if (result.success) {
        console.log(`\n🎉 FOUND WORKING ADMIN: ${adminEmail}`);
        console.log(`   User count: ${result.userCount}`);
        break; // Stop on first success
      }
      
      // Small delay between attempts
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Summary
    console.log('\n📊 DIAGNOSIS SUMMARY:');
    console.log('='.repeat(30));
    
    const workingAdmins = results.filter(r => r.success);
    const failedAdmins = results.filter(r => !r.success);
    
    if (workingAdmins.length > 0) {
      console.log('✅ WORKING ADMIN EMAILS:');
      workingAdmins.forEach(admin => {
        console.log(`   → ${admin.adminEmail} (${admin.userCount} users found)`);
      });
      
      console.log('\n🎯 SOLUTION:');
      console.log(`1. Use admin email: ${workingAdmins[0].adminEmail}`);
      console.log('2. Update your application configuration');
      console.log('3. Test user creation with this admin email');
      
    } else {
      console.log('❌ NO WORKING ADMIN EMAILS FOUND');
      console.log('\n🔍 POSSIBLE ISSUES:');
      console.log('1. Domain-wide delegation not configured in Google Admin Console');
      console.log('2. Wrong Client ID in delegation setup');
      console.log('3. Insufficient OAuth scopes');
      console.log('4. Super admin email pattern not tested');
      
      console.log('\n🛠️  DEBUGGING STEPS:');
      console.log('1. Check Google Admin Console delegation settings');
      console.log(`2. Verify Client ID: ${serviceAccountKey.client_id}`);
      console.log('3. Check OAuth scopes in Admin Console');
      console.log('4. Try with actual super admin email of the domain');
      
      console.log('\n❌ FAILED PATTERNS:');
      failedAdmins.forEach(admin => {
        console.log(`   → ${admin.adminEmail}: ${admin.error}`);
      });
    }
    
  } catch (error) {
    console.error('\n💥 CRITICAL ERROR:', error.message);
  }
}

// Check for common delegation issues
function checkDelegationSetup() {
  console.log('\n🔧 DELEGATION SETUP CHECKLIST:');
  console.log('='.repeat(35));
  
  const serviceAccountKey = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_KEY_PATH, 'utf8'));
  
  console.log('□ Go to Google Admin Console');
  console.log('□ Navigate to Security → API Controls → Domain-wide delegation');
  console.log(`□ Add Client ID: ${serviceAccountKey.client_id}`);
  console.log('□ Add OAuth scopes:');
  REQUIRED_SCOPES.forEach(scope => {
    console.log(`  □ ${scope}`);
  });
  console.log('□ Click "Authorize"');
  console.log('□ Wait for propagation (15 minutes to 24 hours)');
  console.log('□ Test with actual super admin email');
}

// Main execution
async function main() {
  await diagnoseIssue();
  checkDelegationSetup();
  
  console.log('\n🎯 NEXT STEPS:');
  console.log('1. If working admin found: Update app configuration');
  console.log('2. If no admin works: Check delegation setup in Admin Console');
  console.log('3. Verify with actual domain super admin');
  console.log('4. Test again after any changes');
}

main().catch(console.error);
