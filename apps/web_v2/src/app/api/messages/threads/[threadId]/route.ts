import { NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { createServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type AccountPreview = {
  id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
};

async function resolveThreadPeer(
  myId: string,
  threadId: string,
): Promise<{ recipientId: string } | null> {
  const platform = createServiceRoleClient('platform');
  const { data: participants, error } = await platform
    .from('thread_participants')
    .select('user_id')
    .eq('thread_id', threadId);

  if (error || !participants?.length) return null;
  const ids = (participants as { user_id: string }[]).map((p) => p.user_id);
  if (!ids.includes(myId)) return null;
  const recipientId = ids.find((id) => id !== myId) ?? myId;
  return { recipientId };
}

/**
 * GET /api/messages/threads/:id — messages + peer for a DM thread.
 * POST /api/messages/threads/:id — send a text message.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  try {
    const { threadId } = await params;
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    const myId = session.accountId;
    const peer = await resolveThreadPeer(myId, threadId);
    if (!peer) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }

    const platform = createServiceRoleClient('platform');
    const publicDb = createServiceRoleClient();

    const { data: messages, error } = await platform
      .from('messages')
      .select('id, body, sender_id, created_at')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[messages/thread] list', error);
      return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 });
    }

    const { data: profiles } = await publicDb
      .from('accounts')
      .select('id, username, first_name, last_name, image_url')
      .eq('id', peer.recipientId)
      .limit(1);

    const otherAccount = ((profiles ?? [])[0] as AccountPreview | undefined) ?? null;

    const { data: peerReadRow } = await platform
      .from('thread_reads')
      .select('last_read_at')
      .eq('thread_id', threadId)
      .eq('user_id', peer.recipientId)
      .maybeSingle();

    return NextResponse.json(
      {
        messages: messages ?? [],
        other_account: otherAccount,
        peer_last_read_at:
          (peerReadRow as { last_read_at?: string | null } | null)?.last_read_at ??
          null,
        viewer_account_id: myId,
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (e) {
    console.error('[messages/thread] GET', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  try {
    const { threadId } = await params;
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    const myId = session.accountId;
    const peer = await resolveThreadPeer(myId, threadId);
    if (!peer) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }

    const body = (await req.json().catch(() => ({}))) as { body?: string };
    const text = body.body?.trim();
    if (!text) {
      return NextResponse.json({ error: 'body required' }, { status: 400 });
    }

    const platform = createServiceRoleClient('platform');
    const { data: insertedRows, error: insertError } = await platform
      .from('messages')
      .insert({ thread_id: threadId, sender_id: myId, body: text })
      .select('id, body, sender_id, created_at');

    if (insertError) {
      console.error('[messages/thread] send', insertError);
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
    }

    const message =
      insertedRows && insertedRows.length > 0 ? insertedRows[0] : null;
    if (!message) {
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
    }

    // Bump thread activity for inbox ordering.
    await platform
      .from('threads')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', threadId);

    return NextResponse.json({ message });
  } catch (e) {
    console.error('[messages/thread] POST', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
