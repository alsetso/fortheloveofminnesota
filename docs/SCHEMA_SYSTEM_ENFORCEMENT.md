# Schema-to-System Enforcement Architecture

## Overview

This document describes the unified architecture for enforcing schema-to-system mapping across the entire application. All database queries must respect system visibility settings.

## Core Principles

1. **Single Source of Truth**: `admin.system_visibility` table maps schemas to systems
2. **Database-First**: All checks happen via PostgreSQL functions (single query, optimized)
3. **Fail Closed**: If system is disabled, all routes/queries are blocked
4. **Schema-Aware**: All API routes check schema accessibility before querying

## Architecture Components

### 1. Database Functions

#### `admin.get_system_for_route(p_route_path TEXT)`
Optimized single-query function to get system for a route. Replaces fetching all systems and matching in TypeScript.

**Priority Order:**
1. Exact match (`primary_route = routePath`)
2. Prefix match (`routePath LIKE primary_route || '/%'`)
3. Segment match (first URL segment matches)

#### `admin.get_system_for_schema(p_schema_name TEXT)`
Get system visibility record for a schema name.

#### `admin.is_schema_accessible(p_schema_name TEXT, p_user_id UUID)`
Check if schema is accessible (system visible + enabled + feature requirements met).

#### `admin.get_accessible_schemas(p_user_id UUID)`
Get all accessible schema names for a user.

### 2. TypeScript Utilities

#### `src/lib/supabase/unified.ts`
**Unified Supabase Client Factory**

```typescript
// Anonymous client (public reads, RLS-protected)
const client = await createSupabaseClient();

// Authenticated client (includes user session)
const client = await createSupabaseClient({ auth: true });

// Service client (bypasses RLS, admin only)
const client = await createSupabaseClient({ service: true });
```

**Migration from old pattern:**
- `createServerClient()` → `createSupabaseClient()`
- `createServerClientWithAuth()` → `createSupabaseClient({ auth: true })`
- `createServiceClient()` → `createSupabaseClient({ service: true })`

#### `src/lib/admin/systemVisibility.ts`
**Route Visibility Checks**

```typescript
// Check if route is visible (uses optimized DB function)
const visible = await isRouteVisible('/maps', userId);

// Get system for route (single SQL query)
const system = await getSystemForRoute('/maps');
```

#### `src/lib/admin/schemaMapping.ts`
**Schema-to-System Mapping**

```typescript
// Get schema name for system
const schema = await getSchemaForSystem('Maps'); // Returns 'maps'

// Get system for schema
const system = await getSystemForSchema('maps');

// Check if schema is accessible
const accessible = await isSchemaAccessible('maps', userId);

// Get all accessible schemas
const schemas = await getAccessibleSchemas(userId);
```

#### `src/lib/api/schemaEnforcement.ts`
**API Route Schema Enforcement**

```typescript
// Get schema for API route
const schema = getSchemaForRoute('/api/maps'); // Returns 'maps'

// Enforce schema access (throws if not accessible)
const { schema, system } = await enforceSchemaAccess('/api/maps', userId);

// Middleware wrapper for API routes
export async function GET(request: NextRequest) {
  return enforceApiSchemaAccess(request, async (req, { schema, userId }) => {
    const supabase = await createSupabaseClient({ auth: true });
    const { data } = await supabase.schema(schema).from('maps').select('*');
    return NextResponse.json({ data });
  });
}
```

### 3. Route-to-Schema Mapping

**File**: `src/lib/api/schemaEnforcement.ts`

Maps API route paths to database schemas:

```typescript
const ROUTE_SCHEMA_MAP = {
  '/api/maps': 'maps',
  '/api/posts': 'content',
  '/api/mentions': 'public',
  '/api/gov': 'civic',
  // ... etc
};
```

## Migration Guide

### Step 1: Update Supabase Client Imports

**Before:**
```typescript
import { createServerClientWithAuth } from '@/lib/supabaseServer';
const supabase = await createServerClientWithAuth();
```

**After:**
```typescript
import { createSupabaseClient } from '@/lib/supabase/unified';
const supabase = await createSupabaseClient({ auth: true });
```

### Step 2: Add Schema Access Checks to API Routes

**Before:**
```typescript
export async function GET(request: NextRequest) {
  const supabase = await createServerClientWithAuth();
  const { data } = await supabase.schema('maps').from('maps').select('*');
  return NextResponse.json({ data });
}
```

**After:**
```typescript
import { enforceApiSchemaAccess } from '@/lib/api/schemaEnforcement';

export async function GET(request: NextRequest) {
  return enforceApiSchemaAccess(request, async (req, { schema, userId }) => {
    const supabase = await createSupabaseClient({ auth: true });
    const { data } = await supabase.schema(schema).from('maps').select('*');
    return NextResponse.json({ data });
  });
}
```

### Step 3: Update Route Visibility Checks

**Before:**
```typescript
// Fetched all systems, matched in TypeScript
const allSystems = await supabase.from('system_visibility').select('*');
const system = allSystems.find(s => routePath.startsWith(s.primary_route));
```

**After:**
```typescript
// Single optimized database query
const system = await getSystemForRoute(routePath);
```

## Global Enforcement Points

### 1. Middleware (`src/middleware.ts`)
- Checks route visibility before allowing page access
- Uses optimized `getSystemForRoute()` function
- Redirects to homepage with "Coming Soon" toast if disabled

### 2. API Routes
- Should use `enforceApiSchemaAccess()` wrapper
- Checks schema accessibility before querying
- Returns 403 if schema is not accessible

### 3. Server Components
- Can use `isSchemaAccessible()` before rendering
- Can use `getAccessibleSchemas()` to filter UI

## Testing

### Test System Visibility
1. Disable a system in `/admin/systems`
2. Attempt to access routes for that system
3. Should redirect to homepage with "Coming Soon" toast
4. API routes should return 403

### Test Schema Enforcement
1. Disable "Maps" system
2. Call `/api/maps` endpoint
3. Should return 403 with error message

## Performance Optimizations

1. **Single Query Matching**: `getSystemForRoute()` uses one SQL query instead of fetching all systems
2. **Database Functions**: All checks happen in PostgreSQL (faster than TypeScript loops)
3. **Caching**: Consider caching accessible schemas per user session

## Future Enhancements

1. **Automatic Route Discovery**: Scan codebase to auto-populate `ROUTE_SCHEMA_MAP`
2. **Schema Validation**: TypeScript types that enforce schema names
3. **Query Builder**: Wrapper that automatically checks schema access before queries
