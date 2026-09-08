/**
 * Legacy dock `query` codes (no longer auto-applied on contact open):
 * - `just-saved` — was acknowledge banner
 * - `enhance:<peoId>|…` — was auto deep-pull
 * Parsers kept for old deep-links; Contact detail ignores them.
 */

export type ContactEnhanceIntent = {
  peoId: string;
  parentEnrichmentId?: string;
  contactAddressId?: string;
  parentLookupId?: string;
};

export type ContactDetailQuery = {
  justSaved: boolean;
  enhance: ContactEnhanceIntent | null;
};

export function parseContactDetailQuery(query?: string | null): ContactDetailQuery {
  if (!query) return { justSaved: false, enhance: null };
  if (query === 'just-saved') return { justSaved: true, enhance: null };
  if (!query.startsWith('enhance:')) return { justSaved: false, enhance: null };

  const parts = query.slice('enhance:'.length).split('|').map((p) => p.trim()).filter(Boolean);
  const peoId = parts[0];
  if (!peoId) return { justSaved: false, enhance: null };

  const enhance: ContactEnhanceIntent = { peoId };
  for (const part of parts.slice(1)) {
    if (part.startsWith('e:')) enhance.parentEnrichmentId = part.slice(2) || undefined;
    else if (part.startsWith('a:')) enhance.contactAddressId = part.slice(2) || undefined;
    else if (part.startsWith('l:')) enhance.parentLookupId = part.slice(2) || undefined;
  }
  return { justSaved: false, enhance };
}

export function buildEnhanceContactQuery(intent: ContactEnhanceIntent): string {
  const bits = [`enhance:${intent.peoId}`];
  if (intent.parentEnrichmentId) bits.push(`e:${intent.parentEnrichmentId}`);
  if (intent.contactAddressId) bits.push(`a:${intent.contactAddressId}`);
  if (intent.parentLookupId) bits.push(`l:${intent.parentLookupId}`);
  return bits.join('|');
}
