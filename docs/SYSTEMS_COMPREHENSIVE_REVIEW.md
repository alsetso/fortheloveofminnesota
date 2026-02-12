# Systems Comprehensive Review - Production Readiness Audit

**Date:** February 8, 2026  
**Purpose:** Ensure all database schemas have full coverage, no errors, and are production-ready before turning off all systems (homepage only).

## Executive Summary

### Current State
- **Total Database Schemas:** 30 schemas (excluding system schemas like `auth`, `storage`, `realtime`, `cron`, `vault`, `extensions`, `supabase_migrations`)
- **Registered Systems:** 10 systems in `admin.system_visibility`
- **Missing System Coverage:** 20 schemas not registered in system visibility

### Critical Issues Found
1. **Middleware Bug:** System visibility check runs before user is fetched, causing `user?.id` to be undefined
2. **Homepage Protection:** Homepage (`/`) must always be accessible - needs explicit exception
3. **Missing Schema Coverage:** Many schemas exist but aren't registered in system visibility
4. **Database Function Error:** `is_route_visible` function references `accounts` table without schema prefix

## Database Schema Inventory

### Registered Systems (10)
| Schema | System Name | Primary Route | Status |
|--------|-------------|---------------|--------|
| `maps` | Maps | `/maps` | ✅ Registered |
| `civic` | Government Directory | `/gov` | ✅ Registered |
| `stories` | Stories | `/stories` | ✅ Registered |
| `feeds` | Feed | `/feed` | ✅ Registered |
| `pages` | Pages | `/pages` | ✅ Registered |
| `social_graph` | Friends | `/friends` | ✅ Registered |
| `messaging` | Messages | `/messages` | ✅ Registered |
| `places` | Places | `/explore/places` | ✅ Registered |
| `ads` | Ad Center | `/ad_center` | ✅ Registered |
| `analytics` | Analytics | `/analytics` | ✅ Registered |

### Unregistered Schemas (20)
These schemas exist in the database but are NOT registered in `admin.system_visibility`:

| Schema | Table Count | Purpose | Action Required |
|--------|-------------|---------|-----------------|
| `admin` | 3 | Admin control tables | ✅ System schema - no route needed |
| `atlas` | 14 | Geographic reference data | ⚠️ May need registration if has routes |
| `billing` | 3 | Billing/plans system | ⚠️ May need registration if has routes |
| `checkbook` | 4 | Government checkbook data | ⚠️ Part of civic system - check coverage |
| `content` | 2 | Posts/media content | ⚠️ May need registration if has routes |
| `groups` | 2 | Groups system | ⚠️ May need registration if has routes |
| `id` | 1 | ID verification | ⚠️ May need registration if has routes |
| `interactions` | 2 | Reactions/comments | ⚠️ May need registration if has routes |
| `layers` | 5 | Map layers data | ⚠️ Part of maps system - check coverage |
| `moderation` | 2 | Moderation system | ⚠️ May need registration if has routes |
| `news` | 2 | News system | ⚠️ May need registration if has routes |
| `notifications` | 2 | Notifications | ⚠️ May need registration if has routes |
| `pro` | 1 | Pro/business features | ⚠️ May need registration if has routes |
| `public` | 16 | Legacy public schema | ⚠️ Mixed - some tables migrated, some legacy |

### System Schemas (No Route Needed)
These are infrastructure schemas that don't need route registration:
- `auth` - Supabase auth
- `storage` - Supabase storage
- `realtime` - Supabase realtime
- `cron` - Cron jobs
- `vault` - Secrets management
- `extensions` - PostgreSQL extensions
- `supabase_migrations` - Migration tracking

## Critical Issues & Fixes

### Issue 1: Middleware System Visibility Check Bug
**Location:** `src/middleware.ts` lines 258-274

**Problem:** 
- System visibility check runs before user is fetched
- `user?.id` is undefined when passed to `isRouteVisible()`
- This causes incorrect visibility checks

**Fix Required:**
- Move system visibility check after user is fetched
- Ensure homepage (`/`) is always allowed regardless of system visibility

### Issue 2: Homepage Must Always Be Accessible
**Location:** `src/middleware.ts` and `src/lib/admin/systemVisibility.ts`

**Problem:**
- When all systems are disabled, homepage should still be accessible
- Current implementation may block homepage if no systems are visible

**Fix Required:**
- Add explicit exception for homepage (`/`) in `isRouteVisible()`
- Ensure homepage is never blocked by system visibility

### Issue 3: Database Function Schema Reference
**Location:** `supabase/migrations/1019_create_system_visibility.sql` lines 68-70, 105-107

**Problem:**
- Function references `accounts` table without schema prefix
- Should be `public.accounts` for clarity

**Fix Required:**
- Update function to use `public.accounts` explicitly

### Issue 4: Missing Schema Coverage
**Problem:**
- Many schemas exist but aren't registered in system visibility
- When systems are disabled, routes may still be accessible if not registered

**Action Required:**
- Audit all routes to identify which schemas need registration
- Register missing schemas or mark as "no routes" if they're data-only

## Production Readiness Checklist

### ✅ Completed
- [x] System visibility tables created
- [x] Database functions created
- [x] Admin UI for managing systems
- [x] Middleware integration started
- [x] 10 systems registered

### ⚠️ Needs Fix
- [ ] Fix middleware system visibility check order
- [ ] Ensure homepage is always accessible
- [ ] Fix database function schema references
- [ ] Audit and register missing schemas
- [ ] Test with all systems disabled
- [ ] Verify homepage remains accessible

### 📋 Testing Required
- [ ] Disable all systems via admin UI
- [ ] Verify homepage (`/`) is accessible
- [ ] Verify all other routes redirect to homepage
- [ ] Verify admin routes still work
- [ ] Test with authenticated and unauthenticated users

## Recommended Actions

### Immediate (Before Production)
1. **Fix middleware bug** - Move system visibility check after user fetch
2. **Add homepage exception** - Ensure `/` is always accessible
3. **Fix database function** - Add schema prefix to `accounts` references
4. **Test homepage access** - Verify homepage works when all systems disabled

### Short-term (Post-Production)
1. **Audit routes** - Identify which schemas have routes
2. **Register missing schemas** - Add unregistered schemas to system visibility
3. **Document schema purposes** - Clarify which schemas are data-only vs route-based

### Long-term (Maintenance)
1. **Automated coverage checks** - Script to detect unregistered schemas
2. **Route-to-schema mapping** - Document which routes belong to which schemas
3. **System health dashboard** - Show system coverage status

## Schema-to-Route Mapping Analysis

### Schemas with Routes (Need Registration)
Based on codebase analysis, these schemas likely have routes:

- `checkbook` → `/gov/checkbook/*` (part of civic system)
- `content` → `/post/*`, `/posts/*` (if routes exist)
- `groups` → `/groups/*` (if routes exist)
- `interactions` → Embedded in other systems (no direct routes)
- `moderation` → `/admin/moderation/*` (if routes exist)
- `notifications` → Embedded in UI (no direct routes)
- `pro` → `/pro/*` or `/business/*` (if routes exist)

### Schemas without Routes (Data-only)
These schemas are data-only and don't need route registration:

- `atlas` - Reference data, accessed via API
- `billing` - Data schema, routes likely in `/settings/billing`
- `layers` - Map layer data, accessed via API
- `id` - ID verification data, accessed via API
- `news` - Data schema, routes may exist

## Next Steps

1. **Fix critical bugs** (middleware, homepage, database function)
2. **Test with all systems disabled**
3. **Verify homepage accessibility**
4. **Document any remaining issues**
5. **Create migration to fix database function**
