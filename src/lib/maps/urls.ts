/**
 * Map URL utilities
 * 
 * Centralized URL generation for maps following the principle:
 * - Internal state: Always use UUID (immutable, unique, reliable)
 * - External URLs: Always use slug when available (human-readable, SEO-friendly)
 * - API contracts: Accept both, resolve to ID internally
 * 
 * This ensures:
 * 1. Consistent URL generation across the application
 * 2. Canonical URLs (slug preferred, ID fallback)
 * 3. Single source of truth for URL structure
 * 4. Easy refactoring if URL structure changes
 */

export interface MapIdentifier {
  id: string;
  slug?: string | null;
  custom_slug?: string | null; // Legacy support during migration
}

/**
 * Get canonical map URL
 * 
 * Rules:
 * - Prefer slug over custom_slug over id
 * - Always returns a valid URL
 * - Used for all map page links
 * 
 * @example
 * getMapUrl({ id: 'uuid', slug: 'my-map' }) // '/map/my-map'
 * getMapUrl({ id: 'uuid' }) // '/map/uuid'
 */
export function getMapUrl(map: MapIdentifier): string {
  // Priority: slug > custom_slug (legacy) > id
  const identifier = map.slug || map.custom_slug || map.id;
  return `/map/${identifier}`;
}

/**
 * Get map post URL
 * 
 * @example
 * getMapPostUrl({ id: 'uuid', slug: 'my-map' }, 'post-id') 
 * // '/map/my-map/post/post-id'
 */
export function getMapPostUrl(
  map: MapIdentifier,
  postId: string
): string {
  const mapUrl = getMapUrl(map);
  return `${mapUrl}/post/${postId}`;
}

/**
 * Get map post edit URL
 * 
 * @example
 * getMapPostEditUrl({ id: 'uuid', slug: 'my-map' }, 'post-id')
 * // '/map/my-map/post/post-id/edit'
 */
export function getMapPostEditUrl(
  map: MapIdentifier,
  postId: string
): string {
  const mapUrl = getMapUrl(map);
  return `${mapUrl}/post/${postId}/edit`;
}

/**
 * Check if string is a valid UUID
 * 
 * Used to distinguish between UUID identifiers and slug identifiers
 */
export function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Resolve map identifier to UUID
 * 
 * Used by API routes to normalize input (slug or ID) to UUID.
 * This ensures all internal operations use UUID as the source of truth.
 * 
 * @param identifier - Either a UUID or a slug
 * @param supabase - Supabase client instance
 * @returns The map's UUID, or null if not found
 * 
 * @example
 * const mapId = await resolveMapId('my-map-slug', supabase);
 * // Returns: '550e8400-e29b-41d4-a716-446655440000'
 */
export async function resolveMapId(
  identifier: string,
  supabase: any
): Promise<string | null> {
  // If it's already a UUID, return it
  if (isUUID(identifier)) {
    return identifier;
  }
  
  // Otherwise, look up by slug
  const { data, error } = await supabase
    .from('map')
    .select('id')
    .eq('slug', identifier)
    .eq('is_active', true)
    .single();
  
  if (error || !data) {
    // Also check custom_slug for legacy support
    const { data: legacyData, error: legacyError } = await supabase
      .from('map')
      .select('id')
      .eq('custom_slug', identifier)
      .eq('is_active', true)
      .single();
    
    if (legacyError || !legacyData) {
      return null;
    }
    
    return legacyData.id;
  }
  
  return data.id;
}

/**
 * Check if current URL should be normalized
 * 
 * Returns true if the URL uses an ID but the map has a slug,
 * indicating a redirect to the canonical slug URL is needed.
 * 
 * @param urlIdentifier - The identifier from the URL (could be ID or slug)
 * @param map - The map data with slug
 */
export function shouldNormalizeUrl(
  urlIdentifier: string,
  map: MapIdentifier
): boolean {
  // If URL has UUID but map has slug, normalize
  const isUrlId = isUUID(urlIdentifier);
  const hasSlug = Boolean(map.slug || map.custom_slug);
  const urlIsNotSlug = urlIdentifier !== map.slug && urlIdentifier !== map.custom_slug;
  
  return isUrlId && hasSlug && urlIsNotSlug;
}
