-- Add location preferences JSON columns to accounts table
-- Stores user-selected boundaries: cities_and_towns, county, districts

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS cities_and_towns JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS county JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS districts JSONB DEFAULT NULL;

COMMENT ON COLUMN public.accounts.cities_and_towns IS 'User-selected cities and towns boundaries (JSON array from layers.cities_and_towns)';
COMMENT ON COLUMN public.accounts.county IS 'User-selected county boundary (JSON object from layers.counties)';
COMMENT ON COLUMN public.accounts.districts IS 'User-selected districts boundaries (JSON array from layers.districts)';

-- Create indexes for JSON queries
CREATE INDEX IF NOT EXISTS idx_accounts_cities_and_towns 
  ON public.accounts USING GIN (cities_and_towns) 
  WHERE cities_and_towns IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_accounts_county 
  ON public.accounts USING GIN (county) 
  WHERE county IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_accounts_districts 
  ON public.accounts USING GIN (districts) 
  WHERE districts IS NOT NULL;
