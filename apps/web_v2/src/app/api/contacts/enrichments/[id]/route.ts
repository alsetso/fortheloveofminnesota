import { NextRequest, NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { identifyFromToolResult } from '@/features/contacts/logic/identifyCandidates';
import {
  listChildPersonDetails,
  type ContactEnrichmentKind,
} from '@/lib/contacts/contactEnrichments';
import { getContactsServiceDb } from '@/lib/wallet/walletDb';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type EnrichmentRow = {
  id: string;
  kind: ContactEnrichmentKind;
  label: string;
  credits_charged: number;
  tool_lookup_kind: 'people' | 'properties' | null;
  tool_lookup_id: string | null;
  parent_enrichment_id: string | null;
  person_id: string | null;
  address_id: string | null;
  summary: Record<string, unknown> | null;
  payload: Record<string, unknown>;
  created_at: string;
};

/**
 * GET /api/contacts/enrichments/[id]
 * Durable enrichment detail + identify candidates + child person_detail map.
 */
export async function GET(
  _request: NextRequest,
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

    const db = getContactsServiceDb();
    const { data, error } = await db
      .from('enrichments')
      .select(
        'id, kind, label, credits_charged, tool_lookup_kind, tool_lookup_id, parent_enrichment_id, person_id, address_id, summary, payload, created_at',
      )
      .eq('id', id)
      .eq('account_id', session.accountId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const row = data as EnrichmentRow;
    const payload = row.payload ?? {};

    const candidates = identifyFromToolResult(
      row.kind === 'property' || row.kind === 'owner'
        ? {
            archiveKind: 'properties',
            property: payload.property,
            owner: payload.owner,
            addressInput:
              (typeof payload.address === 'string' && payload.address) ||
              (typeof payload.queryAddress === 'string' && payload.queryAddress) ||
              row.label,
          }
        : {
            archiveKind: 'people',
            result: payload.result ?? payload,
          },
    );

    const childDetails =
      row.kind === 'owner' || row.kind === 'public_records'
        ? await listChildPersonDetails({
            accountId: session.accountId,
            parentEnrichmentId: row.id,
            personId: row.person_id,
            addressId: row.address_id,
          })
        : [];

    return NextResponse.json({
      enrichment: {
        id: row.id,
        kind: row.kind,
        label: row.label,
        creditsCharged: row.credits_charged,
        toolLookupKind: row.tool_lookup_kind,
        toolLookupId: row.tool_lookup_id,
        parentEnrichmentId: row.parent_enrichment_id,
        personId: row.person_id,
        addressId: row.address_id,
        summary: row.summary,
        payload,
        createdAt: row.created_at,
      },
      candidates,
      childPersonDetails: childDetails.map((c) => ({
        id: c.id,
        label: c.label,
        peoId: c.peoId,
        summary: c.summary,
      })),
    });
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.error('GET /api/contacts/enrichments/[id]:', e);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
