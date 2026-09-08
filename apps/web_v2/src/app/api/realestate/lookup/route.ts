import { NextRequest, NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { getRapidApiKey } from '@/lib/security/apiKeys';
import { TOOL_CREDIT_COSTS } from '@/features/tools/core/toolCreditCosts';
import {
  applyResolvedPropertyToAddress,
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
  addressCacheHash,
  expiryIso,
  PROPERTY_CACHE_DAYS,
} from '@/lib/wallet/toolLookupCache';

const SKIP_TRACE_HOST = 'skip-tracing-working-api.p.rapidapi.com';
const ZILLOW_HOST = 'private-zillow.p.rapidapi.com';

function rapidHeaders(host: string, apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-RapidAPI-Key': apiKey,
    'X-RapidAPI-Host': host,
  };
}

function propertyDisplayAddress(property: unknown, fallback: string): string {
  if (!property || typeof property !== 'object') return fallback;
  const record = property as Record<string, unknown>;
  for (const value of [record.PropertyAddress, record.address]) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  const street = typeof record.streetAddress === 'string' ? record.streetAddress.trim() : '';
  const city = typeof record.city === 'string' ? record.city.trim() : '';
  const state = typeof record.state === 'string' ? record.state.trim() : '';
  const zip = typeof record.zipcode === 'string' ? record.zipcode.trim() : '';
  const locality = [city, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const composed = [street, locality].filter(Boolean).join(', ');
  return composed || fallback;
}

function splitAddress(address: string): { street: string; citystatezip: string } {
  const commaIndex = address.indexOf(',');
  if (commaIndex === -1) return { street: address, citystatezip: '' };
  return {
    street: address.slice(0, commaIndex).trim(),
    citystatezip: address.slice(commaIndex + 1).trim(),
  };
}

type LookupOutcome =
  | { ok: true; property: unknown; owner: unknown }
  | { ok: false; error: string; status: number };

async function runSkipTrace(input: {
  address: string;
  street?: string;
  citystatezip?: string;
  apiKey: string;
}): Promise<LookupOutcome> {
  const parts =
    input.street && input.citystatezip
      ? { street: input.street, citystatezip: input.citystatezip }
      : splitAddress(input.address);

  if (!parts.street || !parts.citystatezip) {
    return {
      ok: false,
      status: 400,
      error:
        'Enter a full address including city, state, and ZIP (e.g. "123 Main St, Saint Paul, MN 55101").',
    };
  }

  let res: Response;
  try {
    res = await fetch(
      `https://${SKIP_TRACE_HOST}/search/byaddress?street=${encodeURIComponent(parts.street)}&citystatezip=${encodeURIComponent(parts.citystatezip)}&page=1`,
      { method: 'GET', headers: rapidHeaders(SKIP_TRACE_HOST, input.apiKey) },
    );
  } catch {
    return { ok: false, status: 502, error: 'Skip trace request failed' };
  }

  if (!res.ok) {
    return {
      ok: false,
      status: res.status >= 500 ? 502 : res.status,
      error: 'Skip trace lookup failed',
    };
  }

  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  return {
    ok: true,
    property: body?.PropertyDetails ?? body ?? {},
    owner: body?.PeopleDetails ?? null,
  };
}

async function runZillow(input: { address: string; apiKey: string }): Promise<LookupOutcome> {
  let res: Response;
  try {
    res = await fetch(
      `https://${ZILLOW_HOST}/pro/byaddress?propertyaddress=${encodeURIComponent(input.address)}`,
      { method: 'GET', headers: rapidHeaders(ZILLOW_HOST, input.apiKey) },
    );
  } catch {
    return { ok: false, status: 502, error: 'Property lookup failed' };
  }

  if (!res.ok) {
    if (res.status === 403) {
      return {
        ok: false,
        status: 503,
        error: 'The RapidAPI account is not subscribed to Private Zillow.',
      };
    }
    return {
      ok: false,
      status: res.status >= 500 ? 502 : res.status,
      error: 'Property lookup failed',
    };
  }

  const response = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response) {
    return { ok: false, status: 502, error: 'Property lookup returned no data' };
  }
  const property =
    (response.propertyDetails && typeof response.propertyDetails === 'object'
      ? response.propertyDetails
      : null) ??
    (response.data && typeof response.data === 'object' ? response.data : null) ??
    (response.property && typeof response.property === 'object' ? response.property : null) ??
    response;
  return { ok: true, property, owner: null };
}

/**
 * POST /api/realestate/lookup
 * Body: { address, mode?: 'zillow' | 'skiptrace', contactAddressId?, contactPersonId?, parentEnrichmentId? }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as {
      address?: string;
      mode?: string;
      street?: string;
      citystatezip?: string;
      contactAddressId?: string;
      contactPersonId?: string;
      parentEnrichmentId?: string;
    };
    const address = String(body.address ?? '').trim();
    const mode = body.mode === 'skiptrace' ? 'skiptrace' : 'zillow';
    const contactAddressId = parseOptionalUuid(body.contactAddressId);
    const contactPersonId = parseOptionalUuid(body.contactPersonId);
    const parentEnrichmentId = parseOptionalUuid(body.parentEnrichmentId);
    if (address.length < 3) {
      return NextResponse.json({ error: 'address required' }, { status: 400 });
    }
    if (contactAddressId && contactPersonId) {
      return NextResponse.json(
        { error: 'Provide contactAddressId or contactPersonId, not both' },
        { status: 400 },
      );
    }

    const enrichmentKind = mode === 'skiptrace' ? 'owner' : 'property';
    if (contactAddressId || contactPersonId) {
      const existing = await findExistingEnrichment({
        accountId: session.accountId,
        personId: contactPersonId,
        addressId: contactAddressId,
        kind: enrichmentKind,
      });
      if (existing) {
        if (contactAddressId && mode === 'zillow' && existing.payload.property) {
          await applyResolvedPropertyToAddress({
            accountId: session.accountId,
            addressId: contactAddressId,
            property: existing.payload.property,
            displayAddress:
              (typeof existing.payload.address === 'string' && existing.payload.address) ||
              existing.label,
          });
        }
        return NextResponse.json({
          address: (typeof existing.payload.address === 'string' && existing.payload.address) || existing.label,
          mode,
          property: existing.payload.property ?? null,
          owner: existing.payload.owner ?? null,
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
    const addressHash = addressCacheHash(`${mode}:${address}`);

    const { data: cached } = await toolsDb
      .from('property_lookups')
      .select('property, owner')
      .eq('address_hash', addressHash)
      .gt('expires_at', new Date().toISOString())
      .not('property', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached?.property) {
      const cachedDisplayAddress = propertyDisplayAddress(cached.property, address);
      const { data: cachedInsert } = await toolsDb
        .from('property_lookups')
        .insert({
          account_id: session.accountId,
          address_input: cachedDisplayAddress,
          address_hash: addressHash,
          mode,
          property: cached.property,
          owner: cached.owner ?? null,
          credits_charged: 0,
          expires_at: expiryIso(PROPERTY_CACHE_DAYS),
        })
        .select('id')
        .single();
      if (contactAddressId && mode === 'zillow') {
        await applyResolvedPropertyToAddress({
          accountId: session.accountId,
          addressId: contactAddressId,
          property: cached.property,
          displayAddress: cachedDisplayAddress,
        });
      }
      const enrichmentId = await insertContactEnrichment({
        accountId: session.accountId,
        personId: contactPersonId,
        addressId: contactAddressId,
        kind: enrichmentKind,
        label: cachedDisplayAddress,
        toolLookupKind: 'properties',
        toolLookupId: cachedInsert?.id ?? null,
        creditsCharged: 0,
        parentEnrichmentId,
        summary: buildEnrichmentSummary({
          kind: enrichmentKind,
          property: cached.property,
          owner: cached.owner,
        }),
        payload: {
          address: cachedDisplayAddress,
          mode,
          property: cached.property,
          owner: cached.owner ?? null,
          queryAddress: address,
        },
      });
      return NextResponse.json({
        address: cachedDisplayAddress,
        mode,
        property: cached.property,
        owner: cached.owner ?? null,
        cached: true,
        creditsCharged: 0,
        lookupId: cachedInsert?.id ?? null,
        enrichmentId,
      });
    }

    const cost =
      mode === 'skiptrace'
        ? TOOL_CREDIT_COSTS.realEstateOwner
        : TOOL_CREDIT_COSTS.realEstateProperty;
    const action = mode === 'skiptrace' ? 'owner' : 'property';
    const ledgerLabel =
      mode === 'skiptrace'
        ? TOOL_LEDGER_LABELS.realEstateOwner
        : TOOL_LEDGER_LABELS.realEstateProperty;

    const charge = await chargeToolCredits({
      accountId: session.accountId,
      product: 'real-estate',
      action,
      cost,
      description: ledgerLabel,
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
          product: 'real-estate',
          action,
          description: `${ledgerLabel}${TOOL_LEDGER_LABELS.refundSuffix}`,
        });
      }
    };

    const result =
      mode === 'skiptrace'
        ? await runSkipTrace({
            address,
            street: body.street,
            citystatezip: body.citystatezip,
            apiKey,
          })
        : await runZillow({ address, apiKey });

    if (!result.ok) {
      await refundIfCharged();
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const displayAddress = propertyDisplayAddress(result.property, address);
    const { data: inserted, error: insertError } = await toolsDb
      .from('property_lookups')
      .insert({
        account_id: session.accountId,
        address_input: displayAddress,
        address_hash: addressHash,
        mode,
        property: result.property,
        owner: result.owner,
        credits_charged: charge.charged,
        wallet_transaction_id: charge.transactionId,
        expires_at: expiryIso(PROPERTY_CACHE_DAYS),
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

    if (contactAddressId && mode === 'zillow') {
      await applyResolvedPropertyToAddress({
        accountId: session.accountId,
        addressId: contactAddressId,
        property: result.property,
        displayAddress,
      });
    }

    const enrichmentId = await insertContactEnrichment({
      accountId: session.accountId,
      personId: contactPersonId,
      addressId: contactAddressId,
      kind: enrichmentKind,
      label: displayAddress,
      toolLookupKind: 'properties',
      toolLookupId: inserted?.id ?? null,
      walletTransactionId: charge.transactionId,
      creditsCharged: charge.charged,
      parentEnrichmentId,
      summary: buildEnrichmentSummary({
        kind: enrichmentKind,
        property: result.property,
        owner: result.owner,
      }),
      payload: {
        address: displayAddress,
        mode,
        property: result.property,
        owner: result.owner,
        queryAddress: address,
      },
    });

    return NextResponse.json({
      address: displayAddress,
      mode,
      property: result.property,
      owner: result.owner,
      cached: false,
      creditsCharged: charge.charged,
      lookupId: inserted?.id ?? null,
      enrichmentId,
    });
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.error('POST /api/realestate/lookup:', e);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
