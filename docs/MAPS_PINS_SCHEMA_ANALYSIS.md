# maps.pins Schema Analysis & Migration Plan

## Executive Summary

**Status**: Schema incomplete - missing critical columns causing query failures  
**Risk Level**: HIGH - Application code queries non-existent columns  
**Data Loss Risk**: MEDIUM - 60 city_id and 12 collection_id records not migrated  
**Action Required**: Immediate migration to align schemas

---

## Current State Analysis

### ✅ What's Working
- **87/87 records migrated** - All pin IDs present in both tables
- **Core fields present**: map_id, author_account_id, body, geometry, visibility, archived
- **Data integrity**: No NULL critical fields, geometry conversion successful
- **Tag migration**: mention_type_id → tag_id completed (migration 1011)

### ❌ Critical Issues

#### 1. Missing `is_active` Column (CRITICAL)
- **Impact**: 20+ API routes query `.eq('is_active', true)` → **QUERIES FAIL**
- **RLS Policy**: References `is_active = true` → **POLICY FAILS**
- **Data**: 24 inactive pins in public.map_pins (is_active = false)
- **Fix**: Add column, backfill from `NOT archived`

**Affected Routes:**
- `/api/maps/[id]/pins` (line 90)
- `/api/feed/pin-activity` (line 181)
- `/api/maps/live/mentions` (line 88)
- `/api/mentions/nearby` (line 139)
- `/api/analytics/*` (multiple)
- And 15+ more...

#### 2. Missing `city_id` Column (DATA LOSS)
- **Impact**: 60 pins lose city association
- **Use Case**: City-based filtering, grouping, analytics
- **Fix**: Add column, migrate from public.map_pins

#### 3. Missing `collection_id` Column (DATA LOSS)
- **Impact**: 12 pins lose collection association
- **Use Case**: Collection organization, profile pages
- **Fix**: Add column, migrate from public.map_pins

---

## Schema Comparison

### Column Mappings

| public.map_pins | maps.pins | Status | Notes |
|----------------|-----------|--------|-------|
| `id` | `id` | ✅ | UUID match |
| `map_id` | `map_id` | ✅ | Direct copy |
| `account_id` | `author_account_id` | ✅ | Renamed, migrated |
| `description` | `body` | ✅ | Merged with caption |
| `lat`/`lng` | `geometry` | ✅ | PostGIS Point conversion |
| `visibility` | `visibility` | ✅ | Enum → text |
| `archived` | `archived` | ✅ | Direct copy |
| `mention_type_id` | `tag_id` | ✅ | Migrated (1011) |
| `is_active` | ❌ **MISSING** | 🔴 | **CRITICAL** |
| `city_id` | ❌ **MISSING** | 🟡 | 60 records |
| `collection_id` | ❌ **MISSING** | 🟡 | 12 records |

### Data Statistics

```
Total Pins: 87
├─ Active (is_active=true): 63
├─ Inactive (is_active=false): 24
├─ With city_id: 60
├─ With collection_id: 12
└─ With description: 72
```

---

## Migration Plan

### Migration File: `1026_complete_maps_pins_schema_alignment.sql`

**Steps:**
1. ✅ Add missing columns (`is_active`, `city_id`, `collection_id`)
2. ✅ Migrate data from `public.map_pins`
3. ✅ Create indexes for performance
4. ✅ Update RLS policy with pin visibility check
5. ✅ Verification and integrity checks

**Data Migration Logic:**
- `is_active = NOT archived` (preserves soft-delete semantics)
- `city_id` → direct copy where exists
- `collection_id` → direct copy where exists

---

## RLS Policy Improvements

### Current Policy Issue
```sql
-- Current: Only checks map visibility, NOT pin visibility
map_id IN (SELECT maps.id WHERE maps.visibility = 'public' OR ...)
```

**Problem**: Non-auth users can see private pins (`only_me`) on public maps.

### Improved Policy (Included in Migration)
```sql
-- New: Checks both map AND pin visibility
is_active = true
AND archived = false
AND (
  (visibility = 'public' AND map is public/unlisted)
  OR
  (visibility = 'only_me' AND user owns pin)
)
```

**Benefits:**
- ✅ Respects pin-level privacy
- ✅ Non-auth users only see public pins
- ✅ Consistent with `public.map_pins` behavior

---

## Application Code Compatibility

### Required Updates (Post-Migration)

#### 1. Foreign Key References
**Issue**: Some queries reference `map_pins_account_id_fkey`  
**Fix**: Update to `maps_pins_author_account_id_fkey` or use direct joins

**Files to check:**
- `src/app/api/maps/[id]/pins/route.ts` (line 86)

#### 2. Query Patterns
**Current**: `.from('pins')` (assumes public schema)  
**Required**: `.schema('maps').from('pins')`

**Status**: ✅ Most routes already use `.schema('maps')`

#### 3. Type Definitions
**File**: `src/types/map-pin.ts`  
**Status**: ✅ Already includes `is_active`, `city_id`, `collection_id`

---

## Post-Migration Checklist

### Immediate (Before Deploy)
- [ ] Run migration `1026_complete_maps_pins_schema_alignment.sql`
- [ ] Verify all 87 records have `is_active` set correctly
- [ ] Verify 60 records have `city_id` migrated
- [ ] Verify 12 records have `collection_id` migrated
- [ ] Test RLS policy with non-auth user (should only see public pins)

### Short-term (This Week)
- [ ] Update any remaining `public.map_pins` references to `maps.pins`
- [ ] Verify all API routes work with new schema
- [ ] Test city-based filtering functionality
- [ ] Test collection associations on profile pages

### Long-term (Next Sprint)
- [ ] Consider deprecating `public.map_pins` table
- [ ] Update documentation with new schema
- [ ] Add monitoring for query performance with new indexes

---

## Risk Assessment

### Data Loss Risk: LOW ✅
- Migration uses `ON CONFLICT DO UPDATE` - safe to re-run
- All 87 records already exist in maps.pins
- Only adding columns, not removing

### Query Failure Risk: HIGH → LOW ✅
- **Before**: 20+ routes fail due to missing `is_active`
- **After**: All routes work correctly

### Performance Risk: LOW ✅
- New indexes improve query performance
- Composite index optimizes common query pattern

---

## Recommendations

### 1. Immediate Action
**Run migration `1026_complete_maps_pins_schema_alignment.sql`**  
This fixes critical query failures and preserves all data.

### 2. Testing Strategy
1. Run migration on staging
2. Test homepage (non-auth) - should only see public pins
3. Test authenticated user - should see own private pins
4. Verify city filtering works
5. Verify collection associations work

### 3. Monitoring
- Watch for query errors referencing `is_active`
- Monitor RLS policy performance
- Track city/collection query usage

---

## Conclusion

**Current State**: Schema incomplete, causing query failures  
**Migration**: Ready to deploy, preserves all data  
**Risk**: Low (migration is additive, safe to re-run)  
**Impact**: High (fixes 20+ broken API routes)

**Next Step**: Deploy migration `1026_complete_maps_pins_schema_alignment.sql`
