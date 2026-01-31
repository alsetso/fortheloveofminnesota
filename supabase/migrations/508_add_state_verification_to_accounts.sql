-- Add state verification columns to accounts table
-- Tracks whether user is currently verified to be in Minnesota

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS state_verified BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS state_verification_checked_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.accounts.state_verified IS 'Whether the user is currently verified to be in Minnesota based on geolocation check';
COMMENT ON COLUMN public.accounts.state_verification_checked_at IS 'Timestamp of the last state verification check';

-- Create index for state verification queries
CREATE INDEX IF NOT EXISTS idx_accounts_state_verified 
  ON public.accounts(state_verified) 
  WHERE state_verified IS NOT NULL;
