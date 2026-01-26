# Mentions to Map Pins Migration Plan

## Overview

This migration unifies all mentions into the `map_pins` table, linking them to the "live" map (slug='live'). All functionality is preserved.

## Migration Status

✅ **Database Migration Complete** (`491_unify_mentions_into_map_pins.sql`)

## What Was Migrated

### Data Migration
- All `mentions` → `map_pins` with `map_id` = live map ID
- All `mentions_likes` → `map_pins_likes`
- All columns preserved:
  - Core: `id`, `lat`, `lng`, `description`, `account_id`, `visibility`, `archived`, `post_date`
  - Location: `city_id`, `map_meta`, `atlas_meta`, `full_address`
  - Media: `icon_url`, `image_url`, `video_url`, `media_type`
  - Categorization: `collection_id`, `mention_type_id`
  - Social: `view_count`, `tagged_account_ids`

### Schema Changes
- `map_pins` table expanded with all mentions columns
- New `map_pins_likes` table created (unified likes)
- RLS policies updated to support both map-based and account-based access
- All indexes and constraints added

## Next Steps (Code Updates Required)

### 1. Update API Routes

**Mentions API → Map Pins API:**
- `/api/mentions` → `/api/maps/live/pins` (or keep mentions API but query map_pins)
- `/api/mentions/[id]` → `/api/maps/live/pins/[id]`
- `/api/maps/live/mentions` → `/api/maps/live/pins`

**Files to update:**
- `src/app/api/mentions/route.ts`
- `src/app/api/mentions/[id]/route.ts`
- `src/app/api/maps/live/mentions/route.ts`

### 2. Update Likes API

**Mentions Likes → Map Pins Likes:**
- `/api/mentions/[id]/like` → `/api/maps/live/pins/[id]/like`
- Update to use `map_pins_likes` table

**Files to update:**
- `src/app/api/mentions/[id]/like/route.ts` (if exists)

### 3. Update Frontend Components

**MentionsLayer → MapPinsLayer:**
- `src/features/map/components/MentionsLayer.tsx` → Update to query `map_pins` where `map_id = live_map_id`
- Or create unified `MapPinsLayer` component

**Files to update:**
- `src/features/map/components/MentionsLayer.tsx`
- `src/features/homepage/components/LiveMap.tsx`
- `src/components/feed/CreatePostModal.tsx` (if creates mentions)
- Any other components that reference mentions

### 4. Update Type Definitions

**Mention → MapPin:**
- `src/types/mention.ts` → Update or merge with `src/types/map-pin.ts`
- Ensure `MapPin` type includes all migrated fields

**Files to update:**
- `src/types/mention.ts`
- `src/types/map-pin.ts`

### 5. Update Services

**MentionService → MapPinService:**
- `src/features/mentions/services/mentionService.ts` → Update to query `map_pins`
- Or create unified service

**Files to update:**
- `src/features/mentions/services/mentionService.ts`
- `src/features/map-pins/services/publicMapPinService.ts` (if exists)

### 6. Update Database Queries

**All mentions queries → map_pins queries:**
- Change `FROM mentions` → `FROM map_pins WHERE map_id = live_map_id`
- Update RPC functions that reference mentions
- Update views/materialized views

**Files to check:**
- All SQL files in `supabase/migrations/`
- RPC functions in `supabase/functions/`

### 7. Handle Backward Compatibility (Optional)

**Option A: Keep mentions table as view**
```sql
CREATE VIEW mentions AS
SELECT * FROM map_pins WHERE map_id = (SELECT id FROM map WHERE slug = 'live');
```

**Option B: Keep mentions_likes as view**
```sql
CREATE VIEW mentions_likes AS
SELECT 
  id,
  map_pin_id as mention_id,
  account_id,
  created_at
FROM map_pins_likes
WHERE map_pin_id IN (SELECT id FROM map_pins WHERE map_id = (SELECT id FROM map WHERE slug = 'live'));
```

**Option C: Drop tables after code updates**
- Drop `mentions` table
- Drop `mentions_likes` table
- Update all code references first

## Testing Checklist

- [ ] All mentions display correctly on live map
- [ ] Mentions can be created (creates map_pins on live map)
- [ ] Mentions can be edited
- [ ] Mentions can be deleted/archived
- [ ] Likes work (map_pins_likes)
- [ ] Collections work (collection_id preserved)
- [ ] Mention types work (mention_type_id preserved)
- [ ] Media (images/videos) display correctly
- [ ] Tagged accounts work (tagged_account_ids preserved)
- [ ] View counts work
- [ ] RLS policies work (public/only_me visibility)
- [ ] Profile maps still work (if they query mentions)
- [ ] Feed mentions still work (if they query mentions)

## Rollback Plan

If issues arise, the migration can be partially rolled back:

1. **Keep mentions table** - Data is preserved (migration doesn't drop it)
2. **Update code** to query mentions table again
3. **Keep map_pins** - Both tables can coexist
4. **Gradual migration** - Update code incrementally

## Performance Considerations

- All indexes created for new columns
- Composite indexes for common query patterns
- GIN indexes for JSONB columns (map_meta, atlas_meta, tagged_account_ids)
- Query performance should be similar or better (single table vs joins)

## Notes

- The `mentions` table is NOT dropped in this migration - it remains for backward compatibility
- The `mentions_likes` table is NOT dropped - data is copied to `map_pins_likes`
- Both tables can coexist during transition
- All existing mentions are linked to the "live" map (slug='live')
- Custom map pins (with `caption`) are separate from mentions (with `description`)
