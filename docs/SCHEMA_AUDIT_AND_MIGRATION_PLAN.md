# Schema Audit & Migration Plan

## Current State Analysis

### Existing Schemas Overview

#### **public** (Legacy - Overloaded)
**Purpose:** Originally held everything, now needs cleanup
**Tables:** 16 tables (excluding spatial_ref_sys system table)

**Key Tables:**
- `accounts` - User accounts (147 rows) ✅ **KEEP** - Core identity
- `map` - Maps (11 rows) ⚠️ **OVERLAP** with `maps.maps`
- `map_pins` - Map pins (87 rows) ⚠️ **OVERLAP** with `maps.pins`
- `map_members` - Map memberships (158 rows) ⚠️ **OVERLAP** with `maps.memberships`
- `map_areas` - Map areas (0 rows) ⚠️ **OVERLAP** with `maps.areas`
- `map_categories` - Map categories (7 rows) ⚠️ **OVERLAP** with `maps.categories`
- `map_membership_requests` - Membership requests (7 rows) ⚠️ **MISSING** in new schema
- `map_pins_likes` - Pin likes (5 rows) ⚠️ **REPLACED** by `maps.reactions`
- `posts` - Posts (5 rows) ⚠️ **OVERLAP** with `content.posts`
- `mentions` - Mentions (76 rows) ⚠️ **UNCLEAR** - might be legacy pins?
- `mentions_likes` - Mention likes (6 rows) ⚠️ **REPLACED** by interactions
- `collections` - Collections (21 rows) ⚠️ **UNCLEAR** - purpose?
- `mention_types` - Mention types (50 rows) ⚠️ **UNCLEAR** - purpose?
- `subscriptions` - Stripe subscriptions (3 rows) ✅ **KEEP** - Billing
- `stripe_events` - Stripe events (0 rows) ✅ **KEEP** - Billing

#### **New Schemas Created** (Clean Architecture)

1. **messaging** (4 tables)
   - `threads`, `thread_participants`, `messages`, `thread_reads`
   - ✅ **CLEAN** - No overlap

2. **social_graph** (1 table)
   - `edges` (friend/follow/block relationships)
   - ✅ **CLEAN** - No overlap

3. **groups** (2 tables)
   - `groups`, `group_members`
   - ✅ **CLEAN** - No overlap

4. **content** (2 tables)
   - `posts`, `media`
   - ⚠️ **OVERLAP** with `public.posts`

5. **interactions** (2 tables)
   - `reactions`, `comments`
   - ⚠️ **REPLACES** `public.map_pins_likes`, `public.mentions_likes`

6. **feeds** (2 tables)
   - `feed_items`, `feed_rules`
   - ✅ **CLEAN** - No overlap

7. **notifications** (2 tables)
   - `notifications`, `preferences`
   - ✅ **CLEAN** - No overlap

8. **moderation** (2 tables)
   - `reports`, `actions`
   - ✅ **CLEAN** - No overlap

9. **ads** (5 tables)
   - `accounts`, `campaigns`, `ads`, `impressions`, `clicks`
   - ✅ **CLEAN** - No overlap

10. **maps** (6 tables)
    - `maps`, `memberships`, `pins`, `areas`, `categories`, `reactions`
    - ⚠️ **OVERLAP** with `public.map*` tables

11. **stories** (2 tables)
    - `stories`, `slides`
    - ✅ **CLEAN** - No overlap

12. **places** (5 tables)
    - `places`, `categories`, `place_categories`, `sources`, `place_sources`
    - ✅ **CLEAN** - No overlap

#### **Other Existing Schemas**

- **billing** (3 tables) - Plans, features, plan_features ✅ **KEEP**
- **analytics** (1 table) - Events (15K+ rows) ✅ **KEEP**
- **civic** (5 tables) - Government data ✅ **KEEP**
- **news** (2 tables) - News prompts/generated ✅ **KEEP**
- **pro** (1 table) - Businesses ✅ **KEEP**
- **id** (1 table) - Verifications ✅ **KEEP**
- **checkbook** (4 tables) - Government financial data ✅ **KEEP**
- **layers** (5 tables) - Geographic boundaries ✅ **KEEP**

---

## Overlap Analysis & Migration Strategy

### 🔴 **Critical Overlaps**

#### 1. **Maps Schema Duplication**
**Problem:** `public.map*` vs `maps.*`

| public | maps | Action |
|--------|------|--------|
| `map` | `maps.maps` | **MIGRATE** to `maps.maps` |
| `map_pins` | `maps.pins` | **MIGRATE** to `maps.pins` |
| `map_members` | `maps.memberships` | **MIGRATE** to `maps.memberships` |
| `map_areas` | `maps.areas` | **MIGRATE** to `maps.areas` |
| `map_categories` | `maps.categories` | **MIGRATE** to `maps.categories` |
| `map_pins_likes` | `maps.reactions` | **MIGRATE** to `maps.reactions` (type='like') |
| `map_membership_requests` | ❌ Missing | **ADD** to `maps` schema or keep in public temporarily |

**Migration Notes:**
- `public.map` has more fields: `slug`, `tags`, `cover_image_url`, `image_url`, `is_active`, `auto_approve_members`, `membership_rules`, `membership_questions`, `member_count`, `settings`, `boundary`, `boundary_data`, `published_to_community`, `published_at`
- `maps.maps` already has these fields added ✅
- `public.map_pins` has more fields: `emoji`, `caption`, `image_url`, `video_url`, `icon_url`, `media_type`, `full_address`, `map_meta`, `atlas_meta`, `view_count`, `tagged_account_ids`, `visibility`, `archived`, `post_date`
- `maps.pins` already has these fields added ✅

#### 2. **Posts Duplication**
**Problem:** `public.posts` vs `content.posts`

| public.posts | content.posts | Action |
|--------------|--------------|---------|
| Has `map_id`, `mention_ids`, `map_data`, `map_geometry`, `map_center`, `map_bounds`, `map_screenshot`, `map_hide_pin`, `mention_type_id` | Simpler: `author_account_id`, `body`, `visibility`, `group_id` | **DECIDE**: Are these different use cases? |

**Decision Needed:**
- Are `public.posts` map-specific posts?
- Are `content.posts` general social posts?
- **RECOMMENDATION**: Migrate `public.posts` to `content.posts` and add map-specific fields if needed

#### 3. **Mentions vs Pins**
**Problem:** `public.mentions` vs `maps.pins` vs `public.map_pins`

**Analysis:**
- `public.mentions` (76 rows) - Has `lat`, `lng`, `description`, `account_id`, `visibility`, `archived`, `post_date`, `city_id`, `map_meta`, `atlas_meta`, `icon_url`, `full_address`, `image_url`, `video_url`, `media_type`, `mention_type_id`, `tagged_account_ids`, `map_id`
- `public.map_pins` (87 rows) - Very similar structure
- `maps.pins` - New schema version

**RECOMMENDATION**: 
- `public.mentions` appears to be legacy pins/mentions
- **MIGRATE** to `maps.pins` (unified pin system)
- `public.mentions_likes` → `maps.reactions` (type='like')

#### 4. **Collections & Mention Types**
**Problem:** Unclear purpose

- `public.collections` (21 rows) - For categorizing mentions?
- `public.mention_types` (50 rows) - Categories for mentions?

**RECOMMENDATION**: 
- If collections are for organizing pins: **MIGRATE** to `maps` schema or create `maps.collections`
- If mention_types are categories: **MIGRATE** to `places.categories` or keep as reference data

---

## Migration Plan

### Phase 1: Data Migration (Low Risk)

1. **Migrate Maps Data**
   ```sql
   -- Migrate public.map → maps.maps
   -- Migrate public.map_pins → maps.pins
   -- Migrate public.map_members → maps.memberships
   -- Migrate public.map_areas → maps.areas
   -- Migrate public.map_categories → maps.categories
   -- Migrate public.map_pins_likes → maps.reactions (type='like')
   ```

2. **Migrate Posts**
   ```sql
   -- Migrate public.posts → content.posts
   -- Add map-specific fields to content.posts if needed
   ```

3. **Migrate Mentions**
   ```sql
   -- Migrate public.mentions → maps.pins
   -- Migrate public.mentions_likes → maps.reactions (type='like')
   ```

### Phase 2: Schema Cleanup (After Migration)

1. **Rename/Drop Legacy Tables**
   - Keep `public.map*` tables temporarily with `_legacy` suffix
   - Drop after verification

2. **Update Foreign Keys**
   - Update all references from `public.map*` to `maps.*`
   - Update all references from `public.posts` to `content.posts`
   - Update all references from `public.mentions` to `maps.pins`

### Phase 3: Final Cleanup

1. **Keep in public:**
   - `accounts` ✅ (Core identity)
   - `subscriptions` ✅ (Billing)
   - `stripe_events` ✅ (Billing)
   - `spatial_ref_sys` ✅ (PostGIS system)

2. **Decide on:**
   - `collections` - Move to `maps` schema?
   - `mention_types` - Move to `places.categories` or keep as reference?

3. **Drop:**
   - All `public.map*` tables (after migration)
   - `public.posts` (after migration)
   - `public.mentions` (after migration)
   - `public.mentions_likes` (after migration)
   - `public.map_pins_likes` (after migration)

---

## Schema Organization Vision

### **Core Identity & Billing** (public)
- `accounts` - User accounts
- `subscriptions` - Stripe subscriptions
- `stripe_events` - Stripe webhook events

### **Social Features**
- **messaging** - Direct messages & group chats
- **social_graph** - Friend/follow/block relationships
- **groups** - Group management
- **content** - Posts & media
- **interactions** - Reactions & comments
- **feeds** - Materialized feed items
- **notifications** - User notifications
- **stories** - Stories & slides

### **Maps & Places**
- **maps** - User-created maps, pins, areas, categories, reactions
- **places** - Canonical place records with sources

### **Business Features**
- **ads** - Advertising system
- **pro** - Business accounts
- **moderation** - Trust & safety

### **Data & Analytics**
- **analytics** - Event tracking
- **billing** - Plans & features
- **civic** - Government data
- **news** - News generation
- **id** - Identity verification
- **checkbook** - Government financial data
- **layers** - Geographic boundaries

---

## Next Steps

1. ✅ **Migration scripts created** - See `supabase/migrations/1000_migrate_public_map_to_maps_maps.sql`
2. **Test migrations** - On staging/dev first
3. **Update application code** - Point to new schemas
4. **Execute migrations** - Production migration
5. **Cleanup** - Drop legacy tables

## Migration Files Created

- `supabase/migrations/998_ensure_maps_schema_alignment.sql` - Ensures schema alignment
- `supabase/migrations/999_align_and_migrate_maps.sql` - Initial migration script
- `supabase/migrations/1000_migrate_public_map_to_maps_maps.sql` - **COMPREHENSIVE MIGRATION** (use this one)

The comprehensive migration:
1. Adds all missing columns to `maps.maps` to match `public.map`
2. Ensures constraints match
3. Migrates all data from `public.map` → `maps.maps`
4. Handles `account_id` → `owner_account_id` mapping
5. Includes verification queries

---

## Questions to Resolve

1. **Are `public.posts` and `content.posts` different use cases?**
2. **What is the purpose of `public.collections`?**
3. **Should `public.mention_types` migrate to `places.categories`?**
4. **Do we need `map_membership_requests` in the new `maps` schema?**
5. **Timeline for migration?** (Can be gradual)
