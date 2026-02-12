import NewPageWrapper from '@/components/layout/NewPageWrapper';
import PagesLeftSidebar from '@/components/pages/PagesLeftSidebar';
import PagesRightSidebar from '@/components/pages/PagesRightSidebar';
import PagesList from '@/components/pages/PagesList';

/**
 * Pages list page - Browse all pages
 */
export default function PagesPage() {
  return (
    <NewPageWrapper
      leftSidebar={<PagesLeftSidebar />}
      rightSidebar={<PagesRightSidebar />}
    >
      <PagesList />
    </NewPageWrapper>
  );
}
