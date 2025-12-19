# Profile Page State Management & Use Cases

## Complete Use Case Matrix

### Owner - Owner View Mode
| Action | Allowed | UI State | URL State |
|--------|---------|----------|-----------|
| Click map (empty) | ✅ | Temporary marker + modal | No change |
| Click pin | ✅ | Popup opens | `?pinId=xxx` |
| Create pin | ✅ | Pin added, modal closes | `?pinId=newPinId` |
| Toggle private pins | ✅ | Filter pins | No change |
| Toggle to visitor | ✅ | Hide owner controls | `?view=visitor` |
| Edit profile | ✅ | Sidebar opens | No change |
| Share profile | ✅ | Share dialog | No change |

### Owner - Visitor View Mode
| Action | Allowed | UI State | URL State |
|--------|---------|----------|-----------|
| Click map (empty) | ❌ | Nothing | No change |
| Click pin | ✅ | Popup opens | `?pinId=xxx` |
| Create pin | ❌ | Disabled | No change |
| Toggle private pins | ❌ | Hidden | N/A |
| Toggle to owner | ✅ | Show owner controls | Remove `?view` |
| Edit profile | ❌ | Hidden | No change |
| Share profile | ✅ | Share dialog | No change |

### Visitor (Authenticated)
| Action | Allowed | UI State | URL State |
|--------|---------|----------|-----------|
| Click map (empty) | ❌ | Nothing | No change |
| Click pin | ✅ | Popup opens | `?pinId=xxx` |
| Create pin | ❌ | Not shown | N/A |
| Toggle private pins | ❌ | Not shown | N/A |
| Toggle view mode | ❌ | Not shown | N/A |
| Edit profile | ❌ | Not shown | N/A |
| Share profile | ✅ | Share dialog | No change |

### Anonymous
| Action | Allowed | UI State | URL State |
|--------|---------|----------|-----------|
| Click map (empty) | ❌ | Nothing | No change |
| Click pin | ✅ | Popup opens | `?pinId=xxx` |
| Create pin | ❌ | Not shown | N/A |
| Toggle private pins | ❌ | Not shown | N/A |
| Toggle view mode | ❌ | Not shown | N/A |
| Edit profile | ❌ | Not shown | N/A |
| Share profile | ✅ | Share dialog | No change |

## State Transitions & Cleanup

### View Mode Switch (Owner → Visitor)
**Trigger:** Owner clicks "Visitor" toggle
**Actions:**
1. Close create pin modal (if open)
2. Remove temporary marker (if visible)
3. Clear `pinId` from URL (visitors shouldn't see specific pin)
4. Update URL with `?view=visitor`
5. Hide owner controls
6. Filter pins to public only

### View Mode Switch (Visitor → Owner)
**Trigger:** Owner clicks "Owner" toggle
**Actions:**
1. Remove `?view` from URL
2. Show owner controls
3. Show all pins (public + private, based on toggle)

### Pin Click
**Trigger:** User clicks pin on map
**Actions:**
1. Update URL with `?pinId=xxx`
2. URL effect detects change
3. Popup opens for that pin
4. If clicking different pin, close old popup, open new

### Pin Creation
**Trigger:** Owner clicks map (empty area)
**Actions:**
1. Show temporary marker
2. Open create pin modal
3. User creates pin
4. Pin added to map
5. URL updated with `?pinId=newPinId`
6. Modal closes
7. Temporary marker removed
8. Popup opens for new pin

### Private Pins Toggle
**Trigger:** Owner clicks private pins toggle
**Actions:**
1. Toggle `showPrivatePins` state
2. Filter pins (all vs public only)
3. Clear `pinId` from URL (pin visibility changed)
4. Close any open popup

## URL Parameter States

### Valid URL States
- `/profile/[username]` - Default (owner view if owner)
- `/profile/[username]?view=visitor` - Visitor view (owner only)
- `/profile/[username]?pinId=xxx` - Pin popup open
- `/profile/[username]?view=visitor&pinId=xxx` - Visitor view with pin popup

### Invalid URL States (Auto-corrected)
- `/profile/[username]?view=visitor&pinId=xxx` (non-owner) → Redirect to `/profile/[username]`
- `/profile/[username]?pinId=xxx` (pin doesn't exist) → Clear `pinId`

## Edge Cases & Fixes

### Edge Case 1: Modal Open + View Switch
**Issue:** Create pin modal stays open when switching to visitor
**Fix:** ✅ Clean up modal state in `useEffect` watching `viewMode`

### Edge Case 2: Temporary Marker + View Switch
**Issue:** Temporary marker stays visible when switching to visitor
**Fix:** ✅ Clean up temporary marker in view mode toggle handler

### Edge Case 3: Pin Click During Pin Creation
**Issue:** Clicking pin while creating new pin
**Fix:** ✅ Pin click handler checks for pin layers first, returns early

### Edge Case 4: URL Parameter Not Updating
**Issue:** State changes don't reflect in URL
**Fix:** ✅ All state changes update URL via `window.history.pushState`

### Edge Case 5: Private Toggle + Open Popup
**Issue:** Toggling private pins while popup is open for private pin
**Fix:** ✅ Clear `pinId` from URL when toggling private pins

### Edge Case 6: New Pin Created + URL
**Issue:** New pin created but URL doesn't show it
**Fix:** ✅ Update URL with `?pinId=newPinId` after pin creation

## Current Implementation Status

✅ **Working:**
- Pin click → URL update → Popup opens
- URL with pinId → Popup opens on load
- View mode toggle → URL updates
- Private pins toggle → Filters pins
- Pin creation → Adds pin, updates URL

✅ **Fixed:**
- Modal cleanup on view switch
- Temporary marker cleanup on view switch
- URL parameter updates on all state changes
- Pin click prevents map click handler

⚠️ **Potential Issues:**
- URL parameter persistence across page reloads (should work)
- Multiple rapid clicks (debouncing not implemented)
- Pin deletion while popup open (should close popup)
