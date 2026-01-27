# Map Publishing to Community: Strategic Analysis & Implementation Plan

## Summary of Initial Request

**Goal:** Add a "Publish Map to Community" feature that:
1. Is controlled by billing plan features (available to Contributor and up)
2. Allows maps to be discoverable in the community feed
3. Works independently from direct member invitations (which should remain available for all maps)
4. Reconsiders the relationship between map visibility and community publishing

**Key Insight:** The user is considering decoupling "publishing to community" from "map visibility", where:
- **Visibility** (`public`/`private`) would control what non-members can see when visiting a published map
- **Publishing** would control whether the map appears in community discovery
- Private maps could be published but show limited content to non-members (with a "request to join" prompt)

---

## Current State Analysis

### 1. Map Visibility System

**Current Implementation:**
- Maps have `visibility: 'public' | 'private'` column
- **Public maps:**
  - Visible to everyone (anonymous + authenticated)
  - Appear in `/api/maps?visibility=public` queries
  - Shown in Community tab on `/maps` page
  - RLS allows anyone to SELECT
- **Private maps:**
  - Only visible to members (via `map_members` table)
  - Do NOT appear in community discovery
  - RLS requires membership check

**What Visibility Currently Controls:**
1. **Discovery:** Only public maps appear in community listings
2. **Access:** Public = anyone can view, Private = members only
3. **RLS Policies:** Database-level filtering based on visibility + membership

### 2. Map Features System

**Current Implementation:**
- Billing features control limits (counts, storage, boolean flags)
- Examples:
  - `custom_maps`: Limit on number of maps (Hobby: 3, Contributor: 10, etc.)
  - `map_members`: Limit on members per map (Hobby: 10, Contributor: 50, etc.)
  - `map_edit_pins`: Boolean feature (Contributor+ required)
- Features checked via `get_account_feature_limit(accountId, featureSlug)`
- Plan hierarchy: `hobby` (free) < `contributor` < `professional` < `business`

**What Features Currently Control:**
1. **Creation limits:** How many maps/members you can have
2. **Editing capabilities:** Which actions require which plans
3. **Feature access:** Boolean gates for advanced functionality

### 3. Map Sharing/Invitation System

**Current Implementation:**
- Owners/managers can invite members via `/api/maps/[id]/members`
- Works for both public and private maps
- Direct invitation (not discovery-based)
- Member limit enforced by `map_members` feature

**What Sharing Currently Controls:**
1. **Direct access:** Owner can grant membership to specific accounts
2. **Member management:** Role-based access (owner/manager/editor)
3. **Join requests:** Users can request to join (if map allows)

---

## Strategic UX Considerations

### Core Question: What Does "Publishing to Community" Mean?

**Option A: Publishing = Discovery Only**
- Published maps appear in community feed
- Visibility still controls what visitors see
- Private published maps show limited preview + "request to join"
- **Pros:** Clear separation of concerns, flexible
- **Cons:** Two concepts to understand (publish vs visibility)

**Option B: Publishing = Public Visibility**
- Publishing automatically makes map public
- Visibility and publishing are the same thing
- **Pros:** Simpler mental model
- **Cons:** Less flexible, can't have private published maps

**Option C: Publishing = Enhanced Discovery**
- All public maps are automatically "published"
- Publishing feature adds extra visibility (featured placement, categories, etc.)
- **Pros:** Builds on existing system
- **Cons:** Doesn't solve the private map discovery problem

### Recommended Approach: Option A (Publishing = Discovery Only)

**Rationale:**
1. **Flexibility:** Allows private maps to be discoverable (with limited preview)
2. **User Control:** Owners can choose both discovery AND access level
3. **Progressive Disclosure:** Private published maps can show teaser content to entice joins
4. **Future-Proof:** Enables features like "unlisted but published" or "members-only discovery"

---

## Proposed System Design

### 1. New Database Schema

```sql
-- Add published_to_community column
ALTER TABLE public.map
  ADD COLUMN IF NOT EXISTS published_to_community BOOLEAN NOT NULL DEFAULT false;

-- Add published_at timestamp (when published)
ALTER TABLE public.map
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE;

-- Index for community discovery queries
CREATE INDEX IF NOT EXISTS idx_map_published_community
  ON public.map(published_to_community, is_active, created_at DESC)
  WHERE published_to_community = true AND is_active = true;
```

### 2. New Billing Feature

**Feature Slug:** `map_publish_to_community`
- **Type:** `boolean` (yes/no access)
- **Plans:**
  - `hobby`: ❌ Not available
  - `contributor`: ✅ Available
  - `professional`: ✅ Available
  - `business`: ✅ Available

**Migration:**
```sql
-- Add feature
INSERT INTO billing.features (slug, name, description, category, is_active)
VALUES (
  'map_publish_to_community',
  'Publish Map to Community',
  'Allow maps to be discoverable in the community feed',
  'maps',
  true
)
ON CONFLICT (slug) DO NOTHING;

-- Add to plans (contributor and up)
INSERT INTO billing.plan_features (plan_id, feature_id, limit_type)
SELECT
  p.id,
  f.id,
  'boolean'
FROM billing.plans p
CROSS JOIN billing.features f
WHERE p.slug IN ('contributor', 'professional', 'business')
  AND f.slug = 'map_publish_to_community'
ON CONFLICT (plan_id, feature_id) DO UPDATE
SET limit_type = 'boolean';
```

### 3. Visibility + Publishing Matrix

| Visibility | Published | Discovery | Non-Member Access |
|------------|-----------|-----------|-------------------|
| Public | ✅ Yes | ✅ Appears in feed | ✅ Full access (pins, layers, etc.) |
| Public | ❌ No | ❌ Not in feed | ✅ Full access (if they have direct link) |
| Private | ✅ Yes | ✅ Appears in feed | ⚠️ Limited preview + "Request to Join" |
| Private | ❌ No | ❌ Not in feed | ❌ No access (members only) |

### 4. Non-Member Preview Experience (Private Published Maps)

**What Non-Members See:**
1. **Map Card in Feed:**
   - Map name, description, creator
   - Member count, pin count (if public stats enabled)
   - "Private Map" badge
   - "Request to Join" button

2. **Map Page (if visited directly):**
   - Map name, description, creator info
   - **NO pins rendered** (or placeholder: "Join to see pins")
   - **NO layers rendered** (or placeholder: "Join to see layers")
   - **NO posts visible** (or placeholder: "Join to see posts")
   - Prominent "Request to Join" CTA
   - Message: "This is a private map. Join to see all content and contribute."

3. **Map Metadata Visible:**
   - Name, description, tags
   - Creator profile link
   - Member count (if public)
   - Created date
   - Category/tags

**What Non-Members Cannot See:**
- Pin locations/markers
- Map layers (boundaries, etc.)
- Posts/comments
- Member list
- Analytics
- Settings

### 5. RLS Policy Updates

**Community Discovery Query:**
```sql
-- Updated query for /api/maps?community=true
SELECT * FROM map
WHERE published_to_community = true
  AND is_active = true
ORDER BY published_at DESC, created_at DESC;
```

**Map Access Policy (for private published maps):**
```sql
-- Allow non-members to see map metadata but not content
CREATE POLICY "map_select_published_private_metadata"
  ON public.map FOR SELECT
  TO authenticated, anon
  USING (
    visibility = 'private'
    AND published_to_community = true
    AND is_active = true
    -- Non-members can see basic info, but content filtered by other policies
  );
```

**Content Filtering (Pins/Areas/Posts):**
- Existing RLS policies already filter by membership
- Private maps: Only members can see pins/areas/posts
- Public maps: Everyone can see public content

---

## Implementation Plan

### Phase 1: Database & Feature Setup

**Tasks:**
1. ✅ Add `published_to_community` column to `map` table
2. ✅ Add `published_at` timestamp column
3. ✅ Create billing feature `map_publish_to_community`
4. ✅ Add feature to Contributor+ plans
5. ✅ Create database index for discovery queries
6. ✅ Update RLS policies for private published maps

### Phase 2: API Updates

**Tasks:**
1. ✅ Update `/api/maps` GET endpoint:
   - Add `?community=true` query param (returns published maps)
   - Check `published_to_community` flag
   - Filter by visibility for non-members
2. ✅ Update `/api/maps/[id]` GET endpoint:
   - Return map metadata for private published maps (even if not member)
   - Return limited content based on membership
3. ✅ Create `/api/maps/[id]/publish` PATCH endpoint:
   - Check billing feature `map_publish_to_community`
   - Toggle `published_to_community` flag
   - Set `published_at` timestamp
   - Return error if plan doesn't include feature

### Phase 3: Frontend UI Updates

**Tasks:**
1. ✅ Map Settings Sidebar:
   - Add "Publish to Community" toggle
   - Show plan requirement (Contributor+)
   - Show upgrade prompt if plan doesn't include feature
   - Explain what publishing means
2. ✅ Community Feed (`/maps` page):
   - Filter by `published_to_community = true`
   - Show private map badges
   - Show "Request to Join" buttons for private maps
3. ✅ Map Page (`/map/[id]`):
   - Show limited preview for private published maps (non-members)
   - Hide pins/layers/posts for non-members
   - Show "Request to Join" CTA
   - Show full content for members
4. ✅ Map Cards:
   - Show "Private" badge for private published maps
   - Show member count (if public)
   - Show "Request to Join" button

### Phase 4: Permission & Access Logic

**Tasks:**
1. ✅ Create `canPublishMapToCommunity(accountId)` helper
   - Checks `map_publish_to_community` feature
   - Returns boolean + upgrade message
2. ✅ Update map access checks:
   - Separate "can view map metadata" from "can view map content"
   - Non-members can view metadata of published private maps
   - Only members can view content of private maps
3. ✅ Update content rendering logic:
   - Check membership before rendering pins/layers/posts
   - Show placeholders for non-members on private maps

---

## UX Flow Examples

### Scenario 1: Owner Publishes Private Map

1. Owner creates private map
2. Owner goes to Map Settings
3. Owner sees "Publish to Community" toggle (if Contributor+)
4. Owner toggles ON
5. Map appears in community feed with "Private" badge
6. Non-members see map card, click through
7. Non-members see map page with limited preview + "Request to Join"
8. Non-members request to join
9. Owner approves request
10. New member sees full map content

### Scenario 2: Owner Publishes Public Map

1. Owner creates public map
2. Owner publishes to community
3. Map appears in community feed
4. Anyone can view full map content (pins, layers, posts)
5. Anyone can join (if auto-approve) or request to join

### Scenario 3: Owner Unpublishes Map

1. Owner toggles "Publish to Community" OFF
2. Map removed from community feed
3. Map still accessible to members (if private) or everyone (if public)
4. Direct links still work (if user has access)

---

## Key Decisions & Trade-offs

### Decision 1: Should Publishing Require Public Visibility?

**Option:** Require maps to be public before publishing
- **Pros:** Simpler mental model, no preview complexity
- **Cons:** Less flexible, can't have private discoverable maps

**Decision:** ❌ No - Allow private maps to be published
- **Rationale:** Enables "exclusive but discoverable" use case
- **Trade-off:** More complex UI/UX, but more powerful

### Decision 2: Should Direct Invitations Still Work?

**Option:** Remove direct invitations, require publishing
- **Pros:** Single discovery mechanism
- **Cons:** Breaks existing workflows, less flexible

**Decision:** ✅ Yes - Keep direct invitations separate
- **Rationale:** Direct invitations are for curated teams, publishing is for discovery
- **Trade-off:** Two mechanisms, but serves different needs

### Decision 3: What Content Should Non-Members See?

**Option A:** Nothing (blank map with "Join" button)
- **Pros:** Simple, clear privacy
- **Cons:** No preview = less engagement

**Option B:** Metadata only (name, description, stats)
- **Pros:** Some context, still private
- **Cons:** Limited preview value

**Option C:** Teaser content (some pins, blurred layers)
- **Pros:** Best engagement, shows value
- **Cons:** More complex, privacy concerns

**Decision:** Option B (Metadata Only)
- **Rationale:** Balance between privacy and discovery
- **Future:** Could add "teaser pins" feature later

---

## Success Metrics

1. **Adoption:** % of Contributor+ users who publish maps
2. **Discovery:** % of map joins from community feed vs direct links
3. **Engagement:** Join request rate for private published maps
4. **Retention:** % of published maps that remain published over time

---

## Open Questions

1. **Should published maps be searchable?** (via search bar, not just feed)
2. **Should there be publishing categories?** (e.g., "Featured", "New", "Popular")
3. **Should owners be able to set custom preview content?** (e.g., "show these 3 pins to non-members")
4. **Should there be publishing analytics?** (views, join requests, etc.)
5. **Should there be moderation for published maps?** (admin review, community reporting)

---

## Next Steps

1. **Review & Approve:** Confirm this approach aligns with product vision
2. **Prioritize:** Which phase should be implemented first?
3. **Prototype:** Build minimal version to test UX assumptions
4. **Iterate:** Refine based on user feedback
