# Plan & Limits System Architecture

## Overview
The billing schema (`billing_plans`, `billing_features`, `billing_plan_features`) is the source of truth for what features and limits each plan provides. The `accounts.plan` column links users to their plan, and feature limits are enforced across the platform.

## Core Database Schema

### Tables
- **`billing.plans`** - Plan definitions (hobby, contributor, professional, business)
- **`billing.features`** - Feature definitions (custom_maps, unlimited_maps, etc.)
- **`billing.plan_features`** - Junction table with `limit_value` and `limit_type`
- **`accounts.plan`** - User's current plan (hobby, contributor, professional, business)
- **`accounts.subscription_status`** - Stripe subscription status (active, trialing, canceled, etc.)

### Database Functions
- **`billing.get_plan_features_with_limits(plan_slug)`** - Get all features for a plan with limits
- **`billing.get_user_feature_limit(user_id, feature_slug)`** - Get limit for specific feature
- **`get_account_feature_limit(account_id, feature_slug)`** - Account-scoped feature limit check
- **`get_account_features_with_limits(account_id)`** - All features with limits for an account

## File Inventory: Plan & Limit Logic Usage

### Core Billing Libraries
1. **`/src/lib/billing/featureAccess.ts`**
   - Server-side: `hasFeatureAccess()`, `getUserFeatures()`
   - Used in: Server components, API routes

2. **`/src/lib/billing/featureLimits.ts`**
   - `getAccountFeatureLimit()` - Get limit for a feature
   - `canAccountPerformAction()` - Check if action is allowed
   - `getFeatureUsageDisplay()` - Format usage text
   - Used in: API routes, server components

3. **`/src/lib/billing/planHelpers.ts`**
   - `isPaidPlan()` - Check if plan is paid
   - `getPaidPlanBorderClasses()` - UI styling helpers
   - Used in: UI components

4. **`/src/lib/billing/server.ts`**
   - `getPlansWithFeatures()` - Server-side plan fetching
   - `getPlanBySlug()` - Get specific plan
   - Used in: Server components (`/billing/page.tsx`, `/plans/page.tsx`)

5. **`/src/lib/billing/types.ts`**
   - TypeScript interfaces for plans, features, limits
   - Used in: All billing-related code

### Client-Side Context & Hooks
6. **`/src/contexts/BillingEntitlementsContext.tsx`**
   - Global client-side feature access
   - `useBillingEntitlementsSafe()` hook
   - Used in: Client components that need feature checks

7. **`/src/components/billing/BillingFeatureGate.tsx`**
   - Component wrapper for feature gating
   - Used in: UI components to conditionally render features

### API Routes (Feature Enforcement)
8. **`/src/app/api/billing/check-feature/route.ts`**
   - GET endpoint to check feature access
   - Used by: Client components

9. **`/src/app/api/billing/user-features/route.ts`**
   - GET endpoint for all user features with limits
   - Used by: `BillingEntitlementsContext`

10. **`/src/app/api/maps/route.ts`** (POST)
    - Enforces `custom_maps` feature limit
    - Checks map count vs limit before creation
    - Uses: `get_account_feature_limit('custom_maps')`

11. **`/src/app/api/maps/[id]/pins/route.ts`** (POST)
    - May enforce pin limits (if feature exists)
    - Uses: Plan-based permissions

12. **`/src/app/api/maps/[id]/areas/route.ts`** (POST)
    - May enforce area limits (if feature exists)
    - Uses: Plan-based permissions

13. **`/src/app/api/posts/route.ts`** (POST)
    - May enforce post limits (if feature exists)
    - Uses: Plan-based permissions

### UI Components (Plan Display & Selection)
14. **`/src/app/billing/page.tsx`** (Server Component)
    - Billing page with plan selection
    - Uses: `getPlansWithFeatures()`, `getPlanBySlug()`

15. **`/src/app/billing/BillingPageClient.tsx`**
    - Client-side billing page logic
    - Plan payment modal integration

16. **`/src/app/plans/page.tsx`** (Server Component)
    - Public plans comparison page
    - Uses: `getPlansWithFeatures()`

17. **`/src/app/plans/PlansPageClient.tsx`**
    - Client-side plans page logic

18. **`/src/components/billing/PlansKanbanView.tsx`**
    - Plan cards and comparison table
    - Shows plan features and limits

19. **`/src/components/billing/PlanPaymentModal.tsx`**
    - iOS-style payment modal
    - Shows plan details and features

20. **`/src/features/auth/components/AccountDropdown.tsx`** ⭐ **CURRENT FOCUS**
    - Account menu dropdown
    - Currently shows: Plan name, Map limit
    - **NEEDS UPDATE**: Make it the "brain" of plan/limits system

### Server-Side Subscription Logic
21. **`/src/lib/subscriptionServer.ts`**
    - `getAccountSubscriptionState()` - Get subscription status
    - Used in: Server components, API routes

22. **`/src/lib/subscriptionRestrictionsServer.ts`**
    - Server-side subscription restriction checks
    - Used in: API routes, server components

### Map Creation & Limits
23. **`/src/app/maps/new/page.tsx`**
    - Map creation page
    - Shows upgrade prompts when at limit
    - Uses: `BillingEntitlementsContext`, plan data

### Account Management
24. **`/src/components/billing/AccountSidebar.tsx`**
    - Account settings sidebar
    - May show plan information

25. **`/src/features/settings/components/SettingsPageClient.tsx`**
    - Settings page
    - May reference plan/limits

### Stripe Integration
26. **`/src/app/api/billing/checkout/route.ts`**
    - Creates Stripe checkout sessions
    - Links plans to Stripe price IDs

27. **`/src/app/api/billing/create-subscription/route.ts`**
    - Creates subscriptions
    - Updates `accounts.plan` and `accounts.subscription_status`

28. **`/src/app/api/stripe/webhook/route.ts`**
    - Handles Stripe webhooks
    - Updates account plan on subscription changes

### Database Migrations
29. **`/supabase/migrations/437_create_billing_schema.sql`**
    - Creates billing schema and tables

30. **`/supabase/migrations/475_add_feature_limits.sql`**
    - Adds `limit_value` and `limit_type` to `plan_features`
    - Creates `get_plan_features_with_limits()` and `get_user_feature_limit()`

31. **`/supabase/migrations/479_add_account_scoped_billing_functions.sql`**
    - Adds account-scoped functions: `get_account_feature_limit()`, `get_account_features_with_limits()`

32. **`/supabase/migrations/480_seed_custom_maps_feature.sql`**
    - Seeds `custom_maps` feature

33. **`/supabase/migrations/481_seed_civic_edits_feature.sql`**
    - Seeds `civic_edits` feature

## Current AccountDropdown Implementation

**Location**: `/src/features/auth/components/AccountDropdown.tsx`

**Current Features**:
- Shows plan name (capitalized)
- Shows map count/limit (if `custom_maps` or `map` feature exists)
- "View Plans & Limits" button

**Limitations**:
- Only shows one feature (maps)
- Doesn't show all key features
- Doesn't show usage for other resources
- Not comprehensive enough to be the "brain" of the system

## Proposed AccountDropdown Enhancement

Make AccountDropdown the central hub for plan and limits information:

1. **Plan Status Section**
   - Current plan name
   - Subscription status (active, trialing, canceled)
   - Plan price (if paid)

2. **Key Features & Limits Section** (Compact)
   - Maps: `X / Y` or `X (unlimited)`
   - Posts: `X / Y` or `X (unlimited)`
   - Collections: `X / Y` or `X (unlimited)`
   - Other key features with limits

3. **Feature Categories** (Grouped)
   - Maps & Content
   - Analytics
   - Profile Features
   - Collaboration

4. **Quick Actions**
   - View All Plans
   - Upgrade Plan
   - View Usage Details

## Design Principles for Compact Display

- **Typography**: `text-xs` (12px) for most text, `text-[10px]` (10px) for labels
- **Spacing**: `gap-1.5` (6px) between items, `p-[10px]` for padding
- **Icons**: `w-3 h-3` (12px) for feature icons
- **Colors**: Gray scale with subtle accents
- **Layout**: Vertical stack with horizontal flex for key metrics
- **Information Density**: Show as much as possible without overwhelming
