# Map Redesign Implementation Plan

Based on strategic UX decisions, this document outlines the implementation plan.

## Key Decisions Summary

1. ✅ **Simplified Creation**: Name, description, visibility only
2. ✅ **Remove "shared"**: Only public/private with member management
3. ✅ **Unified Community Feed**: All public maps, Primary/Featured at top
4. ✅ **Member Roles**: owner, manager, admin, contributor
5. ✅ **Stats Display**: member_count + view_count only
6. ✅ **Always Enforce Slug**: Auto-gen for hobby, customizable for paying
7. ✅ **Consolidated Settings**: Single settings section with subsections
8. ✅ **Featured Maps**: Replace is_primary with featured system
9. ✅ **My Maps**: Only show "member of" maps, owner maps → profile
10. ✅ **Soft Delete**: is_active flag for recovery

## Database Schema Changes

### Core Map Table Updates

```sql
-- Rename columns
ALTER TABLE public.map RENAME COLUMN title TO name;
ALTER TABLE public.map RENAME COLUMN custom_slug TO slug;

-- Make slug required (add NOT NULL constraint after migration)
ALTER TABLE public.map ALTER COLUMN slug SET NOT NULL;

-- Add new columns
ALTER TABLE public.map
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_approve_members BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS membership_rules TEXT,
  ADD COLUMN IF NOT EXISTS membership_questions JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS member_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Remove old columns (after migration)
-- ALTER TABLE public.map DROP COLUMN IF EXISTS type;
-- ALTER TABLE public.map DROP COLUMN IF EXISTS collection_type;
-- ALTER TABLE public.map DROP COLUMN IF EXISTS map_style;
-- ALTER TABLE public.map DROP COLUMN IF EXISTS map_layers;
-- ALTER TABLE public.map DROP COLUMN IF EXISTS meta;
-- ALTER TABLE public.map DROP COLUMN IF EXISTS hide_creator;
-- ALTER TABLE public.map DROP COLUMN IF EXISTS is_primary;
-- ALTER TABLE public.map DROP COLUMN IF EXISTS allow_others_to_post_pins;
-- ALTER TABLE public.map DROP COLUMN IF EXISTS allow_others_to_add_areas;
-- ALTER TABLE public.map DROP COLUMN IF EXISTS allow_others_to_create_posts;

-- Change visibility enum (remove 'shared')
-- Need to migrate 'shared' maps to 'private' with appropriate members
```

### Settings JSONB Structure

```json
{
  "appearance": {
    "map_style": "street",
    "map_layers": {...},
    "meta": {
      "buildingsEnabled": false,
      "pitch": 0,
      "terrainEnabled": false,
      "center": [lng, lat],
      "zoom": 10
    }
  },
  "collaboration": {
    "allow_pins": true,
    "allow_areas": true,
    "allow_posts": true
  },
  "presentation": {
    "hide_creator": false,
    "is_featured": false
  }
}
```

### Map Members Table

```sql
CREATE TABLE public.map_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id UUID NOT NULL REFERENCES public.map(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  
  role TEXT NOT NULL DEFAULT 'contributor' 
    CHECK (role IN ('owner', 'manager', 'admin', 'contributor')),
  
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  UNIQUE(map_id, account_id)
);

CREATE INDEX idx_map_members_map_id ON public.map_members(map_id);
CREATE INDEX idx_map_members_account_id ON public.map_members(account_id);
CREATE INDEX idx_map_members_role ON public.map_members(role);
```

### Map Membership Requests Table

```sql
CREATE TABLE public.map_membership_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id UUID NOT NULL REFERENCES public.map(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  
  answers JSONB DEFAULT '[]'::jsonb,
  -- Format: [{"question_id": 0, "answer": "..."}, ...]
  
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'approved', 'rejected')),
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by_account_id UUID REFERENCES public.accounts(id),
  
  UNIQUE(map_id, account_id) WHERE status = 'pending'
);

CREATE INDEX idx_map_membership_requests_map_id ON public.map_membership_requests(map_id);
CREATE INDEX idx_map_membership_requests_account_id ON public.map_membership_requests(account_id);
CREATE INDEX idx_map_membership_requests_status ON public.map_membership_requests(status) WHERE status = 'pending';
```

### Map Categories Table (Many-to-Many)

```sql
CREATE TABLE public.map_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id UUID NOT NULL REFERENCES public.map(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('community', 'professional', 'government', 'atlas', 'user')),
  
  UNIQUE(map_id, category)
);

CREATE INDEX idx_map_categories_map_id ON public.map_categories(map_id);
CREATE INDEX idx_map_categories_category ON public.map_categories(category);
```

## Helper Functions

### Check Map Member Role

```sql
CREATE OR REPLACE FUNCTION public.is_map_member(map_id UUID, account_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.map_members
    WHERE map_members.map_id = is_map_member.map_id
      AND map_members.account_id = is_map_member.account_id
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_map_manager(map_id UUID, account_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.map_members
    WHERE map_members.map_id = is_map_manager.map_id
      AND map_members.account_id = is_map_manager.account_id
      AND map_members.role IN ('owner', 'manager')
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_map_admin(map_id UUID, account_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.map_members
    WHERE map_members.map_id = is_map_admin.map_id
      AND map_members.account_id = is_map_admin.account_id
      AND map_members.role IN ('owner', 'manager', 'admin')
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;
```

### Slug Generation Function

```sql
CREATE OR REPLACE FUNCTION public.generate_map_slug(map_name TEXT)
RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  -- Convert to lowercase, replace spaces with hyphens, remove special chars
  base_slug := lower(regexp_replace(map_name, '[^a-z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  
  -- Add random suffix (3 random words + 3 numbers)
  final_slug := base_slug || '-' || 
    array_to_string(ARRAY[
      (SELECT word FROM unnest(ARRAY['map', 'view', 'place', 'spot', 'area', 'zone', 'site', 'land']) AS word ORDER BY random() LIMIT 1),
      (SELECT word FROM unnest(ARRAY['minnesota', 'twin', 'cities', 'north', 'south', 'east', 'west']) AS word ORDER BY random() LIMIT 1),
      floor(random() * 1000)::text
    ], '-');
  
  -- Ensure uniqueness
  WHILE EXISTS (SELECT 1 FROM public.map WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter || '-' || floor(random() * 10000)::text;
  END LOOP;
  
  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;
```

### Update Member Count Trigger

```sql
CREATE OR REPLACE FUNCTION public.update_map_member_count()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_map_member_count_trigger
  AFTER INSERT OR DELETE ON public.map_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_map_member_count();
```

## UI/UX Changes

### 1. Map Creation Flow (`/maps/new`)

**Simplified Steps:**
1. Map name (required)
2. Description (optional)
3. Visibility (public/private)
4. Create → Redirect to map page

**Settings moved to map page:**
- All other configuration in settings sidebar

### 2. Maps Listing Page (`/maps`)

**Community Tab:**
- Featured maps section at top (sorted by featured + view_count)
- Unified feed below (all public maps)
- Filter by category tags
- Search functionality

**My Maps Tab:**
- Only shows maps user is a member of (not owner)
- Visual role badges: Manager, Admin, Contributor
- Owner maps moved to profile page

### 3. Map Page (`/map/[id]`)

**Settings Sidebar:**
- Collapsible sections:
  - **Basic Info**: Name, description, visibility, slug
  - **Appearance**: Map style, layers, meta settings
  - **Collaboration**: Member management, auto-approve, rules/questions
  - **Presentation**: Featured, hide creator
  - **Advanced**: Categories, deletion

**Member Management:**
- List of members with roles
- Invite members (email/username)
- Promote/demote members
- Remove members
- View pending requests (if auto-approve disabled)

**Membership Requests:**
- If auto-approve disabled, show pending requests
- Display answers to custom questions
- Approve/reject actions

### 4. Profile Page

**New Section: "My Maps"**
- Shows all maps user owns
- Different from "Member Of" (which shows on /maps)

## API Changes

### Map Creation Endpoint

```typescript
POST /api/maps
{
  name: string;
  description?: string;
  visibility: 'public' | 'private';
  // Slug auto-generated if hobby plan
  // Slug can be provided if paying subscriber
}
```

### Map Settings Endpoint

```typescript
PUT /api/maps/[id]/settings
{
  name?: string;
  description?: string;
  visibility?: 'public' | 'private';
  slug?: string; // Only if paying subscriber
  settings?: {
    appearance?: {...},
    collaboration?: {...},
    presentation?: {...}
  };
  auto_approve_members?: boolean;
  membership_rules?: string;
  membership_questions?: Array<{question: string, required: boolean}>;
}
```

### Member Management Endpoints

```typescript
GET /api/maps/[id]/members
POST /api/maps/[id]/members/invite
PUT /api/maps/[id]/members/[member_id]/role
DELETE /api/maps/[id]/members/[member_id]

GET /api/maps/[id]/membership-requests
POST /api/maps/[id]/membership-requests
PUT /api/maps/[id]/membership-requests/[request_id]/approve
PUT /api/maps/[id]/membership-requests/[request_id]/reject
```

## Migration Strategy

### Phase 1: Add New Structure (Non-Breaking)
1. Add `map_members` table
2. Add `map_membership_requests` table
3. Add `map_categories` table
4. Add new columns to `map` table
5. Create helper functions
6. Create triggers

### Phase 2: Migrate Data
1. Migrate owner to `map_members` as 'owner'
2. Migrate settings to `settings` JSONB
3. Migrate categories to `map_categories`
4. Generate slugs for existing maps
5. Migrate 'shared' visibility to 'private' with appropriate members

### Phase 3: Update Code
1. Update API routes
2. Update UI components
3. Update RLS policies
4. Update TypeScript types

### Phase 4: Cleanup (Breaking)
1. Drop old columns
2. Remove old visibility enum value
3. Update all references

## RLS Policy Updates

### Map Access

```sql
-- Public maps: visible to everyone (if active)
CREATE POLICY "maps_select_public"
  ON public.map FOR SELECT
  TO anon, authenticated
  USING (
    visibility = 'public'::public.map_visibility 
    AND is_active = true
  );

-- Private maps: visible to members
CREATE POLICY "maps_select_private_members"
  ON public.map FOR SELECT
  TO authenticated
  USING (
    visibility = 'private'::public.map_visibility
    AND is_active = true
    AND public.is_map_member(id, (
      SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1
    ))
  );
```

### Map Members

```sql
-- Members visible to other members
CREATE POLICY "map_members_select"
  ON public.map_members FOR SELECT
  TO authenticated
  USING (
    public.is_map_member(map_id, (
      SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1
    ))
  );

-- Auto-approve: anyone can join public maps
-- Manual: requires approval
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
        AND visibility = 'public'::public.map_visibility
        AND is_active = true
        AND auto_approve_members = true
      )
      -- Private maps or manual approval: only if invited/approved
      OR public.is_map_manager(map_id, (
        SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1
      ))
    )
  );
```

## Testing Checklist

- [ ] Map creation with auto-slug generation
- [ ] Map creation with custom slug (paying subscriber)
- [ ] Member invitation and role assignment
- [ ] Membership requests with custom questions
- [ ] Auto-approve vs manual approval flow
- [ ] Manager role permissions (all except delete)
- [ ] Featured maps display at top
- [ ] My Maps shows only member-of maps
- [ ] Profile shows owner maps
- [ ] Soft delete and recovery
- [ ] Settings consolidation
- [ ] Category filtering
- [ ] Slug uniqueness enforcement
