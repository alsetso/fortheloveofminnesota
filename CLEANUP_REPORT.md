# Cleanup Report

## Large Files Cleaned Up

### Deleted:
- **Parcels GIS data**: 2.3GB (`minnesota_gov/GIS/Parcels/`)
- **Roads GIS data**: 530MB (`minnesota_gov/GIS/Road/`)

### Kept:
- **Water GIS data**: 1.7GB (`minnesota_gov/GIS/Water/`)
- **Water migration**: `411_create_water_features_table.sql`

**Total space freed**: ~2.8GB

## Supabase Migrations Analysis

### Current Status:
- **Total migrations**: 492 files
- **Total size**: 3.5MB
- **Water migration (411)**: ✅ Kept

### Issues Found:

1. **Duplicate Migration Numbers** (23 duplicates found):
   - 002, 020, 112, 145, 199, 231, 240, 241, 242, 284, 295, 302, 317, 323, 338, 339, 340, 341, 482, 491, 492, 493, 515
   
   Example duplicates:
   - `482_add_category_to_feature_limits_functions.sql` and `482_add_map_id_to_mentions.sql`
   - `491_fix_map_members_insert_rls_allow_managers_to_add_members.sql` and `491_unify_mentions_into_map_pins.sql`
   - `492_complete_mentions_to_map_pins_migration.sql` and `492_fix_map_membership_requests_update_rls_allow_all_accounts.sql`
   - `493_add_join_map_auto_approve_function.sql` and `493_update_analytics_for_map_pins.sql`
   - `515_add_plan_slug_from_price_id_function.sql` and `515_add_recent_account_activity_function.sql`

2. **Fix/Drop/Remove Migrations**: 103 migrations that fix, drop, or remove things
   - These may be redundant if the issues were already resolved
   - Some drop tables/columns that no longer exist

### Recommendations:

⚠️ **IMPORTANT**: Before deleting migrations, ensure they haven't been applied to production!

1. **For duplicate migrations**: Rename one of each duplicate pair to a higher number (e.g., 521, 522, etc.) to maintain order

2. **For old migrations**: If all migrations are local/dev only and haven't been applied to production, you could:
   - Consolidate old migrations (001-400) into a single baseline migration
   - Keep only migrations from the last major refactor forward
   - Keep migration 411 (water features) as requested

3. **Safe to remove** (if not applied to production):
   - Duplicate numbered migrations (keep the later/complete version)
   - Old fix migrations that were superseded by later migrations
   - Drop migrations for tables/columns that were never created

### Next Steps:

1. Check which migrations have been applied to production:
   ```bash
   supabase migration list --linked
   ```

2. If migrations are local-only, consider consolidating old ones into a baseline

3. Fix duplicate migration numbers by renaming

4. Remove redundant fix/drop migrations that are no longer needed
