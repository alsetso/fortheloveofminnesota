import { requireAdminAccess } from '@/lib/adminHelpers';
import NewPageWrapper from '@/components/layout/NewPageWrapper';
import AdminControlCenter from './AdminControlCenter';
import Link from 'next/link';

export default async function SystemsManagementPage() {
  await requireAdminAccess();
  
  return (
    <NewPageWrapper>
      <div className="max-w-7xl mx-auto px-[10px] py-3">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h1 className="text-sm font-semibold text-gray-900 mb-0.5">
              Platform Control Center
            </h1>
            <p className="text-xs text-gray-600">
              Centralized control for systems, routes, navigation, APIs, and platform settings
            </p>
          </div>
          <Link
            href="/admin/docs"
            className="px-2 py-1 text-[10px] text-gray-600 hover:text-gray-900 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
          >
            View Docs →
          </Link>
        </div>
        
        <AdminControlCenter />
      </div>
    </NewPageWrapper>
  );
}
