# Map Schema Migration Analysis

Analysis of current codebase and backend structure for migrating map-specific tables to their own schema.

## Current Architecture

All map-related tables currently exist in the `public` schema. This document outlines what would need to be migrated if moving to a dedicated `maps` schema.

---

## Map-Specific Tables

### Core Tables

#### 1. `public.map`
**Primary table** - Stores map metadata and configuration.

**Key Columns:**
- `id` (UUID, PK)
- `account_id` (UUID, FK → `public.accounts`)
- `name`, `description`, `slug`
- `visibility` (public/private)
- `settings` (JSONB - collaboration, appearance, presentation)
- `boundary`, `boundary_data` (geographic scope)
- `member_count`, `is_active`
- `auto_approve_members`, `membership_rules`, `membership_questions`
- `published_to_community`, `published_at`
- `tags`, `created_at`, `updated_at`

**Dependencies:**
- Referenced by: `map_pins`, `map_areas`, `map_members`, `map_membership_requests`, `map_categories`, `map_views`, `posts`, `map_share`
- References: `public.accounts`

---

#### 2. `public.map_pins`
Point markers on maps (emoji, caption, image, video).

**Key Columns:**
- `id` (UUID, PK)
- `map_id` (UUID, FK → `public.map`)
- `emoji`, `caption`, `image_url`, `video_url`
- `lat`, `lng` (coordinates)
- `is_active`, `created_at`, `updated_at`

**Dependencies:**
- References: `public.map`
- Referenced by: `map_pins_likes`

---

#### 3. `public.map_areas`
Polygon/multipolygon shapes drawn on maps.

**Key Columns:**
- `id` (UUID, PK)
- `map_id` (UUID, FK → `public.map`)
- `name`, `description`
- `geometry` (JSONB - GeoJSON Polygon/MultiPolygon)
- `is_active`, `created_at`, `updated_at`

**Dependencies:**
- References: `public.map`

---

#### 4. `public.map_members`
Membership and role management for maps.

**Key Columns:**
- `id` (UUID, PK)
- `map_id` (UUID, FK → `public.map`)
- `account_id` (UUID, FK → `public.accounts`)
- `role` (owner/manager/editor)
- `joined_at`

**Dependencies:**
- References: `public.map`, `public.accounts`
- Triggers: Updates `map.member_count` on insert/delete

---

#### 5. `public.map_membership_requests`
Join requests for maps with custom questions.

**Key Columns:**
- `id` (UUID, PK)
- `map_id` (UUID, FK → `public.map`)
- `account_id` (UUID, FK → `public.accounts`)
- `answers` (JSONB - question responses)
- `status` (pending/approved/rejected)
- `created_at`, `reviewed_at`, `reviewed_by_account_id`

**Dependencies:**
- References: `public.map`, `public.accounts`

---

#### 6. `public.map_categories`
Many-to-many relationship between maps and categories.

**Key Columns:**
- `id` (UUID, PK)
- `map_id` (UUID, FK → `public.map`)
- `category` (community/professional/government/atlas/user)

**Dependencies:**
- References: `public.map`

---

#### 7. `public.map_pins_likes`
Tracks likes on map pins.

**Key Columns:**
- `id` (UUID, PK)
- `map_pin_id` (UUID, FK → `public.map_pins`)
- `account_id` (UUID, FK → `public.accounts`)
- `created_at`

**Dependencies:**
- References: `public.map_pins`, `public.accounts`

---

#### 8. `public.map_share`
Account-based sharing (legacy, may be superseded by `map_members`).

**Key Columns:**
- `id` (UUID, PK)
- `map_id` (UUID, FK → `public.map`)
- `account_id` (UUID, FK → `public.accounts`)
- `permission` (view/edit/admin)
- `created_at`

**Dependencies:**
- References: `public.map`, `public.accounts`

---

#### 9. `public.map_configs`
Reusable map configurations (layer visibility, styles, controls).

**Key Columns:**
- `id` (UUID, PK)
- `account_id` (UUID, FK → `public.accounts`)
- `title`, `description`
- `is_homepage` (boolean - only one system-wide)
- `style` (streets/satellite/light/dark/outdoors)
- `layers` (JSONB array)
- `controls` (JSONB object)
- `viewport` (JSONB - optional)
- `created_at`, `updated_at`

**Dependencies:**
- References: `public.accounts`
- **Note:** Not directly tied to `map` table, but conceptually map-related

---

### Analytics Tables

#### 10. `analytics.map_views`
Tracks who views which maps.

**Key Columns:**
- `id` (UUID, PK)
- `map_id` (UUID, FK → `public.map`)
- `account_id` (UUID, FK → `public.accounts`, nullable)
- `viewed_at`, `user_agent`, `referrer_url`, `session_id`

**Dependencies:**
- References: `public.map`, `public.accounts`
- **Note:** Exists in `analytics` schema, not `public`

---

### Cross-Reference Tables

#### 11. `public.posts` (partial)
Posts can optionally belong to maps.

**Key Columns:**
- `map_id` (UUID, FK → `public.map`, nullable)

**Dependencies:**
- References: `public.map`
- **Note:** Only the `map_id` column is map-related

---

## Database Functions

### Map Access Functions
- `public.user_owns_map(UUID)` - Checks if user owns a map
- `public.user_has_map_access(UUID, map_permission)` - Checks map access
- `public.is_map_member(UUID, UUID)` - Checks membership
- `public.is_map_manager(UUID, UUID)` - Checks manager role
- `public.is_map_admin(UUID, UUID)` - Checks admin role
- `public.is_map_owner(UUID, UUID)` - Checks owner role

### Map Configuration Functions
- `public.user_owns_map_config(UUID)` - Checks map config ownership
- `public.set_homepage_map_config(UUID)` - Sets homepage map config
- `public.generate_map_slug(TEXT)` - Generates unique map slug

### Analytics Functions
- `analytics.record_map_view(UUID, UUID, TEXT, TEXT, UUID)` - Records map view
- `analytics.get_map_stats(UUID, INTEGER)` - Returns map statistics
- `analytics.get_map_viewers(UUID, INTEGER, INTEGER)` - Returns map viewers
- `public.get_map_stats(UUID, INTEGER)` - Public wrapper for analytics function
- `public.get_map_viewers(UUID, INTEGER, INTEGER)` - Public wrapper for analytics function

### Trigger Functions
- `public.update_map_member_count()` - Updates `map.member_count` on member insert/delete
- `public.auto_add_map_creator_as_owner()` - Auto-adds creator as owner member

---

## Database Triggers

### On `public.map`
- `update_map_updated_at` - Updates `updated_at` on update
- `auto_add_map_creator_as_owner_trigger` - Adds creator as owner member on insert

### On `public.map_members`
- `update_map_member_count_trigger` - Updates `map.member_count` on insert/delete

### On `public.map_pins`
- `update_map_pins_updated_at` - Updates `updated_at` on update

### On `public.map_areas`
- `update_map_areas_updated_at` - Updates `updated_at` on update

### On `public.map_configs`
- `update_map_configs_updated_at` - Updates `updated_at` on update

### On `analytics.map_views`
- `map_views_instead_of_insert` - INSTEAD OF trigger for public view

---

## Row Level Security (RLS) Policies

All map tables have RLS enabled with policies checking:
- Map visibility (public/private)
- Map membership
- Account ownership
- Map manager/admin roles

**Key Policy Patterns:**
- Anonymous users can view public maps and their content
- Authenticated users can view public maps + maps they're members of
- Map owners/managers have full control
- Map editors can add pins/areas/posts (if collaboration settings allow)

---

## Code References

### API Routes
- `src/app/api/maps/route.ts` - List maps
- `src/app/api/maps/[id]/route.ts` - Get single map
- `src/app/api/maps/[id]/data/route.ts` - Aggregate map data
- `src/app/api/maps/stats/route.ts` - Map statistics
- `src/app/api/maps/live/mentions/route.ts` - Live map mentions

### Services
- `src/lib/maps/getAccessibleMaps.ts` - Get accessible maps for user
- `src/lib/maps/urls.ts` - Map URL utilities
- `src/features/user-maps/services/userMapService.ts` - User map operations
- `src/features/map-pins/services/publicMapPinService.ts` - Map pin operations

### Components
- `src/app/map/[id]/page.tsx` - Map page component
- `src/app/map/[id]/components/*` - Map-specific components
- `src/components/layout/MapsSelectorDropdown.tsx` - Map selector

### Types
- `src/types/map.ts` - Map type definitions

---

## Migration Considerations

### 1. Schema Creation
Create new `maps` schema:
```sql
CREATE SCHEMA IF NOT EXISTS maps;
```

### 2. Table Migration
Move tables from `public` to `maps`:
- `map` → `maps.map`
- `map_pins` → `maps.map_pins`
- `map_areas` → `maps.map_areas`
- `map_members` → `maps.map_members`
- `map_membership_requests` → `maps.map_membership_requests`
- `map_categories` → `maps.map_categories`
- `map_pins_likes` → `maps.map_pins_likes`
- `map_share` → `maps.map_share`
- `map_configs` → `maps.map_configs` (optional - not directly tied to map)

**Note:** `analytics.map_views` stays in `analytics` schema but FK reference changes.

### 3. Foreign Key Updates
All foreign keys referencing `public.map` need to be updated:
- `maps.map_pins.map_id` → `maps.map.id`
- `maps.map_areas.map_id` → `maps.map.id`
- `maps.map_members.map_id` → `maps.map.id`
- `maps.map_membership_requests.map_id` → `maps.map.id`
- `maps.map_categories.map_id` → `maps.map.id`
- `maps.map_share.map_id` → `maps.map.id`
- `analytics.map_views.map_id` → `maps.map.id`
- `public.posts.map_id` → `maps.map.id` (cross-schema FK)

### 4. Function Updates
All functions referencing `public.map` need schema qualification:
- `public.user_owns_map()` → references `maps.map`
- `public.is_map_member()` → references `maps.map_members`
- All RLS policies need schema qualification

### 5. Code Updates Required

**Supabase Client Queries:**
- `.from('map')` → `.from('maps.map')` or use schema search path
- `.from('map_pins')` → `.from('maps.map_pins')`
- `.from('map_areas')` → `.from('maps.map_areas')`
- `.from('map_members')` → `.from('maps.map_members')`
- All other map table references

**Type Definitions:**
- Update `src/types/supabase.ts` to reflect new schema structure

**RLS Policies:**
- All policies need to reference `maps.map` instead of `public.map`
- Cross-schema references need explicit schema qualification

### 6. Search Path Configuration
Consider setting `search_path` for map-related operations:
```sql
SET search_path = maps, public, analytics;
```

Or use explicit schema qualification in all queries.

### 7. PostgREST Configuration
If using PostgREST, ensure `maps` schema is exposed:
```sql
GRANT USAGE ON SCHEMA maps TO postgres, anon, authenticated;
```

### 8. Migration Order
1. Create `maps` schema
2. Create tables in `maps` schema (copy structure)
3. Migrate data from `public` to `maps`
4. Update foreign keys
5. Update functions and triggers
6. Update RLS policies
7. Update code references
8. Drop old `public` tables (after verification)

---

## Benefits of Schema Separation

1. **Logical Organization** - All map-related tables grouped together
2. **Namespace Isolation** - Reduces naming conflicts
3. **Permission Management** - Easier to grant/revoke schema-level permissions
4. **Maintenance** - Clearer boundaries for maintenance and refactoring
5. **Scalability** - Easier to move to separate database if needed

---

## Risks and Challenges

1. **Cross-Schema Foreign Keys** - `public.posts.map_id` → `maps.map.id` requires cross-schema FK support
2. **RLS Complexity** - Policies referencing multiple schemas can be complex
3. **Function Dependencies** - Functions may need schema qualification
4. **Code Updates** - Extensive codebase changes required
5. **Migration Downtime** - Data migration may require downtime
6. **Testing** - Comprehensive testing needed for all map functionality

---

## Summary

**Tables to Migrate:**
- Core: `map`, `map_pins`, `map_areas`, `map_members`, `map_membership_requests`, `map_categories`, `map_pins_likes`, `map_share`
- Config: `map_configs` (optional)
- Analytics: `analytics.map_views` (stays in analytics, but FK updates)

**Dependencies:**
- Foreign keys to `public.accounts` (cross-schema)
- Foreign key from `public.posts.map_id` (cross-schema)
- Functions, triggers, and RLS policies need updates
- Extensive codebase changes in API routes, services, and components

**Estimated Impact:**
- High complexity migration
- Requires comprehensive testing
- Potential for breaking changes if not carefully executed
