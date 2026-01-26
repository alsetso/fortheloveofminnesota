import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { notFound } from 'next/navigation';
import ProfilePageMapView from '@/features/profiles/components/ProfilePageMapView';
import { Metadata } from 'next';
import type { ProfileAccount, ProfilePin } from '@/types/profile';
import type { Collection } from '@/types/collection';
import PageViewTracker from '@/components/analytics/PageViewTracker';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createServerClientWithAuth();
  
  // Find account by username
  const { data: account } = await supabase
    .from('accounts')
    .select('username, first_name, last_name')
    .eq('username', slug)
    .single();

  if (!account) {
    return {
      title: 'Profile Not Found',
    };
  }

  const accountMeta = account as {
    username: string | null;
    first_name: string | null;
    last_name: string | null;
  };

  const displayName = accountMeta.first_name 
    ? `${accountMeta.first_name}${accountMeta.last_name ? ` ${accountMeta.last_name}` : ''}`
    : accountMeta.username || 'User';

  return {
    title: `${displayName} - Map`,
    description: `View ${displayName}'s map - For the Love of Minnesota`,
  };
}

export default async function ProfileMapPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createServerClientWithAuth();

  const accountFields = `
    id, 
    username, 
    first_name, 
    last_name, 
    email,
    phone,
    image_url, 
    cover_image_url,
    bio,
    city_id,
    view_count,
    traits,
    user_id,
    plan,
    created_at
  `;

  // Get the account by username
  const { data: account, error } = await supabase
    .from('accounts')
    .select(accountFields)
    .eq('username', slug)
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

  // Get the current authenticated user to check if this is their profile
  const { data: { user } } = await supabase.auth.getUser();
  
  let isOwnProfile = false;
  if (user && accountData.user_id === user.id) {
    isOwnProfile = true;
  }

  // Fetch collections for this account
  const { data: collectionsData } = await supabase
    .from('collections')
    .select('*')
    .eq('account_id', accountData.id)
    .order('created_at', { ascending: false });

  const collections: Collection[] = (collectionsData || []) as Collection[];

  // Get live map ID first
  const { data: liveMap } = await supabase
    .from('map')
    .select('id')
    .eq('slug', 'live')
    .eq('is_active', true)
    .single();

  // Fetch mentions for this account (now map_pins on live map)
  // For visitors, only show public mentions; for owners, show all non-archived mentions
  let mentionsQuery = supabase
    .from('map_pins')
    .select('id, lat, lng, description, visibility, city_id, collection_id, image_url, video_url, media_type, created_at, updated_at')
    .eq('map_id', liveMap?.id)
    .eq('account_id', accountData.id)
    .eq('archived', false)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  // If not owner, only show public mentions
  if (!isOwnProfile) {
    mentionsQuery = mentionsQuery.eq('visibility', 'public');
  }

  const { data: mentionsData } = await mentionsQuery;

  const mentions: ProfilePin[] = (mentionsData || []).map((mention: {
    id: string;
    lat: number;
    lng: number;
    description: string | null;
    visibility: 'public' | 'only_me';
    city_id: string | null;
    collection_id: string | null;
    image_url: string | null;
    video_url: string | null;
    media_type: 'image' | 'video' | 'none' | null;
    created_at: string;
    updated_at: string;
  }) => ({
    id: mention.id,
    lat: mention.lat,
    lng: mention.lng,
    description: mention.description,
    collection_id: mention.collection_id,
    visibility: mention.visibility || 'public',
    image_url: mention.image_url || null,
    video_url: mention.video_url || null,
    media_type: mention.media_type || 'none',
    created_at: mention.created_at,
    updated_at: mention.updated_at,
  }));

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

  return (
    <>
      <PageViewTracker page_url={`/profile/${slug}/map`} />
      <ProfilePageMapView
        account={profileAccountData}
        pins={mentions}
        collections={collections}
        isOwnProfile={isOwnProfile}
      />
    </>
  );
}
