import { NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { resolveAiAccess } from '@/lib/ai/requireAiAccess';
import { isUuid } from '@/lib/ai/subjectTypes';
import { createAiServerClient } from '@/lib/supabase/aiDb';

export const dynamic = 'force-dynamic';

type PatchBody = {
  title?: string;
};

/**
 * PATCH /api/ai/threads/[threadId] — rename an account-owned thread.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  try {
    const access = await resolveAiAccess();
    if (access.mode === 'comingSoon') return access.response;

    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    const { threadId } = await params;
    if (!isUuid(threadId)) {
      return NextResponse.json({ error: 'Invalid thread id' }, { status: 400 });
    }

    const body = (await request.json().catch(() => ({}))) as PatchBody;
    const title =
      typeof body.title === 'string' && body.title.trim()
        ? body.title.trim().slice(0, 120)
        : null;
    if (!title) {
      return NextResponse.json({ error: 'title required' }, { status: 400 });
    }

    const ai = createAiServerClient();
    const { data, error } = await ai
      .from('subject_threads')
      .update({ title, updated_at: new Date().toISOString() })
      .eq('id', threadId)
      .eq('account_id', session.accountId)
      .select(
        'id, title, thread_key, subject_type, subject_id, meta, created_at, updated_at',
      )
      .maybeSingle();

    if (error) {
      console.error('[ai/threads PATCH]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }

    return NextResponse.json({ thread: data });
  } catch (err) {
    console.error('[ai/threads PATCH]', err);
    return NextResponse.json({ error: 'Failed to update thread' }, { status: 500 });
  }
}

/**
 * DELETE /api/ai/threads/[threadId]
 * Cascades to `ai.subject_messages` via FK.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  try {
    const access = await resolveAiAccess();
    if (access.mode === 'comingSoon') return access.response;

    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    const { threadId } = await params;
    if (!isUuid(threadId)) {
      return NextResponse.json({ error: 'Invalid thread id' }, { status: 400 });
    }

    const ai = createAiServerClient();
    const { data, error } = await ai
      .from('subject_threads')
      .delete()
      .eq('id', threadId)
      .eq('account_id', session.accountId)
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('[ai/threads DELETE]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, id: data.id });
  } catch (err) {
    console.error('[ai/threads DELETE]', err);
    return NextResponse.json({ error: 'Failed to delete thread' }, { status: 500 });
  }
}
