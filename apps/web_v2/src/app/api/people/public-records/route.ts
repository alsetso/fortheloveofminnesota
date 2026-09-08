import { NextRequest, NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { extractPublicRecords } from '@/lib/people/normalize';
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
  peopleQueryCacheHash,
} from '@/lib/wallet/toolLookupCache';

const RAPIDAPI_HOST = 'skip-tracing-working-api.p.rapidapi.com';

type LookupBody =
  | { type: 'name'; name: string }
  | { type: 'email'; email: string }
  | { type: 'phone'; phone: string };

type Body = LookupBody & {
  contactPersonId?: string;
  contactAddressId?: string;
  parentEnrichmentId?: string;
};

function buildRapidApiUrl(data: LookupBody): string {
  const base = `https://${RAPIDAPI_HOST}`;
  switch (data.type) {
    case 'name':
      return `${base}/search/byname?name=${encodeURIComponent(data.name)}&page=1`;
    case 'email':
      return `${base}/search/byemail?email=${encodeURIComponent(data.email)}&phone=1`;
    case 'phone':
      return `${base}/search/byphone?phoneno=${encodeURIComponent(data.phone)}&page=1`;
  }
}

function queryValue(data: LookupBody): string {
  switch (data.type) {
    case 'name':
      return data.name;
    case 'email':
      return data.email;
    case 'phone':
      return data.phone;
  }
}

/**
 * POST /api/people/public-records — paid skip-trace (1 credit; cached free).
 * Optional contactPersonId / contactAddressId → durable contacts.enrichments trail.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rawBody = (await request.json()) as Body;
    if (!rawBody?.type || !['name', 'email', 'phone'].includes(rawBody.type)) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

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
        kind: 'public_records',
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

    let data: LookupBody;
    if (rawBody.type === 'name') {
      const name = String(rawBody.name ?? '').trim();
      if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
      data = { type: 'name', name };
    } else if (rawBody.type === 'email') {
      const email = String(rawBody.email ?? '').trim();
      if (!email.includes('@')) {
        return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
      }
      data = { type: 'email', email };
    } else {
      const phone = String(rawBody.phone ?? '').trim();
      if (phone.replace(/\D/g, '').length < 4) {
        return NextResponse.json({ error: 'Invalid phone' }, { status: 400 });
      }
      data = { type: 'phone', phone };
    }

    let apiKey: string;
    try {
      apiKey = getRapidApiKey();
    } catch {
      return NextResponse.json({ error: 'RapidAPI key not configured' }, { status: 500 });
    }

    const toolsDb = getToolsServiceDb();
    const value = queryValue(data);
    const queryHash = peopleQueryCacheHash(data.type, value);

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
        kind: 'public_records',
        label: value,
        toolLookupKind: 'people',
        toolLookupId: opts.lookupId,
        walletTransactionId: opts.walletTransactionId ?? null,
        creditsCharged: opts.creditsCharged,
        parentEnrichmentId,
        summary: buildEnrichmentSummary({
          kind: 'public_records',
          result: opts.result,
          count:
            typeof opts.result.count === 'number' ? (opts.result.count as number) : null,
        }),
        payload: {
          type: data.type,
          query: value,
          result: opts.result,
        },
      });

    const { data: cached } = await toolsDb
      .from('people_lookups')
      .select('result')
      .eq('query_hash', queryHash)
      .eq('kind', 'public_records')
      .gt('expires_at', new Date().toISOString())
      .not('result', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached?.result) {
      const normalized = cached.result as Record<string, unknown>;
      const { data: cachedInsert } = await toolsDb
        .from('people_lookups')
        .insert({
          account_id: session.accountId,
          kind: 'public_records',
          query_hash: queryHash,
          query: { type: data.type, [data.type]: value },
          result: normalized,
          credits_charged: 0,
          expires_at: expiryIso(PEOPLE_CACHE_DAYS),
        })
        .select('id')
        .single();
      const enrichmentId = await maybeTrail({
        lookupId: cachedInsert?.id ?? null,
        result: normalized,
        creditsCharged: 0,
      });
      return NextResponse.json({
        ...normalized,
        cached: true,
        creditsCharged: 0,
        lookupId: cachedInsert?.id ?? null,
        enrichmentId,
      });
    }

    const charge = await chargeToolCredits({
      accountId: session.accountId,
      product: 'find-people',
      action: 'public_records',
      cost: TOOL_CREDIT_COSTS.peoplePublicRecords,
      description: TOOL_LEDGER_LABELS.peoplePublicRecords,
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
          action: 'public_records',
          description: `${TOOL_LEDGER_LABELS.peoplePublicRecords}${TOOL_LEDGER_LABELS.refundSuffix}`,
        });
      }
    };

    let response: Response;
    try {
      response = await fetch(buildRapidApiUrl(data), {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': RAPIDAPI_HOST,
        },
      });
    } catch (e) {
      await refundIfCharged();
      throw e;
    }

    if (!response.ok) {
      await refundIfCharged();
      return NextResponse.json(
        { error: 'Public records lookup failed', status: response.status },
        { status: response.status >= 500 ? 502 : response.status },
      );
    }

    const raw = (await response.json()) as Record<string, unknown>;
    const normalized = extractPublicRecords(raw);

    const { data: inserted, error: insertError } = await toolsDb
      .from('people_lookups')
      .insert({
        account_id: session.accountId,
        kind: 'public_records',
        query_hash: queryHash,
        query: { type: data.type, [data.type]: value },
        result: normalized,
        credits_charged: charge.charged,
        wallet_transaction_id: charge.transactionId,
        expires_at: expiryIso(PEOPLE_CACHE_DAYS),
      })
      .select('id')
      .single();
    if (insertError) throw new Error(insertError.message);
    if (charge.transactionId && inserted?.id) {
      await linkSpendToLookup({
        spendTransactionId: charge.transactionId,
        lookupId: inserted.id as string,
      });
    }

    const enrichmentId = await maybeTrail({
      lookupId: inserted?.id ?? null,
      result: normalized as unknown as Record<string, unknown>,
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
      console.error('POST /api/people/public-records:', e);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
