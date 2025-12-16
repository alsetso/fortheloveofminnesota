import { requireAdminAccess } from '@/lib/adminHelpers';
import AdminClient from './AdminClient';

export default async function AdminPage() {
  await requireAdminAccess();

  return <AdminClient />;
}
