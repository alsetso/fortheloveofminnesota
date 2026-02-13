np, ru# Layers Schema: Unified Plan

## Public Accessibility

All layers tables have **"Anyone can view"** RLS policies for `anon` and `authenticated`. Schema `layers` has `USAGE` granted to `anon`. Civic APIs (`/api/civic/county-boundaries`, etc.) use RPCs that read from `layers.*` and do not require auth. **Layers are publicly readable.**

## Data Readiness

| Layer | Table | Rows | Has geometry | Null geom | Ready |
|-------|-------|------|---------------|-----------|-------|
| Counties | `layers.counties` | 87 | 87 | 0 | ✓ |
| State | `layers.state` | 1 | 1 | 0 | ✓ |
| CTU (cities/towns) | `layers.cities_and_towns` | 2,693 | 2,693 | 0 | ✓ |
| Congressional districts | `layers.districts` | 8 | 8 | 0 | ✓ |
| Water | `layers.water` | 0 | 0 | 0 | ✗ (empty) |

**Water** has no data; do not expose in UI until populated.

---

## Current State (Assessment)

The architecture is **already unified**; migration 507 accomplished the core move. Here's what exists:

| Layer Type | layers schema (source of truth) | public schema | API route | RPC |
|------------|----------------------------------|---------------|-----------|-----|
| Counties | `layers.counties` | `public.county_boundaries` (view → layers.counties) | `/api/civic/county-boundaries` | `get_counties` |
| State | `layers.state` | `public.state_boundary` (view → layers.state) | `/api/civic/state-boundary` | `get_state_boundary` |
| CTU (cities/towns) | `layers.cities_and_towns` | `public.ctu_boundaries` (view → layers.cities_and_towns) | `/api/civic/ctu-boundaries` | `get_ctu_boundaries` |
| Congressional districts | `layers.districts` | `public.congressional_districts` (view → layers.districts) | `/api/civic/congressional-districts` | `get_congressional_districts` |
| Water | `layers.water` | `public.water_features` (view) | — | — |

**Key finding:** All civic APIs use RPCs that read directly from `layers.*`. No application code queries `public.county_boundaries` or other public GIS tables directly. The public views exist for backward compatibility (e.g., migrations, scripts, or future tooling that expects public names).

---

## Plan: Simplify and Isolate Layers

### Goal
Make `layers` the **single source of truth** for GIS boundary data, remove confusion between public and layers schemas, and ensure a clean, documented path for the layers feature going forward.

### Phase 1: Documentation and Naming Clarity
1. **Document the mapping** – Add inline comments or a reference table in code (e.g. `LAYERS_MAPPING`) that maps:
   - `county_boundaries` → `layers.counties`
   - `ctu_boundaries` → `layers.cities_and_towns`
   - `state_boundary` → `layers.state`
   - `congressional_districts` → `layers.districts`
2. **Update schema enforcement** – Ensure `/api/civic/*` routes are mapped to `layers` (or a shared "civic" system) in `schemaEnforcement.ts` and related docs.

### Phase 2: Public Views – Keep or Remove?
**Option A (Recommended): Keep public views**
- Public views provide a stable interface if anything (admin tools, migrations, external scripts) expects `public.county_boundaries` etc.
- Views add negligible overhead; they are thin pass-throughs.

**Option B: Remove public views**
- Drop `public.county_boundaries`, `public.ctu_boundaries`, `public.state_boundary`, `public.congressional_districts`, `public.water_features`.
- Requires auditing all migrations, scripts, and tooling for direct references.
- Risk: breaking anything that uses `supabase.from('county_boundaries')` without schema.

**Recommendation:** Keep public views unless audit confirms no direct use. Document that layers schema is canonical and public views are compatibility shims.

### Phase 3: Consolidate RPCs
- RPCs `get_counties`, `get_ctu_boundaries`, `get_state_boundary`, `get_congressional_districts` live in `public` but query `layers`. This is correct.
- Optional: Move RPCs to `layers` schema and expose `layers.get_counties` etc. if you want full isolation. Requires API route updates to call `supabase.schema('layers').rpc(...)`.

### Phase 4: Future Layers Feature
- New layers (e.g. watersheds, parks) go in `layers` schema only.
- New RPCs or direct table access from API routes should target `layers.*` only.
- Public views only added when backward-compatibility is required.

---

## Implementation Checklist

- [ ] Add `docs/LAYERS_MAPPING.md` or section in this doc with public↔layers mapping
- [ ] Audit: grep for `from('county_boundaries')`, `from('state_boundary')`, etc. to confirm no direct public table access
- [ ] Update `schemaEnforcement.ts` if `/api/civic` should map to layers
- [ ] Decide: keep or remove public views (recommend keep)
- [ ] Document in README or CONTRIBUTING: "GIS layers live in layers schema; public views are compatibility shims"

---

## How Layers Are Implemented in the Map UI

### Data flow
1. **API** → Civic routes (`/api/civic/county-boundaries`, etc.) call RPCs (`get_counties`, `get_state_boundary`, etc.) which query `layers.*`.
2. **Cache** → `liveBoundaryCache.ts` fetches each boundary type once per session and caches in memory; concurrent callers share the same promise.
3. **Components** → Four layer components: `StateBoundaryLayer`, `CountyBoundariesLayer`, `CTUBoundariesLayer`, `CongressionalDistrictsLayer`. Each fetches via the cache, transforms GeoJSON into a Mapbox FeatureCollection, and adds fill + outline + highlight layers to the map.
4. **Manager** → `BoundaryLayersManager` conditionally renders each layer based on `showStateBoundary`, `showCountyBoundaries`, `showCTU`, `showDistricts` props.

### Visibility control
- **useBoundaryLayers** → Returns all layers `false` by default; does not read from map settings (intentional for performance).
- **On /maps (live)** → `liveBoundaryLayer` from URL (`?layer=county`) or menu toggle enables one layer at a time. When enabled, `liveMapBoundaryZoom=true` applies zoom-based visibility (minzoom/maxzoom) so state shows at low zoom, county at mid, CTU at high.
- **On custom maps** → Would use `mapData.settings.appearance.map_layers`; currently `useBoundaryLayers` ignores this and always returns false (gap).
- **Maps page** → Does **not** pass `liveBoundaryLayer` or a boundary-layer toggle; users cannot enable boundary layers on `/maps` today. Only mention-type filters exist.

### Zoom ranges (live map)
From `features/map/config.ts`: state (0–6), county (4–8), CTU (6–14), district (4–10). Mapbox `minzoom`/`maxzoom` hide layers outside range for progressive disclosure.

### Click handling
- Boundary layer IDs are in `detectClickTarget`; clicks on fill/outline layers set `target: 'boundary'`.
- `onBoundarySelect` passes `{ layer, id, name, lat, lng }` to the footer (e.g. MapInfo) and can drive URL `?layer=county&id=xxx`.

### Gap: /maps has no boundary layer toggle
To show boundaries on `/maps`, add `liveBoundaryLayer` state and a toggle (chips or menu) that set `?layer=state|county|ctu|district` and pass it to MapPage.

---

## Summary

The system is already correctly architected: `layers` is the source of truth, RPCs query layers, and public views mirror layers for compatibility. All four boundary layers are publicly accessible and data-ready (water is empty). The map UI renders layers via dedicated components and a shared cache; the main gap is that `/maps` does not expose a boundary-layer toggle for users.
