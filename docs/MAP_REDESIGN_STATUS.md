# Map Redesign Status & Next Steps

## ✅ What We've Achieved (Phases 1 & 2 Complete)

### Database Structure
- ✅ `map_members` table with roles (owner, manager, editor)
- ✅ `map_membership_requests` table with custom questions
- ✅ `map_categories` table (many-to-many)
- ✅ New columns: `is_active`, `auto_approve_members`, `membership_rules`, `membership_questions`, `member_count`, `settings` JSONB
- ✅ Helper functions: `is_map_member()`, `is_map_manager()`, `is_map_admin()`, `is_map_owner()`
- ✅ Slug generation function
- ✅ Member count trigger
- ✅ All existing owners migrated to `map_members`
- ✅ Settings migrated to JSONB structure
- ✅ Categories migrated from `type`/`collection_type`
- ✅ Slugs generated for all maps

### Current State
- **Old columns still exist** (for backward compatibility)
- **New structure is ready** and populated
- **Both old and new columns sync** via triggers

---

## 🎯 Ideal Outcome We're Building Toward

### Maps Work Like Groups
- Simple visibility: `public` or `private` (no "shared")
- Member management: owner, manager, editor roles
- Member stats: `member_count` + `view_count` displayed
- Soft delete: `is_active` flag

### Clean Structure
- `name` + `slug` (always required, auto-gen for hobby plans)
- `settings` JSONB consolidates all configuration
- Categories as many-to-many (flexible filtering)
- Member system replaces boolean collaboration flags

### User Experience
- **Creation**: Name, description, visibility only → fast start
- **Settings**: All config in one place (Appearance, Collaboration, Presentation)
- **Discovery**: Unified community feed with Featured at top
- **My Maps**: Shows "member of" maps with role badges
- **Profile**: Shows "owned" maps separately

---

## 📋 What's Next (Simple Bullets)

### Phase 3: Database Cleanup
- [ ] Remove old columns: `title`, `custom_slug`, `type`, `collection_type`, `map_style`, `map_layers`, `meta`, `hide_creator`, `is_primary`, `allow_others_to_*`
- [ ] Remove 'shared' from visibility enum
- [ ] Make `slug` NOT NULL (after ensuring all maps have slugs)
- [ ] Remove sync triggers (no longer needed)

### Code Updates Required

#### API Routes
- [ ] Update `/api/maps` GET to use `name`/`slug` and `settings`
- [ ] Update `/api/maps` POST to simplified creation (name, description, visibility)
- [ ] Update `/api/maps/[id]` GET/PUT to use new structure
- [ ] Create `/api/maps/[id]/members` endpoints (GET, POST, PUT, DELETE)
- [ ] Create `/api/maps/[id]/membership-requests` endpoints
- [ ] Update `/api/maps/[id]/pins` to check member roles + settings.collaboration
- [ ] Update `/api/maps/[id]/areas` to check member roles + settings.collaboration

#### TypeScript Types
- [ ] Update `MapData` interface to use `name`, `slug`, `settings`
- [ ] Add `MapMember` type
- [ ] Add `MapMembershipRequest` type
- [ ] Update all map-related types

#### UI Components
- [ ] Simplify `/maps/new` page (remove all settings, just name/description/visibility)
- [ ] Update `/maps` page:
  - Unified community feed
  - Featured maps at top
  - My Maps shows only "member of" (not owned)
- [ ] Update `/map/[id]` page:
  - Consolidated settings sidebar with collapsible sections
  - Member management UI
  - Membership requests UI
- [ ] Add "My Maps" section to profile page (shows owned maps)
- [ ] Update `MapCard` to show `member_count` + `view_count`
- [ ] Update `MapSettingsSidebar` to use `settings` JSONB structure

#### RLS Policies
- [ ] Update map RLS to use `is_active` and member functions
- [ ] Ensure private maps require membership
- [ ] Test all permission scenarios

---

## 🚀 Recommended Order

1. **Phase 3 SQL** - Clean up database (remove old columns)
2. **TypeScript Types** - Update all interfaces
3. **API Routes** - Update to use new structure
4. **UI Components** - Update to match new UX
5. **Testing** - Verify all flows work

---

## ⚠️ Breaking Changes to Handle

- `title` → `name` (everywhere in code)
- `custom_slug` → `slug` (everywhere in code)
- `visibility: 'shared'` → `visibility: 'private'` with members
- Settings now in JSONB structure
- Categories now in junction table
- Member roles replace boolean flags
