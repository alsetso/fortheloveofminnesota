'use client';

import { usePathname } from 'next/navigation';
import NewPageWrapper from '@/components/layout/NewPageWrapper';
import SettingsLeftSidebar from '@/components/settings/SettingsLeftSidebar';
import SettingsRightSidebar from '@/components/settings/SettingsRightSidebar';
import { SettingsProvider } from '@/features/settings/contexts/SettingsContext';
import type { ProfileAccount } from '@/types/profile';

interface SettingsPageWrapperProps {
  account: ProfileAccount;
  userEmail: string;
  /** Map limit from accounts.plan (hobby=1, contributor=5). */
  mapLimit: number;
  children: React.ReactNode;
}

export default function SettingsPageWrapper({ account, userEmail, mapLimit, children }: SettingsPageWrapperProps) {
  const pathname = usePathname();
  const isMainSettings = pathname === '/settings';

  return (
    <SettingsProvider account={account} userEmail={userEmail} mapLimit={mapLimit}>
      <NewPageWrapper
        leftSidebar={<SettingsLeftSidebar />}
        rightSidebar={isMainSettings ? <SettingsRightSidebar /> : undefined}
      >
        <div className="max-w-2xl mx-auto w-full px-4 py-6">
          {isMainSettings ? (
            <div className="text-center py-12">
              <h1 className="text-2xl font-bold text-foreground mb-2">Settings</h1>
              <p className="text-sm text-foreground-muted">
                Use the sidebar to navigate to different settings sections
              </p>
            </div>
          ) : (
            <div className="space-y-3">{children}</div>
          )}
        </div>
      </NewPageWrapper>
    </SettingsProvider>
  );
}
