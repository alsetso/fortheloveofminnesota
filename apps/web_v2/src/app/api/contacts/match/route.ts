import { NextRequest, NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { matchContactsByIdentityKeys } from '@/lib/contacts/matchContacts';

/**
 * POST /api/contacts/match
 * Body: { keys: string[] } — identity_key values from candidates.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as { keys?: unknown };
    const keys = Array.isArray(body.keys)
      ? body.keys
          .filter((k): k is string => typeof k === 'string')
          .map((k) => k.trim())
          .filter(Boolean)
          .slice(0, 100)
      : [];

    const matched = await matchContactsByIdentityKeys({
      accountId: session.accountId,
      keys,
    });

    const matches: Record<
      string,
      { kind: 'person' | 'address'; id: string; title: string; tag: string | null }
    > = {};
    for (const [key, row] of Object.entries(matched)) {
      matches[key] = {
        kind: row.kind,
        id: row.id,
        title: row.title,
        tag: row.tag,
      };
    }

    return NextResponse.json({ matches });
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.error('POST /api/contacts/match:', e);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
