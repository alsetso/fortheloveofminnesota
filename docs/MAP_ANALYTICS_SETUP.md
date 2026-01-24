# Map Analytics Setup Review

## Current Setup for `/map/[id]` Page

### ✅ What's Currently Implemented

#### 1. **View Tracking**
- **Endpoint**: `POST /api/analytics/map-view`
- **Location**: `src/app/api/analytics/map-view/route.ts`
- **Method**: Records views via `record_url_visit()` function
- **URL Format**: `/map/{map_id}` or `/map/{custom_slug}`
- **Data Tracked**:
  - `map_id` (UUID)
  - `account_id` (viewer, null for anonymous)
  - `referrer_url`
  - `user_agent`
  - `session_id`
  - `viewed_at` (timestamp)

#### 2. **Stats Retrieval**
- **Endpoint**: `GET /api/maps/[id]/stats`
- **Location**: `src/app/api/maps/[id]/stats/route.ts`
- **Supports**: Both UUID and `custom_slug` lookup
- **Returns**:
  - `total_views`: Total number of views
  - `unique_viewers`: Unique accounts + sessions
  - `accounts_viewed`: Number of authenticated accounts that viewed

#### 3. **Page Implementation**
- **File**: `src/app/map/[id]/page.tsx`
- **Features**:
  - Fetches map data on load
  - Records view once per page load (`hasRecordedView` flag)
  - Fetches and displays view count
  - Uses `PageViewTracker` component for general page tracking
  - Handles both UUID and custom slug routes

#### 4. **Analytics Page Integration**
- **File**: `src/app/analytics/page.tsx`
- **Status**: ✅ **NOW IMPLEMENTED**
- **Features**:
  - Fetches user's maps (by `account_id`)
  - Extracts map IDs from `/map/{id}` and `/map/{slug}` URLs
  - Filters `url_visits` to only show views for user's maps
  - Adds "Map Views" stat card
  - Adds "Map" filter option
  - Displays map views in the views table with:
    - Map title as content title
    - Map description as preview
    - Links to map page
    - Viewer information (if user has `visitor_identities` feature)

## Analytics Page Features

### Stats Cards
- **Profile Views**: Views of user's profile page
- **Mention Views**: Views of user's mentions/pins
- **Post Views**: Views of user's posts
- **Map Views**: ✅ Views of user's maps (NEW)

### Filter Options
- All views
- Profile only
- Mention only
- Post only
- Map only ✅ (NEW)

### View Details
Each view shows:
- **Type**: Badge (Profile/Mention/Post/Map)
- **Content**: Title with link to content
- **Viewed**: Relative time (e.g., "2h ago")
- **Viewer**: Username/avatar (if `visitor_identities` feature enabled) or "Upgrade to View"

## Data Flow

### View Recording
```
User visits /map/{id}
  ↓
Page loads → useEffect triggers
  ↓
POST /api/analytics/map-view
  ↓
record_url_visit() function
  ↓
Stored in url_visits table
  URL: /map/{map_id}
  account_id: viewer's account (or null)
```

### Stats Retrieval
```
GET /api/maps/{id}/stats
  ↓
get_url_stats() function
  ↓
Queries url_visits for /map/{map_id}
  ↓
Returns aggregated stats
```

### Analytics Page
```
User visits /analytics
  ↓
Server fetches:
  1. User's maps (by account_id)
  2. All url_visits matching /map/%
  ↓
Filters to user's maps only
  ↓
Extracts map IDs/slugs from URLs
  ↓
Fetches map titles/descriptions
  ↓
Displays in views table
```

## What's Working

✅ Map views are tracked on page load  
✅ View counts are displayed on map page  
✅ Stats API supports both UUID and custom slugs  
✅ Analytics page shows map views  
✅ Map views are filterable  
✅ Map views show in "My Maps" analytics  
✅ Visitor identities work for map views (if feature enabled)  
✅ Time filters work for map views  

## Technical Details

### URL Pattern Matching
- UUID format: `/map/{uuid}` - 36 character UUID
- Custom slug: `/map/{slug}` - lowercase alphanumeric + hyphens
- Both patterns are extracted and matched to user's maps

### Performance
- Uses indexed queries on `url_visits.url`
- Batch fetches map content for all unique map IDs
- Limits initial load (pagination for more)
- Time filtering applied server-side

### Security
- Only shows views for maps owned by the user
- RLS policies enforce map access
- Visitor identities require `visitor_identities` feature access
- Rate limited: 100 req/min (public) for view recording

## Future Enhancements (Optional)

- [ ] Map-specific analytics page (`/map/{id}/analytics`)
- [ ] Time-series charts for map views
- [ ] Geographic breakdown of viewers
- [ ] Referrer analysis (where traffic comes from)
- [ ] Engagement metrics (time on map, interactions)
- [ ] Export analytics data
