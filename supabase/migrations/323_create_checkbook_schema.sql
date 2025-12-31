-- Create checkbook schema and contracts table
-- Government contracts and financial transaction data

-- ============================================================================
-- STEP 1: Create checkbook schema
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS checkbook;

-- ============================================================================
-- STEP 2: Create contracts table
-- ============================================================================

CREATE TABLE checkbook.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Contract data columns
  agency TEXT,
  payee TEXT NOT NULL,
  contract_type TEXT NOT NULL,
  contract_id TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  drill TEXT NOT NULL,
  total_contract_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- STEP 3: Create indexes for performance
-- ============================================================================

CREATE INDEX idx_contracts_contract_id ON checkbook.contracts(contract_id);
CREATE INDEX idx_contracts_agency ON checkbook.contracts(agency) WHERE agency IS NOT NULL;
CREATE INDEX idx_contracts_payee ON checkbook.contracts(payee);
CREATE INDEX idx_contracts_contract_type ON checkbook.contracts(contract_type);
CREATE INDEX idx_contracts_dates ON checkbook.contracts(start_date, end_date);
CREATE INDEX idx_contracts_amount ON checkbook.contracts(total_contract_amount);
CREATE INDEX idx_contracts_created_at ON checkbook.contracts(created_at DESC);
CREATE INDEX idx_contracts_drill ON checkbook.contracts(drill);
CREATE UNIQUE INDEX idx_contracts_contract_id_unique ON checkbook.contracts(contract_id) WHERE contract_id IS NOT NULL;

-- ============================================================================
-- STEP 4: Create updated_at trigger
-- ============================================================================

CREATE TRIGGER update_contracts_updated_at
  BEFORE UPDATE ON checkbook.contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- STEP 5: Enable Row Level Security
-- ============================================================================

ALTER TABLE checkbook.contracts ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 6: Create RLS policies (public read, service_role write)
-- ============================================================================

-- Policy: Anyone can view contracts
CREATE POLICY "Anyone can view contracts"
  ON checkbook.contracts
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Policy: Service role can manage contracts
CREATE POLICY "Service role can manage contracts"
  ON checkbook.contracts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- STEP 7: Grant permissions
-- ============================================================================

GRANT USAGE ON SCHEMA checkbook TO anon, authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA checkbook TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA checkbook TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA checkbook TO service_role;

-- ============================================================================
-- STEP 8: Create public schema view for Supabase client access
-- ============================================================================

CREATE OR REPLACE VIEW public.contracts AS SELECT * FROM checkbook.contracts;

-- Grant permissions on public view
GRANT SELECT ON public.contracts TO anon, authenticated;
GRANT ALL ON public.contracts TO service_role;

-- ============================================================================
-- STEP 9: Add comments
-- ============================================================================

COMMENT ON SCHEMA checkbook IS 'Government contracts and financial transaction data';
COMMENT ON TABLE checkbook.contracts IS 'Government contracts with agency, payee, dates, and amounts';
COMMENT ON COLUMN checkbook.contracts.agency IS 'Agency associated with the contract';
COMMENT ON COLUMN checkbook.contracts.payee IS 'Entity receiving payment for the contract';
COMMENT ON COLUMN checkbook.contracts.contract_type IS 'Type of contract (e.g., PT - Prof/Tech Services Contract)';
COMMENT ON COLUMN checkbook.contracts.contract_id IS 'Unique identifier for the contract';
COMMENT ON COLUMN checkbook.contracts.start_date IS 'Beginning date of the contract';
COMMENT ON COLUMN checkbook.contracts.end_date IS 'Termination date of the contract (nullable)';
COMMENT ON COLUMN checkbook.contracts.drill IS 'Drill type (typically "Payments")';
COMMENT ON COLUMN checkbook.contracts.total_contract_amount IS 'Total monetary value of the contract';

