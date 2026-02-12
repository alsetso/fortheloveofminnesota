# Pins Media Migration Debug Tool

## Location
`/admin/database/maps/pins`

## Purpose
Test and verify migration of legacy pin media to new `pins-media` storage bucket.

## Features

1. **Map View**: Shows pins on an interactive map
2. **Pin Selection**: Click any pin to see details
3. **Media Status**: Shows whether media is in legacy or new bucket
4. **Migration Button**: Migrates individual pin media from old buckets to `pins-media`
5. **Verification**: After migration, verify media displays correctly in modal

## How It Works

### Media Detection
- Checks if URLs contain legacy bucket names:
  - `map-pins-media`
  - `mentions-media`
  - `pins-media` (old)
  - `user-map-video-storage`

### Migration Process
1. Downloads file from legacy bucket
2. Uploads to `pins-media` with path: `{user_id}/pins/{pin_id}/{filename}`
3. Updates pin record with new URL
4. Refreshes display to show updated media

### Testing Flow
1. Navigate to `/admin/database/maps/pins`
2. Map loads with pins
3. Click a pin with legacy media (shows ⚠️ Legacy bucket)
4. Click "Migrate to pins-media" button
5. Wait for migration (shows status)
6. Pin refreshes - media should now show ✅ New bucket
7. Click pin again - verify media displays in modal

## API Endpoint

`POST /api/admin/migrate-pin-media/[pinId]`

**What it does:**
- Migrates `image_url`, `video_url`, `icon_url` from legacy buckets to `pins-media`
- Returns number of files migrated
- Updates pin record with new URLs

**Response:**
```json
{
  "success": true,
  "migrated_files": 2,
  "updates": {
    "image_url": "https://.../pins-media/...",
    "video_url": "https://.../pins-media/..."
  }
}
```

## Safety

- ✅ Old buckets remain active
- ✅ Legacy media still accessible
- ✅ Migration is per-pin (test one at a time)
- ✅ No bulk operations (safe testing)
- ✅ Can verify each migration before proceeding

## Next Steps After Testing

1. Verify migrations work correctly
2. Test media displays properly in modals
3. Once confident, create bulk migration script
4. Migrate all pins systematically
5. Update application code to use `pins-media` for new uploads
