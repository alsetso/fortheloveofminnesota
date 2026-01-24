# Billing Schema Implementation - Detailed Prompt

## Executive Summary

Create a flexible, database-driven billing system that manages subscription plans and feature access. This will replace hardcoded plan checks throughout the codebase with a dynamic system where admins can configure which features belong to which plans via a UI.

## Current State Analysis

### Existing Plan Structure
- **Plans in database**: `hobby`, `contributor`, `plus`, `business`, `gov`
- **Plans to implement**: `hobby` ($0), `contributor` ($20/month), `professional` ($60/month), `business` ($200/month)
- **Note**: `professional` replaces `plus` in the new structure
- **Current storage**: Plans stored as text enum in `accounts.plan` column
- **Current constraint**: `CHECK (plan IN ('hobby', 'contributor', 'plus', 'business', 'gov'))`

### Current Feature Gating Implementation

#### Files with Hardcoded Plan Checks:
1. **`src/lib/subscriptionServer.ts`** (Primary subscription logic)
   - `getAccountSubscriptionState()` - Returns normalized subscription state
   - `getFeatureAccess()` - Returns 'limited_access' or 'full_access' (binary check)
   - `hasProAccess()` - Checks if user has contributor/plus plan
   - Currently normalizes plans to: `hobby`, `contributor`, or `plus` (ignores business/gov)

2. **`src/features/auth/services/memberService.ts`**
   - Type definition: `Plan = 'hobby' | 'contributor' | 'plus' | 'business' | 'gov'`
   - Used throughout codebase for type safety

3. **Component files with plan checks** (28+ files):
   - `src/features/settings/components/SettingsPageClient.tsx` - Shows plan info, upgrade prompts
   - `src/features/profiles/components/ProfileCard.tsx` - Shows plan badges
   - `src/features/upgrade/components/PaymentScreen.tsx` - Plan selection UI
   - `src/features/upgrade/components/UpgradeContent.tsx` - Payment management
   - `src/components/landing/LandingPage.tsx` - Landing page plan display
   - `src/features/homepage/components/HomepageMap.tsx` - Feature gating
   - `src/components/layout/MapTopContainer.tsx` - Feature gating
   - `src/app/map/[id]/components/MapIDBox.tsx` - Upgrade prompts
   - `src/features/profiles/components/ProfileMapsContainer.tsx` - Map access checks
   - And many more...

#### Current Feature Restrictions (from codebase analysis):
- **Hobby plan restrictions**:
  - Limited custom maps (upgrade prompts shown)
  - Basic profile features only
  - No visitor analytics details
  - No all-time historical data
  - Limited text length (mentions)
  - No video uploads
  - Limited collections

- **Contributor/Plus plan features**:
  - Gold profile border
  - Unlimited custom maps
  - Visitor analytics
  - All-time historical data
  - Extended text (1,000 chars)
  - Video uploads
  - Unlimited collections
  - Visitor identities (Pro only per analytics docs)
  - Time-series charts (Pro only)
  - Export functionality (Pro only)
  - Geographic data (Pro only)
  - Referrer tracking (Pro only)
  - Real-time updates (Pro only)

### Current Admin Infrastructure
- Admin role check: `accounts.role = 'admin'`
- Admin helpers: `src/lib/adminHelpers.ts`
- Admin access control: `src/lib/security/accessControl.ts` - `requireAdmin()`
- Admin routes: Protected via middleware with `roles: ['admin']`
- Example admin routes: `/api/admin/*` (atlas, buildings, cities, counties, etc.)

## Implementation Requirements

### 1. Database Schema (Supabase Migration)

Create a new `billing` schema with the following tables:

#### Table: `billing.plans`
```sql
CREATE TABLE billing.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL, -- 'hobby', 'contributor', 'professional', 'business'
  name TEXT NOT NULL, -- 'Hobby', 'Contributor', 'Professional', 'Business'
  price_monthly_cents INTEGER NOT NULL, -- 0, 2000, 6000, 20000
  price_yearly_cents INTEGER, -- Optional: for annual billing
  display_order INTEGER NOT NULL, -- For UI ordering (1, 2, 3, 4)
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  stripe_price_id_monthly TEXT, -- Stripe price ID for monthly billing
  stripe_price_id_yearly TEXT, -- Stripe price ID for yearly billing
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Initial seed data
INSERT INTO billing.plans (slug, name, price_monthly_cents, display_order, description) VALUES
  ('hobby', 'Hobby', 0, 1, 'Free basic access with limited features'),
  ('contributor', 'Contributor', 2000, 2, 'Paid subscription with access to all-time historical data and advanced features'),
  ('professional', 'Professional', 6000, 3, 'Premium subscription with additional capabilities'),
  ('business', 'Business', 20000, 4, 'Enterprise features for businesses');
```

#### Table: `billing.features`
```sql
CREATE TABLE billing.features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL, -- 'unlimited_maps', 'visitor_analytics', 'video_uploads', etc.
  name TEXT NOT NULL, -- 'Unlimited Custom Maps', 'Visitor Analytics', etc.
  description TEXT,
  category TEXT, -- 'maps', 'analytics', 'content', 'profile', etc. (for UI grouping)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Initial seed data (based on current feature restrictions)
INSERT INTO billing.features (slug, name, description, category) VALUES
  ('unlimited_maps', 'Unlimited Custom Maps', 'Create unlimited custom maps', 'maps'),
  ('visitor_analytics', 'Visitor Analytics', 'See who visited your profile and detailed analytics', 'analytics'),
  ('visitor_identities', 'Visitor Identities', 'See names and details of profile visitors', 'analytics'),
  ('time_series_charts', 'Time-Series Charts', 'View analytics data in chart format', 'analytics'),
  ('export_data', 'Export Data', 'Export analytics data to CSV/PDF', 'analytics'),
  ('geographic_data', 'Geographic Data', 'View geographic analytics data', 'analytics'),
  ('referrer_tracking', 'Referrer Tracking', 'Track where your traffic comes from', 'analytics'),
  ('real_time_updates', 'Real-Time Updates', 'Get real-time analytics updates', 'analytics'),
  ('all_time_historical_data', 'All-Time Historical Data', 'Access to all historical data', 'analytics'),
  ('extended_text', 'Extended Text', 'Extended text length for mentions (1,000 chars)', 'content'),
  ('video_uploads', 'Video Uploads', 'Upload videos to mentions', 'content'),
  ('unlimited_collections', 'Unlimited Collections', 'Create unlimited collections', 'content'),
  ('gold_profile_border', 'Gold Profile Border', 'Premium gold border on profile', 'profile'),
  ('advanced_profile_features', 'Advanced Profile Features', 'Access to advanced profile customization', 'profile');
```

#### Table: `billing.plan_features` (Many-to-Many)
```sql
CREATE TABLE billing.plan_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES billing.plans(id) ON DELETE CASCADE,
  feature_id UUID NOT NULL REFERENCES billing.features(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plan_id, feature_id)
);

-- Initial seed: Assign features to plans
-- Hobby: No features (or minimal features)
-- Contributor: Most features
-- Professional: All contributor features + additional
-- Business: All professional features + additional
```

#### Table: `billing.feature_restrictions` (Optional - for complex restrictions)
```sql
CREATE TABLE billing.feature_restrictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id UUID NOT NULL REFERENCES billing.features(id) ON DELETE CASCADE,
  restriction_type TEXT NOT NULL, -- 'limit', 'quota', 'time_window', etc.
  restriction_value JSONB, -- Flexible JSON for different restriction types
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Helper Functions:
```sql
-- Function to get all features for a plan (including inherited from lower tiers)
CREATE OR REPLACE FUNCTION billing.get_plan_features(plan_slug TEXT)
RETURNS TABLE(feature_slug TEXT, feature_name TEXT) AS $$
  WITH RECURSIVE plan_hierarchy AS (
    -- Base: Get the plan
    SELECT p.id, p.slug, p.display_order
    FROM billing.plans p
    WHERE p.slug = plan_slug AND p.is_active = true
    
    UNION ALL
    
    -- Recursive: Get all lower-tier plans (display_order < current)
    SELECT p.id, p.slug, p.display_order
    FROM billing.plans p
    INNER JOIN plan_hierarchy ph ON p.display_order < ph.display_order
    WHERE p.is_active = true
  )
  SELECT DISTINCT f.slug, f.name
  FROM billing.features f
  INNER JOIN billing.plan_features pf ON f.id = pf.feature_id
  INNER JOIN plan_hierarchy ph ON pf.plan_id = ph.id
  WHERE f.is_active = true
  ORDER BY f.name;
$$ LANGUAGE SQL STABLE;

-- Function to check if user has access to a feature
CREATE OR REPLACE FUNCTION billing.user_has_feature(user_id UUID, feature_slug TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM accounts a
    INNER JOIN billing.plans p ON a.plan = p.slug
    INNER JOIN billing.plan_features pf ON p.id = pf.plan_id
    INNER JOIN billing.features f ON pf.feature_id = f.id
    WHERE a.user_id = user_id
      AND f.slug = feature_slug
      AND f.is_active = true
      AND p.is_active = true
      AND (a.subscription_status = 'active' OR a.subscription_status = 'trialing' OR a.stripe_subscription_id IS NOT NULL)
  );
$$ LANGUAGE SQL STABLE;
```

#### RLS Policies:
```sql
-- Enable RLS
ALTER TABLE billing.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing.features ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing.plan_features ENABLE ROW LEVEL SECURITY;

-- Plans: Public read, admin write
CREATE POLICY "Plans are viewable by everyone" ON billing.plans FOR SELECT USING (true);
CREATE POLICY "Plans are editable by admins" ON billing.plans FOR ALL USING (
  EXISTS (SELECT 1 FROM accounts WHERE user_id = auth.uid() AND role = 'admin')
);

-- Features: Public read, admin write
CREATE POLICY "Features are viewable by everyone" ON billing.features FOR SELECT USING (true);
CREATE POLICY "Features are editable by admins" ON billing.features FOR ALL USING (
  EXISTS (SELECT 1 FROM accounts WHERE user_id = auth.uid() AND role = 'admin')
);

-- Plan features: Public read, admin write
CREATE POLICY "Plan features are viewable by everyone" ON billing.plan_features FOR SELECT USING (true);
CREATE POLICY "Plan features are editable by admins" ON billing.plan_features FOR ALL USING (
  EXISTS (SELECT 1 FROM accounts WHERE user_id = auth.uid() AND role = admin)
);
```

### 2. Admin UI Route

Create `/app/admin/billing/page.tsx` with:
- **Plan Management Section**:
  - List all plans with name, price, active status
  - Edit plan details (name, price, description, Stripe price IDs)
  - Toggle plan active/inactive
  - Reorder plans (affects feature inheritance)

- **Feature Management Section**:
  - List all features grouped by category
  - Create new features
  - Edit feature details
  - Toggle feature active/inactive
  - Delete features (with cascade handling)

- **Plan-Feature Assignment Section**:
  - Visual interface showing plans as columns
  - Features as rows
  - Checkboxes to assign features to plans
  - Visual indication of inherited features (from lower tiers)
  - Drag-and-drop or multi-select for bulk assignment
  - Real-time preview of what features each plan has

- **UI Requirements**:
  - Use existing design system components
  - Responsive design
  - Clear visual hierarchy
  - Confirmation dialogs for destructive actions
  - Success/error toast notifications
  - Loading states for async operations

### 3. API Routes

Create `/app/api/admin/billing/*` routes:

#### `GET /api/admin/billing/plans`
- Returns all plans with their features
- Used by admin UI

#### `GET /api/admin/billing/features`
- Returns all features grouped by category
- Used by admin UI

#### `POST /api/admin/billing/plans`
- Create new plan
- Admin only
- Validate: unique slug, valid price, etc.

#### `PATCH /api/admin/billing/plans/[id]`
- Update plan details
- Admin only

#### `DELETE /api/admin/billing/plans/[id]`
- Soft delete (set is_active = false) or hard delete
- Admin only
- Handle cascade: what happens to users on this plan?

#### `POST /api/admin/billing/features`
- Create new feature
- Admin only

#### `PATCH /api/admin/billing/features/[id]`
- Update feature
- Admin only

#### `DELETE /api/admin/billing/features/[id]`
- Delete feature (with cascade to plan_features)
- Admin only

#### `POST /api/admin/billing/plan-features`
- Assign feature to plan (or bulk assign)
- Admin only
- Body: `{ plan_id, feature_ids: [] }`

#### `DELETE /api/admin/billing/plan-features`
- Remove feature from plan
- Admin only
- Body: `{ plan_id, feature_id }`

#### `GET /api/billing/user-features`
- Public route (authenticated)
- Returns features available to current user
- Uses `billing.user_has_feature()` function

#### `GET /api/billing/check-feature?feature=unlimited_maps`
- Public route (authenticated)
- Returns `{ hasAccess: boolean, feature: {...} }`
- Used by frontend for feature gating

### 4. Update Existing Code

#### A. Update Type Definitions

**`src/features/auth/services/memberService.ts`**:
```typescript
// Update Plan type to match new structure
export type Plan = 'hobby' | 'contributor' | 'professional' | 'business';
// Remove 'plus' and 'gov' (or handle migration)
```

#### B. Create New Feature Checking Utilities

**`src/lib/billing/featureAccess.ts`** (NEW FILE):
```typescript
import { getAccountSubscriptionState } from '@/lib/subscriptionServer';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Check if user has access to a specific feature
 * Uses the billing schema as source of truth
 */
export async function hasFeatureAccess(featureSlug: string): Promise<boolean> {
  const subscriptionState = await getAccountSubscriptionState();
  
  if (!subscriptionState.isActive && !subscriptionState.isComped) {
    return false;
  }
  
  // Call Supabase function to check feature access
  const supabase = createServerClient(/* ... */);
  const { data, error } = await supabase.rpc('billing.user_has_feature', {
    user_id: subscriptionState.userId,
    feature_slug: featureSlug
  });
  
  return data === true;
}

/**
 * Get all features available to current user
 */
export async function getUserFeatures(): Promise<string[]> {
  // Implementation using billing schema
}

/**
 * Check multiple features at once
 */
export async function hasAnyFeature(featureSlugs: string[]): Promise<boolean> {
  // Implementation
}

export async function hasAllFeatures(featureSlugs: string[]): Promise<boolean> {
  // Implementation
}
```

#### C. Update Subscription Server

**`src/lib/subscriptionServer.ts`**:
- Keep `getAccountSubscriptionState()` as-is (still needed for plan info)
- Update `getFeatureAccess()` to use new feature system OR deprecate it
- Update `hasProAccess()` to check for specific features instead of plan names
- Add new functions that use feature slugs

#### D. Update Components

Replace hardcoded plan checks with feature checks:

**Before**:
```typescript
if (account.plan === 'contributor' || account.plan === 'plus') {
  // Show feature
}
```

**After**:
```typescript
import { hasFeatureAccess } from '@/lib/billing/featureAccess';

const canUseFeature = await hasFeatureAccess('unlimited_maps');
if (canUseFeature) {
  // Show feature
}
```

**Files to update** (priority order):
1. `src/lib/subscriptionServer.ts` - Core subscription logic
2. `src/features/upgrade/components/PaymentScreen.tsx` - Plan selection
3. `src/features/upgrade/components/UpgradeContent.tsx` - Payment management
4. `src/features/settings/components/SettingsPageClient.tsx` - Settings UI
5. `src/features/profiles/components/ProfileCard.tsx` - Profile display
6. `src/components/layout/MapTopContainer.tsx` - Map features
7. `src/app/map/[id]/components/MapIDBox.tsx` - Map access
8. `src/features/profiles/components/ProfileMapsContainer.tsx` - Maps access
9. All other files with plan checks (28+ files)

#### E. Migration Strategy

1. **Database Migration**:
   - Create billing schema and tables
   - Seed initial plans and features
   - Map existing features to new feature system
   - Update `accounts.plan` constraint to include 'professional' and remove 'plus' (or handle both during transition)

2. **Code Migration**:
   - Implement new feature checking system alongside old system
   - Gradually migrate components to use new system
   - Keep old system working during transition
   - Add feature flags if needed

3. **Data Migration**:
   - Migrate existing 'plus' plan users to 'professional'
   - Ensure all existing users maintain their current feature access

### 5. Testing Requirements

- Unit tests for feature checking functions
- Integration tests for admin API routes
- E2E tests for admin UI
- Test feature inheritance (higher plans get lower plan features)
- Test feature gating in components
- Test migration from old system to new system

## Success Criteria

1. ✅ Admin can view all plans and features in UI
2. ✅ Admin can assign features to plans via UI
3. ✅ Higher-tier plans automatically inherit lower-tier features
4. ✅ Frontend components use feature slugs instead of plan names
5. ✅ All existing feature restrictions continue to work
6. ✅ New features can be added without code changes
7. ✅ Plan prices and features can be changed without code changes
8. ✅ Migration from 'plus' to 'professional' is seamless

## Implementation Notes

- **Plan Hierarchy**: Use `display_order` to determine which plans inherit from which. Plans with higher `display_order` inherit features from plans with lower `display_order`.
- **Feature Inheritance**: Implemented via SQL function `billing.get_plan_features()` which recursively includes features from lower-tier plans.
- **Backward Compatibility**: During migration, support both old plan checks and new feature checks. Gradually deprecate old system.
- **Performance**: Cache feature checks where possible. Consider materialized views for frequently accessed feature lists.
- **Stripe Integration**: Store Stripe price IDs in `billing.plans` table. Update checkout flows to use these IDs.
- **Admin Security**: All admin routes must check `accounts.role = 'admin'`. Use existing `requireAdmin()` helpers.

## Files to Create

1. `supabase/migrations/XXX_create_billing_schema.sql` - Database schema
2. `src/app/admin/billing/page.tsx` - Admin UI
3. `src/app/api/admin/billing/plans/route.ts` - Plans API
4. `src/app/api/admin/billing/features/route.ts` - Features API
5. `src/app/api/admin/billing/plan-features/route.ts` - Plan-Feature assignment API
6. `src/app/api/billing/user-features/route.ts` - User features API
7. `src/app/api/billing/check-feature/route.ts` - Feature check API
8. `src/lib/billing/featureAccess.ts` - Feature checking utilities
9. `src/lib/billing/types.ts` - TypeScript types for billing schema

## Files to Modify

1. `src/lib/subscriptionServer.ts` - Add feature checking functions
2. `src/features/auth/services/memberService.ts` - Update Plan type
3. All component files with plan checks (28+ files) - Replace with feature checks
4. `supabase/migrations/XXX_update_accounts_plan_constraint.sql` - Update plan constraint

## Questions to Resolve

1. What happens to 'plus' plan users? Migrate to 'professional'?
2. What happens to 'gov' plan? Keep it or migrate?
3. Should feature restrictions (quotas, limits) be in the database or code?
4. How to handle feature deprecation? Soft delete or hard delete?
5. Should there be a feature usage tracking system?
6. How to handle Stripe webhook updates when plans change?

---

**Next Steps**: Review this prompt, clarify any questions, then proceed with implementation starting with the database schema migration.
