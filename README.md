# MigrateGWS

A comprehensive DIY Google Workspace to Google Workspace Migration Platform built with Next.js, TypeScript, and modern web technologies.

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
├── components/                  # Reusable UI components (planned)
├── lib/                        # Utility functions (planned)
├── types/                      # TypeScript definitions (planned)
└── hooks/                      # Custom React hooks (planned)
```

## 🚦 Getting Started

### Prerequisites
- Node.js 18.0 or later
- npm or yarn package manager

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd MigrateGWS
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

## 🔧 Configuration

### Environment Variables
Create a `.env.local` file in the root directory:

```env
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret

# Database Configuration (planned)
DATABASE_URL=your_database_url

# Redis Configuration (planned)
REDIS_URL=your_redis_url
```

## 📋 Migration Workflow

### 1. Basic Configuration
- Define migration name and description
- Select services to migrate (Gmail, Drive, Calendar, etc.)

### 2. Domain Mapping
- Configure source and target domains
- Support for multiple domain mappings
- CSV import for bulk configurations

### 3. User Mapping
- Map individual users between domains
- Support for complex mapping scenarios
- Validation and conflict resolution

### 4. Review & Launch
- Pre-migration validation
- Comprehensive summary review
- Launch migration with monitoring

## 🔐 Security Considerations

### OAuth Setup
1. Create Google Cloud Project
2. Enable necessary APIs (Gmail, Drive, Calendar, etc.)
3. Configure OAuth consent screen
4. Create credentials for web application
5. Set up domain-wide delegation (if required)

### 🎯 All Scopes (Recommended):
- `https://www.googleapis.com/auth/gmail.readonly` - Read Gmail messages
- `https://www.googleapis.com/auth/gmail.modify` - Modify Gmail messages
- `https://www.googleapis.com/auth/drive` - Access Google Drive files
- `https://www.googleapis.com/auth/calendar` - Access Google Calendar
- `https://www.googleapis.com/auth/contacts` - Access Google Contacts
- `https://www.googleapis.com/auth/admin.directory.user` - Manage directory users
- `https://www.googleapis.com/auth/admin.directory.group` - Manage directory groups
- `https://www.googleapis.com/auth/photoslibrary` - Access Google Photos
- `https://www.googleapis.com/auth/chat.spaces` - Access Google Chat spaces
- `https://www.googleapis.com/auth/presentations` - Access Google Slides presentations
- `https://www.googleapis.com/auth/forms` - Access Google Forms
- `https://www.googleapis.com/auth/drive.file` - Access specific Drive files
- `https://www.googleapis.com/auth/spreadsheets` - Access Google Sheets (for Forms responses)
- `https://www.googleapis.com/auth/admin.directory.domain` - Manage domain settings
- `https://www.googleapis.com/auth/admin.directory.orgunit` - Manage organizational units

## 🧪 Testing Strategy

### Frontend Testing
- Component unit tests with Jest and React Testing Library
- Integration tests for migration workflows
- E2E tests with Playwright (planned)

### API Testing
- Unit tests for API routes
- Integration tests for Google Workspace APIs
- Mock testing for development

## 🚀 Deployment

### Vercel (Recommended)
1. Connect repository to Vercel
2. Configure environment variables
3. Deploy with automatic builds

### Docker (Alternative)
```dockerfile
# Dockerfile included in project
docker build -t gws-migration .
docker run -p 3000:3000 gws-migration
```

## 🗺️ Roadmap

### Phase 1: Foundation ✅
- [x] Project setup and basic UI
- [x] Landing page and navigation
- [x] Dashboard with migration overview
- [x] Migration listing and filtering
- [x] New migration wizard

### Phase 2: Core Features (In Progress)
- [ ] Google OAuth integration
- [ ] Domain and user mapping logic
- [ ] Visual mapping components with React Flow
- [ ] Migration job orchestration
- [ ] Real-time progress tracking

### Phase 3: Advanced Features
- [ ] Batch processing and queuing
- [ ] Advanced filtering and search
- [ ] Audit logging and reporting
- [ ] Error handling and retry mechanisms
- [ ] Performance optimization

### Phase 4: Enterprise Features
- [ ] Multi-tenant support
- [ ] Advanced authentication
- [ ] Custom transformation rules
- [ ] API for third-party integrations
- [ ] Comprehensive analytics

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow TypeScript best practices
- Use Tailwind CSS for styling
- Write comprehensive tests
- Follow the existing code structure
- Update documentation as needed

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Review existing issues and discussions

## 🔗 Related Resources

- [Google Workspace Admin SDK](https://developers.google.com/admin-sdk)
- [Gmail API Documentation](https://developers.google.com/gmail/api)
- [Google Drive API](https://developers.google.com/drive/api)
- [Google Calendar API](https://developers.google.com/calendar/api)
- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
