# Google OAuth Setup Guide for GWS Migration Platform

## 📋 Overview
This guide walks you through setting up Google OAuth and Google Workspace API integration for the GWS Migration Platform.

## 🔧 Prerequisites
1. Google Cloud Console account
2. Google Workspace admin access (for testing)
3. Next.js application running locally

## 📝 Step-by-Step Setup

### 1. Google Cloud Console Setup

#### Create a New Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "New Project" 
3. Name: `GWS Migration Platform`
4. Click "Create"

#### Enable Required APIs
Navigate to "APIs & Services" > "Library" and enable:
- [x] Admin SDK API
- [x] Gmail API  
- [x] Google Drive API
- [x] Google Calendar API
- [x] People API (for Contacts)
- [x] Identity and Access Management (IAM) API

#### Configure OAuth Consent Screen
1. Go to "APIs & Services" > "OAuth consent screen"
2. Choose "Internal" (for Google Workspace) or "External"
3. Fill out required fields:
   - **App name**: GWS Migration Platform
   - **User support email**: your-email@domain.com
   - **Developer contact**: your-email@domain.com
4. Add scopes:
   ```
   https://www.googleapis.com/auth/admin.directory.user
   https://www.googleapis.com/auth/admin.directory.domain
   https://www.googleapis.com/auth/admin.directory.group
   https://www.googleapis.com/auth/gmail.readonly
   https://www.googleapis.com/auth/gmail.modify
   https://www.googleapis.com/auth/drive
   https://www.googleapis.com/auth/drive.file
   https://www.googleapis.com/auth/calendar
   https://www.googleapis.com/auth/contacts
   ```

#### Create OAuth 2.0 Credentials
1. Go to "APIs & Services" > "Credentials"
2. Click "+ CREATE CREDENTIALS" > "OAuth 2.0 Client IDs"
3. Application type: "Web application"
4. Name: "GWS Migration Platform Web Client"
5. Authorized redirect URIs:
   ```
   http://localhost:3000/api/auth/callback/google
   https://yourdomain.com/api/auth/callback/google
   ```
6. Save and copy:
   - **Client ID**
   - **Client Secret**

### 2. Environment Variables Setup

Update your `.env.local` file:

```bash
# NextAuth.js Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-super-secret-key-here

# Google OAuth Configuration  
GOOGLE_CLIENT_ID=your-google-client-id-here
GOOGLE_CLIENT_SECRET=your-google-client-secret-here
```

### 3. Google Workspace Admin Setup (For Testing)

#### Domain-Wide Delegation (Required for Admin APIs)
1. Go to [Google Admin Console](https://admin.google.com/)
2. Navigate to "Security" > "API Controls" > "Domain-wide delegation"
3. Click "Add new" 
4. Enter your OAuth Client ID
5. Add OAuth scopes:
   ```
   https://www.googleapis.com/auth/admin.directory.user,
   https://www.googleapis.com/auth/admin.directory.domain,
   https://www.googleapis.com/auth/admin.directory.group,
   https://www.googleapis.com/auth/gmail.readonly,
   https://www.googleapis.com/auth/gmail.modify,
   https://www.googleapis.com/auth/drive,
   https://www.googleapis.com/auth/calendar,
   https://www.googleapis.com/auth/contacts
   ```
6. Click "Authorize"

### 4. Testing the Implementation

#### Test Login Flow
1. Start the development server: `npm run dev`
2. Navigate to: `http://localhost:3000/login`
3. Click "Continue with Google Workspace"
4. Sign in with Google Workspace admin account
5. Grant permissions
6. Should redirect to `/dashboard`

#### Test API Access
After successful login, test the Google Workspace API endpoints:

```bash
# Test user access
curl http://localhost:3000/api/google-workspace?action=users

# Test domain info
curl http://localhost:3000/api/google-workspace?action=domains

# Test validation
curl http://localhost:3000/api/google-workspace?action=validate
```

## 🔍 Implementation Features

### ✅ Completed
- [x] NextAuth.js Google provider setup
- [x] Google Workspace API service layer
- [x] Authentication context and hooks
- [x] Protected route components
- [x] Login/logout functionality
- [x] Dashboard with Google Workspace data
- [x] API routes for GWS operations
- [x] TypeScript types for all entities

### 🔧 Google Workspace APIs Integrated
- [x] **Admin Directory API**: Users, domains, organization units
- [x] **Gmail API**: Message access and manipulation
- [x] **Google Drive API**: File listing and operations
- [x] **Calendar API**: Calendar access
- [x] **People API**: Contacts access

### 🎯 Authentication Features
- [x] **Google OAuth Flow**: Secure Google sign-in
- [x] **Session Management**: JWT-based sessions with NextAuth
- [x] **Token Refresh**: Automatic access token renewal
- [x] **Protected Routes**: Route-level authentication guards
- [x] **Role-based Access**: Different access levels for different user types

## 🚀 Usage Examples

### Login Process
```typescript
// Use the authentication hook
const { signInWithGoogle, user, isAuthenticated } = useAuth();

// Sign in with Google
await signInWithGoogle();

// Check authentication status
if (isAuthenticated && user?.provider === 'google') {
  // User is authenticated with Google Workspace
}
```

### API Integration
```typescript
// Use Google Workspace API hooks
const { getUsers, data, loading, error } = useGetUsers();
const { getDomains } = useGetDomains();

// Fetch users from a domain
await getUsers('example.com');

// Data will be available in the 'data' variable
console.log(data?.users);
```

### Protected Components
```typescript
// Wrap components that require authentication
<ProtectedRoute requireGoogle={true}>
  <MigrationDashboard />
</ProtectedRoute>

// Or use the HOC
const ProtectedMigrationPage = withAuth(MigrationPage, true);
```

## 🔐 Security Features

### Token Management
- Access tokens stored securely in server-side sessions
- Automatic token refresh before expiration
- Secure token exchange with Google APIs

### API Security
- Server-side API routes with session validation
- Proper error handling and rate limiting
- Scope-based permission checks

### Data Protection
- No sensitive data stored in client-side storage
- Encrypted communication with Google APIs
- Proper CORS and CSRF protection

## 🐛 Troubleshooting

### Common Issues

**1. "Not authenticated" errors**
- Check if environment variables are set correctly
- Verify Google OAuth credentials
- Ensure domain-wide delegation is configured

**2. "Insufficient permissions" errors**
- Check OAuth scopes in Google Cloud Console
- Verify domain-wide delegation scopes
- Ensure user has admin privileges (for Admin SDK)

**3. Token refresh failures**
- Check if refresh_token is being stored
- Verify Google OAuth configuration
- Check NextAuth.js setup

### Debug Mode
Enable debug logging in `.env.local`:
```bash
NEXTAUTH_DEBUG=true
```

## 📚 Next Steps

With OAuth implemented, you can now:

1. **Test the migration workflow** with real Google Workspace data
2. **Implement the visual mapping tools** using React Flow
3. **Build the actual migration services** for data transfer
4. **Add real-time progress tracking** during migrations
5. **Implement audit logging** for compliance

The authentication foundation is now complete and ready for production use!
