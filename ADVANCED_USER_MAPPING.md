# Advanced User Mapping Strategies Documentation

## Overview
The GWS Migration Platform supports four sophisticated user mapping strategies to handle complex multi-domain migration scenarios. These strategies are implemented with intelligent algorithms that handle user cloning and merging based on first name and last name matching.

## Mapping Strategies

### 1. One-to-One Mapping
**Use Case:** Simple domain consolidation  
**Logic:** Direct 1:1 mapping to primary target domain  
**Example:** `john@company.com` → `john@target.com`

**Features:**
- Simple and fast migration
- Maintains original usernames
- Maps all users to primary target domain
- Ideal for straightforward domain changes

### 2. One-to-Many Mapping (User Cloning)
**Use Case:** Geographic distribution, backup users  
**Logic:** Clone each source user to ALL target domains  
**Example:** `john@company.com` → `john.company@target1.com`, `john.company@target2.com`

**Features:**
- Creates multiple copies of each user across domains
- Email format: `username.sourcedomain@targetdomain.com` to prevent conflicts
- Preserves all user attributes (admin status, org units, etc.)
- Total users created: `source_users × target_domains`

**Algorithm:**
```typescript
for each sourceUser:
  for each targetDomain:
    create targetUser with email: `${username}.${sourceDomain}@${targetDomain}`
    preserve all attributes from sourceUser
```

### 3. Many-to-One Mapping (User Merging)
**Use Case:** Company mergers, duplicate user cleanup  
**Logic:** Merge users with same first+last name into single target user  
**Example:** `john.doe@company-a.com` + `john.doe@company-b.com` → `john.doe@target.com`

**Features:**
- Groups users by exact first name + last name match (case-insensitive)
- Admin status combined (true if ANY source user is admin)
- All source emails documented for data migration reference
- Unique names only: reduces total user count

**Algorithm:**
```typescript
const userGroups = groupBy(sourceUsers, user => 
  `${user.name.givenName}.${user.name.familyName}`.toLowerCase()
);

for each group:
  create single targetUser with:
    - email: `${firstName}.${lastName}@${primaryTargetDomain}`
    - isAdmin: any source user was admin
    - sourceEmails: all original email addresses
```

### 4. Many-to-Many Mapping (Smart Distribution)
**Use Case:** Complex organizational restructuring  
**Logic:** Smart distribution based on source domain relationships  
**Example:** Users distributed based on source domain preferences and load balancing

**Features:**
- Users grouped by source domain first
- Each source domain group maps to corresponding target domain
- Load balancing when source domains exceed target domains
- Preserves organizational structure and domain relationships

## Implementation Details

### Name Normalization
```typescript
function normalizeUserName(user: GoogleWorkspaceUser): string {
  const firstName = user.name.givenName?.toLowerCase().trim() || '';
  const lastName = user.name.familyName?.toLowerCase().trim() || '';
  return `${firstName}.${lastName}`;
}
```

### Email Generation
```typescript
function generateTargetEmail(
  sourceUser: GoogleWorkspaceUser, 
  targetDomain: string, 
  mappingType: string
): string {
  const baseName = normalizeUserName(sourceUser);
  
  if (mappingType === 'one-to-many') {
    // Prevent conflicts by including source domain
    const sourceDomain = sourceUser.sourceDomain.replace('.com', '');
    return `${baseName}.${sourceDomain}@${targetDomain}`;
  }
  
  return `${baseName}@${targetDomain}`;
}
```

### Conflict Resolution
- **Email Conflicts:** Automatically resolved with domain prefixes
- **Admin Rights:** Preserved and combined intelligently
- **Duplicate Names:** Handled gracefully with source domain suffixes
- **Data Migration:** All source emails tracked for data transfer

## API Integration

### Target User Creation
```typescript
// Batch creation with rate limiting
const createUsers = async (mappings: UserMapping[]) => {
  const batches = chunkArray(mappings, BATCH_SIZE);
  
  for (const batch of batches) {
    await Promise.all(batch.map(mapping => 
      createTargetUser(mapping, targetAdminEmail)
    ));
    
    // Rate limiting between batches
    await delay(RATE_LIMIT_DELAY);
  }
};
```

### Error Handling
- Exponential backoff for API failures
- Comprehensive retry mechanisms
- Detailed error reporting and logging
- Pause/resume functionality for large migrations

## Best Practices

### When to Use Each Strategy
- **One-to-One:** Simple domain consolidation, minimal complexity
- **One-to-Many:** Geographic distribution, creating backup accounts
- **Many-to-One:** Company mergers, cleaning up duplicate users
- **Many-to-Many:** Complex organizational restructuring with multiple domains

### Important Considerations
- **Name Matching:** Based on exact first+last name (case-insensitive)
- **Data Migration:** All source emails tracked for Gmail/Drive data transfer
- **Admin Rights:** Carefully preserved to maintain access controls
- **Testing:** Always test mapping logic with sample data first

### Performance Optimization
- Batch processing reduces API calls
- Rate limiting prevents quota exhaustion
- Background processing for large user sets
- Real-time progress tracking with ETA calculation

## Security Features
- Secure random password generation for new users
- Domain-wide delegation for service account access
- OAuth scope validation and permission checking
- Audit trails for all user creation activities

## Monitoring and Reporting
- Real-time progress tracking with visual indicators
- Detailed creation logs with success/failure counts
- Error categorization and resolution suggestions
- Export capabilities for audit and compliance
