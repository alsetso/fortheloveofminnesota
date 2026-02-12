# Explore Layers: Sub-Records & Left Sidebar

## Schema Review (layers)

| Table | Key Columns | Sample Data | Sub-Record Link |
|-------|-------------|-------------|-----------------|
| **state** | id, name, description, publisher | name="Minnesota State Boundary" | → counties (all 87) |
| **counties** | id, county_name, county_code, county_id | county_name="Chisago" | → cities_and_towns (via county_name) |
| **cities_and_towns** | id, ctu_class, feature_name, county_name, county_code, population | feature_name="Pequot Lakes", county_name="Crow Wing" | Leaf; no children |
| **districts** | id, district_number, name, description | district_number=1, name="precincts" | No FK; spatial overlap with counties |

## Hierarchy

```
state (1)
  └── counties (87)
        └── cities_and_towns (2693)
              └── (leaf)

districts (8) — no direct child table; overlaps counties spatially
```

## Sub-Record Logic

| Selected Record | Has Sub-Records? | Child Table | Link Field |
|-----------------|------------------|-------------|------------|
| State | ✓ | counties | (all) |
| County | ✓ | cities_and_towns | county_name |
| CTU (city/town) | ✗ | — | — |
| District | ✗* | — | *would need spatial join |

## UI Plan: Left Sidebar (Focus Mode)

**Current:** FocusModeLeftNav — back link + breadcrumb only.

**New:** When selected record has sub-records, show a **filtered list of children** (same UI as browse list: search, scroll, click to navigate). When no sub-records, keep minimal nav.

| Context | Left Sidebar |
|---------|--------------|
| State selected | List of 87 counties (searchable) |
| County selected | List of CTUs in that county (searchable) |
| CTU selected | FocusModeLeftNav (back + breadcrumb) |
| District selected | FocusModeLeftNav |

## Data Formatting for List

| Table | Display | Secondary |
|-------|---------|-----------|
| state | name | — |
| counties | county_name | — |
| cities_and_towns | feature_name | county_name, ctu_class, population |
| districts | `District ${district_number}` | name |

## API Usage

- **State → Counties:** `/api/civic/county-boundaries` (all)
- **County → CTUs:** `/api/civic/ctu-boundaries?county_name=Hennepin`
- CTU API already supports `county_name` filter (see route validation)
