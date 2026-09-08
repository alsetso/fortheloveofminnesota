import { NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { resolveAiAccess } from '@/lib/ai/requireAiAccess';
import { SUBJECT_TYPE_GENERAL } from '@/lib/ai/subjectTypes';
import { createAiServerClient } from '@/lib/supabase/aiDb';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ai/threads
 * Account inbox — all `ai.subject_threads` owned by the signed-in account.
 * Optional `?subject_type=` filter (e.g. `general`).
 */
export async function GET(request: Request) {
  try {
    const access = await resolveAiAccess();
    if (access.mode === 'comingSoon') return access.response;

    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    const url = new URL(request.url);
    const subjectType = url.searchParams.get('subject_type')?.trim() || null;

    const ai = createAiServerClient();
    let query = ai
      .from('subject_threads')
      .select(
        'id, title, thread_key, subject_type, subject_id, meta, created_at, updated_at',
      )
      .eq('account_id', session.accountId)
      .order('updated_at', { ascending: false })
      .limit(100);

    if (subjectType) {
      query = query.eq('subject_type', subjectType);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[ai/threads GET]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const threads = data ?? [];
    const threadIds = threads.map((t) => t.id as string).filter(Boolean);

    let recentMessages: {
      id: string;
      thread_id: string;
      content: string;
      created_at: string;
    }[] = [];

    if (threadIds.length > 0) {
      const { data: msgs, error: msgErr } = await ai
        .from('subject_messages')
        .select('id, thread_id, content, created_at')
        .in('thread_id', threadIds)
        .eq('role', 'user')
        .order('created_at', { ascending: false })
        .limit(3);

      if (msgErr) {
        console.error('[ai/threads GET] recent messages', msgErr);
      } else {
        recentMessages = (msgs ?? []).map((m) => ({
          id: String(m.id),
          thread_id: String(m.thread_id),
          content: typeof m.content === 'string' ? m.content : '',
          created_at: String(m.created_at),
        }));
      }
    }

    return NextResponse.json({
      threads,
      recent_messages: recentMessages,
      accountId: session.accountId,
    });
  } catch (err) {
    console.error('[ai/threads GET]', err);
    return NextResponse.json({ error: 'Failed to list threads' }, { status: 500 });
  }
}

type PostBody = {
  title?: string;
  /** Defaults to `general` — account-scoped AI inbox. */
  subject_type?: string;
  /**
   * Subject id. For `general`, defaults to the signed-in account id
   * (the account is the conversation subject).
   */
  subject_id?: string;
  thread_key?: string;
};

/**
 * POST — create an account-owned thread (defaults to subject_type=general).
 */
export async function POST(request: Request) {
  try {
    const access = await resolveAiAccess();
    if (access.mode === 'comingSoon') return access.response;

    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as PostBody;
    const subjectType =
      typeof body.subject_type === 'string' && body.subject_type.trim()
        ? body.subject_type.trim().slice(0, 64)
        : SUBJECT_TYPE_GENERAL;
    const subjectId =
      typeof body.subject_id === 'string' && body.subject_id.trim()
        ? body.subject_id.trim()
        : session.accountId;
    const threadKey =
      typeof body.thread_key === 'string' && body.thread_key.trim()
        ? body.thread_key.trim().slice(0, 80)
        : `t_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const title =
      typeof body.title === 'string' && body.title.trim()
        ? body.title.trim().slice(0, 120)
        : 'New conversation';

    const ai = createAiServerClient();
    const { data, error } = await ai
      .from('subject_threads')
      .insert({
        subject_type: subjectType,
        subject_id: subjectId,
        account_id: session.accountId,
        title,
        thread_key: threadKey,
      })
      .select(
        'id, title, thread_key, subject_type, subject_id, meta, created_at, updated_at',
      )
      .single();

    if (error) {
      console.error('[ai/threads POST]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ thread: data }, { status: 201 });
  } catch (err) {
    console.error('[ai/threads POST]', err);
    return NextResponse.json({ error: 'Failed to create thread' }, { status: 500 });
  }
}
