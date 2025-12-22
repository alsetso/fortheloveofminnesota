# Ideal Analytics System - Strategic Breakdown

## Overview
Comprehensive analytics tracking for homepage loads, profile page loads, map pin views, and all user-generated content.

## Entity Types Tracked

### 1. **Homepage** (`entity_type: 'homepage'`)
- **What**: Main landing page (`/`)
- **Tracking**: When homepage component mounts
- **Identifier**: `entity_slug: 'homepage'` (no entity_id needed)
- **Purpose**: Track overall site engagement
- **Display**: Show in Analytics as "Homepage" with total views

### 2. **Profile Pages** (`entity_type: 'account'`)
- **What**: User profile pages (`/profile/[username]`)
- **Tracking**: Already implemented via `usePageView` in ProfileClient
- **Identifier**: `entity_slug: username` or `entity_id: account.id`
- **Purpose**: Track profile visibility
- **Display**: Show in Analytics as "Profile" with username

### 3. **Map Pins** (`entity_type: 'map_pin'`)
- **What**: Individual map pin popups/clicks
- **Tracking**: When pin popup opens (not just map load)
- **Identifier**: `entity_id: pin.id` (UUID)
- **Purpose**: Track which pins get the most attention
- **Display**: Show in Analytics as "Map Pins" with pin description/location

### 4. **Posts** (`entity_type: 'post'`)
- **What**: Feed posts (`/feed/post/[id]`)
- **Tracking**: Already implemented
- **Identifier**: `entity_id: post.id`
- **Purpose**: Track post engagement
- **Display**: Already shown in Analytics

## Analytics Dashboard Structure

### Summary Cards (Top)
1. **Total Page Loads**: Sum of all entity views
2. **Unique Visitors**: Distinct accounts + IPs across all entities
3. **Most Viewed**: Top entity by views
4. **Recent Activity**: Last 7 days views

### Entity Type Filters
- All Types
- Homepage
- Profile
- Posts
- Map Pins

### Entity List View
Each entity shows:
- **Type Icon**: Visual indicator
- **Title/Name**: Entity identifier
- **Total Views**: All-time count
- **Unique Visitors**: Distinct viewers
- **Last Viewed**: Most recent view timestamp
- **Created**: Entity creation date
- **Link**: Direct link to entity

### Date Range Filters
- Last 24 hours
- Last 7 days
- Last 30 days
- Custom range

## Implementation Strategy

### Phase 1: Core Tracking
1. ✅ Add `homepage` entity type to API validation
2. ✅ Add homepage tracking to homepage component
3. ✅ Add map pin tracking when popups open
4. ✅ Ensure profile tracking is working

### Phase 2: Analytics Display
1. ✅ Update `my-entities` API to include homepage and map pins
2. ✅ Update AnalyticsClient to show all entity types
3. ✅ Add proper icons and labels for each type
4. ✅ Add date range filtering

### Phase 3: Enhanced Metrics
1. Add time-series data (views over time)
2. Add geographic data (if available)
3. Add referrer tracking
4. Add device/browser tracking

## Database Schema Support

Current `page_views` table supports:
- `entity_type`: TEXT (validated via CHECK constraint)
- `entity_id`: UUID (for UUID-based entities)
- `entity_slug`: TEXT (for slug-based entities)
- `account_id`: UUID (viewer's account, NULL for anonymous)
- `ip_address`: INET (for anonymous tracking)
- `viewed_at`: TIMESTAMP

**Required Updates:**
- Add `'homepage'` to entity_type CHECK constraint
- Ensure `map_pin` is already supported (migration 186)

## API Endpoints

### `/api/analytics/view` (POST)
- Accepts: `homepage`, `account`, `post`, `map_pin`
- Records view with account_id and IP
- Returns view_count

### `/api/analytics/my-entities` (GET)
- Returns: All entities owned/created by current user
- Includes: homepage (if user has any views), profile, posts, map pins
- Filters: entity_type, date_from, date_to
- Sorts: by last_viewed_at or created_at

## User Experience

### Analytics Tab Shows:
1. **Homepage**: "Homepage" - shows all homepage loads
2. **Profile**: "My Profile" - shows profile views
3. **Posts**: List of all posts with stats
4. **Map Pins**: List of all map pins with stats

### Key Metrics Per Entity:
- Total views (all-time)
- Unique visitors (distinct accounts + IPs)
- Last viewed timestamp
- Created timestamp
- Direct link to entity

## Privacy & Performance

- **Anonymous Tracking**: IP addresses for non-authenticated users
- **Rate Limiting**: 100 requests/minute per IP
- **Silent Failures**: Analytics never break page rendering
- **Client-Side**: All tracking is async and non-blocking
- **Server-Side**: Efficient queries with proper indexes



