import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import GroupPageClient from './GroupPageClient';
import { Group } from '@/types/group';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createServerClientWithAuth();
  
  const { data: group } = await supabase
    .from('groups')
    .select('name, description')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (!group) {
    return {
      title: 'Group Not Found',
    };
  }

  return {
    title: group.name,
    description: group.description || `Join ${group.name} on Love of Minnesota`,
  };
}

export default async function GroupPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createServerClientWithAuth();

  // Fetch group data directly from Supabase
  const { data: group, error } = await supabase
    .from('groups')
    .select(`
      id,
      name,
      slug,
      description,
      cover_image_url,
      image_url,
      visibility,
      is_active,
      created_by_account_id,
      member_count,
      post_count,
      created_at,
      updated_at,
      created_by:accounts!groups_created_by_account_id_fkey(
        id,
        username,
        first_name,
        last_name,
        image_url
      )
    `)
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (error || !group) {
    notFound();
  }

  // Check membership and admin status
  const { data: { user } } = await supabase.auth.getUser();
  let accountId: string | null = null;
  
  if (user) {
    const { data: account } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', user.id)
      .single();
    accountId = account?.id || null;
  }

  if (accountId) {
    const { data: membership } = await supabase
      .from('group_members')
      .select('is_admin')
      .eq('group_id', group.id)
      .eq('account_id', accountId)
      .maybeSingle();

    (group as any).is_member = !!membership;
    (group as any).is_admin = membership?.is_admin || false;
  } else {
    (group as any).is_member = false;
    (group as any).is_admin = false;
  }

  return <GroupPageClient initialGroup={group as Group} />;
}
