# API Routes Authentication Checks

## Overview

All API routes use `withSecurity` middleware which calls `getRequestAuth()` (cached per request). Some routes also perform additional auth checks via `getServerAuth()` or `supabase.auth.getUser()`.

## Authentication Methods

1. **`withSecurity` middleware** - Primary method, uses `getRequestAuth()` (cached)
2. **`getServerAuth()`** - Direct server auth check (also cached via React cache)
3. **`supabase.auth.getUser()`** - Direct Supabase auth check (redundant in most cases)

## Routes Requiring Authentication (`requireAuth: true`)

### Maps
- `POST /api/maps` - Create map
- `PUT /api/maps/[id]` - Update map
- `DELETE /api/maps/[id]` - Delete map
- `POST /api/maps/[id]/publish` - Publish map to community

### Map Pins
- `POST /api/maps/[id]/pins` - Create pin
- `PUT /api/maps/[id]/pins/[pinId]` - Update pin
- `DELETE /api/maps/[id]/pins/[pinId]` - Delete pin

### Map Areas
- `POST /api/maps/[id]/areas` - Create area
- `PUT /api/maps/[id]/areas/[areaId]` - Update area
- `DELETE /api/maps/[id]/areas/[areaId]` - Delete area

### Map Categories
- `POST /api/maps/[id]/categories` - Create category
- `PUT /api/maps/[id]/categories/[categoryId]` - Update category
- `DELETE /api/maps/[id]/categories/[categoryId]` - Delete category

### Map Members
- `GET /api/maps/[id]/members` - List members
- `POST /api/maps/[id]/members` - Add member
- `PUT /api/maps/[id]/members/[memberId]` - Update member role
- `DELETE /api/maps/[id]/members/[memberId]` - Remove member

### Map Membership Requests
- `GET /api/maps/[id]/membership-requests` - List requests
- `POST /api/maps/[id]/membership-requests` - Create request
- `GET /api/maps/[id]/membership-requests/my-request` - Get user's request
- `PUT /api/maps/[id]/membership-requests/[requestId]` - Update request
- `DELETE /api/maps/[id]/membership-requests/[requestId]` - Delete request

### Posts
- `POST /api/posts` - Create post
- `PUT /api/posts/[id]` - Update post
- `DELETE /api/posts/[id]` - Delete post

### Billing
- `GET /api/billing/user-features` - Get user features
- `GET /api/billing/views-usage` - Get views usage
- `GET /api/billing/usage` - Get usage stats
- `GET /api/billing/check-feature` - Check feature access
- `POST /api/billing/checkout` - Create checkout session
- `POST /api/billing/checkout-promo` - Create promo checkout
- `POST /api/billing/checkout-credits` - Create credits checkout
- `POST /api/billing/create-subscription` - Create subscription
- `POST /api/billing/create-payment` - Create payment
- `POST /api/billing/ensure-customer` - Ensure Stripe customer
- `GET /api/billing/payment-history` - Get payment history
- `POST /api/billing/create-portal-session` - Create portal session

### Accounts
- `GET /api/accounts` - Get accounts (authenticated)
- `POST /api/accounts` - Create account
- `POST /api/accounts/onboard` - Complete onboarding
- `GET /api/accounts/username/check` - Check username availability

### People
- `GET /api/people` - Search people

### News
- `POST /api/news/save` - Save news article
- `POST /api/news/generate` - Generate news

### Analytics
- `GET /api/maps/[id]/viewers` - Get map viewers

## Routes with Optional Authentication (`requireAuth: false`)

### Maps (Public Read Access)
- `GET /api/maps` - List maps (public maps visible to all)
- `GET /api/maps/[id]` - Get map (public maps visible to all)
- `GET /api/maps/[id]/data` - Get map data
- `GET /api/maps/[id]/stats` - Get map stats
- `GET /api/maps/stats` - Get maps stats

### Map Pins (Public Read Access)
- `GET /api/maps/[id]/pins` - List pins
- `GET /api/maps/[id]/pins/[pinId]` - Get pin

### Map Areas (Public Read Access)
- `GET /api/maps/[id]/areas` - List areas
- `GET /api/maps/[id]/areas/[areaId]` - Get area

### Map Categories (Public Read Access)
- `GET /api/maps/[id]/categories` - List categories

### Posts (Public Read Access)
- `GET /api/posts/[id]` - Get post (public posts visible to all)

### Mentions
- `GET /api/mentions/nearby` - Get nearby mentions
- `GET /api/maps/live/mentions` - Get live map mentions

### News
- `GET /api/news` - Get news articles

### Analytics (Public Tracking)
- `POST /api/analytics/view` - Track page view (optional auth)
- `POST /api/analytics/map-view` - Track map view
- `POST /api/analytics/special-map-view` - Track special map view
- `POST /api/analytics/pin-view` - Track pin view
- `GET /api/analytics/pin-stats` - Get pin stats

### Billing (Public)
- `GET /api/billing/plans` - Get plans (public)

### Civic Data (Public)
- `GET /api/civic/ctu-boundaries` - Get CTU boundaries
- `GET /api/civic/congressional-districts` - Get congressional districts
- `GET /api/civic/state-boundary` - Get state boundary
- `GET /api/civic/county-boundaries` - Get county boundaries

### Other (Public)
- `GET /api/address` - Geocode address
- `GET /api/device-info` - Get device info

### Webhooks (No Auth - Verified via Signature)
- `POST /api/stripe/webhook` - Stripe webhook (verified via signature)

## Routes with Redundant Auth Checks

These routes use `withSecurity` (which already checks auth) but also call `getServerAuth()` or `supabase.auth.getUser()`:

1. **`/api/maps/route.ts`** (POST)
   - Uses `withSecurity` with `requireAuth: true`
   - Also calls `getServerAuth()` for account lookup
   - Also calls `supabase.auth.getUser()` for verification

2. **`/api/maps/[id]/route.ts`** (GET)
   - Uses `withSecurity` with `requireAuth: false`
   - Also calls `getServerAuth()` for optional auth

3. **`/api/maps/[id]/pins/route.ts`** (GET)
   - Uses `withSecurity` with `requireAuth: false`
   - Also calls `getServerAuth()` for optional auth

4. **`/api/maps/[id]/areas/route.ts`** (GET)
   - Uses `withSecurity` with `requireAuth: false`
   - Also calls `getServerAuth()` for optional auth

5. **`/api/maps/[id]/pins/[pinId]/route.ts`** (GET)
   - Uses `withSecurity` with `requireAuth: false`
   - Also calls `getServerAuth()` for optional auth

6. **`/api/billing/checkout/route.ts`** (POST)
   - Uses `withSecurity` with `requireAuth: true`
   - Also calls `supabase.auth.getUser()` for verification

7. **`/api/billing/checkout-credits/route.ts`** (POST)
   - Uses `withSecurity` with `requireAuth: true`
   - Also calls `supabase.auth.getUser()` for verification

8. **`/api/billing/check-feature/route.ts`** (GET)
   - Uses `withSecurity` with `requireAuth: true`
   - Also calls `supabase.auth.getUser()` for verification

## Optimization Opportunities

### Current State
- `withSecurity` uses `getRequestAuth()` which is cached per request
- `getServerAuth()` uses React `cache()` for request-level deduplication
- Some routes still do redundant `supabase.auth.getUser()` calls

### Recommendations

1. **Remove redundant `supabase.auth.getUser()` calls** in routes that already use `withSecurity` with `requireAuth: true`
   - The `userId` from `withSecurity` context is already validated
   - Additional `getUser()` calls are redundant

2. **Use `getServerAuth()` instead of `supabase.auth.getUser()`** for optional auth
   - `getServerAuth()` is cached and more efficient
   - Already used in some routes, should be standardized

3. **Consider request-level auth caching**
   - `getRequestAuth()` already caches per request
   - Could be shared across all API routes in same request

## Total Count

- **Routes requiring auth**: ~45
- **Routes with optional auth**: ~25
- **Routes with redundant checks**: ~8
