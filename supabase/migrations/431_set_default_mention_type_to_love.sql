-- Set default mention_type_id to "Love" for all mentions with null mention_type_id
-- This updates all mentions created before mention types existed (approximately 50-60 mentions)
-- to be classified as "Love" mentions

-- ============================================================================
-- STEP 1: Ensure "Love" mention type exists, create if it doesn't
-- ============================================================================

-- First, try to find an existing "Love" type (case-insensitive search)
DO $$
DECLARE
  love_type_id UUID;
BEGIN
  -- Look for existing "Love" type (case-insensitive)
  SELECT id INTO love_type_id
  FROM public.mention_types
  WHERE LOWER(name) = 'love'
  LIMIT 1;
  
  -- If not found, create it
  -- Note: Using 💕 emoji since ❤️ is already used by "Local shoutouts"
  IF love_type_id IS NULL THEN
    INSERT INTO public.mention_types (emoji, name, is_active)
    VALUES ('💕', 'Love', true)
    ON CONFLICT (name) DO UPDATE SET is_active = true
    RETURNING id INTO love_type_id;
  END IF;
  
  -- ============================================================================
  -- STEP 2: Update all mentions with null mention_type_id to use Love type
  -- ============================================================================
  
  UPDATE public.mentions
  SET mention_type_id = love_type_id
  WHERE mention_type_id IS NULL;
  
  -- Log the number of mentions updated
  RAISE NOTICE 'Updated % mentions to use Love mention type', (SELECT COUNT(*) FROM public.mentions WHERE mention_type_id = love_type_id);
END $$;

-- ============================================================================
-- STEP 3: Add comment
-- ============================================================================

COMMENT ON COLUMN public.mentions.mention_type_id IS 
  'Reference to mention_types table. Defaults to "Love" type for mentions created before mention types existed.';
