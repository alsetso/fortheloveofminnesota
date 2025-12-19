# Unused Components - REMOVED ✅

## Removed Folders

### 1. `test-map/` - ✅ REMOVED
- `TestMapCategoryFilters.tsx`
- `TestMapControls.tsx`
- `TestMapLocationSidebar.tsx`
- `TestMapSidebar.tsx`
- `TestMapTopNav.tsx`
- `TestMapWelcomeModal.tsx`
**Status**: No imports found anywhere in active codebase

### 2. `businesses/` - ✅ REMOVED
- `BusinessesListClient.tsx`
- `CreateBusinessForm.tsx`
**Status**: Only API routes exist in `_archive`, no active pages use these components

### 3. `analytics/` - ✅ REMOVED (empty after removing VisitorsList)

## Removed Individual Files

### 4. `analytics/VisitorsList.tsx` - ✅ REMOVED
**Status**: No imports found

### 5. `auth/GuestDetailsModal.tsx` - ✅ REMOVED
**Status**: No imports found

### 6. `locations/LocationListSidebar.tsx` - ✅ REMOVED
**Status**: No imports found (only `CitiesAndCountiesSidebar` is used)

### 7. `ChangePasswordModal.tsx` - ✅ REMOVED
**Status**: No imports found

### 8. `LoginPromptModal.tsx` - ✅ REMOVED
**Status**: No imports found

### 9. `MapDeleteModal.tsx` - ✅ REMOVED
**Status**: No imports found

### 10. `SubscriptionModal.tsx` - ✅ REMOVED
**Status**: No imports found

### 11. `SearchNav.tsx` - ✅ REMOVED
**Status**: No imports found (uses `BaseNav` internally but component itself unused)

### 12. `feed/NavSidebar.tsx` - ✅ REMOVED
**Status**: No imports found

### 13. `profile/ProfileCardOverlay.tsx` - ✅ REMOVED
**Status**: Exported in `profile/index.ts` but no imports found (export also removed)

## Summary

**Total removed:**
- 3 complete folders (test-map, businesses, analytics)
- 10 individual component files
- 1 export removed from `profile/index.ts`

**Note**: All components in `_archive/` folders are intentionally archived and remain untouched.

