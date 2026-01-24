# Analytics Schema Overview

## Current System: `public.url_visits`

### Table Structure
```sql
CREATE TABLE public.url_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,                    -- Full URL path (e.g., '/feed', '/map/123', '/profile/username')
  account_id UUID REFERENCES accounts, -- NULL for anonymous visitors
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  user_agent TEXT,                      -- Browser information
  referrer_url TEXT,                    -- Where they came from
  session_id UUID                       -- Device ID for anonymous tracking
);
```

### Key Functions

#### 1. `record_url_visit(p_url, p_account_id, p_user_agent, p_referrer_url, p_session_id)`
**Purpose:** Records a URL visit and automatically updates view counts

**Behavior:**
- Inserts record into `url_visits` table
- If URL is a profile page (`/profile/{username}`), increments `accounts.view_count` (unless self-visit)
- If URL contains a mention/pin ID (`?pin=uuid`), increments `mentions.view_count`
- Returns the visit ID

**Usage:**
```sql
SELECT record_url_visit(
  '/feed',
  NULL,  -- account_id (NULL for anonymous)
  'Mozilla/5.0...',  -- user_agent
  'https://google.com',  -- referrer_url
  'uuid-here'  -- session_id
);
```

#### 2. `get_url_stats(p_url, p_hours)`
**Purpose:** Get aggregated statistics for a URL

**Returns:**
- `total_views`: Total number of views
- `unique_viewers`: Unique accounts + unique sessions (for anonymous)
- `accounts_viewed`: Number of authenticated accounts that viewed

**Usage:**
```sql
SELECT * FROM get_url_stats('/feed', 24);  -- Last 24 hours
SELECT * FROM get_url_stats('/feed', NULL); -- All time
```

#### 3. `get_profile_viewers(p_username, p_limit, p_offset)`
**Purpose:** Get list of accounts that viewed a profile (PRO feature only)

**Returns:**
- `account_id`, `account_username`, `account_first_name`, `account_last_name`, `account_image_url`
- `viewed_at`: Most recent view timestamp
- `view_count`: Total views by this account

**Usage:**
```sql
SELECT * FROM get_profile_viewers('username', 50, 0);
```

#### 4. `get_mention_viewers(p_mention_id, p_limit, p_offset)`
**Purpose:** Get list of accounts that viewed a mention (PRO feature only)

**Returns:** Same as `get_profile_viewers`

**Usage:**
```sql
SELECT * FROM get_mention_viewers('mention-uuid', 50, 0);
```

---

## What Gets Tracked

### Automatically Tracked (via PageWrapper)
- ✅ All pages using `PageWrapper` component
- ✅ URL pathname (e.g., `/feed`, `/maps`, `/gov/people`)
- ✅ Account ID (if logged in)
- ✅ User agent (browser info)
- ✅ Referrer URL (where they came from)
- ✅ Session ID (device ID for anonymous visitors)
- ✅ Timestamp

### Manually Tracked (pages without PageWrapper)
- `/post/[id]` - Post detail pages
- `/mention/[id]` - Mention detail pages
- Custom tracking for specific interactions

### Special Tracking
- **Map Views:** `/map/{id}` - Tracked via `/api/analytics/map-view`
- **Pin Views:** `/map?pin={id}` - Tracked via `/api/analytics/pin-view`
- **Profile Views:** `/profile/{username}` - Automatically increments `accounts.view_count`

---

## User Experience

### Free Users
- ✅ Can see view counts (aggregated numbers)
- ✅ Can see total views, unique viewers
- ❌ Cannot see WHO viewed (visitor identities)
- ✅ All views are tracked (including anonymous)

### PRO Users
- ✅ Can see view counts
- ✅ Can see WHO viewed their content (visitor identities)
- ✅ Can see visitor details (username, name, image)
- ✅ Can see view timestamps per visitor
- ✅ Can see view counts per visitor

### Anonymous Visitors
- Tracked via `session_id` (device ID stored in localStorage)
- Counted in `unique_viewers` but not `accounts_viewed`
- No personal information collected
- Session ID persists across page reloads (same device)

---

## Privacy & Security

### Public Data (Everyone Can See)
- View counts (aggregated numbers)
- Total views
- Unique viewers (anonymized count)

### PRO-Only Data (Content Owners Only)
- Visitor identities (WHO viewed)
- Visitor details (names, usernames, images)
- View timestamps per visitor
- View counts per visitor

### RLS Policies

#### INSERT (Anyone)
- ✅ Anyone can record URL visits (for tracking)
- ✅ Anonymous users can track views
- ✅ Authenticated users can track views

#### SELECT (Restricted)
- ✅ Users can view their own views (where they are the viewer)
- ✅ PRO users can view visitors to their own profile
- ✅ PRO users can view visitors to their own mentions
- ✅ PRO users can view visitors to their own maps
- ✅ Admins can view all URL visits

---

## Performance

### Indexes
- `idx_url_visits_url` - Fast URL lookups
- `idx_url_visits_account_id` - Fast account-based queries
- `idx_url_visits_viewed_at` - Fast time-based queries
- `idx_url_visits_url_viewed_at` - Fast URL + time queries
- `idx_url_visits_account_url` - Fast account + URL queries
- `idx_url_visits_session_id` - Fast anonymous tracking
- `idx_url_visits_authenticated` - Optimized for authenticated queries

### Rate Limiting
- **Public Endpoint:** 100 requests/minute
- **Async Tracking:** Uses `requestIdleCallback` or `setTimeout`
- **Keepalive:** Requests complete even if page unloads

### Data Volume
- No automatic deletion (all views retained)
- Consider adding retention policy in future
- Can be cleaned up manually if needed

---

## API Endpoints

### POST `/api/analytics/view`
**Purpose:** Record a page view

**Request:**
```json
{
  "page_url": "/feed",
  "referrer_url": "https://google.com",
  "user_agent": "Mozilla/5.0...",
  "session_id": "uuid-here"
}
```

**Response:**
```json
{
  "success": true,
  "view_id": "uuid-here"
}
```

**Security:**
- Rate limited: 100 requests/minute
- Optional authentication
- Input validation with Zod

---

## Migration History

### Migration 269: Created `analytics.page_views` and `analytics.pin_views`
- Original analytics schema
- Separate tables for pages and pins

### Migration 270: Created public views
- Public views pointing to analytics schema tables
- Wrapper functions in public schema

### Migration 421: Consolidated to `public.url_visits`
- Unified URL-based tracking
- Migrated all data from analytics schema
- Dropped analytics schema (if empty)

**Current State:** Using `public.url_visits` table with `record_url_visit()` function

---

## Helper Functions

### `extract_mention_id_from_url(p_url)`
Extracts mention/pin ID from URL query parameters (`?pin=uuid` or `?pinId=uuid`)

### `extract_profile_username_from_url(p_url)`
Extracts profile username from URL path (`/profile/{username}`)

---

## View Count Updates

### Automatic Updates
- **Profile Views:** `accounts.view_count` incremented when `/profile/{username}` is viewed
- **Mention Views:** `mentions.view_count` incremented when URL contains `?pin={id}`

### Self-Visits
- Profile self-visits are NOT counted (owner viewing own profile)
- Mention self-visits ARE counted (owner can see their own views)

---

## Analytics Page Integration

The `/analytics` page shows:
- **Profile Views:** Views of user's profile page
- **Mention Views:** Views of user's mentions/pins
- **Post Views:** Views of user's posts
- **Map Views:** Views of user's maps

All filtered by:
- Time period (24h, 7d, 30d, all time)
- Content type (Profile, Mention, Post, Map)
- Visitor identities (PRO feature)
