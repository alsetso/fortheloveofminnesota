/**
 * Build ContactCandidate rows from universal search / map / Find Me — free save path.
 */

import {
  addressIdentityKey,
  personIdentityKey,
  type AddressCandidate,
  type PersonCandidate,
} from '@/features/contacts/logic/identifyCandidates';
import type { ContactSaveSource } from '@/features/contacts/state/contactConfirmDraft';

export function personCandidateFromAccount(input: {
  id: string;
  title: string;
  subtitle?: string | null;
  username?: string | null;
  imageUrl?: string | null;
}): PersonCandidate {
  const parts = input.title.trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0];
  const lastName = parts.length > 1 ? parts.slice(1).join(' ') : undefined;
  const linkedAccountId = input.id;
  const key = personIdentityKey({
    linkedAccountId,
    firstName,
    lastName,
    displayName: input.title,
  });
  return {
    kind: 'person',
    key,
    displayName: input.title.trim() || input.username || 'Account',
    firstName,
    lastName,
    emails: [],
    phones: [],
    linkedAccountId,
    subtitle: input.subtitle ?? (input.username ? `@${input.username}` : 'Linked account'),
    raw: {
      id: input.id,
      username: input.username,
      image_url: input.imageUrl,
      first_name: firstName,
      last_name: lastName,
      match_type: 'account',
    },
  };
}

/** Best-effort parse of Mapbox place_name → address parts. */
export function parsePlaceLabel(placeName: string): {
  label: string;
  line1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
} {
  const label = placeName.trim();
  const parts = label.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return { label };

  const line1 = parts[0];
  let city: string | undefined;
  let state: string | undefined;
  let postalCode: string | undefined;

  // "Street, City, State ZIP, Country" or "Street, City, Minnesota, United States"
  if (parts.length >= 2) city = parts[1];
  if (parts.length >= 3) {
    const statePart = parts[2];
    const zipMatch = statePart.match(/^([A-Za-z. ]+?)\s+(\d{5}(?:-\d{4})?)$/);
    if (zipMatch) {
      state = zipMatch[1].replace(/\bMinnesota\b/i, 'MN').trim();
      postalCode = zipMatch[2];
    } else if (/minnesota/i.test(statePart)) {
      state = 'MN';
    } else if (/^[A-Z]{2}$/i.test(statePart)) {
      state = statePart.toUpperCase();
    } else {
      state = statePart;
    }
  }

  return { label, line1, city, state, postalCode };
}

export function addressCandidateFromPlace(input: {
  title: string;
  lat: number;
  lng: number;
  id?: string;
  source?: ContactSaveSource;
}): AddressCandidate {
  const parsed = parsePlaceLabel(input.title);
  const key = addressIdentityKey(parsed);
  return {
    kind: 'address',
    key,
    label: parsed.label,
    line1: parsed.line1,
    city: parsed.city,
    state: parsed.state,
    postalCode: parsed.postalCode,
    lat: input.lat,
    lng: input.lng,
    subtitle: [parsed.city, parsed.state, parsed.postalCode].filter(Boolean).join(', ') || undefined,
    raw: {
      mapbox_id: input.id,
      place_name: input.title,
      lat: input.lat,
      lng: input.lng,
      source: input.source ?? 'search',
    },
  };
}

export function addressCandidateFromPoint(input: {
  label: string;
  lat: number;
  lng: number;
  source: ContactSaveSource;
}): AddressCandidate {
  return addressCandidateFromPlace({
    title: input.label,
    lat: input.lat,
    lng: input.lng,
    source: input.source,
  });
}
