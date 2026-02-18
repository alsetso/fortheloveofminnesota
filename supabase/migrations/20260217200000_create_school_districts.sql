-- School district boundaries from MDE → layers.school_districts
-- 329 records (one per district), dissolved from attendance area boundaries
-- Source: Minnesota Department of Education, SY2025-26

-- ============================================================================
-- TABLE
-- ============================================================================

CREATE TABLE layers.school_districts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sd_org_id TEXT,
  form_id TEXT,
  sd_type TEXT CHECK (sd_type IN ('01', '02', '03')),
  sd_number TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  short_name TEXT,
  web_url TEXT,
  sq_miles NUMERIC,
  acres NUMERIC,
  geometry JSONB NOT NULL,
  publisher TEXT DEFAULT 'Minnesota Department of Education',
  source_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_school_districts_sd_number
  ON layers.school_districts(sd_number);

CREATE INDEX idx_school_districts_sd_type
  ON layers.school_districts(sd_type)
  WHERE sd_type IS NOT NULL;

CREATE INDEX idx_school_districts_name
  ON layers.school_districts(LOWER(name));

CREATE INDEX idx_school_districts_short_name
  ON layers.school_districts(LOWER(short_name))
  WHERE short_name IS NOT NULL;

CREATE INDEX idx_school_districts_geometry
  ON layers.school_districts USING GIN (geometry)
  WHERE geometry IS NOT NULL;

-- ============================================================================
-- TRIGGER
-- ============================================================================

CREATE TRIGGER update_school_districts_updated_at
  BEFORE UPDATE ON layers.school_districts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- COMMENT
-- ============================================================================

COMMENT ON TABLE layers.school_districts IS
  'Minnesota school district boundaries (SY2025-26). 329 independent, common, and special districts. Source: Minnesota Department of Education';

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE layers.school_districts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view school districts"
  ON layers.school_districts FOR SELECT TO authenticated, anon
  USING (true);
CREATE POLICY "Admins can insert school districts"
  ON layers.school_districts FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update school districts"
  ON layers.school_districts FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
CREATE POLICY "Admins can delete school districts"
  ON layers.school_districts FOR DELETE TO authenticated
  USING (public.is_admin());
CREATE POLICY "Service role can manage school districts"
  ON layers.school_districts FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT ON layers.school_districts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON layers.school_districts TO authenticated;
GRANT ALL ON layers.school_districts TO service_role;
