/**
 * Server component wrapper that fetches auth + billing once
 * and passes to PageWrapper and children
 */

import { ReactNode } from 'react';
import { getAuthAndBilling } from '@/lib/server/getAuthAndBilling';
import PageWrapper from './PageWrapper';

interface PageWrapperWithAuthProps {
  children: ReactNode;
  headerContent?: ReactNode;
  searchComponent?: ReactNode;
  showAccountDropdown?: boolean;
  accountDropdownProps?: {
    onAccountClick?: () => void;
    onSignInClick?: () => void;
  };
  searchResultsComponent?: ReactNode;
  className?: string;
  trackPageView?: boolean;
  viewAsRole?: 'owner' | 'manager' | 'editor' | 'non-member';
  mapSettings?: {
    colors?: {
      owner?: string;
      manager?: string;
      editor?: string;
      'non-member'?: string;
    };
  } | null;
}

/**
 * Server component that fetches auth + billing once
 * and provides initial data to client components
 */
export default async function PageWrapperWithAuth(props: PageWrapperWithAuthProps) {
  // Fetch auth + billing in one call (cached per request)
  const { auth, billing } = await getAuthAndBilling();

  return (
    <PageWrapper
      {...props}
      initialAuth={auth}
      initialBilling={billing}
    />
  );
}
