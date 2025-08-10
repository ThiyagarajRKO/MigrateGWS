# MigrateGWS

A comprehensive DIY Google Workspace to Google Workspace Migration Platform built with Next.js, TypeScript, and modern web technologies.

## 🚀 Quick Start

1. **Clone and install**:
   ```bash
   git clone <repository>
   cd MigrateGWS
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your domain settings
   ```

3. **Setup domain delegation** (requires admin access):
   - See [Complete Documentation](./DOCUMENTATION.md) for detailed setup instructions

4. **Start the application**:
   ```bash
   npm run dev
   ```

## 📚 Complete Documentation

For detailed setup instructions, troubleshooting, and usage guidelines, see:
**[DOCUMENTATION.md](./DOCUMENTATION.md)**

This consolidated documentation includes:
- **Complete setup instructions**
- **Domain-wide delegation configuration**
- **Troubleshooting guide**
- **API usage and testing**
- **Development guidelines**

## 🛠️ Technology Stack

- **Frontend**: Next.js 14 with App Router, TypeScript, Tailwind CSS
- **State Management**: Redux Toolkit
- **Authentication**: OAuth 2.0 with Google Workspace
- **Forms**: React Hook Form
- **Icons**: Lucide React

## 🚀 Features

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

## 📁 Project Structure

```
src/
├── app/                          # Next.js app directory
│   ├── dashboard/               # Dashboard page
│   ├── migrations/              # Migration management
│   ├── globals.css             # Global styles
│   ├── layout.tsx              # Root layout
│   └── page.tsx                # Home page
├── components/                  # Reusable UI components
├── lib/                        # Utility functions and configurations
├── types/                      # TypeScript type definitions
└── hooks/                      # Custom React hooks
```

## 🎯 Development

```bash
# Development
npm run dev

# Build for production
npm run build
npm start

# Type checking
npm run type-check

# Linting
npm run lint
```

## 📞 Support

For detailed setup help, troubleshooting, and configuration instructions, see [DOCUMENTATION.md](./DOCUMENTATION.md).

---

**Ready to migrate?** Start with the [Complete Documentation](./DOCUMENTATION.md) for step-by-step setup instructions.
