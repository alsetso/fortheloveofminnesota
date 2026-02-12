import NewPageWrapper from '@/components/layout/NewPageWrapper';
import AdCenterLeftSidebar from '@/components/ad-center/AdCenterLeftSidebar';
import AdCenterRightSidebar from '@/components/ad-center/AdCenterRightSidebar';
import AdCenterContent from '@/components/ad-center/AdCenterContent';

/**
 * Ad Center page - Manage advertisements for Love of Minnesota
 */
export default function AdCenterPage() {
  return (
    <NewPageWrapper
      leftSidebar={<AdCenterLeftSidebar />}
      rightSidebar={<AdCenterRightSidebar />}
    >
      <AdCenterContent />
    </NewPageWrapper>
  );
}
