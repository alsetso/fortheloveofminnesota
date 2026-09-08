import { NextRequest, NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { normalizeToCamelCase } from '@/lib/people/normalize';
import { getRapidApiKey } from '@/lib/security/apiKeys';
import { TOOL_CREDIT_COSTS } from '@/features/tools/core/toolCreditCosts';
import {
  buildEnrichmentSummary,
  findExistingEnrichment,
  insertContactEnrichment,
  parseOptionalUuid,
} from '@/lib/contacts/contactEnrichments';
import {
  chargeToolCredits,
  linkSpendToLookup,
  refundToolCredits,
  TOOL_LEDGER_LABELS,
} from '@/lib/wallet/walletLedger';
import { getToolsServiceDb } from '@/lib/wallet/walletDb';
import {
  expiryIso,
  PEOPLE_CACHE_DAYS,
  personDetailCacheHash,
} from '@/lib/wallet/toolLookupCache';

const RAPIDAPI_HOST = 'skip-tracing-working-api.p.rapidapi.com';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Body = {
  peo_id: string;
  name?: string;
  search_id?: string;
  parent_lookup_id?: string;
  contactPersonId?: string;
  contactAddressId?: string;
  parentEnrichmentId?: string;
};

/**
 * POST /api/people/public-records/details
 * Deep person detail by provider peo_id. Cached hits charge 0.
 * Optional contactPersonId → durable contacts.enrichments trail.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rawBody = (await request.json()) as Body;
    const peoId = String(rawBody.peo_id ?? '').trim();
    if (!peoId || peoId.length > 100) {
      return NextResponse.json({ error: 'peo_id required' }, { status: 400 });
    }
    const name = typeof rawBody.name === 'string' ? rawBody.name.trim() : undefined;
    const searchId =
      typeof rawBody.search_id === 'string' && rawBody.search_id.trim()
        ? rawBody.search_id.trim()
        : undefined;
    const parentLookupIdRaw =
      typeof rawBody.parent_lookup_id === 'string' && rawBody.parent_lookup_id.trim()
        ? rawBody.parent_lookup_id.trim()
        : null;
    const contactPersonId = parseOptionalUuid(rawBody.contactPersonId);
    const contactAddressId = parseOptionalUuid(rawBody.contactAddressId);
    const parentEnrichmentId = parseOptionalUuid(rawBody.parentEnrichmentId);
    if (contactPersonId && contactAddressId) {
      return NextResponse.json(
        { error: 'Provide contactPersonId or contactAddressId, not both' },
        { status: 400 },
      );
    }

    if (contactPersonId || contactAddressId) {
      const existing = await findExistingEnrichment({
        accountId: session.accountId,
        personId: contactPersonId,
        addressId: contactAddressId,
        kind: 'person_detail',
        peoId,
      });
      if (existing) {
        const result =
          (existing.payload.result as Record<string, unknown> | undefined) ??
          existing.payload;
        return NextResponse.json({
          ...result,
          cached: true,
          alreadyEnriched: true,
          creditsCharged: 0,
          lookupId: existing.tool_lookup_id,
          enrichmentId: existing.id,
        });
      }
    }

    let apiKey: string;
    try {
      apiKey = getRapidApiKey();
    } catch {
      return NextResponse.json({ error: 'RapidAPI key not configured' }, { status: 500 });
    }

    const toolsDb = getToolsServiceDb();
    const queryHash = personDetailCacheHash(peoId);

    // parent_lookup_id FK → tools.people_lookups only (never property_lookups / owner skiptrace).
    let parentLookupId: string | null = null;
    if (parentLookupIdRaw && UUID_RE.test(parentLookupIdRaw)) {
      const { data: parentRow } = await toolsDb
        .from('people_lookups')
        .select('id')
        .eq('id', parentLookupIdRaw)
        .maybeSingle();
      if (parentRow?.id) parentLookupId = parentRow.id as string;
    }

    const maybeTrail = async (opts: {
      lookupId: string | null;
      result: Record<string, unknown>;
      creditsCharged: number;
      walletTransactionId?: string | null;
    }) =>
      insertContactEnrichment({
        accountId: session.accountId,
        personId: contactPersonId,
        addressId: contactAddressId,
        kind: 'person_detail',
        label: name || peoId,
        toolLookupKind: 'people',
        toolLookupId: opts.lookupId,
        walletTransactionId: opts.walletTransactionId ?? null,
        creditsCharged: opts.creditsCharged,
        parentEnrichmentId,
        summary: buildEnrichmentSummary({
          kind: 'person_detail',
          result: opts.result,
          peoId,
        }),
        payload: {
          peo_id: peoId,
          name: name || undefined,
          result: opts.result,
        },
      });

    const { data: cached } = await toolsDb
      .from('people_lookups')
      .select('result')
      .eq('query_hash', queryHash)
      .eq('kind', 'person_detail')
      .gt('expires_at', new Date().toISOString())
      .not('result', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached?.result) {
      const result = cached.result as Record<string, unknown>;
      const { data: inserted, error: insertError } = await toolsDb
        .from('people_lookups')
        .insert({
          account_id: session.accountId,
          kind: 'person_detail',
          query_hash: queryHash,
          query: { peo_id: peoId, name: name || undefined, search_id: searchId },
          result,
          credits_charged: 0,
          parent_lookup_id: parentLookupId,
          expires_at: expiryIso(PEOPLE_CACHE_DAYS),
        })
        .select('id')
        .single();
      if (insertError) throw new Error(insertError.message);
      const enrichmentId = await maybeTrail({
        lookupId: inserted?.id ?? null,
        result,
        creditsCharged: 0,
      });
      return NextResponse.json({
        ...result,
        cached: true,
        creditsCharged: 0,
        lookupId: inserted?.id ?? null,
        enrichmentId,
      });
    }

    const charge = await chargeToolCredits({
      accountId: session.accountId,
      product: 'find-people',
      action: 'person_detail',
      cost: TOOL_CREDIT_COSTS.peopleDetailPull,
      description: TOOL_LEDGER_LABELS.peoplePersonDetail,
    });
    if (!charge.ok) {
      return NextResponse.json({ error: 'insufficient_credits' }, { status: 402 });
    }

    const refundIfCharged = async () => {
      if (charge.transactionId) {
        await refundToolCredits({
          accountId: session.accountId,
          spendTransactionId: charge.transactionId,
          cost: charge.charged,
          product: 'find-people',
          action: 'person_detail',
          description: `${TOOL_LEDGER_LABELS.peoplePersonDetail}${TOOL_LEDGER_LABELS.refundSuffix}`,
        });
      }
    };

    const url = `https://${RAPIDAPI_HOST}/search/detailsbyID?peo_id=${encodeURIComponent(peoId)}`;
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': RAPIDAPI_HOST,
        },
      });
    } catch (error) {
      await refundIfCharged();
      throw error;
    }

    if (!response.ok) {
      await refundIfCharged();
      if (process.env.NODE_ENV === 'development') {
        console.error('Public records details API error:', response.status, response.statusText);
      }
      return NextResponse.json(
        { error: 'Details lookup failed', status: response.status },
        { status: response.status >= 500 ? 502 : response.status },
      );
    }

    const raw = await response.json();
    const normalized = normalizeToCamelCase(raw) as Record<string, unknown>;

    const { data: inserted, error: insertError } = await toolsDb
      .from('people_lookups')
      .insert({
        account_id: session.accountId,
        kind: 'person_detail',
        query_hash: queryHash,
        query: { peo_id: peoId, name: name || undefined, search_id: searchId },
        result: normalized,
        credits_charged: charge.charged,
        wallet_transaction_id: charge.transactionId,
        parent_lookup_id: parentLookupId,
        expires_at: expiryIso(PEOPLE_CACHE_DAYS),
      })
      .select('id')
      .single();
    if (insertError) {
      await refundIfCharged();
      throw new Error(insertError.message);
    }
    if (charge.transactionId && inserted?.id) {
      await linkSpendToLookup({
        spendTransactionId: charge.transactionId,
        lookupId: inserted.id as string,
      });
    }

    const enrichmentId = await maybeTrail({
      lookupId: inserted?.id ?? null,
      result: normalized,
      creditsCharged: charge.charged,
      walletTransactionId: charge.transactionId,
    });

    return NextResponse.json({
      ...normalized,
      cached: false,
      creditsCharged: charge.charged,
      lookupId: inserted?.id ?? null,
      enrichmentId,
    });
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.error('POST /api/people/public-records/details:', e);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
