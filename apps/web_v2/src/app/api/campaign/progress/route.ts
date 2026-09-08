import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';

export const dynamic = 'force-dynamic';

/**
 * POST /api/campaign/progress
 * Body: { sentenceIds: number[], chapterId: number }
 * Marks sentences as read. Idempotent — duplicate rows are ignored.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json() as { sentenceIds?: unknown; chapterId?: unknown };
    const rawIds = Array.isArray(body.sentenceIds) ? body.sentenceIds : [];
    const chapterId = typeof body.chapterId === 'number' ? body.chapterId : null;

    const sentenceIds = rawIds
      .map((id) => (typeof id === 'number' ? id : null))
      .filter((id): id is number => id !== null);

    if (sentenceIds.length === 0 || chapterId === null) {
      return NextResponse.json({ error: 'sentenceIds and chapterId required' }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();

    const rows = sentenceIds.map((sid) => ({
      account_id: session.accountId,
      chapter_id: chapterId,
      sentence_id: sid,
      read_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('account_campaign_progress')
      .upsert(rows, { onConflict: 'account_id,sentence_id', ignoreDuplicates: true });

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[campaign/progress]', err);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
