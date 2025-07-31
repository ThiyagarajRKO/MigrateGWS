# Copilot Instructions for GWS Migration Platform

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

## Project Overview
This is a DIY Google Workspace to Google Workspace Migration Platform built with Next.js, TypeScript, and Tailwind CSS. The platform supports secure, scalable, and user-friendly GWS-to-GWS data migration.

## Key Features
- Domain and user mapping with visual tools
- Cross-tenant migration support
- Multi-service migration (Gmail, Drive, Calendar, Contacts, Photos, Chat)
- Real-time monitoring and progress tracking
- Comprehensive audit and reporting

## Architecture
- **Frontend**: Next.js 14 with TypeScript and Tailwind CSS
- **State Management**: Redux Toolkit
- **Visual Mapping**: React Flow for drag-and-drop interfaces
- **UI Components**: Custom components with Lucide React icons
- **Forms**: React Hook Form for form management
- **API**: Next.js API routes for backend functionality

## Code Style Guidelines
- Use TypeScript for all components and utilities
- Follow React functional component patterns with hooks
- Use Tailwind CSS for styling with consistent design tokens
- Implement proper error handling and loading states
- Create reusable components in the `src/components` directory
- Use proper TypeScript interfaces for data structures

## File Structure
```
src/
├── app/                    # Next.js app directory
├── components/            # Reusable UI components
├── lib/                   # Utility functions and configurations
├── types/                 # TypeScript type definitions
└── hooks/                 # Custom React hooks
```

## Migration-Specific Guidelines
- Always implement proper authentication flows for Google Workspace
- Handle OAuth scopes and permissions carefully
- Implement retry mechanisms for API calls
- Use proper data validation for user and domain mappings
- Include comprehensive error handling for migration processes
- Implement progress tracking for long-running operations

## Testing
- Write unit tests for utility functions
- Create integration tests for migration workflows
- Test all user mapping scenarios thoroughly
- Validate OAuth flows and permission handling
