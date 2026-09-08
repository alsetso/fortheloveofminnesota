import { NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { resolveAiAccess } from '@/lib/ai/requireAiAccess';
import {
  AI_USAGE_EVENT_COLS,
  rollupByMode,
  rollupFromEvents,
  toUsageTurnRow,
  type AiUsageEventRow,
} from '@/lib/ai/usageRollup';
import { createAiServerClient } from '@/lib/supabase/aiDb';
import type { AccountUsageResponse } from '@/features/chat/chatUsage';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ai/usage
 * Account-wide chat usage: thread + message counts and token rollup.
 */
export async function GET() {
  try {
    const access = await resolveAiAccess();
    if (access.mode === 'comingSoon') return access.response;

    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    const ai = createAiServerClient();

    const [
      { count: threadCount, error: threadCountErr },
      { data: threadIdRows, error: threadIdsErr },
      { data: accountRows, error: accountUsageErr },
    ] = await Promise.all([
      ai
        .from('subject_threads')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', session.accountId),
      ai
        .from('subject_threads')
        .select('id')
        .eq('account_id', session.accountId)
        .limit(2000),
      ai
        .from('ai_usage_events')
        .select(AI_USAGE_EVENT_COLS)
        .eq('account_id', session.accountId)
        .order('created_at', { ascending: false })
        .limit(2000),
    ]);

    if (threadCountErr) {
      console.error('[ai/usage] thread count', threadCountErr);
      return NextResponse.json({ error: threadCountErr.message }, { status: 500 });
    }
    if (threadIdsErr) {
      console.error('[ai/usage] thread ids', threadIdsErr);
      return NextResponse.json({ error: threadIdsErr.message }, { status: 500 });
    }
    if (accountUsageErr) {
      console.error('[ai/usage] account events', accountUsageErr);
      return NextResponse.json({ error: accountUsageErr.message }, { status: 500 });
    }

    const threadIds = ((threadIdRows ?? []) as { id: string }[])
      .map((r) => r.id)
      .filter(Boolean);

    let messageCount = 0;
    if (threadIds.length > 0) {
      // PostgREST `.in()` URL length — chunk if the account has many threads.
      const chunkSize = 200;
      for (let i = 0; i < threadIds.length; i += chunkSize) {
        const chunk = threadIds.slice(i, i + chunkSize);
        const { count, error: msgErr } = await ai
          .from('subject_messages')
          .select('id', { count: 'exact', head: true })
          .in('thread_id', chunk);
        if (msgErr) {
          console.error('[ai/usage] message count', msgErr);
          return NextResponse.json({ error: msgErr.message }, { status: 500 });
        }
        messageCount += count ?? 0;
      }
    }

    const accountEvents = (accountRows ?? []) as AiUsageEventRow[];
    const rollup = rollupFromEvents(accountEvents);

    const payload: AccountUsageResponse = {
      account: {
        ...rollup,
        // Prefer live thread inventory over distinct usage-event thread ids
        // (empty chats never appear in ai_usage_events).
        thread_count: threadCount ?? 0,
        message_count: messageCount,
      },
      by_mode: rollupByMode(accountEvents),
      recent: accountEvents.slice(0, 12).map(toUsageTurnRow),
    };

    return NextResponse.json(payload);
  } catch (err) {
    console.error('[ai/usage GET]', err);
    return NextResponse.json({ error: 'Failed to load usage' }, { status: 500 });
  }
}
