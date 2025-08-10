# MigrateGWS - Complete Documentation

A comprehensive DIY Google Workspace to Google Workspace Migration Platform built with Next.js, TypeScript, and modern web technologies.

## 🚀 Overview

### Core Migration Capabilities
- **Domain-Aware Migrations**: Support for same Super Admin and cross-tenant migrations
- **Visual Mapping Tools**: Drag-and-drop interface for domain and user mappings
- **Multi-Service Support**: Gmail, Drive, Calendar, Contacts, Photos, Chat, and Shared Drives
- **Real-time Monitoring**: Track migration progress with detailed analytics
- **Comprehensive Reporting**: Detailed audit trails and verification reports

### Mapping Scenarios
- **One-to-One Mapping**: Direct user and domain transformations
- **One-to-Many Mapping**: Split content across multiple targets
- **Many-to-One Mapping**: Consolidate multiple sources to single target
- **Regex Transformations**: Advanced pattern-based mapping rules

### Security & Authentication
- OAuth 2.0 integration with Google Workspace
- Domain-wide delegation support
- Cross-tenant authentication flows
- Secure credential management

## 🛠️ Technology Stack

- **Frontend**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Redux Toolkit
- **Forms**: React Hook Form
- **Icons**: Lucide React
- **Charts**: Recharts (planned)
- **Visual Mapping**: React Flow (planned)

## 📁 Project Structure

```
src/
├── app/                          # Next.js app directory
│   ├── dashboard/               # Dashboard page
│   ├── migrations/              # Migration management
│   │   ├── new/                # New migration wizard
│   │   └── [id]/               # Migration details (planned)
│   ├── settings/               # Settings pages (planned)
│   ├── globals.css             # Global styles
│   ├── layout.tsx              # Root layout
│   └── page.tsx                # Home page
├── components/                  # Reusable UI components
├── lib/                        # Utility functions and configurations
├── types/                      # TypeScript type definitions
└── hooks/                      # Custom React hooks
```

## 🚨 Critical Setup Requirements

### Domain-Wide Delegation Setup

**IMMEDIATE ACTION NEEDED** for full functionality. The administrator of your target domain must complete domain-wide delegation setup.

#### Service Account Information
- **Service Account Email**: `gws-permission@gws-migration-463208.iam.gserviceaccount.com`
- **Client ID**: `114333598950671892438`
- **Project**: `gws-migration-463208`

#### Required OAuth Scopes
```
https://www.googleapis.com/auth/admin.directory.user
https://www.googleapis.com/auth/admin.directory.user.readonly
https://www.googleapis.com/auth/admin.directory.domain.readonly
https://www.googleapis.com/auth/admin.directory.group
https://www.googleapis.com/auth/admin.directory.group.readonly
https://www.googleapis.com/auth/gmail.readonly
https://www.googleapis.com/auth/drive.readonly
https://www.googleapis.com/auth/calendar.readonly
```

## 🔧 Setup Instructions

### Step 1: Environment Configuration

1. **Copy environment file**:
   ```bash
   cp .env.example .env
   ```

2. **Configure your domain settings** in `.env`:
   ```properties
   TARGET_DOMAIN=your-domain.com
   TARGET_ADMIN_EMAIL_YOUR_DOMAIN_COM=admin@your-domain.com
   ```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Domain-Wide Delegation Setup (15 minutes)

**Who needs to do this:** Super Admin of your target Google Workspace domain

1. **Login to Google Admin Console**
   - Go to: https://admin.google.com
   - Sign in as super admin of your target domain

2. **Navigate to API Controls**
   - Go to: **Security** → **API Controls** → **Domain-wide delegation**
   - Or direct link: https://admin.google.com/ac/security/api-controls/domain-wide-delegation

3. **Add Service Account Authorization**
   - Click **"Add new"**
   - **Client ID**: `114333598950671892438`
   - **OAuth Scopes** (copy and paste):
     ```
     https://www.googleapis.com/auth/admin.directory.user,https://www.googleapis.com/auth/admin.directory.user.readonly,https://www.googleapis.com/auth/admin.directory.domain.readonly,https://www.googleapis.com/auth/admin.directory.group,https://www.googleapis.com/auth/admin.directory.group.readonly,https://www.googleapis.com/auth/gmail.readonly,https://www.googleapis.com/auth/drive.readonly,https://www.googleapis.com/auth/calendar.readonly
     ```

4. **Click "Authorize"**

5. **Wait for Propagation** (up to 24 hours, usually 15 minutes)

### Step 4: Start the Application

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

### Step 5: Verification

After delegation setup, test the configuration:

```bash
# Test delegation
node verify-delegation-setup-complete.mjs

# Check API endpoint
curl http://localhost:3000/api/v1/delegation/verify
```

Or use the built-in test page: `http://localhost:3000/test/user-creation`

## 🧪 Testing Scenarios

### Scenario A: Domain You Control (Recommended)
**Best option**: Use a domain where you have full admin access
- Result: Real user creation ✅
- You can see actual users created in Google Admin Console

### Scenario B: Domain You Don't Control
**Testing only**: Use sample domains for demonstration
- Result: Simulation mode 🟡
- Shows what would happen with proper delegation setup

## 🔄 Application Flow

### Service Account Verification Flow:
1. **Component mounts** → Auto-call service account verification
2. **Verification endpoint** → Validates service account credentials
3. **Generate token** → Creates verification token for flow validation
4. **Store token** → Saves token in sessionStorage via hook
5. **API calls** → Include verification token in requests

### User Creation Flow:
1. **Check verification token** → Ensure service account is verified
2. **Call user creation API** → Pass token and user data
3. **Service account auth** → API uses environment service account
4. **Delegation check** → Test if domain-wide delegation is configured
5. **Real creation OR simulation** → Based on delegation status

## 🎯 Expected Results

### With Proper Delegation Setup:
- ✅ Service account verification: **Success**
- ✅ User creation: **Real user created**
- ✅ API response: `{ success: true, user: {...} }`

### Without Delegation Setup:
- ✅ Service account verification: **Success**
- 🟡 User creation: **Simulation mode**
- 🟡 API response: `{ success: true, simulation: true, configurationRequired: {...} }`

### Authentication Errors:
- ❌ Service account verification: **Failed**
- ❌ User creation: **Authentication error**
- ❌ API response: `{ success: false, error: "..." }`

## 🔧 Troubleshooting

### Common Issues

#### "Not Authorized to access this resource/api"
- **Cause**: Delegation not set up yet
- **Solution**: Follow Step 3 in Setup Instructions above
- **Check**: Verify the Client ID matches exactly: `114333598950671892438`

#### "Domain not found"
- **Cause**: Incorrect domain spelling or no admin access
- **Solution**: Verify domain name and admin credentials

#### "Client not authorized"
- **Cause**: Client ID incorrectly entered
- **Solution**: Ensure Client ID is correctly entered: `114333598950671892438`

#### COOP (Cross-Origin-Opener-Policy) Errors
- **Problem**: `Cross-Origin-Opener-Policy policy would block the window.close call`
- **Solution**: The application uses COOP-safe popup management
- **Implementation**: OAuth flows use `useOAuth` hook with safe popup handling

#### Still Failing After Setup
- Try removing and re-adding the delegation entry in Google Admin Console
- Wait longer for propagation (up to 24 hours)
- Check browser console for detailed error messages

### Diagnostic Commands

Run these commands to diagnose issues:

```bash
# Check delegation status
node check-delegation-status.mjs

# Diagnose delegation issues
node diagnose-delegation-issues.mjs

# Fix delegation issues
node fix-delegation-issues.mjs

# Final delegation validation
node final-delegation-validation.mjs

# List domain users (after setup)
node list-domain-users.mjs
```

## 📝 Development

### Running in Development Mode

```bash
npm run dev
```

### Building for Production

```bash
npm run build
npm start
```

### Type Checking

```bash
npm run type-check
```

### Linting

```bash
npm run lint
```

## 🚀 Features in Development

- [ ] Visual drag-and-drop mapping interface
- [ ] Advanced migration scheduling
- [ ] Real-time progress monitoring
- [ ] Comprehensive audit reporting
- [ ] Multi-service migration support
- [ ] Advanced regex transformation rules
- [ ] Cross-tenant authentication flows
- [ ] Migration rollback capabilities

## 📞 Support

For issues related to domain-wide delegation setup:
- **Who needs to help:** Super Admin of your target Google Workspace domain
- **What they need:** 15 minutes access to Google Admin Console
- **When:** As soon as possible to enable full functionality

For technical issues:
- Check the troubleshooting section above
- Use the diagnostic commands
- Review browser console logs for detailed error information

## 🎯 Quick Start Checklist

- [ ] Clone the repository
- [ ] Copy `.env.example` to `.env` and configure your domain
- [ ] Install dependencies with `npm install`
- [ ] Contact your domain administrator to set up delegation
- [ ] Start the application with `npm run dev`
- [ ] Test using `http://localhost:3000/test/user-creation`
- [ ] Verify delegation with diagnostic commands
- [ ] Begin using the migration platform

---

**Status**: Ready for use with proper domain-wide delegation setup
**Next Steps**: Complete delegation setup and start migrating!
