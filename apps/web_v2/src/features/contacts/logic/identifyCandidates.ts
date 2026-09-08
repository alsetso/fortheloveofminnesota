/**
 * Identify candidates from tools archive payloads → Person / Address cards.
 * Normalization is best-effort across RapidAPI / Zillow shape variance.
 */

export type ContactCandidateKind = 'person' | 'address';

export type PersonCandidate = {
  kind: 'person';
  key: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  emails: string[];
  phones: string[];
  /** FTLOM public.accounts.id when this row is an in-app account match. */
  linkedAccountId?: string;
  subtitle?: string;
  raw: Record<string, unknown>;
};

export type AddressCandidate = {
  kind: 'address';
  key: string;
  label: string;
  line1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  lat?: number;
  lng?: number;
  subtitle?: string;
  raw: Record<string, unknown>;
};

export type ContactCandidate = PersonCandidate | AddressCandidate;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function str(...values: unknown[]): string | undefined {
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  return undefined;
}

function collectStrings(value: unknown): string[] {
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        const rec = asRecord(item);
        return str(rec?.email, rec?.Email, rec?.phone, rec?.Phone, rec?.number, rec?.Number);
      })
      .filter((s): s is string => Boolean(s));
  }
  return [];
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
  return digits;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function personIdentityKey(input: {
  linkedAccountId?: string;
  emails?: string[];
  phones?: string[];
  firstName?: string;
  lastName?: string;
  displayName?: string;
}): string {
  if (input.linkedAccountId?.trim()) {
    return `account:${input.linkedAccountId.trim()}`;
  }
  const email = (input.emails ?? []).map(normalizeEmail).find(Boolean);
  if (email) return `email:${email}`;
  const phone = (input.phones ?? []).map(normalizePhone).find((p) => p.length >= 7);
  if (phone) return `phone:${phone}`;
  const name = [input.firstName, input.lastName].filter(Boolean).join(' ').trim()
    || input.displayName?.trim()
    || 'unknown';
  return `name:${name.toLowerCase().replace(/\s+/g, ' ')}`;
}

export function addressIdentityKey(input: {
  line1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  label?: string;
}): string {
  const parts = resolveAddressParts(input);
  const { street, city, state } = parts;

  // Core identity: street + city + state (ZIP omitted — often missing on map labels).
  if (street && city && state) return `addr:${street}|${city}|${state}`;
  if (street && city) return `addr:${street}|${city}`;

  const label = stripAlnum(input.label ?? '');
  return `addr:${label || 'unknown'}`;
}

/**
 * All keys that should hit the same contact row — primary city key plus a
 * street|state|ZIP soft key so Medina↔Hamel (same parcel) still matches.
 */
export function addressIdentityKeys(input: {
  line1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  label?: string;
}): string[] {
  const primary = addressIdentityKey(input);
  const { street, state, postalCode } = resolveAddressParts(input);
  const keys = [primary];
  if (street && state && postalCode.length === 5) {
    keys.push(`addr:${street}|*|${state}|${postalCode}`);
  }
  return [...new Set(keys)];
}

function resolveAddressParts(input: {
  line1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  label?: string;
}): { street: string; city: string; state: string; postalCode: string } {
  const fromLabel = parseLabelParts(input.label ?? '');
  const street = normalizeStreetPart(input.line1 || fromLabel.line1 || input.label || '');
  const city = stripAlnum(input.city || fromLabel.city || '');
  const state = normalizeState(input.state || fromLabel.state || '');
  const postalRaw =
    input.postalCode ||
    (input.label?.match(/\b(\d{5})(?:-\d{4})?\b/)?.[1] ?? '');
  const postalCode = String(postalRaw).replace(/\D/g, '').slice(0, 5);
  return { street, city, state, postalCode };
}

function stripAlnum(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/** Collapse common street / direction / ordinal words so "Ave" ≈ "Avenue". */
const STREET_TOKEN_MAP: Record<string, string> = {
  street: 'st',
  streets: 'st',
  st: 'st',
  avenue: 'ave',
  avenues: 'ave',
  ave: 'ave',
  av: 'ave',
  boulevard: 'blvd',
  blvd: 'blvd',
  road: 'rd',
  roads: 'rd',
  rd: 'rd',
  drive: 'dr',
  drives: 'dr',
  dr: 'dr',
  lane: 'ln',
  lanes: 'ln',
  ln: 'ln',
  court: 'ct',
  courts: 'ct',
  ct: 'ct',
  place: 'pl',
  places: 'pl',
  pl: 'pl',
  circle: 'cir',
  cir: 'cir',
  highway: 'hwy',
  hwy: 'hwy',
  north: 'n',
  south: 's',
  east: 'e',
  west: 'w',
  northeast: 'ne',
  northwest: 'nw',
  southeast: 'se',
  southwest: 'sw',
  first: '1',
  second: '2',
  third: '3',
  fourth: '4',
  fifth: '5',
  sixth: '6',
  seventh: '7',
  eighth: '8',
  ninth: '9',
  tenth: '10',
};

function normalizeStreetPart(s: string): string {
  const tokens = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return tokens.map((t) => STREET_TOKEN_MAP[t] ?? t).join('');
}

function normalizeState(s: string): string {
  const t = s.toLowerCase().replace(/[^a-z]/g, '');
  if (t === 'minnesota' || t === 'mn') return 'mn';
  return t;
}

function parseLabelParts(label: string): {
  line1?: string;
  city?: string;
  state?: string;
} {
  const parts = label.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return { line1: label.trim() || undefined };
  const line1 = parts[0];
  const city = parts[1];
  let state: string | undefined;
  if (parts.length >= 3) {
    const statePart = parts[2];
    const zipMatch = statePart.match(/^([A-Za-z. ]+?)\s+(\d{5}(?:-\d{4})?)$/);
    if (zipMatch) state = zipMatch[1];
    else state = statePart;
  }
  return { line1, city, state };
}

function resultArrays(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.map(asRecord).filter((r): r is Record<string, unknown> => Boolean(r));
  }
  const record = asRecord(value);
  if (!record) return [];
  for (const key of [
    'PeopleDetails',
    'personDetails',
    'Records',
    'records',
    'results',
    'owners',
    'Owners',
    'data',
    'accounts',
  ]) {
    if (Array.isArray(record[key])) {
      return (record[key] as unknown[])
        .map(asRecord)
        .filter((r): r is Record<string, unknown> => Boolean(r));
    }
  }
  // Single person detail object
  if (record.Name || record.name || record.FullName || record.first_name || record.FirstName) {
    return [record];
  }
  return [];
}

function isUuid(value: string | undefined): value is string {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      ),
  );
}

/** FTLOM account row from people_lookups kind=account — always link by accounts.id. */
function identifyAccountPerson(record: Record<string, unknown>): PersonCandidate | null {
  const id = str(record.id, record.account_id, record.accountId, record.linked_account_id);
  if (!isUuid(id)) return identifyPerson(record);

  const firstName = str(record.first_name, record.firstName, record.FirstName);
  const lastName = str(record.last_name, record.lastName, record.LastName);
  const username = str(record.username);
  const displayName =
    [firstName, lastName].filter(Boolean).join(' ').trim() ||
    username ||
    'Account';
  const matchType = str(record.match_type, record.matchType);
  const key = personIdentityKey({
    linkedAccountId: id,
    firstName,
    lastName,
    displayName,
  });

  return {
    kind: 'person',
    key,
    displayName,
    firstName,
    lastName,
    emails: [],
    phones: [],
    linkedAccountId: id,
    subtitle:
      (username ? `@${username}` : undefined) ||
      (matchType ? `Match · ${matchType}` : undefined) ||
      'Linked account',
    raw: record,
  };
}

function identifyPerson(record: Record<string, unknown>): PersonCandidate | null {
  const rawId = str(record.id, record.account_id, record.accountId, record.linked_account_id);
  const hasAccountShape = Boolean(
    str(record.username) || record.account_id || record.accountId || record.linked_account_id,
  );
  const uuidLike = hasAccountShape && isUuid(rawId) ? rawId : undefined;

  const firstName = str(record.FirstName, record.first_name, record.firstName);
  const lastName = str(record.LastName, record.last_name, record.lastName);
  const displayName =
    str(record.Name, record.name, record.FullName, record.full_name, record.display_name)
    || [firstName, lastName].filter(Boolean).join(' ').trim()
    || str(record.username)
    || (uuidLike ? 'Account' : undefined);
  if (!displayName) return null;

  const emails = [
    ...collectStrings(record.Email),
    ...collectStrings(record.email),
    ...collectStrings(record.Emails),
    ...collectStrings(record.emails),
  ].map(normalizeEmail);
  const uniqueEmails = [...new Set(emails.filter(Boolean))];

  const phones = [
    ...collectStrings(record.Phone),
    ...collectStrings(record.phone),
    ...collectStrings(record.Phones),
    ...collectStrings(record.phones),
    ...collectStrings(record.Mobile),
    ...collectStrings(record.mobile),
  ];
  const uniquePhones = [...new Set(phones.map(normalizePhone).filter((p) => p.length >= 7))];

  const key = personIdentityKey({
    linkedAccountId: uuidLike,
    emails: uniqueEmails,
    phones: uniquePhones,
    firstName,
    lastName,
    displayName,
  });

  const matchType = str(record.match_type, record.matchType);
  const subtitle =
    (uuidLike ? `@${str(record.username) ?? 'account'}` : undefined)
    || uniqueEmails[0]
    || uniquePhones[0]
    || (matchType ? `Match · ${matchType}` : undefined)
    || str(record.Age, record.age, record.City, record.city);

  return {
    kind: 'person',
    key,
    displayName,
    firstName,
    lastName,
    emails: uniqueEmails,
    phones: uniquePhones,
    linkedAccountId: uuidLike,
    subtitle,
    raw: record,
  };
}

function identifyAddressFromRecord(record: Record<string, unknown>, fallbackLabel?: string): AddressCandidate | null {
  const line1 = str(
    record.streetAddress,
    record.street_address,
    record.address,
    record.Address,
    record.line1,
    record.Line1,
  );
  const city = str(record.city, record.City);
  const state = str(record.state, record.State, record.stateCode);
  const postalCode = str(record.zipcode, record.zip, record.postalCode, record.Zip, record.ZipCode);
  const label =
    str(record.addressLabel, record.formatted, record.full_address)
    || [line1, city, state, postalCode].filter(Boolean).join(', ')
    || fallbackLabel
    || undefined;
  if (!label) return null;

  const lat = typeof record.latitude === 'number'
    ? record.latitude
    : typeof record.lat === 'number'
      ? record.lat
      : undefined;
  const lng = typeof record.longitude === 'number'
    ? record.longitude
    : typeof record.lng === 'number'
      ? record.lng
      : typeof record.lon === 'number'
        ? record.lon
        : undefined;

  const key = addressIdentityKey({ line1, city, state, postalCode, label });
  const subtitle = [city, state, postalCode].filter(Boolean).join(', ') || undefined;

  return {
    kind: 'address',
    key,
    label,
    line1,
    city,
    state,
    postalCode,
    lat,
    lng,
    subtitle,
    raw: record,
  };
}

function dedupeCandidates(list: ContactCandidate[]): ContactCandidate[] {
  const seen = new Set<string>();
  const out: ContactCandidate[] = [];
  for (const c of list) {
    const id = `${c.kind}:${c.key}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(c);
  }
  return out;
}

/** Identify people from a people_lookups.result payload. */
export function identifyPeopleFromLookupResult(result: unknown): PersonCandidate[] {
  const root = asRecord(result);
  // Free account check archives `{ accounts: [...] }` — always link by accounts.id.
  if (root && Array.isArray(root.accounts)) {
    return dedupeCandidates(
      (root.accounts as unknown[])
        .map(asRecord)
        .filter((r): r is Record<string, unknown> => Boolean(r))
        .map(identifyAccountPerson)
        .filter((c): c is PersonCandidate => Boolean(c)),
    ) as PersonCandidate[];
  }

  return dedupeCandidates(
    resultArrays(result)
      .map(identifyPerson)
      .filter((c): c is PersonCandidate => Boolean(c)),
  ) as PersonCandidate[];
}

/** Identify address + owners from a property_lookups row. */
export function identifyFromPropertyLookup(input: {
  addressInput?: string | null;
  property?: unknown;
  owner?: unknown;
}): ContactCandidate[] {
  const candidates: ContactCandidate[] = [];
  const propertyRec = asRecord(input.property);
  const address =
    (propertyRec ? identifyAddressFromRecord(propertyRec, input.addressInput ?? undefined) : null)
    || (input.addressInput
      ? identifyAddressFromRecord({ addressLabel: input.addressInput }, input.addressInput)
      : null);
  if (address) candidates.push(address);

  const ownerPeople = identifyPeopleFromLookupResult(input.owner);
  candidates.push(...ownerPeople);

  // Some property payloads nest owners on the property object
  if (propertyRec) {
    candidates.push(...identifyPeopleFromLookupResult(propertyRec.owners ?? propertyRec.Owners));
  }

  return dedupeCandidates(candidates);
}

export function identifyFromToolResult(input: {
  archiveKind: 'people' | 'properties';
  result?: unknown;
  property?: unknown;
  owner?: unknown;
  addressInput?: string | null;
  query?: unknown;
}): ContactCandidate[] {
  if (input.archiveKind === 'people') {
    return identifyPeopleFromLookupResult(input.result);
  }
  return identifyFromPropertyLookup({
    addressInput: input.addressInput,
    property: input.property,
    owner: input.owner,
  });
}
