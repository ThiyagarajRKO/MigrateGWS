#!/usr/bin/env node

/**
 * Quick Domain-Wide Delegation Status Checker
 * This script checks which domains have delegation configured
 */

const domains = [
  'sample.arakutourism.net',
  'migrate.arakutourism.net',
  // Add more domains here as needed
];

async function checkDelegationStatus(domain) {
  console.log(`\n🔍 Checking delegation for: ${domain}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    const response = await fetch('http://localhost:3000/api/google-workspace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create-user',
        data: {
          userData: {
            primaryEmail: `delegation-test-${Date.now()}@${domain}`,
            name: { givenName: 'Test', familyName: 'User' },
            password: 'TempPassword123!',
            changePasswordAtNextLogin: true
          },
          adminEmail: `admin@${domain}`,
          domain: domain
        }
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`✅ ${domain}: Delegation configured correctly`);
      return { domain, status: 'configured', error: null };
    } else {
      console.log(`❌ ${domain}: ${result.message || result.error}`);
      return { domain, status: 'not_configured', error: result.message || result.error };
    }
  } catch (error) {
    console.log(`❌ ${domain}: ${error.message}`);
    return { domain, status: 'error', error: error.message };
  }
}

async function main() {
  console.log('🚀 Domain-Wide Delegation Status Check');
  console.log('═══════════════════════════════════════');
  
  const results = [];
  
  for (const domain of domains) {
    const result = await checkDelegationStatus(domain);
    results.push(result);
  }
  
  console.log('\n📊 Summary:');
  console.log('═══════════════════════════════════════');
  
  results.forEach(result => {
    const icon = result.status === 'configured' ? '✅' : '❌';
    console.log(`${icon} ${result.domain}: ${result.status}`);
    if (result.error && result.error.includes('delegation')) {
      console.log(`   💡 Needs delegation setup`);
    }
  });
  
  const needsSetup = results.filter(r => r.status !== 'configured');
  
  if (needsSetup.length > 0) {
    console.log('\n🔧 Domains needing delegation setup:');
    needsSetup.forEach(result => {
      console.log(`   • ${result.domain}`);
    });
    
    console.log('\n📋 Setup Instructions:');
    console.log('1. Go to admin.google.com for each domain');
    console.log('2. Navigate to: Security → API Controls → Domain-wide delegation');
    console.log('3. Add new with:');
    console.log('   - Client ID: 114333598950671892438');
    console.log('   - OAuth Scopes: https://www.googleapis.com/auth/admin.directory.user');
    console.log('4. Click "Authorize"');
  } else {
    console.log('\n🎉 All domains are properly configured!');
  }
}

main().catch(console.error);
