/**
 * Formats a number with locale-specific thousands separators
 * @param num - Number to format (can be null or undefined)
 * @returns Formatted string or 'N/A' if null/undefined
 */
export function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return 'N/A';
  return num.toLocaleString('en-US');
}

/**
 * Formats an area value in square miles
 * @param area - Area in square miles (can be null or undefined)
 * @returns Formatted string with units or 'N/A' if null/undefined
 */
export function formatArea(area: number | null | undefined): string {
  if (area === null || area === undefined) return 'N/A';
  return `${formatNumber(area)} sq mi`;
}






