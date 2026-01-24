-- Add image column to groups table

-- ============================================================================
-- STEP 1: Add image column if it doesn't exist
-- ============================================================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'groups' 
    AND column_name = 'image'
  ) THEN
    ALTER TABLE public.groups 
      ADD COLUMN image TEXT;
    
    -- Add comment
    COMMENT ON COLUMN public.groups.image IS 
      'Image URL for the group';
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Force PostgREST schema cache refresh
-- ============================================================================

NOTIFY pgrst, 'reload schema';
