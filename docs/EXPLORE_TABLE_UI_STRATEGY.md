# Explore Table Page: UI/UX Strategy

## Goal
When a user selects a specific record (city, town, county, district), **hide other records** and transform the entire UI to be **all about that selected area**. Two distinct modes with clear flow.

---

## Current File Structure

| File | Purpose |
|------|---------|
| `src/app/explore/[table]/page.tsx` | Table index — no selection, `recordSlug=undefined` |
| `src/app/explore/[table]/[slug]/page.tsx` | Record detail — selection present, `recordSlug=id` |
| `src/components/explore/ExploreTableLayout.tsx` | **Orchestrator** — owns layout, passes props to sidebars + map |
| `src/components/explore/layers/LayerDetailLeftSidebar.tsx` | Record list (all) + search; navigates to `/explore/[table]/[id]` on click |
| `src/components/explore/layers/LayerDetailMap.tsx` | Mapbox map; renders one layer (state/county/ctu/district); zooms to selected |
| `src/components/explore/layers/LayerDetailRightSidebar.tsx` | Details panel for selected/hovered record |

**Parent wrapper:** `NewPageWrapper` (three-column: left sidebar, main, right sidebar).

---

## Current Problem
- **Browse mode** (no slug): List + map + empty right — OK.
- **Focus mode** (slug present): Same layout. Left still shows full list with one highlighted. Map shows all boundaries, one highlighted. Right shows details. User wants: **hide the full list**, **map shows only the selected boundary**, **layout shifts to focus entirely on that area**.

---

## Two Modes: Browse vs Focus

| Aspect | Browse (`/explore/[table]`) | Focus (`/explore/[table]/[slug]`) |
|--------|-----------------------------|----------------------------------|
| Left sidebar | Full record list + search | **Collapsed or replaced** — breadcrumb + "Back to [Counties]" |
| Main | Map with all boundaries | Map with **only the selected boundary** |
| Right sidebar | "Click to select" placeholder | **Expanded** — full details, area-specific content |
| Header | Table label | **Selected area name** |
| User intent | Explore, choose | Deep-dive into one area |

---

## Implementation Strategy

### 1. ExploreTableLayout — Mode Detection + Conditional Layout

**Change:** Detect `recordSlug` and render different structures.

```tsx
const isFocusMode = Boolean(recordSlug);

return (
  <NewPageWrapper
    leftSidebar={isFocusMode ? <FocusModeLeftNav /> : <LayerDetailLeftSidebar />}
    rightSidebar={<LayerDetailRightSidebar ... />}
  >
    ...
  </NewPageWrapper>
);
```

**Focus-mode left nav** (new component or inline):
- "← Back to [Counties]"
- Breadcrumb: Explore / Counties / Hennepin
- Optional: compact "Change area" dropdown

### 2. LayerDetailLeftSidebar — Browse Only

**Change:** Only render when `recordSlug` is absent. In focus mode, `ExploreTableLayout` renders `FocusModeLeftNav` instead.

No logic change inside `LayerDetailLeftSidebar`; it stays the browse list. The layout decides what to show.

### 3. FocusModeLeftNav (New Component)

**Purpose:** Minimal left column in focus mode.

- Link: "← Counties" or "← Cities and Towns" (back to browse)
- Optional: Breadcrumb
- Optional: Search / "Change area" to switch selection without leaving focus layout

**File:** `src/components/explore/layers/FocusModeLeftNav.tsx`

### 4. LayerDetailMap — Focus Mode: Show Only Selected Boundary

**Current:** Map layers receive `selectedId` and highlight that boundary; they still render **all** boundaries.

**Needed:** When `selectedId` is set and we're in focus mode, pass a new prop to the boundary layer components, e.g. `focusOnly?: boolean`. When true:
- **CountyBoundariesLayer**: Fetch only the selected county (API supports `?id=`), render only that geometry. Hide all others.
- **CTUBoundariesLayer**: Same — single-record fetch.
- **StateBoundaryLayer**: Single record anyway.
- **CongressionalDistrictsLayer**: Fetch all (8) or single by id; in focus mode render only the selected district.

**Alternative (simpler):** Keep existing layer behavior but add a **filter at render time**. Each layer component already gets `selectedId`. Add `focusOnly?: boolean`. When `focusOnly` and `selectedId`:
- Filter the `counties` / `ctus` / `districts` array to only the selected record before building the FeatureCollection.
- Result: map shows one boundary, no others. Highlight styling can stay or be simplified (it's the only one).

**Layer changes:**
- `CountyBoundariesLayer`: Add `focusOnly?: boolean`. When true and `selectedId`, filter `counties` to that id before building GeoJSON.
- `CTUBoundariesLayer`: Same.
- `CongressionalDistrictsLayer`: Same.
- `StateBoundaryLayer`: Already single-record.

**Data flow:** Layers already fetch from API. For single-record fetch:
- Counties: `getCountyBoundaries({ id })` or fetch `/api/civic/county-boundaries?id=xxx`
- CTU: `/api/civic/ctu-boundaries?id=xxx`
- Districts: Fetch all, filter client-side (only 8); or add `?id=` to API if it supports it.

The **simplest** approach: layers receive full data; when `focusOnly && selectedId`, filter before rendering. No new API calls. County/CTU layers use `getCountyBoundaries()` / similar which returns all. We'd need a way to fetch a single county/ctu for focus mode without pulling 3000. So:
- **Option A:** API already supports `?id=`. When `focusOnly && selectedId`, fetch single record instead of full list. Layer component receives `focusOnly`, `selectedId`, and fetches accordingly.
- **Option B:** Parent (`LayerDetailMap`) fetches the single record when in focus mode and passes it as `featureOverride` or `singleBoundary` prop. Layer renders only that.

**Recommendation:** Add `focusOnly` to `LayerDetailMap` props (derived from `recordSlug`). When `focusOnly`, fetch single record in `LayerDetailMap` and pass `singleBoundaryData` to the layer. Layer renders only that when present. Avoids changing layer fetch logic in multiple places.

### 5. LayerDetailRightSidebar — Expand in Focus Mode

**Current:** Shows record details (name, population, coords, etc.).

**Focus mode enhancements:**
- Slightly wider or more prominent (optional via `NewPageWrapper` or layout).
- Add tabs or sections: **Info** | **Pins in area** | **Posts** (future).
- Keep "Clear selection" as "← Back to [Counties]" to match left nav.

No structural change required initially; content can expand over time.

### 6. NewPageWrapper — Optional Layout Variation

**Current:** Fixed widths for left (256px) and right (320px).

**Focus mode:** Could pass a variant, e.g. `leftSidebarWidth="narrow"` (e.g. 180px) for the compact left nav, and `rightSidebarWidth="wide"` (e.g. 400px) for the details panel. Or keep as-is; the content change (list → nav) is the main improvement.

---

## User Flow

1. **Land on** `/explore/counties`  
   - Left: Full county list + search  
   - Main: Map with all 87 counties  
   - Right: "Click a county or hover on the map"

2. **Click** "Hennepin" in list  
   - Navigate to `/explore/counties/hennepin-id`

3. **Focus mode**  
   - Left: "← Counties" + optional breadcrumb  
   - Main: Map showing **only** Hennepin (no other counties)  
   - Right: Hennepin details (population, area, etc.)  
   - Header: "Hennepin County"

4. **Click** "← Counties"  
   - Navigate to `/explore/counties`  
   - Back to browse mode

5. **Map click in browse mode**  
   - Currently: should trigger `onBoundarySelect` → navigate to focus URL  
   - Same flow as list click

---

## File Change Summary

| File | Changes |
|------|---------|
| `ExploreTableLayout.tsx` | Detect `recordSlug`; conditionally render `FocusModeLeftNav` vs `LayerDetailLeftSidebar`; pass `focusOnly` to map; update header to show selected name in focus mode |
| `FocusModeLeftNav.tsx` | **New** — Back link, breadcrumb |
| `LayerDetailMap.tsx` | Accept `focusOnly`; when true, fetch single boundary and pass to layer components (or let layers handle it) |
| `CountyBoundariesLayer.tsx` | Add `focusOnly`, `singleBoundaryData` (optional). When provided, render only that boundary |
| `CTUBoundariesLayer.tsx` | Same |
| `CongressionalDistrictsLayer.tsx` | Same |
| `StateBoundaryLayer.tsx` | Already single; no change |
| `LayerDetailLeftSidebar.tsx` | No change (browse only) |
| `LayerDetailRightSidebar.tsx` | Optional: emphasize "Back" in focus mode |

---

## Map Layer API Pattern (Proposed)

```ts
// LayerDetailMap passes to boundary layers:
focusOnly?: boolean;       // When true, show only selected
selectedId?: string;       // Which record
singleBoundaryData?: GeoJSON; // When focusOnly, pre-fetched single boundary (avoids layer re-fetch)
```

When `singleBoundaryData` is provided, layer uses it instead of full dataset. Otherwise current behavior.

---

## Dynamic Layer Interactivity Checklist

- [x] Browse: list + map with all boundaries; hover highlights
- [x] Browse: click (list or map) → navigate to focus URL
- [x] Focus: left = nav only; main = single boundary; right = details
- [x] Focus: "Back" clears selection, returns to browse
- [x] Map: in focus mode, render only selected boundary (no others)
- [ ] Future: pins/posts in selected area (right sidebar sections)

---

## Implemented (Current)

| Change | File |
|--------|------|
| Focus left nav | `FocusModeLeftNav.tsx` |
| Conditional layout | `ExploreTableLayout.tsx` |
| focusOnly + focusOnlyId | `LayerDetailMap.tsx` |
| focusOnlyId filter | `CountyBoundariesLayer`, `CTUBoundariesLayer`, `CongressionalDistrictsLayer`, `StateBoundaryLayer` |
