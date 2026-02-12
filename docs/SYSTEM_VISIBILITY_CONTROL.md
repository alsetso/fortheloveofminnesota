# System Visibility Control System

## Overview

Admin-controlled system to manage which database schemas/systems are accessible to users. Maps database schemas to route groups and allows admins to enable/disable entire systems.

## Architecture

### Pattern: Schema → Route Group → Sub-Routes

```
Database Schema → Primary Route → Sub-Routes (based on tables)
─────────────────────────────────────────────────────────────
maps            → /maps          → /map/[id], /maps/new
civic           → /gov           → /gov/people, /gov/orgs, /gov/checkbook/*
billing         → /settings/billing → /plans, /settings/billing
stories         → /stories        → /stories/new, /stories/new/composer
```

## Database Schema

### `admin.system_visibility`

```sql
CREATE TABLE admin.system_visibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_name TEXT NOT NULL UNIQUE, -- e.g., 'maps', 'civic', 'stories'
  system_name TEXT NOT NULL, -- Display name: 'Maps', 'Government Directory'
  primary_route TEXT NOT NULL, -- Main route: '/maps', '/gov'
  is_visible BOOLEAN DEFAULT true, -- Can users access this system?
  is_enabled BOOLEAN DEFAULT true, -- Is system fully functional?
  requires_feature TEXT, -- Optional: billing feature slug (e.g., 'unlimited_maps')
  description TEXT,
  icon TEXT, -- Icon identifier for UI
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX idx_system_visibility_schema ON admin.system_visibility(schema_name);
CREATE INDEX idx_system_visibility_visible ON admin.system_visibility(is_visible) WHERE is_visible = true;
```

### `admin.route_visibility`

```sql
CREATE TABLE admin.route_visibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_path TEXT NOT NULL UNIQUE, -- e.g., '/maps', '/gov/people'
  system_id UUID REFERENCES admin.system_visibility(id) ON DELETE CASCADE,
  is_visible BOOLEAN DEFAULT true,
  requires_feature TEXT, -- Optional: billing feature slug
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_route_visibility_path ON admin.route_visibility(route_path);
CREATE INDEX idx_route_visibility_system ON admin.route_visibility(system_id);
```

## Schema-to-Route Mapping

Based on `SCHEMA_ROUTES_COVERAGE.md`:

| Schema | System Name | Primary Route | Sub-Routes |
|--------|-------------|---------------|------------|
| `maps` | Maps | `/maps` | `/map/[id]`, `/maps/new` |
| `civic` | Government Directory | `/gov` | `/gov/people`, `/gov/orgs`, `/gov/checkbook/*` |
| `stories` | Stories | `/stories` | `/stories/new`, `/stories/new/composer` |
| `feeds` | Feed | `/feed` | — |
| `pages` | Pages | `/pages` | `/page/[id]`, `/pages/new` |
| `social_graph` | Friends | `/friends` | — |
| `messaging` | Messages | `/messages` | — |
| `places` | Places | `/explore/places` | — |
| `ads` | Ad Center | `/ad_center` | `/ad_center/credits` |
| `analytics` | Analytics | `/analytics` | — |
| `checkbook` | Checkbook | `/gov/checkbook` | `/gov/checkbook/budget`, `/payments`, `/payroll`, `/contracts` |

## Implementation

### 1. Migration: Create Tables

```sql
-- supabase/migrations/XXXX_create_system_visibility.sql
CREATE SCHEMA IF NOT EXISTS admin;

CREATE TABLE admin.system_visibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_name TEXT NOT NULL UNIQUE,
  system_name TEXT NOT NULL,
  primary_route TEXT NOT NULL,
  is_visible BOOLEAN DEFAULT true,
  is_enabled BOOLEAN DEFAULT true,
  requires_feature TEXT REFERENCES billing.features(slug),
  description TEXT,
  icon TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE admin.route_visibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_path TEXT NOT NULL UNIQUE,
  system_id UUID REFERENCES admin.system_visibility(id) ON DELETE CASCADE,
  is_visible BOOLEAN DEFAULT true,
  requires_feature TEXT REFERENCES billing.features(slug),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed initial systems
INSERT INTO admin.system_visibility (schema_name, system_name, primary_route, display_order) VALUES
  ('maps', 'Maps', '/maps', 1),
  ('civic', 'Government Directory', '/gov', 2),
  ('stories', 'Stories', '/stories', 3),
  ('feeds', 'Feed', '/feed', 4),
  ('pages', 'Pages', '/pages', 5),
  ('social_graph', 'Friends', '/friends', 6),
  ('messaging', 'Messages', '/messages', 7),
  ('places', 'Places', '/explore/places', 8),
  ('ads', 'Ad Center', '/ad_center', 9),
  ('analytics', 'Analytics', '/analytics', 10);
```

### 2. Helper Functions

```typescript
// src/lib/admin/systemVisibility.ts

/**
 * Check if a system (schema) is visible to users
 */
export async function isSystemVisible(schemaName: string): Promise<boolean> {
  // Check admin.system_visibility
}

/**
 * Check if a specific route is visible
 */
export async function isRouteVisible(routePath: string): Promise<boolean> {
  // Check admin.route_visibility, fallback to system visibility
}

/**
 * Get all visible systems for current user
 */
export async function getVisibleSystems(): Promise<SystemVisibility[]> {
  // Returns systems where is_visible = true
  // Filters by billing features if requires_feature is set
}
```

### 3. Middleware Integration

```typescript
// src/middleware.ts

// After auth checks, before route protection:
const routeVisibility = await isRouteVisible(pathname);
if (!routeVisibility) {
  return NextResponse.redirect(new URL('/', req.url));
}

// Check system-level visibility
const systemVisibility = await getSystemForRoute(pathname);
if (systemVisibility && !systemVisibility.is_visible) {
  return NextResponse.redirect(new URL('/', req.url));
}
```

### 4. Admin UI

**Route**: `/admin/systems`

**Features**:
- List all systems (schemas)
- Toggle `is_visible` per system
- Toggle `is_enabled` per system
- View/edit route mappings
- Set feature requirements
- See which routes belong to which system

## Usage Flow

1. **Admin disables "Stories" system**
   - Sets `admin.system_visibility.is_visible = false` for `schema_name = 'stories'`
   - All routes under `/stories` become inaccessible
   - Middleware redirects to homepage

2. **Admin enables "Maps" but requires feature**
   - Sets `requires_feature = 'unlimited_maps'`
   - Only users with that feature can access `/maps` routes

3. **Admin disables specific route**
   - Sets `admin.route_visibility.is_visible = false` for `/gov/checkbook/payroll`
   - That specific route blocked, but other `/gov` routes still work

## Benefits

- **Centralized control**: One place to manage system access
- **Schema-based**: Aligns with database structure
- **Feature integration**: Works with existing billing features
- **Granular**: System-level or route-level control
- **Admin-friendly**: Simple UI to toggle systems on/off
