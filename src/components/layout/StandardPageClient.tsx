'use client';

import PageWrapper from '@/components/layout/PageWrapper';
import MapSearchInput from '@/components/layout/MapSearchInput';
import SearchResults from '@/components/layout/SearchResults';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';

interface StandardPageClientProps {
  children: React.ReactNode;
  /** Optional custom content wrapper className. Default: 'h-full overflow-y-auto scrollbar-hide' */
  contentClassName?: string;
}

/**
 * Standard page client wrapper with default PageWrapper configuration.
 * 
 * Provides consistent PageWrapper setup with:
 * - Search component (MapSearchInput)
 * - Account dropdown with welcome modal
 * - Search results component
 * 
 * Use this for pages that need standard PageWrapper without custom header content.
 */
export default function StandardPageClient({ 
  children, 
  contentClassName = 'h-full overflow-y-auto scrollbar-hide' 
}: StandardPageClientProps) {
  const { openWelcome } = useAppModalContextSafe();

  return (
    <PageWrapper
      headerContent={null}
      searchComponent={<MapSearchInput onLocationSelect={() => {}} />}
      accountDropdownProps={{
        onAccountClick: () => {},
        onSignInClick: openWelcome,
      }}
      searchResultsComponent={<SearchResults />}
    >
      <div className={contentClassName}>
        {children}
      </div>
    </PageWrapper>
  );
}
