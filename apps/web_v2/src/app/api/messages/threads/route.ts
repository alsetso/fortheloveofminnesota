import { NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { createServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type ParticipantRow = { thread_id: string; user_id: string };
type ThreadRow = { id: string; created_at: string; updated_at: string };
type MessagePreview = {
  thread_id: string;
  body: string;
  created_at: string;
  sender_id: string;
};
type AccountPreview = {
  id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
};

/**
 * GET /api/messages/threads — DM inbox for the active account.
 * POST /api/messages/threads — open or create a DM with `other_account_id`.
 */
export async function GET() {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    const platform = createServiceRoleClient('platform');
    const publicDb = createServiceRoleClient();
    const myId = session.accountId;

    const { data: participantRows, error: pErr } = await platform
      .from('thread_participants')
      .select('thread_id')
      .eq('user_id', myId);

    if (pErr) {
      console.error('[messages/threads] participants', pErr);
      return NextResponse.json({ error: 'Failed to load threads' }, { status: 500 });
    }

    const threadIds = ((participantRows ?? []) as { thread_id: string }[]).map(
      (r) => r.thread_id,
    );
    if (threadIds.length === 0) {
      return NextResponse.json({ threads: [] });
    }

    const { data: threads, error: tErr } = await platform
      .from('threads')
      .select('id, created_at, updated_at')
      .in('id', threadIds)
      .order('updated_at', { ascending: false });

    if (tErr) {
      console.error('[messages/threads] threads', tErr);
      return NextResponse.json({ error: 'Failed to load threads' }, { status: 500 });
    }

    const { data: allParticipants } = await platform
      .from('thread_participants')
      .select('thread_id, user_id')
      .in('thread_id', threadIds);

    const otherIds: string[] = [];
    const threadOtherMap: Record<string, string> = {};
    for (const p of (allParticipants ?? []) as ParticipantRow[]) {
      if (p.user_id !== myId) {
        otherIds.push(p.user_id);
        threadOtherMap[p.thread_id] = p.user_id;
      }
    }

    const { data: profiles } =
      otherIds.length > 0
        ? await publicDb
            .from('accounts')
            .select('id, username, first_name, last_name, image_url')
            .in('id', [...new Set(otherIds)])
        : { data: [] as AccountPreview[] };

    const profileMap: Record<string, AccountPreview> = Object.fromEntries(
      ((profiles ?? []) as AccountPreview[]).map((p) => [p.id, p]),
    );

    const { data: threadReads } = await platform
      .from('thread_reads')
      .select('thread_id, last_read_at')
      .eq('user_id', myId)
      .in('thread_id', threadIds);

    const lastReadMap: Record<string, string | null> = {};
    for (const r of (threadReads ?? []) as {
      thread_id: string;
      last_read_at: string | null;
    }[]) {
      lastReadMap[r.thread_id] = r.last_read_at;
    }

    const { data: unreadRows } = await platform
      .from('messages')
      .select('thread_id, created_at')
      .in('thread_id', threadIds)
      .neq('sender_id', myId);

    const unreadMap: Record<string, number> = {};
    for (const m of (unreadRows ?? []) as {
      thread_id: string;
      created_at: string;
    }[]) {
      const lastRead = lastReadMap[m.thread_id] ?? null;
      if (!lastRead || new Date(m.created_at) > new Date(lastRead)) {
        unreadMap[m.thread_id] = (unreadMap[m.thread_id] ?? 0) + 1;
      }
    }

    const { data: lastMsgs } = await platform
      .from('messages')
      .select('thread_id, body, created_at, sender_id')
      .in('thread_id', threadIds)
      .order('created_at', { ascending: false });

    const lastMsgMap: Record<string, MessagePreview> = {};
    for (const m of (lastMsgs ?? []) as MessagePreview[]) {
      if (!lastMsgMap[m.thread_id]) lastMsgMap[m.thread_id] = m;
    }

    const result = ((threads ?? []) as ThreadRow[])
      .filter((t) => lastMsgMap[t.id] != null)
      .map((t) => {
        const otherId = threadOtherMap[t.id];
        const last = lastMsgMap[t.id]!;
        return {
          id: t.id,
          updated_at: t.updated_at,
          other_account: otherId ? (profileMap[otherId] ?? null) : null,
          unread_count: unreadMap[t.id] ?? 0,
          last_message: {
            body: last.body,
            created_at: last.created_at,
            sender_id: last.sender_id,
          },
        };
      });

    return NextResponse.json(
      { threads: result },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (e) {
    console.error('[messages/threads]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      other_account_id?: string;
    };
    const otherAccountId = body.other_account_id?.trim();
    if (!otherAccountId) {
      return NextResponse.json({ error: 'other_account_id required' }, { status: 400 });
    }

    const myId = session.accountId;
    if (myId === otherAccountId) {
      return NextResponse.json({ error: 'Cannot message yourself' }, { status: 400 });
    }

    const platform = createServiceRoleClient('platform');
    const publicDb = createServiceRoleClient();

    const { data: targetRows } = await publicDb
      .from('accounts')
      .select('id')
      .eq('id', otherAccountId)
      .limit(1);

    if (!targetRows?.length) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const { data: myThreads } = await platform
      .from('thread_participants')
      .select('thread_id')
      .eq('user_id', myId);

    const myThreadIds = ((myThreads ?? []) as { thread_id: string }[]).map(
      (r) => r.thread_id,
    );

    if (myThreadIds.length > 0) {
      const { data: sharedThreads } = await platform
        .from('thread_participants')
        .select('thread_id')
        .eq('user_id', otherAccountId)
        .in('thread_id', myThreadIds);

      if (sharedThreads && sharedThreads.length > 0) {
        return NextResponse.json({
          thread_id: (sharedThreads[0] as { thread_id: string }).thread_id,
          created: false,
        });
      }
    }

    const { data: newThread, error: threadErr } = await platform
      .from('threads')
      .insert({ type: 'dm' })
      .select('id')
      .single();

    if (threadErr || !newThread) {
      console.error('[messages/threads] create', threadErr);
      return NextResponse.json({ error: 'Failed to create thread' }, { status: 500 });
    }

    const threadId = (newThread as { id: string }).id;
    const { error: partErr } = await platform.from('thread_participants').insert([
      { thread_id: threadId, user_id: myId },
      { thread_id: threadId, user_id: otherAccountId },
    ]);

    if (partErr) {
      console.error('[messages/threads] participants insert', partErr);
      return NextResponse.json({ error: 'Failed to create thread' }, { status: 500 });
    }

    return NextResponse.json({ thread_id: threadId, created: true });
  } catch (e) {
    console.error('[messages/threads] POST', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
