import { Suspense } from 'react';
import PublicProfilePage from '@/features/community/PublicProfilePage';

/**
 * /:username — sharable public account profile link for every account.
 */
export default function UsernameRoutePage() {
  return (
    <Suspense fallback={<div className="h-full min-h-0 bg-[#f7f5f1]" />}>
      <PublicProfilePage />
    </Suspense>
  );
}
