# Feature Limits System

## Problem
The billing schema tracked **which features** belong to which plans, but not **how many/how much** of each feature users can have.

Example: All plans might have "Groups" feature, but:
- Hobby: 0 groups
- Contributor: 5 groups
- Professional: 5 groups
- Business: 10 groups

## Solution

### 1. Database Schema Changes (`475_add_feature_limits.sql`)

Added two columns to `billing.plan_features` junction table:

```sql
ALTER TABLE billing.plan_features 
  ADD COLUMN limit_value INTEGER,
  ADD COLUMN limit_type TEXT CHECK (limit_type IN ('count', 'storage_mb', 'boolean', 'unlimited'));
```

#### Limit Types:

- **`count`** - Numeric limit (e.g., 5 groups, 10 maps)
- **`storage_mb`** - Storage limit in megabytes (e.g., 1000 MB video uploads)
- **`boolean`** - Yes/no access (e.g., has gold border or doesn't)
- **`unlimited`** - No limit (e.g., unlimited custom maps)

### 2. Example Data Structure

```
Plan: Contributor
├── Feature: Groups
│   ├── limit_type: 'count'
│   └── limit_value: 5
├── Feature: Custom Maps
│   ├── limit_type: 'unlimited'
│   └── limit_value: NULL
└── Feature: Video Uploads
    ├── limit_type: 'storage_mb'
    └── limit_value: 1000
```

### 3. New Database Functions

#### `billing.get_plan_features_with_limits(plan_slug)`
Returns all features for a plan WITH their limits:
```sql
SELECT * FROM billing.get_plan_features_with_limits('contributor');
-- Returns: feature_slug, feature_name, limit_value, limit_type, is_unlimited
```

#### `billing.get_user_feature_limit(user_id, feature_slug)`
Gets a specific feature limit for a user:
```sql
SELECT * FROM billing.get_user_feature_limit('user-uuid', 'groups');
-- Returns: has_feature, limit_value, limit_type, is_unlimited
```

### 4. TypeScript Helper Functions

#### Check if user can perform action:
```typescript
import { canUserPerformAction } from '@/lib/billing/featureLimits';

// Check if user can create another group
const currentGroupCount = 3;
const result = await canUserPerformAction(userId, 'groups', currentGroupCount);

if (!result.allowed) {
  throw new Error(result.message);
  // "You've reached your limit of 5 groups. Upgrade to get more."
}
```

#### Display usage:
```typescript
import { getFeatureUsageDisplay } from '@/lib/billing/featureLimits';

const usage = await getFeatureUsageDisplay(userId, 'groups', 3);
// Returns: "3 / 5 groups" or "3 groups (unlimited)"
```

### 5. Real-World Usage Examples

#### Before creating a group:
```typescript
// In your API route or server action
const { data: groups } = await supabase
  .from('groups')
  .select('id')
  .eq('account_id', accountId);

const currentCount = groups?.length || 0;
const canCreate = await canUserPerformAction(userId, 'groups', currentCount);

if (!canCreate.allowed) {
  return { error: canCreate.message };
}

// Proceed with creating group...
```

#### Display limits in UI:
```typescript
const usage = await getFeatureUsageDisplay(userId, 'custom_maps', userMapCount);
// Show: "7 / 10 custom maps" 
```

#### Check storage:
```typescript
const currentStorageMB = 750;
const canUpload = await canUserPerformAction(userId, 'video_uploads', currentStorageMB);
// Returns: allowed: true, message: "750/1000 MB used"
```

## Migration Steps

1. **Run the migration**: `475_add_feature_limits.sql`
2. **Update existing features** with proper limits in the database
3. **Update TypeScript types** - Already done in `billing/types.ts`
4. **Add limit checks** to API routes before creating resources
5. **Display limits** in UI to inform users

## Features That Need Limits

Based on your description, these need limits:
- ✅ Groups (count)
- ✅ Custom Maps (count)
- ✅ Collections (count)  
- ✅ Additional Accounts (count)
- ✅ Video/Image Storage (storage_mb)
- ✅ Mentions per month (count - if you want to limit)
- ✅ API calls (count - if you track this)

## Next Steps

1. Define exact limits for each feature per plan
2. Add the limits to your seed data or admin panel
3. Implement checks before resource creation
4. Show usage indicators in your UI
