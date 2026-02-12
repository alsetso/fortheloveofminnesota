import NewPageWrapper from '@/components/layout/NewPageWrapper';
import DocsLeftSidebar from '@/components/docs/DocsLeftSidebar';
import DocsContent from '@/components/docs/DocsContent';

/**
 * Documentation page - Help and guides for Love of Minnesota
 */
export default function DocsPage() {
  return (
    <NewPageWrapper
      leftSidebar={<DocsLeftSidebar />}
    >
      <DocsContent />
    </NewPageWrapper>
  );
}
