import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import NewPageWrapper from '@/components/layout/NewPageWrapper';
import LeftSidebar from '@/components/layout/LeftSidebar';
import RightSidebar from '@/components/layout/RightSidebar';
import MentionDetailClient from '@/features/mentions/components/MentionDetailClient';
import MentionDetailGate from './MentionDetailGate';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createServerClientWithAuth();

  const { data: mention } = await supabase
    .from('map_pins')
    .select(`
      id,
      description,
      image_url,
      full_address,
      accounts:account_id (
        username,
        first_name
      )
    `)
    .eq('id', id)
    .eq('visibility', 'public')
    .eq('is_active', true)
    .eq('archived', false)
    .single();

  if (!mention) {
    return {
      title: 'Mention Not Found - Love of Minnesota',
      description: 'This mention could not be found.',
    };
  }

  const mentionData = mention as unknown as {
    id: string;
    description: string | null;
    image_url: string | null;
    full_address: string | null;
    accounts: { username: string | null; first_name: string | null } | null;
  };

  const accountName = mentionData.accounts?.first_name || mentionData.accounts?.username || 'Someone';
  const description = mentionData.description 
    ? `${accountName}: "${mentionData.description}"`
    : `Check out ${accountName}'s mention on Love of Minnesota`;

  return {
    title: `${accountName}'s Mention - Love of Minnesota`,
    description: description.slice(0, 160),
    openGraph: {
      title: `${accountName}'s Mention - Love of Minnesota`,
      description: description.slice(0, 160),
      images: mentionData.image_url ? [mentionData.image_url] : ['/seo_share_public_image.png'],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${accountName}'s Mention - Love of Minnesota`,
      description: description.slice(0, 160),
      images: mentionData.image_url ? [mentionData.image_url] : ['/seo_share_public_image.png'],
    },
  };
}

export default async function MentionPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createServerClientWithAuth();

  // Fetch pin + account + mention_type in a single query from public.map_pins
  const { data: { user } } = await supabase.auth.getUser();

  const { data: mention, error } = await supabase
    .from('map_pins')
    .select(`
      id, lat, lng, description,
      visibility, archived, image_url, video_url, media_type,
      full_address, view_count, created_at, updated_at, post_date,
      tagged_account_ids, map_meta, account_id,
      accounts:account_id (
        id, username, first_name, image_url, account_taggable, user_id
      ),
      mention_type:mention_type_id (
        id, emoji, name
      )
    `)
    .eq('id', id)
    .eq('archived', false)
    .eq('is_active', true)
    .single();

  if (error || !mention) {
    notFound();
  }

  const mentionData = mention as any;

  // Page view count (detail page only); map view count is mentionData.view_count
  const { data: pageViewCount } = await (supabase as any).rpc('get_mention_page_view_count', {
    p_mention_id: id,
  });
  mentionData.pin_view_count = mentionData.view_count ?? 0;
  mentionData.page_view_count = typeof pageViewCount === 'number' ? pageViewCount : 0;

  // Ownership: compare auth user_id with the account's user_id (already fetched)
  const accountUserId = mentionData.accounts?.user_id ?? null;
  const isOwner = Boolean(user && accountUserId && user.id === accountUserId);

  // Visibility gate
  if (mentionData.visibility === 'only_me' && !isOwner) {
    notFound();
  }

  // Strip user_id from accounts before passing to client (not needed, avoid leaking)
  if (mentionData.accounts) {
    delete mentionData.accounts.user_id;
  }

  // Normalize mention_type (array → object if needed)
  if (Array.isArray(mentionData.mention_type)) {
    mentionData.mention_type = mentionData.mention_type[0] ?? null;
  }

  // Resolve tagged accounts (one extra query only if tags exist)
  const rawTagged = mentionData.tagged_account_ids;
  const taggedIdsList = Array.isArray(rawTagged)
    ? (rawTagged as unknown[]).filter((tid): tid is string => typeof tid === 'string' && tid.length > 0)
    : [];
  if (taggedIdsList.length > 0) {
    const { data: taggedRows } = await supabase
      .from('accounts')
      .select('id, username')
      .in('id', taggedIdsList);
    mentionData.tagged_accounts = (taggedRows || []).length > 0 ? taggedRows : null;
  } else {
    mentionData.tagged_accounts = null;
  }

  mentionData.collection = null;
  mentionData.map = null;

  const isAuthenticated = Boolean(user);

  return (
    <NewPageWrapper
      leftSidebar={<LeftSidebar />}
      rightSidebar={<RightSidebar />}
    >
      <div className="w-full max-w-[600px] mx-auto py-3 px-2">
        {isAuthenticated ? (
          <MentionDetailClient mention={mentionData as any} isOwner={isOwner} />
        ) : (
          <MentionDetailGate mention={mentionData as any} />
        )}
      </div>
    </NewPageWrapper>
  );
}
