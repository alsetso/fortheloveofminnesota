import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import PostDetailClient from '@/features/posts/components/PostDetailClient';

interface Props {
  params: Promise<{ id: string; postId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { postId } = await params;
  const supabase = await createServerClientWithAuth();

  const { data: post } = await supabase
    .schema('content')
    .from('posts')
    .select(`
      id,
      title,
      content,
      visibility,
      map_id,
      account:accounts!posts_account_id_fkey(
        username,
        first_name
      )
    `)
    .eq('id', postId)
    .eq('visibility', 'public')
    .single();

  if (!post) {
    return {
      title: 'Post Not Found - Love of Minnesota',
      description: 'This post could not be found.',
    };
  }

  const postData = post as unknown as {
    id: string;
    title: string | null;
    content: string;
    map_id: string | null;
    account: { username: string | null; first_name: string | null } | null;
  };

  const accountName = postData.account?.first_name || postData.account?.username || 'Someone';
  const description = postData.title 
    ? `${accountName}: "${postData.title}"`
    : postData.content
    ? `${accountName}: "${postData.content.slice(0, 100)}${postData.content.length > 100 ? '...' : ''}"`
    : `Check out ${accountName}'s post on Love of Minnesota`;

  return {
    title: `${accountName}'s Post - Love of Minnesota`,
    description: description.slice(0, 160),
    openGraph: {
      title: `${accountName}'s Post - Love of Minnesota`,
      description: description.slice(0, 160),
      images: [
        {
          url: '/seo_share_public_image.png',
          width: 1200,
          height: 630,
          type: 'image/png',
          alt: `${accountName}'s Post`,
        },
      ],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${accountName}'s Post - Love of Minnesota`,
      description: description.slice(0, 160),
      images: ['/seo_share_public_image.png'],
    },
  };
}

export default async function MapPostPage({ params }: Props) {
  const { id: mapIdOrSlug, postId } = await params;
  const supabase = await createServerClientWithAuth();

  // Verify map exists and get map ID
  const { data: mapData } = await supabase
    .schema('maps')
    .from('maps')
    .select('id, slug')
    .or(`id.eq.${mapIdOrSlug},slug.eq.${mapIdOrSlug}`)
    .eq('is_active', true)
    .single();

  if (!mapData || typeof mapData !== 'object' || !('id' in mapData)) {
    notFound();
  }

  const typedMapData = mapData as { id: string; slug: string };

  // Fetch post with all details
  const { data: post, error } = await supabase
    .schema('content')
    .from('posts')
    .select(`
      id,
      account_id,
      title,
      content,
      visibility,
      mention_type_id,
      mention_ids,
      map_id,
      images,
      map_data,
      view_count,
      created_at,
      updated_at,
      account:accounts!posts_account_id_fkey(
        id,
        username,
        first_name,
        last_name,
        image_url,
        plan
      ),
      map:map!posts_map_id_fkey(
        id,
        name,
        slug,
        visibility
      ),
      mention_type:mention_types(
        id,
        emoji,
        name
      )
    `)
    .eq('id', postId)
    .single();

  if (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[MapPostPage] Error fetching post:', error);
    }
    notFound();
  }

  if (!post) {
    notFound();
  }

  const postData = post as any;

  // Verify post belongs to this map
  if (postData.map_id !== typedMapData.id) {
    // Redirect to correct map route if post belongs to a different map
    if (postData.map?.slug) {
      redirect(`/map/${postData.map.slug}/post/${postId}`);
    } else if (postData.map?.id) {
      redirect(`/map/${postData.map.id}/post/${postId}`);
    } else {
      // Fallback to old route if no map association
      redirect(`/post/${postId}`);
    }
  }

  // Check if user is authenticated and owns this post
  const { data: { user } } = await supabase.auth.getUser();
  let isOwner = false;

  if (user && postData.account_id) {
    const { data: accountData } = await supabase
      .from('accounts')
      .select('user_id')
      .eq('id', postData.account_id)
      .single();

    const accountInfo = accountData as { user_id: string } | null;
    if (accountInfo?.user_id === user.id) {
      isOwner = true;
    }
  }

  // Check visibility
  if (postData.visibility === 'draft' && !isOwner) {
    notFound();
  }

  // Fetch mentions if referenced
  if (postData.mention_ids && Array.isArray(postData.mention_ids) && postData.mention_ids.length > 0) {
    const { data: mentions } = await supabase
      .schema('maps')
      .from('pins')
      .select(`
        id,
        lat,
        lng,
        description,
        image_url,
        account_id,
        created_at,
        mention_type:mention_types(
          emoji,
          name
        ),
        collection:collections(
          emoji,
          title
        )
            `)
            .in('id', postData.mention_ids)
            .eq('is_active', true)
            .eq('archived', false);

    postData.mentions = mentions || [];
  } else {
    postData.mentions = [];
  }

  return <PostDetailClient post={postData as any} isOwner={isOwner} mapId={typedMapData.id} mapSlug={typedMapData.slug} />;
}
