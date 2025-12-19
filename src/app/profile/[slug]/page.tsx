import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { notFound } from 'next/navigation';
import ProfileMapClient from '@/components/profile/ProfileMapClient';
import { Metadata } from 'next';
import type { ProfileAccount, ProfilePin } from '@/types/profile';

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
    description: `View ${displayName}'s pins on MNUDA - For the Love of Minnesota`,
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


  // Fetch the account's public pins (and private if own profile)
  const pinsQuery = supabase
    .from('pins')
    .select(`
      id,
      lat,
      lng,
      description,
      media_url,
      visibility,
      view_count,
      created_at,
      updated_at
    `)
    .eq('account_id', accountData.id)
    .eq('archived', false) // Exclude archived pins
    .order('created_at', { ascending: false });

  // If viewing own profile, include private pins; otherwise only public
  if (!isOwnProfile) {
    pinsQuery.eq('visibility', 'public');
  }

  const { data: rawPins } = await pinsQuery;

  // Transform pins
  const pins: ProfilePin[] = (rawPins || []).map((pin: any) => ({
    id: pin.id,
    lat: pin.lat,
    lng: pin.lng,
    description: pin.description,
    media_url: pin.media_url,
    visibility: pin.visibility,
    view_count: pin.view_count,
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
    <ProfileMapClient 
      account={profileAccountData}
      pins={pins || []}
      isOwnProfile={isOwnProfile}
    />
  );
}


