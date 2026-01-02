# Systems Quick Reference

Quick lookup for all systems in Love of Minnesota.

## Systems List

1. **NEWS** - News articles, cron generation, date-based queries
2. **CALENDAR** - Calendar events and news calendar
3. **ADMIN** - Atlas types, cities, counties, contracts, payroll, FAQs management
4. **MAPS** - User maps, pins, areas, sharing, statistics
5. **GOV** - Government directory, checkbook (budget/contracts/payments/payroll), community edits
6. **ATLAS** - Atlas entities (cities, counties, schools, parks, etc.)
7. **FEED** - Posts feed, post creation, media uploads
8. **PROFILES** - User profiles, profile management
9. **ANALYTICS** - Page views, pin views, statistics, visitor tracking
10. **ACCOUNT** - Account management, authentication, onboarding
11. **BILLING** - Stripe integration, checkout, subscriptions
12. **CONTACT** - Contact form
13. **FAQS** - Frequently asked questions
14. **SEARCH** - Search functionality, location autocomplete
15. **MENTIONS** - Map mentions
16. **CIVIC** - Civic events, community editing
17. **INTELLIGENCE** - AI chat
18. **SKIP-TRACE** - Skip tracing service
19. **POINTS-OF-INTEREST** - POI management
20. **HOMEPAGE** - Main landing page

## File Locations

### Pages
- `src/app/` - All page routes
- `src/app/api/` - All API routes

### Features
- `src/features/` - Feature modules (one per system)

### Components
- `src/components/` - Shared components

### Services
- `src/lib/` - Shared utilities and services

## Review Order

1. **Core Infrastructure**: ACCOUNT, AUTH, ANALYTICS
2. **Content Systems**: NEWS, CALENDAR, FEED
3. **Location Systems**: MAPS, ATLAS, MENTIONS, POINTS-OF-INTEREST
4. **Government Systems**: GOV, CIVIC
5. **Admin Systems**: ADMIN
6. **Supporting Systems**: CONTACT, FAQS, SEARCH, INTELLIGENCE, SKIP-TRACE
7. **Business Systems**: BILLING
8. **Presentation**: HOMEPAGE, PROFILES

## Critical Systems (Review First)

These systems are most critical for production:

1. **ACCOUNT** - Required for all authenticated features
2. **AUTH** - Required for all authenticated features
3. **MAPS** - Core feature
4. **GOV** - Core feature
5. **HOMEPAGE** - Entry point
6. **ANALYTICS** - Used by all systems

## Quick Commands

```bash
# Type check
npm run type-check

# Lint
npm run lint

# Build
npm run build

# Generate Supabase types
npm run types:generate
```

