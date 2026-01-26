import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { notFound } from 'next/navigation';
import ProfileLayout from '@/features/profiles/components/ProfileLayout';
import { Metadata } from 'next';
import type { ProfileAccount, ProfilePin } from '@/types/profile';
import type { Collection } from '@/types/collection';
import PageViewTracker from '@/components/analytics/PageViewTracker';
import ProfileMentionsList from '@/features/profiles/components/ProfileMentionsList';
import Link from 'next/link';
import { MapIcon } from '@heroicons/react/24/outline';
import PageWrapper from '@/components/layout/PageWrapper';

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
    title: `${displayName}`,
    description: `View ${displayName}'s profile - For the Love of Minnesota`,
  };
}

export default async function ProfilePage({ params }: Props) {
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
    .select(`
      id, 
      lat, 
      lng, 
      description, 
      visibility, 
      city_id, 
      collection_id, 
      mention_type_id,
      image_url, 
      video_url, 
      media_type, 
      view_count,
      created_at, 
      updated_at,
      collections (
        id,
        emoji,
        title
      ),
      mention_type:mention_types (
        id,
        emoji,
        name
      )
    `)
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

  // Fetch likes counts for all mentions
  const mentionIds = (mentionsData || []).map((m: any) => m.id);
  let likesCounts = new Map<string, number>();
  
    if (mentionIds.length > 0) {
    const { data: likesData } = await supabase
      .from('map_pins_likes')
      .select('map_pin_id')
      .in('map_pin_id', mentionIds);
    
    if (likesData) {
      likesData.forEach((like: { map_pin_id: string }) => {
        const current = likesCounts.get(like.map_pin_id) || 0;
        likesCounts.set(like.map_pin_id, current + 1);
      });
    }
  }

  const mentions: ProfilePin[] = (mentionsData || []).map((mention: any) => ({
    id: mention.id,
    lat: mention.lat,
    lng: mention.lng,
    description: mention.description,
    collection_id: mention.collection_id,
    collection: mention.collections ? {
      id: mention.collections.id,
      emoji: mention.collections.emoji,
      title: mention.collections.title,
    } : null,
    mention_type: mention.mention_type ? {
      id: mention.mention_type.id,
      emoji: mention.mention_type.emoji,
      name: mention.mention_type.name,
    } : null,
    visibility: mention.visibility || 'public',
    image_url: mention.image_url || null,
    video_url: mention.video_url || null,
    media_type: mention.media_type || 'none',
    view_count: mention.view_count || 0,
    likes_count: likesCounts.get(mention.id) || 0,
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
      <PageViewTracker page_url={`/profile/${slug}`} />
      <PageWrapper>
        <ProfileLayout account={profileAccountData} isOwnProfile={isOwnProfile}>
          {/* Main Content Area */}
          <div className="space-y-6">
            {/* Profile Header - Inline */}
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
              <Link
                href={`/profile/${slug}/map`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                <MapIcon className="w-5 h-5" />
                View Map
              </Link>
            </div>

            {/* Mentions List Section */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Mentions</h2>
              </div>
              <ProfileMentionsList
                pins={mentions}
                isOwnProfile={isOwnProfile}
              />
            </div>
          </div>
        </ProfileLayout>
      </PageWrapper>
    </>
  );
}
