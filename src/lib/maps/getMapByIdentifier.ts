/**
 * Simple utility to get a map by ID or slug
 * Returns the map ID for use in other queries
 */

export interface MapIdentifier {
  id: string | null;
  slug: string | null;
}

/**
 * Determine if an identifier is a UUID or slug
 */
export function isUUID(identifier: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
}

/**
 * Parse identifier to determine if it's an ID or slug
 */
export function parseMapIdentifier(identifier: string): MapIdentifier {
  if (isUUID(identifier)) {
    return { id: identifier, slug: null };
  }
  return { id: null, slug: identifier };
}

/**
 * Check if a map should be rendered based on identifier
 * Simple logic: if map exists and is active, render it
 */
export function shouldRenderMap(map: {
  id: string;
  slug: string | null;
  is_active: boolean;
  visibility: string;
} | null): boolean {
  if (!map) return false;
  if (!map.is_active) return false;
  return true;
}
