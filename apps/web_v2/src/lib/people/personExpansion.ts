/**
 * Person-detail expansion helpers — peo_id is the durable provider person key.
 */

export function getPeoId(record: Record<string, unknown> | null | undefined): string | null {
  if (!record) return null;
  for (const key of [
    'peo_id',
    'person ID',
    'Person ID',
    'personId',
    'PersonId',
    'person_id',
    'personID',
  ]) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}
