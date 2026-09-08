import PostPage from '@/features/feed/PostPage';

/**
 * /post/:id — community post detail (pushed from Feed).
 */
export default async function PostRoutePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PostPage postId={id} />;
}
