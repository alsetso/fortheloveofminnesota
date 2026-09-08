import type { createServiceRoleClient } from '@/lib/supabase/server';

type ServiceDb = ReturnType<typeof createServiceRoleClient>;

/**
 * Asset counts shown before account deletion.
 */
export type AccountDeletePreview = {
  username: string | null;
  profileViews: number;
  postCount: number;
  pinCount: number;
  pinLocationCount: number;
  communityViews: number;
  communityLikes: number;
  communityComments: number;
  followersCount: number;
  followingCount: number;
  pageCount: number;
  pageViews: number;
  collectionCount: number;
  totalRecordedViews: number;
};

export async function fetchAccountDeletePreview(
  db: ServiceDb,
  accountId: string,
  username: string | null,
): Promise<AccountDeletePreview> {
  const [
    accountRes,
    communityRes,
    fwersRes,
    fwingRes,
    pageAggRes,
    collectionsRes,
  ] = await Promise.all([
    db.from('accounts').select('view_count').eq('id', accountId).maybeSingle(),
    db
      .schema('community')
      .from('posts')
      .select('id, kind, view_count, like_count, comment_count')
      .eq('account_id', accountId)
      .eq('is_active', true)
      .eq('archived', false),
    db
      .schema('community')
      .from('connections')
      .select('id')
      .eq('to_account_id', accountId)
      .eq('relationship', 'follow')
      .eq('status', 'accepted'),
    db
      .schema('community')
      .from('connections')
      .select('id')
      .eq('from_account_id', accountId)
      .eq('relationship', 'follow')
      .eq('status', 'accepted'),
    db.schema('page').from('pages').select('view_count').eq('owner_id', accountId).is('entity_id', null),
    db
      .schema('archive')
      .from('collections')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', accountId),
  ]);

  type CommunityRow = {
    id: string;
    kind: string;
    view_count: number;
    like_count: number;
    comment_count: number;
  };

  const communityRows = (communityRes.data ?? []) as CommunityRow[];
  const geoRows = communityRows.filter((r) => r.kind === 'post');
  const postRows = communityRows.filter((r) => r.kind === 'post');

  const sumViews = (rows: CommunityRow[]) =>
    rows.reduce((s, r) => s + (r.view_count ?? 0), 0);
  const sumLikes = (rows: CommunityRow[]) =>
    rows.reduce((s, r) => s + (r.like_count ?? 0), 0);
  const sumComments = (rows: CommunityRow[]) =>
    rows.reduce((s, r) => s + (r.comment_count ?? 0), 0);

  const pageRows = (pageAggRes.data ?? []) as { view_count: number }[];
  const profileViews = accountRes.data?.view_count ?? 0;
  const communityViews = sumViews(communityRows);
  const pageViews = pageRows.reduce((s, r) => s + (r.view_count ?? 0), 0);

  return {
    username,
    profileViews,
    postCount: postRows.length,
    pinCount: geoRows.length,
    pinLocationCount: geoRows.length,
    communityViews,
    communityLikes: sumLikes(communityRows),
    communityComments: sumComments(communityRows),
    followersCount: (fwersRes.data ?? []).length,
    followingCount: (fwingRes.data ?? []).length,
    pageCount: pageRows.length,
    pageViews,
    collectionCount: collectionsRes.count ?? 0,
    totalRecordedViews: profileViews + communityViews + pageViews,
  };
}

export function normalizeUsernameConfirm(input: string): string {
  return input.trim().replace(/^@/, '').toLowerCase();
}
