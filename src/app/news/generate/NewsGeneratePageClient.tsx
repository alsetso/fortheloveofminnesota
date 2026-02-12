'use client';

import NewPageWrapper from '@/components/layout/NewPageWrapper';
import LeftSidebar from '@/components/layout/LeftSidebar';
import RightSidebar from '@/components/layout/RightSidebar';
import NewsGenerateClient from './NewsGenerateClient';

export default function NewsGeneratePageClient() {
  return (
    <NewPageWrapper
      leftSidebar={<LeftSidebar />}
      rightSidebar={<RightSidebar />}
    >
      <div className="w-full py-6">
        <NewsGenerateClient />
      </div>
    </NewPageWrapper>
  );
}
