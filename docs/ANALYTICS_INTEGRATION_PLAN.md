# Analytics Integration Plan for PageWrapper

## Current State Analysis

### Database Schema
**Current System:** `public.url_visits` table (from migration 421)
- **Table:** `public.url_visits`
- **Function:** `public.record_url_visit(p_url, p_account_id, p_user_agent, p_referrer_url, p_session_id)`
- **Purpose:** Unified URL-based view tracking for all pages, maps, mentions, profiles

**Legacy System:** `analytics.page_views` and `analytics.pin_views` (from migration 269)
- **Status:** May still exist if migration 421 didn't fully execute
- **Function:** `analytics.record_page_view()` and `analytics.record_pin_view()`
- **Note:** Migration 421 attempted to consolidate everything into `url_visits`

### Current Tracking Implementation
1. **`usePageView` Hook** (`src/hooks/usePageView.ts`)
   - Tracks page views via `/api/analytics/view`
   - Uses `record_url_visit()` function
   - Automatically captures: URL, referrer, user agent, session ID

2. **`PageViewTracker` Component** (`src/components/analytics/PageViewTracker.tsx`)
   - Wrapper around `usePageView` hook
   - Used manually on some pages

3. **API Route** (`src/app/api/analytics/view/route.ts`)
   - Calls `record_url_visit()` function
   - Handles authentication (optional)
   - Rate limited: 100 requests/minute

### What Gets Tracked
- **URL:** Full pathname (e.g., `/feed`, `/map/123`, `/profile/username`)
- **Account ID:** Viewer's account (NULL for anonymous)
- **User Agent:** Browser information
- **Referrer URL:** Where they came from
- **Session ID:** Device/browser session (for anonymous tracking)
- **Timestamp:** When the view occurred

### User Experience & Privacy
- **Public Data:** View counts are public (aggregated)
- **PRO Feature:** Visitor identities (WHO viewed) require PRO subscription
- **Anonymous Tracking:** Uses `session_id` (device ID) for anonymous visitors
- **Self-Visits:** Not counted for profile views (owner viewing own profile)

---

## Integration Plan: Add Analytics to PageWrapper

### Objective
Automatically track page views for ALL pages using `PageWrapper` without requiring manual `usePageView` calls.

### Implementation

#### Step 1: Add `usePageView` to PageWrapper
**File:** `src/components/layout/PageWrapper.tsx`

**Changes:**
1. Import `usePageView` hook
2. Call `usePageView()` automatically when component mounts
3. Use current `pathname` from `usePathname()` hook
4. Optionally allow disabling tracking via prop

**Code:**
```tsx
import { usePageView } from '@/hooks/usePageView';

export default function PageWrapper({ 
  children, 
  // ... existing props
  trackPageView = true, // New prop to enable/disable tracking
}: PageWrapperProps) {
  const pathname = usePathname();
  
  // Automatically track page views
  usePageView({ 
    page_url: pathname || '/', 
    enabled: trackPageView 
  });
  
  // ... rest of component
}
```

#### Step 2: Update PageWrapper Props Interface
```tsx
interface PageWrapperProps {
  // ... existing props
  trackPageView?: boolean; // Optional - defaults to true
}
```

#### Step 3: Remove Manual Tracking from Pages
**Pages to Update:**
- Remove `PageViewTracker` components from pages that use `PageWrapper`
- Remove manual `usePageView` calls from pages that use `PageWrapper`
- Keep tracking for pages that DON'T use `PageWrapper` (e.g., `/post/[id]`, `/mention/[id]`)

---

## What You Need to Know

### Analytics Schema Structure

#### `public.url_visits` Table
```sql
CREATE TABLE public.url_visits (
  id UUID PRIMARY KEY,
  url TEXT NOT NULL,                    -- Full URL path
  account_id UUID REFERENCES accounts, -- NULL for anonymous
  viewed_at TIMESTAMP WITH TIME ZONE,
  user_agent TEXT,
  referrer_url TEXT,
  session_id UUID                       -- Device ID for anonymous
);
```

#### Key Functions
1. **`record_url_visit(p_url, p_account_id, p_user_agent, p_referrer_url, p_session_id)`**
   - Records a URL visit
   - Automatically increments `view_count` for profiles and mentions
   - Returns visit ID

2. **`get_url_stats(p_url, p_hours)`**
   - Returns: `total_views`, `unique_viewers`, `accounts_viewed`
   - `p_hours`: Filter to last N hours (NULL = all time)

3. **`get_profile_viewers(p_username, p_limit, p_offset)`**
   - PRO feature only
   - Returns list of accounts that viewed a profile

4. **`get_mention_viewers(p_mention_id, p_limit, p_offset)`**
   - PRO feature only
   - Returns list of accounts that viewed a mention

### User Experience

#### Free Users
- ✅ Can see view counts (aggregated)
- ❌ Cannot see WHO viewed (visitor identities)
- ✅ All views are tracked (including anonymous)

#### PRO Users
- ✅ Can see view counts
- ✅ Can see WHO viewed their content (visitor identities)
- ✅ Can see visitor details (username, name, image)
- ✅ Can see view timestamps

#### Anonymous Visitors
- Tracked via `session_id` (device ID stored in localStorage)
- Counted in `unique_viewers` but not `accounts_viewed`
- No personal information collected

### Privacy & Security

#### What's Public
- View counts (aggregated numbers)
- Total views, unique viewers (anonymized)

#### What's PRO-Only
- Visitor identities (WHO viewed)
- Visitor details (names, usernames, images)
- View timestamps per visitor

#### RLS Policies
- **Anyone can INSERT** (tracking)
- **Users can SELECT own views** (where they are the viewer)
- **PRO users can SELECT profile/mention visitors** (where they own the content)
- **Admins can SELECT all views**

### Performance Considerations

1. **Rate Limiting:** 100 requests/minute (public endpoint)
2. **Async Tracking:** Uses `requestIdleCallback` or `setTimeout` to avoid blocking
3. **Keepalive:** Requests use `keepalive: true` to complete even if page unloads
4. **Indexes:** Optimized indexes on `url`, `account_id`, `viewed_at`, `session_id`

### Data Retention
- No automatic deletion (all views retained)
- Can be cleaned up manually if needed
- Consider adding retention policy in future

---

## Migration Checklist

### Before Integration
- [ ] Verify `public.url_visits` table exists
- [ ] Verify `record_url_visit()` function exists
- [ ] Test current tracking on a few pages
- [ ] Verify API route `/api/analytics/view` works

### During Integration
- [ ] Add `usePageView` to `PageWrapper`
- [ ] Add `trackPageView` prop (optional, defaults to true)
- [ ] Test tracking on pages with `PageWrapper`
- [ ] Verify views are recorded in `url_visits` table

### After Integration
- [ ] Remove manual `PageViewTracker` from pages using `PageWrapper`
- [ ] Remove manual `usePageView` calls from pages using `PageWrapper`
- [ ] Keep tracking for pages WITHOUT `PageWrapper` (e.g., `/post/[id]`)
- [ ] Verify analytics page shows correct data
- [ ] Test PRO feature (visitor identities)

---

## Testing

### Manual Testing
1. Visit a page with `PageWrapper`
2. Check `url_visits` table for new record
3. Verify `url` matches current pathname
4. Verify `account_id` is set (if logged in) or NULL (if anonymous)
5. Verify `session_id` is set (for anonymous)

### Automated Testing
- Test `usePageView` hook in isolation
- Test `PageWrapper` with tracking enabled/disabled
- Test API route with various inputs
- Test RLS policies (PRO users can see visitors)

---

## Future Enhancements

1. **Time on Page:** Track how long users spend on each page
2. **Scroll Depth:** Track how far users scroll
3. **Exit Intent:** Track when users are about to leave
4. **Aggregated Views:** Materialized views for faster queries
5. **Data Retention:** Automatic cleanup of old views
6. **Export:** Allow users to export their analytics data
