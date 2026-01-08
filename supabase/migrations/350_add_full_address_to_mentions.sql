-- Add full_address column to mentions table
ALTER TABLE public.mentions
  ADD COLUMN IF NOT EXISTS full_address TEXT;

-- Add index for full_address searches
CREATE INDEX IF NOT EXISTS idx_mentions_full_address ON public.mentions(full_address) WHERE full_address IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.mentions.full_address IS 'Full address string from reverse geocoding (e.g., "123 Main St, Minneapolis, MN 55401")';

