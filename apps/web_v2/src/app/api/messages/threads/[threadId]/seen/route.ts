import { NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { createServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/messages/threads/:id/seen — mark thread read for the viewer.
 */
export async function PATCH(
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
    const platform = createServiceRoleClient('platform');

    const { data: partRow } = await platform
      .from('thread_participants')
      .select('thread_id')
      .eq('thread_id', threadId)
      .eq('user_id', myId)
      .maybeSingle();

    if (!partRow) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }

    const { error } = await platform.from('thread_reads').upsert(
      {
        thread_id: threadId,
        user_id: myId,
        last_read_at: new Date().toISOString(),
      },
      { onConflict: 'thread_id,user_id' },
    );

    if (error) {
      console.error('[messages/seen]', error);
      return NextResponse.json({ error: 'Failed to mark read' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[messages/seen]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
