#!/usr/bin/env node

/**
 * Quick setup script for target domain admin emails
 * This script helps configure admin emails for sample.arakutourism.net and migrate.arakutourism.net
 */

const fs = require('fs');
const path = require('path');

// Default configuration for the domains mentioned in the error
const TARGET_DOMAIN_CONFIG = {
  'sample.arakutourism.net': 'admin@sample.arakutourism.net',
  'migrate.arakutourism.net': 'admin@migrate.arakutourism.net'
};

/**
 * Updates the environment file with target domain admin configuration
 */
function updateEnvironmentConfig() {
  const envPath = path.join(process.cwd(), '.env');
  const envLocalPath = path.join(process.cwd(), '.env.local');
  
  let envContent = '';
  
  // Read existing .env file if it exists
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  } else if (fs.existsSync(envLocalPath)) {
    envContent = fs.readFileSync(envLocalPath, 'utf8');
  }

  // Add target domain admin email configuration
  const configLines = [
    '',
    '# Target Domain Admin Email Configuration',
    '# Configure admin emails for target Google Workspace domains',
    'TARGET_ADMIN_EMAIL_SAMPLE_ARAKUTOURISM=admin@sample.arakutourism.net',
    'TARGET_ADMIN_EMAIL_MIGRATE_ARAKUTOURISM=admin@migrate.arakutourism.net',
    '',
    '# Additional target domain admin emails (add as needed)',
    'TARGET_ADMIN_EMAILS_JSON={"sample.arakutourism.net":"admin@sample.arakutourism.net","migrate.arakutourism.net":"admin@migrate.arakutourism.net"}',
    ''
  ];

  // Check if configuration already exists
  if (!envContent.includes('TARGET_ADMIN_EMAIL_SAMPLE_ARAKUTOURISM')) {
    envContent += configLines.join('\n');
    
    // Write back to .env file
    fs.writeFileSync(envPath, envContent);
    console.log('✅ Updated .env file with target domain admin email configuration');
  } else {
    console.log('ℹ️  Target domain admin email configuration already exists in .env file');
  }
}

/**
 * Creates a configuration JSON file for easy import
 */
function createConfigFile() {
  const configPath = path.join(process.cwd(), 'target-domain-config.json');
  
  const config = {
    targetDomainAdminEmails: TARGET_DOMAIN_CONFIG,
    instructions: [
      "Replace the placeholder admin emails with actual super admin emails",
      "Ensure each admin has domain-wide delegation configured",
      "Import this configuration in your migration wizard"
    ],
    lastUpdated: new Date().toISOString()
  };

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log('✅ Created target-domain-config.json with default configuration');
}

/**
 * Main setup function
 */
function main() {
  console.log('🚀 Setting up target domain admin email configuration...\n');
  
  console.log('Target Domains:');
  Object.entries(TARGET_DOMAIN_CONFIG).forEach(([domain, email]) => {
    console.log(`  - ${domain} → ${email}`);
  });
  console.log('');

  try {
    updateEnvironmentConfig();
    createConfigFile();
    
    console.log('\n✅ Setup complete!\n');
    console.log('Next steps:');
    console.log('1. Update the admin email addresses in .env file with actual admin emails');
    console.log('2. Ensure each admin has domain-wide delegation configured for your service account');
    console.log('3. Navigate to the Domain Wide Delegation setup in your migration wizard');
    console.log('4. Configure the admin emails for each target domain');
    console.log('5. Proceed with "Get Target users by service account authentication"\n');
    
    console.log('Need help? Check the Target Domain Configuration section in your migration wizard.');

  } catch (error) {
    console.error('❌ Error during setup:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}
