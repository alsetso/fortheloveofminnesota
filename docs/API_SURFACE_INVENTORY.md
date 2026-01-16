# API Surface Inventory

**Date:** 2025-01-27  
**Purpose:** Complete inventory of all API call surfaces for security baseline implementation

## Client → Server API Routes

### Public Routes (No Authentication Required)

#### Analytics
- `POST /api/analytics/view` - Record page view (optional auth)
- `GET /api/analytics/visitors` - Get visitor analytics
- `GET /api/analytics/homepage-stats` - Homepage statistics
- `GET /api/analytics/live-visitors` - Live visitor count
- `GET /api/analytics/atlas-map-stats` - Atlas map statistics
- `GET /api/analytics/special-map-stats` - Special map statistics
- `GET /api/analytics/special-map-view` - Special map view
- `GET /api/analytics/map-view` - Map view tracking
- `POST /api/analytics/pin-view` - Pin view tracking
- `GET /api/analytics/pin-stats` - Pin statistics
- `GET /api/analytics/my-pins` - User's pin analytics (requires auth)
- `GET /api/analytics/my-entities` - User's entity analytics (requires auth)
- `GET /api/analytics/feed-stats` - Feed statistics

#### News
- `GET /api/news` - List all news
- `GET /api/news/all` - Get all news articles
- `GET /api/news/latest` - Get latest news (rate limited: 10/min)
- `GET /api/news/[id]` - Get single article
- `GET /api/news/by-date` - Get news by date
- `GET /api/news/dates-with-news` - Get dates with news
- `POST /api/news/generate` - Generate news (admin)
- `GET /api/news/cron` - Cron job endpoint (protected by CRON_SECRET)

#### Maps
- `GET /api/maps` - List maps (public + own private)
- `GET /api/maps/[id]` - Get single map
- `GET /api/maps/[id]/stats` - Map statistics
- `GET /api/maps/[id]/viewers` - Map viewers
- `GET /api/maps/stats` - Bulk map statistics
- `POST /api/maps` - Create map (auth required, pro plan)
- `PUT /api/maps/[id]` - Update map (auth required, owner)
- `DELETE /api/maps/[id]` - Delete map (auth required, owner)
- `GET /api/maps/[id]/pins` - List pins on map
- `POST /api/maps/[id]/pins` - Create pin (auth required)
- `GET /api/maps/[id]/pins/[pinId]` - Get pin
- `PUT /api/maps/[id]/pins/[pinId]` - Update pin (auth required, owner)
- `DELETE /api/maps/[id]/pins/[pinId]` - Delete pin (auth required, owner)
- `GET /api/maps/[id]/areas` - List areas on map
- `POST /api/maps/[id]/areas` - Create area (auth required)
- `GET /api/maps/[id]/areas/[areaId]` - Get area
- `PUT /api/maps/[id]/areas/[areaId]` - Update area (auth required, owner)
- `DELETE /api/maps/[id]/areas/[areaId]` - Delete area (auth required, owner)

#### Atlas
- `GET /api/atlas/types` - Get atlas types
- `GET /api/atlas/[table]/entities` - List entities by type
- `GET /api/atlas/[table]/[id]` - Get single entity

#### Civic
- `GET /api/civic/events` - Get civic events
- `GET /api/civic/buildings` - Get buildings
- `GET /api/civic/county-boundaries` - Get county boundaries
- `GET /api/civic/ctu-boundaries` - Get CTU boundaries
- `GET /api/civic/congressional-districts` - Get congressional districts
- `GET /api/civic/state-boundary` - Get state boundary

#### Categories
- `GET /api/categories` - List categories
- `GET /api/categories/[id]` - Get category
- `GET /api/categories/search` - Search categories

#### Points of Interest
- `GET /api/points-of-interest` - List POIs

#### Location Services
- `POST /api/location-searches` - Save location search (auth required)
- `POST /api/address` - Geocode address
- `GET /api/geocode/autocomplete` - Address autocomplete

#### Intelligence
- `POST /api/intelligence/chat` - AI chat completion (uses OpenAI API)

#### Contact
- `POST /api/contact` - Contact form submission

#### Mention Icons
- `GET /api/mention-icons` - List mention icons

### Authenticated Routes

#### Accounts
- `GET /api/accounts` - Get accounts (own)
- `POST /api/accounts` - Create account
- `POST /api/accounts/onboard` - Complete onboarding
- `GET /api/accounts/username/check` - Check username availability

#### Billing
- `GET /api/billing/data` - Get billing data (auth required)
- `POST /api/billing/checkout` - Create checkout session (auth required)

#### Skip Trace
- `POST /api/skip-trace/store` - Store skip trace result (auth required)

#### Articles/Comments
- `POST /api/article/[id]/comments` - Create comment (auth required)

### Admin Routes (Admin Role Required)

#### Admin - Atlas
- `POST /api/admin/atlas/[table]` - Create atlas entity
- `DELETE /api/admin/atlas/[table]/[id]` - Delete atlas entity
- `GET /api/admin/atlas/[table]` - List atlas entities
- `GET /api/admin/atlas/[table]/[id]` - Get atlas entity

#### Admin - Atlas Types
- `GET /api/admin/atlas-types` - List atlas types
- `POST /api/admin/atlas-types` - Create atlas type
- `PUT /api/admin/atlas-types/[id]` - Update atlas type
- `DELETE /api/admin/atlas-types/[id]` - Delete atlas type
- `POST /api/admin/atlas-types/upload-icon` - Upload icon

#### Admin - Buildings
- `GET /api/admin/buildings` - List buildings
- `POST /api/admin/buildings` - Create building
- `PUT /api/admin/buildings/[id]` - Update building
- `DELETE /api/admin/buildings/[id]` - Delete building
- `POST /api/admin/buildings/upload-image` - Upload building image

#### Admin - Cities
- `PUT /api/admin/cities/[id]` - Update city
- `DELETE /api/admin/cities/[id]` - Delete city

#### Admin - Counties
- `PUT /api/admin/counties/[id]` - Update county
- `DELETE /api/admin/counties/[id]` - Delete county

#### Admin - Mention Icons
- `GET /api/admin/mention-icons` - List mention icons
- `POST /api/admin/mention-icons` - Create mention icon
- `PUT /api/admin/mention-icons/[id]` - Update mention icon
- `DELETE /api/admin/mention-icons/[id]` - Delete mention icon
- `POST /api/admin/mention-icons/upload-icon` - Upload icon

#### Admin - Payroll
- `POST /api/admin/payroll/import` - Import payroll data

### Webhook Routes

#### Stripe
- `POST /api/stripe/webhook` - Stripe webhook handler (signature verified)

### Test Routes
- `POST /api/test-payments/create-intent` - Create test payment intent

## Server → Third Party APIs

### External API Integrations

#### Stripe
- **Purpose:** Payment processing, subscriptions
- **Endpoints:**
  - `https://api.stripe.com/v1/checkout/sessions` - Create checkout sessions
  - `https://api.stripe.com/v1/subscriptions` - Manage subscriptions
  - `https://api.stripe.com/v1/customers` - Customer management
  - `https://api.stripe.com/v1/payment_intents` - Payment intents
- **Authentication:** Bearer token (STRIPE_SECRET_KEY)
- **Security:** ✅ Server-only key, webhook signature verification

#### OpenAI
- **Purpose:** AI chat completions
- **Endpoint:** `https://api.openai.com/v1/chat/completions`
- **Authentication:** Bearer token
- **Security:** ⚠️ **ISSUE** - Uses `NEXT_PUBLIC_OPENAI_API_KEY` (exposed to client)
- **Fix Required:** Move to server-only env var

#### RapidAPI Services
- **Purpose:** Skip trace, Zillow, News APIs
- **Endpoints:**
  - `https://skip-tracing-working-api.p.rapidapi.com/*` - Skip trace API
  - `https://zillow56.p.rapidapi.com/*` - Zillow API
  - `https://newsapi.org/v2/*` - News API (via RapidAPI)
- **Authentication:** `X-RapidAPI-Key` header
- **Security:** ⚠️ **ISSUE** - Uses `NEXT_PUBLIC_RAPIDAPI_KEY` (exposed to client)
- **Fix Required:** Move to server-only env var, proxy through API routes

#### Mapbox
- **Purpose:** Maps, geocoding, autocomplete
- **Endpoints:**
  - `https://api.mapbox.com/geocoding/v5/*` - Geocoding
  - `https://api.mapbox.com/directions/v5/*` - Directions
- **Authentication:** Access token in URL
- **Security:** ✅ Uses `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` (acceptable for public map service)

#### Supabase
- **Purpose:** Database, auth, storage
- **Endpoints:** Supabase project URL
- **Authentication:** 
  - Anon key for client operations (RLS-protected)
  - Service role key for admin operations (server-only)
- **Security:** ✅ Service role key is server-only

## Background Jobs

### Database-Level Jobs (pg_cron)

#### Analytics Aggregation
- **Function:** `public.run_daily_analytics_aggregation()`
- **Schedule:** Daily at 1 AM UTC
- **Purpose:** Aggregate page views for previous day
- **Security:** ✅ SECURITY DEFINER function, service role only

#### Analytics Visitors Refresh
- **Function:** `public.refresh_analytics_visitors()`
- **Schedule:** Daily at 2 AM UTC
- **Purpose:** Refresh materialized view for visitor analytics
- **Security:** ✅ SECURITY DEFINER function, service role only

#### News Generation
- **Function:** `public.auto_generate_news()`
- **Schedule:** Daily at 12:00 UTC (6 AM Central)
- **Purpose:** Auto-generate news articles
- **Security:** ✅ SECURITY DEFINER function, service role only

### Vercel Cron Jobs

#### News Generation Cron
- **Endpoint:** `GET /api/news/cron`
- **Schedule:** `0 0 * * *` (Daily at midnight UTC)
- **Security:** Protected by CRON_SECRET env var + Vercel cron verification

### Express API Server (apps/api)

#### GraphQL Endpoint
- **Endpoint:** `POST /graphql` (port 4000)
- **Purpose:** GraphQL API (placeholder)
- **Security:** ⚠️ No authentication/rate limiting currently

#### Stripe Webhook
- **Endpoint:** `POST /webhooks/stripe` (port 4000)
- **Purpose:** Stripe webhook handler
- **Security:** ✅ Signature verification

#### Health Check
- **Endpoint:** `GET /health`
- **Purpose:** Health check
- **Security:** ✅ Public, no sensitive data

## Security Issues Identified

### Critical
1. **API Keys Exposed to Client**
   - `NEXT_PUBLIC_OPENAI_API_KEY` - Should be server-only
   - `NEXT_PUBLIC_RAPIDAPI_KEY` - Should be server-only
   - **Impact:** Keys can be extracted from client-side code
   - **Fix:** Move to server-only env vars, proxy through API routes

### High Priority
2. **No Centralized Rate Limiting**
   - Only `/api/news/latest` has rate limiting
   - All other routes unprotected
   - **Fix:** Implement middleware-based rate limiting

3. **No Input Validation Library**
   - Manual validation only
   - Inconsistent validation patterns
   - **Fix:** Install Zod, create validation utilities

4. **No Request Size Limits**
   - Vulnerable to DoS via large payloads
   - **Fix:** Add request size limits middleware

### Medium Priority
5. **GraphQL Endpoint Unprotected**
   - No authentication or rate limiting
   - **Fix:** Add auth and rate limiting

6. **Inconsistent Error Handling**
   - Some routes expose internal errors
   - **Fix:** Standardize error responses

## Security Baseline Requirements

### Rate Limiting
- Public routes: 100 requests/minute per IP
- Authenticated routes: 200 requests/minute per user
- Admin routes: 500 requests/minute per admin
- Webhook routes: No rate limiting (signature verified)

### Input Validation
- All POST/PUT requests must validate input with Zod schemas
- Sanitize all string inputs
- Validate types, lengths, formats
- Reject invalid data with 400 errors

### API Key Security
- Server-only keys must not use `NEXT_PUBLIC_` prefix
- Keys stored in environment variables only
- Never log keys or key prefixes
- Rotate keys regularly

### Request Size Limits
- JSON body: 1MB max
- Form data: 10MB max
- File uploads: 50MB max (configurable per route)

### Access Control
- All routes verify authentication when required
- Admin routes verify admin role
- Owner verification for resource operations
- RLS policies as defense in depth

