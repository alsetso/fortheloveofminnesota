import { NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export type NotificationItem = {
  id: string;
  title: string;
  message: string;
  image_url: string | null;
  action_url: string | null;
  action_label: string | null;
  read: boolean;
  archived: boolean;
  created_at: string;
};

/**
 * GET /api/community/notifications
 * Own alerts from `platform.alerts` — the table the web app's notification bell
 * already writes to (follows, DMs, map invites, system messages). RLS scopes
 * `SELECT`/`UPDATE` to `account_id = caller`, so the anon-keyed client is enough.
 */
export async function GET(req: Request) {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10) || 50, 100);

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .schema('platform')
      .from('alerts')
      .select('id, title, message, image_url, action_url, action_label, read, archived, created_at')
      .eq('account_id', session.accountId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[community/notifications]', error);
      return NextResponse.json({ error: 'Failed to load notifications' }, { status: 500 });
    }

    const items = (data ?? []) as NotificationItem[];
    const unreadCount = items.filter((n) => !n.read && !n.archived).length;

    return NextResponse.json(
      { items, unread_count: unreadCount },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (e) {
    console.error('[community/notifications]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/community/notifications
 * Body: `{ id: string }` — mark one as read. `{ all: true }` — mark all read.
 */
export async function PATCH(req: Request) {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as { id?: string; all?: boolean };
    const supabase = await createSupabaseServerClient();

    if (body.all) {
      const { error } = await supabase
        .schema('platform')
        .from('alerts')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('account_id', session.accountId)
        .eq('read', false);
      if (error) {
        console.error('[community/notifications] mark-all', error);
        return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    if (!body.id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const { error } = await supabase
      .schema('platform')
      .from('alerts')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('id', body.id)
      .eq('account_id', session.accountId);

    if (error) {
      console.error('[community/notifications] mark-one', error);
      return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[community/notifications]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
