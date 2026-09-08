import type { SupabaseClient } from '@supabase/supabase-js';

export type PrimaryInterest = {
  id: string;
  slug: string;
  name: string;
};

export function pinHeadline(
  kindName: string | null | undefined,
  interestName: string | null | undefined,
): string {
  const kind = kindName?.trim() || 'Pin';
  const topic = interestName?.trim();
  return topic ? `${kind} · ${topic}` : kind;
}

export async function assertCatalogInterest(
  supabase: SupabaseClient,
  id: string,
): Promise<PrimaryInterest> {
  const { data, error } = await supabase
    .from('interests')
    .select('id, slug, name, owner_account_id')
    .eq('id', id)
    .maybeSingle();
  if (error || !data || data.owner_account_id != null || !data.slug) {
    throw new Error('Pick a public topic.');
  }
  return { id: data.id, slug: String(data.slug), name: data.name };
}

export async function insertPrimaryInterest(
  supabase: SupabaseClient,
  postId: string,
  interestId: string,
): Promise<void> {
  const { error } = await supabase.schema('community').from('post_interests').insert({
    post_id: postId,
    interest_id: interestId,
    is_primary: true,
  });
  if (error) throw new Error('Could not save that topic.');
}

/** Replace the primary catalog interest on a post (or clear when null). */
export async function replacePrimaryInterest(
  supabase: SupabaseClient,
  postId: string,
  interestId: string | null,
): Promise<void> {
  const { error: delErr } = await supabase
    .schema('community')
    .from('post_interests')
    .delete()
    .eq('post_id', postId)
    .eq('is_primary', true);
  if (delErr) throw new Error('Could not update topic.');
  if (interestId) await insertPrimaryInterest(supabase, postId, interestId);
}
