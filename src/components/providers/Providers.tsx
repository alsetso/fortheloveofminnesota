'use client';

import { ReactNode, Suspense } from 'react';
import { AuthProvider, AuthStateProvider } from '@/features/auth';
import { ToastProvider } from '@/features/ui/contexts/ToastContext';
import { ProfileProvider } from '@/features/profiles/contexts/ProfileContext';
import { WindowManagerProvider } from '@/components/ui/WindowManager';
import { AppModalProvider } from '@/contexts/AppModalContext';
import { StripeProvider } from './StripeProvider';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <StripeProvider>
      <AuthProvider>
        <AuthStateProvider>
          <ProfileProvider>
            <ToastProvider>
              <WindowManagerProvider>
                <Suspense fallback={null}>
                  <AppModalProvider>
                    {children}
                  </AppModalProvider>
                </Suspense>
              </WindowManagerProvider>
            </ToastProvider>
          </ProfileProvider>
        </AuthStateProvider>
      </AuthProvider>
    </StripeProvider>
  );
}



