-- Create contracts table in atlas schema
-- Contracts represent government contract data from the checkbook system

-- ============================================================================
-- STEP 1: Create contracts table in atlas schema
-- ============================================================================

CREATE TABLE atlas.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Contract identification
  contract_id TEXT NOT NULL,
  
  -- Contract details
  agency TEXT,
  payee TEXT,
  contract_type TEXT,
  
  -- Dates
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  
  -- Financial
  total_contract_amount NUMERIC(15, 2),
  
  -- Metadata
  drill TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT contracts_contract_id_unique UNIQUE (contract_id)
);

-- ============================================================================
-- STEP 2: Create indexes
-- ============================================================================

CREATE INDEX idx_contracts_contract_id ON atlas.contracts(contract_id);
CREATE INDEX idx_contracts_agency ON atlas.contracts(agency);
CREATE INDEX idx_contracts_payee ON atlas.contracts(payee);
CREATE INDEX idx_contracts_contract_type ON atlas.contracts(contract_type);
CREATE INDEX idx_contracts_start_date ON atlas.contracts(start_date);
CREATE INDEX idx_contracts_end_date ON atlas.contracts(end_date);
CREATE INDEX idx_contracts_total_amount ON atlas.contracts(total_contract_amount);
CREATE INDEX idx_contracts_drill ON atlas.contracts(drill);
CREATE INDEX idx_contracts_date_range ON atlas.contracts(start_date, end_date) WHERE start_date IS NOT NULL AND end_date IS NOT NULL;

-- ============================================================================
-- STEP 3: Create updated_at trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION atlas.update_contracts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_contracts_updated_at
  BEFORE UPDATE ON atlas.contracts
  FOR EACH ROW
  EXECUTE FUNCTION atlas.update_contracts_updated_at();

-- ============================================================================
-- STEP 4: Enable Row Level Security
-- ============================================================================

ALTER TABLE atlas.contracts ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 5: Create RLS Policies
-- ============================================================================

-- Policy: Anyone can read contracts (public data)
CREATE POLICY "Anyone can view contracts"
  ON atlas.contracts
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Policy: Admins can insert contracts
CREATE POLICY "Admins can insert contracts"
  ON atlas.contracts
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Policy: Admins can update contracts
CREATE POLICY "Admins can update contracts"
  ON atlas.contracts
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Policy: Admins can delete contracts
CREATE POLICY "Admins can delete contracts"
  ON atlas.contracts
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- STEP 6: Grant permissions
-- ============================================================================

GRANT SELECT ON atlas.contracts TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON atlas.contracts TO authenticated;
GRANT ALL ON atlas.contracts TO service_role;

-- ============================================================================
-- STEP 7: Create public view for Supabase client compatibility
-- ============================================================================

CREATE OR REPLACE VIEW public.contracts AS
SELECT * FROM atlas.contracts;

GRANT SELECT ON public.contracts TO authenticated, anon;

-- ============================================================================
-- STEP 8: Create INSTEAD OF triggers for view updates
-- ============================================================================

CREATE OR REPLACE FUNCTION public.contracts_insert_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO atlas.contracts (
    contract_id,
    agency,
    payee,
    contract_type,
    start_date,
    end_date,
    total_contract_amount,
    drill,
    created_at,
    updated_at
  )
  VALUES (
    NEW.contract_id,
    NEW.agency,
    NEW.payee,
    NEW.contract_type,
    NEW.start_date,
    NEW.end_date,
    NEW.total_contract_amount,
    NEW.drill,
    COALESCE(NEW.created_at, NOW()),
    COALESCE(NEW.updated_at, NOW())
  )
  RETURNING * INTO NEW;
  RETURN NEW;
END;
$$;

CREATE TRIGGER contracts_instead_of_insert
  INSTEAD OF INSERT ON public.contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.contracts_insert_trigger();

CREATE OR REPLACE FUNCTION public.contracts_update_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE atlas.contracts
  SET
    contract_id = COALESCE(NEW.contract_id, OLD.contract_id),
    agency = NEW.agency,
    payee = NEW.payee,
    contract_type = NEW.contract_type,
    start_date = NEW.start_date,
    end_date = NEW.end_date,
    total_contract_amount = NEW.total_contract_amount,
    drill = NEW.drill,
    updated_at = NOW()
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER contracts_instead_of_update
  INSTEAD OF UPDATE ON public.contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.contracts_update_trigger();

CREATE OR REPLACE FUNCTION public.contracts_delete_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM atlas.contracts WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER contracts_instead_of_delete
  INSTEAD OF DELETE ON public.contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.contracts_delete_trigger();

-- Grant INSERT, UPDATE, DELETE on view (for triggers)
GRANT INSERT, UPDATE, DELETE ON public.contracts TO authenticated;

-- ============================================================================
-- STEP 9: Add comments
-- ============================================================================

COMMENT ON TABLE atlas.contracts IS 'Government contracts and financial transaction data from the checkbook system';
COMMENT ON COLUMN atlas.contracts.id IS 'Unique contract record ID (UUID)';
COMMENT ON COLUMN atlas.contracts.contract_id IS 'Government contract identifier';
COMMENT ON COLUMN atlas.contracts.agency IS 'Agency associated with the contract';
COMMENT ON COLUMN atlas.contracts.payee IS 'Entity receiving payment for the contract';
COMMENT ON COLUMN atlas.contracts.contract_type IS 'Type of contract (e.g., PT - Prof/Tech Services Contract)';
COMMENT ON COLUMN atlas.contracts.start_date IS 'Contract start date';
COMMENT ON COLUMN atlas.contracts.end_date IS 'Contract end date';
COMMENT ON COLUMN atlas.contracts.total_contract_amount IS 'Total monetary value of the contract';
COMMENT ON COLUMN atlas.contracts.drill IS 'Drill-down category (typically "Payments")';
COMMENT ON VIEW public.contracts IS 'View pointing to atlas.contracts for Supabase client compatibility';

-- ============================================================================
-- STEP 10: Verification report
-- ============================================================================

DO $$
DECLARE
  v_contracts_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_contracts_count FROM atlas.contracts;
  
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE '  Contracts table created in atlas schema';
  RAISE NOTICE '  Public view created for Supabase client compatibility';
  RAISE NOTICE '  RLS policies configured';
  RAISE NOTICE '  Current contract count: %', v_contracts_count;
END;
$$;

