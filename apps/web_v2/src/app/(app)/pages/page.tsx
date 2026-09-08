import { Suspense } from 'react';
import PagesPage from '@/features/pages/PagesPage';
import SplashScreen from '@/features/welcome/splash/SplashScreen';

/**
 * /pages — account-owned directory pages (sidebar → My Pages).
 * Suspense: PagesPage reads `intent=advertise` via useSearchParams.
 */
export default function PagesRoutePage() {
  return (
    <Suspense fallback={<SplashScreen status="Loading…" />}>
      <PagesPage />
    </Suspense>
  );
}
