'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import SchoolCommunityPage from '@/components/school/SchoolCommunityPage';
import PageViewTracker from '@/components/analytics/PageViewTracker';

function SchoolPageInner() {
  const params = useParams();
  const slug = params?.slug as string;

  return (
    <>
      <PageViewTracker />
      <SchoolCommunityPage slug={slug} />
    </>
  );
}

export default function SchoolPage() {
  return (
    <Suspense>
      <SchoolPageInner />
    </Suspense>
  );
}
