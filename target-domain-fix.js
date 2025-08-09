// Auto-generated target domain configuration
// This resolves the "Target Domain Configuration Required" error

export const targetDomainAdminEmails = {
  "sample.arakutourism.net": "admin@sample.arakutourism.net",
  "migrate.arakutourism.net": "admin@migrate.arakutourism.net"
};

export const applyCofiguration = () => {
  // For browser environment
  if (typeof window !== 'undefined') {
    // Store in sessionStorage for immediate use
    sessionStorage.setItem('targetAdminEmails', JSON.stringify(targetDomainAdminEmails));
    
    // Store in localStorage for persistence
    localStorage.setItem('targetDomainAdminEmails', JSON.stringify(targetDomainAdminEmails));
    
    console.log('✅ Target domain configuration applied to browser storage');
  }
  
  return targetDomainAdminEmails;
};

export default targetDomainAdminEmails;
