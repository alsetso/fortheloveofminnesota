# Pins Table RLS Review & Recommendations

## Current RLS Setup (Migration 213)

### Current SELECT Policy
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

### Problems Identified

1. **Direct accounts table query in RLS policy**
   - The policy directly queries `public.accounts` table
   - The accounts table has RLS enabled
   - Anonymous users may not have SELECT permission on accounts table
   - Even if they do, the EXISTS subquery may fail or be inefficient

2. **No use of helper function**
   - There's a `user_owns_account()` SECURITY DEFINER function available
   - This function bypasses RLS on accounts table
   - Current policy doesn't use it, causing potential failures for anonymous users

3. **Inefficient for anonymous users**
   - For anonymous users (`auth.uid()` is NULL), the EXISTS check will always return FALSE
   - But PostgreSQL still evaluates the subquery, which may fail if accounts RLS blocks anonymous access
   - This causes errors when anonymous users try to query pins

4. **Missing short-circuit optimization**
   - PostgreSQL should short-circuit OR conditions, but the EXISTS subquery might still be evaluated
   - Better to structure the policy to avoid unnecessary subquery execution for anonymous users

## Recommended Solution

### Use SECURITY DEFINER Helper Function

The `user_owns_account()` function is already available and should be used:

```sql
CREATE OR REPLACE FUNCTION public.user_owns_account(account_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN EXISTS (
    SELECT 1 FROM public.accounts
    WHERE accounts.id = account_id
    AND accounts.user_id = auth.uid()
  );
END;
$$;
```

### Improved SELECT Policy

```sql
CREATE POLICY "Public read access for pins"
  ON public.pins
  FOR SELECT
  TO authenticated, anon
  USING (
    -- Public pins are visible to everyone
    visibility = 'public'
    OR
    -- Private pins (only_me) are only visible to their creator
    -- Use helper function which handles NULL auth.uid() gracefully
    (
      visibility = 'only_me' 
      AND account_id IS NOT NULL
      AND public.user_owns_account(account_id)
    )
  );
```

### Benefits

1. **Works for anonymous users**
   - `user_owns_account()` returns FALSE immediately if `auth.uid()` is NULL
   - No subquery execution for anonymous users
   - No RLS permission issues on accounts table

2. **More efficient**
   - SECURITY DEFINER function bypasses RLS on accounts table
   - Short-circuits early for anonymous users
   - PostgreSQL can optimize the OR condition better

3. **Consistent with other policies**
   - INSERT, UPDATE, DELETE policies already use `user_owns_account()`
   - SELECT policy should follow the same pattern

4. **Better error handling**
   - Function handles edge cases (NULL account_id, NULL auth.uid())
   - No risk of RLS blocking the ownership check

## Additional Recommendations

### 1. Add Index for Visibility Filtering

```sql
CREATE INDEX IF NOT EXISTS idx_pins_visibility_account_id 
  ON public.pins(visibility, account_id) 
  WHERE visibility = 'public' OR visibility = 'only_me';
```

This helps PostgreSQL quickly filter public pins without checking ownership.

### 2. Consider Visibility Values

Current policy uses `visibility = 'only_me'` but the enum might have other values:
- `'public'` - visible to everyone
- `'accounts_only'` - visible to authenticated users only
- `'private'` - visible only to creator

If `'accounts_only'` exists, add a policy for it:

```sql
-- Add to SELECT policy USING clause:
OR
(
  visibility = 'accounts_only'
  AND auth.uid() IS NOT NULL  -- Must be authenticated
)
```

### 3. Grant Permissions

Ensure proper grants are in place:

```sql
GRANT SELECT ON public.pins TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.pins TO authenticated;
```

### 4. Test Cases

Test the following scenarios:
1. Anonymous user queries pins → should only see public pins
2. Authenticated user queries pins → should see public + own private pins
3. Authenticated user queries with account_id filter → should work
4. Anonymous user queries with account join → should handle gracefully (may need to avoid join)

## Query Pattern Issues

### Problem: Accounts Table Joins

Some queries try to join the `accounts` table unconditionally, which may fail for anonymous users if accounts RLS blocks them.

**Example from `/api/map-pins/search/route.ts`:**
```typescript
.select(`
  *,
  accounts!pins_account_id_fkey(
    id,
    username,
    image_url
  )
`)
```

**Solution:** Conditionally join accounts only for authenticated users (like `PublicMapPinService` does):

```typescript
const { data: { user } } = await supabase.auth.getUser();
const isAuthenticated = !!user;

const selectQuery = isAuthenticated
  ? `*,
     accounts!pins_account_id_fkey(
       id,
       username,
       image_url
     )`
  : `*`;

let dbQuery = supabase
  .from('pins')
  .select(selectQuery);
```

### Best Practice

Always check authentication before joining accounts table in queries that need to work for anonymous users.

## Migration Script

See `216_fix_pins_rls_use_helper_function.sql` for the complete migration.



