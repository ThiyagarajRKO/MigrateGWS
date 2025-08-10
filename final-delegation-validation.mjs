#!/usr/bin/env node

/**
 * Final verification: Check if we should use arakutourism.net instead of migrate.arakutourism.net
 */

import { google } from 'googleapis';
import fs from 'fs';

console.log('🔍 DOMAIN VALIDATION TEST');
console.log('=========================');
console.log('Testing if parent domain arakutourism.net has delegation configured');
console.log('');

// Load service account credentials
let credentials;
try {
  const credContent = fs.readFileSync('./source-service-account-key.json', 'utf8');
  credentials = JSON.parse(credContent);
} catch (error) {
  console.error('❌ Could not load service account credentials:', error.message);
  process.exit(1);
}

const SERVICE_ACCOUNT_EMAIL = credentials.client_email;
const CLIENT_ID = credentials.client_id;

console.log(`🔑 Service Account: ${SERVICE_ACCOUNT_EMAIL}`);
console.log(`🆔 Client ID: ${CLIENT_ID}`);
console.log('');

async function testDelegationSimple(domain, adminEmail) {
  console.log(`\n🧪 Testing delegation for ${domain} with ${adminEmail}`);
  
  try {
    const jwtClient = new google.auth.JWT({
      email: SERVICE_ACCOUNT_EMAIL,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/admin.directory.user'],
      subject: adminEmail
    });

    await jwtClient.authorize();
    
    const admin = google.admin({ version: 'directory_v1', auth: jwtClient });
    
    // Try to create a test user
    const testUser = {
      primaryEmail: `final-test-${Date.now()}@${domain}`,
      name: { givenName: 'Final', familyName: 'Test' },
      password: 'TempPassword123!',
      changePasswordAtNextLogin: true
    };
    
    const result = await admin.users.insert({ requestBody: testUser });
    
    console.log(`✅ SUCCESS! User created: ${result.data.primaryEmail}`);
    
    // Clean up
    await admin.users.delete({ userKey: result.data.id });
    console.log(`🧹 Test user deleted`);
    
    return true;
    
  } catch (error) {
    console.log(`❌ Failed: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🎯 FINAL DELEGATION VALIDATION');
  console.log('===============================');
  
  // Test configurations
  const tests = [
    { domain: 'arakutourism.net', adminEmail: 'admin@arakutourism.net' },
    { domain: 'migrate.arakutourism.net', adminEmail: 'admin@migrate.arakutourism.net' },
    { domain: 'migrate.arakutourism.net', adminEmail: 'admin@arakutourism.net' },
    { domain: 'arakutourism.net', adminEmail: SERVICE_ACCOUNT_EMAIL }
  ];
  
  const results = [];
  
  for (const test of tests) {
    const success = await testDelegationSimple(test.domain, test.adminEmail);
    results.push({ ...test, success });
  }
  
  const workingConfigs = results.filter(r => r.success);
  
  console.log('\n📊 FINAL RESULTS:');
  console.log('==================');
  
  if (workingConfigs.length > 0) {
    console.log('✅ WORKING CONFIGURATIONS:');
    workingConfigs.forEach(config => {
      console.log(`   🎉 Domain: ${config.domain}, Admin: ${config.adminEmail}`);
    });
    
    console.log('\n💡 RECOMMENDATION:');
    console.log(`   Use domain: ${workingConfigs[0].domain}`);
    console.log(`   Use admin email: ${workingConfigs[0].adminEmail}`);
    console.log(`   Update your application configuration accordingly.`);
    
  } else {
    console.log('❌ NO WORKING CONFIGURATIONS');
    console.log('\n🔧 ACTION REQUIRED:');
    console.log('   1. Verify which domain actually has Google Workspace');
    console.log('   2. Set up domain-wide delegation in the correct Google Admin Console');
    console.log(`   3. Use Client ID: ${CLIENT_ID}`);
    console.log('   4. Add scope: https://www.googleapis.com/auth/admin.directory.user');
    console.log('   5. Wait for propagation and test again');
    
    console.log('\n📝 DOMAIN SETUP CHECKLIST:');
    console.log('   □ Is arakutourism.net a Google Workspace domain?');
    console.log('   □ Is migrate.arakutourism.net a separate Workspace or subdomain?');
    console.log('   □ Which admin console should be used for delegation setup?');
  }
}

main().catch(console.error);
