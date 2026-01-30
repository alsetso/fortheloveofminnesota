# Live map: layers and restrictions when no boundary layers are on

When the user has **no boundary layer** selected on the live map (menu “Layers” → all off), only the **pins (mentions) layer** is active. Below is what’s rendered and what restricts it.

---

## 1. Layers when no boundaries are on

| Layer | Rendered? | Source |
|-------|-----------|--------|
| **State boundary** | No | `showStateBoundary` = `isLiveMap && liveBoundaryLayer === 'state'` → false when `liveBoundaryLayer === null` |
| **County boundaries** | No | `showCountyBoundaries` = `isLiveMap && liveBoundaryLayer === 'county'` → false |
| **CTU boundaries** | No | `showCTU` = `isLiveMap && liveBoundaryLayer === 'ctu'` → false |
| **Congressional districts** | No | `showDistricts` = `isLiveMap && liveBoundaryLayer === 'district'` → false |
| **Pins (mentions)** | Yes | `MentionsLayer` always mounted when map is live; visibility/load gated by `allowPinsLoad` (see below) |

**Code:** `src/app/map/[id]/page.tsx` (MapPage) passes to MapIDBox:

```ts
showDistricts={isLiveMap && liveBoundaryLayer === 'district' ? true : showDistricts}
showCTU={isLiveMap && liveBoundaryLayer === 'ctu' ? true : showCTU}
showStateBoundary={isLiveMap && liveBoundaryLayer === 'state' ? true : showStateBoundary}
showCountyBoundaries={isLiveMap && liveBoundaryLayer === 'county' ? true : showCountyBoundaries}
```

When `liveBoundaryLayer === null`, all four are false for the live map, so `BoundaryLayersManager` renders no boundary layers.

---

## 2. When pins are allowed to load (`allowPinsLoad`)

Pins are fetched and shown only when `allowPinsLoad` is true. MapPage sets:

```ts
allowPinsLoad={
  !onLiveStatusChange ||
  liveBoundaryLayer == null ||
  (liveBoundaryLayer === 'state' && loadingStateBoundary === false) ||
  (liveBoundaryLayer === 'county' && loadingCountyBoundaries === false) ||
  (liveBoundaryLayer === 'district' && loadingCongressionalDistricts === false) ||
  (liveBoundaryLayer === 'ctu' && loadingCTUBoundaries === false)
}
```

**When no boundary layers are on (`liveBoundaryLayer == null`):**

- The second condition is true → **`allowPinsLoad` is true immediately.**
- No wait on any boundary load; pins start loading as soon as the map is ready.

MapIDBox passes this through as `startPinsLoad={allowPinsLoad ?? true}` to `MentionsLayer`. In `MentionsLayer`, the fetch effect returns early if `startPinsLoad === false`; when it’s true, pins load per normal (live map cache, filters, etc.).

---

## 3. Other pin behavior (unchanged by “no boundaries”)

- **Clustering:** Controlled by `pinDisplayGrouping` (menu) → `clusterPins` on MentionsLayer.
- **Filter “only my pins”:** `showOnlyMyPins` (menu) passed to MentionsLayer.
- **Time filter:** `timeFilter` (`'24h' | '7d' | null`) passed to MentionsLayer.
- **URL:** `type` / `types` and `year` still apply to which mentions are fetched (MentionsLayer reads `searchParams`).

---

## 4. Boundary layer zoom behavior (for when a layer is on)

`BoundaryLayersManager` receives `liveMapBoundaryZoom={false}` from MapIDBox (hardcoded). So even when a boundary layer is selected, zoom-based minzoom/maxzoom from `LIVE_BOUNDARY_ZOOM_LAYERS` are **not** applied in the current implementation; the selected layer is shown at all zoom levels. Zoom ranges in `@/features/map/config` (e.g. state 1–4, county 4–6, CTU 6–9, district 9–12) are used for footer “layer title by zoom” and for reference, not for toggling layer visibility.

---

## 5. Summary table (no boundary layers on)

| Concern | Behavior |
|--------|----------|
| Boundary layers (state, county, CTU, districts) | None rendered |
| Pins layer | Rendered; loads immediately (no boundary gate) |
| Pin load gate | `allowPinsLoad` true because `liveBoundaryLayer == null` |
| Map click | Location selection only (no boundary click); footer shows MapInfo (lat/lng). |
| Footer “layer” title | From `getLiveLayerTitleByZoom(currentZoom)` (e.g. “State”, “County”, “Location”) when no boundary selected. |

---

**Files to change if you adjust behavior:**

- **Which boundary layers show on live:** `src/app/map/[id]/page.tsx` (MapPage) – `showDistricts` / `showCTU` / `showStateBoundary` / `showCountyBoundaries` passed to MapIDBox.
- **When pins are allowed to load:** same file – `allowPinsLoad` expression.
- **Pins fetch and filters:** `src/features/map/components/MentionsLayer.tsx` (`startPinsLoad`, `clusterPins`, `showOnlyMyPins`, `timeFilter`, URL params).
- **Boundary zoom ranges (labels/config):** `src/features/map/config.ts` (`LIVE_BOUNDARY_ZOOM_LAYERS`, `getLiveBoundaryZoomRange`, `getLiveLayerTitleByZoom`).

---

## Cleanup recommendations

1. **`allowPinsLoad` readability**  
   In `src/app/map/[id]/page.tsx`, add a one-line comment above the expression: when `liveBoundaryLayer == null`, pins load immediately; otherwise pins wait until the selected boundary layer has finished loading. Optionally extract a helper, e.g. `const allowPinsLoad = deriveAllowPinsLoad(...)`.

2. **`liveMapBoundaryZoom`**  
   MapIDBox hardcodes `liveMapBoundaryZoom={false}`. So the selected boundary layer is always visible at all zoom levels; zoom ranges in `LIVE_BOUNDARY_ZOOM_LAYERS` are only used for footer title, not visibility.  
   - **Option A:** Keep as-is and add a short comment in MapIDBox that live map shows the selected boundary at all zoom levels.  
   - **Option B:** Add a prop `liveMapBoundaryZoom?: boolean` to MapIDBox and pass `liveMapBoundaryZoom={isLiveMap && liveBoundaryLayer != null}` from MapPage so the selected layer respects minzoom/maxzoom when a boundary is on.

3. **Boundary loading state when no layer on**  
   When `liveBoundaryLayer === null`, no boundary layers are mounted, so `onBoundaryLayerLoadChange` is never called and the four loading states stay `undefined`. Footer status still makes sense (Pins row uses `loadingPins`). Optional: when live and `liveBoundaryLayer === null`, set the four boundary loading states to `false` in a `useEffect` so the status object is consistent; or document that they are undefined when no boundary layer is selected.

4. **`selectedBoundaries` vs URL**  
   When opening `/live?layer=county&id=xxx`, the live page sets `selectedLocation` from `resolveBoundaryByLayerId` but MapPage’s `selectedBoundaries` is not updated. So the Review accordion can show “0 selected” while the footer shows a boundary. Optional: when resolving boundary from URL (live page), either call a callback so MapPage can push to `selectedBoundaries`, or derive “selected for status” from URL + `selectedLocation` so Review and footer stay in sync.

5. **Deprecated type**  
   `LiveMapFooterStatus.tsx` exports `LiveBoundaryVisibility` as `@deprecated`. Remove it if nothing imports it, or keep and document that boundary visibility is now controlled by menu + `liveBoundaryLayer`.
