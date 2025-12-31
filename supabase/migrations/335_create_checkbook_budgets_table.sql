-- Create checkbook.budgets table
-- Government budget allocation and spending data

-- ============================================================================
-- STEP 1: Create budgets table
-- ============================================================================

CREATE TABLE checkbook.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Budget data columns
  budget_period INTEGER NOT NULL,
  agency TEXT,
  fund TEXT,
  program TEXT,
  activity TEXT,
  available_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  obligated_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  spend_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  remaining_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  budget_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  budget_remaining_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- STEP 2: Create indexes for performance
-- ============================================================================

CREATE INDEX idx_budgets_budget_period ON checkbook.budgets(budget_period);
CREATE INDEX idx_budgets_agency ON checkbook.budgets(agency) WHERE agency IS NOT NULL;
CREATE INDEX idx_budgets_fund ON checkbook.budgets(fund) WHERE fund IS NOT NULL;
CREATE INDEX idx_budgets_program ON checkbook.budgets(program) WHERE program IS NOT NULL;
CREATE INDEX idx_budgets_activity ON checkbook.budgets(activity) WHERE activity IS NOT NULL;
CREATE INDEX idx_budgets_amounts ON checkbook.budgets(budget_amount, spend_amount);
CREATE INDEX idx_budgets_created_at ON checkbook.budgets(created_at DESC);

-- ============================================================================
-- STEP 3: Create updated_at trigger
-- ============================================================================

CREATE TRIGGER update_budgets_updated_at
  BEFORE UPDATE ON checkbook.budgets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- STEP 4: Enable Row Level Security
-- ============================================================================

ALTER TABLE checkbook.budgets ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 5: Create RLS policies (public read, service_role write)
-- ============================================================================

-- Policy: Anyone can view budgets
CREATE POLICY "Anyone can view budgets"
  ON checkbook.budgets
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Policy: Service role can manage budgets
CREATE POLICY "Service role can manage budgets"
  ON checkbook.budgets
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- STEP 6: Grant permissions
-- ============================================================================

GRANT SELECT ON checkbook.budgets TO anon, authenticated;
GRANT ALL ON checkbook.budgets TO service_role;

-- ============================================================================
-- STEP 7: Create public schema view for Supabase client access
-- ============================================================================

CREATE OR REPLACE VIEW public.budgets AS SELECT * FROM checkbook.budgets;

-- Grant permissions on public view
GRANT SELECT ON public.budgets TO anon, authenticated;
GRANT ALL ON public.budgets TO service_role;

-- ============================================================================
-- STEP 8: Add comments
-- ============================================================================

COMMENT ON TABLE checkbook.budgets IS 'Government budget allocations and spending by period, agency, fund, program, and activity';
COMMENT ON COLUMN checkbook.budgets.budget_period IS 'Budget period year (e.g., 2020-2026)';
COMMENT ON COLUMN checkbook.budgets.agency IS 'Agency associated with the budget';
COMMENT ON COLUMN checkbook.budgets.fund IS 'Fund category for the budget';
COMMENT ON COLUMN checkbook.budgets.program IS 'Program within the agency';
COMMENT ON COLUMN checkbook.budgets.activity IS 'Activity within the program';
COMMENT ON COLUMN checkbook.budgets.available_amount IS 'Amount available for spending';
COMMENT ON COLUMN checkbook.budgets.obligated_amount IS 'Amount obligated/committed';
COMMENT ON COLUMN checkbook.budgets.spend_amount IS 'Amount actually spent';
COMMENT ON COLUMN checkbook.budgets.remaining_amount IS 'Remaining available amount';
COMMENT ON COLUMN checkbook.budgets.budget_amount IS 'Total budgeted amount';
COMMENT ON COLUMN checkbook.budgets.budget_remaining_amount IS 'Remaining budget amount';

