'use client';

import { ReactNode, Suspense, useState } from 'react';
import { usePathname } from 'next/navigation';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '@/lib/data/client';
import { AuthProvider, AuthStateProvider } from '@/features/auth';
import { ToastProvider } from '@/features/ui/contexts/ToastContext';
import { ProfileProvider } from '@/features/profiles/contexts/ProfileContext';
import { WindowManagerProvider } from '@/components/ui/WindowManager';
import { AppModalProvider } from '@/contexts/AppModalContext';
import { BillingEntitlementsProvider } from '@/contexts/BillingEntitlementsContext';
import { AdminImpersonationProvider } from '@/contexts/AdminImpersonationContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
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

function ConditionalMapboxPreloader() {
  const pathname = usePathname();
  const isAdminPage = pathname?.startsWith('/admin');
  
  if (isAdminPage) {
    return null;
  }
  
  return <MapboxPreloader />;
}

export function Providers({ children, initialAuth }: ProvidersProps) {
  // Create QueryClient instance (singleton pattern)
  // useState ensures only one instance is created per app lifecycle
  const [queryClient] = useState(() => createQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <StripeProvider>
          <AuthProvider>
            <AuthStateProvider initialAuth={initialAuth}>
              <AdminImpersonationProvider>
                <ProfileProvider>
                  <ToastProvider>
                    <GlobalErrorHandler />
                    <ConditionalMapboxPreloader />
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
      </ThemeProvider>
    </QueryClientProvider>
  );
}



