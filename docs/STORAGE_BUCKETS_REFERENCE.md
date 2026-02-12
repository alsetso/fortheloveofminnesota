# Storage Buckets Reference

## New Unified Buckets (Target)

### `posts-media`
- **Purpose**: Unified bucket for all post-related media
- **Path Structure**: `{user_id}/posts/{post_id}/{filename}`
- **Replaces**: `feed-images`
- **Status**: ✅ Active, ready for new uploads

### `pins-media`
- **Purpose**: Unified bucket for all pin/map pin media (images, videos, icons)
- **Path Structure**: `{user_id}/pins/{pin_id}/{filename}`
- **Replaces**: `map-pins-media`, `mentions-media`, `pins-media` (old), `user-map-image-storage`, `user-map-video-storage`
- **Status**: ✅ Active, ready for new uploads

## Legacy Buckets (To Migrate)

### `feed-images`
- **Purpose**: Old posts media (images/videos for feed posts)
- **Migrate To**: `posts-media`
- **Status**: ⚠️ Legacy - still active, website depends on this

### `map-pins-media`
- **Purpose**: Old map pins media (photos/videos for map pins)
- **Migrate To**: `pins-media`
- **Status**: ⚠️ Legacy - still active, website depends on this

### `mentions-media`
- **Purpose**: Old mentions media (photos/videos for mentions)
- **Migrate To**: `pins-media`
- **Status**: ⚠️ Legacy - still active, website depends on this

### `user-map-image-storage`
- **Purpose**: User map pin images
- **Migrate To**: `pins-media`
- **Status**: ⚠️ Legacy - still active

### `user-map-video-storage`
- **Purpose**: User map pin videos
- **Migrate To**: `pins-media`
- **Status**: ⚠️ Legacy - still active

### `pins-media` (old)
- **Purpose**: Old pins media (legacy pins table)
- **Migrate To**: `pins-media` (new)
- **Status**: ⚠️ Legacy - may conflict with new bucket name

## Active Non-Media Buckets (Keep Separate)

### `profile-images`
- **Purpose**: User profile images
- **Path Structure**: `{user_id}/{table}/{column}/{filename}`
- **Status**: ✅ Active - keep separate

### `cover-photos`
- **Purpose**: Account cover/banner images
- **Status**: ✅ Active - keep separate

### `logos`
- **Purpose**: Business logos
- **Status**: ✅ Active - keep separate

### `project-photos`
- **Purpose**: Project documentation photos
- **Path Structure**: `{user_id}/projects/{project_id}/{filename}`
- **Status**: ✅ Active - keep separate

### `gov-people-storage`
- **Purpose**: Government people headshot photos (civic schema)
- **Path Structure**: `{person_id}/{filename}`
- **Status**: ✅ Active - keep separate

### `atlas_icons_storage`
- **Purpose**: Atlas type icons
- **Status**: ✅ Active - keep separate

### `mention_icons_storage`
- **Purpose**: Mention icon images
- **Status**: ✅ Active - keep separate

### `civic_building_cover`
- **Purpose**: Building cover images (civic schema)
- **Status**: ✅ Active - keep separate

### `id-verification-documents`
- **Purpose**: ID verification documents (private, secure)
- **Status**: ✅ Active - keep separate

## Migration Strategy

### Option 1: Bulk Migration via API Route (Recommended)
Create an admin API route that:
1. Lists all files in legacy buckets
2. Copies each file to new bucket with correct path structure
3. Updates database records with new URLs
4. Provides progress tracking

### Option 2: Supabase CLI/SQL Script
Use Supabase Storage API directly:
- More control over batch processing
- Can run as background job
- Better for large-scale migrations

### Option 3: Manual Migration (Current Approach)
- Use admin UI to migrate pins one-by-one
- Good for testing and verification
- Not scalable for bulk migration

## Recommended Approach

**Use a bulk migration API route** that:
- Processes files in batches (100-1000 at a time)
- Updates database records atomically
- Provides progress tracking
- Handles errors gracefully
- Can be paused/resumed

This gives you:
- Control over the migration process
- Ability to monitor progress
- Easy rollback if needed
- No need for external tools
