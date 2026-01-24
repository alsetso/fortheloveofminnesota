-- Add structured map columns to posts table for map pins, areas, and screenshots
-- This migration ensures map columns exist for the map drawing feature in posts
-- Uses IF NOT EXISTS to be safe if columns already exist

-- ============================================================================
-- STEP 1: Enable PostGIS extension if not already enabled
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================================
-- STEP 2: Add map-related columns to posts table
-- ============================================================================

-- Map type: 'pin', 'area', or 'both'
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS map_type VARCHAR(10) 
    CHECK (map_type IS NULL OR map_type IN ('pin', 'area', 'both'));

-- Map geometry: Full GeoJSON geometry (Point, Polygon, or MultiPolygon)
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS map_geometry JSONB;

-- Map center: PostGIS POINT for pin location (for spatial queries)
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS map_center GEOMETRY(POINT, 4326);

-- Map hide pin: Boolean to hide pin marker on map
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS map_hide_pin BOOLEAN DEFAULT false;

-- Map screenshot: Base64 PNG or URL to cloud storage
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS map_screenshot TEXT;

-- Map bounds: PostGIS POLYGON for area bounds (for spatial queries)
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS map_bounds GEOMETRY(POLYGON, 4326);

-- ============================================================================
-- STEP 3: Create indexes for spatial queries
-- ============================================================================

-- GIST index for map_center (spatial queries for pins)
CREATE INDEX IF NOT EXISTS posts_map_center_idx 
  ON public.posts USING GIST (map_center) 
  WHERE map_center IS NOT NULL;

-- GIST index for map_bounds (spatial queries for areas)
CREATE INDEX IF NOT EXISTS posts_map_bounds_idx 
  ON public.posts USING GIST (map_bounds) 
  WHERE map_bounds IS NOT NULL;

-- Index for map_type (filtering by type)
CREATE INDEX IF NOT EXISTS posts_map_type_idx 
  ON public.posts (map_type) 
  WHERE map_type IS NOT NULL;

-- GIN index for map_geometry (JSONB queries)
CREATE INDEX IF NOT EXISTS posts_map_geometry_idx 
  ON public.posts USING GIN (map_geometry) 
  WHERE map_geometry IS NOT NULL;

-- ============================================================================
-- STEP 4: Add comments
-- ============================================================================

COMMENT ON COLUMN public.posts.map_type IS 
  'Type of map data: pin (single point), area (polygon), or both (point + polygon)';

COMMENT ON COLUMN public.posts.map_geometry IS 
  'Full GeoJSON geometry: Point, Polygon, or MultiPolygon. Includes all coordinate data.';

COMMENT ON COLUMN public.posts.map_center IS 
  'PostGIS POINT for pin location. Used for spatial queries (radius searches, etc.)';

COMMENT ON COLUMN public.posts.map_hide_pin IS 
  'If true, hide the pin marker on the map (useful for area-only posts)';

COMMENT ON COLUMN public.posts.map_screenshot IS 
  'Base64 PNG data URL or cloud storage URL for map preview image';

COMMENT ON COLUMN public.posts.map_bounds IS 
  'PostGIS POLYGON representing the bounding box of the map area. Used for spatial queries (overlap, contains, etc.)';
