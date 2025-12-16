import { redirect } from 'next/navigation';
import SimplePageLayout from '@/components/SimplePageLayout';
import { getServerAuth } from '@/lib/authServer';
import AdsClient from './AdsClient';

export default async function AdsPage() {
  const auth = await getServerAuth();
  
  if (!auth) {
    redirect('/?modal=account&tab=settings&redirect=/ads&message=Please sign in to manage your campaigns');
  }

  return (
    <SimplePageLayout contentPadding="px-0" footerVariant="light" hideFooter>
      <div className="max-w-7xl mx-auto px-4 py-3">
        <AdsClient />
      </div>
    </SimplePageLayout>
  );
}


