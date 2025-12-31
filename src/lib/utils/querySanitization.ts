/**
 * Sanitizes a string for use in Supabase query filters
 * Escapes special characters that could interfere with query syntax
 */
export function sanitizeForQuery(value: string): string {
  // Replace any characters that could interfere with Supabase query syntax
  // The main concern is %, _, and other special characters in ILIKE patterns
  // Since we're using % wildcards, we need to escape literal % and _ characters
  return value
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .replace(/\\/g, '\\\\');
}

/**
 * Sanitizes county name for use in ILIKE queries
 * Handles both base name (without "County") and full name
 */
export function sanitizeCountyNameForQuery(countyName: string): {
  base: string;
  full: string;
} {
  const base = countyName.replace(/\s+County$/, '');
  const full = countyName.includes('County') 
    ? countyName 
    : `${countyName} County`;
  
  return {
    base: sanitizeForQuery(base),
    full: sanitizeForQuery(full),
  };
}

