# Remaining Routes to Secure

**Date:** 2025-01-27  
**Status:** 47 routes secured (64%), 27 routes remaining (36%)

## Completed Batches

### ✅ Batch 1: Public Routes (27 routes)
- Analytics (11 routes)
- News (7 routes)
- Atlas (3 routes)
- Civic (6 routes)

### ✅ Batch 2: Maps Routes (8 routes)
- All maps routes with ownership checks

## Remaining Routes by Priority

### Batch 3: Feed Routes (2 routes) - HIGH PRIORITY
**Effort:** Medium - Need validation for post creation with media

- `/api/feed` (GET) - List posts
  - Rate limit: `authenticated` (200/min) or `public` (100/min)
  - Query validation: pagination, filters
  - Optional auth (RLS handles permissions)

- `/api/feed` (POST) - Create post
  - Rate limit: `authenticated` (200/min)
  - Input validation: title, content, visibility, media, location
  - Require auth: true
  - Request size: 10MB (for media uploads)

### Batch 4: Admin Routes (15 routes) - MEDIUM PRIORITY
**Effort:** Low - Already have admin checks, just need wrapper

- `/api/admin/atlas/[table]` (GET/POST)
- `/api/admin/atlas/[table]/[id]` (GET/PUT/DELETE)
- `/api/admin/buildings` (GET/POST)
- `/api/admin/buildings/[id]` (PUT/DELETE)
- `/api/admin/buildings/upload-image` (POST) - 10MB limit
- `/api/admin/atlas-types` (GET/POST)
- `/api/admin/atlas-types/[id]` (GET/PUT/DELETE)
- `/api/admin/atlas-types/upload-icon` (POST) - 10MB limit
- `/api/admin/mention-icons` (GET/POST)
- `/api/admin/mention-icons/[id]` (GET/PUT/DELETE)
- `/api/admin/mention-icons/upload-icon` (POST) - 10MB limit
- `/api/admin/cities/[id]` (PUT/DELETE)
- `/api/admin/counties/[id]` (PUT/DELETE)
- `/api/admin/payroll/import` (POST) - 10MB limit

### Batch 5: Other Routes (10 routes) - LOW PRIORITY
**Effort:** Low to Medium

- `/api/categories` (GET)
- `/api/categories/[id]` (GET)
- `/api/categories/search` (GET)
- `/api/points-of-interest` (GET)
- `/api/mention-icons` (GET) - Public route
- `/api/skip-trace/store` (POST) - Requires auth
- `/api/location-searches` (GET/POST) - Requires auth
- `/api/article/[id]/comments` (GET/POST) - Public GET, auth POST

## Recommended Order

1. **Batch 3: Feed Routes** (2 routes) - High traffic, user-generated content
2. **Batch 4: Admin Routes** (15 routes) - Already protected, quick wins
3. **Batch 5: Other Routes** (10 routes) - Lower priority

## Total Remaining: 27 routes
