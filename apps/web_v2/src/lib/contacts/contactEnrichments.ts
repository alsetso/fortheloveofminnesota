/**
 * Durable contact enrichment trail — survives tools.* TTL purge.
 * Written when a paid (or cached) enrich runs against a saved person/address.
 */
import { addressIdentityKey } from '@/features/contacts/logic/identifyCandidates';
import { getContactsServiceDb } from '@/lib/wallet/walletDb';

export type ContactEnrichmentKind =
  | 'property'
  | 'owner'
  | 'public_records'
  | 'person_detail'
  | 'account';

export type ToolLookupKind = 'people' | 'properties';

export type InsertContactEnrichmentInput = {
  accountId: string;
  personId?: string | null;
  addressId?: string | null;
  kind: ContactEnrichmentKind;
  label: string;
  toolLookupKind?: ToolLookupKind | null;
  toolLookupId?: string | null;
  walletTransactionId?: string | null;
  creditsCharged: number;
  parentEnrichmentId?: string | null;
  summary?: Record<string, unknown> | null;
  payload: Record<string, unknown>;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseOptionalUuid(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return UUID_RE.test(trimmed) ? trimmed : null;
}

/**
 * Insert a trail row when enriching a saved contact.
 * Returns null when no subject was provided (compose/tool path).
 */
export async function insertContactEnrichment(
  input: InsertContactEnrichmentInput,
): Promise<string | null> {
  const personId = input.personId?.trim() || null;
  const addressId = input.addressId?.trim() || null;
  if (!personId && !addressId) return null;
  if (personId && addressId) {
    throw new Error('Enrichment subject must be person XOR address');
  }

  const db = getContactsServiceDb();

  // Ownership check — never attach trail to another account's contact.
  if (personId) {
    const { data: person } = await db
      .from('people')
      .select('id')
      .eq('id', personId)
      .eq('account_id', input.accountId)
      .maybeSingle();
    if (!person) throw new Error('Contact person not found');
  } else if (addressId) {
    const { data: address } = await db
      .from('addresses')
      .select('id')
      .eq('id', addressId)
      .eq('account_id', input.accountId)
      .maybeSingle();
    if (!address) throw new Error('Contact address not found');
  }

  let parentEnrichmentId = input.parentEnrichmentId?.trim() || null;
  if (parentEnrichmentId) {
    const { data: parent } = await db
      .from('enrichments')
      .select('id')
      .eq('id', parentEnrichmentId)
      .eq('account_id', input.accountId)
      .maybeSingle();
    if (!parent) parentEnrichmentId = null;
  }

  const { data, error } = await db
    .from('enrichments')
    .insert({
      account_id: input.accountId,
      person_id: personId,
      address_id: addressId,
      kind: input.kind,
      label: input.label.trim() || input.kind,
      tool_lookup_kind: input.toolLookupKind ?? null,
      tool_lookup_id: input.toolLookupId ?? null,
      wallet_transaction_id: input.walletTransactionId ?? null,
      credits_charged: input.creditsCharged,
      parent_enrichment_id: parentEnrichmentId,
      summary: input.summary ?? null,
      payload: input.payload,
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  return (data?.id as string | undefined) ?? null;
}

function strField(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  return null;
}

/**
 * Apply Zillow's resolved street/city/state/ZIP back onto the originating
 * saved address (e.g. Mapbox "Medina" → Zillow "Hamel") so Identify & save
 * matches the book instead of offering a duplicate.
 */
export async function applyResolvedPropertyToAddress(input: {
  accountId: string;
  addressId: string;
  property: unknown;
  displayAddress: string;
}): Promise<void> {
  const property =
    input.property && typeof input.property === 'object'
      ? (input.property as Record<string, unknown>)
      : null;
  if (!property) return;

  const line1 = strField(property.streetAddress, property.address);
  const city = strField(property.city);
  const state = strField(property.state, property.stateCode);
  const postalCode = strField(property.zipcode, property.zip, property.postalCode);
  const label = input.displayAddress.trim() || null;
  if (!line1 && !city && !state && !postalCode && !label) return;

  const lat =
    typeof property.latitude === 'number'
      ? property.latitude
      : typeof property.lat === 'number'
        ? property.lat
        : null;
  const lng =
    typeof property.longitude === 'number'
      ? property.longitude
      : typeof property.lng === 'number'
        ? property.lng
        : typeof property.lon === 'number'
          ? property.lon
          : null;

  const identityKey = addressIdentityKey({
    line1: line1 ?? undefined,
    city: city ?? undefined,
    state: state ?? undefined,
    postalCode: postalCode ?? undefined,
    label: label ?? undefined,
  });

  const db = getContactsServiceDb();

  // Skip identity_key update when another row already owns the resolved key.
  const { data: conflict } = await db
    .from('addresses')
    .select('id')
    .eq('account_id', input.accountId)
    .eq('identity_key', identityKey)
    .neq('id', input.addressId)
    .maybeSingle();

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (label) patch.label = label;
  if (line1) patch.line1 = line1;
  if (city) patch.city = city;
  if (state) patch.state = state;
  if (postalCode) patch.postal_code = postalCode;
  if (typeof lat === 'number' && Number.isFinite(lat)) patch.lat = lat;
  if (typeof lng === 'number' && Number.isFinite(lng)) patch.lng = lng;
  if (!conflict) patch.identity_key = identityKey;

  const { error } = await db
    .from('addresses')
    .update(patch)
    .eq('id', input.addressId)
    .eq('account_id', input.accountId);
  if (error && process.env.NODE_ENV === 'development') {
    console.error('applyResolvedPropertyToAddress:', error.message);
  }
}

export type EnrichmentListItem = {
  id: string;
  kind: ContactEnrichmentKind;
  label: string;
  credits_charged: number;
  tool_lookup_kind: ToolLookupKind | null;
  tool_lookup_id: string | null;
  parent_enrichment_id: string | null;
  summary: Record<string, unknown> | null;
  created_at: string;
};

function peoIdFromRow(row: {
  payload?: unknown;
  summary?: unknown;
}): string | null {
  const payload =
    row.payload && typeof row.payload === 'object'
      ? (row.payload as Record<string, unknown>)
      : null;
  const summary =
    row.summary && typeof row.summary === 'object'
      ? (row.summary as Record<string, unknown>)
      : null;
  const fromPayload =
    (typeof payload?.peo_id === 'string' && payload.peo_id.trim()) ||
    (typeof payload?.peoId === 'string' && payload.peoId.trim()) ||
    null;
  if (fromPayload) return fromPayload;
  const fromSummary =
    (typeof summary?.peoId === 'string' && summary.peoId.trim()) ||
    (typeof summary?.peo_id === 'string' && summary.peo_id.trim()) ||
    null;
  return fromSummary;
}

/**
 * Latest enrichment of a given kind for a subject contact.
 * For `person_detail`, pass `peoId` so multiple owners can each be deepened once.
 */
export async function findExistingEnrichment(input: {
  accountId: string;
  personId?: string | null;
  addressId?: string | null;
  kind: ContactEnrichmentKind;
  peoId?: string | null;
}): Promise<{
  id: string;
  label: string;
  tool_lookup_kind: ToolLookupKind | null;
  tool_lookup_id: string | null;
  payload: Record<string, unknown>;
  credits_charged: number;
  summary: Record<string, unknown> | null;
} | null> {
  const personId = input.personId?.trim() || null;
  const addressId = input.addressId?.trim() || null;
  if (!personId && !addressId) return null;

  const peoId = input.peoId?.trim() || null;
  const db = getContactsServiceDb();
  const selectCols =
    'id, label, tool_lookup_kind, tool_lookup_id, payload, credits_charged, summary';

  // person_detail is keyed by peo_id — scan recent rows for that identity.
  if (input.kind === 'person_detail' && peoId) {
    let query = db
      .from('enrichments')
      .select(selectCols)
      .eq('account_id', input.accountId)
      .eq('kind', 'person_detail')
      .order('created_at', { ascending: false })
      .limit(50);
    if (personId) query = query.eq('person_id', personId);
    else query = query.eq('address_id', addressId!);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const match = (data ?? []).find((row) => peoIdFromRow(row) === peoId);
    if (!match) return null;
    return {
      id: match.id as string,
      label: match.label as string,
      tool_lookup_kind: (match.tool_lookup_kind as ToolLookupKind | null) ?? null,
      tool_lookup_id: (match.tool_lookup_id as string | null) ?? null,
      payload: (match.payload as Record<string, unknown>) ?? {},
      credits_charged: (match.credits_charged as number) ?? 0,
      summary: (match.summary as Record<string, unknown> | null) ?? null,
    };
  }

  let query = db
    .from('enrichments')
    .select(selectCols)
    .eq('account_id', input.accountId)
    .eq('kind', input.kind)
    .order('created_at', { ascending: false })
    .limit(1);

  if (personId) query = query.eq('person_id', personId);
  else query = query.eq('address_id', addressId!);

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    id: data.id as string,
    label: data.label as string,
    tool_lookup_kind: (data.tool_lookup_kind as ToolLookupKind | null) ?? null,
    tool_lookup_id: (data.tool_lookup_id as string | null) ?? null,
    payload: (data.payload as Record<string, unknown>) ?? {},
    credits_charged: (data.credits_charged as number) ?? 0,
    summary: (data.summary as Record<string, unknown> | null) ?? null,
  };
}

/** Child person_detail enrichments under a parent enrichment (or same subject). */
export async function listChildPersonDetails(input: {
  accountId: string;
  parentEnrichmentId: string;
  personId?: string | null;
  addressId?: string | null;
}): Promise<
  Array<{
    id: string;
    label: string;
    peoId: string | null;
    summary: Record<string, unknown> | null;
  }>
> {
  const db = getContactsServiceDb();
  const { data: byParent, error: parentError } = await db
    .from('enrichments')
    .select('id, label, payload, summary')
    .eq('account_id', input.accountId)
    .eq('kind', 'person_detail')
    .eq('parent_enrichment_id', input.parentEnrichmentId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (parentError) throw new Error(parentError.message);

  const rows = [...(byParent ?? [])];

  // Also include same-subject person_details (enhance may omit parent on older rows).
  const personId = input.personId?.trim() || null;
  const addressId = input.addressId?.trim() || null;
  if (personId || addressId) {
    let q = db
      .from('enrichments')
      .select('id, label, payload, summary')
      .eq('account_id', input.accountId)
      .eq('kind', 'person_detail')
      .order('created_at', { ascending: false })
      .limit(50);
    if (personId) q = q.eq('person_id', personId);
    else q = q.eq('address_id', addressId!);
    const { data: bySubject, error } = await q;
    if (error) throw new Error(error.message);
    const seen = new Set(rows.map((r) => r.id as string));
    for (const row of bySubject ?? []) {
      if (seen.has(row.id as string)) continue;
      rows.push(row);
      seen.add(row.id as string);
    }
  }

  return rows.map((row) => ({
    id: row.id as string,
    label: row.label as string,
    peoId: peoIdFromRow(row),
    summary: (row.summary as Record<string, unknown> | null) ?? null,
  }));
}

export async function listContactEnrichments(input: {
  accountId: string;
  personId?: string | null;
  addressId?: string | null;
  limit?: number;
}): Promise<EnrichmentListItem[]> {
  const db = getContactsServiceDb();
  let query = db
    .from('enrichments')
    .select(
      'id, kind, label, credits_charged, tool_lookup_kind, tool_lookup_id, parent_enrichment_id, summary, created_at',
    )
    .eq('account_id', input.accountId)
    .order('created_at', { ascending: false })
    .limit(input.limit ?? 50);

  if (input.personId) query = query.eq('person_id', input.personId);
  else if (input.addressId) query = query.eq('address_id', input.addressId);
  else return [];

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as EnrichmentListItem[];
}

/** Distill a small summary for list rows from property / people payloads. */
export function buildEnrichmentSummary(input: {
  kind: ContactEnrichmentKind;
  property?: unknown;
  owner?: unknown;
  result?: unknown;
  peoId?: string | null;
  count?: number | null;
}): Record<string, unknown> {
  const summary: Record<string, unknown> = { kind: input.kind };
  if (input.peoId) summary.peoId = input.peoId;
  if (typeof input.count === 'number') summary.count = input.count;

  const property =
    input.property && typeof input.property === 'object'
      ? (input.property as Record<string, unknown>)
      : null;
  if (property) {
    if (typeof property.price === 'number') summary.price = property.price;
    if (typeof property.zestimate === 'number') summary.zestimate = property.zestimate;
    if (typeof property.bedrooms === 'number') summary.bedrooms = property.bedrooms;
    if (typeof property.bathrooms === 'number') summary.bathrooms = property.bathrooms;
    if (typeof property.livingArea === 'number') summary.livingArea = property.livingArea;
    if (typeof property.zpid === 'number' || typeof property.zpid === 'string') {
      summary.zpid = property.zpid;
    }
    const addr =
      (typeof property.streetAddress === 'string' && property.streetAddress) ||
      (typeof property.address === 'string' && property.address) ||
      null;
    if (addr) summary.resolvedAddress = addr;
    const imageUrl =
      (typeof property.mediumImageLink === 'string' && property.mediumImageLink) ||
      (typeof property.hiResImageLink === 'string' && property.hiResImageLink) ||
      (typeof property.desktopWebHdpImageLink === 'string' &&
        property.desktopWebHdpImageLink) ||
      null;
    if (imageUrl) summary.imageUrl = imageUrl;
  }

  if (input.owner != null) {
    const ownerArr = Array.isArray(input.owner)
      ? input.owner
      : input.owner && typeof input.owner === 'object'
        ? ((input.owner as Record<string, unknown>).PeopleDetails as unknown[]) ??
          ((input.owner as Record<string, unknown>).records as unknown[]) ??
          null
        : null;
    if (Array.isArray(ownerArr)) summary.ownerCount = ownerArr.length;
  }

  if (input.kind === 'person_detail' && input.result && typeof input.result === 'object') {
    // Lazy import avoided — keep counts in summary for contact-detail chips.
    const result = input.result as Record<string, unknown>;
    const counts = summarizePersonDetailResult(result);
    Object.assign(summary, counts);
  }

  return summary;
}

function summarizePersonDetailResult(result: Record<string, unknown>): Record<string, number> {
  const len = (...keys: string[]) => {
    for (const key of keys) {
      const value = result[key];
      if (Array.isArray(value)) return value.length;
    }
    return 0;
  };
  const phones = len('allPhoneDetails', 'all Phone Details', 'All Phone Details', 'phones');
  const emails = len('emailAddresses', 'email Addresses', 'Email Addresses', 'emails');
  const currentAddresses = len(
    'currentAddressDetailsList',
    'current Address Details List',
    'Current Address Details List',
    'currentAddresses',
  );
  const previousAddresses = len(
    'previousAddressDetails',
    'previous Address Details',
    'Previous Address Details',
    'previousAddresses',
  );
  const relatives = len('allRelatives', 'all Relatives', 'All Relatives', 'relatives');
  const associates = len('allAssociates', 'all Associates', 'All Associates', 'associates');
  return {
    phones,
    emails,
    currentAddresses,
    previousAddresses,
    relatives,
    associates,
    total: phones + emails + currentAddresses + previousAddresses + relatives + associates,
  };
}
