import { NextResponse } from 'next/server';
import { CATEGORY_UUID } from '@/features/community/contributionTypes';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import {
  isServiceUrgency,
  type ServiceUrgency,
} from '@/lib/community/composeKindMeta';
import { serviceCategoryById } from '@/lib/services/catalog';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type MetaShape = {
  service_request?: {
    category?: unknown;
    category_id?: unknown;
    category_label?: unknown;
    trade?: unknown;
    trade_label?: unknown;
    trades?: unknown;
    urgency?: unknown;
    budget?: unknown;
  };
  marketplace?: {
    intent?: unknown;
    price?: unknown;
  };
};

type PostRow = {
  id: string;
  body: string | null;
  full_address: string | null;
  created_at: string;
  comment_count: number | null;
  meta: MetaShape | null;
};

function parseCategory(sr: NonNullable<MetaShape['service_request']>): {
  category_id: string | null;
  category_label: string | null;
} {
  const nested =
    sr.category && typeof sr.category === 'object'
      ? (sr.category as { id?: unknown; label?: unknown })
      : null;
  const categoryId =
    (typeof nested?.id === 'string' && nested.id.trim()) ||
    (typeof sr.category_id === 'string' && sr.category_id.trim()) ||
    null;
  const fromCatalog = categoryId ? serviceCategoryById(categoryId) : null;
  const categoryLabel =
    (typeof nested?.label === 'string' && nested.label.trim()) ||
    (typeof sr.category_label === 'string' && sr.category_label.trim()) ||
    fromCatalog?.label ||
    categoryId;
  return { category_id: categoryId, category_label: categoryLabel };
}

function parseTrades(sr: NonNullable<MetaShape['service_request']>): {
  trade: string | null;
  trade_label: string | null;
  trades: Array<{ id: string; label: string }>;
} {
  const trades: Array<{ id: string; label: string }> = [];
  if (Array.isArray(sr.trades)) {
    for (const row of sr.trades) {
      if (!row || typeof row !== 'object') continue;
      const item = row as { id?: unknown; label?: unknown };
      const id = typeof item.id === 'string' ? item.id.trim() : '';
      if (!id) continue;
      const label =
        typeof item.label === 'string' && item.label.trim()
          ? item.label.trim()
          : id;
      trades.push({ id, label });
    }
  }
  if (trades.length === 0) {
    const trade = typeof sr.trade === 'string' ? sr.trade : null;
    const tradeLabel =
      typeof sr.trade_label === 'string' ? sr.trade_label : trade;
    if (trade) trades.push({ id: trade, label: tradeLabel || trade });
  }
  const trade = trades[0]?.id ?? (typeof sr.trade === 'string' ? sr.trade : null);
  const tradeLabel =
    trades.length > 1
      ? trades.map((row) => row.label).join(', ')
      : trades[0]?.label ??
        (typeof sr.trade_label === 'string' ? sr.trade_label : trade);
  return { trade, trade_label: tradeLabel, trades };
}

/**
 * GET /api/services/requests — own open home-service bid requests.
 * Rows are Marketplace pins with `meta.service_request` from the portal.
 */
export async function GET() {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .schema('community')
      .from('posts')
      .select('id, body, full_address, created_at, comment_count, meta')
      .eq('account_id', session.accountId)
      .eq('category_id', CATEGORY_UUID.marketplace)
      .eq('kind', 'post')
      .eq('is_active', true)
      .eq('archived', false)
      .order('created_at', { ascending: false })
      .limit(40);

    if (error) {
      console.error('[services/requests]', error);
      return NextResponse.json({ error: 'Failed to load requests' }, { status: 500 });
    }

    const requests = ((data ?? []) as PostRow[])
      .map((row) => {
        const sr = row.meta?.service_request;
        if (!sr || typeof sr !== 'object') return null;
        const { category_id, category_label } = parseCategory(sr);
        const { trade, trade_label, trades } = parseTrades(sr);
        const urgency: ServiceUrgency | null = isServiceUrgency(sr.urgency)
          ? sr.urgency
          : null;
        const budget =
          typeof sr.budget === 'string'
            ? sr.budget
            : typeof row.meta?.marketplace?.price === 'string'
              ? row.meta.marketplace.price
              : null;
        return {
          id: row.id,
          body: row.body,
          full_address: row.full_address,
          created_at: row.created_at,
          comment_count: row.comment_count ?? 0,
          category_id,
          category_label,
          trade,
          trade_label,
          trades,
          urgency,
          budget,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    return NextResponse.json({ requests });
  } catch (e) {
    console.error('[services/requests]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
