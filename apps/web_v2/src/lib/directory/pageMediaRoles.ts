/**
 * pages.page_media.role — logo | cover | gallery.
 * pages.pages also has cover_url / icon for legacy fallbacks.
 */
export const PAGE_MEDIA_ROLES = ['logo', 'cover', 'gallery'] as const;
export type PageMediaRole = (typeof PAGE_MEDIA_ROLES)[number];

export type PageMediaPrimaryRole = 'logo' | 'cover';

export function isPageMediaPrimaryRole(value: unknown): value is PageMediaPrimaryRole {
  return value === 'logo' || value === 'cover';
}
