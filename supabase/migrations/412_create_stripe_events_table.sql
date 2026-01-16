-- Create stripe_events table to track all Stripe webhook events
-- This enables auditing, debugging, and retry logic for payment processing

-- ============================================================================
-- STEP 1: Create stripe_events table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.stripe_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Stripe event identifiers
  stripe_event_id TEXT NOT NULL UNIQUE, -- Stripe's event ID (evt_xxx)
  event_type TEXT NOT NULL, -- e.g., 'checkout.session.completed', 'invoice.paid'
  
  -- Account linkage
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  stripe_customer_id TEXT, -- Stripe customer ID (cus_xxx)
  stripe_subscription_id TEXT, -- Stripe subscription ID (sub_xxx) if applicable
  
  -- Event data
  event_data JSONB NOT NULL, -- Full event object from Stripe
  processed BOOLEAN DEFAULT false, -- Whether we successfully processed this event
  processing_error TEXT, -- Error message if processing failed
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ, -- When we successfully processed it
  retry_count INTEGER DEFAULT 0, -- Number of retry attempts
  last_retry_at TIMESTAMPTZ -- Last retry attempt timestamp
);

-- ============================================================================
-- STEP 2: Create indexes for efficient queries
-- ============================================================================

CREATE INDEX idx_stripe_events_stripe_event_id ON public.stripe_events(stripe_event_id);
CREATE INDEX idx_stripe_events_account_id ON public.stripe_events(account_id) WHERE account_id IS NOT NULL;
CREATE INDEX idx_stripe_events_customer_id ON public.stripe_events(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX idx_stripe_events_event_type ON public.stripe_events(event_type);
CREATE INDEX idx_stripe_events_processed ON public.stripe_events(processed, created_at DESC);
CREATE INDEX idx_stripe_events_created_at ON public.stripe_events(created_at DESC);
CREATE INDEX idx_stripe_events_unprocessed ON public.stripe_events(processed, retry_count) WHERE processed = false;

-- ============================================================================
-- STEP 3: Create function to link account_id from customer_id
-- ============================================================================

CREATE OR REPLACE FUNCTION public.link_stripe_event_to_account(
  p_stripe_event_id TEXT,
  p_customer_id TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_account_id UUID;
BEGIN
  -- Find account by stripe_customer_id
  SELECT id INTO v_account_id
  FROM public.accounts
  WHERE stripe_customer_id = p_customer_id
  LIMIT 1;
  
  -- Update the event with account_id if found
  IF v_account_id IS NOT NULL THEN
    UPDATE public.stripe_events
    SET account_id = v_account_id
    WHERE stripe_event_id = p_stripe_event_id
      AND account_id IS NULL;
  END IF;
  
  RETURN v_account_id;
END;
$$;

COMMENT ON FUNCTION public.link_stripe_event_to_account IS 
  'Links a Stripe event to an account by customer ID. Used to populate account_id after event creation.';

-- ============================================================================
-- STEP 4: Enable Row Level Security
-- ============================================================================

ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 5: Create RLS Policies
-- ============================================================================

-- Users can view their own account's events
CREATE POLICY "Users can view their account's events"
  ON public.stripe_events FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT id FROM public.accounts WHERE user_id = auth.uid()
    )
  );

-- Service role can do everything (for webhook processing)
CREATE POLICY "Service role can manage all events"
  ON public.stripe_events
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- STEP 6: Add comments
-- ============================================================================

COMMENT ON TABLE public.stripe_events IS 
  'Tracks all Stripe webhook events for auditing, debugging, and retry logic. Links events to accounts via customer_id.';
COMMENT ON COLUMN public.stripe_events.stripe_event_id IS 
  'Stripe event ID (evt_xxx) - unique identifier from Stripe';
COMMENT ON COLUMN public.stripe_events.account_id IS 
  'Linked account ID - populated by looking up stripe_customer_id in accounts table';
COMMENT ON COLUMN public.stripe_events.processed IS 
  'Whether the event was successfully processed and account updated';
COMMENT ON COLUMN public.stripe_events.processing_error IS 
  'Error message if processing failed - useful for debugging and retry logic';
COMMENT ON COLUMN public.stripe_events.retry_count IS 
  'Number of times we attempted to process this event - useful for retry logic';


