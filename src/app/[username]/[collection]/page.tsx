import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import type { ProfileAccount, ProfilePin, PinVisibility } from '@/types/profile';
import type { Collection } from '@/types/collection';
import { collectionTitleToSlug } from '@/features/collections/collectionSlug';
import PageViewTracker from '@/components/analytics/PageViewTracker';
import ProfileLayout from '@/features/profiles/components/ProfileLayout';
import ProfileMentionsList from '@/features/profiles/components/ProfileMentionsList';
import CollectionPageHeader from './CollectionPageHeader';
import UsernamePageShell from '../UsernamePageShell';

export const dynamic = 'force-dynamic';

const RESERVED_USERNAMES = new Set([
  'live', 'settings', 'onboarding', 'map', 'maps', 'profile', 'analytics', 'billing', 'plans',
  'contact', 'contribute', 'download', 'login', 'signup', 'news', 'search', 'admin', 'api',
  'privacy', 'terms', 'gov', 'mention', 'not-found',
]);

interface Props {
  params: Promise<{ username: string; collection: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username, collection: collectionSlug } = await params;
  if (RESERVED_USERNAMES.has(username.toLowerCase())) {
    return { title: 'Not Found' };
  }
  const supabase = await createServerClientWithAuth();
  const { data: account } = await supabase
    .from('accounts')
    .select('id, username, first_name, last_name')
    .eq('username', username)
    .single();
  if (!account) return { title: 'Profile Not Found' };

  const { data: collectionsData } = await supabase
    .from('collections')
    .select('id, title')
    .eq('account_id', (account as { id: string }).id);
  const collectionsList: { id: string; title: string }[] = collectionsData ?? [];
  const match = collectionsList.find(
    (c) => collectionTitleToSlug(c.title) === decodeURIComponent(collectionSlug)
  );
  const displayName = match?.title ?? 'Collection';
  const accountMeta = account as { username: string | null; first_name: string | null; last_name: string | null };
  const userDisplay = accountMeta.first_name
    ? `${accountMeta.first_name}${accountMeta.last_name ? ` ${accountMeta.last_name}` : ''}`
    : accountMeta.username || 'User';

  return {
    title: `${displayName} · ${userDisplay}`,
    description: `View ${displayName} by ${userDisplay} - For the Love of Minnesota`,
  };
}

export default async function UsernameCollectionPage({ params }: Props) {
  const { username, collection: collectionSlug } = await params;

  if (RESERVED_USERNAMES.has(username.toLowerCase())) {
    notFound();
  }

  const supabase = await createServerClientWithAuth();
  const accountFields = `
    id, username, first_name, last_name, email, phone,
    image_url, cover_image_url, bio, city_id, view_count,
    traits, user_id, plan, created_at
  `;

  const { data: account, error } = await supabase
    .from('accounts')
    .select(accountFields)
    .eq('username', username)
    .single();

  if (error || !account) {
    notFound();
  }

  const accountData = account as {
    id: string;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    image_url: string | null;
    cover_image_url: string | null;
    bio: string | null;
    city_id: string | null;
    view_count: number | null;
    traits: string[] | null;
    user_id: string;
    plan: string | null;
    created_at: string;
  };

  const { data: collectionsData } = await supabase
    .from('collections')
    .select('*')
    .eq('account_id', accountData.id)
    .order('created_at', { ascending: false });
  const collections: Collection[] = (collectionsData || []) as Collection[];

  const slugDecoded = decodeURIComponent(collectionSlug);
  const selectedCollection = collections.find((c) => collectionTitleToSlug(c.title) === slugDecoded);
  if (!selectedCollection) {
    notFound();
  }

  const profileAccountData: ProfileAccount = {
    id: accountData.id,
    username: accountData.username,
    first_name: accountData.first_name,
    last_name: accountData.last_name,
    email: accountData.email,
    phone: accountData.phone,
    image_url: accountData.image_url,
    cover_image_url: accountData.cover_image_url,
    bio: accountData.bio,
    city_id: accountData.city_id,
    view_count: accountData.view_count || 0,
    traits: accountData.traits,
    user_id: accountData.user_id,
    plan: accountData.plan,
    created_at: accountData.created_at,
  };

  const { data: { user } } = await supabase.auth.getUser();
  const isOwnProfile = !!(user && accountData.user_id === user.id);

  const { data: ownedMaps } = await supabase
    .from('map')
    .select('id')
    .eq('account_id', accountData.id)
    .eq('is_active', true);
  const { data: memberRows } = await supabase
    .from('map_members')
    .select('map_id')
    .eq('account_id', accountData.id);
  const ownedIds = (ownedMaps || []).map((m: { id: string }) => m.id);
  const memberIds = (memberRows || []).map((m: { map_id: string }) => m.map_id);
  const profileMapIds = Array.from(new Set([...ownedIds, ...memberIds]));

  interface MapPinRow {
    id: string;
    lat: number;
    lng: number;
    description: string | null;
    visibility: string;
    collection_id: string | null;
    map_id: string;
    image_url: string | null;
    video_url: string | null;
    media_type: string;
    view_count: number | null;
    created_at: string;
    updated_at: string;
    collections?: { id: string; emoji: string; title: string } | null;
    mention_type?: { id: string; emoji: string; name: string } | null;
    map?: { id: string; slug: string | null } | null;
  }
  let mentionsData: MapPinRow[] | null = null;
  if (profileMapIds.length > 0) {
    const { data } = await supabase
      .from('map_pins')
      .select(`
        id, lat, lng, description, visibility, city_id, collection_id, mention_type_id, map_id,
        image_url, video_url, media_type, view_count, created_at, updated_at,
        collections (id, emoji, title),
        mention_type:mention_types (id, emoji, name),
        map:map (id, slug)
      `)
      .eq('account_id', accountData.id)
      .eq('collection_id', selectedCollection.id)
      .in('map_id', profileMapIds)
      .eq('archived', false)
      .eq('is_active', true)
      .eq('visibility', 'public')
      .order('created_at', { ascending: false });
    mentionsData = data as MapPinRow[] | null;
  }

  const mentionIds = (mentionsData || []).map((m) => m.id);
  const likesCounts = new Map<string, number>();
  if (mentionIds.length > 0) {
    const { data: likesData } = await supabase
      .from('map_pins_likes')
      .select('map_pin_id')
      .in('map_pin_id', mentionIds);
    likesData?.forEach((like: { map_pin_id: string }) => {
      likesCounts.set(like.map_pin_id, (likesCounts.get(like.map_pin_id) || 0) + 1);
    });
  }

  const mentions: ProfilePin[] = (mentionsData || []).map((mention: MapPinRow) => ({
    id: mention.id,
    lat: mention.lat,
    lng: mention.lng,
    description: mention.description,
    collection_id: mention.collection_id,
    collection: mention.collections ? { id: mention.collections.id, emoji: mention.collections.emoji, title: mention.collections.title } : null,
    mention_type: mention.mention_type ? { id: mention.mention_type.id, emoji: mention.mention_type.emoji, name: mention.mention_type.name } : null,
    visibility: (mention.visibility || 'public') as PinVisibility,
    image_url: mention.image_url,
    video_url: mention.video_url,
    media_type: (mention.media_type || 'none') as 'image' | 'video' | 'none',
    view_count: mention.view_count || 0,
    likes_count: likesCounts.get(mention.id) || 0,
    created_at: mention.created_at,
    updated_at: mention.updated_at,
    map_id: mention.map_id,
    map: mention.map ? { id: mention.map.id, slug: mention.map.slug } : undefined,
  }));

  return (
    <>
      <PageViewTracker page_url={`/${encodeURIComponent(username)}/${encodeURIComponent(collectionSlug)}`} />
      <UsernamePageShell>
        <ProfileLayout account={profileAccountData} isOwnProfile={isOwnProfile}>
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <CollectionPageHeader
                collection={selectedCollection}
                username={username}
                isOwnProfile={isOwnProfile}
              />
              <ProfileMentionsList pins={mentions} isOwnProfile={isOwnProfile} />
            </div>
          </div>
        </ProfileLayout>
      </UsernamePageShell>
    </>
  );
}
