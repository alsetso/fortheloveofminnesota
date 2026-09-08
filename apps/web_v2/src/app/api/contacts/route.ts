import { NextRequest, NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import {
  addressIdentityKey,
  personIdentityKey,
} from '@/features/contacts/logic/identifyCandidates';
import { getContactsServiceDb } from '@/lib/wallet/walletDb';

type SaveBody = {
  kind: 'person' | 'address';
  /** Confirm step must send confirm: true */
  confirm?: boolean;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  emails?: string[];
  phones?: string[];
  /** FTLOM public.accounts.id when this person is an in-app user. */
  linkedAccountId?: string | null;
  label?: string;
  line1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  lat?: number;
  lng?: number;
  notes?: string;
  /** Optional profile image URL for people. */
  avatarUrl?: string | null;
  /** Optional user label. Empty / omitted → NULL (untagged). */
  tag?: string | null;
  source?: 'tool_lookup' | 'map' | 'find_me' | 'search' | 'manual';
  sourceLookupId?: string | null;
  sourceLookupKind?: 'people' | 'properties' | null;
  raw?: Record<string, unknown> | null;
  linkAddressId?: string | null;
  linkPersonId?: string | null;
};

function normalizeTag(tag: string | null | undefined): string | null {
  const t = (tag ?? '').trim();
  if (!t) return null;
  return t.slice(0, 48);
}

/**
 * GET /api/contacts?kind=people|addresses
 * POST /api/contacts — two-step: omit confirm → preview; confirm:true → upsert
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const kind = request.nextUrl.searchParams.get('kind') ?? 'all';
    const db = getContactsServiceDb();

    if (kind === 'people' || kind === 'all') {
      const { data: people, error } = await db
        .from('people')
        .select(
          'id, display_name, first_name, last_name, emails, phones, notes, tag, avatar_url, source, source_lookup_id, linked_account_id, created_at, updated_at',
        )
        .eq('account_id', session.accountId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);
      if (kind === 'people') {
        return NextResponse.json({ people: people ?? [] });
      }

      const { data: addresses, error: addrErr } = await db
        .from('addresses')
        .select(
          'id, label, line1, city, state, postal_code, lat, lng, notes, tag, source, source_lookup_id, created_at, updated_at',
        )
        .eq('account_id', session.accountId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (addrErr) throw new Error(addrErr.message);
      return NextResponse.json({ people: people ?? [], addresses: addresses ?? [] });
    }

    if (kind === 'addresses') {
      const { data: addresses, error } = await db
        .from('addresses')
        .select(
          'id, label, line1, city, state, postal_code, lat, lng, notes, tag, source, source_lookup_id, created_at, updated_at',
        )
        .eq('account_id', session.accountId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);
      return NextResponse.json({ addresses: addresses ?? [] });
    }

    return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.error('GET /api/contacts:', e);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as SaveBody;
    if (body.kind !== 'person' && body.kind !== 'address') {
      return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });
    }

    if (body.kind === 'person') {
      const displayName = (body.displayName ?? '').trim();
      if (!displayName) {
        return NextResponse.json({ error: 'displayName required' }, { status: 400 });
      }
      const linkedAccountId = body.linkedAccountId?.trim() || null;
      const emails = (body.emails ?? []).map((e) => e.trim().toLowerCase()).filter(Boolean);
      const phones = (body.phones ?? [])
        .map((p) => p.replace(/\D/g, ''))
        .filter((p) => p.length >= 7);
      const tag = normalizeTag(body.tag);
      const identityKey = personIdentityKey({
        linkedAccountId: linkedAccountId ?? undefined,
        emails,
        phones,
        firstName: body.firstName,
        lastName: body.lastName,
        displayName,
      });

      const preview = {
        kind: 'person' as const,
        displayName,
        firstName: body.firstName ?? null,
        lastName: body.lastName ?? null,
        emails,
        phones,
        linkedAccountId,
        tag,
        identityKey,
        source: body.source ?? 'tool_lookup',
        sourceLookupId: body.sourceLookupId ?? null,
        sourceLookupKind: body.sourceLookupKind ?? null,
      };

      if (!body.confirm) {
        return NextResponse.json({ step: 'confirm', preview });
      }

      const db = getContactsServiceDb();
      const row = {
        account_id: session.accountId,
        display_name: displayName,
        first_name: body.firstName ?? null,
        last_name: body.lastName ?? null,
        emails,
        phones,
        linked_account_id: linkedAccountId,
        notes: body.notes ?? null,
        tag,
        avatar_url:
          typeof body.avatarUrl === 'string' && body.avatarUrl.trim()
            ? body.avatarUrl.trim().slice(0, 2048)
            : null,
        source: body.source ?? 'tool_lookup',
        source_lookup_id: body.sourceLookupId ?? null,
        source_lookup_kind: body.sourceLookupKind ?? null,
        identity_key: identityKey,
        raw: body.raw ?? null,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await db
        .from('people')
        .upsert(row, { onConflict: 'account_id,identity_key' })
        .select('id, display_name, emails, phones, linked_account_id, identity_key, created_at')
        .maybeSingle();
      if (error) throw new Error(error.message);

      if (data?.id && body.linkAddressId) {
        await db.from('person_addresses').upsert(
          {
            person_id: data.id,
            address_id: body.linkAddressId,
            relationship: 'associated',
          },
          { onConflict: 'person_id,address_id' },
        );
      }

      return NextResponse.json({ step: 'saved', person: data, created: true });
    }

    // address
    const label = (body.label ?? '').trim();
    if (!label) {
      return NextResponse.json({ error: 'label required' }, { status: 400 });
    }
    const tag = normalizeTag(body.tag);
    const identityKey = addressIdentityKey({
      line1: body.line1,
      city: body.city,
      state: body.state,
      postalCode: body.postalCode,
      label,
    });

    const preview = {
      kind: 'address' as const,
      label,
      line1: body.line1 ?? null,
      city: body.city ?? null,
      state: body.state ?? null,
      postalCode: body.postalCode ?? null,
      lat: body.lat ?? null,
      lng: body.lng ?? null,
      tag,
      identityKey,
      source: body.source ?? 'tool_lookup',
      sourceLookupId: body.sourceLookupId ?? null,
      sourceLookupKind: body.sourceLookupKind ?? null,
    };

    if (!body.confirm) {
      return NextResponse.json({ step: 'confirm', preview });
    }

    const db = getContactsServiceDb();
    const row = {
      account_id: session.accountId,
      label,
      line1: body.line1 ?? null,
      city: body.city ?? null,
      state: body.state ?? null,
      postal_code: body.postalCode ?? null,
      lat: body.lat ?? null,
      lng: body.lng ?? null,
      notes: body.notes ?? null,
      tag,
      source: body.source ?? 'tool_lookup',
      source_lookup_id: body.sourceLookupId ?? null,
      source_lookup_kind: body.sourceLookupKind ?? null,
      identity_key: identityKey,
      raw: body.raw ?? null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await db
      .from('addresses')
      .upsert(row, { onConflict: 'account_id,identity_key' })
      .select('id, label, city, state, identity_key, created_at')
      .maybeSingle();
    if (error) throw new Error(error.message);

    if (data?.id && body.linkPersonId) {
      await db.from('person_addresses').upsert(
        {
          person_id: body.linkPersonId,
          address_id: data.id,
          relationship: 'associated',
        },
        { onConflict: 'person_id,address_id' },
      );
    }

    return NextResponse.json({ step: 'saved', address: data, created: true });
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.error('POST /api/contacts:', e);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
