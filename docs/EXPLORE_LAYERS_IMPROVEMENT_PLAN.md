# Explore Layers System — Senior Dev Improvement Plan

Strategic areas to simplify, fix glitches, and ship a more robust implementation.

---

## 1. Single Source of Truth for Record Data (High Impact)

**Problem:** Same record is fetched 3–4 times on selection:

| Caller | Trigger | Fetches |
|--------|---------|---------|
| `ExploreTableLayout` | `recordSlug` change | Full record for `selectedBoundary.details` |
| `LayerDetailMap` | `selectedId` change | Geometry only for `fitBounds` |
| `LayerDetailRightSidebar` | `selectedBoundary` change | Full record for `recordData` |
| `LayerDetailLeftSidebar` | Click from list | Per-record fetch on `onRecordSelect` |

**Fix:** Introduce `useExploreRecord(table, recordSlug)`:

- One fetch per `(table, recordSlug)`; cache in memory or React Query.
- Return `{ record, geometry, loading }`.
- Consumers: Layout (selectedBoundary), Map (zoom), RightSidebar (display), LeftSidebar (click handler receives record from cache).

**Alternative:** Extend `liveBoundaryCache` with `getRecordByLayerId(layer, id)` that:

- Uses existing cache when we have all records (state, districts) or can find in county/CTU lists.
- Fetches single record and caches by id when not present.

---

## 2. Remove Hover → React State Chain (High Impact, Glitch Root Cause)

**Problem:** Hover flows through multiple React components:

```
Mapbox mousemove → useExploreMapLayerInteraction (setState) 
  → LayerDetailMap re-render 
  → Boundary layers re-render (useEffect: setPaintProperty, setData)
  → ExploreTableLayout (onBoundaryHover → setHoveredBoundary)
  → ExploreCursorHoverLabel + LayerDetailRightSidebar re-render
```

Even with throttling, any state update triggers the boundary layer effects, which do Mapbox `setData`/`setPaintProperty`. Those can cause a brief repaint where `queryRenderedFeatures` misses the feature → feedback loop.

**Fix:** Keep hover in Mapbox/imperative space:

- **Option A:** Use Mapbox `feature-state` for hover. Set `map.setFeatureState()` on mousemove; use `['feature-state', 'hover']` in paint expressions. No React state for hover. Mapbox handles highlight entirely.
- **Option B:** Handle hover highlight entirely inside the boundary layers via map events + refs, and only push `{ id, name }` to React when we need to show the cursor label. Minimize React involvement.

**Cursor label:** Either use the native `title` attribute on the map container (no custom UI), or render the label only when `hoveredId` changes (not on every cursor move) and position via a single RAF-driven ref, not React state for `cursorX/cursorY`.

---

## 3. Boundary Layers: Single Mode, No Dual Logic

**Problem:** Each layer (County, State, CTU, Congressional) has two modes:

- `externalHoveredFeature` set → parent handles interaction, layer only applies highlight
- `externalHoveredFeature` undefined → layer attaches its own mousemove/mouseout/click

That duplicates ~100+ lines per layer and creates multiple code paths.

**Fix:** Explore layers should **always** use parent-driven interaction. Remove the `externalHoveredFeature === undefined` branch. Other contexts (e.g. LiveMap) can use a separate, simpler layer variant or a prop like `interactionMode: 'parent' | 'self'` with a slim self-handler only when needed.

---

## 4. Mapbox Highlight via feature-state, Not Extra Sources

**Problem:** Each boundary layer uses:

- Main fill + outline
- Separate highlight source + highlight fill + highlight outline
- `setData` on highlight source + `setPaintProperty` for opacity

That’s multiple sources and multiple effects per hover/select.

**Fix:** Use a single source and Mapbox `feature-state`:

- Add `feature-state` for `hover` and `selected` in the main source.
- Use expressions like `['case', ['boolean', ['feature-state', 'hover']], 0.35, ['boolean', ['feature-state', 'selected']], 0.35, 0.12]` for fill-opacity.
- On mousemove: `map.setFeatureState({ source, sourceLayer?, id }, { hover: true })` and clear previous.
- No extra highlight source or highlight layers.

---

## 5. Centralize Table → API Mapping

**Problem:** `table === 'state'` / `table === 'counties'` conditionals repeated in:

- ExploreTableLayout (`fetchAndSelect`)
- LayerDetailMap (`zoomToRecord`)
- LayerDetailRightSidebar (`fetchRecordData`)
- LayerDetailLeftSidebar (config-driven but different shape)

**Fix:** Single config in `exploreLayerInteractionConfig.ts` or `layersConfig.ts`:

```ts
getRecordFetcher(table): (id?: string) => Promise<RecordResult>
```

Returns a function that fetches by id when provided, or the full set. All callers use this.

---

## 6. Cursor Label: Simplify or Drop

**Problem:** `ExploreCursorHoverLabel` uses:

- `createPortal` to `document.body`
- Parent tracks `cursorPos` and passes it down
- Re-renders on every RAF-updated cursor position

**Options:**

- **A:** Remove custom label; use `map.getCanvas().title = name` on hover (browser tooltip). Zero React, zero glitch.
- **B:** Keep custom label but render it only when `hoveredBoundary` exists; use a single `position: fixed` div with `transform: translate(cursorX, cursorY)` updated via ref + RAF, no React state for position.
- **C:** Use Mapbox popup (`mapboxgl.Popup`) with `closeOnClick: false`; position at cursor. Mapbox handles placement, no portal or cursor tracking.

---

## 7. Preload Boundaries on Explore Mount

**Problem:** First visit to a layer triggers fetch → loading → layer appears. Switching layers triggers more fetches.

**Fix:** On `/explore` or first ExploreTableLayout mount, call `liveBoundaryCache.preloadAll()`. Layers then read from cache synchronously (or near-instant). Optional: prefetch on `/explore` link hover.

---

## 8. Route-Level Data Loading (Optional)

**Problem:** Navigating to `/explore/counties/hennepin` shows loading state while client fetches.

**Fix:** Use Next.js `generateStaticParams` for popular IDs, or a `loading.tsx` with a skeleton. Better: move record fetch to a Server Component or `getServerSideProps`-style loader so data is ready before first paint. Requires API to be callable from server or a shared data layer.

---

## Priority Order (Ship-First)

1. **#1 Single source of record data** — Removes redundant fetches and inconsistency.
2. **#2 + #4 Hover via feature-state** — Removes React hover chain and highlight complexity; likely fixes remaining glitches.
3. **#3 Single boundary layer mode** — Simplifies layers, less branching.
4. **#5 Centralize table mapping** — Reduces duplication, easier to add layers.
5. **#6 Cursor label** — Pick A, B, or C to cut complexity.
6. **#7 Preload** — Quick UX win.
7. **#8 Route-level loading** — Nice-to-have for later.

---

## Files to Touch

| Area | Files |
|------|-------|
| Record fetch | `ExploreTableLayout`, `LayerDetailMap`, `LayerDetailRightSidebar`, new `useExploreRecord` or `liveBoundaryCache` |
| Hover/highlight | `useExploreMapLayerInteraction`, all `*BoundariesLayer`, `exploreLayerInteractionConfig` |
| Cursor label | `ExploreTableLayout`, `ExploreCursorHoverLabel` |
| Config | `layersConfig`, `exploreLayerInteractionConfig` |
