import { requireAdminAccess } from '@/lib/adminHelpers';
import SimplePageLayout from '@/components/layout/SimplePageLayout';
import AtlasTypesAdminClient from '@/features/admin/components/AtlasTypesAdminClient';

export default async function AtlasTypesAdminPage() {
  await requireAdminAccess();

  return (
    <SimplePageLayout contentPadding="px-[10px] py-3">
      <div className="max-w-7xl mx-auto">
        <div className="mb-3">
          <h1 className="text-sm font-semibold text-gray-900">Atlas Types</h1>
          <p className="text-xs text-gray-600 mt-0.5">
            Manage atlas entity types, icons, visibility, and status
          </p>
        </div>
        <AtlasTypesAdminClient />
      </div>
    </SimplePageLayout>
  );
}

