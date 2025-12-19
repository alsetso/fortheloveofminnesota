# Profile Page Use Cases & State Management Analysis

## User Roles & View Modes

### Role Types
1. **Owner** - User viewing their own profile
2. **Visitor** - User viewing someone else's profile
3. **Anonymous** - Not logged in, viewing public profile

### View Modes (Owner Only)
1. **Owner View** - Full control, see all pins (public + private)
2. **Visitor View** - See profile as visitors would (public pins only)

## UI Options by Role

### Owner (Owner View Mode)
- ✅ Create pins (click map)
- ✅ Edit pins (click pin → delete)
- ✅ View all pins (public + private)
- ✅ Toggle private pins visibility
- ✅ Toggle view mode (owner/visitor)
- ✅ Edit profile (sidebar)
- ✅ Share profile

### Owner (Visitor View Mode)
- ❌ Create pins (disabled)
- ❌ Edit pins (disabled)
- ✅ View public pins only
- ❌ Toggle private pins (hidden)
- ✅ Toggle view mode (owner/visitor)
- ❌ Edit profile (hidden)
- ✅ Share profile

### Visitor
- ❌ Create pins (not shown)
- ❌ Edit pins (not shown)
- ✅ View public pins only
- ❌ Toggle private pins (not shown)
- ❌ Toggle view mode (not shown)
- ❌ Edit profile (not shown)
- ✅ Share profile

### Anonymous
- ❌ Create pins (not shown)
- ❌ Edit pins (not shown)
- ✅ View public pins only
- ❌ Toggle private pins (not shown)
- ❌ Toggle view mode (not shown)
- ❌ Edit profile (not shown)
- ✅ Share profile

## State Management Issues

### Issue 1: Modal State Not Cleaned on View Mode Switch
**Problem:** When owner switches from owner → visitor view while create pin modal is open:
- Modal stays open
- Temporary marker stays visible
- Can't create pins in visitor mode anyway

**Fix:** Clean up modal state when switching to visitor view

### Issue 2: URL Parameter Handling
**Problem:** Need to ensure:
- Pin creation with URL parameter works
- Toggle changes update URL
- Pin clicks update URL
- All state changes are reflected in URL

**Fix:** Ensure all state changes update URL appropriately

### Issue 3: Temporary Marker Cleanup
**Problem:** Temporary marker may persist when:
- Switching view modes
- Closing modal
- Clicking on pins

**Fix:** Clean up temporary marker on all relevant state changes

## Current State Flow

### Pin Creation Flow
1. Owner clicks map (empty area)
2. Temporary marker appears
3. Create pin modal opens
4. User fills form and creates pin
5. Pin added to map
6. Modal closes
7. Temporary marker removed

### View Mode Switch Flow
1. Owner clicks "Visitor" toggle
2. View mode changes to 'visitor'
3. URL updates with `?view=visitor`
4. Pin filtering changes (public only)
5. Owner controls hidden
6. **ISSUE:** Modal state not cleaned

### Pin Click Flow
1. User clicks pin
2. URL updates with `?pinId=xxx`
3. URL effect detects change
4. Popup opens
5. User closes popup
6. URL parameter removed
7. Popup closes

## Required Fixes

1. **Clean up modal state on view mode switch**
2. **Clean up temporary marker on view mode switch**
3. **Ensure URL parameters update correctly**
4. **Handle edge cases (modal open + view switch)**
