/**
 * Parse peo_id deep-pull payloads into display sections.
 * Handles camelCase (ios-2 normalize) and original SkipTrace key variants.
 */

export type PersonDetailLine = {
  key: string;
  title: string;
  subtitle?: string;
  raw: Record<string, unknown>;
};

export type PersonDetailSectionsModel = {
  name: string | null;
  age: string | null;
  born: string | null;
  livesIn: string | null;
  peoId: string | null;
  phones: PersonDetailLine[];
  emails: PersonDetailLine[];
  currentAddresses: PersonDetailLine[];
  previousAddresses: PersonDetailLine[];
  relatives: PersonDetailLine[];
  associates: PersonDetailLine[];
  residents: PersonDetailLine[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function pick(obj: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) return obj[key];
  }
  return undefined;
}

function str(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  return null;
}

function strFrom(obj: Record<string, unknown>, ...keys: string[]): string | null {
  return str(pick(obj, ...keys));
}

function getArray(
  root: Record<string, unknown>,
  ...keys: string[]
): Record<string, unknown>[] {
  for (const key of keys) {
    const value = root[key];
    if (Array.isArray(value)) {
      return value.map(asRecord).filter((r): r is Record<string, unknown> => Boolean(r));
    }
  }
  return [];
}

function getStringArray(root: Record<string, unknown>, ...keys: string[]): string[] {
  for (const key of keys) {
    const value = root[key];
    if (!Array.isArray(value)) continue;
    return value
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        const rec = asRecord(item);
        return rec
          ? strFrom(rec, 'email', 'Email', 'address', 'Address', 'value')
          : null;
      })
      .filter((s): s is string => Boolean(s));
  }
  return [];
}

function formatCityStateZip(city: string | null, state: string | null, zip: string | null): string {
  return [city, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
}

export function formatPersonAddressLabel(addr: Record<string, unknown>): string {
  const street = strFrom(
    addr,
    'streetAddress',
    'street_address',
    'Street',
    'street',
    'address',
    'full',
  );
  const city = strFrom(addr, 'addressLocality', 'address_locality', 'City', 'city');
  const state = strFrom(addr, 'addressRegion', 'address_region', 'State', 'state');
  const zip = strFrom(addr, 'postalCode', 'postal_code', 'Zip', 'zip');
  const county = strFrom(addr, 'county', 'County');
  const timespan = strFrom(
    addr,
    'timespan',
    'Timespan',
    'dateRange',
    'date_range',
    'Date Range',
  );
  return [street, formatCityStateZip(city, state, zip), county, timespan]
    .filter(Boolean)
    .join(' · ');
}

export function formatAddressForLookup(addr: Record<string, unknown>): string {
  const street = strFrom(
    addr,
    'streetAddress',
    'street_address',
    'Street',
    'street',
    'address',
    'full',
  );
  const city = strFrom(addr, 'addressLocality', 'address_locality', 'City', 'city');
  const state = strFrom(addr, 'addressRegion', 'address_region', 'State', 'state');
  const zip = strFrom(addr, 'postalCode', 'postal_code', 'Zip', 'zip');
  return [street, city, state, zip].filter(Boolean).join(', ');
}

export function getPhoneNumber(record: Record<string, unknown>): string | null {
  return strFrom(
    record,
    'phoneNumber',
    'phone_number',
    'Phone',
    'phone',
    'number',
    'Number',
    'Telephone',
    'telephone',
  );
}

function formatPhoneSubtitle(ph: Record<string, unknown>): string | undefined {
  const parts = [
    strFrom(ph, 'phoneType', 'phone_type', 'Type', 'type'),
    strFrom(ph, 'provider', 'Provider'),
    strFrom(ph, 'lastReported', 'last_reported', 'Last Reported'),
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : undefined;
}

function personName(record: Record<string, unknown>): string | null {
  return (
    strFrom(
      record,
      'Person_name',
      'personName',
      'Name',
      'name',
      'FullName',
      'full_name',
      'display_name',
    ) ||
    [
      strFrom(record, 'FirstName', 'firstName', 'first_name'),
      strFrom(record, 'LastName', 'lastName', 'last_name'),
    ]
      .filter(Boolean)
      .join(' ')
      .trim() ||
    null
  );
}

function personSubtitle(record: Record<string, unknown>): string | undefined {
  const parts = [
    strFrom(record, 'Age', 'age') ? `Age ${strFrom(record, 'Age', 'age')}` : null,
    strFrom(record, 'Lives in', 'livesIn', 'lives_in', 'lives in'),
    strFrom(record, 'Telephone', 'telephone'),
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : undefined;
}

/** Root object that holds section arrays (payload.result or the payload itself). */
export function personDetailRoot(
  payload: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!payload) return {};
  const result = asRecord(payload.result);
  if (result) return result;
  return payload;
}

export function parsePersonDetailSections(
  payload: Record<string, unknown> | null | undefined,
): PersonDetailSectionsModel {
  const root = personDetailRoot(payload);
  const peoId =
    str(payload?.peo_id, payload?.peoId, root.peo_id, root.peoId) || null;

  const personDetails = getArray(
    root,
    'personDetails',
    'person Details',
    'Person Details',
    'person_details',
  );
  const header = personDetails[0] ?? null;

  const name =
    (header ? personName(header) : null) ||
    str(payload?.name, root.name, root.Name) ||
    null;
  const age = header
    ? strFrom(header, 'Age', 'age')
    : strFrom(root, 'Age', 'age');
  const born = header ? strFrom(header, 'Born', 'born') : null;
  const livesIn = header
    ? strFrom(header, 'Lives in', 'livesIn', 'lives_in', 'lives in')
    : strFrom(root, 'Lives in', 'livesIn', 'lives_in', 'lives in');

  const phones = getArray(
    root,
    'allPhoneDetails',
    'all Phone Details',
    'All Phone Details',
    'phones',
  ).flatMap((ph, i) => {
    const number = getPhoneNumber(ph);
    if (!number) return [];
    return [
      {
        key: `phone:${number}:${i}`,
        title: number,
        subtitle: formatPhoneSubtitle(ph),
        raw: ph,
      } satisfies PersonDetailLine,
    ];
  });

  const emails = getStringArray(
    root,
    'emailAddresses',
    'email Addresses',
    'Email Addresses',
    'emails',
  ).map((email, i) => ({
    key: `email:${email}:${i}`,
    title: email,
    raw: { email },
  }));

  const currentAddresses: PersonDetailLine[] = getArray(
    root,
    'currentAddressDetailsList',
    'current Address Details List',
    'Current Address Details List',
    'currentAddresses',
  ).flatMap((addr, i) => {
    const title = formatPersonAddressLabel(addr);
    if (!title) return [];
    return [
      {
        key: `current:${title}:${i}`,
        title,
        subtitle: strFrom(addr, 'dateRange', 'date_range', 'county', 'County') ?? undefined,
        raw: addr,
      },
    ];
  });

  // Sometimes top-level address summary is present without list.
  if (currentAddresses.length === 0) {
    const address = asRecord(root.address);
    if (address) {
      const title =
        strFrom(address, 'full', 'address', 'streetAddress') ||
        formatPersonAddressLabel(address);
      if (title) {
        currentAddresses.push({
          key: `current:summary`,
          title,
          subtitle:
            formatCityStateZip(
              strFrom(address, 'city', 'addressLocality'),
              strFrom(address, 'state', 'addressRegion'),
              strFrom(address, 'postal_code', 'postalCode'),
            ) || undefined,
          raw: address,
        });
      }
    }
  }

  const previousAddresses: PersonDetailLine[] = getArray(
    root,
    'previousAddressDetails',
    'previous Address Details',
    'Previous Address Details',
    'previousAddresses',
  ).flatMap((addr, i) => {
    const title = formatPersonAddressLabel(addr);
    if (!title) return [];
    return [
      {
        key: `prev:${title}:${i}`,
        title,
        subtitle: strFrom(addr, 'timespan', 'Timespan', 'dateRange', 'date_range') ?? undefined,
        raw: addr,
      },
    ];
  });

  const relatives: PersonDetailLine[] = getArray(
    root,
    'allRelatives',
    'all Relatives',
    'All Relatives',
    'relatives',
  ).flatMap((p, i) => {
    const title = personName(p);
    if (!title) return [];
    return [
      {
        key: `relative:${title}:${i}`,
        title,
        subtitle: personSubtitle(p),
        raw: p,
      },
    ];
  });

  const associates: PersonDetailLine[] = getArray(
    root,
    'allAssociates',
    'all Associates',
    'All Associates',
    'associates',
  ).flatMap((p, i) => {
    const title = personName(p);
    if (!title) return [];
    return [
      {
        key: `associate:${title}:${i}`,
        title,
        subtitle: personSubtitle(p),
        raw: p,
      },
    ];
  });

  const residents: PersonDetailLine[] = personDetails.flatMap((p, i) => {
    const title = personName(p);
    if (!title) return [];
    return [
      {
        key: `resident:${title}:${i}`,
        title,
        subtitle: personSubtitle(p),
        raw: p,
      },
    ];
  });

  return {
    name,
    age,
    born,
    livesIn,
    peoId,
    phones,
    emails,
    currentAddresses,
    previousAddresses,
    relatives,
    associates,
    residents,
  };
}

export function personDetailHasSections(model: PersonDetailSectionsModel): boolean {
  return Boolean(
    model.name ||
      model.phones.length ||
      model.emails.length ||
      model.currentAddresses.length ||
      model.previousAddresses.length ||
      model.relatives.length ||
      model.associates.length ||
      model.residents.length,
  );
}

/** Compact counts for contact-detail summary chips (before opening full detail). */
export function personDetailRecordCounts(
  payload: Record<string, unknown> | null | undefined,
): {
  phones: number;
  emails: number;
  currentAddresses: number;
  previousAddresses: number;
  relatives: number;
  associates: number;
  total: number;
} {
  const model = parsePersonDetailSections(payload);
  const phones = model.phones.length;
  const emails = model.emails.length;
  const currentAddresses = model.currentAddresses.length;
  const previousAddresses = model.previousAddresses.length;
  const relatives = model.relatives.length;
  const associates = model.associates.length;
  return {
    phones,
    emails,
    currentAddresses,
    previousAddresses,
    relatives,
    associates,
    total:
      phones +
      emails +
      currentAddresses +
      previousAddresses +
      relatives +
      associates,
  };
}
