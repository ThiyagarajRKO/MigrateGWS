/**
 * IMMEDIATE FIX - Run this in your browser console
 * Copy and paste this entire script into your browser console
 * while on the migration wizard page to immediately fix the target domain configuration
 */

(function() {
  console.log('🔧 Applying Target Domain Configuration Fix...');
  
  // Target admin email configuration
  const targetAdminEmails = {
    'sample.arakutourism.net': 'admin@sample.arakutourism.net',
    'migrate.arakutourism.net': 'admin@migrate.arakutourism.net'
  };
  
  // Store in browser storage for immediate use
  sessionStorage.setItem('targetAdminEmails', JSON.stringify(targetAdminEmails));
  localStorage.setItem('targetDomainAdminEmails', JSON.stringify(targetAdminEmails));
  
  // Try to apply to React state if available
  if (window.React && window.React.version) {
    console.log('🔍 React detected, attempting to apply configuration...');
    
    // Look for state setters on window object
    if (window.setTargetAdminEmails) {
      window.setTargetAdminEmails(targetAdminEmails);
      console.log('✅ Applied via window.setTargetAdminEmails');
    }
    
    // Try to dispatch a custom event
    const event = new CustomEvent('targetDomainConfigUpdate', {
      detail: { targetAdminEmails }
    });
    window.dispatchEvent(event);
    console.log('📡 Dispatched targetDomainConfigUpdate event');
  }
  
  console.log('✅ Target Domain Configuration Applied!');
  console.log('📋 Configuration:', targetAdminEmails);
  console.log('📍 Now navigate to Domain Wide Delegation setup and the configuration should be available');
  console.log('🔄 If needed, refresh the page and the configuration will persist');
  
  // Return the configuration for manual use
  return targetAdminEmails;
})();
