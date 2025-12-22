# Mentions Migration Review

## Summary
After migrating from `pins` to `mentions` table, review of URL parameters, popup state management, and overall environment.

---

## ✅ URL Parameter Handling

### Profile Pages (`/profile/[username]`)
**Status**: ✅ Working correctly

- **Parameter**: `mentionId` (via `useProfileUrlState` hook)
- **Implementation**: 
  - `useProfileUrlState` manages `mentionId` in URL
  - `ProfilePinsLayer` watches `urlMentionId` and opens popup when present
  - Clean state management with debouncing for rapid switches
- **Flow**:
  1. User clicks mention → `setMentionId(mentionId)` → URL updates to `?mentionId=xxx`
  2. URL has `mentionId` → Effect in `ProfilePinsLayer` → Opens popup
  3. User clicks same mention → `clearMentionId()` → URL cleared → Popup closes

**Files**:
- `src/features/profiles/hooks/useProfileUrlState.ts` - URL state management
- `src/features/profiles/components/ProfilePinsLayer.tsx` - Popup handling (lines 314-349)

### Homepage (`/`)
**Status**: ✅ Working correctly

- **Parameter**: `mention` (different from profile pages)
- **Implementation**:
  - `HomepageMap` watches `searchParams.get('mention')`
  - Dispatches `select-mention-by-id` event
  - `MentionsLayer` listens for event and opens popup
- **Flow**:
  1. URL has `?mention=xxx` → `HomepageMap` dispatches event
  2. `MentionsLayer` receives event → Finds mention → Opens popup
  3. User clicks mention → `MentionsLayer` updates URL with `?mention=xxx`

**Files**:
- `src/features/homepage/components/HomepageMap.tsx` - URL watcher (lines 121-138)
- `src/features/map/components/MentionsLayer.tsx` - Event listener (lines 845-880)

**Note**: Homepage uses `mention` parameter, profile pages use `mentionId`. This is intentional separation.

---

## ✅ Popup State Management

### Profile Pages
**Status**: ✅ Clean implementation

- Uses `currentOpenPinIdRef` to track open popup
- URL is source of truth
- Handles seamless switching between mentions
- Proper cleanup on unmount

### Homepage
**Status**: ✅ Clean implementation

- Uses `currentMentionRef` to track open popup
- URL parameter triggers popup via event system
- Handles mention not found gracefully (waits and retries)

---

## ✅ API Routes

### `/api/analytics/pin-view`
**Status**: ✅ **CREATED**

**Used by**:
- `src/features/profiles/components/ProfilePinsLayer.tsx` (line 268)
- `src/hooks/usePinView.ts` (line 44)

**Should handle**:
```typescript
POST /api/analytics/pin-view
Body: {
  pin_id: string,  // Actually mention ID now
  referrer_url?: string,
  user_agent?: string,
  session_id?: string
}
```

**Implementation**: ✅ Complete
- Located at `src/app/api/analytics/pin-view/route.ts`
- Calls `supabase.rpc('record_pin_view', { p_pin_id: pin_id, ... })`
- Note: `pin_id` parameter name is legacy - it's actually a mention ID

### `/api/analytics/pin-stats`
**Status**: ✅ **CREATED**

**Used by**:
- `src/features/profiles/components/ProfilePinsLayer.tsx` (line 287)

**Should handle**:
```typescript
GET /api/analytics/pin-stats?pin_id=xxx
Response: {
  stats: {
    total_views: number,
    unique_viewers: number,
    accounts_viewed: number
  }
}
```

**Implementation**: ✅ Complete
- Located at `src/app/api/analytics/pin-stats/route.ts`
- Calls `supabase.rpc('get_pin_stats', { p_pin_id: pin_id })`
- Supports optional `hours` query parameter for time filtering
- Note: `pin_id` parameter name is legacy - it's actually a mention ID

---

## ✅ Database Migration

**Status**: ✅ Complete

- `analytics.pin_views.pin_id` now references `public.mentions(id)`
- `record_pin_view()` function updated to check `mentions` table
- `get_pin_viewers()` function updated
- RLS policies updated to check `mentions.account_id`
- Orphaned records cleaned up

**File**: `supabase/migrations/278_drop_pins_table.sql`

---

## 🔍 Other Logic to Review

### 1. MentionsLayer Popup Tracking
**Status**: ⚠️ **NEEDS REVIEW**

`MentionsLayer` opens popups but doesn't track views. Should it?
- Profile pages track via `ProfilePinsLayer`
- Homepage mentions don't track views currently

**Question**: Should homepage mentions track views when opened?

### 2. usePinView Hook
**Status**: ✅ Works but naming is confusing

- Hook name suggests "pin" but works with mentions
- Parameter is `pin_id` but should be `mention_id` for clarity
- Functionality is correct - just naming confusion

**Recommendation**: Consider renaming to `useMentionView` for clarity (non-breaking if we keep `pin_id` parameter for backward compatibility)

### 3. Event Names
**Status**: ✅ Consistent

- `pin-view-tracked` event dispatched after tracking
- `mention-popup-opening` event for homepage
- `select-mention-by-id` event for URL-based selection

### 4. Comments and Documentation
**Status**: ⚠️ **NEEDS UPDATE**

Several places still reference "pins" in comments:
- `ProfilePinsLayer.tsx` - Comments say "pin" but work with mentions
- `usePinView.ts` - Comments reference "pin views"
- API route documentation references "pin views"

**Recommendation**: Update comments to clarify these work with mentions now

---

## 📋 Action Items

### High Priority
1. ✅ **Create `/api/analytics/pin-view` route** - Complete
2. ✅ **Create `/api/analytics/pin-stats` route** - Complete

### Medium Priority
3. **Decide on homepage mention view tracking** - Should homepage mentions track views?
4. **Update comments** - Clarify that "pin" references are legacy naming

### Low Priority
5. **Consider renaming `usePinView` to `useMentionView`** - Better clarity (non-breaking)
6. **Update documentation** - Reflect mentions migration in docs

---

## ✅ What's Working

1. ✅ URL parameter handling (both `mentionId` and `mention`)
2. ✅ Popup state management (clean and simple)
3. ✅ Database migration (complete)
4. ✅ Profile page mention popups (working)
5. ✅ Homepage mention popups (working)
6. ✅ Event system for mention selection

---

## Summary

The URL parameter and popup state management are **clean and working correctly**. The main gap is **missing API routes** for view tracking and stats. Once those are created, the system will be complete.

The codebase correctly uses `mentionId` for profile pages and `mention` for homepage, with proper state management and event handling. The database migration is complete and all functions reference the `mentions` table correctly.
