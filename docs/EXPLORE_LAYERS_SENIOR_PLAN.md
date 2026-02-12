# Explore Layers — Senior Dev Execution Plan

## Goal
High-performance, simple layers UX. Hover and click work reliably. No glitches.

## Root Cause of Glitches
Hover flows: `map mousemove` → `setHoveredFeature` → React re-render → boundary layer `useEffect` → `setData`/`setPaintProperty` → Mapbox repaint → possible `queryRenderedFeatures` miss → clear hover → repeat.

## Plan (Minimal, Non-Breaking)

### Phase 1: Eliminate hover → layer update chain
- **Change:** For Explore, do not pass `hoveredFeature` to boundary layers. Pass `null`.
- **Effect:** Layers never run highlight-on-hover logic. No repaint loop.
- **Keep:** `canvas.title = name` on hover (native tooltip). `onBoundaryHover` for sidebar "Click to view details".
- **Trade-off:** No visual polygon highlight on hover. Name still shows. Click unchanged.
- **Risk:** None. Explore-only. LiveMap/others unchanged.

### Phase 2: Centralize hierarchy
- **Change:** Add `EXPLORE_HIERARCHY` config. Derive `hasSubRecords`, `overlayLayerSlug`, `parentCountyName` from it.
- **Effect:** Single place for parent→child rules. Easier to extend (e.g. state→counties overlay).
- **Risk:** Low. Logic move only.

### Phase 3: Scope map listeners to map container
- **Change:** Attach mousemove/mouseout to map container, not document.
- **Effect:** Fewer events when cursor is outside map. Minor perf.
- **Risk:** Low. Mapbox mouseout on container works.

### Phase 4 (Deferred): Feature-state highlight
- Move hover highlight to Mapbox `setFeatureState`. Requires promoteId + paint expressions. Touches shared boundary layers. Do after Phase 1–3 proven.

## Execution Order
1. Phase 1 — immediate glitch fix
2. Phase 2 — config clarity
3. Phase 3 — optional listener scope

---

## Executed (summary)
- **Phase 1:** Pass `hoveredFeature={null}` to layers. Removed hover state from interaction hook.
- **Phase 2:** Added `EXPLORE_HIERARCHY`, `getExploreChildContext()`. Layout uses config.
- **Phase 3:** N/A—Mapbox events already scoped to map.
- **Cleanup:** Removed debug overlay, console.log.
