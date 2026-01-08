-- Add cover_images (array) and website columns to civic.buildings
ALTER TABLE civic.buildings
  ADD COLUMN IF NOT EXISTS cover_images TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS website TEXT;

-- Add GIN index for cover_images array lookups
CREATE INDEX IF NOT EXISTS idx_buildings_cover_images ON civic.buildings USING GIN (cover_images) WHERE array_length(cover_images, 1) > 0;

-- Update comments
COMMENT ON COLUMN civic.buildings.cover_images IS 'Array of image URLs stored in civic_building_cover storage bucket';
COMMENT ON COLUMN civic.buildings.website IS 'Website URL for the building';

-- Create storage bucket for building cover images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'civic_building_cover',
  'civic_building_cover',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for storage bucket
-- Allow anyone to view images (public bucket)
CREATE POLICY "Anyone can view building cover images"
  ON storage.objects FOR SELECT
  TO authenticated, anon
  USING (bucket_id = 'civic_building_cover');

-- Allow authenticated admins to upload images
CREATE POLICY "Admins can upload building cover images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'civic_building_cover' AND
    public.is_admin()
  );

-- Allow authenticated admins to update images
CREATE POLICY "Admins can update building cover images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'civic_building_cover' AND
    public.is_admin()
  )
  WITH CHECK (
    bucket_id = 'civic_building_cover' AND
    public.is_admin()
  );

-- Allow authenticated admins to delete images
CREATE POLICY "Admins can delete building cover images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'civic_building_cover' AND
    public.is_admin()
  );

-- Service role can manage all objects
CREATE POLICY "Service role can manage building cover images"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'civic_building_cover')
  WITH CHECK (bucket_id = 'civic_building_cover');

