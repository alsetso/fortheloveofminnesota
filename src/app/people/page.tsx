import { Suspense } from 'react';
import NewPageWrapper from '@/components/layout/NewPageWrapper';
import PeopleLeftSidebar from '@/components/people/PeopleLeftSidebar';
import PeopleRightSidebar from '@/components/people/PeopleRightSidebar';
import PeopleSearchClient from '@/components/people/PeopleSearchClient';

export default function PeoplePage() {
  return (
    <NewPageWrapper
      leftSidebar={
        <Suspense fallback={<div className="p-3"><div className="h-8 bg-surface-accent rounded animate-pulse" /></div>}>
          <PeopleLeftSidebar />
        </Suspense>
      }
      rightSidebar={<PeopleRightSidebar />}
    >
      <div className="w-full max-w-4xl mx-auto py-6 px-4">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-foreground mb-2">People</h1>
          <p className="text-sm text-foreground-muted">
            Search for people and connect with them
          </p>
        </div>
        <Suspense fallback={
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-foreground-muted border-t-transparent rounded-full animate-spin" />
          </div>
        }>
          <PeopleSearchClient />
        </Suspense>
      </div>
    </NewPageWrapper>
  );
}
