import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import MentionDetailClient from '@/features/mentions/components/MentionDetailClient';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createServerClientWithAuth();

  const { data: mention } = await supabase
    .from('mentions')
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
      images: mentionData.image_url ? [mentionData.image_url] : [],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${accountName}'s Mention - Love of Minnesota`,
      description: description.slice(0, 160),
      images: mentionData.image_url ? [mentionData.image_url] : [],
    },
  };
}

export default async function MentionPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createServerClientWithAuth();

  // Fetch mention with all details
  const { data: mention, error } = await supabase
    .from('mentions')
    .select(`
      id,
      lat,
      lng,
      description,
      visibility,
      image_url,
      video_url,
      media_type,
      full_address,
      view_count,
      created_at,
      updated_at,
      account_id,
      user_id,
      accounts (
        id,
        username,
        first_name,
        image_url
      )
    `)
    .eq('id', id)
    .single();

  if (error || !mention) {
    notFound();
  }

  const mentionData = mention as unknown as {
    id: string;
    lat: number;
    lng: number;
    description: string | null;
    visibility: string;
    image_url: string | null;
    video_url: string | null;
    media_type: string | null;
    full_address: string | null;
    view_count: number | null;
    created_at: string;
    updated_at: string;
    account_id: string | null;
    user_id: string | null;
    accounts: { id: string; username: string | null; first_name: string | null; image_url: string | null } | null;
  };

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

  return <MentionDetailClient mention={mentionData as any} isOwner={isOwner} />;
}
