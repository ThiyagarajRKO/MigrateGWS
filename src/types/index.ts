// TypeScript type definitions for the GWS Migration Platform

export interface User {
  id: string;
  email: string;
  name: string;
  domain: string;
  isActive: boolean;
}

export interface Domain {
  id: string;
  name: string;
  isVerified: boolean;
  userCount: number;
}

export interface DomainMapping {
  id: string;
  source: string;
  target: string;
  mappingType: 'one-to-one' | 'one-to-many' | 'many-to-one';
  isActive: boolean;
}

export interface UserMapping {
  id: string;
  domainMappingId: string;
  sourceUser: string;
  targetUser: string;
  isActive: boolean;
}

export interface Migration {
  id: string;
  name: string;
  description?: string;
  sourceOrg: string;
  targetOrg: string;
  userCount: number;
  services: GoogleWorkspaceService[];
  status: MigrationStatus;
  progress: number;
  createdAt: string;
  lastUpdated: string;
  createdBy: string;
  domainMappings: DomainMapping[];
  userMappings: UserMapping[];
}

export type MigrationStatus = 'pending' | 'running' | 'completed' | 'failed' | 'paused';

export type GoogleWorkspaceService = 
  | 'Gmail'
  | 'Google Drive'
  | 'Google Calendar'
  | 'Google Contacts'
  | 'Google Photos'
  | 'Google Chat'
  | 'Shared Drives';

export interface MigrationJob {
  id: string;
  migrationId: string;
  service: GoogleWorkspaceService;
  status: JobStatus;
  progress: number;
  startTime?: string;
  endTime?: string;
  errorMessage?: string;
}

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'retrying';

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface MigrationStats {
  total: number;
  active: number;
  completed: number;
  failed: number;
  paused: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
