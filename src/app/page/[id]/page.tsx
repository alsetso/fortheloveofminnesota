import NewPageWrapper from '@/components/layout/NewPageWrapper';
import PageDetailLeftSidebar from '@/components/pages/PageDetailLeftSidebar';
import PageDetailRightSidebar from '@/components/pages/PageDetailRightSidebar';
import PageDetailContent from '@/components/pages/PageDetailContent';

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Page detail - Individual Notion-inspired page view
 * Supports both UUID and slug identifiers
 */
export default async function PageDetailPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <NewPageWrapper
      leftSidebar={<PageDetailLeftSidebar pageId={id} />}
      rightSidebar={<PageDetailRightSidebar pageId={id} />}
    >
      <PageDetailContent pageId={id} />
    </NewPageWrapper>
  );
}
