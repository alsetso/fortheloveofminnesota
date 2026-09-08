import { NextRequest, NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { getToolsServiceDb, getWalletServiceDb } from '@/lib/wallet/walletDb';
import { identifyFromToolResult } from '@/features/contacts/logic/identifyCandidates';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PeopleRow = {
  id: string;
  kind: string;
  query: Record<string, unknown> | null;
  result: unknown;
  credits_charged: number;
  created_at: string;
  expires_at: string;
  wallet_transaction_id: string | null;
};

type PropertyRow = {
  id: string;
  address_input: string;
  mode: string | null;
  property: unknown;
  owner: unknown;
  credits_charged: number;
  created_at: string;
  expires_at: string;
  wallet_transaction_id: string | null;
};

function peopleQueryLabel(query: Record<string, unknown> | null): string {
  if (!query) return 'People lookup';
  const value = query.name ?? query.email ?? query.phone ?? query.value;
  if (typeof value === 'string' && value.trim()) return value.trim();
  const first = typeof query.firstName === 'string' ? query.firstName.trim() : '';
  const last = typeof query.lastName === 'string' ? query.lastName.trim() : '';
  const name = `${first} ${last}`.trim();
  return name || 'People lookup';
}

function peopleDetail(kind: string, result: unknown): string {
  const kindLabel =
    kind === 'person_detail' ? 'Person detail' : kind === 'account' ? 'Account match' : 'Public records';
  const rec = result && typeof result === 'object' ? (result as { count?: number }) : null;
  const count = typeof rec?.count === 'number' ? rec.count : null;
  return count == null ? kindLabel : `${kindLabel} · ${count} result${count === 1 ? '' : 's'}`;
}

function propertyDetail(mode: string | null): string {
  if (mode === 'skiptrace') return 'Owner / skip trace';
  if (mode === 'zillow') return 'Property details';
  return 'Property lookup';
}

function expired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() <= Date.now();
}

/**
 * GET /api/tools/result?transactionId=<uuid>
 * GET /api/tools/result?kind=people|properties&id=<uuid>
 *
 * Resolves a tool archive row + identified contact candidates for the result sheet.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const transactionId = request.nextUrl.searchParams.get('transactionId');
    const kindParam = request.nextUrl.searchParams.get('kind');
    const idParam = request.nextUrl.searchParams.get('id');

    if (transactionId && !UUID_PATTERN.test(transactionId)) {
      return NextResponse.json({ error: 'Invalid transaction' }, { status: 400 });
    }
    if (idParam && !UUID_PATTERN.test(idParam)) {
      return NextResponse.json({ error: 'Invalid lookup' }, { status: 400 });
    }

    const toolsDb = getToolsServiceDb();
    let archiveKind: 'people' | 'properties' | null = null;
    let peopleRow: PeopleRow | null = null;
    let propertyRow: PropertyRow | null = null;

    if (transactionId) {
      // Prefer explicit wallet.reference_id when linked
      const walletDb = getWalletServiceDb();
      const { data: tx } = await walletDb
        .from('transactions')
        .select('id, reference_type, reference_id, product, action, description, amount, type')
        .eq('id', transactionId)
        .eq('owner_type', 'account')
        .eq('owner_id', session.accountId)
        .eq('purse', 'tool_credits')
        .maybeSingle();

      if (!tx) {
        return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
      }

      if (tx.type !== 'spend') {
        return NextResponse.json({
          available: false,
          reason: 'not_a_spend',
          label: tx.description ?? 'Activity',
        });
      }

      const refId =
        tx.reference_type === 'tool_lookup' && tx.reference_id
          ? (tx.reference_id as string)
          : null;

      if (refId) {
        const [{ data: ppl }, { data: prop }] = await Promise.all([
          toolsDb
            .from('people_lookups')
            .select(
              'id, kind, query, result, credits_charged, created_at, expires_at, wallet_transaction_id',
            )
            .eq('id', refId)
            .eq('account_id', session.accountId)
            .maybeSingle(),
          toolsDb
            .from('property_lookups')
            .select(
              'id, address_input, mode, property, owner, credits_charged, created_at, expires_at, wallet_transaction_id',
            )
            .eq('id', refId)
            .eq('account_id', session.accountId)
            .maybeSingle(),
        ]);
        if (ppl) {
          archiveKind = 'people';
          peopleRow = ppl as PeopleRow;
        } else if (prop) {
          archiveKind = 'properties';
          propertyRow = prop as PropertyRow;
        }
      }

      if (!archiveKind) {
        const [{ data: pplByTx }, { data: propByTx }] = await Promise.all([
          toolsDb
            .from('people_lookups')
            .select(
              'id, kind, query, result, credits_charged, created_at, expires_at, wallet_transaction_id',
            )
            .eq('wallet_transaction_id', transactionId)
            .eq('account_id', session.accountId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          toolsDb
            .from('property_lookups')
            .select(
              'id, address_input, mode, property, owner, credits_charged, created_at, expires_at, wallet_transaction_id',
            )
            .eq('wallet_transaction_id', transactionId)
            .eq('account_id', session.accountId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);
        if (pplByTx) {
          archiveKind = 'people';
          peopleRow = pplByTx as PeopleRow;
        } else if (propByTx) {
          archiveKind = 'properties';
          propertyRow = propByTx as PropertyRow;
        }
      }

      if (!archiveKind) {
        return NextResponse.json({
          available: false,
          reason: 'lookup_missing',
          label: tx.description ?? 'Lookup',
          transactionId,
        });
      }
    } else if (
      (kindParam === 'people' || kindParam === 'properties') &&
      idParam
    ) {
      archiveKind = kindParam;
      if (kindParam === 'people') {
        const { data, error } = await toolsDb
          .from('people_lookups')
          .select(
            'id, kind, query, result, credits_charged, created_at, expires_at, wallet_transaction_id',
          )
          .eq('id', idParam)
          .eq('account_id', session.accountId)
          .maybeSingle();
        if (error) throw new Error(error.message);
        if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        peopleRow = data as PeopleRow;
      } else {
        const { data, error } = await toolsDb
          .from('property_lookups')
          .select(
            'id, address_input, mode, property, owner, credits_charged, created_at, expires_at, wallet_transaction_id',
          )
          .eq('id', idParam)
          .eq('account_id', session.accountId)
          .maybeSingle();
        if (error) throw new Error(error.message);
        if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        propertyRow = data as PropertyRow;
      }
    } else {
      return NextResponse.json(
        { error: 'Provide transactionId or kind+id' },
        { status: 400 },
      );
    }

    if (archiveKind === 'people' && peopleRow) {
      if (expired(peopleRow.expires_at)) {
        return NextResponse.json({
          available: false,
          reason: 'expired',
          archiveKind,
          lookupId: peopleRow.id,
          label: peopleQueryLabel(peopleRow.query),
        });
      }
      const candidates = identifyFromToolResult({
        archiveKind: 'people',
        result: peopleRow.result,
        query: peopleRow.query,
      });
      return NextResponse.json({
        available: true,
        archiveKind: 'people' as const,
        lookupId: peopleRow.id,
        lookupKind: peopleRow.kind,
        label: peopleQueryLabel(peopleRow.query),
        detail: peopleDetail(peopleRow.kind, peopleRow.result),
        creditsCharged: peopleRow.credits_charged,
        createdAt: peopleRow.created_at,
        expiresAt: peopleRow.expires_at,
        query: peopleRow.query,
        result: peopleRow.result,
        candidates,
      });
    }

    if (archiveKind === 'properties' && propertyRow) {
      if (expired(propertyRow.expires_at)) {
        return NextResponse.json({
          available: false,
          reason: 'expired',
          archiveKind,
          lookupId: propertyRow.id,
          label: propertyRow.address_input,
        });
      }
      const candidates = identifyFromToolResult({
        archiveKind: 'properties',
        property: propertyRow.property,
        owner: propertyRow.owner,
        addressInput: propertyRow.address_input,
      });
      return NextResponse.json({
        available: true,
        archiveKind: 'properties' as const,
        lookupId: propertyRow.id,
        lookupKind: propertyRow.mode,
        label: propertyRow.address_input,
        detail: propertyDetail(propertyRow.mode),
        creditsCharged: propertyRow.credits_charged,
        createdAt: propertyRow.created_at,
        expiresAt: propertyRow.expires_at,
        property: propertyRow.property,
        owner: propertyRow.owner,
        candidates,
      });
    }

    return NextResponse.json({ available: false, reason: 'lookup_missing' });
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.error('GET /api/tools/result:', e);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
