import { requireAdminAccess } from '@/lib/adminHelpers';
import DashboardClient from './DashboardClient';

export default async function AdminDashboardPage() {
  await requireAdminAccess();
  
  return <DashboardClient />;
}
