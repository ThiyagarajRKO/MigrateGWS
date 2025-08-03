# Advanced User Mapping Integration Guide

## Overview
The User Discovery component now includes an "Advanced Mapping" button that launches the sophisticated UserMappingWithCreation component, providing enterprise-grade user mapping capabilities with multi-domain scenarios.

## How to Access Advanced Mapping

### From User Discovery Step:
1. **Navigate to User Discovery**: Start your migration workflow and reach the user discovery step
2. **Discover Users**: Use the discovery interface to fetch users from source domains
3. **Click "Advanced Mapping"**: Look for the blue "Advanced Mapping" button in the mapping section
4. **Configure Advanced Strategies**: The modal will open with full advanced mapping capabilities

### Button Location:
The "Advanced Mapping" button is located in the User Discovery component's mapping section, alongside:
- "Show Details" - Toggle basic mapping view
- "Auto-Assign All" - Quick assignment
- **"Advanced Mapping"** - Launch sophisticated mapping workflow

## Advanced Mapping Features Available

### 🎯 **One-to-Many Cloning**
- **Trigger**: When multiple target domains are selected
- **Behavior**: Clone each source user to ALL target domains
- **Email Format**: `username.sourcedomain@targetdomain.com`
- **Use Case**: Geographic distribution, backup users

### 🔀 **Many-to-One Merging** 
- **Trigger**: When source users have identical first name + last name
- **Behavior**: Merge users with same name into single target user
- **Email Format**: `firstname.lastname@targetdomain.com`
- **Use Case**: Company mergers, duplicate cleanup

### 🌐 **Many-to-Many Distribution**
- **Trigger**: Complex multi-domain scenarios
- **Behavior**: Smart distribution based on source domain relationships
- **Email Format**: Intelligent assignment based on domain mapping
- **Use Case**: Organizational restructuring

## Workflow Integration

### Step 1: User Discovery
```tsx
// Users are discovered from source domains
const discoveredUsers = await fetchUsersFromDomains(sourceDomains);
```

### Step 2: Advanced Mapping Launch
```tsx
// User clicks "Advanced Mapping" button
<button onClick={() => setShowAdvancedMapping(true)}>
  <Target className="h-4 w-4" />
  <span>Advanced Mapping</span>
</button>
```

### Step 3: UserMappingWithCreation Modal
```tsx
<UserMappingWithCreation
  sourceUsers={users}
  targetDomains={targetDomains}
  targetAdminEmails={targetAdminEmails}
  mappingType={mappingType}
  onMappingComplete={(mappings) => {
    // Update local mappings and continue workflow
  }}
  onCreationComplete={(results) => {
    // Target users created, continue to migration
  }}
/>
```

### Step 4: Integration Back to User Discovery
- Mappings are automatically applied to the User Discovery state
- Target user creation results update the main workflow
- Modal closes and user can continue with migration

## Configuration Options

### Mapping Types
- **`'one-to-one'`**: Simple direct mapping
- **`'one-to-many'`**: Clone to all target domains  
- **`'many-to-one'`**: Merge by first name + last name
- **`'many-to-many'`**: Smart distribution

### Target Admin Emails
```tsx
const targetAdminEmails = {
  'target1.com': 'admin@target1.com',
  'target2.com': 'admin@target2.com'
};
```

### Auto-Creation Settings
```tsx
autoStartCreation={false} // User controls when to create target users
batchSize={3}            // Configurable batch size for API calls
retryAttempts={3}        // Robust error handling
```

## Visual Indicators

### In User Discovery:
- **Blue "Advanced Mapping" button**: Launches sophisticated mapping
- **Mapping status indicators**: Show current mapping state
- **Progress tracking**: Real-time feedback during operations

### In Advanced Mapping Modal:
- **4-step workflow**: Mapping → Validation → Creation → Complete
- **Strategy explanations**: Visual guides for each mapping type
- **Real-time statistics**: User counts, domain distribution, merge statistics
- **Progress tracking**: Batch creation with ETA and pause/resume

## Benefits of Integration

### 🚀 **Seamless Workflow**
- No context switching between components
- Mappings automatically sync back to main workflow
- Maintains user selection and discovery state

### 🎯 **Enterprise Features**
- Advanced mapping strategies for complex scenarios
- Bulk target user creation with progress tracking
- Comprehensive error handling and retry logic

### 💡 **User Experience**
- Modal interface doesn't disrupt main workflow
- Clear visual indicators and progress feedback
- Easy to understand mapping strategies with examples

### 🔧 **Developer Benefits**
- Clean component integration
- Proper state management and callbacks
- Type-safe interfaces and error handling

## Example Usage Scenarios

### Scenario 1: Multi-Geographic Deployment
```
Company expanding to 3 regions:
- Source: company.com (100 users)
- Targets: company-us.com, company-eu.com, company-asia.com
- Strategy: One-to-Many cloning
- Result: 300 total users (100 per region)
```

### Scenario 2: Company Merger
```
Merging 3 companies:
- Sources: companyA.com, companyB.com, companyC.com
- Target: newcorp.com
- Strategy: Many-to-One merging by name
- Result: Consolidated user base with no duplicates
```

### Scenario 3: Complex Restructuring
```
Department redistribution:
- Multiple source departments across domains
- Multiple target domains with specific assignments
- Strategy: Many-to-Many smart distribution
- Result: Optimized organizational structure
```

This integration provides a powerful, enterprise-ready user mapping solution that maintains the simplicity of the basic workflow while offering sophisticated capabilities when needed.
