import { requireAdminAccess } from '@/lib/adminHelpers';
import NewsGeneratePageClient from './NewsGeneratePageClient';

/**
 * Admin-only page for generating news articles
 * Non-admins will be redirected to home page
 */
export default async function NewsGeneratePage() {
  await requireAdminAccess();

  return <NewsGeneratePageClient />;
}
