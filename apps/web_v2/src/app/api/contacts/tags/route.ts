import { NextRequest, NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { getContactsServiceDb } from '@/lib/wallet/walletDb';

function normalizeTag(tag: string | null | undefined): string | null {
  const t = (tag ?? '').trim();
  if (!t) return null;
  return t.slice(0, 48);
}

/**
 * GET /api/contacts/tags
 * Distinct non-null tags from this account's people + addresses (for reselect).
 */
export async function GET() {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getContactsServiceDb();
    const [{ data: people, error: peopleErr }, { data: addresses, error: addrErr }] =
      await Promise.all([
        db
          .from('people')
          .select('tag')
          .eq('account_id', session.accountId)
          .not('tag', 'is', null)
          .limit(200),
        db
          .from('addresses')
          .select('tag')
          .eq('account_id', session.accountId)
          .not('tag', 'is', null)
          .limit(200),
      ]);

    if (peopleErr) throw new Error(peopleErr.message);
    if (addrErr) throw new Error(addrErr.message);

    const counts = new Map<string, number>();
    for (const row of [...(people ?? []), ...(addresses ?? [])]) {
      const tag = typeof row.tag === 'string' ? row.tag.trim() : '';
      if (!tag) continue;
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }

    const ranked = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 24);

    const tags = ranked.map(([tag]) => tag);
    const tagCounts = Object.fromEntries(ranked);

    return NextResponse.json({ tags, counts: tagCounts });
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.error('GET /api/contacts/tags:', e);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/contacts/tags
 * Rename a tag across this account's people + addresses.
 * Body: { from: string, to: string }
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as { from?: unknown; to?: unknown };
    const from = typeof body.from === 'string' ? body.from.trim() : '';
    const to = normalizeTag(typeof body.to === 'string' ? body.to : '');

    if (!from) {
      return NextResponse.json({ error: 'from is required' }, { status: 400 });
    }
    if (!to) {
      return NextResponse.json({ error: 'to is required' }, { status: 400 });
    }
    if (from === to) {
      return NextResponse.json({ ok: true, from, to, updated: 0 });
    }

    const db = getContactsServiceDb();
    const [{ data: people, error: peopleErr }, { data: addresses, error: addrErr }] =
      await Promise.all([
        db
          .from('people')
          .update({ tag: to })
          .eq('account_id', session.accountId)
          .eq('tag', from)
          .select('id'),
        db
          .from('addresses')
          .update({ tag: to })
          .eq('account_id', session.accountId)
          .eq('tag', from)
          .select('id'),
      ]);

    if (peopleErr) throw new Error(peopleErr.message);
    if (addrErr) throw new Error(addrErr.message);

    const updated = (people?.length ?? 0) + (addresses?.length ?? 0);
    return NextResponse.json({ ok: true, from, to, updated });
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.error('PATCH /api/contacts/tags:', e);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
