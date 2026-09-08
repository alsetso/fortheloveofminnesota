import DiscoverAtlasCollectionPage from '@/features/discover/DiscoverAtlasCollectionPage';

/** /discover/atlas/[slug] — features in one atlas feature set. */
export default async function DiscoverAtlasCollectionRoutePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <DiscoverAtlasCollectionPage slug={decodeURIComponent(slug)} />;
}
