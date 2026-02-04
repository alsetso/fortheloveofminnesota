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
import MapboxPreloader from '@/components/utils/MapboxPreloader';

interface ProvidersProps {
  children: ReactNode;
  /** Initial auth data from server - passed to AuthStateProvider to skip client-side fetch */
  initialAuth?: {
    userId: string | null;
    accountId: string | null;
  } | null;
}

export function Providers({ children, initialAuth }: ProvidersProps) {
  return (
    <StripeProvider>
      <AuthProvider>
        <AuthStateProvider initialAuth={initialAuth}>
          <AdminImpersonationProvider>
            <ProfileProvider>
              <ToastProvider>
                <GlobalErrorHandler />
                <MapboxPreloader />
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



