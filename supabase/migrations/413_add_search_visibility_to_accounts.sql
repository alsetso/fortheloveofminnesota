-- Add search_visibility column to accounts table
-- Defaults to false (off) - users must opt-in to appear in search
-- Only accounts with search_visibility = true will appear in @ mention searches

ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS search_visibility BOOLEAN NOT NULL DEFAULT false;

-- Add comment
COMMENT ON COLUMN public.accounts.search_visibility IS 
  'Controls whether account appears in @ mention searches. Defaults to false (hidden). Users must actively opt-in to appear in search results.';

-- Create index for better search performance
CREATE INDEX IF NOT EXISTS idx_accounts_search_visibility 
ON public.accounts(search_visibility) 
WHERE search_visibility = true AND username IS NOT NULL;
