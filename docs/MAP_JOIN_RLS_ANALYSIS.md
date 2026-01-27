# Map Join RLS Analysis & Fix

## Current Flow

### "Join Map" vs "Request to Join"

**They are the SAME endpoint** (`POST /api/maps/[id]/membership-requests`), but with different outcomes:

1. **Auto-Approve (Instant Join):**
   - Map: `visibility = 'public'` AND `auto_approve_members = true`
   - API: Tries to insert directly into `map_members`
   - Result: User becomes member immediately

2. **Manual Approval (Request):**
   - Map: `visibility = 'private'` OR `auto_approve_members = false`
   - API: Creates entry in `map_membership_requests`
   - Result: User must wait for owner/manager approval

---

## Current RLS Policy (map_members_insert)

```sql
CREATE POLICY "map_members_insert"
  ON public.map_members FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      -- Case 1: User is joining themselves (auto-approve public maps)
      (
        account_id IN (
          SELECT id FROM public.accounts WHERE user_id = auth.uid()
        )
        AND EXISTS (
          SELECT 1 FROM public.map
          WHERE id = map_id
          AND visibility = 'public'
          AND is_active = true
          AND auto_approve_members = true
        )
      )
      -- Case 2: Manager/owner is adding any member (for approving requests)
      OR EXISTS (
        SELECT 1 FROM public.accounts
        WHERE accounts.user_id = auth.uid()
        AND (
          public.is_map_manager(map_id, accounts.id)
          OR EXISTS (
            SELECT 1 FROM public.map
            WHERE map.id = map_id
            AND map.account_id = accounts.id
          )
        )
      )
    )
  );
```

---

## Current API Logic

```typescript
// In /api/maps/[id]/membership-requests/route.ts (POST)

// If auto_approve is enabled, add as member directly
if (mapData.auto_approve_members && mapData.visibility === 'public') {
  const { data: newMember, error: memberError } = await supabase
    .from('map_members')
    .insert({
      map_id: mapId,
      account_id: accountId,  // From withSecurity middleware
      role: 'editor',
    })
    .select(...)
    .single();

  if (memberError) {
    // RLS error occurs here
    return createErrorResponse('Failed to join map', 500);
  }
}
```

---

## The Problem

**RLS Policy Requirements:**
1. ✅ `auth.uid() IS NOT NULL` - Should be true (authenticated)
2. ✅ `account_id IN (SELECT id FROM accounts WHERE user_id = auth.uid())` - Should match
3. ✅ Map exists with `visibility = 'public'` AND `is_active = true` AND `auto_approve_members = true`

**Potential Issues:**

1. **Auth Context Mismatch:**
   - The Supabase client might not have the correct `auth.uid()` context
   - Server-side Supabase client needs to use the user's session

2. **Account ID Mismatch:**
   - The `accountId` from `withSecurity` might not match what RLS expects
   - RLS checks `account_id IN (SELECT id FROM accounts WHERE user_id = auth.uid())`
   - But `auth.uid()` might not match the user_id of the account

3. **Missing Account Check:**
   - RLS doesn't verify the account exists or is active
   - Could fail if account doesn't exist or is inactive

---

## Root Cause Analysis

The issue is likely that **the Supabase client's auth context doesn't match the user making the request**.

When using `createServerClientWithAuth(cookies())`, it should:
1. Read the session from cookies
2. Set `auth.uid()` to the user's ID
3. Allow RLS to check permissions

But if the session isn't properly set or the cookies aren't being read correctly, `auth.uid()` might be NULL or wrong.

---

## Recommended Fix

### Option 1: Use Service Role for Auto-Approval (Not Recommended)
- Bypass RLS entirely
- Security risk - not recommended

### Option 2: Fix Auth Context (Recommended)
- Ensure `createServerClientWithAuth` properly sets auth context
- Verify cookies contain valid session

### Option 3: Use RPC Function (Best)
- Create a database function that handles the insert
- Function runs with `SECURITY DEFINER` (owner privileges)
- Function validates all conditions before inserting
- More secure and reliable

---

## Recommended Solution: RPC Function

Create a database function that handles auto-approval:

```sql
CREATE OR REPLACE FUNCTION public.join_map_auto_approve(
  p_map_id UUID,
  p_account_id UUID
)
RETURNS TABLE (
  id UUID,
  map_id UUID,
  account_id UUID,
  role TEXT,
  joined_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_map_record RECORD;
  v_user_id UUID;
BEGIN
  -- Get current user_id from auth context
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Verify account belongs to user
  IF NOT EXISTS (
    SELECT 1 FROM public.accounts
    WHERE id = p_account_id
    AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Account does not belong to user';
  END IF;
  
  -- Get map details
  SELECT m.id, m.visibility, m.is_active, m.auto_approve_members
  INTO v_map_record
  FROM public.map m
  WHERE m.id = p_map_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Map not found';
  END IF;
  
  -- Verify auto-approve conditions
  IF v_map_record.visibility != 'public' THEN
    RAISE EXCEPTION 'Map is not public';
  END IF;
  
  IF NOT v_map_record.is_active THEN
    RAISE EXCEPTION 'Map is not active';
  END IF;
  
  IF NOT v_map_record.auto_approve_members THEN
    RAISE EXCEPTION 'Map does not auto-approve members';
  END IF;
  
  -- Check if already a member
  IF EXISTS (
    SELECT 1 FROM public.map_members
    WHERE map_id = p_map_id
    AND account_id = p_account_id
  ) THEN
    RAISE EXCEPTION 'Already a member';
  END IF;
  
  -- Insert member
  INSERT INTO public.map_members (map_id, account_id, role)
  VALUES (p_map_id, p_account_id, 'editor')
  RETURNING map_members.id, map_members.map_id, map_members.account_id, map_members.role, map_members.joined_at
  INTO id, map_id, account_id, role, joined_at;
  
  RETURN NEXT;
END;
$$;
```

Then update the API to use the function:

```typescript
// In /api/maps/[id]/membership-requests/route.ts

if (mapData.auto_approve_members && mapData.visibility === 'public') {
  const { data: newMember, error: memberError } = await supabase
    .rpc('join_map_auto_approve', {
      p_map_id: mapId,
      p_account_id: accountId,
    })
    .single();

  if (memberError) {
    return createErrorResponse('Failed to join map', 500);
  }

  return createSuccessResponse({ member: newMember, auto_approved: true }, 201);
}
```

---

## Alternative: Fix RLS Policy

If we want to keep using direct inserts, we need to ensure the RLS policy is more permissive for the auto-approve case:

```sql
-- More permissive RLS policy
CREATE POLICY "map_members_insert"
  ON public.map_members FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND account_id IN (
      SELECT id FROM public.accounts WHERE user_id = auth.uid()
    )
    AND (
      -- Auto-approve public maps
      EXISTS (
        SELECT 1 FROM public.map
        WHERE id = map_id
        AND visibility = 'public'
        AND is_active = true
        AND auto_approve_members = true
      )
      -- OR manager/owner adding member
      OR EXISTS (
        SELECT 1 FROM public.accounts
        WHERE accounts.user_id = auth.uid()
        AND (
          public.is_map_manager(map_id, accounts.id)
          OR EXISTS (
            SELECT 1 FROM public.map
            WHERE map.id = map_id
            AND map.account_id = accounts.id
          )
        )
      )
    )
  );
```

But this still requires proper auth context.

---

## Immediate Fix: Verify Auth Context

Check if `createServerClientWithAuth` is properly setting the auth context:

```typescript
// Debug: Check auth context
const { data: { user } } = await supabase.auth.getUser();
console.log('Auth user:', user?.id);
console.log('Account ID:', accountId);

// Verify account belongs to user
const { data: account } = await supabase
  .from('accounts')
  .select('id, user_id')
  .eq('id', accountId)
  .single();

console.log('Account user_id:', account?.user_id);
console.log('Match:', account?.user_id === user?.id);
```

---

## Summary

**Issue:** RLS policy is rejecting the insert because auth context might not be properly set.

**Best Solution:** Use RPC function with `SECURITY DEFINER` to handle auto-approval.

**Quick Fix:** Verify `createServerClientWithAuth` is properly reading session from cookies.

**Alignment Check:**
- ✅ API logic matches RLS requirements
- ❌ Auth context might not be properly set
- ✅ Both check `auto_approve_members && visibility === 'public'`
