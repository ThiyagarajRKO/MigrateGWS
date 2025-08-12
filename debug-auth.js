// Quick authentication debug script
const { createServiceAccountService } = require('./src/lib/google-workspace.ts');

async function testAuth() {
  try {
    console.log('Testing service account authentication...');
    
    const service = createServiceAccountService('admin@rrgokuldham.com');
    console.log('Service created successfully');
    
    // Try to list users - this will test the full auth flow
    const result = await service.listUsers();
    console.log('Users listed successfully:', result.success);
    console.log('User count:', result.users?.length || 0);
    
  } catch (error) {
    console.error('Authentication failed:', error.message);
    console.error('Full error:', error);
  }
}

testAuth();
