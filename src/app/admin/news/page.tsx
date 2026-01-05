import { requireAdminAccess } from '@/lib/adminHelpers';
import SimplePageLayout from '@/components/layout/SimplePageLayout';
import NewsAdminClient from '@/features/admin/components/NewsAdminClient';

export default async function NewsAdminPage() {
  await requireAdminAccess();

  return (
    <SimplePageLayout contentPadding="px-[10px] py-3">
      <div className="max-w-7xl mx-auto">
        <div className="mb-3">
          <h1 className="text-sm font-semibold text-gray-900">Generate News</h1>
          <p className="text-xs text-gray-600 mt-0.5">
            Generate news articles for Minnesota
          </p>
        </div>
        <NewsAdminClient />
      </div>
    </SimplePageLayout>
  );
}

