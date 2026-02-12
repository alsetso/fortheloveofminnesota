# User Experience: General vs Admin Users

## Current Behavior

### General Users (`accounts.role = 'general'`)

**When system is disabled (not visible + not enabled):**

1. **Page Routes:** Blocked
   - `/maps` → Redirects to `/`
   - `/maps/new` → Redirects to `/`
   - `/map/[id]` → Redirects to `/`
   - All routes under system's `primary_route` → Redirects to `/`

2. **API Routes:** Still accessible
   - `/api/maps/*` → Works (excluded from system visibility)
   - API routes handle their own auth/authorization

3. **Homepage:** Always accessible
   - `/` → Always works (explicit exception)

### Admin Users (`accounts.role = 'admin'`)

**Current behavior:** Admins are ALSO blocked by system visibility

1. **Page Routes:** Blocked (same as general users)
   - `/maps` → Redirects to `/` (even for admins)
   - `/admin/systems` → Works (separate role check, but system visibility still applies)

2. **Admin Routes:** Protected by role check
   - `/admin/*` → Requires `accounts.role = 'admin'`
   - System visibility check runs BEFORE role check
   - If admin system is disabled, `/admin/*` routes are blocked

3. **API Routes:** Still accessible
   - `/api/admin/*` → Works (excluded from system visibility)
   - Protected by `requireAdmin: true` in API route

## Important Note

**Admins are currently blocked by system visibility too.**

This means if you disable the "Admin" system:
- `/admin/systems` → Blocked (redirects to `/`)
- `/admin/dashboard` → Blocked
- All `/admin/*` routes → Blocked

**This might not be desired** - you may want admins to always access admin routes regardless of system visibility.

## Recommendation

Consider adding admin exception to system visibility:

```sql
-- In admin.is_route_visible function
-- Check if user is admin first
IF EXISTS (SELECT 1 FROM public.accounts WHERE user_id = p_user_id AND role = 'admin') THEN
  -- Admins bypass system visibility for admin routes
  IF p_route_path LIKE '/admin/%' THEN
    RETURN true;
  END IF;
END IF;
```

This would allow:
- Admins to always access `/admin/*` routes
- System visibility still applies to admins for non-admin routes
- General users remain fully blocked when systems are disabled

## Summary

**General Users:**
- ✅ Blocked from disabled systems
- ✅ Can access homepage
- ✅ API routes still work

**Admin Users (Current):**
- ⚠️ Also blocked from disabled systems
- ⚠️ Admin routes blocked if Admin system is disabled
- ✅ Can access homepage
- ✅ API routes still work

**Admin Users (Recommended):**
- ✅ Should bypass system visibility for `/admin/*` routes
- ✅ Still blocked from other disabled systems (like general users)
- ✅ Can manage systems even when disabled
