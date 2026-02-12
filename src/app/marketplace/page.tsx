import NewPageWrapper from '@/components/layout/NewPageWrapper';
import MarketplaceLeftSidebar from '@/components/marketplace/MarketplaceLeftSidebar';
import MarketplaceContent from '@/components/marketplace/MarketplaceContent';

/**
 * Marketplace page - Buy and sell items in Minnesota
 */
export default function MarketplacePage() {
  return (
    <NewPageWrapper
      leftSidebar={<MarketplaceLeftSidebar />}
    >
      <MarketplaceContent />
    </NewPageWrapper>
  );
}
