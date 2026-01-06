-- Create mention_icons table for admin configuration of mention pin icons
-- Controls icon selection for mentions on the map

-- ============================================================================
-- STEP 1: Create mention_icons table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.mention_icons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identification
  slug TEXT NOT NULL UNIQUE, -- URL-friendly identifier (e.g., 'heart', 'star', 'flag')
  name TEXT NOT NULL, -- Display name (e.g., 'Heart', 'Star', 'Flag')
  description TEXT, -- Optional description
  
  -- Configuration
  icon_url TEXT NOT NULL, -- Public URL to icon image (Supabase storage or external)
  is_active BOOLEAN DEFAULT TRUE, -- Whether to show in icon selector
  
  -- Display
  display_order INTEGER DEFAULT 0, -- Order in selector (lower = first)
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT mention_icons_slug_format CHECK (slug ~ '^[a-z0-9_]+$') -- Lowercase, alphanumeric, underscores only
);

-- ============================================================================
-- STEP 2: Create indexes
-- ============================================================================

CREATE INDEX idx_mention_icons_slug ON public.mention_icons(slug);
CREATE INDEX idx_mention_icons_is_active ON public.mention_icons(is_active) WHERE is_active = true;
CREATE INDEX idx_mention_icons_display_order ON public.mention_icons(display_order);

-- ============================================================================
-- STEP 3: Add comment
-- ============================================================================

COMMENT ON TABLE public.mention_icons IS 'Configuration table for mention pin icons. Icons are selectable when creating mentions and displayed on the map.';
COMMENT ON COLUMN public.mention_icons.icon_url IS 'Public URL to the icon image. Can be Supabase storage URL or external URL.';
COMMENT ON COLUMN public.mention_icons.is_active IS 'Whether this icon should appear in the icon selector. Inactive icons are hidden but existing mentions keep their icon.';

