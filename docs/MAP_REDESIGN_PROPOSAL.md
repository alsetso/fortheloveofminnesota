# Map System Redesign: Lean & Strategic Approach

## Current State Analysis

### Maps Table - Current Columns (Bloated)
```
Core Identity:
- id, account_id, title, description

Visibility & Access:
- visibility (private/public/shared) - 3 states, confusing
- allow_others_to_post_pins
- allow_others_to_add_areas  
- allow_others_to_create_posts

Presentation:
- map_style (street/satellite/light/dark)
- map_layers (JSONB)
- meta (JSONB) - buildingsEnabled, pitch, terrainEnabled, center, zoom
- hide_creator
- is_primary

Categorization (Redundant):
- type (user/community/gov/professional/atlas/user-generated)
- collection_type (community/professional/user/atlas/gov)
- tags (array of {emoji, text})

URL:
- custom_slug

Timestamps:
- created_at, updated_at
```

**Issues:**
1. **Too many boolean flags** - collaboration settings scattered
2. **Redundant categorization** - `type` and `collection_type` overlap
3. **No member management** - unlike groups which have `group_members` table
4. **Complex visibility** - 3 states vs groups' simple public/private
5. **Mixed concerns** - presentation, access, categorization all in one table
6. **No soft delete** - groups have `is_active`
7. **No computed stats** - groups have `member_count`, `post_count`

### Groups Table - Lean & Strategic (Reference)
```
Core Identity:
- id, name, slug, description
- cover_image_url, image_url

Visibility & Access:
- visibility (public/private) - simple enum
- is_active (soft delete)

Ownership:
- created_by_account_id

Metadata (Computed):
- member_count (triggered)
- post_count (triggered)

Timestamps:
- created_at, updated_at
```

**Strengths:**
1. **Simple visibility** - just public/private
2. **Member management** - separate `group_members` table with `is_admin`
3. **Computed stats** - automatically maintained
4. **Soft delete** - `is_active` flag
5. **Clean separation** - access control via members table, not flags

---

## Proposed Lean Map Structure

### Core Map Table (Simplified)
```sql
CREATE TABLE public.map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity (like groups)
  name TEXT NOT NULL,  -- Rename from 'title'
  slug TEXT UNIQUE NOT NULL,  -- Rename from 'custom_slug', make required
  description TEXT,
  cover_image_url TEXT,  -- NEW: like groups
  image_url TEXT,  -- NEW: like groups
  
  -- Visibility & Status (like groups)
  visibility public.map_visibility NOT NULL DEFAULT 'private',
  is_active BOOLEAN NOT NULL DEFAULT true,  -- NEW: soft delete
  
  -- Ownership (like groups)
  created_by_account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  
  -- Settings (consolidated JSONB)
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Contains: {
  --   map_style: 'street' | 'satellite' | 'light' | 'dark',
  --   map_layers: {...},
  --   meta: { buildingsEnabled, pitch, terrainEnabled, center, zoom },
  --   collaboration: {
  --     allow_pins: boolean,
  --     allow_areas: boolean,
  --     allow_posts: boolean
  --   },
  --   presentation: {
  --     hide_creator: boolean,
  --     is_featured: boolean  -- Rename from is_primary
  --   }
  -- }
  
  -- Membership settings
  auto_approve_members BOOLEAN NOT NULL DEFAULT false,  -- Auto-approve join requests
  membership_rules TEXT,  -- Custom rules/terms for membership
  membership_questions JSONB DEFAULT '[]'::jsonb,  -- Up to 5 questions for join requests
  -- Format: [{"question": "Why do you want to join?", "required": true}, ...]
  
  -- Metadata (computed, like groups)
  member_count INTEGER NOT NULL DEFAULT 0,  -- NEW: map contributors
  view_count INTEGER NOT NULL DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  published_at TIMESTAMP WITH TIME ZONE,  -- When made public
  
  -- Constraints
  CONSTRAINT map_name_length CHECK (char_length(name) >= 1 AND char_length(name) <= 200),
  CONSTRAINT map_slug_length CHECK (char_length(slug) >= 3 AND char_length(slug) <= 100),
  CONSTRAINT map_slug_format CHECK (slug ~ '^[a-z0-9-]+$'),
  CONSTRAINT map_description_length CHECK (description IS NULL OR char_length(description) <= 2000),
  CONSTRAINT map_member_count_non_negative CHECK (member_count >= 0),
  CONSTRAINT map_view_count_non_negative CHECK (view_count >= 0),
  CONSTRAINT map_membership_questions_limit CHECK (jsonb_array_length(membership_questions) <= 5)
);
```

### Map Members Table (NEW - Like group_members)
```sql
CREATE TABLE public.map_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id UUID NOT NULL REFERENCES public.map(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  
  -- Member role: 'owner', 'manager', 'admin', 'contributor'
  -- owner: full control including delete (only one, the creator)
  -- manager: full control except delete (can be multiple)
  -- admin: can manage members and content
  -- contributor: can add pins/areas
  role TEXT NOT NULL DEFAULT 'contributor' 
    CHECK (role IN ('owner', 'manager', 'admin', 'contributor')),
  
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(map_id, account_id)
);
```

### Map Membership Requests Table (NEW)
```sql
CREATE TABLE public.map_membership_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id UUID NOT NULL REFERENCES public.map(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  
  -- Request answers (JSONB array of answers to custom questions)
  answers JSONB DEFAULT '[]'::jsonb,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'approved', 'rejected')),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by_account_id UUID REFERENCES public.accounts(id),
  
  -- Constraints
  UNIQUE(map_id, account_id, status) WHERE status = 'pending'
);
```

### Map Categories Table (NEW - Replace type/collection_type)
```sql
CREATE TABLE public.map_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id UUID NOT NULL REFERENCES public.map(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('community', 'professional', 'government', 'atlas', 'user')),
  
  -- Constraints
  UNIQUE(map_id, category)
);
```

**Benefits:**
- Maps can have multiple categories (many-to-many)
- Cleaner than having both `type` and `collection_type`
- Easier to query and filter

---

## Key Improvements

### 1. **Simplified Visibility**
- **Before:** `visibility` (private/public/shared) - 3 states, confusing
- **After:** `visibility` (private/public) - matches groups, clearer

### 2. **Member Management System**
- **Before:** Single owner (`account_id`), collaboration via boolean flags
- **After:** `map_members` table with `is_admin` and `can_edit` flags
  - Owner automatically added as admin
  - Can invite contributors with edit permissions
  - Can promote members to admins
  - Collaboration settings in `settings.collaboration` apply to non-members

### 3. **Consolidated Settings**
- **Before:** Scattered booleans and JSONB fields
- **After:** Single `settings` JSONB with clear structure:
  ```json
  {
    "map_style": "street",
    "map_layers": {...},
    "meta": {...},
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

### 4. **Computed Statistics**
- **Before:** Only `view_count` (manual)
- **After:** `member_count`, `view_count` (both triggered)
  - Similar to groups' `member_count` and `post_count`
  - Automatically maintained via triggers
  - Displayed on map cards for social proof

### 5. **Soft Delete**
- **Before:** Hard delete only
- **After:** `is_active` flag (like groups)
  - Allows recovery
  - Better for analytics

### 6. **Better Categorization**
- **Before:** `type` + `collection_type` (redundant, single value)
- **After:** `map_categories` junction table (many-to-many)
  - Maps can belong to multiple categories
  - Easier to query and filter

### 7. **Consistent Naming**
- **Before:** `title` → `name` (matches groups)
- **Before:** `custom_slug` → `slug` (always required, auto-generated if hobby plan, customizable if paying)
- **Before:** `is_primary` → `settings.presentation.is_featured`

### 8. **Slug Generation**
- **Before:** Optional `custom_slug`
- **After:** Always required `slug`
  - Auto-generated (random words + numbers) for hobby/free plans
  - Customizable for paying subscribers
  - Ensures clean URLs for all maps

### 9. **Media Support**
- **Before:** No cover/image support
- **After:** `cover_image_url` and `image_url` (like groups)

### 10. **Membership Management**
- **Before:** Single owner, collaboration via boolean flags
- **After:** Full member system with roles:
  - `owner`: Full control including delete (only creator)
  - `manager`: Full control except delete (can be multiple)
  - `admin`: Can manage members and content
  - `contributor`: Can add pins/areas
- Auto-approve option for public maps
- Custom rules/terms and up to 5 questions for join requests

### 11. **My Maps Page**
- **Before:** Shows all maps user owns
- **After:** Only shows maps user is a member of (not owner)
  - Owner maps moved to profile page
  - Visual role indicators (Manager, Admin, Contributor)
  - Encourages collaboration discovery

---

## Migration Strategy

### Phase 1: Add New Structure (Non-Breaking)
1. Add `map_members` table
2. Add `map_categories` table
3. Add `is_active`, `member_count`, `pin_count`, `area_count` columns
4. Add `cover_image_url`, `image_url` columns
5. Create `settings` JSONB column, migrate existing data

### Phase 2: Migrate Data
1. Migrate collaboration flags → `settings.collaboration`
2. Migrate presentation flags → `settings.presentation`
3. Migrate `map_style`, `map_layers`, `meta` → `settings`
4. Migrate `type`/`collection_type` → `map_categories`
5. Migrate `title` → `name`
6. Migrate `custom_slug` → `slug` (generate for existing maps)
7. Add owner to `map_members` as admin

### Phase 3: Update Code
1. Update API routes to use new structure
2. Update UI components
3. Update RLS policies

### Phase 4: Cleanup (Breaking)
1. Drop old columns: `title`, `custom_slug`, `type`, `collection_type`, `map_style`, `map_layers`, `meta`, `hide_creator`, `is_primary`, `allow_others_to_*`
2. Update all references

---

## RLS Policy Updates

### Map Access (Like Groups)
```sql
-- Public maps: visible to everyone
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

### Map Members (Like Group Members)
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

-- Users can join public maps, admins can invite to private maps
CREATE POLICY "map_members_insert"
  ON public.map_members FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND account_id = (
      SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1
    )
    AND (
      -- Public maps: anyone can join
      EXISTS (
        SELECT 1 FROM public.map
        WHERE id = map_id
        AND visibility = 'public'::public.map_visibility
        AND is_active = true
      )
      -- Private maps: only if invited by admin
      OR public.is_map_admin(map_id, (
        SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1
      ))
    )
  );
```

---

## Benefits Summary

1. **Consistency** - Maps work like groups (familiar patterns)
2. **Flexibility** - Member management allows fine-grained permissions
3. **Maintainability** - Consolidated settings, computed stats
4. **Scalability** - Many-to-many categories, soft deletes
5. **User Experience** - Clearer visibility, better collaboration
6. **Code Quality** - Less duplication, cleaner APIs

---

## Next Steps

1. Review and approve this proposal
2. Create migration script following Phase 1-4 strategy
3. Update TypeScript types
4. Update API routes
5. Update UI components
6. Test thoroughly
7. Deploy incrementally
