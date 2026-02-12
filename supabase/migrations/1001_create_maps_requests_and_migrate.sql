-- Create maps.requests table and migrate data from public.map_membership_requests
-- This table handles membership join requests for maps

-- ============================================================================
-- STEP 1: Create maps.requests table
-- ============================================================================

CREATE TABLE IF NOT EXISTS maps.requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id uuid NOT NULL REFERENCES maps.maps(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  
  -- Request answers (JSONB array of answers to custom questions)
  -- Format: [{"question_id": 0, "answer": "..."}, ...]
  answers jsonb DEFAULT '[]'::jsonb,
  
  -- Status
  status text NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'approved', 'rejected')),
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  
  -- Constraints: Only one pending request per map+account
  CONSTRAINT requests_unique_pending 
    UNIQUE(map_id, account_id) 
    DEFERRABLE INITIALLY DEFERRED
);

COMMENT ON TABLE maps.requests IS 'Membership join requests for maps with custom questions. Migrated from public.map_membership_requests.';
COMMENT ON COLUMN maps.requests.map_id IS 'Map this request is for. References maps.maps.id.';
COMMENT ON COLUMN maps.requests.account_id IS 'Account requesting membership. References public.accounts.id.';
COMMENT ON COLUMN maps.requests.answers IS 'JSONB array of answers to membership questions: [{"question_id": 0, "answer": "..."}].';
COMMENT ON COLUMN maps.requests.status IS 'Request status: pending (awaiting review), approved (accepted), or rejected (denied).';
COMMENT ON COLUMN maps.requests.reviewed_by_account_id IS 'Account that reviewed this request. References public.accounts.id.';

-- Create partial unique index for pending requests
CREATE UNIQUE INDEX IF NOT EXISTS idx_requests_pending 
  ON maps.requests(map_id, account_id) 
  WHERE status = 'pending';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_requests_map_id ON maps.requests(map_id);
CREATE INDEX IF NOT EXISTS idx_requests_account_id ON maps.requests(account_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON maps.requests(status) 
  WHERE status = 'pending';

-- Enable RLS
ALTER TABLE maps.requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies: maps.requests
-- Users can view requests for maps they can see
CREATE POLICY "Users can view requests for visible maps"
  ON maps.requests FOR SELECT
  USING (
    map_id IN (
      SELECT id FROM maps.maps
      WHERE visibility = 'public'
        OR visibility = 'unlisted'
        OR id IN (
          SELECT map_id 
          FROM maps.memberships
          WHERE account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid())
        )
        OR owner_account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid())
    )
  );

-- Users can create requests for maps they can see
CREATE POLICY "Users can create requests for visible maps"
  ON maps.requests FOR INSERT
  WITH CHECK (
    account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid())
    AND
    map_id IN (
      SELECT id FROM maps.maps
      WHERE visibility = 'public'
        OR visibility = 'unlisted'
    )
  );

-- Map owners and admins can update requests
CREATE POLICY "Owners and admins can update requests"
  ON maps.requests FOR UPDATE
  USING (
    map_id IN (
      SELECT id FROM maps.maps
      WHERE owner_account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid())
    )
    OR
    map_id IN (
      SELECT m.map_id FROM maps.memberships m
      WHERE m.account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid())
        AND m.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    map_id IN (
      SELECT id FROM maps.maps
      WHERE owner_account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid())
    )
    OR
    map_id IN (
      SELECT m.map_id FROM maps.memberships m
      WHERE m.account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid())
        AND m.role IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- STEP 2: Migrate data from public.map_membership_requests to maps.requests
-- ============================================================================

INSERT INTO maps.requests (
  id,
  map_id,
  account_id,
  answers,
  status,
  created_at,
  reviewed_at,
  reviewed_by_account_id
)
SELECT 
  id,
  map_id, -- Will reference maps.maps.id (same IDs after migration)
  account_id,
  answers,
  status,
  created_at,
  reviewed_at,
  reviewed_by_account_id
FROM public.map_membership_requests
WHERE map_id IN (SELECT id FROM maps.maps) -- Only migrate requests for maps that exist in maps.maps
ON CONFLICT (id) DO UPDATE SET
  map_id = EXCLUDED.map_id,
  account_id = EXCLUDED.account_id,
  answers = EXCLUDED.answers,
  status = EXCLUDED.status,
  reviewed_at = EXCLUDED.reviewed_at,
  reviewed_by_account_id = EXCLUDED.reviewed_by_account_id;

-- ============================================================================
-- STEP 3: Verification
-- ============================================================================

DO $$
DECLARE
  public_count INTEGER;
  maps_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO public_count FROM public.map_membership_requests;
  SELECT COUNT(*) INTO maps_count FROM maps.requests;
  
  RAISE NOTICE 'Migration Status:';
  RAISE NOTICE '  public.map_membership_requests rows: %', public_count;
  RAISE NOTICE '  maps.requests rows: %', maps_count;
  
  IF maps_count >= public_count THEN
    RAISE NOTICE '✅ Migration successful! All rows migrated.';
  ELSE
    RAISE WARNING '⚠️  Migration incomplete. Missing % rows.', public_count - maps_count;
  END IF;
END $$;
