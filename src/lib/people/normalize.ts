/**
 * Shared normalization for people search / public records.
 * Used by API routes (server) and client so DB never stores raw RapidAPI shapes.
 */

/** Flexible extraction for public-records API response. Handles PeopleDetails, Records, records, data, results. */
export function extractPublicRecords(
  data: Record<string, unknown> | null
): { records: Record<string, unknown>[]; count: number } {
  if (!data || 'error' in data) return { records: [], count: 0 };
  const arr =
    (data.PeopleDetails as Record<string, unknown>[] | undefined) ??
    (data.Records as Record<string, unknown>[] | undefined) ??
    (data.records as Record<string, unknown>[] | undefined) ??
    (data.data as Record<string, unknown>[] | undefined) ??
    (data.results as Record<string, unknown>[] | undefined) ??
    (Array.isArray(data) ? data : []);
  const records = Array.isArray(arr) ? arr : [];
  const count = records.length;
  return { records, count };
}

/** Convert a string to camelCase (e.g. "Person_name" -> "personName"). */
function toCamelCase(s: string): string {
  return s.replace(/_([a-z])/gi, (_, c) => c.toUpperCase()).replace(/^[A-Z]/, (c) => c.toLowerCase());
}

/** Recursively normalize object keys to camelCase. Arrays and primitives passed through. */
export function normalizeToCamelCase(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(normalizeToCamelCase);
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const camel = toCamelCase(k);
      out[camel] = normalizeToCamelCase(v);
    }
    return out;
  }
  return value;
}
