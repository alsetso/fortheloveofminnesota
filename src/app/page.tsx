'use client';

import { Suspense } from 'react';
import { BlockedRouteToast } from '@/components/system/BlockedRouteToast';
import NewPageWrapper from '@/components/layout/NewPageWrapper';
import LeftSidebar from '@/components/layout/LeftSidebar';
import RightSidebar from '@/components/layout/RightSidebar';
import LandingPage from '@/components/landing/LandingPage';

/**
 * Homepage - Landing-style inside NewPageWrapper. Primary CTA: /maps.
 */
export default function Home() {
  return (
    <>
      <Suspense fallback={null}>
        <BlockedRouteToast />
      </Suspense>
      <NewPageWrapper
        leftSidebar={<LeftSidebar />}
        rightSidebar={<RightSidebar />}
      >
        <LandingPage embedInNewPageWrapper />
      </NewPageWrapper>
    </>
  );
}