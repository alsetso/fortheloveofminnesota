/**
 * Person-match list from owner / public-records / person-detail payloads.
 * Shared by enrichment viewer + tool result — browse before Save, deepen via peo_id.
 */

import type { EnrichmentFact } from '@/features/contacts/logic/enrichmentFacts';
import type { PersonCandidate } from '@/features/contacts/logic/identifyCandidates';
import { personIdentityKey } from '@/features/contacts/logic/identifyCandidates';
import { getPeoId } from '@/lib/people/personExpansion';
import { extractPublicRecords } from '@/lib/people/normalize';

export type PersonMatch = {
  key: string;
  peoId: string | null;
  displayName: string;
  subtitle?: string;
  facts: EnrichmentFact[];
  raw: Record<string, unknown>;
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

/** Flatten nested people arrays from owner / public-records shapes. */
export function extractPersonRecords(source: unknown): Record<string, unknown>[] {
  if (!source) return [];
  if (Array.isArray(source)) {
    return source
      .map(asRecord)
      .filter((r): r is Record<string, unknown> => Boolean(r));
  }
  const record = asRecord(source);
  if (!record) return [];

  const { records } = extractPublicRecords(record);
  if (records.length > 0) return records;

  for (const key of [
    'PeopleDetails',
    'personDetails',
    'Records',
    'records',
    'results',
    'owners',
    'Owners',
    'data',
    'people',
  ]) {
    if (Array.isArray(record[key])) {
      return (record[key] as unknown[])
        .map(asRecord)
        .filter((r): r is Record<string, unknown> => Boolean(r));
    }
  }

  if (
    record.Name ||
    record.name ||
    record.FullName ||
    record.first_name ||
    record.FirstName ||
    getPeoId(record)
  ) {
    return [record];
  }
  return [];
}

export function personRecordFacts(record: Record<string, unknown>): EnrichmentFact[] {
  const facts: EnrichmentFact[] = [];
  const peoId = getPeoId(record);
  if (peoId) facts.push({ label: 'Person ID', value: peoId });

  const age = str(record.Age, record.age);
  if (age) facts.push({ label: 'Age', value: age });

  const city = str(record.City, record.city);
  const state = str(record.State, record.state);
  if (city || state) {
    facts.push({ label: 'Location', value: [city, state].filter(Boolean).join(', ') });
  }

  const emails = [
    ...collectStrings(record.Email),
    ...collectStrings(record.email),
    ...collectStrings(record.Emails),
    ...collectStrings(record.emails),
  ];
  for (const email of [...new Set(emails)].slice(0, 3)) {
    facts.push({ label: 'Email', value: email });
  }

  const phones = [
    ...collectStrings(record.Phone),
    ...collectStrings(record.phone),
    ...collectStrings(record.Phones),
    ...collectStrings(record.phones),
    ...collectStrings(record.Mobile),
    ...collectStrings(record.mobile),
  ];
  for (const phone of [...new Set(phones)].slice(0, 3)) {
    facts.push({ label: 'Phone', value: phone });
  }

  const aka = str(record.AKA, record.aka, record.Aliases);
  if (aka) facts.push({ label: 'AKA', value: aka });

  // Remaining primitive fields (skip already shown / huge nests).
  const skip = new Set([
    'peo_id',
    'person ID',
    'Person ID',
    'personId',
    'PersonId',
    'person_id',
    'Name',
    'name',
    'FullName',
    'full_name',
    'FirstName',
    'first_name',
    'firstName',
    'LastName',
    'last_name',
    'lastName',
    'Age',
    'age',
    'City',
    'city',
    'State',
    'state',
    'Email',
    'email',
    'Emails',
    'emails',
    'Phone',
    'phone',
    'Phones',
    'phones',
    'Mobile',
    'mobile',
    'AKA',
    'aka',
    'Aliases',
  ]);
  for (const [key, value] of Object.entries(record)) {
    if (skip.has(key)) continue;
    if (typeof value === 'string' && value.trim() && value.length < 120) {
      facts.push({ label: key, value: value.trim() });
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      facts.push({ label: key, value: String(value) });
    }
    if (facts.length >= 24) break;
  }

  return facts;
}

function toPersonMatch(record: Record<string, unknown>, index: number): PersonMatch | null {
  const firstName = str(record.FirstName, record.first_name, record.firstName);
  const lastName = str(record.LastName, record.last_name, record.lastName);
  const displayName =
    str(record.Name, record.name, record.FullName, record.full_name, record.display_name) ||
    [firstName, lastName].filter(Boolean).join(' ').trim() ||
    null;
  if (!displayName) return null;

  const peoId = getPeoId(record);
  const emails = [
    ...collectStrings(record.Email),
    ...collectStrings(record.email),
    ...collectStrings(record.Emails),
    ...collectStrings(record.emails),
  ];
  const phones = [
    ...collectStrings(record.Phone),
    ...collectStrings(record.phone),
    ...collectStrings(record.Phones),
    ...collectStrings(record.phones),
  ];
  const key =
    peoId != null
      ? `peo:${peoId}`
      : personIdentityKey({
          emails,
          phones,
          firstName: firstName ?? undefined,
          lastName: lastName ?? undefined,
          displayName,
        }) || `row:${index}`;

  const age = str(record.Age, record.age);
  const city = str(record.City, record.city);
  const state = str(record.State, record.state);
  const subtitle =
    [age ? `Age ${age}` : null, [city, state].filter(Boolean).join(', ') || null]
      .filter(Boolean)
      .join(' · ') || undefined;

  return {
    key,
    peoId,
    displayName,
    subtitle,
    facts: personRecordFacts(record),
    raw: record,
  };
}

function dedupeMatches(list: PersonMatch[]): PersonMatch[] {
  const seen = new Set<string>();
  const out: PersonMatch[] = [];
  for (const m of list) {
    if (seen.has(m.key)) continue;
    seen.add(m.key);
    out.push(m);
  }
  return out;
}

/** Owner enrichment: people live under payload.owner. */
export function personMatchesFromOwnerPayload(
  payload: Record<string, unknown>,
): PersonMatch[] {
  const records = extractPersonRecords(payload.owner ?? payload);
  return dedupeMatches(
    records
      .map((r, i) => toPersonMatch(r, i))
      .filter((m): m is PersonMatch => Boolean(m)),
  );
}

/** Public-records enrichment: people live under payload.result. */
export function personMatchesFromPeoplePayload(
  payload: Record<string, unknown>,
): PersonMatch[] {
  const records = extractPersonRecords(payload.result ?? payload);
  return dedupeMatches(
    records
      .map((r, i) => toPersonMatch(r, i))
      .filter((m): m is PersonMatch => Boolean(m)),
  );
}

export function personMatchesFromEnrichment(
  kind: string,
  payload: Record<string, unknown>,
): PersonMatch[] {
  if (kind === 'owner') return personMatchesFromOwnerPayload(payload);
  if (kind === 'public_records') return personMatchesFromPeoplePayload(payload);
  if (kind === 'person_detail') {
    const records = extractPersonRecords(payload.result ?? payload);
    return dedupeMatches(
      records
        .map((r, i) => toPersonMatch(r, i))
        .filter((m): m is PersonMatch => Boolean(m)),
    );
  }
  return [];
}

export function personMatchesFromToolArchive(input: {
  archiveKind: 'people' | 'properties';
  lookupKind?: string | null;
  owner?: unknown;
  result?: unknown;
}): PersonMatch[] {
  if (input.archiveKind === 'properties') {
    return personMatchesFromOwnerPayload({ owner: input.owner });
  }
  return personMatchesFromPeoplePayload({ result: input.result });
}

export function personMatchToCandidate(match: PersonMatch): PersonCandidate {
  const firstName = str(match.raw.FirstName, match.raw.first_name, match.raw.firstName) ?? undefined;
  const lastName = str(match.raw.LastName, match.raw.last_name, match.raw.lastName) ?? undefined;
  const emails = [
    ...collectStrings(match.raw.Email),
    ...collectStrings(match.raw.email),
    ...collectStrings(match.raw.Emails),
    ...collectStrings(match.raw.emails),
  ];
  const phones = [
    ...collectStrings(match.raw.Phone),
    ...collectStrings(match.raw.phone),
    ...collectStrings(match.raw.Phones),
    ...collectStrings(match.raw.phones),
  ];
  return {
    kind: 'person',
    key: match.key.startsWith('peo:')
      ? personIdentityKey({
          emails,
          phones,
          firstName,
          lastName,
          displayName: match.displayName,
        })
      : match.key,
    displayName: match.displayName,
    firstName,
    lastName,
    emails: [...new Set(emails)],
    phones: [...new Set(phones)],
    subtitle: match.subtitle,
    raw: match.raw,
  };
}

export function peoIdFromEnrichmentPayload(
  payload: Record<string, unknown> | null | undefined,
  summary?: Record<string, unknown> | null,
): string | null {
  if (!payload && !summary) return null;
  const fromPayload = payload
    ? str(payload.peo_id, payload.peoId) || getPeoId(asRecord(payload.result) ?? payload)
    : null;
  if (fromPayload) return fromPayload;
  if (summary) {
    return str(summary.peoId, summary.peo_id);
  }
  return null;
}
