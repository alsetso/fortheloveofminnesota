import { requireAdminAccess } from '@/lib/adminHelpers';
import SimpleNav from '@/components/layout/SimpleNav';
import BillingAdminClient from './BillingAdminClient';

export default async function BillingAdminPage() {
  await requireAdminAccess();
  
  return (
    <>
      <SimpleNav />
      <BillingAdminClient />
    </>
  );
}
