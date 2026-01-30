/**
 * URL-safe slug from collection title (lowercase, spaces → hyphens, strip non-alphanumeric).
 * Used for /:username/:collection routes.
 */
export function collectionTitleToSlug(title: string): string {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || 'collection';
}
