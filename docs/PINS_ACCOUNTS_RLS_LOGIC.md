# RLS Logic: Viewing Public Pins and Account Owners

## Overview

This document explains how anonymous and authenticated users can view public pins and their account owners on the map.

## Current RLS Setup (Post Guest Account Removal)

### 1. Pins Table RLS Policy

**Policy**: `"Public read access for pins"` (Migration 256)

```sql
CREATE POLICY "Public read access for pins"
  ON public.pins
  FOR SELECT
  TO authenticated, anon
  USING (
    -- Public pins visible to everyone
    visibility = 'public'
    OR
    -- Private pins: authenticated users who own the account
    (
      visibility = 'only_me'
      AND account_id IS NOT NULL
      AND auth.uid() IS NOT NULL
      AND public.user_owns_account(account_id)
    )
  );
```

**Logic**:
- ✅ **Public pins** (`visibility = 'public'`): Visible to **everyone** (authenticated + anonymous)
- ✅ **Private pins** (`visibility = 'only_me'`): Only visible to **authenticated users** who own the account
- Uses `user_owns_account()` helper function (SECURITY DEFINER) to check ownership
- For anonymous users: `auth.uid()` is NULL, so private pin check always fails (correct behavior)

### 2. Accounts Table RLS Policies

#### For Authenticated Users

**Policy**: `"Authenticated users can view basic account info"` (Migration 144)

```sql
CREATE POLICY "Authenticated users can view basic account info"
  ON public.accounts FOR SELECT
  TO authenticated
  USING (true);
```

**Logic**: Authenticated users can view **ALL accounts** (for displaying author info in feeds)

#### For Anonymous Users

**Policy**: `"Anonymous users can view accounts with public pins"` (Migrations 217, 258)

```sql
CREATE POLICY "Anonymous users can view accounts with public pins"
  ON public.accounts FOR SELECT
  TO anon
  USING (
    -- Accounts with public pins
    EXISTS (
      SELECT 1 FROM public.pins
      WHERE pins.account_id = accounts.id
      AND pins.visibility = 'public'
    )
  );
```

**Column-Level GRANT** (Migration 258):
```sql
GRANT SELECT (id, first_name, last_name, username, image_url) ON public.accounts TO anon;
```

**Logic**:
- Anonymous users can **only** view accounts that have at least one public pin
- Only safe columns are exposed: `id`, `first_name`, `last_name`, `username`, `image_url`
- Sensitive fields (email, phone, etc.) are never exposed

## How It Works Together

### Query Flow for Anonymous Users

1. **Frontend queries pins**:
   ```typescript
   // PublicMapPinService.getPins()
   const query = supabase
     .from('pins')
     .select(`
       *,
       accounts(
         id,
         username,
         first_name,
         image_url
       )
     `)
     .eq('archived', false);
   ```

2. **Pins RLS filters**:
   - Only returns pins where `visibility = 'public'` (anonymous users can't see private pins)
   - Excludes archived pins (via application filter)

3. **Accounts join via RLS**:
   - For each public pin, Supabase attempts to join the `accounts` table
   - Accounts RLS policy checks: Does this account have any public pins?
   - If yes → account data is returned (id, username, first_name, image_url)
   - If no → account data is NULL (shouldn't happen since we're querying pins with account_id)

4. **Result**: Anonymous users see:
   - ✅ All public pins
   - ✅ Account info (username, image) for accounts that own those public pins
   - ❌ Private pins (filtered by RLS)
   - ❌ Account info for accounts without public pins (filtered by RLS)

### Query Flow for Authenticated Users

1. **Frontend queries pins** (same query as above)

2. **Pins RLS filters**:
   - Returns public pins (visible to everyone)
   - Returns private pins where `user_owns_account(account_id)` = true

3. **Accounts join via RLS**:
   - Authenticated users can view **ALL accounts** (`USING (true)`)
   - Account data is always returned (if account_id exists)

4. **Result**: Authenticated users see:
   - ✅ All public pins
   - ✅ Their own private pins
   - ✅ Account info for all pins (since they can view all accounts)

## Security Guarantees

### What Anonymous Users CAN See
- ✅ Public pins (all fields: lat, lng, description, media_url, etc.)
- ✅ Account info for accounts with public pins:
  - `id`
  - `username`
  - `first_name`
  - `last_name`
  - `image_url`

### What Anonymous Users CANNOT See
- ❌ Private pins (`visibility = 'only_me'`)
- ❌ Archived pins (application filter)
- ❌ Account info for accounts without public pins
- ❌ Sensitive account fields (email, phone, etc.) - blocked by column-level GRANT

### What Authenticated Users CAN See
- ✅ All public pins
- ✅ Their own private pins
- ✅ Account info for all accounts (basic fields only)

## Performance Considerations

### Indexes (Migration 217)

```sql
-- Index for accounts RLS policy (checking for public pins)
CREATE INDEX idx_pins_account_id_visibility 
  ON public.pins(account_id, visibility) 
  WHERE visibility = 'public';

-- Index for pins RLS policy (checking ownership)
CREATE INDEX idx_pins_visibility_account_id 
  ON public.pins(visibility, account_id) 
  WHERE visibility IN ('public', 'only_me');
```

These indexes optimize the EXISTS subqueries in RLS policies.

## Frontend Implementation

**File**: `src/features/_archive/map-pins/services/publicMapPinService.ts`

```typescript
static async getPins(filters?: MapPinFilters): Promise<MapPin[]> {
  // Join accounts for all users (RLS handles filtering)
  const selectQuery = `*,
    accounts(
      id,
      username,
      first_name,
      image_url
    )`;
  
  let query = supabase
    .from('pins')
    .select(selectQuery)
    .eq('archived', false) // Application-level filter
    .order('created_at', { ascending: false });

  // ... filters ...

  const { data, error } = await query;
  
  // Transform nested account data
  return (data || []).map((pin: any) => {
    let account = null;
    if (pin.accounts) {
      account = Array.isArray(pin.accounts) ? pin.accounts[0] : pin.accounts;
    }
    
    return {
      ...pin,
      account: account ? {
        id: account.id,
        username: account.username || account.first_name || 'User',
        image_url: account.image_url,
      } : null,
    };
  });
}
```

**Key Points**:
- Always joins accounts (RLS handles whether data is returned)
- Gracefully handles null account data (for edge cases)
- Application filters out archived pins

## Summary

The RLS setup enables:
1. **Anonymous users** can see public pins and account owners (username, image) for accounts with public pins
2. **Authenticated users** can see all public pins + their own private pins, with account info for all
3. **Security**: Sensitive account data is never exposed, even if RLS policies allow account access
4. **Performance**: Indexes optimize the EXISTS subqueries in RLS policies

This design balances UX (showing creator info) with security (minimal data exposure).
