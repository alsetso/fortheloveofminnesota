import { requireAdminAccess } from '@/lib/adminHelpers';
import EmailsAdminClient from './EmailsAdminClient';

export default async function EmailsAdminPage() {
  await requireAdminAccess();

  return <EmailsAdminClient />;
}
