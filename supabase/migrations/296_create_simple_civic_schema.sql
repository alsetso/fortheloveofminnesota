-- Create simple civic schema with 3 tables
-- Mental model: People hold Roles at Organizations

-- ============================================================================
-- STEP 1: Create civic schema
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS civic;

-- ============================================================================
-- STEP 2: Create orgs table
-- ============================================================================

CREATE TABLE civic.orgs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES civic.orgs(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  org_type TEXT NOT NULL CHECK (org_type IN ('branch', 'agency', 'department', 'court')),
  description TEXT,
  website TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- STEP 3: Create people table
-- ============================================================================

CREATE TABLE civic.people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  party TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- STEP 4: Create roles table
-- ============================================================================

CREATE TABLE civic.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID REFERENCES civic.people(id) ON DELETE CASCADE,
  org_id UUID REFERENCES civic.orgs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  is_current BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- STEP 5: Create indexes
-- ============================================================================

-- orgs indexes
CREATE INDEX idx_orgs_slug ON civic.orgs(slug);
CREATE INDEX idx_orgs_parent_id ON civic.orgs(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX idx_orgs_org_type ON civic.orgs(org_type);

-- people indexes
CREATE INDEX idx_people_name ON civic.people(name);
CREATE INDEX idx_people_party ON civic.people(party) WHERE party IS NOT NULL;

-- roles indexes
CREATE INDEX idx_roles_person_id ON civic.roles(person_id);
CREATE INDEX idx_roles_org_id ON civic.roles(org_id);
CREATE INDEX idx_roles_is_current ON civic.roles(is_current) WHERE is_current = TRUE;
CREATE INDEX idx_roles_dates ON civic.roles(start_date, end_date);

-- ============================================================================
-- STEP 6: Enable Row Level Security
-- ============================================================================

ALTER TABLE civic.orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic.people ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic.roles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 7: Create RLS Policies (public read, service_role write)
-- ============================================================================

-- orgs policies
CREATE POLICY "Anyone can view orgs"
  ON civic.orgs FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "Service role can manage orgs"
  ON civic.orgs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- people policies
CREATE POLICY "Anyone can view people"
  ON civic.people FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "Service role can manage people"
  ON civic.people FOR ALL TO service_role USING (true) WITH CHECK (true);

-- roles policies
CREATE POLICY "Anyone can view roles"
  ON civic.roles FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "Service role can manage roles"
  ON civic.roles FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- STEP 8: Grant permissions
-- ============================================================================

GRANT USAGE ON SCHEMA civic TO anon, authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA civic TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA civic TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA civic TO service_role;

-- ============================================================================
-- STEP 9: Create public schema views for Supabase client access
-- ============================================================================

CREATE OR REPLACE VIEW public.orgs AS SELECT * FROM civic.orgs;
CREATE OR REPLACE VIEW public.people AS SELECT * FROM civic.people;
CREATE OR REPLACE VIEW public.roles AS SELECT * FROM civic.roles;

-- Grant permissions on public views
GRANT SELECT ON public.orgs TO anon, authenticated;
GRANT SELECT ON public.people TO anon, authenticated;
GRANT SELECT ON public.roles TO anon, authenticated;

GRANT ALL ON public.orgs TO service_role;
GRANT ALL ON public.people TO service_role;
GRANT ALL ON public.roles TO service_role;

