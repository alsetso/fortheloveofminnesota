-- Create checkbook.payroll table
-- Government employee payroll and earnings data

-- ============================================================================
-- STEP 1: Create payroll table
-- ============================================================================

CREATE TABLE checkbook.payroll (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Employee identification
  temporary_id TEXT NOT NULL,
  record_nbr INTEGER,
  
  -- Employee information
  employee_name TEXT,
  agency_nbr TEXT,
  agency_name TEXT,
  department_nbr TEXT,
  department_name TEXT,
  branch_code TEXT,
  branch_name TEXT,
  
  -- Job information
  job_code TEXT,
  job_title TEXT,
  location_nbr TEXT,
  location_name TEXT,
  location_county_name TEXT,
  
  -- Employment classification
  reg_temp_code TEXT,
  reg_temp_desc TEXT,
  classified_code TEXT,
  classified_desc TEXT,
  
  -- Employment dates (stored as integers - Excel serial dates)
  original_hire_date INTEGER,
  last_hire_date TEXT, -- Can be integer or '-'
  job_entry_date INTEGER,
  
  -- Employment status
  full_part_time_code TEXT,
  full_part_time_desc TEXT,
  active_on_june_30 TEXT, -- 'YES' or 'NO'
  
  -- Compensation information
  salary_plan_grid TEXT,
  salary_grade_range INTEGER,
  max_salary_step INTEGER,
  compensation_rate NUMERIC(15, 2),
  comp_frequency_code TEXT,
  comp_frequency_desc TEXT,
  position_fte NUMERIC(5, 2),
  
  -- Bargaining unit
  bargaining_unit_nbr INTEGER,
  bargaining_unit_name TEXT,
  
  -- Earnings (from EARNINGS sheet)
  regular_wages NUMERIC(15, 2) NOT NULL DEFAULT 0,
  overtime_wages NUMERIC(15, 2) NOT NULL DEFAULT 0,
  other_wages NUMERIC(15, 2) NOT NULL DEFAULT 0,
  total_wages NUMERIC(15, 2) NOT NULL DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- STEP 2: Create indexes for performance
-- ============================================================================

CREATE INDEX idx_payroll_temporary_id ON checkbook.payroll(temporary_id);
CREATE INDEX idx_payroll_employee_name ON checkbook.payroll(employee_name) WHERE employee_name IS NOT NULL;
CREATE INDEX idx_payroll_agency_nbr ON checkbook.payroll(agency_nbr) WHERE agency_nbr IS NOT NULL;
CREATE INDEX idx_payroll_agency_name ON checkbook.payroll(agency_name) WHERE agency_name IS NOT NULL;
CREATE INDEX idx_payroll_department_name ON checkbook.payroll(department_name) WHERE department_name IS NOT NULL;
CREATE INDEX idx_payroll_job_code ON checkbook.payroll(job_code) WHERE job_code IS NOT NULL;
CREATE INDEX idx_payroll_job_title ON checkbook.payroll(job_title) WHERE job_title IS NOT NULL;
CREATE INDEX idx_payroll_location_county ON checkbook.payroll(location_county_name) WHERE location_county_name IS NOT NULL;
CREATE INDEX idx_payroll_total_wages ON checkbook.payroll(total_wages);
CREATE INDEX idx_payroll_created_at ON checkbook.payroll(created_at DESC);

-- ============================================================================
-- STEP 3: Create updated_at trigger
-- ============================================================================

CREATE TRIGGER update_payroll_updated_at
  BEFORE UPDATE ON checkbook.payroll
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- STEP 4: Enable Row Level Security
-- ============================================================================

ALTER TABLE checkbook.payroll ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 5: Create RLS policies (public read, service_role write)
-- ============================================================================

-- Policy: Anyone can view payroll
CREATE POLICY "Anyone can view payroll"
  ON checkbook.payroll
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Policy: Service role can manage payroll
CREATE POLICY "Service role can manage payroll"
  ON checkbook.payroll
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- STEP 6: Grant permissions
-- ============================================================================

GRANT SELECT ON checkbook.payroll TO anon, authenticated;
GRANT ALL ON checkbook.payroll TO service_role;

-- ============================================================================
-- STEP 7: Create public schema view for Supabase client access
-- ============================================================================

CREATE OR REPLACE VIEW public.payroll AS SELECT * FROM checkbook.payroll;

-- Grant permissions on public view
GRANT SELECT ON public.payroll TO anon, authenticated;
GRANT ALL ON public.payroll TO service_role;

-- ============================================================================
-- STEP 8: Add comments
-- ============================================================================

COMMENT ON TABLE checkbook.payroll IS 'Government employee payroll and earnings data, combining HR INFO and EARNINGS data';
COMMENT ON COLUMN checkbook.payroll.temporary_id IS 'Temporary ID linking HR INFO and EARNINGS data (primary key for joining)';
COMMENT ON COLUMN checkbook.payroll.record_nbr IS 'Record number';
COMMENT ON COLUMN checkbook.payroll.employee_name IS 'Employee full name';
COMMENT ON COLUMN checkbook.payroll.agency_nbr IS 'Agency number code';
COMMENT ON COLUMN checkbook.payroll.agency_name IS 'Agency name';
COMMENT ON COLUMN checkbook.payroll.department_nbr IS 'Department number code';
COMMENT ON COLUMN checkbook.payroll.department_name IS 'Department name';
COMMENT ON COLUMN checkbook.payroll.branch_code IS 'Branch code (E, L, J)';
COMMENT ON COLUMN checkbook.payroll.branch_name IS 'Branch name (Executive, Legislative, Judicial)';
COMMENT ON COLUMN checkbook.payroll.job_code IS 'Job classification code';
COMMENT ON COLUMN checkbook.payroll.job_title IS 'Job title/description';
COMMENT ON COLUMN checkbook.payroll.location_nbr IS 'Location number code';
COMMENT ON COLUMN checkbook.payroll.location_name IS 'Location name';
COMMENT ON COLUMN checkbook.payroll.location_county_name IS 'County where location is situated';
COMMENT ON COLUMN checkbook.payroll.reg_temp_code IS 'Regular/Temporary code';
COMMENT ON COLUMN checkbook.payroll.reg_temp_desc IS 'Regular/Temporary description';
COMMENT ON COLUMN checkbook.payroll.classified_code IS 'Classified code (C, U)';
COMMENT ON COLUMN checkbook.payroll.classified_desc IS 'Classified description (Classified, Unclassified)';
COMMENT ON COLUMN checkbook.payroll.original_hire_date IS 'Original hire date (Excel serial date as integer)';
COMMENT ON COLUMN checkbook.payroll.last_hire_date IS 'Last hire date (Excel serial date as integer or "-")';
COMMENT ON COLUMN checkbook.payroll.job_entry_date IS 'Job entry date (Excel serial date as integer)';
COMMENT ON COLUMN checkbook.payroll.full_part_time_code IS 'Full/Part time code (F, P)';
COMMENT ON COLUMN checkbook.payroll.full_part_time_desc IS 'Full/Part time description';
COMMENT ON COLUMN checkbook.payroll.active_on_june_30 IS 'Whether employee was active on June 30 (YES/NO)';
COMMENT ON COLUMN checkbook.payroll.salary_plan_grid IS 'Salary plan grid code';
COMMENT ON COLUMN checkbook.payroll.salary_grade_range IS 'Salary grade range number';
COMMENT ON COLUMN checkbook.payroll.max_salary_step IS 'Maximum salary step';
COMMENT ON COLUMN checkbook.payroll.compensation_rate IS 'Compensation rate amount';
COMMENT ON COLUMN checkbook.payroll.comp_frequency_code IS 'Compensation frequency code (B, H, etc.)';
COMMENT ON COLUMN checkbook.payroll.comp_frequency_desc IS 'Compensation frequency description (Biweekly, Hourly, etc.)';
COMMENT ON COLUMN checkbook.payroll.position_fte IS 'Position FTE (Full-Time Equivalent)';
COMMENT ON COLUMN checkbook.payroll.bargaining_unit_nbr IS 'Bargaining unit number';
COMMENT ON COLUMN checkbook.payroll.bargaining_unit_name IS 'Bargaining unit name';
COMMENT ON COLUMN checkbook.payroll.regular_wages IS 'Regular wages earned';
COMMENT ON COLUMN checkbook.payroll.overtime_wages IS 'Overtime wages earned';
COMMENT ON COLUMN checkbook.payroll.other_wages IS 'Other wages earned';
COMMENT ON COLUMN checkbook.payroll.total_wages IS 'Total wages earned (regular + overtime + other)';

