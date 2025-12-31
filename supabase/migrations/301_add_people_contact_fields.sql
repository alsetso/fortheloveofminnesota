-- Add contact and district fields to civic.people table
-- For storing senator/representative contact information

-- ============================================================================
-- STEP 1: Add new columns
-- ============================================================================

ALTER TABLE civic.people
  ADD COLUMN IF NOT EXISTS district TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS headshot_url TEXT;

-- ============================================================================
-- STEP 2: Create indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_people_district ON civic.people(district) WHERE district IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_people_email ON civic.people(email) WHERE email IS NOT NULL;

-- ============================================================================
-- STEP 3: Update public view
-- ============================================================================

-- The public view will automatically include the new columns
-- No explicit update needed as it uses SELECT *
