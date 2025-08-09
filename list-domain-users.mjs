#!/usr/bin/env node

/**
 * Script to list all users in specific domains
 * Lists users in sample.arakutourism.net and migrate.arakutourism.net
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables manually
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadEnv() {
  try {
    const envPath = join(__dirname, '.env');
    const envContent = readFileSync(envPath, 'utf8');
    const envVars = {};
    
    envContent.split('\n').forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        if (key && valueParts.length > 0) {
          envVars[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
        }
      }
    });
    
    // Set environment variables
    Object.assign(process.env, envVars);
    return envVars;
  } catch (error) {
    console.log('⚠️  Could not load .env file, using existing environment variables');
    return {};
  }
}

loadEnv();

const domains = ['sample.arakutourism.net', 'migrate.arakutourism.net'];

async function listUsersInDomain(domain) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`LISTING USERS IN: ${domain.toUpperCase()}`);
  console.log(`${'='.repeat(60)}`);

  try {
    // Use the admin email from environment or prompt for it
    const adminEmail = process.env.TEST_ADMIN_EMAIL || process.env.SOURCE_ADMIN_EMAIL || process.env.TARGET_ADMIN_EMAIL;
    
    if (!adminEmail || adminEmail === 'admin@your-domain.com') {
      console.error(`❌ No valid admin email found in environment variables`);
      console.log('Please set TEST_ADMIN_EMAIL in your .env file with a real admin email');
      console.log('Current TEST_ADMIN_EMAIL:', process.env.TEST_ADMIN_EMAIL);
      return;
    }

    console.log(`🔍 Discovering users with admin email: ${adminEmail}`);
    console.log(`🌐 Domain: ${domain}`);

    // First verify delegation
    console.log('\n📋 Verifying domain-wide delegation...');
    const verificationResponse = await fetch('http://localhost:3000/api/v1/delegation/verify', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        domain,
        adminEmail,
        migrationScenario: 'single-super-admin'
      })
    });

    const verificationData = await verificationResponse.json();
    
    if (!verificationResponse.ok || !verificationData.success) {
      console.error(`❌ Delegation verification failed for ${domain}:`);
      console.error(verificationData.error || verificationData.message);
      return;
    }

    console.log(`✅ Delegation verified for ${domain}`);

    // Now get users
    console.log('\n👥 Fetching users...');
    const params = new URLSearchParams({
      action: 'all-users',
      domain,
      includeSuspended: 'true', // Include suspended users for complete list
      adminEmail
    });

    const usersResponse = await fetch(`http://localhost:3000/api/google-workspace?${params}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await usersResponse.json();

    if (!usersResponse.ok) {
      console.error(`❌ Failed to fetch users from ${domain}:`);
      console.error(data.error || data.message);
      return;
    }

    const users = data.users || [];
    console.log(`\n✅ Found ${users.length} users in ${domain}`);

    if (users.length === 0) {
      console.log('📭 No users found in this domain');
      return;
    }

    // Display users in a formatted table
    console.log('\n📊 USER LIST:');
    console.log('-'.repeat(120));
    console.log(
      '| ' + 
      'Name'.padEnd(25) + ' | ' +
      'Email'.padEnd(35) + ' | ' +
      'Admin'.padEnd(6) + ' | ' +
      'Suspended'.padEnd(9) + ' | ' +
      'Last Login'.padEnd(20) + ' |'
    );
    console.log('-'.repeat(120));

    users.forEach(user => {
      const name = (user.name?.fullName || `${user.name?.givenName || ''} ${user.name?.familyName || ''}`.trim()).substring(0, 24);
      const email = user.primaryEmail.substring(0, 34);
      const isAdmin = user.isAdmin ? 'Yes' : 'No';
      const suspended = user.suspended ? 'Yes' : 'No';
      const lastLogin = user.lastLoginTime ? 
        new Date(user.lastLoginTime).toLocaleDateString() : 
        'Never';

      console.log(
        '| ' + 
        name.padEnd(25) + ' | ' +
        email.padEnd(35) + ' | ' +
        isAdmin.padEnd(6) + ' | ' +
        suspended.padEnd(9) + ' | ' +
        lastLogin.padEnd(20) + ' |'
      );
    });

    console.log('-'.repeat(120));

    // Summary statistics
    const adminUsers = users.filter(u => u.isAdmin).length;
    const suspendedUsers = users.filter(u => u.suspended).length;
    const activeUsers = users.filter(u => !u.suspended).length;
    const usersWithLastLogin = users.filter(u => u.lastLoginTime).length;

    console.log(`\n📈 DOMAIN STATISTICS:`);
    console.log(`   Total Users: ${users.length}`);
    console.log(`   Active Users: ${activeUsers}`);
    console.log(`   Suspended Users: ${suspendedUsers}`);
    console.log(`   Admin Users: ${adminUsers}`);
    console.log(`   Users with Login History: ${usersWithLastLogin}`);

    // Group by OU if available
    const ouGroups = {};
    users.forEach(user => {
      const ou = user.orgUnitPath || '/';
      if (!ouGroups[ou]) ouGroups[ou] = 0;
      ouGroups[ou]++;
    });

    if (Object.keys(ouGroups).length > 1) {
      console.log(`\n🏢 ORGANIZATIONAL UNITS:`);
      Object.entries(ouGroups).forEach(([ou, count]) => {
        console.log(`   ${ou}: ${count} users`);
      });
    }

    return users;

  } catch (error) {
    console.error(`❌ Error listing users in ${domain}:`, error.message);
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 Make sure the development server is running:');
      console.log('   npm run dev');
    }
  }
}

async function main() {
  console.log('🚀 GOOGLE WORKSPACE USER DISCOVERY');
  console.log('📅 Date:', new Date().toLocaleString());
  
  // Check if development server is running
  try {
    const healthCheck = await fetch('http://localhost:3000/api/health');
    if (!healthCheck.ok) {
      throw new Error('Server not responding');
    }
  } catch (error) {
    console.error('\n❌ Development server is not running or not accessible');
    console.log('💡 Please start the development server first:');
    console.log('   npm run dev');
    console.log('\nThen run this script again.');
    process.exit(1);
  }

  const allUsers = [];

  for (const domain of domains) {
    const users = await listUsersInDomain(domain);
    if (users) {
      allUsers.push(...users.map(user => ({ ...user, sourceDomain: domain })));
    }
    
    // Add delay between domains to respect rate limits
    if (domains.indexOf(domain) < domains.length - 1) {
      console.log('\n⏳ Waiting 2 seconds before next domain...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Overall summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 OVERALL SUMMARY');
  console.log(`${'='.repeat(60)}`);
  
  console.log(`Total Users Across All Domains: ${allUsers.length}`);
  
  domains.forEach(domain => {
    const domainUsers = allUsers.filter(u => u.sourceDomain === domain);
    console.log(`  ${domain}: ${domainUsers.length} users`);
  });

  // Check for potential duplicate users (same name across domains)
  const usersByName = {};
  allUsers.forEach(user => {
    const name = user.name?.fullName || `${user.name?.givenName || ''} ${user.name?.familyName || ''}`.trim();
    if (!usersByName[name]) usersByName[name] = [];
    usersByName[name].push(user);
  });

  const duplicateNames = Object.entries(usersByName).filter(([_, users]) => users.length > 1);
  
  if (duplicateNames.length > 0) {
    console.log(`\n👥 POTENTIAL DUPLICATE USERS (same name across domains):`);
    duplicateNames.forEach(([name, users]) => {
      console.log(`   ${name}:`);
      users.forEach(user => {
        console.log(`     - ${user.primaryEmail} (${user.sourceDomain})`);
      });
    });
  }

  console.log('\n✅ User discovery completed!');
}

main().catch(console.error);
