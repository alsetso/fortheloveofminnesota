# Database Schema to Routes Coverage Analysis

## Complete Schema List (from Supabase)

### Application Schemas (29 total)

| Schema | Tables | Route Coverage | Status |
|--------|--------|----------------|--------|
| **ads** | 5 (accounts, ads, campaigns, clicks, impressions) | `/ad_center` ✅ | Covered |
| **analytics** | 2 (events, url_visits) | `/analytics` ✅ | Covered |
| **billing** | 3 (features, plan_features, plans) | `/settings/billing`, `/plans` ✅ | Covered |
| **checkbook** | 4 (budgets, contracts, payments, payroll) | `/gov/checkbook/*` ✅ | Covered |
| **civic** | 5 (buildings, events, orgs, people, roles) | `/gov`, `/gov/people`, `/gov/orgs` ✅ | Covered |
| **content** | 2 (media, posts) | `/post/[id]`, `/map/[id]/post/[postId]` ✅ | Covered |
| **feeds** | 2 (feed_items, feed_rules) | `/feed` ✅ | Covered |
| **groups** | 2 (groups, group_members) | `/groups` ⚠️ | Draft/Unpublished |
| **id** | 1 (verifications) | `/settings/id` ✅ | Covered |
| **interactions** | 2 (comments, reactions) | Embedded in posts ✅ | Covered |
| **layers** | 5 (cities_and_towns, counties, districts, state, water) | `/explore`, `/explore/layers/[slug]` ✅ | Covered |
| **maps** | 8 (areas, categories, maps, memberships, pins, reactions, requests, tags) | `/maps`, `/map/[id]` ✅ | Covered |
| **messaging** | 4 (messages, thread_participants, thread_reads, threads) | ❌ **MISSING** | **No Route** |
| **moderation** | 2 (actions, reports) | Admin only ✅ | Covered |
| **news** | 2 (generated, prompt) | `/news` ✅ | Covered |
| **notifications** | 2 (notifications, preferences) | Embedded in header ✅ | Covered |
| **pages** | 3 (blocks, pages, permissions) | `/pages`, `/page/[id]` ✅ | Covered |
| **places** | 5 (categories, place_categories, place_sources, places, sources) | ❌ **MISSING** | **No Route** |
| **pro** | 1 (businesses) | `/settings/business` ✅ | Covered |
| **public** | 36 (accounts, collections, map*, mentions*, posts, subscriptions, etc.) | Mixed coverage | See below |
| **social_graph** | 1 (edges) | `/friends` ✅ | Covered |
| **stories** | 2 (slides, stories) | `/stories` ✅ | Covered |

### System Schemas (Excluded from routes)
- `auth` - Authentication (Supabase managed)
- `extensions` - Postgres extensions
- `cron` - Scheduled jobs
- `realtime` - Realtime subscriptions
- `storage` - File storage
- `supabase_migrations` - Migration tracking
- `vault` - Secrets management

## Missing Routes

### 1. **messaging** schema (4 tables)
- **Tables**: threads, thread_participants, messages, thread_reads
- **Missing Route**: `/messages` or `/messages/[threadId]`
- **Priority**: High - Core feature

### 2. **places** schema (5 tables)
- **Tables**: places, categories, place_categories, place_sources, sources
- **Missing Route**: `/places` or `/explore/places`
- **Priority**: Medium - Could be part of explore

### 3. **public.collections** table
- **Table**: collections (in public schema)
- **Missing Route**: `/collections` or `/collections/[id]`
- **Priority**: Medium - May be embedded in profiles

## Public Schema Analysis

The `public` schema has 36 tables (many are legacy/views). Key tables:

**Covered:**
- `accounts` → `/[username]` profiles
- `posts` → `/post/[id]` (legacy, migrating to content.posts)
- `map*` → `/maps`, `/map/[id]` (legacy, migrating to maps.*)
- `subscriptions` → `/settings/billing`
- `mention_types` → Embedded in maps/mentions

**Partially Covered:**
- `collections` → May be embedded, no dedicated route
- `mentions` → `/mention/[id]` (legacy, migrating to maps.pins)

**Legacy/Deprecated:**
- `map_pins_likes` → Replaced by `maps.reactions`
- `mentions_likes` → Replaced by `interactions.reactions`
- `map*` tables → Migrating to `maps.*` schema

## Recommendations

1. ✅ **Add `/messages` route** for messaging schema - **COMPLETED**
2. ✅ **Add `/places` or integrate into `/explore`** for places schema - **COMPLETED**
3. ✅ **Consider `/collections` route** if collections need dedicated page - **COMPLETED**
4. ⚠️ **Complete migration** from public.* to dedicated schemas (maps.*, content.*) - **IN PROGRESS**

## Migration Status

**Data Migration:** ✅ Complete
- `public.map` → `maps.maps` (11 rows migrated)
- `public.map_pins` → `maps.pins` (87 rows migrated)
- `public.posts` → `content.posts` (5 rows migrated)

**Code Migration:** ⚠️ In Progress
- 47 files still reference `public.map` → need `maps.maps`
- 28 files still reference `public.map_pins` → need `maps.pins`
- 8 files still reference `public.posts` → need `content.posts`

See `PUBLIC_SCHEMA_MIGRATION_AUDIT.md` for complete file list.

## Coverage Summary

- **Total Application Schemas**: 22
- **Schemas with Routes**: 19 (86%)
- **Schemas Missing Routes**: 2 (messaging, places)
- **Schemas Draft/Unpublished**: 1 (groups)

**Overall**: Good coverage. Main gaps are messaging and places.
