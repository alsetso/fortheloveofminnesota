import { NextResponse } from 'next/server';
import { createSupabaseServerClient, createServiceRoleClient } from '@/lib/supabase/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import type { CampaignChapter, CampaignSentence, CampaignChapterWithProgress, CampaignSentenceStyle } from '@/features/campaign/campaignTypes';

export const dynamic = 'force-dynamic';

/**
 * GET /api/campaign/chapters
 * Returns all published chapters with gate evaluation for the current user
 * + which sentences they have already read.
 */
export async function GET() {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createSupabaseServerClient();
    const service = createServiceRoleClient();

    // Fetch published chapters + sentences in one go (service bypasses RLS for fast read)
    const [chaptersRes, progressRes, levelRes, presenceRes, sessionsRes] = await Promise.all([
      service
        .from('campaign_chapters')
        .select('id, chapter_num, title, subtitle, level_required, territories_required, collections_required, sessions_required, home_required, published')
        .eq('published', true)
        .order('sort_order', { ascending: true }),
      supabase
        .from('account_campaign_progress')
        .select('sentence_id')
        .eq('account_id', session.accountId),
      supabase
        .from('account_level_state')
        .select('level')
        .eq('account_id', session.accountId)
        .maybeSingle(),
      supabase
        .from('account_territory_presence')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', session.accountId),
      supabase
        .from('account_world_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', session.accountId),
    ]);

    if (chaptersRes.error) throw chaptersRes.error;

    const chapterIds = (chaptersRes.data ?? []).map((c) => c.id as number);
    const sentencesRes = chapterIds.length > 0
      ? await service
          .from('campaign_sentences')
          .select('id, chapter_id, sort_order, style, content')
          .in('chapter_id', chapterIds)
          .order('sort_order', { ascending: true })
      : { data: [], error: null };

    if (sentencesRes.error) throw sentencesRes.error;

    // Build lookup maps
    const readIds = new Set<number>(
      (progressRes.data ?? []).map((r) => r.sentence_id as number),
    );
    const sentencesByChapter = new Map<number, CampaignSentence[]>();
    for (const row of sentencesRes.data ?? []) {
      const chId = row.chapter_id as number;
      if (!sentencesByChapter.has(chId)) sentencesByChapter.set(chId, []);
      sentencesByChapter.get(chId)!.push({
        id: row.id as number,
        chapterId: chId,
        sortOrder: row.sort_order as number,
        style: (row.style as CampaignSentenceStyle) ?? 'body',
        content: (row.content as string | null) ?? null,
      });
    }

    // User state
    const userLevel = (levelRes.data as { level?: number } | null)?.level ?? 1;
    const territoriesCount = presenceRes.count ?? 0;
    const sessionsCount = sessionsRes.count ?? 0;

    // Does the user have a home territory? accounts.home_set_at is set when home is confirmed.
    const homeAcctRes = await supabase
      .from('accounts')
      .select('home_set_at')
      .eq('id', session.accountId)
      .maybeSingle();
    const hasHome = !!(homeAcctRes.data as { home_set_at?: string | null } | null)?.home_set_at;

    // Build response
    const chapters: CampaignChapterWithProgress[] = (chaptersRes.data ?? []).map((row) => {
      const ch: CampaignChapter = {
        id: row.id as number,
        chapterNum: row.chapter_num as number,
        title: row.title as string,
        subtitle: (row.subtitle as string | null) ?? null,
        levelRequired: row.level_required as number,
        territoriesRequired: row.territories_required as number,
        collectionsRequired: row.collections_required as number,
        sessionsRequired: row.sessions_required as number,
        homeRequired: row.home_required as boolean,
        published: row.published as boolean,
        sentences: sentencesByChapter.get(row.id as number) ?? [],
      };

      // Evaluate gate
      const levelOk = userLevel >= ch.levelRequired;
      const terrOk = territoriesCount >= ch.territoriesRequired;
      const sessOk = sessionsCount >= ch.sessionsRequired;
      const homeOk = !ch.homeRequired || hasHome;
      const unlocked = levelOk && terrOk && sessOk && homeOk;

      // Build lock hint (first failing gate wins)
      let lockHint: string | null = null;
      if (!levelOk) lockHint = `Reach Level ${ch.levelRequired} to unlock`;
      else if (!homeOk) lockHint = 'Set your home territory to unlock';
      else if (!terrOk) lockHint = `Unlock ${ch.territoriesRequired} territories to unlock`;
      else if (!sessOk) lockHint = `Play ${ch.sessionsRequired} sessions to unlock`;

      // Find next unread sentence index (skip spacers)
      const readable = ch.sentences.filter((s) => s.style !== 'spacer');
      const nextReadable = readable.findIndex((s) => !readIds.has(s.id));
      const allRead = nextReadable === -1;

      // Map back to full sentence index
      let nextSentenceIndex = 0;
      if (!allRead && nextReadable >= 0) {
        const targetId = readable[nextReadable]!.id;
        nextSentenceIndex = ch.sentences.findIndex((s) => s.id === targetId);
      } else if (allRead) {
        nextSentenceIndex = ch.sentences.length;
      }

      return {
        ...ch,
        unlocked,
        lockHint,
        nextSentenceIndex,
        complete: allRead,
      };
    });

    return NextResponse.json({ chapters });
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[campaign/chapters]', err);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
