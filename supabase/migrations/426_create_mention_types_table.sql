-- Create mention_types table and update mentions to reference it
-- This allows mentions to be categorized by type (emoji + name)

-- ============================================================================
-- STEP 1: Create mention_types table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.mention_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emoji TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique emoji and name combinations
  CONSTRAINT mention_types_emoji_unique UNIQUE (emoji),
  CONSTRAINT mention_types_name_unique UNIQUE (name)
);

-- ============================================================================
-- STEP 2: Create indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_mention_types_name ON public.mention_types(name);
CREATE INDEX IF NOT EXISTS idx_mention_types_emoji ON public.mention_types(emoji);

-- ============================================================================
-- STEP 3: Add mention_type_id to mentions table
-- ============================================================================

ALTER TABLE public.mentions
  ADD COLUMN IF NOT EXISTS mention_type_id UUID REFERENCES public.mention_types(id) ON DELETE SET NULL;

-- Index for mention_type_id queries
CREATE INDEX IF NOT EXISTS idx_mentions_mention_type_id ON public.mentions(mention_type_id) 
  WHERE mention_type_id IS NOT NULL;

-- ============================================================================
-- STEP 4: Enable RLS on mention_types
-- ============================================================================

ALTER TABLE public.mention_types ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read mention_types (public data)
CREATE POLICY "mention_types_select"
  ON public.mention_types
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- ============================================================================
-- STEP 5: Grant permissions
-- ============================================================================

GRANT SELECT ON public.mention_types TO authenticated, anon;
-- Only service role can insert/update/delete mention_types
GRANT ALL ON public.mention_types TO service_role;

-- ============================================================================
-- STEP 6: Add comments
-- ============================================================================

COMMENT ON TABLE public.mention_types IS 'Mention type categories with emoji and name. Used to categorize mentions.';
COMMENT ON COLUMN public.mention_types.id IS 'Unique mention type ID (UUID)';
COMMENT ON COLUMN public.mention_types.emoji IS 'Emoji icon for this mention type (unique)';
COMMENT ON COLUMN public.mention_types.name IS 'Display name for this mention type (unique)';
COMMENT ON COLUMN public.mentions.mention_type_id IS 'Reference to mention_types table. Nullable - mentions may not have a type assigned.';
