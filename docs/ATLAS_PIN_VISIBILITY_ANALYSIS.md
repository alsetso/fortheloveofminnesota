# Atlas Pin Visibility & Clustering Analysis

## Current Implementation

### Icons
- **Source**: Custom icons from `atlas_types.icon_path` (32x32px, resized from source)
- **Fallback**: Blue circles (6px radius) when no icon available
- **Overlap**: `icon-allow-overlap: true` - icons can overlap
- **Size**: Fixed 1.0 (no zoom-based scaling)
- **Placement**: `icon-ignore-placement: false` - respects label placement

### Labels
- **Content**: Entity name from `name` property
- **Font**: Open Sans Regular / Arial Unicode MS Regular
- **Size**: Fixed 11px
- **Colors**: Table-specific colors (parks=green, schools=yellow, etc.)
- **Placement**: Default Mapbox placement (auto-hides overlapping labels)
- **Offset**: [0, 1.5] - positioned above icon

### Current Issues with Dense Pin Areas

1. **No Clustering**: All pins show individually, even when very close
2. **Label Occlusion**: Mapbox automatically hides overlapping labels, making many entities invisible
3. **Icon Overlap**: Icons can stack on top of each other, obscuring visibility
4. **No Zoom-Based Visibility**: Same density at all zoom levels
5. **No Priority System**: All entity types treated equally
6. **Performance**: Rendering thousands of individual points can be slow

## Recommendations

### Option 1: Mapbox Native Clustering (Recommended)

**Pros:**
- Built into Mapbox GL JS
- Excellent performance
- Automatic cluster expansion on zoom
- Customizable cluster styling

**Implementation:**
```typescript
// Add clustering to GeoJSON source
mapboxMap.addSource(sourceId, {
  type: 'geojson',
  data: geoJSON,
  cluster: true,
  clusterMaxZoom: 14, // Max zoom to cluster points
  clusterRadius: 50, // Radius of each cluster (pixels)
  clusterProperties: {
    // Count entities by type
    'parks': ['+', ['case', ['==', ['get', 'table_name'], 'parks'], 1, 0]],
    'schools': ['+', ['case', ['==', ['get', 'table_name'], 'schools'], 1, 0]],
    // ... etc
  }
});

// Add cluster circles layer
mapboxMap.addLayer({
  id: 'atlas-clusters',
  type: 'circle',
  source: sourceId,
  filter: ['has', 'point_count'],
  paint: {
    'circle-color': [
      'step',
      ['get', 'point_count'],
      '#51bbd6', // < 10
      10, '#f1f075', // 10-50
      50, '#f28cb1' // > 50
    ],
    'circle-radius': [
      'step',
      ['get', 'point_count'],
      20, // < 10
      10, 30, // 10-50
      50, 40 // > 50
    ]
  }
});

// Add cluster count labels
mapboxMap.addLayer({
  id: 'atlas-cluster-count',
  type: 'symbol',
  source: sourceId,
  filter: ['has', 'point_count'],
  layout: {
    'text-field': '{point_count_abbreviated}',
    'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
    'text-size': 12
  }
});

// Add unclustered points (existing icon layer)
mapboxMap.addLayer({
  id: pointLayerId,
  type: 'symbol',
  source: sourceId,
  filter: ['!', ['has', 'point_count']], // Only non-clustered
  layout: iconImageLayout
});
```

**Cluster Click Handler:**
```typescript
mapboxMap.on('click', 'atlas-clusters', (e) => {
  const features = mapboxMap.queryRenderedFeatures(e.point, {
    layers: ['atlas-clusters']
  });
  const clusterId = features[0].properties.cluster_id;
  const source = mapboxMap.getSource(sourceId) as any;
  source.getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
    if (err) return;
    mapboxMap.easeTo({
      center: features[0].geometry.coordinates,
      zoom: zoom
    });
  });
});
```

### Option 2: Zoom-Based Visibility

**Icon Visibility:**
```typescript
// Show icons only at higher zoom levels
'icon-opacity': [
  'interpolate',
  ['linear'],
  ['zoom'],
  10, 0,    // Hidden below zoom 10
  12, 0.5,  // Fade in 10-12
  14, 1.0   // Full opacity at 14+
]
```

**Label Visibility:**
```typescript
// Show labels only at higher zoom levels
'text-opacity': [
  'interpolate',
  ['linear'],
  ['zoom'],
  12, 0,    // Hidden below zoom 12
  14, 0.7,  // Fade in 12-14
  16, 1.0   // Full opacity at 16+
]
```

**Icon Size Scaling:**
```typescript
'icon-size': [
  'interpolate',
  ['linear'],
  ['zoom'],
  0, 0.3,   // Small at low zoom
  10, 0.5,
  14, 0.8,
  18, 1.0,  // Full size at high zoom
  20, 1.2
]
```

### Option 3: Priority-Based Labeling

**Show labels only for important entities:**
```typescript
// Only show labels for featured entities or high-priority types
'text-field': [
  'case',
  ['==', ['get', 'favorite'], true], ['get', 'name'], // Featured entities
  ['in', ['get', 'table_name'], ['literal', ['parks', 'schools', 'hospitals']]], ['get', 'name'], // Priority types
  '' // Hide others
]
```

### Option 4: Density-Based Icon Sizing

**Smaller icons in dense areas:**
```typescript
// Use smaller icons when many entities are visible
'icon-size': [
  'interpolate',
  ['linear'],
  ['zoom'],
  0, ['*', 0.3, ['/', 1000, ['+', ['get', 'entity_count'], 1]]], // Smaller if many entities
  14, 0.8,
  18, 1.0
]
```

### Option 5: Layer Separation by Priority

**Render high-priority entities separately:**
```typescript
// Create separate sources/layers for different priority levels
const highPriorityTables = ['hospitals', 'schools', 'parks'];
const lowPriorityTables = ['watertowers', 'cemeteries', 'golf_courses'];

// High priority: Always visible, larger icons, labels always shown
// Low priority: Only visible at higher zoom, smaller icons, labels optional
```

## Recommended Strategy (Hybrid Approach)

### For Dense Urban Areas:

1. **Enable Clustering** (zoom 0-14)
   - Cluster radius: 50px
   - Show cluster counts
   - Expand on click

2. **Zoom-Based Visibility**
   - Icons: Fade in at zoom 10+, full opacity at 14+
   - Labels: Show at zoom 14+ only
   - Icon size: Scale with zoom (0.3x to 1.2x)

3. **Priority System**
   - **High Priority** (always show labels): hospitals, schools, parks
   - **Medium Priority** (labels at zoom 16+): churches, municipals, airports
   - **Low Priority** (icons only, no labels): watertowers, cemeteries, golf_courses

4. **Smart Label Placement**
   - `text-allow-overlap: false` (default) - let Mapbox optimize
   - `text-optional: true` - hide if can't place
   - Priority-based: High priority labels get placement preference

5. **Icon Overlap Control**
   - `icon-allow-overlap: false` at low zoom (0-12)
   - `icon-allow-overlap: true` at high zoom (14+) when fewer visible

### Configuration Options

Add to `atlas_types` table:
```sql
ALTER TABLE atlas.atlas_types ADD COLUMN IF NOT EXISTS display_priority INTEGER DEFAULT 5; -- 1-10, 1=highest
ALTER TABLE atlas.atlas_types ADD COLUMN IF NOT EXISTS min_zoom_icon INTEGER DEFAULT 0; -- Show icon at this zoom
ALTER TABLE atlas.atlas_types ADD COLUMN IF NOT EXISTS min_zoom_label INTEGER DEFAULT 14; -- Show label at this zoom
ALTER TABLE atlas.atlas_types ADD COLUMN IF NOT EXISTS cluster_enabled BOOLEAN DEFAULT true;
```

### Performance Optimizations

1. **Viewport-Based Loading**: Only load entities in current viewport
2. **LOD (Level of Detail)**: Use simplified icons at low zoom
3. **Throttle Updates**: Debounce map move events
4. **Web Workers**: Process clustering in background thread

## Implementation Priority

1. **Phase 1** (Quick Win): Add zoom-based icon/label visibility
2. **Phase 2** (High Impact): Implement Mapbox clustering
3. **Phase 3** (Polish): Add priority system and per-type configuration
4. **Phase 4** (Advanced): Viewport-based loading and performance optimizations

