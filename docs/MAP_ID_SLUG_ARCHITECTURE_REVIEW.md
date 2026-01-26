# Map ID vs Slug Architecture Review

## Current State Analysis

### Problem Statement
The codebase uses map IDs (UUIDs) as the source of truth internally, but displays slugs in URLs. However, the implementation is inconsistent, leading to:
- Mixed URL patterns (some use ID, some use slug)
- No canonical URL enforcement
- Duplicated URL generation logic across components
- Route parameter named `[id]` but accepts both IDs and slugs

### Current Issues

#### 1. Inconsistent URL Generation
Found 30+ instances of map URL generation with different patterns:

**Pattern A: Always use ID**
```typescript
// MapListItem.tsx:166
router.push(`/map/${map.id}`);

// MapDetailsPopup.tsx:193
router.push(`/map/${map.id}`);
```

**Pattern B: Slug with ID fallback**
```typescript
// FeedPost.tsx:157
postHref={post.map ? `/map/${post.map.slug || post.map.id}/post/${post.id}` : `/post/${post.id}`}

// PostDetailClient.tsx:354
href={`/map/${post.map.slug || post.map.id}`}
```

**Pattern C: Custom slug with ID fallback (legacy)**
```typescript
// maps/new/page.tsx:368
? `/map/${createdMap.custom_slug}`
: `/map/${createdMap.id}`;
```

**Pattern D: Conditional slug**
```typescript
// maps/page.tsx:82
href: map.slug ? `/map/${map.slug}` : `/map/${map.id}`,
```

#### 2. Route Parameter Confusion
- Route: `/map/[id]` 
- Parameter name suggests ID only
- Implementation accepts both UUID and slug
- No documentation of this behavior

#### 3. No URL Normalization
- When a map loads with ID in URL but has a slug, no redirect occurs
- Users can access same map via multiple URLs
- SEO and analytics fragmentation

#### 4. API Inconsistency
- APIs check if identifier is UUID, if not assume slug
- Works but creates confusion about what the parameter represents
- No clear contract

#### 5. Missing Slug Guarantee
- Not all maps may have slugs
- No fallback generation strategy
- Inconsistent data model

## Senior Dev Solution

### Principle: Separation of Concerns
- **Internal State**: Always use UUID (immutable, unique, reliable)
- **External URLs**: Always use slug when available (human-readable, SEO-friendly)
- **API Contracts**: Accept both, resolve to ID internally

### Implementation Strategy

#### 1. Centralized URL Utility

Create `/src/lib/maps/urls.ts`:

```typescript
/**
 * Map URL utilities
 * 
 * Rules:
 * - Always prefer slug over ID for URLs
 * - Generate canonical URLs consistently
 * - Use ID only when slug unavailable
 */

export interface MapIdentifier {
  id: string;
  slug?: string | null;
  custom_slug?: string | null; // Legacy support
}

/**
 * Get canonical map URL
 * Always uses slug if available, falls back to ID
 */
export function getMapUrl(map: MapIdentifier): string {
  const identifier = map.slug || map.custom_slug || map.id;
  return `/map/${identifier}`;
}

/**
 * Get map post URL
 */
export function getMapPostUrl(
  map: MapIdentifier, 
  postId: string
): string {
  const mapUrl = getMapUrl(map);
  return `${mapUrl}/post/${postId}`;
}

/**
 * Get map edit post URL
 */
export function getMapPostEditUrl(
  map: MapIdentifier,
  postId: string
): string {
  const mapUrl = getMapUrl(map);
  return `${mapUrl}/post/${postId}/edit`;
}

/**
 * Check if string is UUID
 */
export function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Resolve map identifier to ID
 * Used by APIs to normalize input (slug or ID) to ID
 */
export async function resolveMapId(
  identifier: string,
  supabase: any
): Promise<string | null> {
  if (isUUID(identifier)) {
    return identifier;
  }
  
  // Look up by slug
  const { data, error } = await supabase
    .from('map')
    .select('id')
    .eq('slug', identifier)
    .eq('is_active', true)
    .single();
  
  if (error || !data) {
    return null;
  }
  
  return data.id;
}
```

#### 2. URL Normalization in Map Page

Add redirect logic to `/src/app/map/[id]/page.tsx`:

```typescript
// After mapData loads, check if URL should be normalized
useEffect(() => {
  if (!mapData || !mapId) return;
  
  // If URL has ID but map has slug, redirect to canonical slug URL
  const isCurrentUrlId = isUUID(mapId);
  const hasSlug = mapData.slug && mapData.slug !== mapId;
  
  if (isCurrentUrlId && hasSlug) {
    router.replace(`/map/${mapData.slug}`, { scroll: false });
  }
}, [mapData, mapId, router]);
```

#### 3. Update All URL Generation

Replace all instances with utility function:

**Before:**
```typescript
router.push(`/map/${map.id}`);
```

**After:**
```typescript
import { getMapUrl } from '@/lib/maps/urls';
router.push(getMapUrl(map));
```

**Before:**
```typescript
href={post.map ? `/map/${post.map.slug || post.map.id}/post/${post.id}` : '#'}
```

**After:**
```typescript
import { getMapPostUrl } from '@/lib/maps/urls';
href={post.map ? getMapPostUrl(post.map, post.id) : '#'}
```

#### 4. API Route Updates

Update `/src/app/api/maps/[id]/route.ts`:

```typescript
import { resolveMapId } from '@/lib/maps/urls';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      const { id } = await params;
      
      // Document: [id] parameter accepts both UUID and slug
      // Internally we resolve to ID for consistency
      const supabase = auth 
        ? await createServerClientWithAuth(cookies())
        : createServerClient();
      
      const mapId = await resolveMapId(id, supabase);
      
      if (!mapId) {
        return createErrorResponse('Map not found', 404);
      }
      
      // Continue with mapId (always UUID internally)
      const { data: map, error } = await supabase
        .from('map')
        .select('...')
        .eq('id', mapId)
        .single();
      
      // ...
    }
  );
}
```

#### 5. Database Migration: Ensure All Maps Have Slugs

```sql
-- Generate slugs for maps without them
UPDATE map
SET slug = LOWER(REGEXP_REPLACE(
  REGEXP_REPLACE(name, '[^a-zA-Z0-9\s-]', '', 'g'),
  '\s+', '-', 'g'
)) || '-' || SUBSTRING(id::text, 1, 8)
WHERE slug IS NULL OR slug = '';

-- Add unique constraint on slug
CREATE UNIQUE INDEX IF NOT EXISTS map_slug_unique 
ON map(slug) 
WHERE is_active = true AND slug IS NOT NULL;
```

#### 6. Type Safety Updates

Update `MapItem` and `MapData` types to ensure slug is always present:

```typescript
export interface MapData {
  id: string;
  slug: string; // Remove optional, make required
  // ...
}
```

#### 7. Route Documentation

Update route file comments:

```typescript
/**
 * GET /api/maps/[id]
 * 
 * @param id - Map identifier (UUID or slug)
 *           - UUID: Direct lookup by primary key
 *           - Slug: Resolved to UUID internally
 *           - Both resolve to same map, slug is canonical
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated) or 100/min (public)
 * - Path parameter validation
 * - Optional authentication (RLS handles permissions)
 */
```

### Migration Checklist

1. ✅ Create `/src/lib/maps/urls.ts` utility
2. ✅ Add URL normalization to map page
3. ✅ Update all URL generation to use utility (30+ files)
4. ✅ Update API routes to use `resolveMapId`
5. ✅ Add database migration for slug generation
6. ✅ Update TypeScript types
7. ✅ Add route documentation
8. ✅ Test: ID URLs redirect to slug URLs
9. ✅ Test: Slug URLs work correctly
10. ✅ Test: Maps without slugs still work (fallback to ID)

### Benefits

1. **Consistency**: Single source of truth for URL generation
2. **SEO**: Canonical URLs always use slugs
3. **Maintainability**: Change URL structure in one place
4. **Type Safety**: Clear contracts between components
5. **User Experience**: Clean, readable URLs
6. **Analytics**: Single canonical URL per map

### Backward Compatibility

- Existing ID-based URLs continue to work (redirect to slug)
- APIs accept both ID and slug
- No breaking changes for external integrations
- Gradual migration path

## Files Requiring Updates

### High Priority (URL Generation)
- `src/app/maps/components/MapListItem.tsx`
- `src/app/maps/components/MapCard.tsx`
- `src/app/maps/components/MapDetailsPopup.tsx`
- `src/components/feed/FeedPost.tsx`
- `src/features/posts/components/PostDetailClient.tsx`
- `src/components/layout/SearchResults.tsx`
- `src/app/maps/page.tsx`
- `src/app/maps/new/page.tsx`

### Medium Priority (API Routes)
- `src/app/api/maps/[id]/route.ts`
- `src/app/api/maps/[id]/data/route.ts`
- `src/app/api/maps/[id]/stats/route.ts`
- `src/app/api/maps/[id]/pins/route.ts`
- `src/app/api/maps/[id]/areas/route.ts`

### Low Priority (Internal Logic)
- `src/app/map/[id]/page.tsx` (add normalization)
- `src/components/layout/MapsSelectorDropdown.tsx`
- `src/components/layout/PageWrapper.tsx`

## Implementation Examples

### Example 1: Fix MapListItem.tsx

**Before:**
```typescript
// For user-generated maps, navigate to map page
if ((map as any).map_type === 'user' && !map.href) {
  e.preventDefault();
  router.push(`/map/${map.id}`); // ❌ Always uses ID
  return;
}
```

**After:**
```typescript
import { getMapUrl } from '@/lib/maps/urls';

// For user-generated maps, navigate to map page
if ((map as any).map_type === 'user' && !map.href) {
  e.preventDefault();
  router.push(getMapUrl(map)); // ✅ Uses slug when available
  return;
}
```

### Example 2: Fix FeedPost.tsx

**Before:**
```typescript
<MultiImageGrid 
  images={post.images ?? []} 
  postHref={post.map ? `/map/${post.map.slug || post.map.id}/post/${post.id}` : `/post/${post.id}`} 
/>
```

**After:**
```typescript
import { getMapPostUrl } from '@/lib/maps/urls';

<MultiImageGrid 
  images={post.images ?? []} 
  postHref={post.map ? getMapPostUrl(post.map, post.id) : `/post/${post.id}`} 
/>
```

### Example 3: Add URL Normalization to Map Page

Add after mapData loads in `/src/app/map/[id]/page.tsx`:

```typescript
import { shouldNormalizeUrl, getMapUrl } from '@/lib/maps/urls';

// URL normalization: redirect ID URLs to slug URLs when available
useEffect(() => {
  if (!mapData || !mapId || loading) return;
  
  // Check if we should redirect to canonical slug URL
  if (shouldNormalizeUrl(mapId, mapData)) {
    const canonicalUrl = getMapUrl(mapData);
    router.replace(canonicalUrl, { scroll: false });
  }
}, [mapData, mapId, loading, router]);
```

### Example 4: Update API Route

**Before:**
```typescript
// Check if identifier is a UUID or a slug
if (isUUID(identifier)) {
  query = query.eq('id', identifier);
} else {
  // Assume it's a slug
  query = query.eq('slug', identifier);
}
```

**After:**
```typescript
import { resolveMapId } from '@/lib/maps/urls';

// Resolve identifier (slug or ID) to UUID
const mapId = await resolveMapId(identifier, supabase);

if (!mapId) {
  return createErrorResponse('Map not found', 404);
}

// Always use UUID internally
const { data: map, error } = await supabase
  .from('map')
  .select('...')
  .eq('id', mapId)
  .single();
```

## Testing Strategy

1. **URL Generation Tests**
   - Map with slug → uses slug
   - Map without slug → uses ID
   - Legacy custom_slug → uses custom_slug

2. **Redirect Tests**
   - Access `/map/{uuid}` with slug → redirects to `/map/{slug}`
   - Access `/map/{slug}` → works directly
   - Access `/map/{uuid}` without slug → works directly

3. **API Tests**
   - GET `/api/maps/{uuid}` → works
   - GET `/api/maps/{slug}` → resolves to same map
   - Invalid identifier → 404

4. **Integration Tests**
   - Navigation from map list → uses slug URL
   - Post links → use slug URLs
   - Share functionality → uses slug URLs

## Summary: Senior Dev Approach

A senior developer would fix this by:

1. **Creating a single source of truth** (`/src/lib/maps/urls.ts`)
   - Centralizes all URL generation logic
   - Makes refactoring trivial (change in one place)
   - Provides clear API contracts

2. **Enforcing canonical URLs**
   - Redirect ID URLs to slug URLs when available
   - Prevents duplicate content issues
   - Improves SEO

3. **Maintaining backward compatibility**
   - APIs accept both ID and slug
   - Existing ID URLs still work (with redirect)
   - No breaking changes

4. **Using ID internally, slug externally**
   - All state management uses UUID
   - All URLs use slug when available
   - Clear separation of concerns

5. **Type safety and documentation**
   - Clear function signatures
   - JSDoc comments explain behavior
   - TypeScript ensures correct usage

This approach is:
- **Maintainable**: Change URL structure in one place
- **Scalable**: Easy to add new URL patterns
- **Testable**: Clear contracts, easy to mock
- **User-friendly**: Clean, readable URLs
- **SEO-friendly**: Canonical URLs, no duplicates
