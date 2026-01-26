'use client';

import PageWrapper from '@/components/layout/PageWrapper';
import MapSearchInput from '@/components/layout/MapSearchInput';
import SearchResults from '@/components/layout/SearchResults';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import SettingsPageClient from '@/features/settings/components/SettingsPageClient';
import type { ProfileAccount } from '@/types/profile';

interface SettingsPageWrapperProps {
  account: ProfileAccount;
  userEmail: string;
}

export default function SettingsPageWrapper({ account, userEmail }: SettingsPageWrapperProps) {
  const { openWelcome } = useAppModalContextSafe();

  return (
    <PageWrapper
      headerContent={null}
      searchComponent={
        <MapSearchInput
          onLocationSelect={() => {
            // Handle location selection if needed
          }}
        />
      }
      accountDropdownProps={{
        onAccountClick: () => {
          // Handle account click
        },
        onSignInClick: openWelcome,
      }}
      searchResultsComponent={<SearchResults />}
    >
      <SettingsPageClient account={account} userEmail={userEmail} />
    </PageWrapper>
  );
}
