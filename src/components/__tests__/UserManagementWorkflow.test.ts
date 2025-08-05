/**
 * Test to verify source-to-target user mapping functionality
 * 
 * This test demonstrates how the enhanced UserManagementWorkflow
 * now provides explicit source-to-target user pairs for services migration.
 */

interface MockUser {
  id: string;
  primaryEmail: string;
  name: {
    givenName: string;
    familyName: string;
    fullName: string;
  };
  sourceDomain: string;
  isAdmin: boolean;
}

interface MockUserMapping {
  user: MockUser;
  targetDomain: string;
  targetEmail: string;
  status: 'created' | 'exists' | 'pending';
}

// Mock data representing what the UserManagementWorkflow would generate
const mockSelectedMappings: MockUserMapping[] = [
  {
    user: {
      id: 'user1',
      primaryEmail: 'john.doe@source1.com',
      name: {
        givenName: 'John',
        familyName: 'Doe',
        fullName: 'John Doe'
      },
      sourceDomain: 'source1.com',
      isAdmin: false
    },
    targetDomain: 'target.com',
    targetEmail: 'john.doe@target.com',
    status: 'created'
  },
  {
    user: {
      id: 'user2',
      primaryEmail: 'jane.smith@source2.com',
      name: {
        givenName: 'Jane',
        familyName: 'Smith',
        fullName: 'Jane Smith'
      },
      sourceDomain: 'source2.com',
      isAdmin: true
    },
    targetDomain: 'target.com',
    targetEmail: 'jane.smith@target.com',
    status: 'exists'
  }
];

// Mock admin configuration
const mockConfig = {
  sourceAdminEmails: {
    'source1.com': 'admin@source1.com',
    'source2.com': 'admin@source2.com'
  } as Record<string, string>,
  targetAdminEmails: {
    'target.com': 'admin@target.com'
  } as Record<string, string>,
  existingUserStatus: {
    'john.doe@target.com': { exists: false },
    'jane.smith@target.com': { exists: true }
  } as Record<string, { exists: boolean }>
};

// Function that mimics the enhanced onComplete callback logic
function createSourceToTargetUserPairs(mappings: MockUserMapping[]) {
  return mappings.map(mapping => ({
    sourceUser: {
      id: mapping.user.id,
      email: mapping.user.primaryEmail,
      name: mapping.user.name.fullName,
      domain: mapping.user.sourceDomain,
      isAdmin: mapping.user.isAdmin,
      adminEmail: mockConfig.sourceAdminEmails[mapping.user.sourceDomain] || ''
    },
    targetUser: {
      email: mapping.targetEmail,
      domain: mapping.targetDomain,
      adminEmail: mockConfig.targetAdminEmails[mapping.targetDomain] || '',
      exists: mockConfig.existingUserStatus[mapping.targetEmail]?.exists || false,
      created: mapping.status === 'created'
    },
    mappingId: mapping.user.id,
    status: mapping.status
  }));
}

// Test the functionality
console.log('=== Source-to-Target User Mapping Test ===');

const userPairs = createSourceToTargetUserPairs(mockSelectedMappings);

console.log('Generated User Pairs:');
userPairs.forEach((pair, index) => {
  console.log(`\nPair ${index + 1}:`);
  console.log(`  Source: ${pair.sourceUser.name} (${pair.sourceUser.email}) from ${pair.sourceUser.domain}`);
  console.log(`  Target: ${pair.targetUser.email} in ${pair.targetUser.domain}`);
  console.log(`  Status: ${pair.status} | Exists: ${pair.targetUser.exists} | Created: ${pair.targetUser.created}`);
  console.log(`  Source Admin: ${pair.sourceUser.adminEmail}`);
  console.log(`  Target Admin: ${pair.targetUser.adminEmail}`);
});

console.log('\n=== Services Migration Ready ===');
console.log(`Total user pairs available for migration: ${userPairs.length}`);
console.log(`New users created: ${userPairs.filter(p => p.targetUser.created).length}`);
console.log(`Existing users found: ${userPairs.filter(p => p.targetUser.exists).length}`);

export { createSourceToTargetUserPairs, userPairs };
