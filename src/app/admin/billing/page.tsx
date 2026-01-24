import { requireAdminAccess } from '@/lib/adminHelpers';
import BillingAdminClient from './BillingAdminClient';

export default async function BillingAdminPage() {
  await requireAdminAccess();
  
  return <BillingAdminClient />;
}
