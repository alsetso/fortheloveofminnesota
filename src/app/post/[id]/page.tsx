import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import PostDetailClient from '@/features/posts/components/PostDetailClient';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createServerClientWithAuth();

  const { data: post } = await supabase
    .from('posts')
    .select(`
      id,
      title,
      content,
      visibility,
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
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title: `${accountName}'s Post - Love of Minnesota`,
      description: description.slice(0, 160),
    },
  };
}

export default async function PostPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createServerClientWithAuth();

  // Fetch post with all details
  const { data: post, error } = await supabase
    .from('posts')
    .select(`
      id,
      account_id,
      title,
      content,
      visibility,
      group_id,
      mention_type_id,
      mention_ids,
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
      mention_type:mention_types(
        id,
        emoji,
        name
      )
    `)
    .eq('id', id)
    .single();

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
      .from('mentions')
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
      .in('id', postData.mention_ids);

    postData.mentions = mentions || [];
  } else {
    postData.mentions = [];
  }

  return <PostDetailClient post={postData as any} isOwner={isOwner} />;
}
