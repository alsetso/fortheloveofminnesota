# Map Frontend Update Checklist

## 🗺️ Map Pages & Components

### Core Map Pages

#### 1. `/maps` - Maps Listing Page
**File:** `src/app/maps/page.tsx`
**Updates Needed:**
- [ ] Change `title` → `name` in all references
- [ ] Change `custom_slug` → `slug` in all references
- [ ] Update to show `member_count` + `view_count` on cards
- [ ] Unified community feed (remove separate professional/gov sections)
- [ ] Featured maps section at top (from `settings.presentation.is_featured`)
- [ ] My Maps tab: Only show "member of" maps (not owned), with role badges
- [ ] Filter by categories from `map_categories` table
- [ ] Remove `collection_type`/`type` filtering logic

#### 2. `/maps/new` - Map Creation Page
**File:** `src/app/maps/new/page.tsx`
**Updates Needed:**
- [ ] Simplify to only: name, description, visibility (public/private)
- [ ] Remove all settings (map_style, layers, meta, etc.)
- [ ] Remove collection_type, custom_slug, is_primary, hide_creator
- [ ] Auto-generate slug (or allow custom if paying subscriber)
- [ ] Redirect to map page after creation (settings configured there)

#### 3. `/map/[id]` - Individual Map Page
**File:** `src/app/map/[id]/page.tsx`
**Updates Needed:**
- [ ] Change `title` → `name`
- [ ] Change `custom_slug` → `slug`
- [ ] Update `map_style` → `settings.appearance.map_style`
- [ ] Update `map_layers` → `settings.appearance.map_layers`
- [ ] Update `meta` → `settings.appearance.meta`
- [ ] Update `allow_others_to_*` → `settings.collaboration.*`
- [ ] Update `hide_creator` → `settings.presentation.hide_creator`
- [ ] Update `is_primary` → `settings.presentation.is_featured`
- [ ] Check member role instead of just `isOwner` (owner/manager/admin)
- [ ] Add member management UI
- [ ] Add membership requests UI (if auto_approve disabled)

#### 4. `/map/[id]/settings` - Map Settings Page
**File:** `src/app/map/[id]/settings/page.tsx` & `MapSettingsClient.tsx`
**Updates Needed:**
- [ ] Complete rewrite to use `settings` JSONB structure
- [ ] Collapsible sections: Basic Info, Appearance, Collaboration, Presentation, Advanced
- [ ] Member management section
- [ ] Membership requests section (if auto_approve disabled)
- [ ] Categories management (many-to-many)

#### 5. `/profile/[slug]/map` - Profile Maps Page
**File:** `src/app/profile/[slug]/map/page.tsx`
**Updates Needed:**
- [ ] Show only maps user OWNS (not member of)
- [ ] Different from "My Maps" on /maps (which shows member of)
- [ ] Update to use `name`/`slug`

---

## 🧩 Map Components

### Map Display Components

#### 6. `MapCard` - Map Card Component
**File:** `src/app/maps/components/MapCard.tsx`
**Updates Needed:**
- [ ] Change `title` → `name`
- [ ] Change `custom_slug` → `slug` for href
- [ ] Display `member_count` + `view_count`
- [ ] Show role badge if viewing from "My Maps" (Manager, Editor)
- [ ] Use `settings.presentation.is_featured` for featured styling

#### 7. `MapIDBox` - Main Map Display Component
**File:** `src/app/map/[id]/components/MapIDBox.tsx`
**Updates Needed:**
- [ ] Change `title` → `name` prop
- [ ] Update `mapStyle` → `settings.appearance.map_style`
- [ ] Update `meta` → `settings.appearance.meta`
- [ ] Update `map_layers` → `settings.appearance.map_layers`
- [ ] Update collaboration checks → `settings.collaboration.*` + member roles
- [ ] Check member role (owner/manager/editor) instead of just `isOwner`
- [ ] Update `hideCreator` → `settings.presentation.hide_creator`

#### 8. `MapInfoCard` - Map Info Display
**File:** `src/app/map/[id]/components/MapInfoCard.tsx`
**Updates Needed:**
- [ ] Change `title` → `name`
- [ ] Update collaboration checks → member roles + `settings.collaboration.*`
- [ ] Show member role badge if user is member

#### 9. `MapSettingsSidebar` - Settings Sidebar
**File:** `src/app/map/[id]/components/MapSettingsSidebar.tsx`
**Updates Needed:**
- [ ] Complete rewrite to use `settings` JSONB
- [ ] Collapsible sections:
  - **Basic Info**: name, description, visibility, slug
  - **Appearance**: map_style, map_layers, meta
  - **Collaboration**: member management, auto_approve, rules, questions
  - **Presentation**: is_featured, hide_creator
  - **Categories**: manage map_categories
- [ ] Member management UI
- [ ] Membership requests UI

#### 10. `MapEntitySlideUp` - Pin/Area Details
**File:** `src/app/map/[id]/components/MapEntitySlideUp.tsx`
**Updates Needed:**
- [ ] Check member role for edit/delete permissions
- [ ] Owner/manager can edit/delete, editor can edit own, others view-only

#### 11. `MapPinForm` - Pin Creation Form
**File:** `src/app/map/[id]/components/MapPinForm.tsx`
**Updates Needed:**
- [ ] Check member role + `settings.collaboration.allow_pins` for permissions

#### 12. `MapAreaDrawModal` - Area Drawing Modal
**File:** `src/app/map/[id]/components/MapAreaDrawModal.tsx`
**Updates Needed:**
- [ ] Check member role + `settings.collaboration.allow_areas` for permissions

---

## 🔌 API Routes (Backend)

### Existing Routes to Update

#### 13. `/api/maps` - GET & POST
**File:** `src/app/api/maps/route.ts`
**Updates Needed:**
- [ ] GET: Return `name`, `slug`, `settings` instead of old columns
- [ ] GET: Include `member_count` in response
- [ ] GET: Filter by `map_categories` instead of `collection_type`/`type`
- [ ] GET: Filter by `is_active = true`
- [ ] POST: Accept only `name`, `description`, `visibility`
- [ ] POST: Auto-generate slug (or accept custom if paying subscriber)
- [ ] POST: Create owner member automatically
- [ ] POST: Initialize `settings` with defaults

#### 14. `/api/maps/[id]` - GET, PUT, DELETE
**File:** `src/app/api/maps/[id]/route.ts`
**Updates Needed:**
- [ ] GET: Return `name`, `slug`, `settings`, `member_count`
- [ ] GET: Support lookup by `slug` (not just UUID)
- [ ] PUT: Accept `name`, `slug`, `settings` structure
- [ ] PUT: Check member role (manager+) for updates
- [ ] DELETE: Only owner can delete (soft delete via `is_active`)

#### 15. `/api/maps/[id]/pins` - GET & POST
**File:** `src/app/api/maps/[id]/pins/route.ts`
**Updates Needed:**
- [ ] POST: Check member role (owner/manager/editor) OR `settings.collaboration.allow_pins`
- [ ] Support lookup by `slug` (not just UUID)

#### 16. `/api/maps/[id]/areas` - GET & POST
**File:** `src/app/api/maps/[id]/areas/route.ts`
**Updates Needed:**
- [ ] POST: Check member role (owner/manager/editor) OR `settings.collaboration.allow_areas`
- [ ] Support lookup by `slug` (not just UUID)

### New Routes to Create

#### 17. `/api/maps/[id]/members` - Member Management
**New File:** `src/app/api/maps/[id]/members/route.ts`
**Endpoints:**
- [ ] GET - List all members with roles
- [ ] POST - Invite member (email/username)
- [ ] PUT `[memberId]` - Update member role
- [ ] DELETE `[memberId]` - Remove member

#### 18. `/api/maps/[id]/membership-requests` - Join Requests
**New File:** `src/app/api/maps/[id]/membership-requests/route.ts`
**Endpoints:**
- [ ] GET - List pending requests (managers only)
- [ ] POST - Create join request (with answers to questions)
- [ ] PUT `[requestId]/approve` - Approve request
- [ ] PUT `[requestId]/reject` - Reject request

#### 19. `/api/maps/[id]/categories` - Category Management
**New File:** `src/app/api/maps/[id]/categories/route.ts`
**Endpoints:**
- [ ] GET - List map categories
- [ ] POST - Add category
- [ ] DELETE `[category]` - Remove category

---

## 📝 TypeScript Types

### Types to Update/Create

#### 20. Map Types
**File:** `src/app/maps/types.ts` or `src/types/map.ts`
**Updates Needed:**
- [ ] Create `Map` interface with `name`, `slug`, `settings`
- [ ] Create `MapSettings` interface:
  ```typescript
  {
    appearance: { map_style, map_layers, meta },
    collaboration: { allow_pins, allow_areas, allow_posts },
    presentation: { hide_creator, is_featured }
  }
  ```
- [ ] Create `MapMember` interface
- [ ] Create `MapMembershipRequest` interface
- [ ] Update `MapItem` to use new structure

#### 21. Component Props
**Files:** All map component files
**Updates Needed:**
- [ ] Update all `title` → `name` props
- [ ] Update all `custom_slug` → `slug` props
- [ ] Update `map_style` → `settings.appearance.map_style`
- [ ] Update `map_layers` → `settings.appearance.map_layers`
- [ ] Update `meta` → `settings.appearance.meta`
- [ ] Add `memberRole` prop where needed
- [ ] Add `memberCount` prop

---

## 🔍 Other Components Using Maps

#### 22. `MapsSelectorDropdown`
**File:** `src/components/layout/MapsSelectorDropdown.tsx`
**Updates Needed:**
- [ ] Change `title` → `name`
- [ ] Change `custom_slug` → `slug`
- [ ] Use `settings.presentation.is_featured` for featured maps

#### 23. `MapDetailsModal`
**File:** `src/components/layout/MapDetailsModal.tsx`
**Updates Needed:**
- [ ] Update to use `name`/`slug`
- [ ] Show `member_count`

#### 24. `ProfileMapsContainer`
**File:** `src/features/profiles/components/ProfileMapsContainer.tsx`
**Updates Needed:**
- [ ] Show only owned maps (not member of)
- [ ] Update to use `name`/`slug`

#### 25. `MapsSidebarContent`
**File:** `src/app/maps/components/MapsSidebarContent.tsx`
**Updates Needed:**
- [ ] Update filtering to use categories
- [ ] Update to use `name`/`slug`

---

## 🎨 New UI Components to Create

#### 26. `MapMemberManagement` Component
**New File:** `src/app/map/[id]/components/MapMemberManagement.tsx`
**Features:**
- [ ] List members with roles
- [ ] Invite members (email/username search)
- [ ] Promote/demote members
- [ ] Remove members
- [ ] Show member count

#### 27. `MapMembershipRequests` Component
**New File:** `src/app/map/[id]/components/MapMembershipRequests.tsx`
**Features:**
- [ ] List pending requests
- [ ] Display answers to custom questions
- [ ] Approve/reject actions
- [ ] Show request count

#### 28. `MapCategoriesManager` Component
**New File:** `src/app/map/[id]/components/MapCategoriesManager.tsx`
**Features:**
- [ ] Add/remove categories
- [ ] Show current categories
- [ ] Category badges

#### 29. `MapRoleBadge` Component
**New File:** `src/components/map/MapRoleBadge.tsx`
**Features:**
- [ ] Display role badge (Owner, Manager, Editor)
- [ ] Different styling per role

---

## 🔄 Data Fetching Updates

#### 30. All Map Queries
**Files:** All components fetching map data
**Updates Needed:**
- [ ] Update Supabase queries to select `name`, `slug`, `settings`
- [ ] Include `member_count` in selects
- [ ] Join `map_categories` for filtering
- [ ] Join `map_members` to check user role
- [ ] Filter by `is_active = true`

---

## 📊 Summary

### Pages: 5
1. `/maps` - Listing
2. `/maps/new` - Creation
3. `/map/[id]` - Individual map
4. `/map/[id]/settings` - Settings
5. `/profile/[slug]/map` - Profile maps

### Components: 12
- MapCard, MapIDBox, MapInfoCard, MapSettingsSidebar
- MapEntitySlideUp, MapPinForm, MapAreaDrawModal
- MapsSelectorDropdown, MapDetailsModal, ProfileMapsContainer
- MapsSidebarContent, MapPageLayout

### API Routes: 10 existing + 3 new
- Update 10 existing routes
- Create 3 new routes (members, membership-requests, categories)

### New Components: 4
- MapMemberManagement, MapMembershipRequests, MapCategoriesManager, MapRoleBadge

### Types: Multiple
- Update all map-related TypeScript interfaces

---

## 🚀 Recommended Update Order

1. **TypeScript Types** - Update all interfaces first
2. **API Routes** - Update existing, create new
3. **Core Pages** - `/maps`, `/maps/new`, `/map/[id]`
4. **Components** - Update display components
5. **New Features** - Member management, requests, categories
6. **Testing** - Verify all flows
