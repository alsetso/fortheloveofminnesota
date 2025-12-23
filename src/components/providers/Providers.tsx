'use client';

import { ReactNode, Suspense } from 'react';
import { AuthProvider, AuthStateProvider } from '@/features/auth';
import { ToastProvider } from '@/features/ui/contexts/ToastContext';
import { ProfileProvider } from '@/features/profiles/contexts/ProfileContext';
import { WindowManagerProvider } from '@/components/ui/WindowManager';
import { AppModalProvider } from '@/contexts/AppModalContext';
import { StripeProvider } from './StripeProvider';
import { DraftPOIsProvider } from '@/features/poi/contexts/DraftPOIsContext';
import { ActiveAccountProvider } from '@/features/account/contexts/ActiveAccountContext';
import PageLoadingOverlay from '@/features/feed/components/PageLoadingOverlay';
import MobileOverlay from '@/components/modals/MobileOverlay';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <StripeProvider>
      <AuthProvider>
        <AuthStateProvider>
          <ActiveAccountProvider>
            <ProfileProvider>
              <DraftPOIsProvider>
                <ToastProvider>
                  <WindowManagerProvider>
                    <Suspense fallback={null}>
                      <AppModalProvider>
                        <MobileOverlay />
                        <PageLoadingOverlay />
                        {children}
                      </AppModalProvider>
                    </Suspense>
                  </WindowManagerProvider>
                </ToastProvider>
              </DraftPOIsProvider>
            </ProfileProvider>
          </ActiveAccountProvider>
        </AuthStateProvider>
      </AuthProvider>
    </StripeProvider>
  );
}



