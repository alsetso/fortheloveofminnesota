# Page Views Tracking Summary

## Current Tracking Status

Based on the new simplified `page_views` table system (migration 223), page views are tracked using `page_url` (the actual URL path) rather than entity types.

### How It Works

The new `usePageView` hook automatically tracks the current page URL from `window.location.pathname` if no `page_url` is explicitly provided. This means **any page that calls the hook will be automatically tracked**.

## ⚠️ Current Status: NO PAGES ARE BEING TRACKED YET

The hooks are imported but **not actually called** in the components. The following components import `usePageView` but don't call it:
- `FeedMapClient` - imports but doesn't call
- `FeedListClient` - imports but doesn't call

## All Pages in the Platform

### Core Public Pages
1. **Homepage** (`/`)
   - Component: `FeedMapClient`
   - Status: ❌ Not tracked (hook imported but not called)
   - Should track: `/`

2. **Feed Page** (`/feed`)
   - Component: `FeedListClient`
   - Status: ❌ Not tracked (hook imported but not called)
   - Should track: `/feed`

3. **Explore Landing** (`/explore`)
   - Component: `ExplorePageClient`
   - Status: ❌ Not tracked
   - Should track: `/explore`

4. **Cities List** (`/explore/cities`)
   - Component: `CitiesListClient`
   - Status: ❌ Not tracked
   - Should track: `/explore/cities`

5. **Counties List** (`/explore/counties`)
   - Component: `CountiesListClient`
   - Status: ❌ Not tracked
   - Should track: `/explore/counties`

6. **City Pages** (`/explore/city/[slug]`)
   - Component: `CityPageClient`
   - Status: ❌ Not tracked
   - Should track: `/explore/city/{slug}` (e.g., `/explore/city/minneapolis`)

7. **County Pages** (`/explore/county/[slug]`)
   - Component: `CountyPageClient`
   - Status: ❌ Not tracked
   - Should track: `/explore/county/{slug}` (e.g., `/explore/county/hennepin`)

8. **Contact Page** (`/contact`)
   - Component: `ContactPageClient`
   - Status: ❌ Not tracked
   - Should track: `/contact`

9. **FAQs Page** (`/faqs`)
   - Status: ❌ Not tracked
   - Should track: `/faqs`

### Account Pages
10. **Account Settings** (`/account/settings`)
    - Status: ❌ Not tracked
    - Should track: `/account/settings`

11. **Account Billing** (`/account/billing`)
    - Status: ❌ Not tracked
    - Should track: `/account/billing`

12. **Account Analytics** (`/account/analytics`)
    - Status: ❌ Not tracked
    - Should track: `/account/analytics`

13. **Account Notifications** (`/account/notifications`)
    - Status: ❌ Not tracked
    - Should track: `/account/notifications`

14. **Account Onboarding** (`/account/onboarding`)
    - Status: ❌ Not tracked
    - Should track: `/account/onboarding`

15. **Change Plan** (`/account/change-plan`)
    - Status: ❌ Not tracked
    - Should track: `/account/change-plan`

### Admin Pages
16. **Admin Dashboard** (`/admin`)
    - Component: `AdminClient`
    - Status: ❌ Not tracked (but has admin access to view all views)
    - Should track: `/admin`

### Other Pages
17. **Login** (`/login`)
    - Status: ❌ Not tracked
    - Should track: `/login`

18. **Legal Pages** (`/legal/*`)
    - Status: ❌ Not tracked
    - Should track: `/legal`, `/legal/privacy-policy`, `/legal/terms-of-service`, etc.

### 📋 Pages That Should Be Tracked (But May Not Be Yet)

Based on the platform structure, these pages exist and should be tracked:

#### Core Pages
- `/` - Homepage (FeedMapClient)
- `/feed` - Feed page
- `/explore` - Explore landing page
- `/explore/cities` - Cities list
- `/explore/counties` - Counties list
- `/explore/city/[slug]` - Individual city pages (e.g., `/explore/city/minneapolis`)
- `/explore/county/[slug]` - Individual county pages (e.g., `/explore/county/hennepin`)
- `/contact` - Contact page
- `/faqs` - FAQs page
- `/admin` - Admin dashboard (admin only)

#### Account Pages
- `/account/settings` - Account settings
- `/account/billing` - Billing page
- `/account/analytics` - Analytics page
- `/account/notifications` - Notifications page
- `/account/onboarding` - Onboarding page
- `/account/change-plan` - Change plan page

#### Other Pages
- `/login` - Login page
- `/legal` - Legal pages
- `/legal/privacy-policy` - Privacy policy
- `/legal/terms-of-service` - Terms of service
- `/legal/community-guidelines` - Community guidelines
- `/legal/user-agreement` - User agreement

## Pin Views Tracking

Pin views are tracked separately in the `pin_views` table when:
- A user opens a pin popup on the map
- A pin is viewed in any context

**Status**: Requires implementation of `usePinView` hook in pin-related components.

## Implementation Required

### 1. Add usePageView() Calls to All Page Components

**CRITICAL**: Components currently import `usePageView` but don't call it. Add the hook call:

```typescript
import { usePageView } from '@/hooks/usePageView';

export default function MyPage() {
  usePageView(); // ← ADD THIS - Automatically tracks current URL
  // ... rest of component
}
```

### Priority Pages to Update:

1. **FeedMapClient** (`src/components/feed/FeedMapClient.tsx`)
   - Add: `usePageView();` at the top of the component
   - Tracks: `/`

2. **FeedListClient** (`src/components/feed/FeedListClient.tsx`)
   - Add: `usePageView();` at the top of the component
   - Tracks: `/feed`

3. **ExplorePageClient** (`src/app/explore/ExplorePageClient.tsx`)
   - Add: `usePageView();`
   - Tracks: `/explore`

4. **CitiesListClient** (`src/app/explore/cities/CitiesListClient.tsx`)
   - Add: `usePageView();`
   - Tracks: `/explore/cities`

5. **CountiesListClient** (`src/app/explore/counties/CountiesListClient.tsx`)
   - Add: `usePageView();`
   - Tracks: `/explore/counties`

6. **CityPageClient** (`src/app/explore/city/[slug]/CityPageClient.tsx`)
   - Add: `usePageView();`
   - Tracks: `/explore/city/{slug}`

7. **CountyPageClient** (`src/app/explore/county/[slug]/CountyPageClient.tsx`)
   - Add: `usePageView();`
   - Tracks: `/explore/county/{slug}`

8. **ContactPageClient** (`src/app/contact/ContactPageClient.tsx`)
   - Add: `usePageView();`
   - Tracks: `/contact`

9. **AdminClient** (`src/app/admin/AdminClient.tsx`)
   - Add: `usePageView();`
   - Tracks: `/admin`

### 2. Add usePinView to Pin Components

When pins are displayed/opened:
```typescript
import { usePinView } from '@/hooks/usePinView';

// In pin popup/modal component
usePinView({ pin_id: pin.id });
```

### 3. Pages That Need Tracking Added

Priority pages to add tracking:
1. `/explore` - ExplorePageClient
2. `/explore/cities` - CitiesListClient  
3. `/explore/counties` - CountiesListClient
4. `/explore/city/[slug]` - CityPageClient
5. `/explore/county/[slug]` - CountyPageClient
6. `/contact` - ContactPageClient
7. `/account/*` - All account pages
8. `/admin` - Admin page (already has tracking via admin access)

## Current Data Structure

### page_views Table
- `page_url`: The actual URL path (e.g., `/explore/city/minneapolis`)
- `account_id`: Who viewed it (NULL for guests)
- `viewed_at`: When it was viewed
- `user_agent`: Browser info
- `referrer_url`: Where they came from
- `session_id`: Session tracking

### pin_views Table
- `pin_id`: Which pin was viewed
- `account_id`: Who viewed it (NULL for guests)
- `viewed_at`: When it was viewed
- `user_agent`: Browser info
- `referrer_url`: Where they came from
- `session_id`: Session tracking

## Query Examples

### Get stats for a specific page
```sql
SELECT * FROM get_page_stats('/explore/city/minneapolis', 24); -- Last 24 hours
```

### Get stats for feed page
```sql
SELECT * FROM get_page_stats('/feed', NULL); -- All time
```

### Get viewers of a page
```sql
SELECT * FROM get_page_viewers('/explore/city/minneapolis', 50, 0);
```

### Get pin stats
```sql
SELECT * FROM get_pin_stats('pin-uuid-here', 24); -- Last 24 hours
```

## Next Steps

1. ✅ Migration 223 & 224 completed - New tables and functions created
2. ✅ API routes created - `/api/analytics/view` and `/api/analytics/pin-view`
3. ✅ Hooks created - `usePageView` and `usePinView`
4. ⚠️ **TODO**: Add `usePageView()` calls to all page components
5. ⚠️ **TODO**: Add `usePinView()` calls when pins are opened/viewed
6. ✅ Admin dashboard created - Can view all page and pin views






