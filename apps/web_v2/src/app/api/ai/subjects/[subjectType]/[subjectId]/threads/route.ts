import { NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { resolveAiAccess } from '@/lib/ai/requireAiAccess';
import { isUuid } from '@/lib/ai/subjectTypes';
import { createAiServerClient } from '@/lib/supabase/aiDb';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ai/subjects/[subjectType]/[subjectId]/threads
 * List the signed-in account's threads for this subject.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ subjectType: string; subjectId: string }> },
) {
  try {
    const access = await resolveAiAccess();
    if (access.mode === 'comingSoon') return access.response;

    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    const { subjectType, subjectId } = await params;
    if (!subjectType?.trim() || !isUuid(subjectId)) {
      return NextResponse.json({ error: 'Invalid subject' }, { status: 400 });
    }

    const ai = createAiServerClient();
    const { data, error } = await ai
      .from('subject_threads')
      .select('id, title, thread_key, meta, created_at, updated_at')
      .eq('account_id', session.accountId)
      .eq('subject_type', subjectType)
      .eq('subject_id', subjectId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[ai/subjects threads GET]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ threads: data ?? [] });
  } catch (err) {
    console.error('[ai/subjects threads GET]', err);
    return NextResponse.json({ error: 'Failed to list threads' }, { status: 500 });
  }
}

type PostBody = {
  title?: string;
  thread_key?: string;
};

/**
 * POST — create a new thread (new thread_key each time unless provided).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ subjectType: string; subjectId: string }> },
) {
  try {
    const access = await resolveAiAccess();
    if (access.mode === 'comingSoon') return access.response;

    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    const { subjectType, subjectId } = await params;
    if (!subjectType?.trim() || !isUuid(subjectId)) {
      return NextResponse.json({ error: 'Invalid subject' }, { status: 400 });
    }

    const body = (await request.json().catch(() => ({}))) as PostBody;
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
      .select('id, title, thread_key, meta, created_at, updated_at')
      .single();

    if (error) {
      console.error('[ai/subjects threads POST]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ thread: data }, { status: 201 });
  } catch (err) {
    console.error('[ai/subjects threads POST]', err);
    return NextResponse.json({ error: 'Failed to create thread' }, { status: 500 });
  }
}
