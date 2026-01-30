import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import PageWrapper from '@/components/layout/PageWrapper';
import MapSearchInput from '@/components/layout/MapSearchInput';
import SearchResults from '@/components/layout/SearchResults';
import MentionDetailClient from '@/features/mentions/components/MentionDetailClient';
import MentionDetailGate from './MentionDetailGate';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createServerClientWithAuth();

  const { data: mention } = await supabase
    .from('map_pins')
    .select(`
      id,
      description,
      image_url,
      full_address,
      accounts (
        username,
        first_name
      )
    `)
    .eq('id', id)
    .eq('visibility', 'public')
    .eq('is_active', true)
    .eq('archived', false)
    .single();

  if (!mention) {
    return {
      title: 'Mention Not Found - Love of Minnesota',
      description: 'This mention could not be found.',
    };
  }

  const mentionData = mention as unknown as {
    id: string;
    description: string | null;
    image_url: string | null;
    full_address: string | null;
    accounts: { username: string | null; first_name: string | null } | null;
  };

  const accountName = mentionData.accounts?.first_name || mentionData.accounts?.username || 'Someone';
  const description = mentionData.description 
    ? `${accountName}: "${mentionData.description}"`
    : `Check out ${accountName}'s mention on Love of Minnesota`;

  return {
    title: `${accountName}'s Mention - Love of Minnesota`,
    description: description.slice(0, 160),
    openGraph: {
      title: `${accountName}'s Mention - Love of Minnesota`,
      description: description.slice(0, 160),
      images: mentionData.image_url ? [mentionData.image_url] : ['/seo_share_public_image.png'],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${accountName}'s Mention - Love of Minnesota`,
      description: description.slice(0, 160),
      images: mentionData.image_url ? [mentionData.image_url] : ['/seo_share_public_image.png'],
    },
  };
}

export default async function MentionPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createServerClientWithAuth();

  // Fetch mention with all details (now map_pins)
  const { data: mention, error } = await supabase
    .from('map_pins')
    .select(`
      id,
      lat,
      lng,
      map_id,
      description,
      visibility,
      archived,
      image_url,
      video_url,
      media_type,
      full_address,
      view_count,
      created_at,
      updated_at,
      post_date,
      city_id,
      county_id,
      tagged_account_ids,
      map_meta,
      account_id,
      map:map (
        id,
        name,
        slug
      ),
      accounts (
        id,
        username,
        first_name,
        image_url,
        account_taggable
      ),
      mention_type:mention_types (
        id,
        emoji,
        name
      )
    `)
    .eq('id', id)
    .eq('archived', false)
    .eq('is_active', true)
    .single();

  if (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[MentionPage] Error fetching mention:', error);
    }
    notFound();
  }

  if (!mention) {
    notFound();
  }

  const mentionData = mention as any;
  
  // Transform mention_type relationship (Supabase returns it as an object when using alias)
  // Since we're using mention_type:mention_types(...), it should already be an object, not an array
  if (mentionData.mention_type && Array.isArray(mentionData.mention_type)) {
    // If it's an array (legacy format), take the first item
    mentionData.mention_type = mentionData.mention_type.length > 0 ? mentionData.mention_type[0] : null;
  } else if (!mentionData.mention_type) {
    // If mention_type is missing, set it to null
    mentionData.mention_type = null;
  }
  
  // Clean up any legacy mention_types array if it exists
  if (mentionData.mention_types) {
    delete mentionData.mention_types;
  }
  
  // Collection data is not fetched due to RLS restrictions for anonymous users
  // Set collection to null - it can be fetched separately if needed
  mentionData.collection = null;

  // Transform map relationship
  if (mentionData.map && Array.isArray(mentionData.map)) {
    mentionData.map = mentionData.map.length > 0 ? mentionData.map[0] : null;
  } else if (!mentionData.map) {
    mentionData.map = null;
  }

  // Resolve tagged accounts
  const rawTagged = mentionData.tagged_account_ids;
  const taggedIdsList = Array.isArray(rawTagged)
    ? (rawTagged as unknown[]).filter((id): id is string => typeof id === 'string' && id.length > 0)
    : [];
  let tagged_accounts: { id: string; username: string | null }[] | null = null;
  if (taggedIdsList.length > 0) {
    const { data: taggedRows } = await supabase
      .from('accounts')
      .select('id, username')
      .in('id', taggedIdsList);
    tagged_accounts =
      (taggedRows || []).map((r: { id: string; username: string | null }) => ({
        id: r.id,
        username: r.username ?? null,
      })) as { id: string; username: string | null }[];
    if (tagged_accounts.length === 0) tagged_accounts = null;
  }
  mentionData.tagged_accounts = tagged_accounts;

  // Resolve city and county names
  let cityName: string | null = null;
  let countyName: string | null = null;
  if (mentionData.city_id) {
    const { data: cityData } = await supabase
      .from('cities')
      .select('name')
      .eq('id', mentionData.city_id)
      .maybeSingle();
    cityName = cityData && typeof cityData === 'object' && 'name' in cityData 
      ? (cityData as { name: string }).name 
      : null;
  }
  if (mentionData.county_id) {
    const { data: countyData } = await supabase
      .from('counties')
      .select('name')
      .eq('id', mentionData.county_id)
      .maybeSingle();
    countyName = countyData && typeof countyData === 'object' && 'name' in countyData
      ? (countyData as { name: string }).name
      : null;
  }
  mentionData.city_name = cityName;
  mentionData.county_name = countyName;
  
  // Debug: Log the transformed data
  if (process.env.NODE_ENV === 'development') {
    console.log('[MentionPage] Transformed mention data:', {
      id: mentionData.id,
      mention_type: mentionData.mention_type,
      collection: mentionData.collection,
      has_mention_type: !!mentionData.mention_type,
      has_collection: !!mentionData.collection,
      tagged_accounts: mentionData.tagged_accounts?.length || 0,
      city_name: mentionData.city_name,
      county_name: mentionData.county_name,
    });
  }

  // Check if user is authenticated and owns this mention
  const { data: { user } } = await supabase.auth.getUser();
  let isOwner = false;

  if (user && mentionData.account_id) {
    const { data: accountData } = await supabase
      .from('accounts')
      .select('user_id')
      .eq('id', mentionData.account_id)
      .single();

    const accountInfo = accountData as { user_id: string } | null;
    if (accountInfo?.user_id === user.id) {
      isOwner = true;
    }
  }

  // Check visibility
  if (mentionData.visibility === 'only_me' && !isOwner) {
    notFound();
  }

  // Check authentication - require sign-in for viewing mentions
  const isAuthenticated = Boolean(user);

  return (
    <PageWrapper
      searchComponent={<MapSearchInput onLocationSelect={() => {}} />}
      searchResultsComponent={<SearchResults />}
    >
      {isAuthenticated ? (
        <MentionDetailClient mention={mentionData as any} isOwner={isOwner} />
      ) : (
        <MentionDetailGate mention={mentionData as any} />
      )}
    </PageWrapper>
  );
}
