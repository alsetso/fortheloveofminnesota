import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import PostDetailClient from '@/features/posts/components/PostDetailClient';
import NewPageWrapper from '@/components/layout/NewPageWrapper';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
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
    .eq('id', id)
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

export default async function PostPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createServerClientWithAuth();

  // Check if user is authenticated first to determine visibility filter
  const { data: { user } } = await supabase.auth.getUser();
  let accountId: string | null = null;

  if (user) {
    const { data: accountData } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', user.id)
      .single();
    
    if (accountData) {
      accountId = accountData.id;
    }
  }

  // Build query with visibility filter
  let query = supabase
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
    .eq('id', id);

  // For anonymous users, only show public posts
  // For authenticated users, show public posts and their own posts (including drafts)
  if (!accountId) {
    query = query.eq('visibility', 'public');
  } else {
    query = query.or(`visibility.eq.public,account_id.eq.${accountId}`);
  }

  const { data: post, error } = await query.single();

  if (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[PostPage] Error fetching post:', error);
    }
    notFound();
  }

  if (!post) {
    notFound();
  }

  const postData = post as any;

  // If post has a map, redirect to map-specific route
  if (postData.map_id && postData.map) {
    if (postData.map.slug) {
      redirect(`/map/${postData.map.slug}/post/${id}`);
    } else if (postData.map.id) {
      redirect(`/map/${postData.map.id}/post/${id}`);
    }
  }

  // Check if user owns this post
  const isOwner = accountId !== null && postData.account_id === accountId;

  // Check visibility (should already be filtered, but double-check)
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

  return (
    <NewPageWrapper>
      <PostDetailClient post={postData as any} isOwner={isOwner} useNewWrapper={true} />
    </NewPageWrapper>
  );
}
