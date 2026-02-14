import { requireAdminAccess } from '@/lib/adminHelpers';
import NewPageWrapper from '@/components/layout/NewPageWrapper';
import MentionTypesClient from './MentionTypesClient';

export default async function MentionTypesPage() {
  await requireAdminAccess();

  return (
    <NewPageWrapper>
      <div className="max-w-5xl mx-auto px-[10px] py-3">
        <div className="mb-4">
          <h1 className="text-sm font-semibold text-gray-900 mb-0.5">
            Mention Types
          </h1>
          <p className="text-xs text-gray-600">
            Manage public.mention_types — controls the category options available when creating mentions
          </p>
        </div>
        <MentionTypesClient />
      </div>
    </NewPageWrapper>
  );
}
