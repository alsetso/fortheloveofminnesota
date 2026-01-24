# Gov System Cleanup Review

## Complete File Inventory

### `/src/app/gov/` - Main Gov Routes

#### Active Files (In Use)
- ✅ `page.tsx` - Main gov landing page (uses GovPageClient)
- ✅ `GovPageClient.tsx` - Client component for main gov page
- ✅ `GovTablesClient.tsx` - Main table component for orgs/people/roles
- ✅ `contexts/GovTabContext.tsx` - Tab state management
- ✅ `components/GovPageViewTracker.tsx` - Analytics tracking

#### People Routes
- ✅ `people/page.tsx` - Main people page (two-column layout)
- ✅ `people/PeoplePageClient.tsx` - Client component for people page
- ✅ `people/admin/page.tsx` - Admin-only editable table view
- ✅ `person/[slug]/page.tsx` - Person detail page
- ✅ `person/[slug]/PersonPageClient.tsx` - Person page client (edit button)
- ✅ `person/[slug]/PersonEditModal.tsx` - Person edit modal

#### Organization Routes
- ✅ `orgs/page.tsx` - Organizations list page
- ✅ `org/[slug]/page.tsx` - Organization detail page
- ✅ `org/[slug]/OrgPageClient.tsx` - Org page client (edit button)
- ✅ `org/[slug]/OrgEditModal.tsx` - Org edit modal

#### Roles Routes
- ✅ `roles/page.tsx` - Roles list page

#### Checkbook Routes
- ✅ `checkbook/page.tsx` - Checkbook landing page
- ✅ `checkbook/budget/page.tsx` - Budget page
- ✅ `checkbook/budget/BudgetTable.tsx` - Budget table component
- ✅ `checkbook/budget/BudgetSummary.tsx` - Budget summary component
- ✅ `checkbook/contracts/page.tsx` - Contracts page
- ✅ `checkbook/contracts/CheckbookTable.tsx` - Contracts table component
- ✅ `checkbook/payments/page.tsx` - Payments page
- ✅ `checkbook/payroll/page.tsx` - Payroll page
- ✅ `checkbook/payroll/PayrollTable.tsx` - Payroll table component

#### Community Edits
- ✅ `community-edits/page.tsx` - Community edits page
- ✅ `community-edits/CommunityEditsClient.tsx` - Community edits client

---

### `/src/features/civic/components/` - Civic Components

#### Active Components (In Use)
- ✅ `Breadcrumbs.tsx` - Used via `@/components/civic/Breadcrumbs`
- ✅ `CommunityBanner.tsx` - Used in GovTablesClient
- ✅ `EditableFieldBadge.tsx` - Used in GovTablesClient
- ✅ `EditButton.tsx` - Used in PersonPageClient, OrgPageClient
- ✅ `EntityEditHistory.tsx` - Used in person/org detail pages (admin-only)
- ✅ `FormInput.tsx` - Used in edit modals
- ✅ `FormSelect.tsx` - Used in edit modals
- ✅ `FormTextarea.tsx` - Used in edit modals
- ✅ `ImageUpload.tsx` - Used in GovTablesClient
- ✅ `InlineEditField.tsx` - Used in GovTablesClient
- ✅ `LastEditedIndicator.tsx` - Used in person/org pages (admin-only)
- ✅ `OrgChart.tsx` - Used in org detail page
- ✅ `PersonAvatar.tsx` - Used in person detail page

#### Unused Components (Candidates for Removal)
- ❌ `BranchCard.tsx` - Base component, only used by other unused branch cards
- ❌ `ExecutiveBranchCard.tsx` - No imports found (only imports BranchCard)
- ❌ `JudicialBranchCard.tsx` - No imports found (only imports BranchCard)
- ❌ `LegislativeBranchCard.tsx` - No imports found (only imports BranchCard)
- ❌ `EditHistory.tsx` - Replaced by EntityEditHistory, no imports found
- ❌ `RecentEditsFeed.tsx` - No imports found
- ❌ `EditableCell.tsx` - No imports found (related hook `useEditableCell` also unused)
- ❌ `ErrorToast.tsx` - No imports found

---

### `/src/features/civic/utils/` - Civic Utilities

#### Active Utilities (In Use)
- ✅ `civicEditLogger.ts` - Used throughout for edit logging
- ✅ `permissions.ts` - Used for type definitions
- ✅ `breadcrumbs.ts` - Used in org detail page (`buildOrgBreadcrumbs`)

#### Unused Utilities (Candidates for Removal)
- ❌ `metadata.ts` - Contains `generateGovMetadata` and `generateBranchMetadata` but no imports found

---

### `/src/components/civic/` - Civic Components

#### Active Components
- ✅ `Breadcrumbs.tsx` - Used throughout gov pages

---

## Cleanup Recommendations

### High Priority - Remove Unused Files

1. **Branch Card Components** (4 files)
   - `src/features/civic/components/BranchCard.tsx`
   - `src/features/civic/components/ExecutiveBranchCard.tsx`
   - `src/features/civic/components/JudicialBranchCard.tsx`
   - `src/features/civic/components/LegislativeBranchCard.tsx`
   - **Reason**: No imports found anywhere in codebase. These appear to be planned but never implemented.

2. **EditHistory Component**
   - `src/features/civic/components/EditHistory.tsx`
   - **Reason**: Replaced by `EntityEditHistory.tsx`, no imports found

3. **RecentEditsFeed Component**
   - `src/features/civic/components/RecentEditsFeed.tsx`
   - **Reason**: No imports found

4. **EditableCell Component**
   - `src/features/civic/components/EditableCell.tsx`
   - **Reason**: No imports found

5. **ErrorToast Component**
   - `src/features/civic/components/ErrorToast.tsx`
   - **Reason**: No imports found

6. **Metadata Utility**
   - `src/features/civic/utils/metadata.ts`
   - **Reason**: Contains helper functions but no imports found

7. **useEditableCell Hook** (bonus cleanup)
   - `src/hooks/useEditableCell.ts`
   - **Reason**: Related to EditableCell, also unused

### Medium Priority - Verify Before Removal

1. **Check if Branch Cards were planned but not implemented**
   - If these were for a future feature, consider keeping with a TODO comment
   - Otherwise, safe to remove

2. **Verify metadata.ts usage**
   - Check if `generateGovMetadata` or `generateBranchMetadata` were intended for future use
   - Currently all pages use inline metadata generation

### Low Priority - Code Organization

1. **Consider consolidating edit modals**
   - `PersonEditModal.tsx` and `OrgEditModal.tsx` share similar patterns
   - Could extract common form components, but not critical

2. **Checkbook table components**
   - All checkbook tables follow similar patterns
   - Could extract common table logic, but not critical

---

## Files Summary

### Total Files: 28 (including hook)
- **Active/In Use**: 22
- **Unused (Remove)**: 6 (5 components + 1 hook)
- **Verify Before Removal**: 0

### Breakdown by Category
- **Routes/Pages**: 15 (all active)
- **Client Components**: 6 (all active)
- **Shared Components**: 12 (7 active, 5 unused)
- **Utilities**: 3 (2 active, 1 unused)
- **Contexts**: 1 (active)

---

## Pre-Commit Checklist

- [ ] Remove unused branch card components (4 files)
- [ ] Remove EditHistory.tsx
- [ ] Remove RecentEditsFeed.tsx
- [ ] Remove EditableCell.tsx
- [ ] Remove ErrorToast.tsx
- [ ] Remove metadata.ts utility
- [ ] Remove useEditableCell.ts hook (bonus cleanup)
- [ ] Verify no broken imports after removal
- [ ] Run linter to check for errors
- [ ] Test main gov pages still work
- [ ] Test person/org detail pages still work
- [ ] Test admin functionality still works
- [ ] Verify git status shows only expected changes

---

## Notes

- All checkbook routes are active and in use
- All main gov routes (people, orgs, roles) are active
- Edit functionality is properly gated behind admin checks
- Community edits page is active
- All table components are actively used
