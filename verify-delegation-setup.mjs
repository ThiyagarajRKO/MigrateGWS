#!/usr/bin/env node

/**
 * Domain-Wide Delegation Verification Script
 * Run this after completing the Google Admin Console setup
 */

const { createServiceAccountService } = require('./src/lib/google-workspace');

async function verifyDelegationSetup() {
  console.log('🔍 Verifying Domain-Wide Delegation Setup...\n');
  
  const clientId = '114333598950671892438';
  const domain = 'rrgokuldham.com';
  const adminEmail = 'admin@rrgokuldham.com';
  
  console.log('📋 Configuration:');
  console.log(`   Client ID: ${clientId}`);
  console.log(`   Domain: ${domain}`);
  console.log(`   Admin Email: ${adminEmail}\n`);
  
  try {
    console.log('🔐 Testing service account authentication...');
    
    // Create service account service
    const service = createServiceAccountService(adminEmail);
    console.log('✅ Service account client created successfully');
    
    // Test domain access
    console.log('🌐 Testing domain access...');
    const domainResult = await service.listDomains();
    
    if (domainResult.success) {
      console.log('✅ Domain access successful');
      console.log(`   Found ${domainResult.domains.length} domain(s)`);
    } else {
      console.log('❌ Domain access failed:', domainResult.error);
      return false;
    }
    
    // Test user listing
    console.log('👥 Testing user access...');
    const userResult = await service.listUsers();
    
    if (userResult.success) {
      console.log('✅ User access successful');
      console.log(`   Found ${userResult.users.length} user(s)`);
      
      // Show first few users as sample
      if (userResult.users.length > 0) {
        console.log('   Sample users:');
        userResult.users.slice(0, 3).forEach(user => {
          console.log(`     - ${user.primaryEmail}`);
        });
      }
    } else {
      console.log('❌ User access failed:', userResult.error);
      return false;
    }
    
    console.log('\n🎉 Domain-Wide Delegation Setup SUCCESSFUL!');
    console.log('✅ All authentication tests passed');
    console.log('✅ Ready for migration operations');
    
    return true;
    
  } catch (error) {
    console.log('\n❌ Domain-Wide Delegation Setup FAILED');
    console.error('Error details:', error.message);
    
    if (error.message.includes('unauthorized_client')) {
      console.log('\n🔧 Solution:');
      console.log('   1. Go to Google Admin Console (https://admin.google.com)');
      console.log('   2. Navigate to Security > API Controls > Domain-wide delegation');
      console.log(`   3. Add Client ID: ${clientId}`);
      console.log('   4. Add the OAuth scopes from DOMAIN_WIDE_DELEGATION_SETUP.md');
      console.log('   5. Wait 10-15 minutes for propagation');
    }
    
    if (error.message.includes('Domain-wide delegation not configured')) {
      console.log('\n📖 Complete instructions: See DOMAIN_WIDE_DELEGATION_SETUP.md');
    }
    
    return false;
  }
}

// Run verification
verifyDelegationSetup()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Verification script error:', error);
    process.exit(1);
  });
