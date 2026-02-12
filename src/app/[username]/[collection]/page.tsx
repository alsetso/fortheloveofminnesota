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

  // Fetch pins from public.map_pins by account_id and collection_id
  let pinsQuery = supabase
    .from('map_pins')
    .select(
      `
      id, lat, lng, description, visibility, city_id, collection_id, mention_type_id, map_id,
      image_url, video_url, media_type, view_count, created_at, updated_at,
      collections (id, emoji, title),
      mention_types (id, emoji, name)
    `
    )
    .eq('account_id', accountData.id)
    .eq('collection_id', selectedCollection.id)
    .eq('archived', false)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (!isOwnProfile) {
    pinsQuery = pinsQuery.eq('visibility', 'public');
  }

  const { data: pinsData } = await pinsQuery;

  const mentions: ProfilePin[] = (pinsData && Array.isArray(pinsData) ? pinsData : []).map((row: any) => ({
    id: row.id,
    lat: row.lat,
    lng: row.lng,
    description: row.description ?? null,
    collection_id: row.collection_id ?? null,
    collection: row.collections
      ? { id: row.collections.id, emoji: row.collections.emoji ?? '📍', title: row.collections.title }
      : null,
    mention_type: row.mention_types
      ? { id: row.mention_types.id, emoji: row.mention_types.emoji ?? '', name: row.mention_types.name ?? '' }
      : null,
    visibility: (row.visibility ?? 'public') as PinVisibility,
    image_url: row.image_url ?? null,
    video_url: row.video_url ?? null,
    media_type: (row.media_type ?? 'none') as 'image' | 'video' | 'none',
    view_count: row.view_count ?? 0,
    likes_count: 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
    map_id: row.map_id ?? undefined,
    map: undefined,
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
