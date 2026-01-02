import { Metadata } from 'next';
import SimplePageLayout from '@/components/layout/SimplePageLayout';
import { getServerAuth } from '@/lib/authServer';
import ContributeClient from './ContributeClient';

export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com';
  const url = `${baseUrl}/contribute`;
  const title = 'Contribute | For the Love of Minnesota';
  const description = 'Help improve Minnesota by contributing information, reviews, and updates.';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: 'For the Love of Minnesota',
      type: 'website',
    },
    alternates: {
      canonical: url,
    },
  };
}

export default async function ContributePage() {
  const auth = await getServerAuth();

  return (
    <SimplePageLayout contentPadding="px-[10px] py-3">
      <div className="max-w-4xl mx-auto">
        <ContributeClient auth={auth} />
      </div>
    </SimplePageLayout>
  );
}

