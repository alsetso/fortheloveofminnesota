'use client';

import { usePathname } from 'next/navigation';
import SimplePageLayout from '@/components/SimplePageLayout';
import AccountPageLayout from '@/components/AccountPageLayout';

interface AccountLayoutWrapperProps {
  children: React.ReactNode;
}

/**
 * Client wrapper to conditionally apply layouts based on pathname
 */
export default function AccountLayoutWrapper({ children }: AccountLayoutWrapperProps) {
  const pathname = usePathname();
  const isOnboardingPage = pathname === '/account/onboarding';
  
  // For onboarding page, let the nested layout handle everything (no nav, custom sidebar)
  if (isOnboardingPage) {
    return <>{children}</>;
  }

  return (
    <SimplePageLayout contentPadding="px-0" footerVariant="light" hideFooter={true}>
      <AccountPageLayout>
        {children}
      </AccountPageLayout>
    </SimplePageLayout>
  );
}



