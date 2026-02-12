# What Happens When You Toggle System Visibility

## Quick Answer

**Both "Visible" and "Enabled" do the same thing: block user access to the system.**

When either is unchecked, users trying to visit routes under that system get redirected to the homepage.

## Detailed Explanation

### When You Uncheck "Visible" (`is_visible = false`)

**What happens:**
1. User tries to visit `/stories` (or any route under Stories system)
2. Middleware calls `isRouteVisible('/stories')`
3. Database function checks `admin.system_visibility.is_visible`
4. Finds `is_visible = false` for Stories system
5. Returns `false` → route is blocked
6. User gets redirected to homepage (`/`)

**Effect:** All routes under that system become inaccessible
- `/stories` → blocked
- `/stories/new` → blocked  
- `/stories/new/composer` → blocked

### When You Uncheck "Enabled" (`is_enabled = false`)

**What happens:**
1. Same flow as above
2. Database function checks `admin.system_visibility.is_enabled`
3. Finds `is_enabled = false` for Stories system
4. Returns `false` → route is blocked
5. User gets redirected to homepage

**Effect:** Same as `is_visible = false` - all routes blocked

### The Difference (Semantic)

**`is_visible`** = "Should users know this system exists?"
- Use when you want to hide a feature completely
- Example: "Stories feature is in development, hide it"

**`is_enabled`** = "Is this system functional/ready?"
- Use when system exists but isn't working properly
- Example: "Stories feature exists but has bugs, disable it temporarily"

**In practice:** Both block access identically. The difference is just for your own organization/documentation.

### What Gets Checked

The database function `admin.is_route_visible()` checks:

```sql
-- If system is found
IF system_visible = false OR system_enabled = false THEN
  RETURN false;  -- Route is blocked
END IF;
```

**Both must be `true` for routes to be accessible.**

### Example Scenarios

**Scenario 1: Hide Stories Feature**
- Uncheck "Visible" for Stories
- Result: `/stories/*` routes redirect to homepage
- Users can't access stories at all

**Scenario 2: Disable Maps Temporarily**
- Uncheck "Enabled" for Maps  
- Result: `/maps/*` routes redirect to homepage
- Users can't access maps (same as hiding)

**Scenario 3: Both Unchecked**
- Uncheck both "Visible" and "Enabled"
- Result: Routes still blocked (same as one unchecked)

**Scenario 4: Both Checked**
- Both "Visible" and "Enabled" are checked
- Result: Routes are accessible (if no feature requirement)

### Feature Requirements

If `requires_feature` is set:
- System checks if user has that billing feature
- Even if `is_visible = true` and `is_enabled = true`
- Users without the feature still get blocked

### Where This Happens

1. **Middleware** (`src/middleware.ts` line 258-267)
   - Checks every page route request
   - Calls `isRouteVisible(pathname)`
   - Redirects if `false`

2. **Database Function** (`admin.is_route_visible()`)
   - Checks `admin.system_visibility` table
   - Returns `true` or `false`

3. **Admin UI** (`/admin/systems`)
   - Toggles update the database
   - Changes take effect immediately
   - No restart needed

## Summary

- **Uncheck "Visible"** → Routes blocked
- **Uncheck "Enabled"** → Routes blocked  
- **Both unchecked** → Routes blocked
- **Both checked** → Routes accessible (if no feature requirement)

The toggle is immediate - users will be redirected on their next page visit.
