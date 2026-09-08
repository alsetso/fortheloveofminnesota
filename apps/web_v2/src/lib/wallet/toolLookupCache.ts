import { createHash } from 'crypto';

/** Property results change slowly; people data gets a longer window before PII purge. */
export const PROPERTY_CACHE_DAYS = 30;
export const PEOPLE_CACHE_DAYS = 60;

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** Deterministic cache key for an address lookup (case/whitespace/punctuation-insensitive). */
export function addressCacheHash(address: string): string {
  const normalized = address.toLowerCase().replace(/[.,#]/g, ' ').replace(/\s+/g, ' ').trim();
  return sha256Hex(`address:${normalized}`);
}

/** Deterministic cache key for a people search (per search type). */
export function peopleQueryCacheHash(type: 'name' | 'email' | 'phone', value: string): string {
  let normalized: string;
  switch (type) {
    case 'email':
      normalized = value.toLowerCase().trim();
      break;
    case 'phone':
      normalized = value.replace(/\D/g, '');
      break;
    default:
      normalized = value.toLowerCase().replace(/\s+/g, ' ').trim();
  }
  return sha256Hex(`${type}:${normalized}`);
}

/** Deterministic cache key for a deep person-detail pull by provider person ID. */
export function personDetailCacheHash(personId: string): string {
  return sha256Hex(`person-detail:${personId.trim().toLowerCase()}`);
}

export function expiryIso(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}
