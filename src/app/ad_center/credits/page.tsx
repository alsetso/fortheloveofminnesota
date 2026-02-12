import NewPageWrapper from '@/components/layout/NewPageWrapper';
import AdCenterLeftSidebar from '@/components/ad-center/AdCenterLeftSidebar';
import AdCenterCreditsContent from '@/components/ad-center/AdCenterCreditsContent';

/**
 * Ad Credits page - Manage ad credits and billing
 */
export default function AdCreditsPage() {
  return (
    <NewPageWrapper
      leftSidebar={<AdCenterLeftSidebar />}
    >
      <AdCenterCreditsContent />
    </NewPageWrapper>
  );
}
