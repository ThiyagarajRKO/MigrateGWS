# Enhanced Migration System Integration Guide

## Overview

The enhanced migration system adds advanced optimization features to your existing Google Workspace migration platform. This system provides:

- **Advanced Queue Management**: 10-20 concurrent workers with intelligent job distribution
- **Execution Coordination**: Phase-based migration with risk assessment and validation
- **Real-time Monitoring**: Live dashboards, alerts, and performance tracking
- **Contacts Migration**: Full Google Contacts support using People API
- **Comprehensive Reporting**: Detailed audit trails and quality assurance

## Key Components

### 1. Migration System Integration (`src/services/migration/integration.ts`)
The main integration layer that connects the advanced system with your existing app:

```typescript
import { migrationSystem } from '@/services/migration/integration';

// Initialize the system
await migrationSystem.initialize({
  maxWorkers: 10,
  enableSlackAlerts: false,
});

// Set up migration data
migrationSystem.setUserMappings(userMappings);
migrationSystem.setSelectedServices(['Gmail', 'Drive', 'Contacts']);
migrationSystem.setExecutionOptions({
  prioritizeReliability: true,
  maxConcurrentUsers: 10,
  deltaMode: false,
});

// Create and execute migration plan
const plan = await migrationSystem.createExecutionPlan('My Migration');
const validation = migrationSystem.validateExecutionPlan();
if (validation.isValid) {
  await migrationSystem.executeMigrationPlan(credentials);
}
```

### 2. Enhanced UI Components

#### Enhanced Migration Options (`src/components/EnhancedMigrationOptions.tsx`)
Advanced configuration UI with optimization presets:
- Speed vs Reliability optimization
- Concurrency controls (1-20 users)
- Delta mode and dry run options
- Error handling preferences
- Quick preset buttons (Fast/Safe/Test)

#### Migration Execution Controller (`src/components/MigrationExecutionController.tsx`)
Provides complete migration execution control:
- Execution plan creation and validation
- Migration start/pause/cancel controls
- Real-time status updates
- Report downloads (migration & audit)
- Session reset capabilities

#### Real-time Dashboard (`src/components/RealTimeMigrationDashboard.tsx`)
Live monitoring with comprehensive metrics:
- Overall progress and user completion stats
- Service-wise progress breakdown
- Queue performance metrics
- Rate limiting status
- Active alerts and warnings
- Current execution phase details

### 3. Enhanced Migration Page (`src/app/migrations/enhanced/page.tsx`)
Complete migration workflow with 6 steps:
1. **Scenario Selection** - Choose migration type
2. **Domain Mapping** - Map source to target domains  
3. **User Discovery** - Discover and map users
4. **Execution Options** - Configure advanced settings
5. **Migration Execution** - Execute and control migration
6. **Live Monitoring** - Monitor progress in real-time

## Integration Options

### Option 1: Use Enhanced Page (Recommended)
Navigate users to `/migrations/enhanced` for the full enhanced experience:

```typescript
// In your existing migration list or dashboard
<Button onClick={() => router.push('/migrations/enhanced')}>
  Create Enhanced Migration
</Button>
```

### Option 2: Integrate Components into Existing Pages
Add enhanced components to your existing `migrations/new/page.tsx`:

```typescript
import { EnhancedMigrationOptions } from '@/components/EnhancedMigrationOptions';
import { MigrationExecutionController } from '@/components/MigrationExecutionController';

// Add to your existing workflow
{currentStep === 'options' && (
  <EnhancedMigrationOptions
    options={executionOptions}
    onOptionsChange={setExecutionOptions}
  />
)}

{currentStep === 'execution' && (
  <MigrationExecutionController
    userMappings={userMappings}
    selectedServices={selectedServices}
    executionOptions={executionOptions}
    credentials={credentials}
  />
)}
```

### Option 3: API Integration
Use the enhanced migration API for programmatic control:

```typescript
// Initialize system
await fetch('/api/v1/enhanced-migration', {
  method: 'POST',
  body: JSON.stringify({ 
    action: 'initialize',
    maxWorkers: 10 
  }),
});

// Set migration data
await fetch('/api/v1/enhanced-migration', {
  method: 'POST',
  body: JSON.stringify({ 
    action: 'setUserMappings',
    mappings: userMappings 
  }),
});

// Execute migration
await fetch('/api/v1/enhanced-migration', {
  method: 'POST',
  body: JSON.stringify({ 
    action: 'executeMigrationPlan',
    credentials: authCredentials 
  }),
});
```

## Configuration

### Worker Configuration
Customize the queue manager settings:

```typescript
const workerConfig = {
  maxConcurrentJobs: 10,              // Total concurrent migrations
  maxConcurrentUsersPerWorker: 5,     // Users per worker
  maxConcurrentServicesPerUser: 2,    // Services per user
  workerHeartbeatInterval: 30000,     // Health check interval
  jobTimeoutMs: 3600000,              // 1 hour timeout
  cleanupInterval: 300000,            // 5 minute cleanup
};
```

### Monitoring Configuration
Set up alerts and thresholds:

```typescript
const monitoringConfig = {
  alertThresholds: {
    errorRatePercent: 5,              // Alert if >5% errors
    queueDepthLimit: 100,             // Alert if queue >100 jobs
    rateLimitHitsPerHour: 50,         // Alert if rate limited
    avgProcessingTimeMs: 300000,      // Alert if >5min average
    failedJobsLimit: 10,              // Alert if >10 failures
  },
  dashboardRefreshInterval: 5000,     // 5 second refresh
  alertCooldownMs: 300000,            // 5 minute cooldown
};
```

## Contact Migration Features

The enhanced system includes full Google Contacts migration:

### Supported Features
- Contact information (names, emails, phones, addresses)
- Contact groups and labels
- Custom fields and notes
- Profile photos
- Organization information
- Birthday and anniversary dates

### Migration Process
1. **Discovery**: Scan source contacts using People API
2. **Mapping**: Map contacts to target accounts
3. **Grouping**: Preserve contact groups and labels
4. **Migration**: Batch transfer with progress tracking
5. **Validation**: Verify transferred contacts

### Usage
```typescript
// Contacts are automatically included when selected
const selectedServices = ['Gmail', 'Drive', 'Contacts'];
migrationSystem.setSelectedServices(selectedServices);
```

## Best Practices

### Performance Optimization
- Start with conservative settings (5-10 concurrent users)
- Monitor error rates and adjust concurrency accordingly
- Use delta mode for incremental migrations
- Enable dry run for testing

### Reliability
- Always enable "Prioritize Reliability" for production
- Set "Pause on Error" for critical migrations
- Monitor rate limiting status
- Review validation results before execution

### Monitoring
- Keep the dashboard open during migrations
- Set up alert webhooks for automated notifications
- Download reports immediately after completion
- Perform quality assurance sampling

## Troubleshooting

### Common Issues
1. **High Error Rates**: Reduce concurrency, check credentials
2. **Rate Limiting**: Enable throttling, reduce request frequency
3. **Memory Issues**: Lower concurrent users, increase cleanup frequency
4. **Timeouts**: Increase job timeout, check network connectivity

### Debug Tools
- Check browser console for client-side errors
- Review migration reports for detailed error logs
- Use audit reports for data integrity verification
- Monitor queue metrics for performance bottlenecks

## Migration from Existing System

To migrate from your current migration system:

1. **Gradual Rollout**: Start with the enhanced page for new migrations
2. **Feature Parity**: Ensure all existing features work in enhanced mode
3. **Training**: Train users on new optimization features
4. **Monitoring**: Compare performance between old and new systems
5. **Full Migration**: Replace existing pages once validated

The enhanced system is designed to coexist with your existing migration workflow, allowing for a smooth transition while providing immediate benefits for new migrations.
