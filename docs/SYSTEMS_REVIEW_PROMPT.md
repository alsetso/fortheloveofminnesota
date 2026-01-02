# Systems Review & Fix Prompt

Complete inventory of all systems in Love of Minnesota with review checklist for error-free builds.

---

## Systems Overview

### 1. **NEWS** 📰
**Purpose**: News articles, date-based news, cron generation, latest news feed

**Pages**:
- `/news/[id]` - Individual news article page
- `/calendar/news` - Calendar news view

**API Routes**:
- `GET /api/news` - List all news
- `GET /api/news/[id]` - Get single article
- `GET /api/news/latest` - Get latest news
- `GET /api/news/by-date` - Get news by date
- `GET /api/news/dates-with-news` - Get dates with news
- `GET /api/news/generate` - Generate news (cron)
- `GET /api/news/cron` - Cron job endpoint

**Feature Files**:
- `src/features/news/` - News services, components, utils
- `src/app/news/[id]/page.tsx` - News article page

**Review Checklist**:
- [ ] All API routes return proper error responses
- [ ] TypeScript types are complete and correct
- [ ] News generation cron job handles errors gracefully
- [ ] Date filtering works correctly
- [ ] No console errors or warnings
- [ ] SEO metadata is present
- [ ] Database queries are optimized
- [ ] RLS policies are correct

---

### 2. **CALENDAR** 📅
**Purpose**: Calendar events and news calendar integration

**Pages**:
- `/calendar/events` - Events calendar page
- `/calendar/news` - News calendar view

**API Routes**:
- (Uses news API for date-based queries)

**Feature Files**:
- `src/features/calendar/` - Calendar components
- `src/features/events/` - Events services and components
- `src/app/calendar/events/page.tsx` - Events page

**Review Checklist**:
- [ ] Calendar displays events correctly
- [ ] Date navigation works
- [ ] Event creation/editing works (if applicable)
- [ ] Integration with news system works
- [ ] No date/timezone issues
- [ ] Mobile responsive

---

### 3. **ADMIN** 🔧
**Purpose**: Administrative interface for managing atlas types, cities, counties, contracts, payroll, FAQs

**Pages**:
- `/admin/atlas-types` - Atlas types management

**API Routes**:
- `GET/POST /api/admin/atlas-types` - List/create atlas types
- `GET/PUT/DELETE /api/admin/atlas-types/[id]` - Manage atlas type
- `POST /api/admin/atlas-types/upload-icon` - Upload icon
- `GET/PUT/DELETE /api/admin/atlas/[table]/[id]` - Manage atlas entity
- `GET/POST /api/admin/atlas/[table]` - List/create atlas entities
- `GET/PUT/DELETE /api/admin/cities/[id]` - Manage city
- `GET/PUT/DELETE /api/admin/counties/[id]` - Manage county
- `POST /api/admin/contracts/import` - Import contracts
- `POST /api/admin/payroll/import` - Import payroll
- `GET/PUT/DELETE /api/admin/faqs/[id]` - Manage FAQ

**Feature Files**:
- `src/features/admin/` - Admin components and services
- `src/app/admin/atlas-types/page.tsx` - Atlas types admin page

**Review Checklist**:
- [ ] All admin routes require proper authentication
- [ ] Permission checks are in place
- [ ] File uploads work correctly
- [ ] Import scripts handle errors
- [ ] Data validation on all inputs
- [ ] Audit logging for admin actions
- [ ] No sensitive data exposed in responses

---

### 4. **MAPS** 🗺️
**Purpose**: User-created maps, map pins, map areas, map sharing, map statistics

**Pages**:
- `/maps` - Maps listing page
- `/maps/new` - Create new map
- `/map/[id]` - Individual map page
- `/map/atlas/[table]` - Atlas map view
- `/map/fraud` - Fraud map
- `/map/realestate` - Real estate map
- `/map/skip-tracing` - Skip tracing map
- `/map/mention` - Mention map

**API Routes**:
- `GET/POST /api/maps` - List/create maps
- `GET/PUT/DELETE /api/maps/[id]` - Manage map
- `GET /api/maps/[id]/pins` - Get map pins
- `POST /api/maps/[id]/pins` - Create pin
- `GET/PUT/DELETE /api/maps/[id]/pins/[pinId]` - Manage pin
- `GET /api/maps/[id]/areas` - Get map areas
- `POST /api/maps/[id]/areas` - Create area
- `GET/PUT/DELETE /api/maps/[id]/areas/[areaId]` - Manage area
- `GET /api/maps/[id]/stats` - Map statistics
- `GET /api/maps/[id]/viewers` - Map viewers
- `GET /api/maps/stats` - All maps stats
- `GET /api/maps/[id]/shares/[account_id]` - Map shares

**Feature Files**:
- `src/features/maps/` - Maps components
- `src/features/map/` - Map components and services
- `src/features/map-pins/` - Pin services
- `src/features/map-metadata/` - Map metadata
- `src/features/map-selection/` - Map selection hooks
- `src/features/user-maps/` - User maps services
- `src/app/maps/` - Maps pages
- `src/app/map/[id]/` - Map detail pages

**Review Checklist**:
- [ ] Map creation works correctly
- [ ] Pin creation/editing/deletion works
- [ ] Area drawing works
- [ ] Map sharing permissions are correct
- [ ] Map statistics are accurate
- [ ] Mapbox integration is stable
- [ ] No memory leaks in map components
- [ ] RLS policies for maps/pins/areas
- [ ] Map viewer tracking works

---

### 5. **GOV** 🏛️
**Purpose**: Government directory (orgs, people, roles), checkbook (budget, contracts, payments, payroll), community edits

**Pages**:
- `/gov` - Main government directory
- `/gov/org/[slug]` - Organization detail
- `/gov/person/[slug]` - Person detail
- `/gov/checkbook` - Checkbook main page
- `/gov/checkbook/budget` - Budget table
- `/gov/checkbook/contracts` - Contracts table
- `/gov/checkbook/payments` - Payments table
- `/gov/checkbook/payroll` - Payroll table
- `/gov/community-edits` - Community edits feed
- `/gov/executive` - Executive branch
- `/gov/legislative` - Legislative branch
- `/gov/judicial` - Judicial branch

**API Routes**:
- (Mostly server-side rendered, uses Supabase directly)

**Feature Files**:
- `src/features/civic/` - Civic editing components and services
- `src/app/gov/` - All gov pages
- `src/app/gov/GovTablesClient.tsx` - Main tables component
- `src/app/gov/checkbook/` - Checkbook components

**Review Checklist**:
- [ ] All three branches display correctly
- [ ] Organization pages work
- [ ] Person pages work
- [ ] Community editing works
- [ ] Edit history is logged correctly
- [ ] Checkbook tables load correctly
- [ ] Budget/contracts/payments/payroll data displays
- [ ] Fiscal year filtering works
- [ ] RLS policies for civic edits
- [ ] Audit logging works

---

### 6. **ATLAS** 🌍
**Purpose**: Atlas entities (cities, counties, schools, parks, etc.), atlas types, location exploration

**Pages**:
- `/explore/atlas/[table_name]/[id]` - Atlas entity detail
- `/explore/cities` - Cities list
- `/explore/city/[slug]` - City detail
- `/explore/counties` - Counties list
- `/explore/county/[slug]` - County detail
- `/map/atlas/[table]` - Atlas map view

**API Routes**:
- `GET /api/atlas/types` - Get atlas types
- `GET /api/atlas/[table]/entities` - Get entities for table
- `GET /api/atlas/[table]/[id]` - Get single entity

**Feature Files**:
- `src/features/atlas/` - Atlas components and services
- `src/app/explore/` - Explore pages
- `src/app/map/atlas/` - Atlas map pages

**Review Checklist**:
- [ ] All atlas types load correctly
- [ ] Entity detail pages work
- [ ] City/county pages work
- [ ] Atlas maps display correctly
- [ ] Search functionality works
- [ ] Filters work (year, etc.)
- [ ] RLS policies are correct
- [ ] Icon uploads work (admin)

---

### 7. **FEED** 📝
**Purpose**: Posts feed, post creation, media uploads, post maps

**Pages**:
- `/feed` - Feed page (if exists)
- (Main feed is on homepage)

**API Routes**:
- `GET /api/article/[id]/comments` - Article comments

**Feature Files**:
- `src/features/feed/` - Feed components, hooks, services
- `src/features/posts/` - Post components
- `src/components/feed/` - Feed components (legacy)

**Review Checklist**:
- [ ] Post creation works
- [ ] Media uploads work
- [ ] Post maps work
- [ ] Feed pagination works
- [ ] Post editing works
- [ ] Comments work
- [ ] RLS policies for posts
- [ ] Media storage is correct

---

### 8. **PROFILES** 👤
**Purpose**: User profiles, profile pages, profile management

**Pages**:
- `/profile/[slug]` - User profile page

**API Routes**:
- `GET/POST /api/accounts` - Account management
- `GET /api/accounts/username/check` - Check username availability

**Feature Files**:
- `src/features/profiles/` - Profile components, hooks, contexts
- `src/features/account/` - Account components (modals, settings, onboarding)
- `src/app/profile/[slug]/page.tsx` - Profile page

**Review Checklist**:
- [ ] Profile pages load correctly
- [ ] Profile editing works
- [ ] Username validation works
- [ ] Avatar uploads work
- [ ] Profile stats display correctly
- [ ] RLS policies for profiles
- [ ] Onboarding flow works
- [ ] Welcome modal works

---

### 9. **ANALYTICS** 📊
**Purpose**: Page views, pin views, feed stats, homepage stats, map stats, visitor tracking

**API Routes**:
- `POST /api/analytics/view` - Record page view
- `POST /api/analytics/pin-view` - Record pin view
- `GET /api/analytics/feed-stats` - Feed statistics
- `GET /api/analytics/homepage-stats` - Homepage statistics
- `GET /api/analytics/map-view` - Map view tracking
- `GET /api/analytics/special-map-view` - Special map view
- `GET /api/analytics/special-map-stats` - Special map stats
- `GET /api/analytics/atlas-map-stats` - Atlas map stats
- `GET /api/analytics/pin-stats` - Pin statistics
- `GET /api/analytics/my-pins` - User's pin stats
- `GET /api/analytics/my-entities` - User's entity stats
- `GET /api/analytics/visitors` - Visitor tracking

**Feature Files**:
- `src/components/analytics/` - Analytics components
- `src/hooks/` - Analytics hooks (usePageView, etc.)

**Review Checklist**:
- [ ] All tracking endpoints work
- [ ] Page views are recorded correctly
- [ ] Pin views are recorded correctly
- [ ] Statistics are accurate
- [ ] No duplicate tracking
- [ ] Performance impact is minimal
- [ ] Database queries are optimized

---

### 10. **ACCOUNT** 🔐
**Purpose**: Account management, authentication, onboarding, settings, welcome modal

**Pages**:
- (Modal-based, no dedicated pages)

**API Routes**:
- `GET/POST /api/accounts` - Account CRUD
- `GET /api/accounts/username/check` - Username check

**Feature Files**:
- `src/features/account/` - Account components (modals, settings, onboarding)
- `src/features/auth/` - Auth context and services
- `src/features/session/` - Session management

**Review Checklist**:
- [ ] Account creation works
- [ ] Login/logout works
- [ ] Onboarding flow works
- [ ] Settings page works
- [ ] Welcome modal works
- [ ] Guest accounts work
- [ ] OTP verification works (if applicable)
- [ ] Session management is secure

---

### 11. **BILLING** 💳
**Purpose**: Stripe integration, checkout, subscription management

**API Routes**:
- `POST /api/billing/checkout` - Create checkout session
- `GET /api/billing/data` - Get billing data
- `POST /api/stripe/webhook` - Stripe webhook handler
- `POST /api/test-payments/create-intent` - Test payment intent

**Feature Files**:
- `src/features/account/components/UpgradeButton.tsx` - Upgrade button
- `apps/api/` - Express API server for webhooks

**Review Checklist**:
- [ ] Checkout flow works
- [ ] Webhook handling works
- [ ] Subscription sync works
- [ ] Payment intents work
- [ ] Error handling is robust
- [ ] No sensitive data exposed
- [ ] Test mode works correctly

---

### 12. **CONTACT** 📧
**Purpose**: Contact form submission

**Pages**:
- `/contact` - Contact page

**API Routes**:
- `POST /api/contact` - Submit contact form

**Feature Files**:
- `src/features/contact/` - Contact components
- `src/app/contact/page.tsx` - Contact page

**Review Checklist**:
- [ ] Contact form submits correctly
- [ ] Email notifications work
- [ ] Form validation works
- [ ] Spam protection (if applicable)
- [ ] Success/error messages display

---

### 13. **FAQS** ❓
**Purpose**: Frequently asked questions

**Pages**:
- `/faqs` - FAQs page (if exists)

**API Routes**:
- `GET/PUT/DELETE /api/admin/faqs/[id]` - Manage FAQ

**Feature Files**:
- `src/features/faqs/` - FAQ components

**Review Checklist**:
- [ ] FAQs display correctly
- [ ] Search works (if applicable)
- [ ] Admin editing works
- [ ] Categories work (if applicable)

---

### 14. **SEARCH** 🔍
**Purpose**: Search functionality

**Pages**:
- (Integrated in various pages)

**API Routes**:
- `GET /api/categories/search` - Category search
- `GET /api/geocode/autocomplete` - Location autocomplete
- `GET /api/location-searches` - Location searches

**Feature Files**:
- `src/features/search/` - Search components
- `src/features/location-searches/` - Location search services

**Review Checklist**:
- [ ] Search works correctly
- [ ] Autocomplete works
- [ ] Location search works
- [ ] Results are relevant
- [ ] Performance is acceptable

---

### 15. **MENTIONS** ❤️
**Purpose**: Map mentions, mention tracking

**Pages**:
- `/map/mention` - Mention map

**API Routes**:
- (Uses maps API)

**Feature Files**:
- `src/features/mentions/` - Mention services

**Review Checklist**:
- [ ] Mentions display on map
- [ ] Mention creation works
- [ ] Mention editing works
- [ ] RLS policies are correct

---

### 16. **CIVIC** 🏛️
**Purpose**: Civic events, community editing, edit history

**Pages**:
- `/gov/community-edits` - Community edits feed

**API Routes**:
- (Server-side, uses Supabase)

**Feature Files**:
- `src/features/civic/` - Civic components, services, utils
- `src/features/events/` - Events components

**Review Checklist**:
- [ ] Civic events display correctly
- [ ] Community editing works
- [ ] Edit history is logged
- [ ] Permissions are correct
- [ ] Audit trail is complete

---

### 17. **INTELLIGENCE** 🤖
**Purpose**: AI chat/intelligence features

**API Routes**:
- `POST /api/intelligence/chat` - AI chat endpoint

**Feature Files**:
- (May be in components)

**Review Checklist**:
- [ ] Chat endpoint works
- [ ] Responses are appropriate
- [ ] Rate limiting is in place
- [ ] Error handling works
- [ ] No sensitive data leaked

---

### 18. **SKIP-TRACE** 🔎
**Purpose**: Skip tracing service integration

**Pages**:
- `/map/skip-tracing` - Skip tracing map

**API Routes**:
- `POST /api/skip-trace/store` - Store skip trace data

**Feature Files**:
- `src/features/api/services/skipTraceService.ts` - Skip trace service
- `src/app/map/skip-tracing/` - Skip tracing pages

**Review Checklist**:
- [ ] Skip trace integration works
- [ ] Data storage is secure
- [ ] Map display works
- [ ] API integration is stable

---

### 19. **POINTS-OF-INTEREST** 📍
**Purpose**: POI management and display

**API Routes**:
- `GET /api/points-of-interest` - Get POIs

**Feature Files**:
- (May be in map components)

**Review Checklist**:
- [ ] POIs display correctly
- [ ] POI creation works (if applicable)
- [ ] Admin POI management works
- [ ] RLS policies are correct

---

### 20. **HOMEPAGE** 🏠
**Purpose**: Main landing page with maps, news, calendar, profile column

**Pages**:
- `/` - Homepage

**Feature Files**:
- `src/features/homepage/` - Homepage components and hooks
- `src/app/page.tsx` - Homepage server component

**Review Checklist**:
- [ ] Homepage loads correctly
- [ ] All sections display
- [ ] Maps section works
- [ ] News/calendar column works
- [ ] Profile column works
- [ ] Atlas types display
- [ ] Government section links work
- [ ] SEO metadata is correct
- [ ] Performance is acceptable

---

## Universal Review Checklist

For each system, verify:

### TypeScript & Build
- [ ] No TypeScript errors (`npm run type-check`)
- [ ] No ESLint errors (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] All imports are correct
- [ ] All types are defined
- [ ] No `any` types (unless necessary)

### Database & RLS
- [ ] RLS policies are correct
- [ ] Database queries are optimized
- [ ] No N+1 queries
- [ ] Foreign key constraints are correct
- [ ] Indexes are present where needed
- [ ] Migration files are correct

### API Routes
- [ ] All routes return proper status codes
- [ ] Error handling is consistent
- [ ] Request validation is present
- [ ] Response types are correct
- [ ] Authentication/authorization is correct
- [ ] Rate limiting (if applicable)

### Components
- [ ] All components are properly typed
- [ ] Props are validated
- [ ] No console errors/warnings
- [ ] Loading states are handled
- [ ] Error states are handled
- [ ] Mobile responsive
- [ ] Accessibility (a11y) basics

### Performance
- [ ] No memory leaks
- [ ] Images are optimized
- [ ] Code splitting is appropriate
- [ ] Database queries are efficient
- [ ] No unnecessary re-renders

### Security
- [ ] No sensitive data in client code
- [ ] Authentication is required where needed
- [ ] Authorization checks are correct
- [ ] Input sanitization is present
- [ ] SQL injection prevention
- [ ] XSS prevention

---

## Review Prompt Template

Use this prompt for each system:

```
Review and fix all files for the [SYSTEM_NAME] system in Love of Minnesota.

System includes:
- Pages: [list pages]
- API Routes: [list routes]
- Feature Files: [list feature directories]

Tasks:
1. Run TypeScript type check and fix all errors
2. Run ESLint and fix all errors
3. Verify all API routes return proper responses
4. Check RLS policies are correct
5. Verify database queries are optimized
6. Fix any console errors/warnings
7. Ensure all components are properly typed
8. Verify error handling is consistent
9. Check authentication/authorization
10. Verify mobile responsiveness
11. Test build succeeds without errors
12. Document any breaking changes

Output:
- List all files reviewed
- List all errors found and fixed
- List any warnings or improvements needed
- Confirm system is production-ready
```

---

## Quick Review Commands

```bash
# Type check
npm run type-check

# Lint check
npm run lint

# Build check
npm run build

# Find unused files
npm run find-unused

# Supabase types
npm run types:generate
```

---

## System Dependencies

Some systems depend on others:
- **HOMEPAGE** depends on: NEWS, CALENDAR, MAPS, ATLAS, GOV
- **MAPS** depends on: ATLAS, ANALYTICS
- **GOV** depends on: CIVIC, ANALYTICS
- **PROFILES** depends on: ACCOUNT, AUTH
- **FEED** depends on: ACCOUNT, MAPS
- **ANALYTICS** is used by: All systems

Review dependencies in order when doing full system review.

