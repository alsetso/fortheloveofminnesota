# PageWrapper Consolidation & Codebase Cleanup Plan

## Executive Summary

This document outlines comprehensive considerations for consolidating PageWrapper usage across the codebase, including files to remove, performance optimizations, and questions developers should ask but often don't.

## Files That Can Be Removed

### 1. Duplicate Wrapper Components (Can Be Consolidated)

All of these wrappers are **identical** - they just wrap `PageWrapper` with the same props:

#### ❌ **DELETE THESE FILES:**
- `src/app/gov/GovTablePageWrapper.tsx` (38 lines)
- `src/app/gov/checkbook/CheckbookPageWrapper.tsx` (38 lines)
- `src/app/gov/person/[slug]/PersonPageWrapper.tsx` (38 lines)
- `src/app/gov/org/[slug]/OrgPageWrapper.tsx` (38 lines)
- `src/app/map/[id]/settings/MapSettingsPageWrapper.tsx` (needs verification)

**Why:** They're all identical wrappers that just pass the same props to `PageWrapper`. Pages can import `PageWrapper` directly.

**Migration:** Replace wrapper imports with direct `PageWrapper` usage:
```tsx
// Before
import GovTablePageWrapper from '../GovTablePageWrapper';
<GovTablePageWrapper>{children}</GovTablePageWrapper>

// After
import PageWrapper from '@/components/layout/PageWrapper';
<PageWrapper
  headerContent={null}
  searchComponent={<MapSearchInput onLocationSelect={() => {}} />}
  accountDropdownProps={{ onAccountClick: () => {}, onSignInClick: openWelcome }}
  searchResultsComponent={<SearchResults />}
>
  {children}
</PageWrapper>
```

**Impact:** Removes ~150 lines of duplicate code, simplifies imports

### 2. Deprecated PageLayout Component

#### ⚠️ **REVIEW & POTENTIALLY REMOVE:**
- `src/components/layout/PageLayout.tsx` (108 lines)

**Status:** Marked as `@deprecated` but still used in:
- `src/components/errors/ErrorBoundary.tsx`

**Action:** 
1. Update `ErrorBoundary.tsx` to use `SimplePageLayout` or `PageWrapper`
2. Remove `PageLayout.tsx` after migration

**Why:** Component is deprecated, adds confusion, only 1 usage left

### 3. Unused/Dead Code (From Previous Audits)

#### ❌ **CONFIRM & REMOVE IF UNUSED:**
- Unused imports in `LiveMap.tsx`: `Map3DControlsSecondaryContent`, `DailyWelcomeModal`, `VisitorStats`, `usePathname`
- `initializedRef` in `LiveMap.tsx` (set but never meaningfully checked)
- Auth refs (`userRef`, `authLoadingRef`, `openWelcomeRef`) - hooks already provide latest values

**Action:** Run unused import detection, remove confirmed dead code

## Performance Optimizations

### 1. PageWrapper Component Optimizations

#### Current Issues:
```tsx
// ❌ PROBLEM: navItems recreated on every render
const navItems = [
  { label: 'Home', href: '/', icon: HomeIcon, iconSolid: HomeIconSolid },
  // ... 8 items
];

// ❌ PROBLEM: Multiple useEffect hooks watching same things
useEffect(() => { setMounted(true); }, []);
useEffect(() => { /* hash check */ }, [mounted]);
useEffect(() => { /* hash check */ }, [pathname, mounted]);
```

#### Optimizations:

**A. Memoize navItems:**
```tsx
const navItems = useMemo(() => [
  { label: 'Home', href: '/', icon: HomeIcon, iconSolid: HomeIconSolid },
  // ...
], []); // Empty deps - never changes
```

**B. Consolidate hash checking:**
```tsx
// Single effect instead of 3
useEffect(() => {
  if (!mounted) return;
  
  const checkHash = () => setIsSearchMode(window.location.hash === '#search');
  checkHash(); // Initial check
  
  window.addEventListener('hashchange', checkHash);
  window.addEventListener('popstate', checkHash);
  
  return () => {
    window.removeEventListener('hashchange', checkHash);
    window.removeEventListener('popstate', checkHash);
  };
}, [mounted]); // Only depends on mounted
```

**C. Memoize headerContent rendering:**
```tsx
// If headerContent is a function/component, memoize it
const memoizedHeaderContent = useMemo(() => headerContent, [headerContent]);
```

**Impact:** Reduces re-renders, improves performance on navigation

### 2. Sidebar State Management

#### Current Pattern (Repeated in 3 places):
```tsx
// ❌ PROBLEM: Same pattern duplicated in /feed, /live, /map/[id]
const [isLeftSidebarVisible, setIsLeftSidebarVisible] = useState(true);
const [isRightSidebarVisible, setIsRightSidebarVisible] = useState(true);
const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(false);
const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
```

#### Optimization: Create Reusable Hook

**Create:** `src/hooks/useSidebarState.ts`
```tsx
export function useSidebarState(initialLeft = true, initialRight = true) {
  const [isLeftSidebarVisible, setIsLeftSidebarVisible] = useState(initialLeft);
  const [isRightSidebarVisible, setIsRightSidebarVisible] = useState(initialRight);
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(false);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);

  const toggleLeft = useCallback(() => {
    const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
    if (isDesktop) {
      setIsLeftSidebarVisible(v => !v);
    } else {
      setIsRightPanelOpen(false);
      setIsLeftPanelOpen(v => !v);
    }
  }, []);

  const toggleRight = useCallback(() => {
    const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
    if (isDesktop) {
      setIsRightSidebarVisible(v => !v);
    } else {
      setIsLeftPanelOpen(false);
      setIsRightPanelOpen(v => !v);
    }
  }, []);

  return {
    isLeftSidebarVisible,
    isRightSidebarVisible,
    isLeftPanelOpen,
    isRightPanelOpen,
    toggleLeft,
    toggleRight,
    closeLeftPanel: () => setIsLeftPanelOpen(false),
    closeRightPanel: () => setIsRightPanelOpen(false),
  };
}
```

**Impact:** Reduces code duplication, centralizes logic, easier to maintain

### 3. Header Icon Button Component

#### Current Pattern (Repeated):
```tsx
// ❌ PROBLEM: Same button pattern repeated everywhere
<button
  onClick={toggleLeft}
  className="flex items-center justify-center w-8 h-8 text-white/70 hover:text-white hover:bg-white/10 rounded-md transition-colors"
  aria-label="Toggle left sidebar"
>
  <FunnelIcon className="w-5 h-5" />
</button>
```

#### Optimization: Create Reusable Component

**Create:** `src/components/layout/SidebarToggleButton.tsx`
```tsx
interface SidebarToggleButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  ariaLabel: string;
  title?: string;
}

export default function SidebarToggleButton({
  icon: Icon,
  onClick,
  ariaLabel,
  title,
}: SidebarToggleButtonProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center w-8 h-8 text-white/70 hover:text-white hover:bg-white/10 rounded-md transition-colors"
      aria-label={ariaLabel}
      title={title}
    >
      <Icon className="w-5 h-5" />
    </button>
  );
}
```

**Impact:** Consistent styling, easier to update globally, reduces duplication

## Questions Developers Should Ask (But Often Don't)

### 1. **State Management Questions**

❓ **"Do we really need this state, or can we derive it?"**
- Example: `isSearchMode` in PageWrapper - could be derived from `window.location.hash`
- Example: `mounted` state - could use `useIsomorphicLayoutEffect` pattern

❓ **"Is this state shared across components? Should it be in Context?"**
- Example: Sidebar visibility state - currently duplicated in 3 places
- Example: Modal state - some use `useLivePageModals`, others use local state

❓ **"Are we using refs when we should use state, or vice versa?"**
- Example: Auth refs (`userRef`, `authLoadingRef`) - hooks already provide latest values
- Example: `temporaryMarkerRef` - might need to be state if it affects rendering

### 2. **Performance Questions**

❓ **"Are we creating new objects/arrays on every render?"**
- Example: `navItems` array in PageWrapper - should be memoized
- Example: Event handler functions - should use `useCallback`

❓ **"Do we have multiple useEffect hooks watching the same thing?"**
- Example: PageWrapper has 3 effects watching hash/pathname - could be 1
- Example: LiveMap has multiple effects managing markers - could be consolidated

❓ **"Are we re-rendering unnecessarily due to prop changes?"**
- Example: `headerContent` prop - if it's a component, should be memoized
- Example: `searchComponent` prop - check if parent re-creates it on every render

### 3. **Code Organization Questions**

❓ **"Is this component doing too much? Should it be split?"**
- Example: `LiveMap.tsx` (1644 lines) - should be split into feature components
- Example: `PageWrapper.tsx` (337 lines) - could extract `ContentTypeFilters` to separate file

❓ **"Are we duplicating logic that should be shared?"**
- Example: Sidebar toggle logic - duplicated in 3 places
- Example: Header button styling - duplicated everywhere

❓ **"Do we have wrapper components that just pass props through?"**
- Example: All the `*PageWrapper` components - they're just thin wrappers

### 4. **Architecture Questions**

❓ **"Are we using window events when we should use React patterns?"**
- Example: 24+ window event listeners in LiveMap - should use Context/state
- Example: `mention-created`, `mention-click` events - could be Context

❓ **"Should this be a server component or client component?"**
- Example: Pages that only fetch data - could be server components
- Example: Pages with lots of interactivity - should be client components

❓ **"Are we fetching data that's already available?"**
- Example: Account data fetched in FeedContent when it's already in auth context
- Example: Duplicate API calls for the same data

### 5. **Accessibility & UX Questions**

❓ **"Do we have proper ARIA labels on interactive elements?"**
- ✅ PageWrapper buttons have `aria-label` - good
- ⚠️ Check all sidebar toggle buttons have proper labels

❓ **"Are keyboard navigation and screen readers supported?"**
- ⚠️ Sidebar toggles - ensure keyboard accessible
- ⚠️ Mobile panels - ensure focus management

❓ **"Do we handle loading and error states properly?"**
- ⚠️ PageWrapper - no loading state
- ⚠️ Sidebar content - check error boundaries

### 6. **Maintainability Questions**

❓ **"If we change this pattern, how many files need updating?"**
- Example: Sidebar toggle pattern - currently 3 files, would be 1 with hook
- Example: Header button styling - currently N files, would be 1 with component

❓ **"Is this code documented well enough for future developers?"**
- ⚠️ PageWrapper - has good JSDoc
- ⚠️ Sidebar logic - needs documentation

❓ **"Are we following our own patterns consistently?"**
- ⚠️ Some pages use `PageWrapper`, others use custom wrappers
- ⚠️ Some pages have sidebars, others don't - need clear rules

## Consolidation Strategy

### Phase 1: Remove Duplicate Wrappers (Low Risk)
1. ✅ Delete `GovTablePageWrapper.tsx`
2. ✅ Delete `CheckbookPageWrapper.tsx`
3. ✅ Delete `PersonPageWrapper.tsx`
4. ✅ Delete `OrgPageWrapper.tsx`
5. ✅ Update all imports to use `PageWrapper` directly
6. ✅ Test all affected pages

**Estimated Time:** 1-2 hours
**Risk:** Low (wrappers are identical)
**Impact:** Removes ~150 lines, simplifies codebase

### Phase 2: Create Reusable Hooks/Components (Medium Risk)
1. ✅ Create `useSidebarState` hook
2. ✅ Create `SidebarToggleButton` component
3. ✅ Update `/feed`, `/live`, `/map/[id]` to use new hook/component
4. ✅ Test sidebar functionality

**Estimated Time:** 2-3 hours
**Risk:** Medium (touches core functionality)
**Impact:** Reduces duplication, improves maintainability

### Phase 3: Optimize PageWrapper (Low Risk)
1. ✅ Memoize `navItems`
2. ✅ Consolidate hash checking effects
3. ✅ Add performance monitoring
4. ✅ Test search mode functionality

**Estimated Time:** 1 hour
**Risk:** Low (optimizations, no behavior change)
**Impact:** Better performance, fewer re-renders

### Phase 4: Remove Deprecated Code (Low Risk)
1. ✅ Update `ErrorBoundary.tsx` to use `SimplePageLayout`
2. ✅ Delete `PageLayout.tsx`
3. ✅ Remove unused imports (run automated check)
4. ✅ Test error boundaries

**Estimated Time:** 1 hour
**Risk:** Low (deprecated code, minimal usage)
**Impact:** Cleaner codebase, less confusion

## Testing Checklist

### Before Consolidation
- [ ] Document current behavior of all affected pages
- [ ] Take screenshots of sidebar states (open/closed) on all pages
- [ ] Test mobile sidebar panels
- [ ] Test search mode functionality
- [ ] Test navigation between pages

### After Each Phase
- [ ] Visual regression test (compare screenshots)
- [ ] Functional test (all interactions work)
- [ ] Performance test (check for regressions)
- [ ] Accessibility test (keyboard navigation, screen readers)

### Final Verification
- [ ] All pages load correctly
- [ ] Sidebars toggle correctly on all pages
- [ ] Mobile panels work correctly
- [ ] Search mode works correctly
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] Performance metrics same or better

## Risk Assessment

### High Risk Areas
- **Sidebar state management** - Core UX feature, used on 3 pages
- **PageWrapper hash checking** - Affects search functionality
- **Mobile panel behavior** - Different from desktop, harder to test

### Medium Risk Areas
- **Wrapper component removal** - Many files affected, but low complexity
- **Hook/component creation** - New patterns, need thorough testing

### Low Risk Areas
- **Performance optimizations** - Shouldn't change behavior
- **Dead code removal** - Unused code, minimal impact
- **Documentation updates** - No code changes

## Success Metrics

### Code Quality
- ✅ Reduce duplicate code by ~200 lines
- ✅ Reduce component complexity (split large components)
- ✅ Improve code reusability (hooks/components)

### Performance
- ✅ Reduce unnecessary re-renders by 20%+
- ✅ Improve initial page load time
- ✅ Reduce bundle size (remove unused code)

### Maintainability
- ✅ Single source of truth for sidebar logic
- ✅ Consistent patterns across codebase
- ✅ Better documentation

## Additional Considerations

### 1. TypeScript Types
- Create shared types for sidebar props
- Create shared types for PageWrapper props
- Ensure type safety across all changes

### 2. Documentation
- Update component documentation
- Add JSDoc comments to new hooks/components
- Update architecture docs

### 3. Migration Path
- Create migration guide for other developers
- Document breaking changes (if any)
- Provide examples of new patterns

### 4. Future Enhancements
- Consider making sidebars configurable via props
- Consider making header icons configurable
- Consider adding sidebar animations/transitions

## Files to Update

### Direct PageWrapper Usage (Replace Wrappers)
- `src/app/gov/people/page.tsx`
- `src/app/gov/orgs/page.tsx`
- `src/app/gov/roles/page.tsx`
- `src/app/gov/checkbook/page.tsx`
- `src/app/gov/checkbook/budget/page.tsx`
- `src/app/gov/checkbook/contracts/page.tsx`
- `src/app/gov/checkbook/payments/page.tsx`
- `src/app/gov/checkbook/payroll/page.tsx`
- `src/app/gov/person/[slug]/page.tsx`
- `src/app/gov/org/[slug]/page.tsx`
- `src/app/map/[id]/settings/page.tsx` (if exists)

### Use New Hook/Component
- `src/app/feed/page.tsx`
- `src/app/live/page.tsx`
- `src/app/map/[id]/page.tsx`

### Update ErrorBoundary
- `src/components/errors/ErrorBoundary.tsx`

## Conclusion

This consolidation will:
1. **Remove ~200 lines** of duplicate code
2. **Improve performance** through optimizations
3. **Increase maintainability** through reusable patterns
4. **Reduce complexity** by removing unnecessary abstractions
5. **Improve consistency** across the codebase

The changes are low-to-medium risk with high impact on code quality and maintainability.
