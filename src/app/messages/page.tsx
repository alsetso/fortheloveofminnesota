import { Metadata } from 'next';
import NewPageWrapper from '@/components/layout/NewPageWrapper';
import MessagesPageClient from './MessagesPageClient';
import PageViewTracker from '@/components/analytics/PageViewTracker';

export const metadata: Metadata = {
  title: 'Messages | For the Love of Minnesota',
  description: 'Your conversations and messages',
  robots: {
    index: false,
    follow: false,
  },
};

export default function MessagesPage() {
  return (
    <>
      <PageViewTracker />
      <NewPageWrapper>
        <MessagesPageClient />
      </NewPageWrapper>
    </>
  );
}
