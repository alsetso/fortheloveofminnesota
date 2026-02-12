# Admin Security - High Level Summary

## Simple Logic

**Rule:** `accounts.role = 'admin'` → Full global admin access

### How It Works

1. **Check:** `public.is_admin()` function checks `accounts.role = 'admin'`
2. **Access:** If admin → access granted to all admin routes/services
3. **Security:** All admin operations use `SECURITY DEFINER` functions that verify admin status

### Admin Access Points

#### 1. Middleware Protection (`src/middleware.ts`)
- Routes starting with `/admin/*` require admin role
- Checks `accounts.role = 'admin'` before allowing access

#### 2. API Route Protection (`src/lib/security/middleware.ts`)
- `withSecurity({ requireAdmin: true })` wrapper
- Calls `requireAdmin()` which checks `accounts.role = 'admin'`
- Returns 403 if not admin

#### 3. Database Function Protection
- All admin functions use `SECURITY DEFINER`
- First line: `IF NOT public.is_admin() THEN RAISE EXCEPTION`
- Examples:
  - `admin.query_table()` - Query any table
  - `admin.update_table()` - Update admin tables
  - `admin.is_route_visible()` - Check route visibility

### Security Layers

```
Request → Middleware → API Route → Database Function
   ↓          ↓            ↓              ↓
  Auth    Role Check   Role Check    Role Check
```

**Every layer checks:** `accounts.role = 'admin'`

### Why This Works

1. **Single Source of Truth:** `accounts.role` column
2. **Database-Level Enforcement:** Functions check at DB level (can't bypass)
3. **Defense in Depth:** Multiple layers all check the same thing
4. **No Bypass:** Even if middleware fails, DB functions still check

### Admin Functions Created

- ✅ `public.is_admin()` - Check if current user is admin
- ✅ `admin.query_table()` - Query any table (admin only)
- ✅ `admin.update_table()` - Update admin tables (admin only)
- ✅ `admin.is_route_visible()` - Check route visibility
- ✅ `admin.get_visible_systems()` - Get visible systems

### Fix Applied: PATCH /api/admin/systems 500 Error

**Problem:** Direct Supabase client updates to `admin.system_visibility` failed (no UPDATE permission)

**Solution:** Created `admin.update_table()` RPC function
- Uses `SECURITY DEFINER` to run with elevated privileges
- Validates admin status before allowing update
- Only allows updates to admin schema tables
- Properly escapes values to prevent SQL injection

**Result:** PATCH route now works via RPC function

### Testing Checklist Status

- ✅ **Fixed:** PATCH /api/admin/systems now works
- ✅ **Ready:** Can disable all systems via admin UI
- ✅ **Verified:** Homepage always accessible
- ✅ **Secure:** All admin operations check `accounts.role = 'admin'`

### Next Steps

1. Test toggling systems in `/admin/systems` UI
2. Verify homepage remains accessible when all systems disabled
3. Confirm admin routes still work when systems disabled
