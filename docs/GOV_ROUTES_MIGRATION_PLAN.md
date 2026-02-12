# /gov Routes Inventory & NewPageWrapper Migration Plan

## Complete Route Inventory

### Main Routes
| Route | Current Wrapper | File | Status |
|-------|----------------|------|--------|
| `/gov` | PageWrapper | `src/app/gov/page.tsx` | ✅ Migrate to NewPageWrapper |
| `/gov/people` | StandardPageClient | `src/app/gov/people/page.tsx` | ✅ Migrate to NewPageWrapper |
| `/gov/people/admin` | StandardPageClient | `src/app/gov/people/admin/page.tsx` | ✅ Migrate to NewPageWrapper (Admin-only) |
| `/gov/orgs` | StandardPageClient | `src/app/gov/orgs/page.tsx` | ✅ Migrate to NewPageWrapper |
| `/gov/roles` | StandardPageClient | `src/app/gov/roles/page.tsx` | ✅ Migrate to NewPageWrapper |
| `/gov/org/[slug]` | StandardPageClient | `src/app/gov/org/[slug]/page.tsx` | ✅ Migrate to NewPageWrapper |
| `/gov/person/[slug]` | StandardPageClient | `src/app/gov/person/[slug]/page.tsx` | ✅ Migrate to NewPageWrapper |
| `/gov/checkbook` | StandardPageClient | `src/app/gov/checkbook/page.tsx` | ✅ Migrate to NewPageWrapper |
| `/gov/checkbook/contracts` | StandardPageClient | `src/app/gov/checkbook/contracts/page.tsx` | ✅ Migrate to NewPageWrapper |
| `/gov/checkbook/payments` | StandardPageClient | `src/app/gov/checkbook/payments/page.tsx` | ✅ Migrate to NewPageWrapper |
| `/gov/checkbook/payroll` | StandardPageClient | `src/app/gov/checkbook/payroll/page.tsx` | ✅ Migrate to NewPageWrapper |
| `/gov/checkbook/budget` | StandardPageClient | `src/app/gov/checkbook/budget/page.tsx` | ✅ Migrate to NewPageWrapper |
| `/gov/community-edits` | SimplePageLayout | `src/app/gov/community-edits/page.tsx` | ✅ Migrate to NewPageWrapper |

## Current Wrapper Types

### PageWrapper (Legacy)
- `/gov` - Main gov page

### StandardPageClient
- `/gov/people`
- `/gov/orgs`
- `/gov/roles`
- `/gov/org/[slug]`
- `/gov/person/[slug]`
- `/gov/checkbook`

### SimplePageLayout
- `/gov/community-edits`

### All Routes Documented
- All routes use either `PageWrapper`, `StandardPageClient`, or `SimplePageLayout`
- All need migration to `NewPageWrapper` for consistency

## Migration Strategy

### Phase 1: Main Landing Page (`/gov`)
**Goal**: Transform into the new design with three primary actions

**Current**: Simple directory with links to People and Checkbook
**New Design**:
- Above-the-fold: Three action cards
  - Find My Districts
  - See My Representatives  
  - Follow the Money
- Helper text: "Minnesota's government is organized by place. Start with where you live."
- Government structure overview
- Active government section

**Migration Steps**:
1. Replace `PageWrapper` with `NewPageWrapper`
2. Redesign content to match new design principles
3. Add location-based district finder
4. Add representative lookup
5. Add financial data overview

### Phase 2: Core Directory Pages
**Routes**: `/gov/people`, `/gov/orgs`, `/gov/roles`

**Migration Steps**:
1. Replace `StandardPageClient` with `NewPageWrapper`
2. Keep existing breadcrumbs
3. Maintain table functionality
4. Add left sidebar navigation (if needed)
5. Ensure responsive design

### Phase 3: Detail Pages
**Routes**: `/gov/org/[slug]`, `/gov/person/[slug]`

**Migration Steps**:
1. Replace `StandardPageClient` with `NewPageWrapper`
2. Keep breadcrumbs
3. Maintain edit functionality
4. Add related content sidebar (optional)

### Phase 4: Checkbook Pages
**Routes**: `/gov/checkbook/*`

**Migration Steps**:
1. Check current wrapper for all checkbook sub-routes
2. Replace with `NewPageWrapper`
3. Maintain financial data display
4. Add navigation between checkbook sections

### Phase 5: Utility Pages
**Routes**: `/gov/community-edits`, `/gov/people/admin`

**Migration Steps**:
1. Replace `SimplePageLayout` with `NewPageWrapper`
2. Maintain functionality
3. Ensure admin-only access for admin routes

## New Design Implementation Plan

### `/gov` Main Page Redesign

#### Section 1: Above-the-Fold Actions
```tsx
<div className="grid grid-cols-1 md:grid-cols-3 gap-2">
  <ActionCard
    title="Find My Districts"
    description="Enter your address to see your districts"
    icon={<MapPinIcon />}
    href="/gov/districts"
  />
  <ActionCard
    title="See My Representatives"
    description="View who represents you"
    icon={<UserIcon />}
    href="/gov/representatives"
  />
  <ActionCard
    title="Follow the Money"
    description="Explore government spending"
    icon={<ChartBarIcon />}
    href="/gov/checkbook"
  />
</div>
```

#### Section 2: Minnesota Government Structure
- Visual hierarchy diagram
- Links to explore each branch
- Entity counts

#### Section 3: Leadership at State Level
- Executive leadership cards
- Legislative leadership
- Judicial overview (optional)

#### Section 4: Active Government
- Upcoming sessions
- Recent bills
- Public meetings
- Budget cycles

#### Section 5: Explore Deeper
- Browse all districts
- Browse all representatives
- Explore agencies
- View raw datasets
- Open map with civic layers

## Simplification Opportunities

### Routes to Consider Consolidating
1. **`/gov/people` and `/gov/orgs` and `/gov/roles`**
   - Could be tabs on main `/gov` page instead of separate routes
   - Reduces navigation complexity
   - Keeps all directory data in one place

2. **Checkbook sub-routes**
   - Keep `/gov/checkbook` as landing
   - Consider tabs instead of separate routes for contracts/payments/payroll/budget
   - Or keep separate routes but add better navigation

### Routes to Keep Separate
- `/gov/org/[slug]` - Detail pages need separate routes
- `/gov/person/[slug]` - Detail pages need separate routes
- `/gov/checkbook` - Main financial landing page

## Implementation Checklist

### Step 1: Audit All Routes ✅ COMPLETE
- [x] Check `/gov/people/admin` wrapper → Uses `StandardPageClient`
- [x] Check all `/gov/checkbook/*` sub-routes → All use `StandardPageClient`
- [x] Document current wrapper for each route → All documented above

### Step 2: Create Migration Components
- [ ] Create `GovLeftSidebar` component
- [ ] Create `GovRightSidebar` component (optional)
- [ ] Create action card components for main page
- [ ] Create district finder component
- [ ] Create representative lookup component

### Step 3: Migrate Main Page
- [ ] Update `/gov/page.tsx` to use `NewPageWrapper`
- [ ] Implement new design sections
- [ ] Add location-based features
- [ ] Test responsive design

### Step 4: Migrate Directory Pages
- [ ] Migrate `/gov/people`
- [ ] Migrate `/gov/orgs`
- [ ] Migrate `/gov/roles`
- [ ] Ensure consistent navigation

### Step 5: Migrate Detail Pages
- [ ] Migrate `/gov/org/[slug]`
- [ ] Migrate `/gov/person/[slug]`
- [ ] Maintain edit functionality

### Step 6: Migrate Checkbook Pages
- [ ] Migrate `/gov/checkbook`
- [ ] Migrate all checkbook sub-routes
- [ ] Add navigation between sections

### Step 7: Migrate Utility Pages
- [ ] Migrate `/gov/community-edits`
- [ ] Migrate `/gov/people/admin` (if exists)

### Step 8: Testing & Refinement
- [ ] Test all routes
- [ ] Verify navigation
- [ ] Check responsive design
- [ ] Verify edit functionality
- [ ] Test location-based features

## Design Principles Applied

1. **Show structure before detail** - Main page shows government hierarchy first
2. **Personalize before overwhelming** - Location-based features prioritize user's data
3. **Visualize before explaining** - Diagrams and visual hierarchy
4. **Most people don't want all the data. They want their data.** - Location-first approach

## Notes

- All routes currently use various wrappers (PageWrapper, StandardPageClient, SimplePageLayout)
- Need to standardize on `NewPageWrapper` for consistency
- Main page needs significant redesign to match new principles
- Consider adding left sidebar navigation for gov section
- Location-based features will require new components and potentially new routes
