import { Suspense } from 'react';
import PeopleLayoutClient from '../PeopleLayoutClient';
import PeopleSearchClient from '@/components/people/PeopleSearchClient';

export default function PeopleUsersPage() {
  return (
    <PeopleLayoutClient>
      <div className="w-full max-w-4xl mx-auto py-6 px-4 space-y-3">
        <div className="mb-2">
          <h1 className="text-sm font-semibold text-gray-900">Active users</h1>
          <p className="text-xs text-gray-600">
            Search and browse people on the platform. View following and followers from the sidebar.
          </p>
        </div>
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-foreground-muted border-t-transparent rounded-full animate-spin" />
            </div>
          }
        >
          <PeopleSearchClient />
        </Suspense>
      </div>
    </PeopleLayoutClient>
  );
}
