-- Map System Redesign - Phase 1: Add New Structure
-- This migration adds member management, categories, and new columns without breaking existing functionality
-- Phase 2 will migrate data and Phase 3 will remove old columns

-- ============================================================================
-- STEP 1: Create map_members table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.map_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id UUID NOT NULL REFERENCES public.map(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  
  -- Member role: 'owner', 'manager', 'editor'
  -- owner: full control including delete (only one, the creator)
  -- manager: full control except delete (can be multiple)
  -- editor: can add pins/areas and edit content
  role TEXT NOT NULL DEFAULT 'editor' 
    CHECK (role IN ('owner', 'manager', 'editor')),
  
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(map_id, account_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_map_members_map_id ON public.map_members(map_id);
CREATE INDEX IF NOT EXISTS idx_map_members_account_id ON public.map_members(account_id);
CREATE INDEX IF NOT EXISTS idx_map_members_role ON public.map_members(role);

-- Comments
COMMENT ON TABLE public.map_members IS 'Membership and role management for maps, similar to group_members';
COMMENT ON COLUMN public.map_members.role IS 'Member role: owner (full control), manager (all except delete), editor (add pins/areas and edit content)';

-- ============================================================================
-- STEP 2: Create map_membership_requests table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.map_membership_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id UUID NOT NULL REFERENCES public.map(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  
  -- Request answers (JSONB array of answers to custom questions)
  -- Format: [{"question_id": 0, "answer": "..."}, ...]
  answers JSONB DEFAULT '[]'::jsonb,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'approved', 'rejected')),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by_account_id UUID REFERENCES public.accounts(id),
  
  -- Constraints: Only one pending request per map+account
  CONSTRAINT map_membership_requests_unique_pending 
    UNIQUE(map_id, account_id) 
    DEFERRABLE INITIALLY DEFERRED
);

-- Create partial unique index for pending requests
CREATE UNIQUE INDEX IF NOT EXISTS idx_map_membership_requests_pending 
  ON public.map_membership_requests(map_id, account_id) 
  WHERE status = 'pending';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_map_membership_requests_map_id 
  ON public.map_membership_requests(map_id);
CREATE INDEX IF NOT EXISTS idx_map_membership_requests_account_id 
  ON public.map_membership_requests(account_id);
CREATE INDEX IF NOT EXISTS idx_map_membership_requests_status 
  ON public.map_membership_requests(status) 
  WHERE status = 'pending';

-- Comments
COMMENT ON TABLE public.map_membership_requests IS 'Membership join requests for maps with custom questions';
COMMENT ON COLUMN public.map_membership_requests.answers IS 'JSONB array of answers to membership questions: [{"question_id": 0, "answer": "..."}]';

-- ============================================================================
-- STEP 3: Create map_categories table (many-to-many)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.map_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id UUID NOT NULL REFERENCES public.map(id) ON DELETE CASCADE,
  category TEXT NOT NULL 
    CHECK (category IN ('community', 'professional', 'government', 'atlas', 'user')),
  
  -- Constraints
  UNIQUE(map_id, category)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_map_categories_map_id ON public.map_categories(map_id);
CREATE INDEX IF NOT EXISTS idx_map_categories_category ON public.map_categories(category);

-- Comments
COMMENT ON TABLE public.map_categories IS 'Many-to-many relationship between maps and categories';
COMMENT ON COLUMN public.map_categories.category IS 'Category type: community, professional, government, atlas, user';

-- ============================================================================
-- STEP 4: Add new columns to map table
-- ============================================================================

-- Add media columns (like groups)
ALTER TABLE public.map
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add status and membership columns
ALTER TABLE public.map
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_approve_members BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS membership_rules TEXT,
  ADD COLUMN IF NOT EXISTS membership_questions JSONB DEFAULT '[]'::jsonb;

-- Add computed stats
ALTER TABLE public.map
  ADD COLUMN IF NOT EXISTS member_count INTEGER NOT NULL DEFAULT 0;

-- Add consolidated settings JSONB
ALTER TABLE public.map
  ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Add constraints
DO $$
BEGIN
  -- Add constraint for membership questions limit (max 5)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'map_membership_questions_limit'
  ) THEN
    ALTER TABLE public.map
      ADD CONSTRAINT map_membership_questions_limit 
      CHECK (jsonb_array_length(membership_questions) <= 5);
  END IF;
  
  -- Add constraint for member_count
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'map_member_count_non_negative'
  ) THEN
    ALTER TABLE public.map
      ADD CONSTRAINT map_member_count_non_negative 
      CHECK (member_count >= 0);
  END IF;
END $$;

-- Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_map_is_active 
  ON public.map(is_active) 
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_map_auto_approve_members 
  ON public.map(auto_approve_members) 
  WHERE auto_approve_members = true;
CREATE INDEX IF NOT EXISTS idx_map_settings 
  ON public.map USING GIN (settings) 
  WHERE settings IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_map_membership_questions 
  ON public.map USING GIN (membership_questions) 
  WHERE membership_questions IS NOT NULL AND jsonb_array_length(membership_questions) > 0;

-- Comments
COMMENT ON COLUMN public.map.is_active IS 'Soft delete flag - false hides map from public view';
COMMENT ON COLUMN public.map.auto_approve_members IS 'If true, automatically approve membership requests for public maps';
COMMENT ON COLUMN public.map.membership_rules IS 'Custom rules/terms for map membership';
COMMENT ON COLUMN public.map.membership_questions IS 'Up to 5 questions for membership join requests: [{"question": "...", "required": true}]';
COMMENT ON COLUMN public.map.member_count IS 'Number of members (computed via trigger)';
COMMENT ON COLUMN public.map.settings IS 'Consolidated settings JSONB: {appearance: {...}, collaboration: {...}, presentation: {...}}';

-- ============================================================================
-- STEP 5: Create helper functions for map membership
-- ============================================================================

-- Function to check if user is a map member
CREATE OR REPLACE FUNCTION public.is_map_member(p_map_id UUID, p_account_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.map_members
    WHERE map_members.map_id = p_map_id
      AND map_members.account_id = p_account_id
  );
$$;

-- Function to check if user is a map manager (owner or manager role)
CREATE OR REPLACE FUNCTION public.is_map_manager(p_map_id UUID, p_account_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.map_members
    WHERE map_members.map_id = p_map_id
      AND map_members.account_id = p_account_id
      AND map_members.role IN ('owner', 'manager')
  );
$$;

-- Function to check if user is a map admin (owner or manager role)
CREATE OR REPLACE FUNCTION public.is_map_admin(p_map_id UUID, p_account_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.map_members
    WHERE map_members.map_id = p_map_id
      AND map_members.account_id = p_account_id
      AND map_members.role IN ('owner', 'manager')
  );
$$;

-- Function to check if user owns the map (owner role only)
CREATE OR REPLACE FUNCTION public.is_map_owner(p_map_id UUID, p_account_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.map_members
    WHERE map_members.map_id = p_map_id
      AND map_members.account_id = p_account_id
      AND map_members.role = 'owner'
  );
$$;

-- Ensure functions are owned by postgres (required for SECURITY DEFINER)
ALTER FUNCTION public.is_map_member(UUID, UUID) OWNER TO postgres;
ALTER FUNCTION public.is_map_manager(UUID, UUID) OWNER TO postgres;
ALTER FUNCTION public.is_map_admin(UUID, UUID) OWNER TO postgres;
ALTER FUNCTION public.is_map_owner(UUID, UUID) OWNER TO postgres;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_map_member(UUID, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_map_manager(UUID, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_map_admin(UUID, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_map_owner(UUID, UUID) TO authenticated, anon;

-- Comments
COMMENT ON FUNCTION public.is_map_member(UUID, UUID) IS 'Checks if an account is a member of a map';
COMMENT ON FUNCTION public.is_map_manager(UUID, UUID) IS 'Checks if an account is a manager (owner or manager role) of a map';
COMMENT ON FUNCTION public.is_map_admin(UUID, UUID) IS 'Checks if an account is an admin (owner or manager role) of a map';
COMMENT ON FUNCTION public.is_map_owner(UUID, UUID) IS 'Checks if an account is the owner (owner role only) of a map';

-- ============================================================================
-- STEP 6: Create slug generation function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_map_slug(p_map_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
  random_words TEXT[];
  word1 TEXT;
  word2 TEXT;
BEGIN
  -- Convert to lowercase, replace spaces with hyphens, remove special chars
  base_slug := lower(regexp_replace(p_map_name, '[^a-z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  
  -- Ensure base slug is not empty
  IF base_slug = '' THEN
    base_slug := 'map';
  END IF;
  
  -- Random word arrays
  random_words := ARRAY['minnesota', 'twin', 'cities', 'north', 'south', 'east', 'west', 'lake', 'river', 'park'];
  
  -- Pick two random words
  word1 := random_words[1 + floor(random() * array_length(random_words, 1))::int];
  word2 := random_words[1 + floor(random() * array_length(random_words, 1))::int];
  
  -- Add random suffix (2 words + 3-4 digit number)
  final_slug := base_slug || '-' || word1 || '-' || word2 || '-' || 
    (100 + floor(random() * 9000))::text;
  
  -- Ensure uniqueness (check custom_slug column which exists)
  WHILE EXISTS (SELECT 1 FROM public.map WHERE custom_slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter || '-' || 
      (1000 + floor(random() * 9000))::text;
    
    -- Prevent infinite loop
    IF counter > 1000 THEN
      final_slug := base_slug || '-' || extract(epoch from now())::bigint;
      EXIT;
    END IF;
  END LOOP;
  
  RETURN final_slug;
END;
$$;

ALTER FUNCTION public.generate_map_slug(TEXT) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.generate_map_slug(TEXT) TO authenticated;

COMMENT ON FUNCTION public.generate_map_slug(TEXT) IS 'Generates a unique slug for a map from its name. Used for hobby/free plans.';

-- ============================================================================
-- STEP 7: Create triggers for member count
-- ============================================================================

-- Function to update map member count
CREATE OR REPLACE FUNCTION public.update_map_member_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.map
    SET member_count = member_count + 1
    WHERE id = NEW.map_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.map
    SET member_count = GREATEST(0, member_count - 1)
    WHERE id = OLD.map_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS update_map_member_count_trigger ON public.map_members;
CREATE TRIGGER update_map_member_count_trigger
  AFTER INSERT OR DELETE ON public.map_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_map_member_count();

-- ============================================================================
-- STEP 8: Auto-add map creator as owner member
-- ============================================================================

-- Function to auto-add map creator as owner
CREATE OR REPLACE FUNCTION public.auto_add_map_creator_as_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Add creator as owner member
  INSERT INTO public.map_members (map_id, account_id, role)
  VALUES (NEW.id, NEW.account_id, 'owner')
  ON CONFLICT (map_id, account_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.auto_add_map_creator_as_owner() OWNER TO postgres;

-- Create trigger (only for new maps)
DROP TRIGGER IF EXISTS auto_add_map_creator_as_owner_trigger ON public.map;
CREATE TRIGGER auto_add_map_creator_as_owner_trigger
  AFTER INSERT ON public.map
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_add_map_creator_as_owner();

-- ============================================================================
-- STEP 9: Migrate existing map owners to map_members
-- ============================================================================

-- Add existing map owners as 'owner' members
INSERT INTO public.map_members (map_id, account_id, role)
SELECT 
  id as map_id,
  account_id,
  'owner' as role
FROM public.map
WHERE NOT EXISTS (
  SELECT 1 FROM public.map_members 
  WHERE map_members.map_id = map.id 
  AND map_members.account_id = map.account_id
)
ON CONFLICT (map_id, account_id) DO NOTHING;

-- Update member_count for existing maps
UPDATE public.map
SET member_count = (
  SELECT COUNT(*) 
  FROM public.map_members 
  WHERE map_members.map_id = map.id
);

-- ============================================================================
-- STEP 10: Enable Row Level Security
-- ============================================================================

ALTER TABLE public.map_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.map_membership_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.map_categories ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 11: Create RLS policies for map_members
-- ============================================================================

-- Policy: Members can view other members
CREATE POLICY "map_members_select"
  ON public.map_members FOR SELECT
  TO authenticated
  USING (
    public.is_map_member(map_id, (
      SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1
    ))
  );

-- Policy: Auto-approve public maps: anyone can join
-- Manual approval: only managers can add members
CREATE POLICY "map_members_insert"
  ON public.map_members FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND account_id = (
      SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1
    )
    AND (
      -- Public maps with auto-approve: anyone can join
      EXISTS (
        SELECT 1 FROM public.map
        WHERE id = map_id
        AND visibility = 'public'
        AND is_active = true
        AND auto_approve_members = true
      )
      -- Private maps or manual approval: only managers can add
      OR public.is_map_manager(map_id, (
        SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1
      ))
    )
  );

-- Policy: Only managers can update member roles
CREATE POLICY "map_members_update"
  ON public.map_members FOR UPDATE
  TO authenticated
  USING (
    public.is_map_manager(map_id, (
      SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1
    ))
  )
  WITH CHECK (
    public.is_map_manager(map_id, (
      SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1
    ))
  );

-- Policy: Users can leave, managers can remove
CREATE POLICY "map_members_delete"
  ON public.map_members FOR DELETE
  TO authenticated
  USING (
    -- Users can leave themselves
    account_id = (
      SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1
    )
    -- Or managers can remove members (but not owners)
    OR (
      public.is_map_manager(map_id, (
        SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1
      ))
      AND role != 'owner'
    )
  );

-- ============================================================================
-- STEP 12: Create RLS policies for map_membership_requests
-- ============================================================================

-- Policy: Managers can view requests, users can view their own
CREATE POLICY "map_membership_requests_select"
  ON public.map_membership_requests FOR SELECT
  TO authenticated
  USING (
    -- Managers can view all requests for their maps
    public.is_map_manager(map_id, (
      SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1
    ))
    -- Users can view their own requests
    OR account_id = (
      SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1
    )
  );

-- Policy: Users can create requests for maps that don't auto-approve
CREATE POLICY "map_membership_requests_insert"
  ON public.map_membership_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND account_id = (
      SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1
    )
    AND NOT EXISTS (
      -- Can't request if already a member
      SELECT 1 FROM public.map_members
      WHERE map_members.map_id = map_membership_requests.map_id
      AND map_members.account_id = map_membership_requests.account_id
    )
    AND (
      -- Public maps without auto-approve
      EXISTS (
        SELECT 1 FROM public.map
        WHERE id = map_id
        AND visibility = 'public'
        AND is_active = true
        AND auto_approve_members = false
      )
      -- Private maps (requires invitation, but allow request)
      OR EXISTS (
        SELECT 1 FROM public.map
        WHERE id = map_id
        AND visibility = 'private'
        AND is_active = true
      )
    )
  );

-- Policy: Only managers can update request status
CREATE POLICY "map_membership_requests_update"
  ON public.map_membership_requests FOR UPDATE
  TO authenticated
  USING (
    public.is_map_manager(map_id, (
      SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1
    ))
  )
  WITH CHECK (
    public.is_map_manager(map_id, (
      SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1
    ))
  );

-- ============================================================================
-- STEP 13: Create RLS policies for map_categories
-- ============================================================================

-- Policy: Anyone can view categories for public maps, members for private maps
CREATE POLICY "map_categories_select"
  ON public.map_categories FOR SELECT
  TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM public.map
      WHERE map.id = map_categories.map_id
      AND (
        map.visibility = 'public'
        OR (
          auth.uid() IS NOT NULL
          AND public.is_map_member(map.id, (
            SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1
          ))
        )
      )
      AND map.is_active = true
    )
  );

-- Policy: Only managers can manage categories
CREATE POLICY "map_categories_insert"
  ON public.map_categories FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_map_manager(map_id, (
      SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1
    ))
  );

CREATE POLICY "map_categories_delete"
  ON public.map_categories FOR DELETE
  TO authenticated
  USING (
    public.is_map_manager(map_id, (
      SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1
    ))
  );

-- ============================================================================
-- STEP 14: Grant permissions
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.map_members TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.map_membership_requests TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.map_categories TO authenticated;
GRANT SELECT ON public.map_categories TO anon;

-- ============================================================================
-- STEP 15: Force PostgREST schema cache refresh
-- ============================================================================

NOTIFY pgrst, 'reload schema';
