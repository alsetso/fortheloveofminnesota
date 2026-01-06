import { requireAdminAccess } from '@/lib/adminHelpers';
import SimplePageLayout from '@/components/layout/SimplePageLayout';
import MentionIconsAdminClient from '@/features/admin/components/MentionIconsAdminClient';

export default async function MentionIconsAdminPage() {
  await requireAdminAccess();

  return (
    <SimplePageLayout contentPadding="px-[10px] py-3">
      <div className="max-w-7xl mx-auto">
        <div className="mb-3">
          <h1 className="text-sm font-semibold text-gray-900">Mention Icons</h1>
          <p className="text-xs text-gray-600 mt-0.5">
            Manage mention pin icons that users can select when creating mentions
          </p>
        </div>
        <MentionIconsAdminClient />
      </div>
    </SimplePageLayout>
  );
}

