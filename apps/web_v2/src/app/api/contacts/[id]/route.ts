import { NextRequest, NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import {
  listContactEnrichments,
  type EnrichmentListItem,
} from '@/lib/contacts/contactEnrichments';
import { personDetailRecordCounts, parsePersonDetailSections } from '@/features/contacts/logic/parsePersonDetail';
import { getContactsServiceDb } from '@/lib/wallet/walletDb';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PERSON_SELECT =
  'id, display_name, first_name, last_name, emails, phones, notes, tag, avatar_url, nickname, description, work, source, source_lookup_id, source_lookup_kind, linked_account_id, identity_key, raw, created_at, updated_at';

function needsPersonDetailCounts(summary: Record<string, unknown> | null): boolean {
  if (!summary) return true;
  return typeof summary.total !== 'number' && typeof summary.phones !== 'number';
}

function normalizeStringList(value: unknown, limit = 12): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed.slice(0, 160));
    if (out.length >= limit) break;
  }
  return out;
}

function optionalText(value: unknown, max = 500): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

async function hydratePersonDetailSummaries(
  accountId: string,
  enrichments: EnrichmentListItem[],
): Promise<
  Array<
    EnrichmentListItem & {
      suggestions?: { phones: string[]; emails: string[] };
    }
  >
> {
  const needs = enrichments.filter((e) => e.kind === 'person_detail');
  if (needs.length === 0) return enrichments;

  const db = getContactsServiceDb();
  const ids = needs.map((e) => e.id);
  const { data, error } = await db
    .from('enrichments')
    .select('id, payload')
    .eq('account_id', accountId)
    .in('id', ids);
  if (error) throw new Error(error.message);

  const byId = new Map(
    (data ?? []).map((row) => [row.id as string, (row.payload as Record<string, unknown>) ?? {}]),
  );

  return enrichments.map((e) => {
    if (e.kind !== 'person_detail') return e;
    const payload = byId.get(e.id);
    if (!payload) return e;
    const sections = parsePersonDetailSections(payload);
    const counts = personDetailRecordCounts(payload);
    const summary = needsPersonDetailCounts(e.summary)
      ? {
          ...(e.summary ?? {}),
          ...counts,
          peoId:
            (typeof e.summary?.peoId === 'string' && e.summary.peoId) ||
            (typeof payload.peo_id === 'string' && payload.peo_id) ||
            null,
        }
      : e.summary;
    return {
      ...e,
      summary,
      suggestions: {
        phones: sections.phones.map((p) => p.title),
        emails: sections.emails.map((em) => em.title),
      },
    };
  });
}

/**
 * GET /api/contacts/[id]?kind=person|address
 * Full saved contact row (incl. raw) + enrichment trail for the contact-detail dock pane.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const kind = request.nextUrl.searchParams.get('kind');
    if (kind !== 'person' && kind !== 'address') {
      return NextResponse.json({ error: 'kind must be person or address' }, { status: 400 });
    }

    const db = getContactsServiceDb();

    if (kind === 'person') {
      const { data, error } = await db
        .from('people')
        .select(PERSON_SELECT)
        .eq('id', id)
        .eq('account_id', session.accountId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      const enrichments = await hydratePersonDetailSummaries(
        session.accountId,
        await listContactEnrichments({
          accountId: session.accountId,
          personId: id,
        }),
      );

      const { data: links } = await db
        .from('person_addresses')
        .select(
          'relationship, address:addresses(id, label, line1, city, state, postal_code, tag)',
        )
        .eq('person_id', id);

      const linkedAddresses = (links ?? []).flatMap((row) => {
        const raw = row.address as unknown;
        const address = (Array.isArray(raw) ? raw[0] : raw) as
          | {
              id: string;
              label: string;
              line1: string | null;
              city: string | null;
              state: string | null;
              postal_code: string | null;
              tag: string | null;
            }
          | null
          | undefined;
        if (!address?.id) return [];
        return [
          {
            id: address.id,
            label: address.label,
            line1: address.line1,
            city: address.city,
            state: address.state,
            postalCode: address.postal_code,
            tag: address.tag,
            relationship: (row.relationship as string) || 'associated',
          },
        ];
      });

      return NextResponse.json({
        kind: 'person',
        person: data,
        enrichments,
        linkedAddresses,
      });
    }

    const { data, error } = await db
      .from('addresses')
      .select(
        'id, label, line1, city, state, postal_code, lat, lng, notes, tag, source, source_lookup_id, source_lookup_kind, identity_key, raw, created_at, updated_at',
      )
      .eq('id', id)
      .eq('account_id', session.accountId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const enrichments = await hydratePersonDetailSummaries(
      session.accountId,
      await listContactEnrichments({
        accountId: session.accountId,
        addressId: id,
      }),
    );

    const { data: links } = await db
      .from('person_addresses')
      .select('relationship, person:people(id, display_name, tag, avatar_url)')
      .eq('address_id', id);

    const linkedPeople = (links ?? []).flatMap((row) => {
      const raw = row.person as unknown;
      const person = (Array.isArray(raw) ? raw[0] : raw) as
        | {
            id: string;
            display_name: string;
            tag: string | null;
            avatar_url: string | null;
          }
        | null
        | undefined;
      if (!person?.id) return [];
      return [
        {
          id: person.id,
          displayName: person.display_name,
          tag: person.tag,
          avatarUrl: person.avatar_url,
          relationship: (row.relationship as string) || 'associated',
        },
      ];
    });

    return NextResponse.json({
      kind: 'address',
      address: data,
      enrichments,
      linkedPeople,
    });
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.error('GET /api/contacts/[id]:', e);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

type PersonPatchBody = {
  avatarUrl?: string | null;
  emails?: string[];
  phones?: string[];
  nickname?: string | null;
  description?: string | null;
  work?: string | null;
  notes?: string | null;
  tag?: string | null;
  displayName?: string;
  firstName?: string | null;
  lastName?: string | null;
};

type AddressPatchBody = {
  tag?: string | null;
  notes?: string | null;
  label?: string;
};

const ADDRESS_SELECT =
  'id, label, line1, city, state, postal_code, lat, lng, notes, tag, source, source_lookup_id, source_lookup_kind, identity_key, raw, created_at, updated_at';

/**
 * PATCH /api/contacts/[id]?kind=person|address
 * Person: profile fields. Address: tag / notes / label.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const kind = request.nextUrl.searchParams.get('kind');
    if (kind !== 'person' && kind !== 'address') {
      return NextResponse.json({ error: 'kind must be person or address' }, { status: 400 });
    }

    const db = getContactsServiceDb();

    if (kind === 'address') {
      const body = (await request.json()) as AddressPatchBody;
      const patch: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if ('tag' in body) {
        const tag = optionalText(body.tag, 48);
        if (tag !== undefined) patch.tag = tag;
      }
      if ('notes' in body) {
        const notes = optionalText(body.notes, 2000);
        if (notes !== undefined) patch.notes = notes;
      }
      if (typeof body.label === 'string' && body.label.trim()) {
        patch.label = body.label.trim().slice(0, 200);
      }
      const keys = Object.keys(patch).filter((k) => k !== 'updated_at');
      if (keys.length === 0) {
        return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
      }

      const { data, error } = await db
        .from('addresses')
        .update(patch)
        .eq('id', id)
        .eq('account_id', session.accountId)
        .select(ADDRESS_SELECT)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      return NextResponse.json({ kind: 'address', address: data });
    }

    const body = (await request.json()) as PersonPatchBody;
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if ('avatarUrl' in body) {
      patch.avatar_url =
        typeof body.avatarUrl === 'string' && body.avatarUrl.trim()
          ? body.avatarUrl.trim().slice(0, 2048)
          : null;
    }
    const emails = normalizeStringList(body.emails);
    if (emails) patch.emails = emails;
    const phones = normalizeStringList(body.phones);
    if (phones) patch.phones = phones;

    const nickname = optionalText(body.nickname, 80);
    if (nickname !== undefined) patch.nickname = nickname;
    const description = optionalText(body.description, 2000);
    if (description !== undefined) patch.description = description;
    const work = optionalText(body.work, 200);
    if (work !== undefined) patch.work = work;
    const notes = optionalText(body.notes, 2000);
    if (notes !== undefined) patch.notes = notes;
    const tag = optionalText(body.tag, 48);
    if (tag !== undefined) patch.tag = tag;
    const firstName = optionalText(body.firstName, 80);
    if (firstName !== undefined) patch.first_name = firstName;
    const lastName = optionalText(body.lastName, 80);
    if (lastName !== undefined) patch.last_name = lastName;
    if (typeof body.displayName === 'string' && body.displayName.trim()) {
      patch.display_name = body.displayName.trim().slice(0, 160);
    }

    const keys = Object.keys(patch).filter((k) => k !== 'updated_at');
    if (keys.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data, error } = await db
      .from('people')
      .update(patch)
      .eq('id', id)
      .eq('account_id', session.accountId)
      .select(PERSON_SELECT)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ kind: 'person', person: data });
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.error('PATCH /api/contacts/[id]:', e);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/contacts/[id]?kind=person|address
 * Remove a saved contact row scoped to the session account.
 * Address links/enrichments cascade at the DB level.
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const kind = request.nextUrl.searchParams.get('kind');
    if (kind !== 'person' && kind !== 'address') {
      return NextResponse.json({ error: 'kind must be person or address' }, { status: 400 });
    }

    const db = getContactsServiceDb();
    const table = kind === 'person' ? 'people' : 'addresses';
    const { data, error } = await db
      .from(table)
      .delete()
      .eq('id', id)
      .eq('account_id', session.accountId)
      .select('id')
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ ok: true, kind, id: data.id });
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.error('DELETE /api/contacts/[id]:', e);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
