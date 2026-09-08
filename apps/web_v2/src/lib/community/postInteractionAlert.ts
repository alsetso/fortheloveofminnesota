import { createServiceRoleClient } from '@/lib/supabase/server';
import { postPath } from '@/lib/routes/routePolicy';

export type PostInteractionKind = 'like' | 'comment';

type Actor = {
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  image_url?: string | null;
};

function actorLabel(actor: Actor | null | undefined): string {
  const username = actor?.username?.trim();
  if (username) return `@${username}`;
  const name = [actor?.first_name, actor?.last_name].filter(Boolean).join(' ').trim();
  if (name) return name;
  return 'Someone';
}

/**
 * Notify a post author when someone likes or comments.
 * Writes `platform.alerts` via service role (no INSERT RLS for callers).
 * Never throws — interaction routes must still succeed if alerting fails.
 */
export async function notifyPostInteraction(params: {
  kind: PostInteractionKind;
  postId: string;
  recipientAccountId: string;
  actorAccountId: string;
  actor?: Actor | null;
  /** Comment body preview; ignored for likes. */
  commentBody?: string | null;
  /** Stable id for comment dedupe (`comment:{id}`). Required for comments. */
  commentId?: string | null;
}): Promise<void> {
  const {
    kind,
    postId,
    recipientAccountId,
    actorAccountId,
    actor,
    commentBody,
    commentId,
  } = params;

  if (!recipientAccountId || recipientAccountId === actorAccountId) return;

  const display = actorLabel(actor);
  const preview =
    kind === 'comment' && commentBody
      ? commentBody.length > 160
        ? `${commentBody.slice(0, 160)}…`
        : commentBody
      : null;

  const title = kind === 'like' ? 'New like' : 'New comment';
  const message =
    kind === 'like'
      ? `${display} liked your post`
      : preview
        ? `${display}: ${preview}`
        : `${display} commented on your post`;

  const dedupe_key =
    kind === 'like'
      ? `like:${postId}:${actorAccountId}`
      : commentId
        ? `comment:${commentId}`
        : `comment:${postId}:${actorAccountId}:${Date.now()}`;

  try {
    const platform = createServiceRoleClient('platform');
    const { error } = await platform.from('alerts').insert({
      account_id: recipientAccountId,
      dedupe_key,
      title,
      message,
      image_url: actor?.image_url ?? null,
      action_url: postPath(postId),
      action_label: 'View',
      group_key: kind === 'like' ? `post_likes:${postId}` : `post_comments:${postId}`,
      metadata: {
        post_id: postId,
        target_id: postId,
        target_type: 'post',
        actor_account_id: actorAccountId,
        actor_username: actor?.username ?? undefined,
        kind,
        ...(commentId ? { comment_id: commentId } : {}),
      },
    });

    // Unique dedupe_key — repeat like after unlike, or double-submit.
    if (error && error.code !== '23505') {
      console.error('[postInteractionAlert]', error);
    }
  } catch (e) {
    console.error('[postInteractionAlert]', e);
  }
}
