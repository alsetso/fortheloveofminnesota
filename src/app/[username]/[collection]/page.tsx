import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import type { ProfileAccount, ProfilePin, PinVisibility } from '@/types/profile';
import type { Collection } from '@/types/collection';
import { collectionTitleToSlug } from '@/features/collections/collectionSlug';
import { getDisplayName } from '@/types/profile';
import PageViewTracker from '@/components/analytics/PageViewTracker';
import CollectionPageClient from './CollectionPageClient';
import UsernamePageShell from '../UsernamePageShell';
import { UserIcon } from '@heroicons/react/24/outline';

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
    map?: { id: string; name: string | null; slug: string | null } | null;
  }
  let mentionsData: MapPinRow[] | null = null;
  if (profileMapIds.length > 0) {
    // Build query - show all pins for owner, only public for visitors
    let query = supabase
      .from('map_pins')
      .select(`
        id, lat, lng, description, visibility, city_id, collection_id, mention_type_id, map_id,
        image_url, video_url, media_type, view_count, created_at, updated_at,
        collections (id, emoji, title),
        mention_type:mention_types (id, emoji, name),
        map:map (id, name, slug)
      `)
      .eq('account_id', accountData.id)
      .eq('collection_id', selectedCollection.id)
      .in('map_id', profileMapIds)
      .eq('archived', false)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    
    // Only filter by visibility for non-owners
    if (!isOwnProfile) {
      query = query.eq('visibility', 'public');
    }
    
    const { data } = await query;
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
    map: mention.map ? { id: mention.map.id, name: mention.map.name || null, slug: mention.map.slug } : undefined,
  }));

  const displayName = getDisplayName(profileAccountData);

  return (
    <>
      <PageViewTracker page_url={`/${encodeURIComponent(username)}/${encodeURIComponent(collectionSlug)}`} />
      <UsernamePageShell isOwnProfile={isOwnProfile} showViewAsSelector={isOwnProfile}>
        <div className="flex-1 flex flex-col gap-6 px-4 sm:px-6 lg:px-8 py-6 max-w-[600px] mx-auto w-full">
          {/* Account Header - Simple */}
          <div className="flex items-center gap-2">
            <Link 
              href={`/${encodeURIComponent(username)}`}
              className="flex items-center gap-2 min-w-0 hover:opacity-80 transition-opacity"
            >
              <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center border border-gray-200 flex-shrink-0">
                {accountData.image_url ? (
                  <Image
                    src={accountData.image_url}
                    alt={displayName}
                    width={32}
                    height={32}
                    className="w-full h-full object-cover"
                    unoptimized={accountData.image_url.startsWith('data:') || accountData.image_url.includes('supabase.co')}
                  />
                ) : (
                  <UserIcon className="w-5 h-5 text-gray-500" />
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold text-gray-900 truncate">
                  {displayName}
                </span>
                {accountData.username && (
                  <span className="text-xs text-gray-500 truncate">
                    @{accountData.username}
                  </span>
                )}
              </div>
            </Link>
          </div>

          {/* Collections Container */}
          <div className="space-y-6">
            <CollectionPageClient
              collection={selectedCollection}
              username={username}
              isOwnProfile={isOwnProfile}
              pins={mentions}
              accountId={accountData.id}
              accountUsername={accountData.username}
              accountImageUrl={accountData.image_url}
              collections={collections}
            />
          </div>
        </div>
      </UsernamePageShell>
    </>
  );
}
