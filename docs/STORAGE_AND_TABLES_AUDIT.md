# Storage and Tables Audit

## Current Storage Setup for Public Posts

### Storage Buckets Related to Posts

1. **`feed-images`** (Primary for posts)
   - **Public**: Yes
   - **Size Limit**: 100MB (supports videos)
   - **MIME Types**: Images (jpeg, png, gif, webp) + Videos (mp4, webm, quicktime, etc.)
   - **Path Structure**: `{user_id}/feed/{post_id}/{filename}`
   - **Policies**: 
     - Public read access ✅
     - Users can upload/update/delete their own files ✅
   - **Status**: ✅ Properly configured for public posts

2. **`map-pins-media`** (For map pins)
   - **Public**: Yes
   - **Size Limit**: 100MB
   - **Used for**: Map pin images/videos
   - **Status**: ✅ Separate bucket for map pins

3. **`mentions-media`** (Legacy)
   - **Public**: Yes
   - **Size Limit**: 100MB
   - **Status**: ⚠️ May be redundant with map-pins-media

4. **`pins-media`** (Legacy)
   - **Public**: Yes
   - **Size Limit**: 100MB
   - **Status**: ⚠️ May be redundant

### How Public Posts Store Media

**Current Implementation:**
- **Images**: Stored as JSONB array in `content.posts.images` column
  - Format: `[{url: string, filename: string, type: 'image'|'video', ...}]`
  - URLs point to `feed-images` bucket
- **Map Screenshots**: Stored as TEXT in `content.posts.map_screenshot`
  - Can be base64 encoded PNG or URL to storage
  - Currently no dedicated bucket (stored inline or in feed-images)

**Storage Access:**
- ✅ Public posts can be viewed by anyone (anon users)
- ✅ Storage bucket `feed-images` has public read policy
- ✅ Images/videos in public posts are accessible without authentication

## All Data Tables by Schema

### **content** (2 tables)
- `posts` - Public posts migrated from public.posts ✅
- `media` - Media tracking table (owner_account_id, bucket, path, mime_type)

### **public** (13 tables) - Legacy tables
- `accounts` ✅ Keep
- `posts` ⚠️ Still has 5 public posts (should be empty after migration)
- `map` ⚠️ Legacy, overlaps with maps.maps
- `map_pins` ⚠️ Legacy, overlaps with maps.pins
- `map_areas` ⚠️ Legacy, overlaps with maps.areas
- `map_categories` ⚠️ Legacy, overlaps with maps.categories
- `map_members` ⚠️ Legacy, overlaps with maps.memberships
- `map_membership_requests` ⚠️ Legacy, overlaps with maps.requests
- `map_pins_likes` ⚠️ Legacy, overlaps with maps.reactions
- `mention_types` ⚠️ Migrated to maps.tags
- `mentions` ⚠️ Legacy
- `mentions_likes` ⚠️ Legacy
- `collections` ⚠️ Unclear purpose
- `stripe_events` ✅ Keep
- `subscriptions` ✅ Keep

### **maps** (8 tables)
- `maps` ✅
- `pins` ✅
- `areas` ✅
- `categories` ✅
- `memberships` ✅
- `reactions` ✅
- `requests` ✅
- `tags` ✅ (migrated from mention_types)

### **messaging** (4 tables)
- `threads` ✅
- `thread_participants` ✅
- `messages` ✅
- `thread_reads` ✅

### **social_graph** (1 table)
- `edges` ✅

### **groups** (2 tables)
- `groups` ✅
- `group_members` ✅

### **interactions** (2 tables)
- `comments` ✅
- `reactions` ✅

### **feeds** (2 tables)
- `feed_items` ✅
- `feed_rules` ✅

### **notifications** (2 tables)
- `notifications` ✅
- `preferences` ✅

### **moderation** (2 tables)
- `actions` ✅
- `reports` ✅

### **stories** (2 tables)
- `stories` ✅
- `slides` ✅

### **places** (5 tables)
- `places` ✅
- `categories` ✅
- `place_categories` ✅
- `place_sources` ✅
- `sources` ✅

### **ads** (5 tables)
- `accounts` ✅
- `ads` ✅
- `campaigns` ✅
- `clicks` ✅
- `impressions` ✅

### **billing** (3 tables)
- `plans` ✅
- `features` ✅
- `plan_features` ✅

### **pro** (1 table)
- `businesses` ✅

### **id** (1 table)
- `verifications` ✅

### **civic** (5 tables)
- `orgs` ✅
- `people` ✅
- `roles` ✅
- `buildings` ✅
- `events` ✅

### **layers** (5 tables)
- `cities_and_towns` ✅
- `counties` ✅
- `districts` ✅
- `state` ✅
- `water` ✅

### **checkbook** (4 tables)
- `budgets` ✅
- `contracts` ✅
- `payments` ✅
- `payroll` ✅

### **analytics** (1 table)
- `events` ✅

### **news** (2 tables)
- `generated` ✅
- `prompt` ✅

## Recommendations

### Storage Buckets - Consolidation Needed

**Current Issue**: Multiple overlapping buckets for similar purposes
- `feed-images` - For posts ✅ Keep
- `map-pins-media` - For map pins ✅ Keep
- `mentions-media` - Legacy, overlaps with map-pins-media ⚠️ Consider removing
- `pins-media` - Legacy, overlaps with map-pins-media ⚠️ Consider removing
- `user-map-video-storage` - Overlaps with map-pins-media ⚠️ Consider removing

**Recommendation**: 
1. Keep `feed-images` for posts (already properly configured)
2. Keep `map-pins-media` for map pins
3. Migrate any remaining files from `mentions-media`, `pins-media`, `user-map-video-storage` to `map-pins-media`
4. Drop redundant buckets after migration

### Map Screenshots Storage

**Current**: Stored as TEXT (base64 or URL) in `content.posts.map_screenshot`

**Options**:
1. **Keep as-is** - Simple, works for small screenshots
2. **Use feed-images bucket** - Store screenshots in same bucket as post images
   - Path: `{user_id}/feed/{post_id}/screenshot.png`
3. **Create dedicated bucket** - `map-screenshots` (probably overkill)

**Recommendation**: Use `feed-images` bucket for consistency

### Tables Cleanup

**High Priority**:
1. **public.posts** - Should be empty after migration (only non-public posts remain)
2. **public.map_*** tables - All migrated to maps schema, can be dropped
3. **public.mention_types** - Migrated to maps.tags, can be dropped
4. **public.mentions** - Legacy, should be migrated or dropped
5. **public.mentions_likes** - Legacy, should be migrated or dropped

**Medium Priority**:
- **public.collections** - Unclear purpose, needs audit
- **content.media** - Check if actually used (seems unused)

## Action Items

1. ✅ **Public posts migration** - Complete (5 posts migrated)
2. ⚠️ **Storage bucket consolidation** - Review and consolidate overlapping buckets
3. ⚠️ **Map screenshots** - Decide on storage strategy
4. ⚠️ **Legacy table cleanup** - Drop migrated/legacy tables
5. ⚠️ **content.media table** - Verify usage or remove if unused
