# Service Account Domain-wide Delegation Setup Guide

## Overview

Service Account Domain-wide Delegation is a Google Workspace security feature that allows a service account to impersonate users within a domain. This is essential for Google Workspace to Google Workspace migrations as it enables the migration service to access user data across the entire organization.

## Why This Setup is Required

### Traditional OAuth Limitations
- Standard OAuth requires each user to individually authenticate
- Not practical for large-scale migrations with hundreds or thousands of users
- Users may not be available during migration windows
- Some users may not have the technical ability to complete OAuth flows

### Domain-wide Delegation Benefits
- **Single Authorization**: One-time setup by a Super Admin
- **Comprehensive Access**: Service can access all user data within the domain
- **Scalable**: Works for organizations of any size
- **Automated**: No individual user interaction required during migration
- **Secure**: Granular scope control and revocable access

## Security Considerations

### Admin Control
- Only Google Workspace Super Admins can configure domain-wide delegation
- Access can be revoked instantly from the Admin Console
- All API calls are logged and auditable
- Scopes are limited to only what's necessary for migration

### Data Protection
- Service account uses OAuth 2.0 for secure authentication
- All communications are encrypted (HTTPS/TLS)
- Access tokens have limited lifetimes
- No credentials are stored on client devices

### Compliance
- Meets enterprise security requirements
- Compatible with Google Workspace audit logs
- Supports compliance frameworks (SOC 2, GDPR, etc.)
- Allows for detailed activity monitoring

## Required Google Workspace Permissions

The following OAuth scopes are required for complete migration functionality:

### Directory API Scopes
- `https://www.googleapis.com/auth/admin.directory.user` - Read/manage users
- `https://www.googleapis.com/auth/admin.directory.domain` - Read domain information
- `https://www.googleapis.com/auth/admin.directory.group` - Read/manage groups

### Gmail API Scopes
- `https://www.googleapis.com/auth/gmail.readonly` - Read email messages
- `https://www.googleapis.com/auth/gmail.modify` - Manage email (for migration)

### Drive API Scopes
- `https://www.googleapis.com/auth/drive.readonly` - Read Drive files
- `https://www.googleapis.com/auth/drive.file` - Manage specific files

### Calendar API Scopes
- `https://www.googleapis.com/auth/calendar.readonly` - Read calendar events

### Contacts API Scopes
- `https://www.googleapis.com/auth/contacts.readonly` - Read contacts

## Step-by-Step Setup Process

### Prerequisites
1. You must be a Google Workspace Super Admin
2. Access to the Google Admin Console (admin.google.com)
3. The service account client ID from the migration service provider

### Configuration Steps

#### 1. Access Google Admin Console
- Navigate to [admin.google.com](https://admin.google.com)
- Sign in with your Super Admin account
- Verify you have access to the Security section

#### 2. Navigate to Domain-wide Delegation
- Go to **Security** → **API Controls** → **Domain-wide Delegation**
- You'll see a list of currently authorized clients (may be empty initially)

#### 3. Add New Client Authorization
- Click the **"Add new"** button
- Enter the service account client ID provided by the migration service
- This uniquely identifies the migration service to Google

#### 4. Configure OAuth Scopes
- In the OAuth scopes field, add all required scopes (comma-separated)
- These define exactly what the service can access
- Copy the complete scope list provided by the migration service

#### 5. Authorize and Verify
- Click **"Authorize"** to save the configuration
- The client should appear in your authorized clients list
- Verify all scopes are correctly configured

## Troubleshooting

### Common Issues

**"Insufficient Permissions" Error**
- Verify you're signed in as a Super Admin
- Check that your admin account has Security management permissions

**"Invalid Client ID" Error**
- Double-check the service account client ID
- Ensure there are no extra spaces or characters
- Verify the client ID is from the correct migration service

**"Invalid Scopes" Error**
- Ensure all scopes are comma-separated with no spaces
- Verify scope URLs are correctly formatted
- Check for typos in scope names

### Verification Steps

After setup, you can verify the configuration:

1. **Admin Console Check**
   - The client should appear in Domain-wide Delegation list
   - All required scopes should be listed
   - Status should show as "Authorized"

2. **Migration Service Test**
   - The migration service should be able to connect
   - API calls should return successful responses
   - No authentication errors in service logs

## Managing Access

### Monitoring Usage
- Review Google Workspace audit logs for API activity
- Monitor the Admin Console for any unusual activity
- Set up alerting for high-volume API usage if needed

### Revoking Access
If you need to remove access:
1. Go to **Security** → **API Controls** → **Domain-wide Delegation**
2. Find the migration service client
3. Click **"Delete"** to revoke authorization
4. Confirm the removal

### Updating Permissions
To modify scopes:
1. Find the existing client in Domain-wide Delegation
2. Click **"Edit"** or delete and re-add
3. Update the scope list as needed
4. Save the changes

## Best Practices

### Before Migration
- **Test with Small Dataset**: Verify access with a few test users first
- **Backup Critical Data**: Ensure you have backups before migration
- **Communicate with Users**: Inform users about the migration process
- **Schedule Appropriately**: Plan migrations during low-usage periods

### During Migration
- **Monitor Progress**: Keep track of migration status and any errors
- **Watch for Issues**: Be ready to pause migration if problems arise
- **Maintain Communication**: Update stakeholders on progress

### After Migration
- **Verify Data Integrity**: Confirm all data migrated correctly
- **Test User Access**: Ensure users can access their migrated data
- **Review and Cleanup**: Remove delegation if no longer needed
- **Document the Process**: Keep records for future reference

## Support and Resources

### Google Documentation
- [Domain-wide Delegation Guide](https://developers.google.com/admin-sdk/directory/v1/guides/delegation)
- [Google Workspace Admin Help](https://support.google.com/a/answer/162106)
- [API Scopes Reference](https://developers.google.com/identity/protocols/oauth2/scopes)

### Migration Service Support
- Contact your migration service provider for specific assistance
- Provide error messages and Admin Console screenshots if issues arise
- Keep the client ID and configuration details handy for support requests

## Conclusion

Service Account Domain-wide Delegation is a powerful and secure method for enabling large-scale Google Workspace migrations. While the initial setup requires careful attention to detail, it provides the foundation for efficient, automated data migration while maintaining enterprise-grade security controls.

The one-time setup investment pays dividends in migration efficiency and reduces the complexity of managing individual user authentications across large organizations.
