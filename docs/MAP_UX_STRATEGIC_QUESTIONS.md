# Map Experience: Strategic UX Questions

Based on the current user flows:
- **Map Creation**: `/maps/new` - Multi-step wizard
- **Maps Discovery**: `/maps` - Community (public/admin-managed) + My Maps (user-owned)
- **Map Management**: `/map/[id]` - Individual map page with settings

---

## Strategic Questions (Yes/No)

### 1. **Map Creation Flow**
**Question:** Should the map creation wizard (`/maps/new`) be simplified to just name, description, and visibility (public/private), with all other settings (style, layers, collaboration, etc.) moved to the map settings page after creation?

**Rationale:** Reduces friction during creation, allows users to start quickly and configure later. Matches the "create fast, configure later" pattern.

---

### 2. **Visibility Model**
**Question:** Should we remove the "shared" visibility option and only support "public" and "private", with private maps using the member management system (like groups) for access control?

**Rationale:** Simplifies the mental model. "Shared" is ambiguous - member management makes access control explicit and flexible.

---

### 3. **Community Tab Organization**
**Question:** Should the Community tab on `/maps` show all public maps in a unified feed (removing separate professional/gov sections), with filtering by category tags instead?

**Rationale:** Reduces tab clutter, makes discovery easier. Categories can be many-to-many (map can have multiple tags), more flexible than single collection_type.

---

### 4. **Member Management**
**Question:** Should map owners be able to invite specific users as "contributors" (can add pins/areas) or "admins" (full control), similar to how groups work, instead of relying solely on the "allow others" collaboration flags?

**Rationale:** More granular control. Public collaboration flags can remain for open contribution, but member system allows curated teams.

---

### 5. **Map Statistics Display**
**Question:** Should map cards on `/maps` show member_count, pin_count, and area_count alongside view_count to help users understand map activity and engagement?

**Rationale:** Provides social proof and helps users discover active, collaborative maps. Similar to how groups show member_count.

---

### 6. **Slug Generation**
**Question:** Should custom slugs be auto-generated from the map name (with manual override option) instead of being optional/empty, ensuring every map has a clean URL?

**Rationale:** Better SEO, shareability, and consistency. Auto-generation removes friction while still allowing customization.

---

### 7. **Map Settings Consolidation**
**Question:** Should all map configuration (style, layers, meta, collaboration, presentation) be consolidated into a single "Settings" section on the map page, organized into collapsible subsections (Appearance, Collaboration, Advanced)?

**Rationale:** Reduces cognitive load, makes settings discoverable, cleaner organization than scattered fields.

---

### 8. **Primary Maps Section**
**Question:** Should "Primary Maps" on the Community tab be replaced with a "Featured" section that shows maps marked as featured (by admins), with the ability to sort/filter by popularity, recent activity, or categories?

**Rationale:** More flexible than single "is_primary" flag. Featured can be many maps, sorted by various criteria.

---

### 9. **My Maps Organization**
**Question:** Should "My Maps" tab show all maps the user owns OR is a member of (contributor/admin), with visual indicators for role (Owner, Admin, Contributor), similar to how groups show membership?

**Rationale:** Users can see all maps they have access to, not just ones they created. Encourages collaboration.

---

### 10. **Map Deletion**
**Question:** Should map deletion be a soft delete (sets `is_active = false`) that can be undone, with deleted maps hidden from public view but still accessible to the owner for recovery?

**Rationale:** Prevents accidental data loss, allows recovery, better for analytics. Matches groups pattern.

---

## Answer Format

Please answer each question with:
- **Yes** - Implement this change
- **No** - Keep current approach
- **Maybe** - Needs discussion/clarification

Your answers will guide the implementation priorities and UX refinements.
