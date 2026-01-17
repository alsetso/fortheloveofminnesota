# Atlas Schema Cleanup Analysis

Complete analysis of what needs to be cleaned up after dropping the `atlas` schema.

## Database Cleanup

### ✅ Handled by Migration Script
- All foreign key constraints from other schemas
- All public schema views referencing atlas
- All civic schema views referencing atlas
- All atlas schema functions
- All atlas schema views
- All atlas schema tables
- All atlas schema types/enums
- All RLS policies
- Schema grants
- The atlas schema itself

### ⚠️ Manual Database Cleanup Required

#### 1. `civic.jurisdictions` table
- ✅ FK constraints dropped (handled in script)
- ✅ `city_id` and `county_id` columns kept (UUIDs without FK constraints)
- ✅ `civic.all_jurisdictions` view updated to remove atlas references (handled in script)
- ✅ `civic.get_city_jurisdiction` function dropped (handled in script)

#### 2. `civic.county_boundaries` table
- ✅ FK constraint dropped (handled in script)
- ✅ `county_id` column kept (UUID without FK constraint)

#### 3. Update `public.accounts` table
- Remove or nullify `city_id` column
- Migration: `supabase/migrations/265_recreate_accounts_table_complete.sql` or `002_recreate_accounts_table.sql`

#### 3. Update `public.mentions` table
- Remove or nullify `city_id` column
- Migration: `supabase/migrations/279_add_city_id_to_mentions.sql` needs reversal

#### 4. Update `public.pins` table
- Remove `atlas_metadata` JSONB column or clean up references
- Remove `city_id` and `county_id` columns (stored as UUID, no FK)
- Migration: `supabase/migrations/266_recreate_pins_table.sql`

#### 5. Update `civic.county_boundaries` table
- Remove `county_id` foreign key (already handled in drop script)
- Migration: `supabase/migrations/410_create_county_boundaries_table.sql`

## Application Code Cleanup

### API Routes (DELETE)

#### Public Atlas Routes
- `src/app/api/atlas/types/route.ts` - Get atlas types
- `src/app/api/atlas/[table]/entities/route.ts` - List entities by type
- `src/app/api/atlas/[table]/[id]/route.ts` - Get single entity

#### Admin Atlas Routes
- `src/app/api/admin/atlas/[table]/route.ts` - Create/list atlas entities
- `src/app/api/admin/atlas/[table]/[id]/route.ts` - Get/update/delete atlas entity
- `src/app/api/admin/atlas-types/route.ts` - Manage atlas types
- `src/app/api/admin/atlas-types/[id]/route.ts` - Manage atlas type
- `src/app/api/admin/atlas-types/upload-icon/route.ts` - Upload icon

#### Analytics Routes (Update)
- `src/app/api/analytics/atlas-map-stats/route.ts` - Remove atlas-specific stats

### App Pages (DELETE)

#### Atlas Map Pages
- `src/app/map/atlas/[table]/page.tsx` - Atlas map page
- `src/app/map/atlas/[table]/AtlasMapClient.tsx` - Atlas map client component
- `src/app/map/atlas/[table]/components/*.tsx` - All atlas map components

#### Atlas Explore Pages
- `src/app/explore/atlas/[table_name]/[id]/page.tsx` - Atlas entity detail page
- `src/app/explore/atlas/[table_name]/page.tsx` - Atlas entity list page (if exists)

### Components (UPDATE/DELETE)

#### Components to Delete
- `src/features/atlas/**/*.tsx` - All atlas feature components
- `src/features/atlas/**/*.ts` - All atlas feature services/utils

#### Components to Update

**1. `src/components/layout/SheetSearchInput.tsx`**
- Remove `AtlasEntitySuggestion` interface
- Remove atlas search logic (lines ~122-145)
- Remove atlas entity handling in selection (lines ~235-247)
- Remove atlas entity rendering (lines ~324-353)

**2. `src/components/layout/CreateMentionContent.tsx`**
- Remove `initialAtlasMeta` prop
- Remove atlas entity label display (lines ~418-448)
- Remove `atlas_meta` from mention creation payload

**3. `src/components/layout/CreateMentionPopup.tsx`**
- Remove `initialAtlasMeta` prop
- Remove atlas meta passing to CreateMentionContent

**4. `src/components/layout/MapEntityPopup.tsx`**
- Remove `type === 'atlas'` handling (lines ~755-792)
- Remove atlas entity content rendering

**5. `src/features/homepage/components/LiveMap.tsx`**
- Remove `createTabAtlasMeta` state
- Remove atlas entity click event listener (lines ~507-519)
- Remove atlas meta from create tab (lines ~1589-1596)
- Remove atlas layer rendering logic

**6. `src/features/sidebar/components/MapToolsSecondaryContent.tsx`**
- Remove `ATLAS_ICON_MAP` constant
- Remove `ATLAS_ENTITY_LABELS` constant
- Remove `atlasEntityData` and `atlasEntityTableName` state
- Remove atlas entity click handler (lines ~141-166)
- Remove atlas meta from mention creation (lines ~203-222)
- Remove atlas entity display (lines ~256-277)

**7. `src/features/sidebar/components/LocationSecondaryContent.tsx`**
- Remove `selectedAtlasEntity` prop
- Remove `onAtlasEntityClear` prop

**8. `src/features/sidebar/components/Sidebar.tsx`**
- Remove `atlasLayerVisible` prop
- Remove `onAtlasLayerVisibilityChange` prop
- Remove `selectedAtlasEntity` prop
- Remove `onAtlasEntityClear` prop
- Remove atlas layer visibility logic

**9. `src/features/mentions/services/mentionService.ts`**
- Remove `atlas_meta` from mention creation/update types
- Remove atlas metadata handling

**10. `src/components/layout/CountyHoverInfo.tsx`**
- Check for atlas references (county data might come from atlas)

**11. `src/features/sidebar/components/ExploreSecondaryContent.tsx`**
- Remove atlas entity exploration features

**12. `src/types/mention.ts`**
- Remove `atlas_meta` field from mention type

**13. `src/types/map-pin.ts`**
- Remove `atlas_metadata` field from pin type

### Services & Utils (DELETE)

- `src/features/atlas/services/*.ts` - All atlas services
- `src/features/atlas/utils/*.ts` - All atlas utilities
- `src/lib/services/atlas/*.ts` - Atlas service files (if exists)

### Types (UPDATE/DELETE)

- `src/types/atlas.ts` - Delete entire file
- Update any types that reference atlas entities

### Hooks (DELETE)

- `src/features/atlas/hooks/*.ts` - All atlas hooks
- `src/hooks/useAtlas*.ts` - Any atlas-specific hooks

### Config (UPDATE)

- `src/config/navigation.ts` - Remove atlas navigation links
- Any routing configs that reference atlas routes

### Event Handlers (UPDATE)

Remove all `atlas-entity-click` event listeners and dispatchers:
- `window.addEventListener('atlas-entity-click', ...)`
- `window.dispatchEvent(new CustomEvent('atlas-entity-click', ...))`

## Data Migration Considerations

### Before Dropping Schema

1. **Export Data (if needed)**
   ```sql
   -- Export all atlas tables to CSV/JSON if data needs to be preserved
   ```

2. **Update References**
   - Set all `city_id` and `county_id` foreign keys to NULL
   - Clean up `atlas_metadata` JSONB fields in pins/mentions
   - Update any hardcoded references to atlas entities

3. **Update Search Functionality**
   - Remove atlas entity search from autocomplete
   - Update location search to use alternative data sources

## Testing Checklist

After cleanup, verify:

- [ ] No database errors on app startup
- [ ] No broken imports in TypeScript
- [ ] Search functionality works without atlas
- [ ] Map rendering works without atlas layer
- [ ] Mention creation works without atlas meta
- [ ] No console errors related to atlas
- [ ] All API routes return 404 for atlas endpoints (or are removed)
- [ ] Navigation doesn't include atlas links
- [ ] No broken references in components

## Migration Order

1. **Run drop script**: `416_drop_atlas_schema_complete.sql`
2. **Update database columns**: Remove/nullify FK columns in other schemas
3. **Delete API routes**: Remove all atlas API endpoints
4. **Delete app pages**: Remove atlas map/explore pages
5. **Update components**: Remove atlas references from components
6. **Delete feature code**: Remove atlas feature directory
7. **Update types**: Remove atlas types
8. **Update config**: Remove atlas from navigation/routing
9. **Test thoroughly**: Verify no broken references

## Rollback Plan

If rollback is needed:
1. Restore database from backup (before running drop script)
2. Revert code changes via git
3. Re-run migrations that create atlas schema
