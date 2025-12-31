# Civic Schema UI & Navigation Updates

## Current State
- ✅ Gov icon added to Sidebar and SimpleNav
- ✅ `/gov` main page with 3 branches
- ✅ `/gov/legislative`, `/gov/executive`, `/gov/judicial` branch pages
- ✅ Basic org chart display with collapsible nodes
- ✅ Page view tracking on all routes

## Required Updates

### 1. Individual Detail Pages

#### `/gov/org/[slug]` - Organization Detail Page
**Purpose**: Show full details of a single organization (branch, agency, department, court)

**Content**:
- Organization name, type, description
- Website link (if available)
- All current roles with people
- Child organizations (if any)
- Parent organization link (if any)
- Breadcrumb: Home > Government > [Branch] > [Org Name]

**Design**:
- Compact government-style layout
- List of roles with person names and party affiliations
- Collapsible child orgs section
- Link to parent org if exists

#### `/gov/person/[slug]` - Person Detail Page
**Purpose**: Show all roles a person holds across organizations

**Content**:
- Person name, party, photo (if available)
- All current roles across all orgs
- Historical roles (optional, if `is_current = false`)
- Breadcrumb: Home > Government > [Person Name]

**Design**:
- Compact government-style layout
- Grouped by organization
- Show role title, org name, dates

### 2. Navigation & Links

#### Make Org Cards Clickable
- Update `OrgChart.tsx` to make org cards link to `/gov/org/[slug]`
- Only link if org has a slug
- Prevent link click from triggering expand/collapse

#### Add Person Links
- In role displays, make person names link to `/gov/person/[slug]`
- Need to add `slug` field to `civic.people` table (migration needed)

#### Breadcrumb Updates
- Add org/person names to breadcrumbs on detail pages
- Show full path: Home > Government > [Branch] > [Org] > [Sub-Org]

### 3. Role Display Improvements

#### Show All Roles Per Org
**Current**: Only shows primary role in subtitle
**Needed**: 
- Show all current roles for an org
- Display as list: "Governor - Tim Walz (DFL), Lieutenant Governor - Peggy Flanagan (DFL)"
- Or show as separate cards under the org

#### Role Grouping
- Group roles by title (e.g., all "Senator" roles together)
- Show count if multiple people have same title

### 4. List Pages (Optional)

#### `/gov/orgs` - All Organizations
- List all orgs with filters by type (branch, agency, department, court)
- Search functionality
- Link to each org detail page

#### `/gov/people` - All People
- List all people with party filters
- Search functionality
- Link to each person detail page

### 5. Structural Design Changes

#### Org Chart Component Updates
**File**: `src/features/civic/components/OrgChart.tsx`

**Changes**:
1. Add `href` prop to `OrgNode` interface
2. Make cards clickable (Link component) when href exists
3. Prevent expand/collapse when clicking link area
4. Show multiple roles per org (not just primary)

```typescript
interface OrgNode {
  id?: string;
  title: string;
  subtitle?: string;
  href?: string; // NEW
  icon?: React.ReactNode;
  children?: OrgNode[];
  party?: string;
  roles?: Array<{ title: string; person?: { name: string; party?: string } }>; // NEW
}
```

#### Service Updates
**File**: `src/features/civic/services/civicService.ts`

**Changes**:
1. Add `getCivicPersonBySlug()` function
2. Add `getCivicPersonRoles()` function
3. Update `getCivicOrgBySlug()` to return all roles, not just primary
4. Add slug field to people table (migration needed)

### 6. Database Migration Needed

#### Add `slug` to `civic.people` table
```sql
ALTER TABLE civic.people ADD COLUMN slug TEXT UNIQUE;
CREATE INDEX idx_people_slug ON civic.people(slug);
```

### 7. Component Structure

#### New Components Needed
1. `OrgDetailPage.tsx` - Organization detail page component
2. `PersonDetailPage.tsx` - Person detail page component
3. `RoleList.tsx` - Component to display multiple roles
4. `OrgList.tsx` - List view for all orgs (optional)
5. `PersonList.tsx` - List view for all people (optional)

### 8. URL Structure

```
/gov                          → Main page (3 branches)
/gov/legislative              → Legislative branch detail
/gov/executive                → Executive branch detail
/gov/judicial                 → Judicial branch detail
/gov/org/[slug]               → Individual org detail (NEW)
/gov/person/[slug]            → Individual person detail (NEW)
/gov/orgs                     → All orgs list (optional)
/gov/people                   → All people list (optional)
```

### 9. Design System Compliance

All new components must follow:
- **Feed Design System**: Compact government-style minimalism
- **Spacing**: `gap-2` (8px), `p-[10px]` for cards, `space-y-3` (12px) vertical
- **Typography**: `text-xs` (12px) primary, `text-sm` (14px) headings
- **Borders**: `border border-gray-200`, `rounded-md` (6px)
- **Icons**: `w-3 h-3` (12px) or `w-4 h-4` (16px) max
- **Colors**: Limited gray palette, party colors (DFL=blue, Republican=red)

### 10. Page View Tracking

All new pages need:
- `*PageClient.tsx` component with `usePageView()` hook
- Track actual page URLs: `/gov/org/[slug]`, `/gov/person/[slug]`

## Implementation Priority

### Phase 1 (Essential)
1. ✅ Add slug to people table (migration)
2. ✅ Create `/gov/org/[slug]` page
3. ✅ Create `/gov/person/[slug]` page
4. ✅ Make org cards clickable in OrgChart
5. ✅ Update role display to show all roles

### Phase 2 (Enhancement)
6. Add person links in role displays
7. Improve breadcrumb navigation
8. Add role grouping/counting

### Phase 3 (Optional)
9. Create `/gov/orgs` list page
10. Create `/gov/people` list page
11. Add search/filter functionality

