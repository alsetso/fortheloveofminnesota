# Profile Page Consolidation Plan

## Current Issues

1. **Pin Click Not Working**: URL-based popup state creates race conditions and timing issues
2. **Over-Engineering**: 8+ refs managing state, complex URL synchronization
3. **Unused Code**: `activePopupPinId` state set but never used
4. **Redundant Filtering**: Server already filters pins, client filters again
5. **Complex State Management**: URL params → useEffect → popup opening (error-prone)

## Core Functionality Required

✅ **Must Keep:**
- Map rendering with pins
- Pin click → popup opens immediately
- Pin view tracking (for non-owners)
- Pin deletion (for owners)
- Page view tracking
- Ownership-based UI rendering
- Create pin functionality (for owners)

## Consolidation Strategy

### Phase 1: Simplify Pin Click Handler (CRITICAL FIX)

**Current Flow (Broken):**
```
Click → updateUrlParams() → URL changes → useEffect watches URL → openPopupForPin()
```

**New Flow (Direct):**
```
Click → openPopupForPin() immediately
```

**Changes:**
- Remove `updateUrlParams()` function
- Remove `clearUrlParams()` function  
- Remove URL watching `useEffect` (lines 333-374)
- Remove `urlProcessedRef`, `isUpdatingUrlRef` refs
- Change `handlePinClick` to directly call `openPopupForPin(pin)`

**Impact:** Fixes pin click issue, removes ~100 lines of code

---

### Phase 2: Remove Unused State & Callbacks

**Remove from ProfileMapClient:**
- `activePopupPinId` state (line 62)
- `handlePopupOpen` callback (line 422)
- `handlePopupClose` callback (line 426)
- Remove these props from ProfilePinsLayer

**Remove from ProfilePinsLayer:**
- `onPopupOpen` prop
- `onPopupClose` prop
- `onPopupOpenRef` ref
- `onPopupCloseRef` ref
- Remove calls to these callbacks

**Impact:** Removes ~20 lines, simplifies component interface

---

### Phase 3: Simplify Refs

**Current Refs (8+):**
- `pinsRef` ✅ Keep (needed for stale closure prevention)
- `isOwnProfileRef` ✅ Keep (needed for stale closure prevention)
- `onPinDeletedRef` ✅ Keep (needed for stale closure prevention)
- `popupRef` ✅ Keep (Mapbox popup instance)
- `clickHandlerRef` ✅ Keep (for cleanup)
- `initializedRef` ✅ Keep (prevent double init)
- `locationSelectedHandlerRef` ❌ Remove (unused)
- `styleChangeTimeoutRef` ✅ Keep (style change handling)
- `isHandlingStyleChangeRef` ✅ Keep (prevent race conditions)
- `currentOpenPinIdRef` ✅ Keep (track current popup)
- `urlProcessedRef` ❌ Remove (URL sync removed)
- `isUpdatingUrlRef` ❌ Remove (URL sync removed)
- `onPopupOpenRef` ❌ Remove (unused callbacks)
- `onPopupCloseRef` ❌ Remove (unused callbacks)

**Impact:** Reduces refs from 13 to 8, cleaner code

---

### Phase 4: Remove Client-Side Pin Filtering

**Current:**
- Server filters pins (public vs private)
- Client also filters with `filterPinsForVisitor()`

**Change:**
- Server already sends correct pins based on ownership
- Remove `filterPinsForVisitor()` call
- Remove `displayPins` variable
- Use `localPins` directly

**Exception:** Keep filtering for "visitor view mode" (owner viewing as visitor)

**Impact:** Removes redundant filtering, simpler logic

---

### Phase 5: Consolidate Ownership Logic

**Current:**
- Server determines `isOwnProfile`
- Client hook `useProfileOwnership` also checks
- Multiple ownership checks scattered

**Change:**
- Trust server `isOwnProfile` value
- Use `useProfileOwnership` hook exclusively for:
  - View mode toggle (owner/visitor)
  - Permission checks (canEdit, canCreatePin, canSeePrivatePins)
- Remove duplicate ownership checks

**Impact:** Single source of truth for ownership

---

### Phase 6: Remove Debug Modal

**Current:**
- Debug modal in ProfileMapClient (lines 519-681)
- Only shown in development

**Change:**
- Remove entire debug modal
- Remove `isDebugModalOpen` state
- Remove debug button

**Impact:** Removes ~160 lines of dev-only code

---

### Phase 7: Verify Page View Tracking

**Current:**
- `usePageView()` hook called in ProfileMapClient
- Should track `/profile/[slug]` automatically

**Verification:**
- Check that hook uses `window.location.pathname` correctly
- Verify API endpoint `/api/analytics/view` receives correct `page_url`
- Ensure tracking happens on mount, not on every render

**Status:** ✅ Already working, no changes needed

---

## Code Reduction Summary

| Component | Current Lines | After Consolidation | Reduction |
|-----------|--------------|---------------------|-----------|
| ProfilePinsLayer | ~640 | ~480 | ~160 lines (25%) |
| ProfileMapClient | ~735 | ~575 | ~160 lines (22%) |
| **Total** | **~1375** | **~1055** | **~320 lines (23%)** |

## Implementation Order

1. **Phase 1** (Critical): Fix pin click handler - direct popup opening
2. **Phase 2**: Remove unused state/callbacks
3. **Phase 3**: Simplify refs
4. **Phase 4**: Remove client-side filtering
5. **Phase 5**: Consolidate ownership
6. **Phase 6**: Remove debug modal
7. **Phase 7**: Verify page tracking (no code changes)

## Risk Assessment

**Low Risk:**
- Removing unused code
- Removing debug modal
- Simplifying refs

**Medium Risk:**
- Direct pin click handler (needs testing)
- Removing client-side filtering (verify server filtering works)

**Mitigation:**
- Test pin clicks thoroughly
- Test ownership-based UI rendering
- Test visitor view mode
- Verify page view tracking still works

## Success Criteria

✅ Pin clicks open popup immediately (no delay)
✅ Page view tracking works correctly
✅ Ownership-based UI renders correctly
✅ Owner can create/delete pins
✅ Visitor view mode works for owners
✅ Code reduced by ~20-25%
✅ No functionality lost

