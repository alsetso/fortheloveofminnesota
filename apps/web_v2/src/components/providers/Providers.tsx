'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AuthProvider } from '@/features/auth';
import AuthBootstrap from '@/features/welcome/boot/AuthBootstrap';
import SetupGate from '@/features/setup/SetupGate';
import { UserLocationProvider } from '@/map/location/UserLocationProvider';
import PolicyUpdateGate from '@/components/legal/PolicyUpdateGate';
import { ThemeApplicator } from '@/features/theme/ThemeApplicator';
import { ClientErrorOverlay } from '@/components/debug/ClientErrorOverlay';
import { DespiaIdentityProvider } from '@/components/providers/DespiaIdentityProvider';

export default function Providers({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // The public homepage must not mount the app's splash or account gates.
  if (pathname === '/') return <>{children}</>;

  return (
    <AuthProvider>
      <DespiaIdentityProvider>
        <UserLocationProvider autoStart={false}>
          <ClientErrorOverlay />
          <ThemeApplicator />
          <AuthBootstrap>
            <SetupGate />
            <PolicyUpdateGate />
            {children}
          </AuthBootstrap>
        </UserLocationProvider>
      </DespiaIdentityProvider>
    </AuthProvider>
  );
}
