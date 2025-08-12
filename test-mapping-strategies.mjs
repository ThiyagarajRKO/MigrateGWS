#!/usr/bin/env node

/**
 * Comprehensive Test Suite for Migration Mapping Strategies
 * Tests all service APIs to ensure they properly handle:
 * - one-to-one mapping
 * - one-to-many mapping  
 * - many-to-one mapping
 */

// Use built-in fetch (available in Node.js 18+)
const fetch = globalThis.fetch || (await import('node-fetch')).default

const BASE_URL = 'http://localhost:3000'
const API_BASE = `${BASE_URL}/api/v1/migration`

// Test configurations for different mapping strategies
const TEST_CONFIGS = {
  'one-to-one': {
    scenario: 'cross-tenant',
    domainMapping: 'one-to-one',
    userMappings: [
      {
        sourceUserEmail: 'user1@source.com',
        targetUserEmail: 'user1@target.com'
      },
      {
        sourceUserEmail: 'user2@source.com',
        targetUserEmail: 'user2@target.com'
      }
    ]
  },
  'one-to-many': {
    scenario: 'cross-tenant',
    domainMapping: 'one-to-many',
    userMappings: [
      {
        sourceUserEmail: 'user1@source.com',
        targetUserEmail: 'user1@target1.com'
      },
      {
        sourceUserEmail: 'user2@source.com',
        targetUserEmail: 'user2@target2.com'
      },
      {
        sourceUserEmail: 'user3@source.com',
        targetUserEmail: 'user3@target3.com'
      }
    ]
  },
  'many-to-one': {
    scenario: 'cross-tenant',
    domainMapping: 'many-to-one',
    userMappings: [
      {
        sourceUserEmail: 'user1@source1.com',
        targetUserEmail: 'user1@target.com'
      },
      {
        sourceUserEmail: 'user2@source2.com',
        targetUserEmail: 'user2@target.com'
      },
      {
        sourceUserEmail: 'user3@source3.com',
        targetUserEmail: 'user3@target.com'
      }
    ]
  }
}

// Service configurations
const SERVICES = [
  {
    name: 'Gmail',
    endpoint: '/gmail',
    config: {
      migrationOptions: {
        includeLabels: true,
        includeFilters: true,
        includeSignature: true,
        batchSize: 10
      }
    }
  },
  {
    name: 'Drive',
    endpoint: '/drive',
    config: {
      migrationOptions: {
        preservePermissions: true,
        preserveSharing: true,
        includeMyDrive: true,
        includeSharedDrives: false,
        batchSize: 10
      }
    }
  },
  {
    name: 'Calendar',
    endpoint: '/calendar',
    config: {
      migrationOptions: {
        includeEvents: true,
        includeCalendars: true,
        preserveSharing: true,
        preservePermissions: true,
        batchSize: 10
      }
    }
  },
  {
    name: 'Contacts',
    endpoint: '/contacts',
    config: {
      migrationOptions: {
        includePersonalContacts: true,
        includeSharedContacts: false,
        includeGroups: true,
        preserveGroupMemberships: true,
        batchSize: 10
      }
    }
  },
  {
    name: 'Chat',
    endpoint: '/chat',
    config: {
      migrationOptions: {
        includeDirectMessages: true,
        includeSpaces: true,
        includeAttachments: true,
        preserveHistory: true,
        batchSize: 10
      }
    }
  },
  {
    name: 'Groups',
    endpoint: '/groups',
    config: {
      migrationOptions: {
        includeMembers: true,
        preserveSettings: true,
        includeAliases: true,
        preservePermissions: true
      }
    }
  },
  {
    name: 'Photos',
    endpoint: '/photos',
    config: {
      migrationOptions: {
        includeAlbums: true,
        includeSharedAlbums: true,
        preserveSharing: true,
        preserveMetadata: true,
        includeVideoFiles: true,
        batchSize: 10
      }
    }
  },
  {
    name: 'Forms',
    endpoint: '/forms',
    config: {
      migrationOptions: {
        includeForms: true,
        includeResponses: true,
        preserveSettings: true,
        preserveSharing: true,
        batchSize: 10
      }
    }
  },
  {
    name: 'Slides',
    endpoint: '/slides',
    config: {
      migrationOptions: {
        preservePermissions: true,
        preserveSharing: true,
        includeComments: true,
        preserveRevisionHistory: false,
        batchSize: 10
      }
    }
  }
]

class MappingStrategyTester {
  constructor() {
    this.results = []
    this.failures = []
  }

  async testService(service, strategy, config) {
    console.log(`\n🧪 Testing ${service.name} with ${strategy} mapping...`)
    
    const payload = {
      sourceAdminEmail: 'admin@source.com',
      targetAdminEmail: 'admin@target.com',
      ...config,
      ...service.config,
      dryRun: true,
      realDataMode: false
    }

    try {
      const response = await fetch(`${API_BASE}${service.endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-test-mode': 'true'
        },
        body: JSON.stringify(payload)
      })

      const result = await response.json()
      
      if (response.ok) {
        console.log(`✅ ${service.name} ${strategy}: SUCCESS`)
        this.results.push({
          service: service.name,
          strategy,
          status: 'success',
          message: result.message || 'Migration started successfully'
        })
        return true
      } else {
        console.log(`❌ ${service.name} ${strategy}: FAILED - ${result.error}`)
        this.failures.push({
          service: service.name,
          strategy,
          error: result.error,
          details: result.details
        })
        return false
      }
    } catch (error) {
      console.log(`❌ ${service.name} ${strategy}: ERROR - ${error.message}`)
      this.failures.push({
        service: service.name,
        strategy,
        error: 'Network/Server Error',
        details: error.message
      })
      return false
    }
  }

  async runAllTests() {
    console.log('🚀 Starting Migration Mapping Strategy Tests...\n')
    
    let totalTests = 0
    let passedTests = 0

    for (const strategy of Object.keys(TEST_CONFIGS)) {
      console.log(`\n📋 Testing ${strategy.toUpperCase()} mapping strategy:`)
      console.log('=' .repeat(50))
      
      for (const service of SERVICES) {
        totalTests++
        const success = await this.testService(service, strategy, TEST_CONFIGS[strategy])
        if (success) passedTests++
        
        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    // Test invalid configurations
    await this.testInvalidConfigurations()

    this.printSummary(totalTests, passedTests)
  }

  async testInvalidConfigurations() {
    console.log('\n📋 Testing Invalid Configuration Validation:')
    console.log('=' .repeat(50))

    const invalidConfigs = [
      {
        name: 'Invalid one-to-one (multiple source domains)',
        config: {
          scenario: 'cross-tenant',
          domainMapping: 'one-to-one',
          userMappings: [
            { sourceUserEmail: 'user1@source1.com', targetUserEmail: 'user1@target.com' },
            { sourceUserEmail: 'user2@source2.com', targetUserEmail: 'user2@target.com' }
          ]
        },
        expectedError: 'Invalid one-to-one mapping'
      },
      {
        name: 'Invalid one-to-many (multiple source domains)',
        config: {
          scenario: 'cross-tenant',
          domainMapping: 'one-to-many',
          userMappings: [
            { sourceUserEmail: 'user1@source1.com', targetUserEmail: 'user1@target1.com' },
            { sourceUserEmail: 'user2@source2.com', targetUserEmail: 'user2@target2.com' }
          ]
        },
        expectedError: 'Invalid one-to-many mapping'
      },
      {
        name: 'Invalid many-to-one (multiple target domains)',
        config: {
          scenario: 'cross-tenant',
          domainMapping: 'many-to-one',
          userMappings: [
            { sourceUserEmail: 'user1@source1.com', targetUserEmail: 'user1@target1.com' },
            { sourceUserEmail: 'user2@source2.com', targetUserEmail: 'user2@target2.com' }
          ]
        },
        expectedError: 'Invalid many-to-one mapping'
      }
    ]

    for (const invalidConfig of invalidConfigs) {
      console.log(`\n🧪 Testing ${invalidConfig.name}...`)
      
      const payload = {
        sourceAdminEmail: 'admin@source.com',
        targetAdminEmail: 'admin@target.com',
        ...invalidConfig.config,
        migrationOptions: { batchSize: 10 },
        dryRun: true,
        realDataMode: false
      }

      try {
        const response = await fetch(`${API_BASE}/gmail`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-test-mode': 'true'
          },
          body: JSON.stringify(payload)
        })

        const result = await response.json()
        
        if (!response.ok && result.error?.toLowerCase().includes('invalid') && result.error?.toLowerCase().includes(invalidConfig.expectedError.toLowerCase().split(' ')[1])) {
          console.log(`✅ Validation: Correctly rejected invalid configuration`)
        } else {
          console.log(`❌ Validation: Should have rejected invalid configuration`)
          this.failures.push({
            service: 'Validation',
            strategy: invalidConfig.name,
            error: 'Validation failed',
            details: `Should have rejected invalid configuration. Got: ${result.error}`
          })
        }
      } catch (error) {
        console.log(`❌ Validation Error: ${error.message}`)
      }
    }
  }

  printSummary(totalTests, passedTests) {
    console.log('\n\n📊 TEST SUMMARY')
    console.log('=' .repeat(50))
    console.log(`Total Tests: ${totalTests}`)
    console.log(`Passed: ${passedTests}`)
    console.log(`Failed: ${totalTests - passedTests}`)
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`)

    if (this.failures.length > 0) {
      console.log('\n❌ FAILURES:')
      this.failures.forEach(failure => {
        console.log(`   • ${failure.service} (${failure.strategy}): ${failure.error}`)
        if (failure.details) {
          console.log(`     Details: ${failure.details}`)
        }
      })
    }

    console.log('\n✅ SUCCESSFUL TESTS:')
    const successesByStrategy = {}
    this.results.forEach(result => {
      if (!successesByStrategy[result.strategy]) {
        successesByStrategy[result.strategy] = []
      }
      successesByStrategy[result.strategy].push(result.service)
    })

    Object.keys(successesByStrategy).forEach(strategy => {
      console.log(`   ${strategy.toUpperCase()}: ${successesByStrategy[strategy].join(', ')}`)
    })

    // Exit with appropriate code
    process.exit(this.failures.length > 0 ? 1 : 0)
  }
}

// Run the tests
async function main() {
  const tester = new MappingStrategyTester()
  await tester.runAllTests()
}

main().catch(error => {
  console.error('Test suite failed:', error)
  process.exit(1)
})
