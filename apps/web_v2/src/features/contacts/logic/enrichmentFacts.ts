/**
 * Distill enrichment payloads into displayable fact rows for contact detail / tool result.
 */

export type EnrichmentFact = {
  label: string;
  value: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function str(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  return null;
}

function money(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Best property photo from a Zillow / Private Zillow payload.
 * Prefers medium → hi-res → desktop → originalPhotos → thumb.
 */
export function propertyImageFromPayload(
  payload: Record<string, unknown>,
): string | null {
  const property = asRecord(payload.property) ?? asRecord(payload);
  if (!property) return null;

  const direct = str(
    property.mediumImageLink,
    property.hiResImageLink,
    property.desktopWebHdpImageLink,
  );
  if (direct) return direct;

  const originals = property.originalPhotos;
  if (Array.isArray(originals)) {
    for (const item of originals) {
      const rec = asRecord(item);
      const mixed = rec?.mixedSources;
      const jpeg = asRecord(mixed)?.jpeg;
      if (Array.isArray(jpeg) && jpeg.length > 0) {
        const best = [...jpeg]
          .map(asRecord)
          .filter(Boolean)
          .sort(
            (a, b) =>
              (typeof b!.width === 'number' ? b!.width : 0) -
              (typeof a!.width === 'number' ? a!.width : 0),
          )[0];
        const url = str(best?.url);
        if (url) return url;
      }
      const url = str(rec?.url, item);
      if (url) return url;
    }
  }

  const thumbs = property.thumb;
  if (Array.isArray(thumbs)) {
    for (const item of thumbs) {
      const url = str(asRecord(item)?.url, item);
      if (url) return url;
    }
  }

  return str(property.imgSrc, property.image, property.thumbnail, property.photo);
}

export function propertyFactsFromPayload(payload: Record<string, unknown>): EnrichmentFact[] {
  const property = asRecord(payload.property) ?? asRecord(payload);
  if (!property) return [];

  const facts: EnrichmentFact[] = [];
  const resolved =
    str(payload.address) ||
    str(property.streetAddress, property.address, property.PropertyAddress);
  const queried = str(payload.queryAddress);
  if (resolved) facts.push({ label: 'Resolved', value: resolved });
  if (queried && queried !== resolved) facts.push({ label: 'Queried', value: queried });

  const price = money(property.price) || money(property.zestimate);
  if (price) facts.push({ label: 'Value', value: price });

  const beds = str(property.bedrooms, property.beds);
  const baths = str(property.bathrooms, property.baths);
  if (beds) facts.push({ label: 'Beds', value: beds });
  if (baths) facts.push({ label: 'Baths', value: baths });

  const area = str(property.livingArea, property.livingAreaValue, property.area);
  if (area) facts.push({ label: 'Sq ft', value: area });

  const year = str(property.yearBuilt);
  if (year) facts.push({ label: 'Built', value: year });

  const zpid = str(property.zpid);
  if (zpid) facts.push({ label: 'ZPID', value: zpid });

  const homeType = str(property.homeType, property.propertyType, property.homeStatus);
  if (homeType) facts.push({ label: 'Type', value: homeType });

  return facts;
}

export function peopleFactsFromPayload(payload: Record<string, unknown>): EnrichmentFact[] {
  const result = asRecord(payload.result) ?? payload;
  const facts: EnrichmentFact[] = [];

  const count =
    typeof result.count === 'number'
      ? result.count
      : Array.isArray(result.records)
        ? result.records.length
        : Array.isArray(result.PeopleDetails)
          ? result.PeopleDetails.length
          : null;
  if (typeof count === 'number') {
    facts.push({
      label: 'Matches',
      value: `${count} record${count === 1 ? '' : 's'}`,
    });
  }

  const peoId = str(payload.peo_id, result.peo_id, result.peoId, result.personId);
  if (peoId) facts.push({ label: 'Person ID', value: peoId });

  const name = str(payload.name, result.name, result.Name, result.fullName);
  if (name) facts.push({ label: 'Name', value: name });

  const age = str(result.age, result.Age);
  if (age) facts.push({ label: 'Age', value: age });

  const city = str(result.city, result.City);
  const state = str(result.state, result.State);
  if (city || state) {
    facts.push({ label: 'Location', value: [city, state].filter(Boolean).join(', ') });
  }

  return facts;
}

export function enrichmentFacts(
  kind: string,
  payload: Record<string, unknown>,
): EnrichmentFact[] {
  if (kind === 'property' || kind === 'owner') {
    const facts = propertyFactsFromPayload(payload);
    if (kind === 'owner') {
      const owner = payload.owner;
      const ownerArr = Array.isArray(owner)
        ? owner
        : asRecord(owner)?.PeopleDetails ?? asRecord(owner)?.records;
      if (Array.isArray(ownerArr)) {
        facts.push({
          label: 'Owners',
          value: `${ownerArr.length} match${ownerArr.length === 1 ? '' : 'es'}`,
        });
      }
    }
    return facts;
  }
  return peopleFactsFromPayload(payload);
}

export function enrichmentKindLabel(kind: string): string {
  switch (kind) {
    case 'property':
      return 'Property';
    case 'owner':
      return 'Owners';
    case 'public_records':
      return 'Public records';
    case 'person_detail':
      return 'Person detail';
    case 'account':
      return 'Account match';
    default:
      return 'Enrichment';
  }
}
