import NewPageWrapper from '@/components/layout/NewPageWrapper';
import DocsLeftSidebar from '@/components/docs/DocsLeftSidebar';
import DocsContent from '@/components/docs/DocsContent';

interface DocsSlugPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Documentation page by slug — canonical path /docs/[slug]
 */
export default async function DocsSlugPage({ params }: DocsSlugPageProps) {
  const { slug } = await params;
  return (
    <NewPageWrapper
      leftSidebar={<DocsLeftSidebar currentSlug={slug} />}
    >
      <DocsContent slug={slug} />
    </NewPageWrapper>
  );
}
