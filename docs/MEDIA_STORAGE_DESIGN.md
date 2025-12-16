# Post Media Storage Design - Normalized Approach

## Current Issues with JSONB Array Approach

1. **Query Limitations**: Can't easily query "all posts with videos" or "posts with more than 3 images"
2. **No Relationships**: Can't reference individual media items
3. **No Metadata**: Hard to add per-media metadata (alt text, captions, dimensions, etc.)
4. **Performance**: JSONB queries are slower than normalized tables
5. **Indexing**: Can't efficiently index individual media items
6. **Updates**: Updating a single media item requires rewriting entire array

## Recommended Solution: Separate `post_media` Table

### Schema Design

```sql
-- Media type enum
CREATE TYPE public.media_type AS ENUM (
  'image',
  'video'
);

-- Post media table
CREATE TABLE public.post_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  
  -- Media identification
  media_type public.media_type NOT NULL,
  storage_path TEXT NOT NULL, -- Path in Supabase storage
  public_url TEXT NOT NULL, -- Full public URL
  
  -- Media metadata
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL, -- e.g., 'image/jpeg', 'video/mp4'
  file_size BIGINT, -- Size in bytes
  width INTEGER, -- For images/videos
  height INTEGER, -- For images/videos
  duration INTEGER, -- For videos (seconds)
  
  -- Thumbnails (for videos)
  thumbnail_url TEXT,
  thumbnail_path TEXT,
  
  -- User metadata
  caption TEXT,
  alt_text TEXT, -- For accessibility
  display_order INTEGER NOT NULL DEFAULT 0, -- Order in gallery
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT post_media_file_size_positive CHECK (file_size IS NULL OR file_size > 0),
  CONSTRAINT post_media_dimensions_positive CHECK (
    (width IS NULL OR width > 0) AND 
    (height IS NULL OR height > 0)
  ),
  CONSTRAINT post_media_duration_positive CHECK (duration IS NULL OR duration > 0),
  CONSTRAINT post_media_display_order_non_negative CHECK (display_order >= 0)
);

-- Indexes for performance
CREATE INDEX post_media_post_id_idx ON public.post_media(post_id);
CREATE INDEX post_media_type_idx ON public.post_media(media_type);
CREATE INDEX post_media_display_order_idx ON public.post_media(post_id, display_order);
CREATE INDEX post_media_created_at_idx ON public.post_media(created_at DESC);

-- RLS Policies
ALTER TABLE public.post_media ENABLE ROW LEVEL SECURITY;

-- Anyone can view media for public posts
CREATE POLICY "Public can view post media"
  ON public.post_media
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.posts
      WHERE posts.id = post_media.post_id
      AND posts.visibility = 'public'
    )
  );

-- Authenticated users can view media for their own posts or posts they have access to
CREATE POLICY "Users can view accessible post media"
  ON public.post_media
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.posts
      WHERE posts.id = post_media.post_id
      AND (
        posts.account_id = auth.uid()::text::uuid -- Own posts
        OR posts.visibility = 'public' -- Public posts
        OR posts.visibility = 'members_only' -- Members-only posts (if user is member)
      )
    )
  );

-- Users can insert media for their own posts
CREATE POLICY "Users can insert media for own posts"
  ON public.post_media
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.posts
      WHERE posts.id = post_media.post_id
      AND posts.account_id IN (
        SELECT id FROM public.accounts WHERE user_id = auth.uid()
      )
    )
  );

-- Users can update media for their own posts
CREATE POLICY "Users can update media for own posts"
  ON public.post_media
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.posts
      WHERE posts.id = post_media.post_id
      AND posts.account_id IN (
        SELECT id FROM public.accounts WHERE user_id = auth.uid()
      )
    )
  );

-- Users can delete media for their own posts
CREATE POLICY "Users can delete media for own posts"
  ON public.post_media
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.posts
      WHERE posts.id = post_media.post_id
      AND posts.account_id IN (
        SELECT id FROM public.accounts WHERE user_id = auth.uid()
      )
    )
  );
```

### Migration Strategy

**Option 1: Keep `images` column temporarily**
- Add `post_media` table
- Migrate existing JSONB data to normalized table
- Keep `images` column for backward compatibility
- Gradually migrate code to use `post_media`
- Remove `images` column later

**Option 2: Clean break**
- Create `post_media` table
- Migrate all existing data
- Update all code immediately
- Remove `images` column

### Benefits

1. **Queryable**: 
   ```sql
   -- Get all posts with videos
   SELECT DISTINCT post_id FROM post_media WHERE media_type = 'video';
   
   -- Get posts with more than 3 images
   SELECT post_id, COUNT(*) 
   FROM post_media 
   WHERE media_type = 'image' 
   GROUP BY post_id 
   HAVING COUNT(*) > 3;
   ```

2. **Metadata Support**: Can add captions, alt text, dimensions per media item

3. **Ordering**: `display_order` allows custom gallery ordering

4. **Performance**: Indexed foreign keys, faster queries

5. **Relationships**: Can reference media items in other tables

6. **Updates**: Update individual items without touching entire array

### API Changes

**Before (JSONB)**:
```typescript
{
  images: [
    { url: "...", filename: "...", type: "image/jpeg" }
  ]
}
```

**After (Normalized)**:
```typescript
// Create post first, then add media
const post = await createPost({ title, content });
await addMediaToPost(post.id, [
  { 
    media_type: 'image',
    storage_path: '...',
    public_url: '...',
    filename: '...',
    mime_type: 'image/jpeg',
    display_order: 0
  }
]);
```

### Hybrid Approach (Recommended for Migration)

Keep both during transition:

```sql
-- Keep images column for backward compatibility
ALTER TABLE public.posts 
  ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;

-- Add trigger to sync JSONB from normalized table
CREATE OR REPLACE FUNCTION sync_post_images_jsonb()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.posts
  SET images = (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', id,
        'url', public_url,
        'filename', filename,
        'type', mime_type,
        'thumbnail_url', thumbnail_url,
        'media_type', media_type,
        'caption', caption,
        'alt_text', alt_text
      ) ORDER BY display_order
    )
    FROM public.post_media
    WHERE post_id = NEW.post_id
  )
  WHERE id = NEW.post_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_images_on_media_change
  AFTER INSERT OR UPDATE OR DELETE ON public.post_media
  FOR EACH ROW
  EXECUTE FUNCTION sync_post_images_jsonb();
```

This allows:
- New code uses `post_media` table
- Old code still works with `images` JSONB
- Automatic sync between both
- Gradual migration

### Alternative: Keep JSONB but Improve Structure

If you want to keep JSONB but make it better:

```typescript
// Better JSONB structure
{
  media: [
    {
      id: "uuid",
      type: "image" | "video",
      url: "...",
      storage_path: "...",
      filename: "...",
      mime_type: "...",
      width: 1920,
      height: 1080,
      duration: 120, // for videos
      thumbnail_url: "...",
      caption: "...",
      alt_text: "...",
      display_order: 0,
      created_at: "..."
    }
  ]
}
```

**Pros**: No migration needed, simpler
**Cons**: Still has query limitations, harder to update individual items

## Recommendation

**Use the normalized `post_media` table approach** with the hybrid migration strategy:
1. Better long-term scalability
2. More queryable and performant
3. Supports rich metadata
4. Allows gradual migration
5. Better for analytics and reporting




