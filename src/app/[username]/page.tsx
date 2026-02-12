import { createServerClientWithAuth, createServiceClient } from '@/lib/supabaseServer';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import type { ProfileAccount, ProfilePin } from '@/types/profile';
import type { Collection } from '@/types/collection';
import PageViewTracker from '@/components/analytics/PageViewTracker';
import ProfileViewContent from './ProfileViewContent';

export const dynamic = 'force-dynamic';

const RESERVED_USERNAMES = new Set([
  'live', 'settings', 'onboarding', 'map', 'maps', 'profile', 'analytics', 'billing', 'plans',
  'contact', 'contribute', 'download', 'login', 'signup', 'news', 'search', 'admin', 'api',
  'privacy', 'terms', 'gov', 'mention', 'not-found',
]);

type ViewAsMode = 'owner' | 'public';
const VIEW_AS_PUBLIC: ViewAsMode = 'public';

interface Props {
  params: Promise<{ username: string }>;
  searchParams?: Promise<{ view?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  if (RESERVED_USERNAMES.has(username.toLowerCase())) {
    return { title: 'Not Found' };
  }
  const supabase = await createServerClientWithAuth();
  const { data: account } = await supabase
    .from('accounts')
    .select('username, first_name, last_name')
    .eq('username', username)
    .single();

  if (!account) {
    return { title: 'Profile Not Found' };
  }

  const accountMeta = account as { username: string | null; first_name: string | null; last_name: string | null };
  const displayName = accountMeta.first_name
    ? `${accountMeta.first_name}${accountMeta.last_name ? ` ${accountMeta.last_name}` : ''}`
    : accountMeta.username || 'User';

  return {
    title: `${displayName}`,
    description: `View ${displayName}'s profile - For the Love of Minnesota`,
  };
}

export default async function UsernamePage({ params, searchParams }: Props) {
  const { username } = await params;
  const resolvedSearchParams = await searchParams;
  const view = (resolvedSearchParams?.view ?? 'owner') as ViewAsMode;
  const viewAsPublic = view === VIEW_AS_PUBLIC;

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
    traits: any;
    user_id: string;
    plan: string | null;
    created_at: string;
  };

  const { data: { user } } = await supabase.auth.getUser();
  const isOwnProfile = !!(user && accountData.user_id === user.id);
  const isAuthenticated = Boolean(user);
  const isViewingAsPublic = viewAsPublic || !isOwnProfile;

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

  // Fetch collections - owners see all, visitors see public ones with public pins
  const { data: collectionsData } = await supabase
    .from('collections')
    .select('*')
    .eq('account_id', accountData.id)
    .order('created_at', { ascending: false });
  const collections: Collection[] = (collectionsData || []) as Collection[];

  // Fetch pins from public.map_pins (profile source of truth)
  // Owners: all pins; public view: only visibility = 'public'
  const pinsQuery = supabase
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
    .eq('archived', false)
    .eq('is_active', true);

  if (isViewingAsPublic) {
    pinsQuery.eq('visibility', 'public');
  }

  const { data: pinsData, error: pinsError } = await pinsQuery.order('created_at', { ascending: false });

  if (pinsError && process.env.NODE_ENV === 'development') {
    console.error('[UsernamePage] Error fetching pins:', pinsError);
  }

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
    visibility: (row.visibility ?? 'public') as ProfilePin['visibility'],
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

  // Fetch city name if city_id exists (for profile card in left sidebar)
  let cityName: string | null = null;
  if (accountData.city_id) {
    try {
      const { data: cityData } = await (supabase as any)
        .schema('layers')
        .from('cities_and_towns')
        .select('feature_name')
        .eq('id', accountData.city_id)
        .single();
      
      if (cityData) {
        cityName = cityData.feature_name || null;
      }
    } catch (error) {
      // Silently fail - city name is optional
    }
  }

  // Single layout for both owner and visitor: left = profile card + collections + analytics/live map, center = map, right = sponsored + following
  // isOwnProfile drives what owner sees (e.g. analytics link, private pins, edit capabilities); showViewAsSelector lets owner preview as public
  return (
    <>
      <PageViewTracker page_url={`/${encodeURIComponent(username)}`} />
      <ProfileViewContent
        account={profileAccountData}
        pins={mentions}
        collections={collections}
        cityName={cityName}
        isOwnProfile={isOwnProfile && !isViewingAsPublic}
        isProfileOwner={isOwnProfile}
        isAuthenticated={isAuthenticated}
      />
    </>
  );
}
