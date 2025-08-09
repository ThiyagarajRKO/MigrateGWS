#!/usr/bin/env node

/**
 * Quick setup utility for target domain service account configuration
 * Resolves: "Target Domain Configuration Required" error
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

console.log('🔧 Target Domain Service Account Setup\n');

// Default configurations
const targetDomainConfigs = {
  'sample.arakutourism.net': {
    adminEmail: 'admin@sample.arakutourism.net',
    description: 'Sample domain for testing migration scenarios',
    setupRequired: [
      'Create service account in Google Cloud Console',
      'Enable Domain-wide Delegation',
      'Add required OAuth scopes',
      'Configure admin email in Google Workspace Admin Console'
    ]
  },
  'migrate.arakutourism.net': {
    adminEmail: 'admin@migrate.arakutourism.net', 
    description: 'Migration target domain',
    setupRequired: [
      'Create service account in Google Cloud Console',
      'Enable Domain-wide Delegation',
      'Add required OAuth scopes',
      'Configure admin email in Google Workspace Admin Console'
    ]
  }
};

// Required OAuth scopes for domain-wide delegation
const requiredScopes = [
  'https://www.googleapis.com/auth/admin.directory.user',
  'https://www.googleapis.com/auth/admin.directory.user.readonly',
  'https://www.googleapis.com/auth/admin.directory.group',
  'https://www.googleapis.com/auth/admin.directory.group.readonly',
  'https://www.googleapis.com/auth/admin.directory.domain',
  'https://www.googleapis.com/auth/admin.directory.domain.readonly',
  'https://www.googleapis.com/auth/admin.directory.orgunit',
  'https://www.googleapis.com/auth/admin.directory.orgunit.readonly'
];

console.log('📋 Target Domain Configurations:\n');

Object.entries(targetDomainConfigs).forEach(([domain, config]) => {
  console.log(`🌐 ${domain}`);
  console.log(`   Admin Email: ${config.adminEmail}`);
  console.log(`   Description: ${config.description}`);
  console.log(`   Setup Steps:`);
  config.setupRequired.forEach((step, index) => {
    console.log(`      ${index + 1}. ${step}`);
  });
  console.log('');
});

console.log('🔑 Required OAuth Scopes:\n');
requiredScopes.forEach((scope, index) => {
  console.log(`   ${index + 1}. ${scope}`);
});

// Generate environment configuration
const envConfig = `
# Target Domain Configuration - Auto-generated
# Generated: ${new Date().toISOString()}

# Sample Domain Configuration
SAMPLE_ARAKUTOURISM_ADMIN_EMAIL=admin@sample.arakutourism.net

# Migrate Domain Configuration  
MIGRATE_ARAKUTOURISM_ADMIN_EMAIL=admin@migrate.arakutourism.net

# Service Account Configuration (replace with your actual values)
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@your-project-id.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nYOUR_PRIVATE_KEY_HERE\\n-----END PRIVATE KEY-----"
`;

try {
  writeFileSync(join(process.cwd(), 'target-domains.env'), envConfig.trim());
  console.log('\n✅ Generated target-domains.env configuration file');
} catch (error) {
  console.log('\n❌ Failed to write configuration file:', error.message);
}

// Generate setup instructions
const setupInstructions = `
# Target Domain Setup Instructions

## Overview
This guide helps you configure domain-wide delegation for target domains:
- sample.arakutourism.net
- migrate.arakutourism.net

## Step 1: Google Cloud Console Setup

1. Go to Google Cloud Console (https://console.cloud.google.com)
2. Create or select your project
3. Enable the Admin SDK API
4. Create a service account:
   - Go to IAM & Admin > Service Accounts
   - Click "Create Service Account"
   - Enter name: "GWS Migration Service Account"
   - Enable "Enable Google Workspace Domain-wide Delegation"
   - Download the JSON key file

## Step 2: Configure OAuth Scopes

Add these scopes to your service account in Google Workspace Admin Console:

${requiredScopes.map(scope => `- ${scope}`).join('\n')}

## Step 3: Target Domain Admin Configuration

For each target domain, ensure the admin email has:
- Super Admin privileges in Google Workspace
- Domain-wide delegation configured for your service account
- Access to Admin SDK APIs

### sample.arakutourism.net
- Admin Email: admin@sample.arakutourism.net
- Required: Configure domain-wide delegation in Admin Console

### migrate.arakutourism.net  
- Admin Email: admin@migrate.arakutourism.net
- Required: Configure domain-wide delegation in Admin Console

## Step 4: Verification

Use the migration platform's delegation verification feature to test:
1. Navigate to Domain-wide Delegation Setup
2. Enter admin emails for each target domain
3. Click "Verify Domain-wide Delegation"
4. Ensure all verifications pass

## Troubleshooting

If you encounter "Target Domain Configuration Required" error:
1. Verify admin emails are configured in delegation setup
2. Check domain-wide delegation is enabled for service account
3. Ensure OAuth scopes are properly configured
4. Verify admin users have Super Admin privileges

## Environment Configuration

Copy the generated target-domains.env file and update with your actual values:
1. Replace placeholder service account details
2. Verify admin email addresses are correct
3. Load environment variables in your application

Generated: ${new Date().toISOString()}
`;

try {
  writeFileSync(join(process.cwd(), 'TARGET_DOMAIN_SETUP_GUIDE.md'), setupInstructions.trim());
  console.log('✅ Generated TARGET_DOMAIN_SETUP_GUIDE.md instructions');
} catch (error) {
  console.log('❌ Failed to write setup guide:', error.message);
}

console.log('\n🎉 Setup Complete!');
console.log('\n📝 Next Steps:');
console.log('1. Review the generated TARGET_DOMAIN_SETUP_GUIDE.md');
console.log('2. Update target-domains.env with your actual service account details');
console.log('3. Configure domain-wide delegation in Google Workspace Admin Console');
console.log('4. Test the configuration using the migration platform');
console.log('\n✨ This should resolve the "Target Domain Configuration Required" error!');
