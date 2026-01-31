-- Create subscriptions table for tracking Stripe subscription lifecycle
-- Includes trial_end_date for trial period tracking
-- Enables admin to manage subscriptions and track user cancel/return patterns

-- ============================================================================
-- STEP 1: Create subscriptions table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Link to accounts via stripe_customer_id (one-to-one)
  stripe_customer_id TEXT NOT NULL UNIQUE,
  
  -- Subscription data from Stripe
  subscription_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  price_id TEXT NOT NULL,
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  trial_end_date TIMESTAMP WITH TIME ZONE, -- Trial end date from Stripe
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  
  -- Payment method card data (nullable)
  card_brand TEXT,
  card_last4 TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- STEP 2: Create indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id ON public.subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_subscription_id ON public.subscriptions(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_price_id ON public.subscriptions(price_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_trial_end_date 
  ON public.subscriptions(trial_end_date) 
  WHERE trial_end_date IS NOT NULL;

-- ============================================================================
-- STEP 3: Create updated_at trigger
-- ============================================================================

-- Ensure update_updated_at_column function exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_subscriptions_updated_at 
    BEFORE UPDATE ON public.subscriptions 
    FOR EACH ROW 
    EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- STEP 4: Enable Row Level Security
-- ============================================================================

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 5: Create RLS policies
-- ============================================================================

-- Users can view their own subscription (via accounts.stripe_customer_id)
CREATE POLICY "Users can view own subscription"
  ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounts
      WHERE accounts.stripe_customer_id = subscriptions.stripe_customer_id
      AND accounts.user_id = auth.uid()
    )
  );

-- Users can update their own subscription
CREATE POLICY "Users can update own subscription"
  ON public.subscriptions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounts
      WHERE accounts.stripe_customer_id = subscriptions.stripe_customer_id
      AND accounts.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.accounts
      WHERE accounts.stripe_customer_id = subscriptions.stripe_customer_id
      AND accounts.user_id = auth.uid()
    )
  );

-- Users can insert their own subscription
CREATE POLICY "Users can insert own subscription"
  ON public.subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.accounts
      WHERE accounts.stripe_customer_id = subscriptions.stripe_customer_id
      AND accounts.user_id = auth.uid()
    )
  );

-- Admins can view all subscriptions
CREATE POLICY "Admins can view all subscriptions"
  ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Admins can update all subscriptions
CREATE POLICY "Admins can update all subscriptions"
  ON public.subscriptions
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Admins can insert subscriptions
CREATE POLICY "Admins can insert subscriptions"
  ON public.subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Service role can do everything (for webhook processing)
CREATE POLICY "Service role can manage all subscriptions"
  ON public.subscriptions
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- STEP 6: Grant permissions
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO service_role;

-- ============================================================================
-- STEP 7: Add comments
-- ============================================================================

COMMENT ON TABLE public.subscriptions IS 'Stripe subscription data - one-to-one with accounts via stripe_customer_id. Tracks subscription lifecycle for cancel/return patterns.';
COMMENT ON COLUMN public.subscriptions.id IS 'Unique subscription record ID (UUID)';
COMMENT ON COLUMN public.subscriptions.stripe_customer_id IS 'Stripe customer ID - links to accounts.stripe_customer_id (unique, one-to-one)';
COMMENT ON COLUMN public.subscriptions.subscription_id IS 'Stripe subscription ID (unique)';
COMMENT ON COLUMN public.subscriptions.status IS 'Subscription status from Stripe (active, canceled, past_due, trialing, etc.)';
COMMENT ON COLUMN public.subscriptions.price_id IS 'Stripe price ID for the subscription - maps to billing.plans via get_plan_slug_from_price_id()';
COMMENT ON COLUMN public.subscriptions.current_period_end IS 'Current billing period end timestamp';
COMMENT ON COLUMN public.subscriptions.current_period_start IS 'Current billing period start timestamp';
COMMENT ON COLUMN public.subscriptions.trial_end_date IS 'Trial end date from Stripe subscription.trial_end. NULL if subscription has no trial period.';
COMMENT ON COLUMN public.subscriptions.cancel_at_period_end IS 'Whether subscription is set to cancel at period end';
COMMENT ON COLUMN public.subscriptions.card_brand IS 'Card brand from default payment method (e.g., visa, mastercard)';
COMMENT ON COLUMN public.subscriptions.card_last4 IS 'Last 4 digits of card from default payment method';
COMMENT ON COLUMN public.subscriptions.created_at IS 'Record creation timestamp';
COMMENT ON COLUMN public.subscriptions.updated_at IS 'Last update timestamp (auto-updated)';
