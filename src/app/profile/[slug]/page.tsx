import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { notFound } from 'next/navigation';
import ProfileCard from '@/components/profile/ProfileCard';
import ProfilePinsList from '@/components/profile/ProfilePinsList';
import SimplePageLayout from '@/components/SimplePageLayout';
import { Metadata } from 'next';
import type { ProfileAccount } from '@/types/profile';
import type { MapPin } from '@/types/map-pin';

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
      title: 'Profile Not Found | MNUDA',
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
    title: `${displayName} | MNUDA`,
    description: `View ${displayName}'s profile on MNUDA - For the Love of Minnesota`,
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
    created_at: string;
  };

  // Get the current authenticated user to check if this is their profile
  const { data: { user } } = await supabase.auth.getUser();
  
  let isOwnProfile = false;
  if (user && accountData.user_id === user.id) {
    isOwnProfile = true;
  }

  // Fetch pins for this account
  // For visitors, only show public pins; for owners, show all non-archived pins
  let pinsQuery = supabase
    .from('pins')
    .select('id, lat, lng, description, visibility, created_at, updated_at')
    .eq('account_id', accountData.id)
    .eq('archived', false)
    .order('created_at', { ascending: false });

  // If not owner, only show public pins
  if (!isOwnProfile) {
    pinsQuery = pinsQuery.eq('visibility', 'public');
  }

  const { data: pinsData } = await pinsQuery;

  const pins: MapPin[] = (pinsData || []).map((pin: {
    id: string;
    lat: number;
    lng: number;
    description: string | null;
    visibility: 'public' | 'only_me';
    created_at: string;
    updated_at: string;
  }) => ({
    id: pin.id,
    lat: pin.lat,
    lng: pin.lng,
    description: pin.description,
    type: null,
    media_url: null,
    account_id: accountData.id,
    city_id: null,
    county_id: null,
    visibility: pin.visibility || 'public',
    created_at: pin.created_at,
    updated_at: pin.updated_at,
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
    created_at: accountData.created_at,
  };

  return (
    <SimplePageLayout contentPadding="px-[10px] py-3" footerVariant="light">
      <div className="max-w-2xl mx-auto space-y-3">
        <ProfileCard 
          account={profileAccountData}
          isOwnProfile={isOwnProfile}
        />
        {pins.length > 0 && (
          <ProfilePinsList pins={pins} isOwnProfile={isOwnProfile} />
        )}
      </div>
    </SimplePageLayout>
  );
}


