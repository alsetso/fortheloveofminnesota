'use client';

import { ReactNode, Suspense } from 'react';
import { AuthProvider, AuthStateProvider } from '@/features/auth';
import { ToastProvider } from '@/features/ui/contexts/ToastContext';
import { ProfileProvider } from '@/features/profiles/contexts/ProfileContext';
import { WindowManagerProvider } from '@/components/ui/WindowManager';
import { AppModalProvider } from '@/contexts/AppModalContext';
import PageLoadingOverlay from '@/components/feed/PageLoadingOverlay';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <AuthProvider>
      <AuthStateProvider>
        <ProfileProvider>
          <ToastProvider>
            <WindowManagerProvider>
              <Suspense fallback={null}>
                <AppModalProvider>
                  <PageLoadingOverlay />
                  {children}
                </AppModalProvider>
              </Suspense>
            </WindowManagerProvider>
          </ToastProvider>
        </ProfileProvider>
      </AuthStateProvider>
    </AuthProvider>
  );
}



