# Accounts & Pins RLS Analysis: The Ideal Setup

## Current Accounts RLS Logic

### For Authenticated Users
- **Can view own account**: `user_id = auth.uid()`
- **Can view ALL accounts**: `USING (true)` - Migration 144
  - Purpose: Display post/pin author names and images in feed
  - Safe: Only exposes basic fields (id, first_name, last_name, image_url)

### For Anonymous Users
- **Can view accounts with public posts**: Migration 149
  - Policy: `EXISTS (SELECT 1 FROM posts WHERE posts.account_id = accounts.id AND posts.visibility = 'public')`
  - Column-level GRANT: Only `id, first_name, last_name, image_url`
  - Purpose: Display post author info in feed for anonymous users

## Current Pins RLS Logic

### SELECT Policy (Current - Migration 213)
```sql
USING (
  visibility = 'public'
  OR
  (
    visibility = 'only_me' 
    AND account_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.accounts
      WHERE accounts.id = pins.account_id
      AND accounts.user_id = auth.uid()
    )
  )
)
```

**Problem**: Direct query to `accounts` table fails for anonymous users because:
- Anonymous users can only query accounts that have public posts
- The EXISTS subquery in pins RLS doesn't match that policy
- Result: Anonymous users get errors when querying pins

## Frontend UX Requirements

### What the UI Needs
1. **Display pin creator info** (username, image) in:
   - Map pin popups
   - Location sidebar when pin is selected
   - Pin lists/feeds

2. **Works for both**:
   - Authenticated users (can see all accounts)
   - Anonymous users (should see accounts with public pins)

### Current Frontend Handling
- `PublicMapPinService` conditionally joins accounts only for authenticated users
- For anonymous users, account info is `null` (gracefully handled)
- But this means anonymous users never see who created public pins

## The Core Problem

**Accounts RLS allows anonymous users to see accounts with public posts, but NOT accounts with public pins.**

This creates an inconsistency:
- Posts: Anonymous users can see author info ✅
- Pins: Anonymous users cannot see creator info ❌

## The Ideal Solution

### Option 1: Extend Accounts RLS for Pins (Recommended)

Allow anonymous users to view accounts that have public pins, similar to posts:

```sql
-- Update anonymous accounts policy to include public pins
CREATE POLICY "Anonymous users can view accounts with public content"
  ON public.accounts FOR SELECT
  TO anon
  USING (
    -- Accounts with public posts
    EXISTS (
      SELECT 1 FROM public.posts
      WHERE posts.account_id = accounts.id
      AND posts.visibility = 'public'
    )
    OR
    -- Accounts with public pins
    EXISTS (
      SELECT 1 FROM public.pins
      WHERE pins.account_id = accounts.id
      AND pins.visibility = 'public'
    )
  );
```

**Benefits:**
- Consistent with posts pattern
- Anonymous users can see pin creator info
- Pins RLS can use direct EXISTS query (no helper function needed)
- Simpler, more maintainable

**Then simplify pins RLS:**
```sql
CREATE POLICY "Public read access for pins"
  ON public.pins
  FOR SELECT
  TO authenticated, anon
  USING (
    visibility = 'public'
    OR
    (
      visibility = 'only_me' 
      AND account_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.accounts
        WHERE accounts.id = pins.account_id
        AND accounts.user_id = auth.uid()
      )
    )
  );
```

This works because:
- For anonymous users: `auth.uid()` is NULL, so the EXISTS returns FALSE (correct - they can't see private pins)
- For authenticated users: They can query accounts (policy allows it), so ownership check works

### Option 2: Use Helper Function (Current Approach)

Keep the `user_owns_account()` SECURITY DEFINER function to bypass accounts RLS.

**Benefits:**
- Works immediately
- No changes to accounts RLS needed

**Drawbacks:**
- More complex (RLS bypassing RLS)
- Anonymous users still can't see pin creator info (unless we also fix accounts RLS)
- Less intuitive

### Option 3: Denormalize (Store user_id on pins)

Add `user_id` column to pins table, set it on insert, check directly in RLS.

**Benefits:**
- No accounts table query needed
- Fastest performance
- Simplest RLS policy

**Drawbacks:**
- Data duplication
- Need to keep in sync
- Migration required

## Recommended Approach: Option 1

**Why:**
1. **Consistency**: Matches the pattern already established for posts
2. **UX**: Anonymous users can see who created public pins (better UX)
3. **Simplicity**: No helper function needed, direct EXISTS query works
4. **Maintainability**: Clear, straightforward logic

**Implementation:**
1. Update accounts RLS to include public pins (migration 217)
2. Simplify pins RLS to use direct EXISTS query (no helper function)
3. Update frontend to always join accounts (works for both auth and anon)

**Migration**: See `217_ideal_accounts_pins_rls.sql`

## Summary

**Current State:**
- Accounts RLS: Anonymous can see accounts with public posts, but not public pins
- Pins RLS: Uses helper function to bypass accounts RLS
- Frontend: Conditionally joins accounts, anonymous users don't see pin creators

**Ideal State:**
- Accounts RLS: Anonymous can see accounts with public posts OR public pins
- Pins RLS: Direct EXISTS query (no helper function)
- Frontend: Always joins accounts, anonymous users see pin creators

**The Helper Function Exists Because:**
Accounts RLS doesn't allow anonymous users to query accounts for ownership checks. But the real issue is that accounts RLS should allow anonymous users to see accounts with public pins (for UX), not just public posts.



