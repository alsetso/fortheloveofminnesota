# System Visibility Control - Quick Start

## What It Does

Allows admins to control which database schemas/systems are accessible to users. Maps schemas to routes and provides granular control over system visibility.

## Pattern

```
Database Schema → System → Primary Route → Sub-Routes
─────────────────────────────────────────────────────
maps            → Maps   → /maps        → /map/[id], /maps/new
civic           → Gov     → /gov         → /gov/people, /gov/orgs, /gov/checkbook/*
```

## Setup

### 1. Run Migration

```bash
# Update migration number (check latest migration first)
# Then run:
supabase db push
```

The migration creates:
- `admin.system_visibility` - System-level control
- `admin.route_visibility` - Route-level control
- Database functions for checking visibility

### 2. Access Admin UI

Navigate to `/admin/systems` to manage system visibility.

## Usage

### Disable a System

1. Go to `/admin/systems`
2. Find the system (e.g., "Stories")
3. Uncheck "Visible" or "Enabled"
4. All routes under that system become inaccessible

### Enable System with Feature Requirement

1. Set `requires_feature` to a billing feature slug
2. Only users with that feature can access the system

### Control Specific Routes

Routes can be individually controlled via `admin.route_visibility` table.

## Integration

- **Middleware**: Automatically checks route visibility
- **Billing**: Can require specific features for system access
- **Admin Dashboard**: Link to systems management added

## Benefits

- **Centralized**: One place to control system access
- **Schema-aligned**: Maps to your database structure
- **Granular**: System-level or route-level control
- **Feature-aware**: Integrates with billing features
- **Admin-friendly**: Simple UI to toggle systems

## Next Steps

1. Run the migration
2. Visit `/admin/systems` to see all systems
3. Toggle systems on/off as needed
4. Routes automatically respect visibility settings
