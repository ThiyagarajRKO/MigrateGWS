#!/usr/bin/env node

/**
 * Setup script to configure admin email for domain user discovery
 * This will help you set up the correct admin email for testing
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createInterface } from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function updateEnvFile(adminEmail) {
  try {
    const envPath = join(__dirname, '.env');
    let envContent = readFileSync(envPath, 'utf8');
    
    // Replace the TEST_ADMIN_EMAIL line
    const updatedContent = envContent.replace(
      /TEST_ADMIN_EMAIL=.*/,
      `TEST_ADMIN_EMAIL=${adminEmail}`
    );
    
    writeFileSync(envPath, updatedContent);
    console.log(`✅ Updated .env file with admin email: ${adminEmail}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to update .env file:', error.message);
    return false;
  }
}

function main() {
  console.log('🔧 GWS Domain User Discovery Setup');
  console.log('==================================');
  console.log('');
  console.log('To list users in sample.arakutourism.net and migrate.arakutourism.net,');
  console.log('you need to provide an admin email that has access to these domains.');
  console.log('');
  console.log('Requirements:');
  console.log('• The admin email must be a super admin in the Google Workspace');
  console.log('• The service account must have domain-wide delegation configured');
  console.log('• The admin email must have permission to manage users in both domains');
  console.log('');
  
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('Enter the admin email for arakutourism.net domains: ', (adminEmail) => {
    if (!adminEmail || !adminEmail.includes('@')) {
      console.log('❌ Invalid email format. Please provide a valid email address.');
      rl.close();
      return;
    }

    // Validate that it's likely an arakutourism.net email
    if (!adminEmail.includes('arakutourism.net')) {
      console.log('⚠️  Warning: The email doesn\'t appear to be from arakutourism.net');
      rl.question('Are you sure you want to continue? (y/N): ', (confirm) => {
        if (confirm.toLowerCase() === 'y' || confirm.toLowerCase() === 'yes') {
          if (updateEnvFile(adminEmail)) {
            console.log('');
            console.log('✅ Setup complete! You can now run:');
            console.log('   node list-domain-users.mjs');
          }
        } else {
          console.log('❌ Setup cancelled.');
        }
        rl.close();
      });
    } else {
      if (updateEnvFile(adminEmail)) {
        console.log('');
        console.log('✅ Setup complete! You can now run:');
        console.log('   node list-domain-users.mjs');
      }
      rl.close();
    }
  });
}

main();
