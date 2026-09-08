import { NextRequest, NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getToolsServiceDb } from '@/lib/wallet/walletDb';
import {
  expiryIso,
  PEOPLE_CACHE_DAYS,
  peopleQueryCacheHash,
} from '@/lib/wallet/toolLookupCache';

function escapeIlike(s: string): string {
  return s.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_');
}

function normalizeDigits(s: string | null): string {
  return (s ?? '').replace(/\D/g, '');
}

type LookupBody =
  | { type: 'name'; firstName?: string; lastName?: string }
  | { type: 'email'; email: string }
  | { type: 'phone'; phone: string };

/**
 * POST /api/people/lookup — free account match (no RapidAPI).
 * Returns public account fields; never returns email/phone on matches.
 * Dual-writes tools.people_lookups (kind=account) for the result sheet.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as LookupBody;
    if (!body?.type || !['name', 'email', 'phone'].includes(body.type)) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const select = 'id,username,first_name,last_name,image_url';
    let accounts: Record<string, unknown>[] = [];
    let query: Record<string, unknown> = { type: body.type };
    let hashValue = '';

    if (body.type === 'name') {
      const firstName = body.firstName?.trim() ?? '';
      const lastName = body.lastName?.trim() ?? '';
      const tokens = [
        ...firstName.split(/\s+/).filter(Boolean),
        ...lastName.split(/\s+/).filter(Boolean),
      ];
      if (tokens.length === 0) {
        return NextResponse.json({ accounts: [], count: 0, lookupId: null });
      }
      query = { type: 'name', firstName, lastName };
      hashValue = [firstName, lastName].filter(Boolean).join(' ').trim();

      const firstPattern = `%${escapeIlike(tokens[0])}%`;
      const { data: rows, error } = await supabase
        .from('accounts')
        .select(select)
        .not('username', 'is', null)
        .or(`first_name.ilike.${firstPattern},last_name.ilike.${firstPattern}`)
        .limit(100);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      const rest = tokens.slice(1);
      accounts = (rows ?? [])
        .filter((row: { first_name: string | null; last_name: string | null }) => {
          const first = (row.first_name ?? '').toLowerCase();
          const last = (row.last_name ?? '').toLowerCase();
          return rest.every((t) => {
            const lower = t.toLowerCase();
            return first.includes(lower) || last.includes(lower);
          });
        })
        .slice(0, 20) as Record<string, unknown>[];
    } else if (body.type === 'email') {
      const email = String(body.email ?? '')
        .trim()
        .toLowerCase();
      if (!email.includes('@')) {
        return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
      }
      query = { type: 'email', email };
      hashValue = email;
      const { data, error } = await supabase
        .from('accounts')
        .select(select)
        .ilike('email', email)
        .limit(20);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      accounts = (data ?? []) as Record<string, unknown>[];
    } else {
      const searchDigits = normalizeDigits(body.phone);
      if (searchDigits.length < 4) {
        return NextResponse.json({ accounts: [], count: 0, lookupId: null });
      }
      query = { type: 'phone', phone: body.phone };
      hashValue = searchDigits;
      const suffix10 = searchDigits.slice(-10);
      const suffix7 = searchDigits.slice(-7);
      const { data: rows, error } = await supabase
        .from('accounts')
        .select(`${select},phone`)
        .not('phone', 'is', null)
        .limit(200);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      type Row = { phone: string | null } & Record<string, unknown>;
      accounts = ((rows ?? []) as Row[])
        .map((r) => {
          const n = normalizeDigits(r.phone);
          if (n.length < 4) return null;
          const fullMatch =
            suffix10.length >= 10 && n.length >= 10 && n.slice(-10) === suffix10;
          const partialMatch =
            suffix7.length >= 7 && n.length >= 7 && n.slice(-7) === suffix7;
          if (fullMatch) return { ...r, match_type: 'full' as const };
          if (partialMatch) return { ...r, match_type: 'partial' as const };
          return null;
        })
        .filter((r): r is NonNullable<typeof r> => r !== null)
        .sort((a, b) =>
          a.match_type === 'full' && b.match_type === 'partial'
            ? -1
            : a.match_type === 'partial' && b.match_type === 'full'
              ? 1
              : 0,
        )
        .slice(0, 20)
        .map((r) => {
          const { phone: _p, ...rest } = r;
          return rest;
        });
    }

    const result = { accounts, count: accounts.length };
    const { data: inserted, error: archiveErr } = await getToolsServiceDb()
      .from('people_lookups')
      .insert({
        account_id: session.accountId,
        kind: 'account',
        query_hash: peopleQueryCacheHash(body.type, hashValue),
        query,
        result,
        credits_charged: 0,
        expires_at: expiryIso(PEOPLE_CACHE_DAYS),
      })
      .select('id')
      .single();

    if (archiveErr || !inserted?.id) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[people/lookup] tools archive write failed', archiveErr);
      }
      return NextResponse.json(
        { error: 'Could not archive lookup for confirm save' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ...result,
      lookupId: inserted.id as string,
      creditsCharged: 0,
    });
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.error('POST /api/people/lookup:', e);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
