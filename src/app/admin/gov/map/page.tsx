import { requireAdminAccess } from '@/lib/adminHelpers';
import GovMapAdminClient from '@/features/admin/components/GovMapAdminClient';

export default async function GovMapAdminPage() {
  await requireAdminAccess();

  return <GovMapAdminClient />;
}

