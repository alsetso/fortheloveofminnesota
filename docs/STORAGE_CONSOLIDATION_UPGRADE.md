# Storage Consolidation Upgrade - Complete Guide

## What Just Happened

✅ **Created 2 unified storage buckets:**
- `posts-media` - For all post-related media (images, videos, screenshots)
- `pins-media` - For all pin/map pin media (images, videos)

✅ **Old buckets remain active** - Zero data loss risk
- `feed-images` → Will migrate to `posts-media`
- `map-pins-media` → Will migrate to `pins-media`
- `mentions-media` → Will migrate to `pins-media`
- `pins-media` (old) → Will migrate to `pins-media` (new)
- `user-map-video-storage` → Will migrate to `pins-media`

## The Upgrade Path

### Phase 1: ✅ COMPLETE - New Buckets Created
- Created `posts-media` and `pins-media` buckets
- Set up RLS policies (public read, user upload/update/delete)
- Old buckets still work - nothing breaks

### Phase 2: Code Migration (Next)
Update application code to use new bucket names:
- **Posts**: `feed-images` → `posts-media`
- **Pins**: `map-pins-media`, `mentions-media`, `pins-media`, `user-map-video-storage` → `pins-media`

**Path Structure:**
- Posts: `{user_id}/posts/{post_id}/{filename}`
- Pins: `{user_id}/pins/{pin_id}/{filename}`

### Phase 3: File Migration (When Ready)
Use Supabase Storage API to copy files from old buckets to new buckets:
```typescript
// Example migration script (run separately)
const oldFiles = await supabase.storage.from('feed-images').list();
for (const file of oldFiles) {
  // Copy to new bucket
  await supabase.storage.from('posts-media').copy(file.name, file.name);
}
```

### Phase 4: Cleanup (After Verification)
Once all files migrated and code updated:
- Drop old bucket policies
- Optionally drop old buckets (or keep as backup)

## Benefits

1. **Simplified Naming**: Clear, consistent `{entity}-media` pattern
2. **Easier Maintenance**: 2 buckets instead of 5+
3. **Better Organization**: Logical separation (posts vs pins)
4. **Future-Proof**: Easy to add new media types
5. **No Breaking Changes**: Old buckets still work during transition

## What's Protected

✅ **Account images** - Not touched (avatars, profile-images, cover-photos, logos)
✅ **Existing media** - All old buckets remain active
✅ **Public access** - New buckets have same public read policies
✅ **User permissions** - Same upload/update/delete rules

## Next Steps

1. **Update constants** - Change bucket names in code
2. **Test new buckets** - Verify uploads work
3. **Migrate files** - Copy from old to new buckets
4. **Update URLs** - Change references in database if needed
5. **Monitor** - Ensure everything works before cleanup

## Bucket Comparison

| Old Bucket | New Bucket | Status |
|------------|------------|--------|
| `feed-images` | `posts-media` | ✅ Ready to migrate |
| `map-pins-media` | `pins-media` | ✅ Ready to migrate |
| `mentions-media` | `pins-media` | ✅ Ready to migrate |
| `pins-media` (old) | `pins-media` (new) | ✅ Ready to migrate |
| `user-map-video-storage` | `pins-media` | ✅ Ready to migrate |

**Note**: Old buckets will continue working until you're ready to fully migrate.
