import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import type { ProfileAccount, ProfilePin } from '@/types/profile';
import type { Collection } from '@/types/collection';
import PageViewTracker from '@/components/analytics/PageViewTracker';
import ProfileLayout from '@/features/profiles/components/ProfileLayout';
import ProfileMentionsList from '@/features/profiles/components/ProfileMentionsList';
import HomeDashboardContent from '@/features/homepage/components/HomeDashboardContent';
import UsernamePageShell from './UsernamePageShell';
import SignInGate from '@/components/auth/SignInGate';

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

  if (isOwnProfile && !viewAsPublic) {
    return (
      <>
        <PageViewTracker page_url={`/${encodeURIComponent(username)}`} />
        <UsernamePageShell isOwnProfile profileAccountData={profileAccountData} />
      </>
    );
  }

  // Public profile: either visitor or owner "viewing as" Public (profile pages removed; canonical is /:username)
  const { data: collectionsData } = await supabase
    .from('collections')
    .select('*')
    .eq('account_id', accountData.id)
    .order('created_at', { ascending: false });
  const collections: Collection[] = (collectionsData || []) as Collection[];

  // Always fetch public mentions for this account (even without auth)
  // For visitors, we'll show skeleton loaders that prompt signup
  const { data: mentionsData, error: mentionsError } = await supabase
    .from('map_pins')
    .select(`
      id, lat, lng, description, visibility, city_id, collection_id, mention_type_id, map_id,
      image_url, video_url, media_type, view_count, created_at, updated_at,
      collections (id, emoji, title),
      mention_type:mention_types (id, emoji, name),
      map:map (id, slug)
    `)
    .eq('account_id', accountData.id)
    .eq('archived', false)
    .eq('is_active', true)
    .eq('visibility', 'public')
    .order('created_at', { ascending: false });

  // Log error in development for debugging
  if (mentionsError && process.env.NODE_ENV === 'development') {
    console.error('[UsernamePage] Error fetching mentions:', mentionsError);
  }

  const mentionIds = (mentionsData || []).map((m: any) => m.id);
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

  // Handle case where mentionsData might be null or empty
  const mentions: ProfilePin[] = (mentionsData && Array.isArray(mentionsData) ? mentionsData : []).map((mention: any) => ({
    id: mention.id,
    lat: mention.lat,
    lng: mention.lng,
    description: mention.description,
    collection_id: mention.collection_id,
    collection: mention.collections ? { id: mention.collections.id, emoji: mention.collections.emoji, title: mention.collections.title } : null,
    mention_type: mention.mention_type ? { id: mention.mention_type.id, emoji: mention.mention_type.emoji, name: mention.mention_type.name } : null,
    visibility: mention.visibility || 'public',
    image_url: mention.image_url,
    video_url: mention.video_url,
    media_type: mention.media_type || 'none',
    view_count: mention.view_count || 0,
    likes_count: likesCounts.get(mention.id) || 0,
    created_at: mention.created_at,
    updated_at: mention.updated_at,
    map_id: mention.map_id,
    map: mention.map ? { id: mention.map.id, slug: mention.map.slug } : undefined,
  }));

  const publicContent = (
    <ProfileLayout account={profileAccountData} isOwnProfile={false}>
      <div className="space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-900">Mentions</h2>
          </div>
          <ProfileMentionsList pins={mentions} isOwnProfile={isOwnProfile} />
        </div>
        
        {/* Sign in prompt for non-authenticated visitors */}
        {!isAuthenticated && (
          <SignInGate
            title={`Sign in to view ${profileAccountData.username || profileAccountData.first_name || 'this user'}'s profile`}
            description={`See full mentions, like posts, and connect with ${profileAccountData.username || profileAccountData.first_name || 'the community'}.`}
            subtle={false}
          />
        )}
      </div>
    </ProfileLayout>
  );

  return (
    <>
      <PageViewTracker page_url={`/${encodeURIComponent(username)}`} />
      <UsernamePageShell showViewAsSelector={isOwnProfile && viewAsPublic}>
        {publicContent}
      </UsernamePageShell>
    </>
  );
}
