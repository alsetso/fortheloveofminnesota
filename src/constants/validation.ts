/**
 * Validation constants and helper functions
 */

export const VALIDATION = {
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  URL_REGEX: /^https?:\/\/.+/,
  SLUG_REGEX: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
} as const;

export function isValidEmail(email: string): boolean {
  return VALIDATION.EMAIL_REGEX.test(email);
}

export function isValidUrl(url: string): boolean {
  return VALIDATION.URL_REGEX.test(url);
}

export function isValidSlug(slug: string): boolean {
  return VALIDATION.SLUG_REGEX.test(slug);
}

export function validateRequired(value: string | null | undefined): boolean {
  return value !== null && value !== undefined && value.trim() !== '';
}

