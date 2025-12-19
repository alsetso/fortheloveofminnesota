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

  const displayName = account.first_name 
    ? `${account.first_name}${account.last_name ? ` ${account.last_name}` : ''}`
    : account.username || 'User';

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

  // Get the current authenticated user to check if this is their profile
  const { data: { user } } = await supabase.auth.getUser();
  
  let isOwnProfile = false;
  if (user && account.user_id === user.id) {
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
    .eq('account_id', account.id)
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

  const accountData: ProfileAccount = {
    id: account.id,
    username: account.username,
    first_name: account.first_name,
    last_name: account.last_name,
    email: account.email,
    phone: account.phone,
    image_url: account.image_url,
    cover_image_url: account.cover_image_url,
    bio: account.bio,
    city_id: account.city_id,
    view_count: account.view_count || 0,
    traits: account.traits,
    user_id: account.user_id,
    created_at: account.created_at,
  };

  return (
    <ProfileMapClient 
      account={accountData}
      pins={pins || []}
      isOwnProfile={isOwnProfile}
    />
  );
}


