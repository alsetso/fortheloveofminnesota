# Congressional Districts GIS Data Storage & Rendering Research Prompt

## Context

**Data Characteristics:**
- 8 Minnesota congressional districts
- Each district contains voting precinct polygons (GeoJSON FeatureCollection)
- File sizes: ~171KB+ per district (cd8.md example: 228 lines, 43,705 tokens)
- Data structure: Precinct-level polygons with properties (PrecinctID, County, CongDist, MNSenDist, MNLegDist, CtyComDist)
- Coordinate precision: 0.0001 (4 decimal places)

**Current Stack:**
- Next.js/TypeScript frontend
- Mapbox GL JS for map rendering
- Supabase (PostgreSQL + PostGIS) backend
- GeoJSON stored in JSONB columns (see `posts.map_geometry`, `cities.boundary_lines`, `counties.polygon`)
- PostGIS available for spatial queries (GIST indexes on geometry columns)

**Current Implementation Pattern:**
```typescript
// Direct GeoJSON loading into Mapbox source
mapInstance.addSource(sourceId, {
  type: 'geojson',
  data: geoJsonData, // Full FeatureCollection
});

mapInstance.addLayer({
  id: layerId,
  type: 'fill',
  source: sourceId,
  paint: {
    'fill-color': '#3b82f6',
    'fill-opacity': 0.2,
  },
});
```

## Research Questions

### 1. Storage Strategy

**Option A: JSONB in Supabase**
- Store full GeoJSON in `congressional_districts` table with JSONB column
- Pros: Simple, matches existing pattern, queryable with GIN indexes
- Cons: Large payloads, no spatial indexing on geometry itself, full dataset loaded per request

**Option B: PostGIS Geometry Column**
- Store as `GEOMETRY(MULTIPOLYGON, 4326)` with simplified versions
- Pros: Native spatial queries, GIST indexing, can generate simplified versions
- Cons: Requires conversion from GeoJSON, more complex queries

**Option C: Hybrid (JSONB + PostGIS)**
- Store full GeoJSON in JSONB for frontend, PostGIS geometry for queries
- Pros: Best of both worlds
- Cons: Dual storage, sync complexity

**Option D: External Storage (S3/CDN)**
- Store GeoJSON files in object storage, serve via CDN
- Pros: Reduces database load, CDN caching, version control
- Cons: Additional infrastructure, no direct database queries

**Question:** Which storage approach provides best balance of query performance, rendering performance, and maintainability for 8 districts with ~100-500 precincts each?

### 2. Geometry Simplification

**Current State:** No simplification implemented. Full precision coordinates loaded.

**Simplification Techniques:**
- **Douglas-Peucker algorithm** (turf.js `simplify()`)
- **Quantization** (reduce coordinate precision)
- **Zoom-level specific simplification** (multiple simplified versions)
- **TopoJSON** (topology-aware compression, ~80% size reduction)

**Questions:**
- What simplification tolerance maintains visual fidelity at different zoom levels?
- Should we store multiple simplified versions (zoom 0-8, 9-12, 13+) or simplify on-the-fly?
- Does TopoJSON provide sufficient size reduction to justify conversion complexity?
- Should simplification happen at ingestion (backend) or runtime (frontend)?

### 3. Frontend Rendering Optimization

**Current Pattern:** Load full GeoJSON, add to Mapbox source, render all features.

**Optimization Strategies:**

**A. Vector Tiles (Mapbox Vector Tiles / MVT)**
- Pre-generate tiles from GeoJSON
- Serve via tile server (PostGIS `ST_AsMVT` or external service)
- Pros: Viewport-based loading, automatic LOD, industry standard
- Cons: Requires tile generation pipeline, additional infrastructure

**B. Viewport-Based Filtering**
- Load only features intersecting current map bounds
- Backend query: `ST_Intersects(geometry, viewport_bounds)`
- Pros: Reduces payload, leverages PostGIS spatial queries
- Cons: Requires backend endpoint, multiple requests on pan/zoom

**C. Progressive Enhancement**
- Load simplified version initially, enhance on zoom
- Use Mapbox `setData()` to update source with higher detail
- Pros: Fast initial load, detail on demand
- Cons: Multiple data loads, state management complexity

**D. Feature Clustering/Aggregation**
- Aggregate precincts into district boundaries at low zoom
- Show individual precincts only at high zoom
- Pros: Reduces feature count, clearer visualization
- Cons: Loss of precinct detail at low zoom

**Questions:**
- Is vector tiles infrastructure worth the complexity for 8 districts?
- Can viewport-based filtering provide sufficient performance with PostGIS spatial queries?
- What zoom-level thresholds make sense for detail levels?
- Should we render district boundaries vs. individual precincts at different zooms?

### 4. Data Structure Design

**Option A: District-Level Storage**
```sql
CREATE TABLE congressional_districts (
  id UUID PRIMARY KEY,
  district_number INTEGER UNIQUE,
  name TEXT,
  geometry JSONB, -- Full FeatureCollection with all precincts
  geometry_simplified JSONB, -- Simplified version
  geometry_postgis GEOMETRY(MULTIPOLYGON, 4326),
  created_at TIMESTAMPTZ
);
```

**Option B: Precinct-Level Storage**
```sql
CREATE TABLE voting_precincts (
  id UUID PRIMARY KEY,
  precinct_id TEXT UNIQUE,
  district_number INTEGER,
  county TEXT,
  properties JSONB,
  geometry JSONB,
  geometry_postgis GEOMETRY(POLYGON, 4326),
  created_at TIMESTAMPTZ
);

-- Aggregate to districts via query
```

**Option C: Hybrid (Districts + Precincts)**
- Store district boundaries separately
- Store precincts with district reference
- Aggregate on-demand

**Questions:**
- Do we need precinct-level queries, or only district-level?
- Should district boundaries be union of precincts or separate geometry?
- What query patterns will be most common? (district lookup, precinct lookup, spatial intersection)

### 5. Performance Targets

**Current Unknowns:**
- Expected concurrent users viewing districts
- Typical zoom levels for district visualization
- Need for precinct-level interactivity (hover, click)
- Update frequency of district/precinct data

**Performance Goals:**
- Initial map load: < 2s
- Pan/zoom smoothness: 60fps
- Data payload: < 500KB per district (or < 100KB simplified)
- Query response: < 200ms for spatial queries

**Questions:**
- Are these targets realistic for 8 districts with full precinct data?
- What metrics should we track? (load time, render time, payload size, query latency)
- Should we implement lazy loading (load districts on-demand vs. all at once)?

### 6. Implementation Recommendations

**Phase 1: Minimal Viable Implementation**
- Store as JSONB in `congressional_districts` table
- Load full GeoJSON into Mapbox source
- Measure baseline performance

**Phase 2: Optimization**
- Implement geometry simplification (turf.js, tolerance based on zoom)
- Add PostGIS geometry column for spatial queries
- Implement viewport-based filtering if needed

**Phase 3: Advanced (if needed)**
- Vector tiles generation
- Multi-level simplification (zoom-specific versions)
- Precinct-level interactivity

**Questions:**
- What's the minimum viable approach that maintains good UX?
- At what point do we need vector tiles vs. optimized GeoJSON?
- Should we optimize for initial load or interaction performance?

## Specific Technical Decisions Needed

1. **Storage:** JSONB only, PostGIS only, or hybrid?
2. **Simplification:** Pre-compute or runtime? What tolerance?
3. **Rendering:** Full dataset, viewport-filtered, or vector tiles?
4. **Structure:** District-level, precinct-level, or both?
5. **Loading:** All districts upfront or on-demand?
6. **Interactivity:** District-level only or precinct-level hover/click?

## Research Priorities

1. **Benchmark current approach** with full GeoJSON loading
2. **Test simplification impact** on visual fidelity and file size
3. **Evaluate PostGIS spatial query performance** for viewport filtering
4. **Compare vector tiles vs. optimized GeoJSON** for this use case
5. **Determine optimal zoom thresholds** for detail levels

## Constraints

- Must work with existing Mapbox GL JS setup
- Must integrate with Supabase/PostGIS backend
- Should follow existing patterns where possible (JSONB storage, GeoJSON format)
- Need to support future expansion (more districts, more precinct detail)

## Success Criteria

- Districts render smoothly at all zoom levels
- Initial load time < 2s
- Pan/zoom maintains 60fps
- Data payload reasonable (< 500KB total for all districts)
- Maintains visual accuracy for political boundary use case
- Supports future precinct-level interactivity if needed

