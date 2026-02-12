import { requireAdminAccess } from '@/lib/adminHelpers';
import NewPageWrapper from '@/components/layout/NewPageWrapper';
import AdminDocsClient from './AdminDocsClient';

export default async function AdminDocsPage() {
  await requireAdminAccess();
  
  return (
    <NewPageWrapper>
      <div className="max-w-4xl mx-auto px-[10px] py-3">
        <div className="mb-4">
          <h1 className="text-sm font-semibold text-gray-900 mb-0.5">
            Admin Control System Documentation
          </h1>
          <p className="text-xs text-gray-600">
            Understand how platform controls work and what happens when you change settings
          </p>
        </div>
        
        <AdminDocsClient />
      </div>
    </NewPageWrapper>
  );
}
