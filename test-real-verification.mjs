#!/usr/bin/env node

// Test script to verify the real service account verification is working
const API_BASE_URL = 'http://localhost:3001'

async function testSingleSuperAdminVerification() {
  console.log('🧪 Testing Single Super Admin Verification with Real Service Account...')
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/delegation/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        adminEmail: 'admin@rrgokuldham.com', // Using your actual admin email
        migrationScenario: 'single-super-admin'
      }),
    })

    const data = await response.json()
    
    if (response.ok) {
      console.log('✅ Single Super Admin Verification Response:')
      console.log(JSON.stringify(data, null, 2))
      
      if (data.verification?.domain?.verified) {
        console.log('🎉 Domain delegation is properly configured!')
      } else {
        console.log('⚠️ Domain delegation needs configuration')
        if (data.verification?.domain?.testResults) {
          data.verification.domain.testResults.forEach(test => {
            console.log(`  - ${test.test}: ${test.status} - ${test.message}`)
          })
        }
      }
    } else {
      console.error('❌ Request failed:', data)
    }
  } catch (error) {
    console.error('❌ Error testing single super admin verification:', error.message)
  }
}

async function testCrossTenantVerification() {
  console.log('\n🧪 Testing Cross-Tenant Verification with Real Service Account...')
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/delegation/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sourceAdminEmail: 'admin@rrgokuldham.com', // Using your actual source admin email
        destAdminEmail: 'admin@arakutourism.net', // Using your actual dest admin email
        migrationScenario: 'cross-tenant'
      }),
    })

    const data = await response.json()
    
    if (response.ok) {
      console.log('✅ Cross-Tenant Verification Response:')
      console.log(JSON.stringify(data, null, 2))
      
      const sourceVerified = data.verification?.source?.verified
      const destVerified = data.verification?.destination?.verified
      
      if (sourceVerified && destVerified) {
        console.log('🎉 Both domains are properly configured for cross-tenant migration!')
      } else {
        console.log('⚠️ One or both domains need configuration:')
        console.log(`  Source domain verified: ${sourceVerified}`)
        console.log(`  Destination domain verified: ${destVerified}`)
        
        if (data.verification?.source?.testResults) {
          console.log('  Source domain test results:')
          data.verification.source.testResults.forEach(test => {
            console.log(`    - ${test.test}: ${test.status} - ${test.message}`)
          })
        }
        
        if (data.verification?.destination?.testResults) {
          console.log('  Destination domain test results:')
          data.verification.destination.testResults.forEach(test => {
            console.log(`    - ${test.test}: ${test.status} - ${test.message}`)
          })
        }
      }
    } else {
      console.error('❌ Request failed:', data)
    }
  } catch (error) {
    console.error('❌ Error testing cross-tenant verification:', error.message)
  }
}

// Run tests
async function runTests() {
  console.log('🚀 Starting Real Service Account Verification Tests\n')
  
  await testSingleSuperAdminVerification()
  await testCrossTenantVerification()
  
  console.log('\n📝 Note: Replace the email addresses in this test file with your actual domain admin emails')
  console.log('   The verification will fail if:')
  console.log('   1. Domain-wide delegation is not configured in Google Admin Console')
  console.log('   2. Service account key file is missing or invalid')
  console.log('   3. Admin emails do not have sufficient permissions')
}

runTests().catch(console.error)
