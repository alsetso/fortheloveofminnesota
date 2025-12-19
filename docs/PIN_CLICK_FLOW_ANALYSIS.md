# Pin Click Flow Analysis

## Current Flow Comparison

### Scenario 1: Click Same Pin Twice (Toggle) ✅ WORKS

**First Click:**
1. `handlePinClick` → `currentOpenPinIdRef.current === null` (no popup open)
2. Calls `updateUrlParams(pinA.id)` → `setPinId(pinA.id)`
3. Hook: `setPinIdState(pinA.id)` + `window.history.replaceState(?pinId=pinA)`
4. Effect sees `urlPinId = pinA` → `openPopupForPin(pinA, false)`
5. Sets `currentOpenPinIdRef.current = pinA`

**Second Click:**
1. `handlePinClick` → `currentOpenPinIdRef.current === pinA` ✅
2. Calls `clearUrlParams()` → `clearPinId()`
3. Hook: `setPinIdState(null)` + `window.history.replaceState(no pinId)`
4. Effect sees `urlPinId = null` → closes popup
5. Sets `currentOpenPinIdRef.current = null`

**Result:** ✅ Works correctly

---

### Scenario 2: Click Pin A, Then Click Pin B (Switch) ❌ BROKEN

**Click Pin A:**
1. `handlePinClick` → `currentOpenPinIdRef.current === null`
2. Calls `updateUrlParams(pinA.id)` → `setPinId(pinA.id)`
3. Hook: `setPinIdState(pinA.id)` + `window.history.replaceState(?pinId=pinA)`
4. Effect sees `urlPinId = pinA` → `openPopupForPin(pinA, false)`
5. Sets `currentOpenPinIdRef.current = pinA`

**Click Pin B:**
1. `handlePinClick` → `currentOpenPinIdRef.current === pinA` (not pinB)
2. Calls `updateUrlParams(pinB.id)` → `setPinId(pinB.id)`
3. Hook: `setPinIdState(pinB.id)` + `window.history.replaceState(?pinId=pinB)`
4. **PROBLEM:** Hook's sync effect runs:
   ```typescript
   useEffect(() => {
     const urlPinId = searchParams.get('pinId'); // Still pinA (stale)
     if (urlPinId !== pinId) {
       setPinIdState(urlPinId); // Overwrites with stale pinA!
     }
   }, [searchParams, pinId, viewMode]);
   ```
5. Effect sees `urlPinId = pinA` (stale) → tries to open pinA again
6. But `currentOpenPinIdRef.current === pinA` → early return, nothing happens

**Result:** ❌ Pin B popup doesn't open, URL shows pinB but popup shows pinA

---

## Root Cause

The hook's sync effect is fighting with manual state updates:

1. `setPinId(pinB.id)` updates state immediately
2. But `searchParams` from Next.js doesn't update immediately (it's async)
3. Sync effect sees stale `searchParams` and overwrites the state back to pinA
4. Effect in ProfilePinsLayer sees wrong pinId

## Solution

The sync effect should only run for browser navigation (back/forward), not for programmatic updates. We need to track whether the update came from our code or from browser navigation.
