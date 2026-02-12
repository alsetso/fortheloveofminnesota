import NewPageWrapper from '@/components/layout/NewPageWrapper';
import PagesLeftSidebar from '@/components/pages/PagesLeftSidebar';
import PagesList from '@/components/pages/PagesList';

/**
 * Pages list page - Browse all pages
 * Route: /pages
 */
export default function PagesPage() {
  return (
    <NewPageWrapper
      leftSidebar={<PagesLeftSidebar />}
    >
      <PagesList />
    </NewPageWrapper>
  );
}
