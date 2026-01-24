'use client';

import { ReactNode, Suspense } from 'react';
import { AuthProvider, AuthStateProvider } from '@/features/auth';
import { ToastProvider } from '@/features/ui/contexts/ToastContext';
import { ProfileProvider } from '@/features/profiles/contexts/ProfileContext';
import { WindowManagerProvider } from '@/components/ui/WindowManager';
import { AppModalProvider } from '@/contexts/AppModalContext';
import { BillingEntitlementsProvider } from '@/contexts/BillingEntitlementsContext';
import { AdminImpersonationProvider } from '@/contexts/AdminImpersonationContext';
import { StripeProvider } from './StripeProvider';
import { GlobalErrorHandler } from '@/components/utils/GlobalErrorHandler';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <StripeProvider>
      <AuthProvider>
        <AuthStateProvider>
          <AdminImpersonationProvider>
            <ProfileProvider>
              <ToastProvider>
                <GlobalErrorHandler />
                <WindowManagerProvider>
                  <Suspense fallback={null}>
                    <AppModalProvider>
                      <BillingEntitlementsProvider>
                        {children}
                      </BillingEntitlementsProvider>
                    </AppModalProvider>
                  </Suspense>
                </WindowManagerProvider>
              </ToastProvider>
            </ProfileProvider>
          </AdminImpersonationProvider>
        </AuthStateProvider>
      </AuthProvider>
    </StripeProvider>
  );
}



