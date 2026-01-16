# Security Baseline Checklist

**Date:** 2025-01-27  
**Status:** Infrastructure Complete, Routes Migration In Progress

## ✅ Completed

### Infrastructure
- [x] API surface inventory (70+ routes documented)
- [x] Rate limiting infrastructure (`src/lib/security/rateLimit.ts`)
- [x] Input validation infrastructure (`src/lib/security/validation.ts`)
- [x] Secure API key handling (`src/lib/security/apiKeys.ts`)
- [x] Access control utilities (`src/lib/security/accessControl.ts`)
- [x] Security middleware wrapper (`src/lib/security/middleware.ts`)
- [x] Example implementations (`src/lib/security/examples.ts`)
- [x] Documentation and migration guides

### Critical Fixes
- [x] OpenAI API key moved to server-only (`OPENAI_API_KEY`)
- [x] RapidAPI key moved to server-only (`RAPIDAPI_KEY`)
- [x] API proxy routes created for client-side usage
- [x] Client-side services updated to use proxy routes

### Routes with Security Baseline
- [x] `/api/intelligence/chat` - Full baseline
- [x] `/api/proxy/skip-trace/search` - Full baseline
- [x] `/api/proxy/zillow/search` - Full baseline

## ⏭️ High Priority (Before Production)

### 1. Apply Security to Critical High-Traffic Routes

#### Analytics Routes (High Traffic)
- [ ] `/api/analytics/view` (POST) - Page view tracking
  - Rate limit: `public` (100/min) or `authenticated` (200/min)
  - Input validation: page_url, referrer_url, session_id
  - Request size: 1MB
  
- [ ] `/api/analytics/visitors` (GET) - Visitor analytics
  - Rate limit: `authenticated` (200/min)
  - Query validation: date ranges, filters
  
- [ ] `/api/analytics/homepage-stats` (GET)
  - Rate limit: `public` (100/min)
  
- [ ] `/api/analytics/live-visitors` (GET)
  - Rate limit: `authenticated` (200/min)

#### Feed Routes (High Traffic)
- [ ] `/api/feed` (GET) - List posts
  - Rate limit: `public` (100/min) or `authenticated` (200/min)
  - Query validation: pagination, filters
  
- [ ] `/api/feed` (POST) - Create post
  - Rate limit: `authenticated` (200/min)
  - Input validation: title, content, visibility, media
  - Require auth: true
  - Request size: 10MB (for media)

#### Maps Routes (Authenticated, High Usage)
- [ ] `/api/maps` (GET) - List maps
  - Rate limit: `authenticated` (200/min)
  - Query validation: pagination, filters
  
- [ ] `/api/maps` (POST) - Create map
  - Rate limit: `authenticated` (200/min)
  - Input validation: title, description, visibility, style
  - Require auth: true
  
- [ ] `/api/maps/[id]` (GET/PUT/DELETE)
  - Rate limit: `authenticated` (200/min)
  - Require auth: true
  - Ownership check for PUT/DELETE

### 2. Apply Security to Sensitive Routes

#### Billing Routes (Sensitive)
- [ ] `/api/billing/data` (GET)
  - Rate limit: `authenticated` (200/min)
  - Require auth: true
  
- [ ] `/api/billing/checkout` (POST)
  - Rate limit: `authenticated` (60/min) - strict
  - Input validation: price_id, success_url, cancel_url
  - Require auth: true

#### Account Routes (Sensitive)
- [ ] `/api/accounts` (GET/POST)
  - Rate limit: `authenticated` (200/min)
  - Require auth: true (for GET own, POST create)
  - Input validation: username, email, profile data
  
- [ ] `/api/accounts/onboard` (POST)
  - Rate limit: `authenticated` (60/min) - strict
  - Input validation: onboarding answers
  - Require auth: true

#### Skip Trace Routes (Sensitive)
- [ ] `/api/skip-trace/store` (POST)
  - Rate limit: `authenticated` (60/min) - strict
  - Input validation: address, rawResponse, searchQuery
  - Require auth: true

### 3. Apply Security to Admin Routes

#### Admin - Atlas
- [ ] `/api/admin/atlas/[table]` (GET/POST)
  - Rate limit: `admin` (500/min)
  - Require admin: true
  - Input validation: table name, entity data
  
- [ ] `/api/admin/atlas/[table]/[id]` (GET/PUT/DELETE)
  - Rate limit: `admin` (500/min)
  - Require admin: true
  - Path validation: table, id

#### Admin - Buildings
- [ ] `/api/admin/buildings` (GET/POST)
  - Rate limit: `admin` (500/min)
  - Require admin: true
  
- [ ] `/api/admin/buildings/[id]` (PUT/DELETE)
  - Rate limit: `admin` (500/min)
  - Require admin: true
  
- [ ] `/api/admin/buildings/upload-image` (POST)
  - Rate limit: `admin` (500/min)
  - Require admin: true
  - Request size: 10MB

#### Admin - Other
- [ ] `/api/admin/atlas-types/*` - All routes
- [ ] `/api/admin/cities/[id]` - Update/delete
- [ ] `/api/admin/counties/[id]` - Update/delete
- [ ] `/api/admin/mention-icons/*` - All routes
- [ ] `/api/admin/payroll/import` (POST)
  - Rate limit: `admin` (500/min)
  - Require admin: true
  - Request size: 10MB (for file uploads)

### 4. Apply Security to Public Read Routes

#### News Routes
- [ ] `/api/news` (GET) - List news
  - Rate limit: `public` (100/min)
  - Query validation: pagination, filters
  
- [ ] `/api/news/all` (GET)
  - Rate limit: `public` (100/min)
  
- [ ] `/api/news/[id]` (GET)
  - Rate limit: `public` (100/min)
  - Path validation: id
  
- [ ] `/api/news/by-date` (GET)
  - Rate limit: `public` (100/min)
  - Query validation: date
  
- [ ] `/api/news/dates-with-news` (GET)
  - Rate limit: `public` (100/min)
  
- [ ] `/api/news/generate` (POST) - Admin only
  - Rate limit: `admin` (500/min)
  - Require admin: true
  
- [ ] `/api/news/cron` (GET) - Already has CRON_SECRET protection
  - ✅ Keep existing protection

#### Atlas Routes
- [ ] `/api/atlas/types` (GET)
  - Rate limit: `public` (100/min)
  
- [ ] `/api/atlas/[table]/entities` (GET)
  - Rate limit: `public` (100/min)
  - Path validation: table
  
- [ ] `/api/atlas/[table]/[id]` (GET)
  - Rate limit: `public` (100/min)
  - Path validation: table, id

#### Civic Routes
- [ ] `/api/civic/events` (GET)
- [ ] `/api/civic/buildings` (GET)
- [ ] `/api/civic/county-boundaries` (GET)
- [ ] `/api/civic/ctu-boundaries` (GET)
- [ ] `/api/civic/congressional-districts` (GET)
- [ ] `/api/civic/state-boundary` (GET)
  - Rate limit: `public` (100/min) for all

#### Other Public Routes
- [ ] `/api/categories/*` - All routes
- [ ] `/api/points-of-interest` (GET)
- [ ] `/api/mention-icons` (GET)
- [ ] `/api/address` (POST) - Geocoding
- [ ] `/api/geocode/autocomplete` (GET)
- [ ] `/api/contact` (POST) - Contact form
  - Rate limit: `strict` (10/min) - prevent spam

### 5. Express API Server (apps/api)

#### GraphQL Endpoint
- [ ] Add rate limiting to `/graphql` endpoint
  - Rate limit: `authenticated` (200/min) or `public` (100/min)
  - Add authentication middleware
  - Input validation for queries/mutations

#### Stripe Webhook
- [x] ✅ Already has signature verification
- [ ] Consider adding request size limit

## ⏭️ Medium Priority

### 6. Standardize Error Handling
- [ ] Review all routes for error message exposure
- [ ] Ensure no internal errors exposed to clients
- [ ] Use consistent error response format
- [ ] Log errors server-side only (dev mode)

### 7. Request Size Limits
- [ ] Apply to all POST routes (1MB default)
- [ ] Apply to file upload routes (10MB-50MB)
- [ ] Apply to form data routes (10MB)

### 8. Input Validation
- [ ] Add Zod schemas to all POST/PUT routes
- [ ] Validate query parameters on GET routes
- [ ] Validate path parameters
- [ ] Sanitize string inputs

## ⏭️ Long-Term

### 9. Monitoring & Alerting
- [ ] Set up rate limit hit monitoring
- [ ] Track validation failures
- [ ] Alert on suspicious patterns (failed auth, unusual access)
- [ ] Monitor API key usage
- [ ] Track error rates

### 10. Upgrade Rate Limiting
- [ ] Replace in-memory cache with Redis
- [ ] Add distributed rate limiting
- [ ] Support for multiple server instances

### 11. Security Testing
- [ ] Add security tests for rate limiting
- [ ] Test validation edge cases
- [ ] Test access control (auth, admin, ownership)
- [ ] Penetration testing before production

### 12. Audit Logging
- [ ] Log all admin actions
- [ ] Track sensitive operations (billing, account changes)
- [ ] Monitor API key usage
- [ ] Track data access patterns

## Priority Order

### Phase 1: Critical Routes (Do First)
1. Analytics routes (high traffic)
2. Feed routes (high traffic)
3. Maps routes (authenticated, high usage)
4. Billing routes (sensitive)
5. Account routes (sensitive)

### Phase 2: Admin Routes
6. All admin routes (security critical)

### Phase 3: Public Routes
7. News routes
8. Atlas routes
9. Civic routes
10. Other public routes

### Phase 4: Infrastructure
11. GraphQL endpoint
12. Error handling standardization
13. Monitoring setup

## Implementation Template

For each route, follow this pattern:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validateRequestBody, validateQueryParams, validatePathParams } from '@/lib/security/validation';
import { z } from 'zod';

// Define validation schema
const schema = z.object({
  // ... fields
});

export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      // Validate query params
      const url = new URL(req.url);
      const validation = validateQueryParams(url.searchParams, schema);
      if (!validation.success) {
        return validation.error;
      }
      
      // Your logic here
      return NextResponse.json({ data: [] });
    },
    {
      rateLimit: 'public', // or 'authenticated', 'admin', etc.
      requireAuth: false, // or true
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}

export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      // Validate request body
      const validation = await validateRequestBody(req, schema);
      if (!validation.success) {
        return validation.error;
      }
      
      // Your logic here
      return NextResponse.json({ success: true }, { status: 201 });
    },
    {
      rateLimit: 'authenticated',
      requireAuth: true,
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}
```

## Testing Checklist

For each route after migration:
- [ ] Test rate limiting (verify 429 responses)
- [ ] Test validation (verify 400 responses for invalid input)
- [ ] Test access control (verify 401/403 responses)
- [ ] Test request size limits (verify 413 responses)
- [ ] Test normal operation (verify 200/201 responses)
- [ ] Test error handling (verify no internal errors exposed)

## Resources

- Examples: `src/lib/security/examples.ts`
- Migration Guide: `docs/SECURITY_BASELINE_IMPLEMENTATION.md`
- API Inventory: `docs/API_SURFACE_INVENTORY.md`
- Security Utilities: `src/lib/security/`
