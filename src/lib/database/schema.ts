/**
 * Multi-Tenant Database Schema for Google Workspace Migration Platform
 * Supports enterprise-grade tenant isolation and configuration management
 */

export interface Tenant {
  id: string;
  name: string;
  domain: string; // Primary tenant domain
  status: 'active' | 'suspended' | 'trial' | 'inactive';
  subscription: {
    plan: 'starter' | 'professional' | 'enterprise' | 'custom';
    quotas: {
      maxMigrations: number;
      maxUsers: number;
      maxStorageGB: number;
      apiCallsPerMonth: number;
    };
    billing: {
      isActive: boolean;
      nextBillingDate: string;
      pricePerUser: number;
    };
  };
  settings: {
    allowCrossTenantMigration: boolean;
    requireApprovalForMigrations: boolean;
    retentionDays: number;
    enableAuditLogs: boolean;
  };
  created_at: string;
  updated_at: string;
}

export interface TenantDomainConfig {
  id: string;
  tenant_id: string;
  domain: string;
  type: 'source' | 'target';
  admin_email: string;
  is_verified: boolean;
  delegation_status: 'pending' | 'configured' | 'verified' | 'failed';
  oauth_scopes: string[];
  verification_token?: string;
  last_verified_at?: string;
  created_at: string;
  updated_at: string;
}

export interface TenantServiceAccount {
  id: string;
  tenant_id: string;
  client_id: string;
  client_email: string;
  private_key_id: string;
  // Private key stored encrypted
  private_key_encrypted: string;
  project_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Migration {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'cross-tenant';
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  
  // Domain mapping
  source_domains: string[];
  target_domains: string[];
  domain_mapping: Record<string, string[]>;
  
  // User selection
  selected_users: string[];
  user_mappings: UserMapping[];
  
  // Service configuration
  services: string[];
  service_configs: Record<string, ServiceConfig>;
  
  // Execution settings
  batch_size: number;
  retry_attempts: number;
  throttle_ms: number;
  
  // Progress tracking
  progress: {
    total_users: number;
    completed_users: number;
    failed_users: number;
    total_items: number;
    completed_items: number;
    failed_items: number;
    estimated_completion?: string;
  };
  
  // Scheduling
  scheduled_at?: string;
  started_at?: string;
  completed_at?: string;
  
  // Metadata
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface UserMapping {
  id: string;
  migration_id: string;
  source_email: string;
  target_email: string;
  source_domain: string;
  target_domain: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed' | 'skipped';
  error_message?: string;
  mapping_type: 'direct' | 'alias' | 'new_user';
  created_at: string;
  updated_at: string;
}

export interface ServiceConfig {
  enabled: boolean;
  options: {
    preserve_permissions?: boolean;
    preserve_sharing?: boolean;
    preserve_labels?: boolean;
    include_deleted?: boolean;
    date_range?: {
      start?: string;
      end?: string;
    };
    filters?: Record<string, any>;
  };
}

export interface MigrationJob {
  id: string;
  migration_id: string;
  tenant_id: string; // Add explicit tenant_id field
  service_type: string;
  user_mapping_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'retrying' | 'cancelled';
  priority: number;
  
  // Job data
  source_data: any;
  target_data?: any;
  error_details?: {
    message: string;
    stack?: string;
    retry_count: number;
    last_retry_at?: string;
  };
  
  // Progress
  items_total: number;
  items_processed: number;
  items_failed: number;
  
  // Timing
  queued_at: string;
  started_at?: string;
  completed_at?: string;
  estimated_duration?: number;
  
  // API quota tracking
  api_calls_made: number;
  quota_remaining?: number;
  
  created_at: string;
  updated_at: string;
}

export interface MigrationLog {
  id: string;
  tenant_id: string;
  migration_id?: string;
  job_id?: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'critical';
  message: string;
  context: {
    service?: string;
    user_email?: string;
    item_id?: string;
    api_endpoint?: string;
    response_code?: number;
    metadata?: Record<string, any>;
  };
  timestamp: string;
}

export interface APIQuotaUsage {
  id: string;
  tenant_id: string;
  service: string;
  endpoint: string;
  quota_limit: number;
  quota_used: number;
  quota_remaining: number;
  reset_at: string;
  window_start: string;
  window_end: string;
  created_at: string;
  updated_at: string;
}

export interface TenantUser {
  id: string;
  tenant_id: string;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'operator' | 'viewer';
  permissions: string[];
  is_active: boolean;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

// All types are already exported above as interfaces
