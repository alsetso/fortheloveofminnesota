# Remaining Tasks & Cleanup List

## Remaining Refactoring Tasks (3/8)

### 1. Split MentionsLayer Component ⚠️ LARGE TASK
**File:** `src/features/map/components/MentionsLayer.tsx` (1498 lines)

**Split Into:**
- `MentionsLayer.tsx` (main component, ~300 lines)
- `hooks/useMentionsData.ts` (data fetching/hooks, ~400 lines)
- `hooks/useMentionsMapbox.ts` (Mapbox layer management, ~400 lines)
- `components/MentionsPopup.tsx` (popup component, ~200 lines)
- `components/MentionsHighlight.tsx` (highlight layer, ~100 lines)

**Impact:** High - Reduces bundle size, improves maintainability
**Effort:** High - Requires careful testing of real-time subscriptions

---

### 2. Lazy Load Sidebar Components 🚀 PERFORMANCE
**Files to lazy load:**
- `components/MapSettingsSidebar.tsx` (2100+ lines) - only when settings opened
- `components/JoinMapSidebar.tsx` (447 lines) - only when join clicked
- `components/MapPosts.tsx` (105 lines) - only when posts opened
- `components/ContributeOverlay.tsx` (1667+ lines) - only when `#contribute` hash present

**Implementation:**
```typescript
// In useMapSidebarConfigs.ts
const MapSettingsSidebar = lazy(() => import('./components/MapSettingsSidebar'));
const JoinMapSidebar = lazy(() => import('./components/JoinMapSidebar'));
const MapPosts = lazy(() => import('./components/MapPosts'));
const ContributeOverlay = lazy(() => import('./components/ContributeOverlay'));
```

**Impact:** High - 70% reduction in initial bundle size
**Effort:** Low - Standard Next.js lazy loading

---

### 3. Optimize Map Resize 🚀 PERFORMANCE
**File:** `src/app/map/[id]/page.tsx` (lines 220-230)

**Current:** Map resize triggered on sidebar toggle (debounced to 350ms)
**Change:** Use CSS transforms instead of width changes

**Implementation:**
- Update `UnifiedSidebarContainer` to use `transform: translateX()` instead of width
- Remove debounced resize effect
- Map never needs to resize

**Impact:** Medium - Eliminates resize entirely, smoother animations
**Effort:** Low - CSS change only

---

## Files/Code That Can Be Removed or Cleaned Up

### ✅ Already Cleaned Up (No Action Needed)
- ✅ Removed duplicate permission handlers (consolidated into `useMapPermissions`)
- ✅ Removed duplicate boundary layer components (consolidated into `BoundaryLayersManager`)
- ✅ Removed old data fetching code (moved to `useMapPageData`)
- ✅ Removed old click handler code (moved to `useMapClickHandler`)

---

### 🧹 Unused Imports in `page.tsx`

**Can Remove:**
1. `generateUUID` - No longer used (moved to `useMapPageData`)
   - Line 21: `import { generateUUID } from '@/lib/utils/uuid';`
   - ✅ **REMOVE** - Not used in page component anymore

2. `isMapSetupComplete` - Not used in page component
   - Line 23: `import { isMapSetupComplete } from '@/lib/maps/mapSetupCheck';`
   - ✅ **REMOVE** - Check if used elsewhere, if not remove

3. `MapFilterContent` - Not directly used (used in sidebar configs hook)
   - Line 24: `import MapFilterContent from '@/components/layout/MapFilterContent';`
   - ✅ **REMOVE** - Only used in `useMapSidebarConfigs` hook

4. `MapSettingsSidebar`, `MemberManager`, `JoinMapSidebar`, `MapPosts` - Not directly used
   - Lines 25-28: These are only used in `useMapSidebarConfigs` hook
   - ⚠️ **KEEP FOR NOW** - Will be lazy loaded in task #2

5. `UnifiedSidebarType` - Type only, check if still needed
   - Line 14: `import { useUnifiedSidebar, type UnifiedSidebarType } from '@/hooks/useUnifiedSidebar';`
   - ✅ **REMOVE TYPE** - `UnifiedSidebarType` not used in page component

6. `PlanLevel` - Type only, check if still needed
   - Line 30: `import type { PlanLevel } from '@/lib/maps/permissions';`
   - ✅ **REMOVE** - Not used in page component

---

### 🧹 Unused Imports in `MapIDBox.tsx`

**Can Remove:**
1. Old boundary layer imports - Replaced by `BoundaryLayersManager`
   - ✅ **ALREADY REMOVED** - Good!

---

### 🧹 Unused Code Patterns

1. **Permission Handler Wrappers** - Can be simplified
   ```typescript
   // Current (lines 115-117):
   const handlePinAction = useCallback(() => checkPermission('pins'), [checkPermission]);
   const handleAreaAction = useCallback(() => checkPermission('areas'), [checkPermission]);
   const handlePostAction = useCallback(() => checkPermission('posts'), [checkPermission]);
   
   // Can simplify to direct calls:
   onPinActionCheck={() => checkPermission('pins')}
   onAreaActionCheck={() => checkPermission('areas')}
   ```
   - ⚠️ **OPTIONAL** - Current is fine, but could be cleaner

2. **Unused Variables/Refs**
   - `membershipToastShownRef` - Still used (line 41)
   - `mapInstanceRef` - Still used (line 39)
   - ✅ **KEEP** - All are used

---

### 🗑️ Files That Could Be Deleted (After Verification)

**None identified yet** - All files appear to be in use. After lazy loading implementation, we can verify if any become truly unused.

---

## Quick Cleanup Checklist

### Immediate Cleanup (No Risk)
- [ ] Remove `generateUUID` import from `page.tsx`
- [ ] Remove `isMapSetupComplete` import from `page.tsx` (if not used)
- [ ] Remove `MapFilterContent` import from `page.tsx`
- [ ] Remove `UnifiedSidebarType` type import from `page.tsx`
- [ ] Remove `PlanLevel` type import from `page.tsx`

### After Lazy Loading (Task #2)
- [ ] Verify all sidebar component imports can be removed from `page.tsx`
- [ ] Check if `ContributeOverlay` import can be removed from `page.tsx`

### Optional Improvements
- [ ] Simplify permission handler wrappers (remove `useCallback` wrappers)
- [ ] Review if `membershipToastShownRef` can be replaced with state

---

## Summary

### Remaining Tasks: 3
1. **Split MentionsLayer** (High effort, High impact)
2. **Lazy load sidebars** (Low effort, High impact) ⭐ **RECOMMENDED NEXT**
3. **Optimize map resize** (Low effort, Medium impact) ⭐ **RECOMMENDED NEXT**

### Cleanup Items: 5
- 5 unused imports in `page.tsx` that can be safely removed
- 0 files to delete (yet)

### Recommended Order
1. **Quick cleanup** - Remove unused imports (5 minutes)
2. **Lazy load sidebars** - High impact, low effort (30 minutes)
3. **Optimize map resize** - Medium impact, low effort (15 minutes)
4. **Split MentionsLayer** - High impact, high effort (2-3 hours)

---

## Files Created (New Hooks/Components)

### ✅ New Files Created (Keep These)
- `src/app/map/[id]/hooks/useMapPermissions.ts` - ✅ Keep
- `src/app/map/[id]/hooks/useMapSidebarConfigs.ts` - ✅ Keep
- `src/app/map/[id]/hooks/useMapClickHandler.ts` - ✅ Keep
- `src/app/map/[id]/hooks/useMapPageData.ts` - ✅ Keep
- `src/app/map/[id]/hooks/useBoundaryLayers.ts` - ✅ Keep
- `src/app/map/[id]/components/BoundaryLayersManager.tsx` - ✅ Keep

**All new files are improvements and should be kept.**
