# Accounts Table Column Audit

## Current Schema (from `002_recreate_accounts_table.sql`)

```sql
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Personal information
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  image_url TEXT,
  cover_image_url TEXT,
  bio TEXT CHECK (bio IS NULL OR char_length(bio) <= 220),
  
  -- Location
  city_id UUID REFERENCES atlas.cities(id) ON DELETE SET NULL,
  
  -- Account settings
  role public.account_role NOT NULL DEFAULT 'general'::public.account_role,
  traits public.account_trait[] DEFAULT '{}',
  view_count INTEGER NOT NULL DEFAULT 0,
  onboarded BOOLEAN NOT NULL DEFAULT false,
  
  -- Billing
  stripe_customer_id TEXT,
  plan TEXT DEFAULT 'hobby' CHECK (plan IN ('hobby', 'pro', 'plus')),
  billing_mode TEXT DEFAULT 'standard' CHECK (billing_mode IN ('standard', 'trial')),
  subscription_status TEXT,
  stripe_subscription_id TEXT,
  
  -- Guest accounts
  guest_id TEXT UNIQUE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_visit TIMESTAMP WITH TIME ZONE,
  
  -- Constraints
  CONSTRAINT accounts_user_or_guest_check CHECK (user_id IS NOT NULL OR guest_id IS NOT NULL),
  CONSTRAINT accounts_view_count_non_negative CHECK (view_count >= 0),
  CONSTRAINT accounts_username_unique UNIQUE (username)
);
```

## Additional Columns (from later migrations)

- `owns_business` BOOLEAN (from migration 502)
- `search_visibility` BOOLEAN DEFAULT false (from migration 413)
- `account_taggable` BOOLEAN (if exists - need to verify)

## Column Usage Analysis

### ✅ ACTIVELY USED COLUMNS

1. **id** - Primary key, used everywhere
2. **user_id** - Auth reference, critical for user accounts
3. **username** - Profile URLs, search, display
4. **first_name, last_name** - Display names, search
5. **email** - Contact, auth, billing
6. **image_url** - Profile photos everywhere
7. **bio** - Profile display
8. **city_id** - Location filtering, display
9. **role** - Permissions, admin checks
10. **traits** - Profile display, filtering
11. **view_count** - Analytics, display
12. **onboarded** - Onboarding flow
13. **stripe_customer_id** - Billing integration
14. **plan** - Feature access, billing
15. **subscription_status** - Billing status
16. **created_at, updated_at** - Timestamps
17. **search_visibility** - @ mention search control
18. **owns_business** - Onboarding flow

### ⚠️ POTENTIALLY UNUSED OR MINIMALLY USED COLUMNS

1. **phone** - Found in types but minimal usage
   - Used in: AccountSettingsForm, OnboardingClient, skipTrace services
   - **Status**: Used but could be consolidated or removed if not critical

2. **cover_image_url** - Found in 16 files but may not be displayed
   - Used in: ProfileCard, ProfilePage, types
   - **Status**: Defined but verify if actually rendered in UI

3. **last_visit** - Updated in middleware but may not be queried
   - Updated in: middleware.ts
   - **Status**: Tracked but not displayed/queried - could be moved to analytics.events

4. **billing_mode** - Found in 11 files
   - Used in: billing routes, subscription server, types
   - **Status**: Used for trial vs standard billing - keep if needed

5. **stripe_subscription_id** - Found in types but minimal direct usage
   - Used in: webhook handler, types
   - **Status**: Needed for Stripe webhook processing - keep

6. **guest_id** - Found in 6 files
   - Used in: guestAccountService, urlParams, types
   - **Status**: Critical for guest account support - keep

### 🔍 COLUMNS TO VERIFY

1. **plan CHECK constraint** - Currently allows 'hobby', 'pro', 'plus'
   - Migration 436 replaced 'pro' with 'contributor'
   - Migration 435 added 'business' and 'government'
   - **Issue**: CHECK constraint may be outdated
   - **Action**: Update CHECK constraint to match current plan values

2. **account_taggable** - Mentioned in types but not in schema
   - Found in: types/profile.ts
   - **Status**: Need to verify if column exists or if it's a type-only field

## Recommendations

### Columns to Remove (if confirmed unused)

1. **phone** - If not critical for core functionality
2. **cover_image_url** - If not displayed in UI (verify first)
3. **last_visit** - Move to analytics.events table instead

### Columns to Fix

1. **plan CHECK constraint** - Update to include all valid plans:
   ```sql
   CHECK (plan IN ('hobby', 'contributor', 'professional', 'business', 'government', 'plus'))
   ```

### Columns to Add (based on user request)

*User will provide ideas for new columns*

## Migration Plan

1. Audit actual usage of `phone`, `cover_image_url`, `last_visit`
2. Update `plan` CHECK constraint
3. Remove unused columns (if confirmed)
4. Add new columns (per user requirements)
