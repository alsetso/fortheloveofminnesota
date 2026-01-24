# Strategic Consolidation Targets

## SITUATION
Current implementation has 4 client components that are 95% identical. Multiple pages repeat the same PageWrapper prop pattern. Header button components are nearly identical.

## OBJECTIVE
Eliminate remaining duplication. Create single source of truth for default PageWrapper patterns. Reduce codebase by additional ~200 lines.

## TARGETS

### TARGET 1: Consolidate 4 Client Components → 1
**STATUS:** 4 components, ~150 lines → 1 component, ~40 lines
**FILES:**
- `GovTablePageClient.tsx` (38 lines)
- `CheckbookPageClient.tsx` (38 lines) 
- `PersonPageClient.tsx` (38 lines)
- `OrgPageClient.tsx` (38 lines)

**DIFFERENCE:** Only content wrapper className varies:
- GovTablePageClient: `scrollbar-hide`
- Others: `px-[10px] py-3`

**SOLUTION:** Create `StandardPageClient` with optional `contentClassName` prop.

**IMPACT:** -110 lines, single source of truth

---

### TARGET 2: Default PageWrapper Props Pattern
**STATUS:** 15+ pages repeat identical prop pattern
**PATTERN:**
```tsx
headerContent={null}
searchComponent={<MapSearchInput onLocationSelect={() => {}} />}
accountDropdownProps={{ onAccountClick: () => {}, onSignInClick: openWelcome }}
searchResultsComponent={<SearchResults />}
```

**SOLUTION:** Add default props to PageWrapper OR create `useDefaultPageWrapperProps()` hook.

**IMPACT:** -200+ lines across pages, eliminates empty handlers

---

### TARGET 3: Merge Header Button Components
**STATUS:** 2 components, 90% identical
**FILES:**
- `LivePageHeaderButtons.tsx` (28 lines)
- `MapPageHeaderButtons.tsx` (32 lines)

**DIFFERENCE:** MapPageHeaderButtons has `showSettings` conditional

**SOLUTION:** Single `SidebarHeaderButtons` component with optional `showRightButton` prop.

**IMPACT:** -30 lines, consistent pattern

---

### TARGET 4: Extract ContentTypeFilters
**STATUS:** 60+ line component embedded in PageWrapper
**FILE:** `PageWrapper.tsx` lines 273-336

**SOLUTION:** Extract to `src/components/layout/ContentTypeFilters.tsx`

**IMPACT:** Better organization, easier to test, PageWrapper smaller

---

## EXECUTION ORDER

### PHASE 1: Extract ContentTypeFilters (5 min)
- Low risk, improves organization
- Extract component, update import

### PHASE 2: Consolidate Client Components (15 min)
- Medium risk, affects 4 files
- Create `StandardPageClient`, update 4 imports

### PHASE 3: Add Default Props to PageWrapper (10 min)
- Low risk, backward compatible
- Add defaults, remove redundant props from pages

### PHASE 4: Merge Header Buttons (10 min)
- Low risk, affects 2 files
- Create unified component, update imports

## TOTAL IMPACT
- **Lines Removed:** ~350 lines
- **Files Deleted:** 6 files
- **Files Created:** 2 files
- **Maintainability:** Significantly improved
- **Performance:** No change (already optimized)

## RISK ASSESSMENT
- **Phase 1:** LOW - extraction only
- **Phase 2:** MEDIUM - affects 4 pages, need to verify className differences
- **Phase 3:** LOW - defaults are backward compatible
- **Phase 4:** LOW - affects 2 pages, straightforward merge

## RECOMMENDATION
**EXECUTE ALL TARGETS.** Total time: ~40 minutes. High impact, low risk. Eliminates remaining duplication. Creates foundation for future pages.
