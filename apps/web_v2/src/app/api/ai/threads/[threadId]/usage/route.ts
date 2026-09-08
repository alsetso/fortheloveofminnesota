import { NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { resolveAiAccess } from '@/lib/ai/requireAiAccess';
import { isUuid } from '@/lib/ai/subjectTypes';
import {
  AI_USAGE_EVENT_COLS,
  rollupByMode,
  rollupFromEvents,
  toUsageTurnRow,
  type AiUsageEventRow,
} from '@/lib/ai/usageRollup';
import { createAiServerClient } from '@/lib/supabase/aiDb';
import type { ThreadUsageResponse } from '@/features/chat/chatUsage';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ai/threads/[threadId]/usage
 * Aggregates from `ai_usage_events` (not the SQL view — PostgREST often omits views).
 */
export async function GET(
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
    const { data: thread, error: threadErr } = await ai
      .from('subject_threads')
      .select('id, account_id')
      .eq('id', threadId)
      .maybeSingle();

    if (threadErr || !thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }
    if (thread.account_id !== session.accountId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [{ data: threadRows, error: threadUsageErr }, { data: accountRows, error: accountUsageErr }] =
      await Promise.all([
        ai
          .from('ai_usage_events')
          .select(AI_USAGE_EVENT_COLS)
          .eq('subject_thread_id', threadId)
          .eq('account_id', session.accountId)
          .order('created_at', { ascending: false }),
        ai
          .from('ai_usage_events')
          .select(AI_USAGE_EVENT_COLS)
          .eq('account_id', session.accountId)
          .order('created_at', { ascending: false })
          .limit(2000),
      ]);

    if (threadUsageErr) {
      console.error('[ai/threads usage] thread events', threadUsageErr);
      return NextResponse.json({ error: threadUsageErr.message }, { status: 500 });
    }
    if (accountUsageErr) {
      console.error('[ai/threads usage] account events', accountUsageErr);
    }

    const events = (threadRows ?? []) as AiUsageEventRow[];
    const accountEvents = (accountRows ?? []) as AiUsageEventRow[];
    const threadRollup = rollupFromEvents(events);
    const accountRollup = rollupFromEvents(accountEvents);

    const payload: ThreadUsageResponse = {
      thread: threadRollup,
      account: {
        ...accountRollup,
        thread_count: accountRollup.thread_count,
      },
      by_mode: rollupByMode(events),
      recent: events.slice(0, 12).map(toUsageTurnRow),
    };

    return NextResponse.json(payload);
  } catch (err) {
    console.error('[ai/threads usage GET]', err);
    return NextResponse.json({ error: 'Failed to load usage' }, { status: 500 });
  }
}
