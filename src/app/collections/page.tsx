import { Metadata } from 'next';
import NewPageWrapper from '@/components/layout/NewPageWrapper';
import CollectionsPageClient from './CollectionsPageClient';
import PageViewTracker from '@/components/analytics/PageViewTracker';

export const metadata: Metadata = {
  title: 'Collections | For the Love of Minnesota',
  description: 'Browse all collections',
};

export default function CollectionsPage() {
  return (
    <>
      <PageViewTracker />
      <NewPageWrapper>
        <CollectionsPageClient />
      </NewPageWrapper>
    </>
  );
}
