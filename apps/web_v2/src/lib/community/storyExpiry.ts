/**
 * Story TTL — live for 24h, then archived (owner can restore).
 */

import type { createSupabaseServerClient } from '@/lib/supabase/server';

export const STORY_TTL_MS = 24 * 60 * 60 * 1000;

export type PostContentShape = 'standard' | 'story' | string | null | undefined;

export function isStoryShape(shape: PostContentShape): boolean {
  return shape === 'story';
}

export function storyExpiresAt(from: Date = new Date()): string {
  return new Date(from.getTime() + STORY_TTL_MS).toISOString();
}

export function isStoryExpired(input: {
  content_shape?: PostContentShape;
  expires_at?: string | null;
  now?: Date;
}): boolean {
  if (!input.expires_at) return false;
  // Any row with expires_at past due is treated as expired (stories set this).
  if (input.content_shape != null && !isStoryShape(input.content_shape)) {
    return false;
  }
  const exp = Date.parse(input.expires_at);
  if (!Number.isFinite(exp)) return false;
  return exp <= (input.now ?? new Date()).getTime();
}

export function postTypeLabel(shape: PostContentShape): 'Story' | 'Post' {
  return isStoryShape(shape) ? 'Story' : 'Post';
}

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type ExpiredRow = {
  id: string;
};

/**
 * Archive live posts past expires_at for one account (lazy sweep on activity load).
 * The live map hides archived pins; no separate location join.
 */
export async function archiveExpiredStoriesForAccount(
  supabase: ServerClient,
  accountId: string,
): Promise<void> {
  const nowIso = new Date().toISOString();

  const { data: expired, error: fetchErr } = await supabase
    .schema('community')
    .from('posts')
    .select('id')
    .eq('account_id', accountId)
    .eq('archived', false)
    .eq('is_active', true)
    .not('expires_at', 'is', null)
    .lt('expires_at', nowIso);

  if (fetchErr) {
    console.error('[storyExpiry] fetch expired', fetchErr);
    return;
  }

  const rows = (expired ?? []) as ExpiredRow[];
  if (rows.length === 0) return;

  const ids = rows.map((r) => String(r.id));
  const { error: archiveErr } = await supabase
    .schema('community')
    .from('posts')
    .update({ archived: true, updated_at: nowIso })
    .in('id', ids)
    .eq('account_id', accountId);

  if (archiveErr) {
    console.error('[storyExpiry] archive expired', archiveErr);
  }
}
