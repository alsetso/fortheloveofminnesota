-- Create checkbook.payments table
-- Government payment transactions data

-- ============================================================================
-- STEP 1: Create payments table
-- ============================================================================

CREATE TABLE checkbook.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Payment data columns
  budget_period INTEGER NOT NULL,
  payment_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  agency TEXT,
  payee TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- STEP 2: Create indexes for performance
-- ============================================================================

CREATE INDEX idx_payments_budget_period ON checkbook.payments(budget_period);
CREATE INDEX idx_payments_agency ON checkbook.payments(agency) WHERE agency IS NOT NULL;
CREATE INDEX idx_payments_payee ON checkbook.payments(payee) WHERE payee IS NOT NULL;
CREATE INDEX idx_payments_amount ON checkbook.payments(payment_amount);
CREATE INDEX idx_payments_created_at ON checkbook.payments(created_at DESC);

-- ============================================================================
-- STEP 3: Create updated_at trigger
-- ============================================================================

CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON checkbook.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- STEP 4: Enable Row Level Security
-- ============================================================================

ALTER TABLE checkbook.payments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 5: Create RLS policies (public read, service_role write)
-- ============================================================================

-- Policy: Anyone can view payments
CREATE POLICY "Anyone can view payments"
  ON checkbook.payments
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Policy: Service role can manage payments
CREATE POLICY "Service role can manage payments"
  ON checkbook.payments
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- STEP 6: Grant permissions
-- ============================================================================

GRANT SELECT ON checkbook.payments TO anon, authenticated;
GRANT ALL ON checkbook.payments TO service_role;

-- ============================================================================
-- STEP 7: Create public schema view for Supabase client access
-- ============================================================================

CREATE OR REPLACE VIEW public.payments AS SELECT * FROM checkbook.payments;

-- Grant permissions on public view
GRANT SELECT ON public.payments TO anon, authenticated;
GRANT ALL ON public.payments TO service_role;

-- ============================================================================
-- STEP 8: Add comments
-- ============================================================================

COMMENT ON TABLE checkbook.payments IS 'Government payment transactions by period, agency, and payee';
COMMENT ON COLUMN checkbook.payments.budget_period IS 'Budget period year (e.g., 2021-2026)';
COMMENT ON COLUMN checkbook.payments.payment_amount IS 'Amount of the payment transaction';
COMMENT ON COLUMN checkbook.payments.agency IS 'Agency making the payment';
COMMENT ON COLUMN checkbook.payments.payee IS 'Entity receiving the payment (nullable, only in some payment formats)';

