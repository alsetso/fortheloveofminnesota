import { NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { normalizeUsername, validateUsername } from '@/features/account/accountProfile';

/**
 * POST /api/accounts/username/check
 * Same contract as web: { username } → { available: boolean }
 */
export async function POST(req: Request) {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: { username?: unknown };
    try {
      body = (await req.json()) as { username?: unknown };
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const raw = typeof body.username === 'string' ? body.username : '';
    const formatErr = validateUsername(raw);
    if (formatErr) {
      return NextResponse.json({ error: formatErr, available: false }, { status: 400 });
    }

    const username = normalizeUsername(raw);
    const supabase = await createSupabaseServerClient();

    const { data: current } = await supabase
      .from('accounts')
      .select('id, username')
      .eq('id', session.accountId)
      .eq('user_id', session.userId)
      .maybeSingle();

    if (!current) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    if (current.username === username) {
      return NextResponse.json({ available: true });
    }

    const { data: existing } = await supabase
      .from('accounts')
      .select('id')
      .eq('username', username)
      .neq('id', session.accountId)
      .maybeSingle();

    return NextResponse.json({ available: !existing });
  } catch (err) {
    console.error('username check', err);
    return NextResponse.json({ error: 'Failed to check username' }, { status: 500 });
  }
}
