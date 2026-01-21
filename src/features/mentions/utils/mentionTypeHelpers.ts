/**
 * Utility functions for mention types
 */

/**
 * Convert a mention type name to a URL-friendly slug
 * 
 * Examples:
 * - "Food & Drink" -> "food-and-drink"
 * - "Parks & Recreation" -> "parks-and-recreation"
 * - "Events (Public)" -> "events-public"
 * 
 * @param name - The mention type name to convert
 * @returns A URL-friendly slug
 */
export function mentionTypeNameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*&\s*/g, '-and-')
    .replace(/[()]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
