/**
 * Shared normalization for people public records.
 * Handles PeopleDetails, Records, records, data, results.
 */
export function extractPublicRecords(
  data: Record<string, unknown> | null,
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
  return { records, count: records.length };
}

/**
 * "All Relatives" / "person ID" / "street_address" → allRelatives / personId / streetAddress.
 * Previous version only lowercased the first character, leaving broken keys like "all Relatives".
 */
export function toCamelCaseKey(s: string): string {
  const trimmed = s.trim();
  if (!trimmed) return trimmed;
  const spaced = trimmed.replace(/[^a-zA-Z0-9]+([a-zA-Z0-9])/g, (_, c: string) =>
    c.toUpperCase(),
  );
  const underscored = spaced.replace(/_([a-zA-Z0-9])/g, (_, c: string) => c.toUpperCase());
  return underscored.replace(/^[A-Z]/, (c) => c.toLowerCase());
}

/** Recursively normalize object keys to camelCase for person-detail archives. */
export function normalizeToCamelCase(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(normalizeToCamelCase);
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[toCamelCaseKey(k)] = normalizeToCamelCase(v);
    }
    return out;
  }
  return value;
}
