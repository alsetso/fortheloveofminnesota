-- Create civic schema for government leadership data
-- Tables: leaders, positions, jurisdictions, terms

-- ============================================================================
-- STEP 1: Create civic schema
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS civic;

-- ============================================================================
-- STEP 2: Create leaders table (who the person is)
-- ============================================================================

CREATE TABLE civic.leaders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  mn_id TEXT UNIQUE NOT NULL,              -- stable public ID (12-char random)
  full_name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,               -- for URLs
  
  party TEXT,                              -- DFL / Republican / Independent / null
  is_active BOOLEAN DEFAULT TRUE,
  
  profile_image_url TEXT,
  official_url TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- STEP 3: Create positions table (what authority role exists)
-- ============================================================================

CREATE TABLE civic.positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  title TEXT NOT NULL,                     -- Governor, Mayor, Council Member
  slug TEXT UNIQUE NOT NULL,
  
  branch TEXT,                             -- Executive / Legislative / Judicial
  level TEXT,                              -- Federal / State / County / City
  
  authority_rank INT,                      -- lower = more authority
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- STEP 4: Create jurisdictions table (where power applies)
-- ============================================================================

CREATE TABLE civic.jurisdictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  name TEXT NOT NULL,                      -- Minnesota, Minneapolis
  slug TEXT UNIQUE NOT NULL,
  
  type TEXT,                               -- State / County / City / District
  parent_id UUID REFERENCES civic.jurisdictions(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- STEP 5: Create terms table (who holds what power, where, when)
-- ============================================================================

CREATE TABLE civic.terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  leader_id UUID REFERENCES civic.leaders(id) ON DELETE CASCADE,
  position_id UUID REFERENCES civic.positions(id),
  jurisdiction_id UUID REFERENCES civic.jurisdictions(id),
  
  start_date DATE,
  end_date DATE,
  
  is_current BOOLEAN DEFAULT TRUE,
  is_leadership BOOLEAN DEFAULT FALSE,     -- Speaker, Chair, Mayor
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- STEP 6: Create indexes
-- ============================================================================

-- Leaders indexes
CREATE INDEX idx_civic_leaders_mn_id ON civic.leaders(mn_id);
CREATE INDEX idx_civic_leaders_slug ON civic.leaders(slug);
CREATE INDEX idx_civic_leaders_party ON civic.leaders(party);
CREATE INDEX idx_civic_leaders_is_active ON civic.leaders(is_active) WHERE is_active = TRUE;

-- Positions indexes
CREATE INDEX idx_civic_positions_slug ON civic.positions(slug);
CREATE INDEX idx_civic_positions_branch ON civic.positions(branch);
CREATE INDEX idx_civic_positions_level ON civic.positions(level);
CREATE INDEX idx_civic_positions_authority_rank ON civic.positions(authority_rank);

-- Jurisdictions indexes
CREATE INDEX idx_civic_jurisdictions_slug ON civic.jurisdictions(slug);
CREATE INDEX idx_civic_jurisdictions_type ON civic.jurisdictions(type);
CREATE INDEX idx_civic_jurisdictions_parent_id ON civic.jurisdictions(parent_id);

-- Terms indexes
CREATE INDEX idx_civic_terms_leader_id ON civic.terms(leader_id);
CREATE INDEX idx_civic_terms_position_id ON civic.terms(position_id);
CREATE INDEX idx_civic_terms_jurisdiction_id ON civic.terms(jurisdiction_id);
CREATE INDEX idx_civic_terms_is_current ON civic.terms(is_current) WHERE is_current = TRUE;
CREATE INDEX idx_civic_terms_is_leadership ON civic.terms(is_leadership) WHERE is_leadership = TRUE;
CREATE INDEX idx_civic_terms_dates ON civic.terms(start_date, end_date);

-- ============================================================================
-- STEP 7: Create updated_at trigger (only leaders has updated_at)
-- ============================================================================

CREATE TRIGGER update_civic_leaders_updated_at 
  BEFORE UPDATE ON civic.leaders 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- STEP 8: Enable Row Level Security
-- ============================================================================

ALTER TABLE civic.leaders ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic.jurisdictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic.terms ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 9: Create RLS Policies (public read, service_role write)
-- ============================================================================

-- Leaders policies
CREATE POLICY "Anyone can view leaders"
  ON civic.leaders FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "Service role can manage leaders"
  ON civic.leaders FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Positions policies
CREATE POLICY "Anyone can view positions"
  ON civic.positions FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "Service role can manage positions"
  ON civic.positions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Jurisdictions policies
CREATE POLICY "Anyone can view jurisdictions"
  ON civic.jurisdictions FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "Service role can manage jurisdictions"
  ON civic.jurisdictions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Terms policies
CREATE POLICY "Anyone can view terms"
  ON civic.terms FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "Service role can manage terms"
  ON civic.terms FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- STEP 10: Grant permissions
-- ============================================================================

GRANT USAGE ON SCHEMA civic TO anon, authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA civic TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA civic TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA civic TO service_role;




