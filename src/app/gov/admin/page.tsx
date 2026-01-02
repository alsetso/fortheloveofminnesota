import { requireAdminAccess } from '@/lib/adminHelpers';
import { SimplePageLayout } from '@/components/layout/SimplePageLayout';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import PayrollImportAdmin from './PayrollImportAdmin';

export const metadata = {
  title: 'Payroll Import Admin | Government',
  description: 'Admin interface for importing payroll data',
};

export default async function GovAdminPage() {
  await requireAdminAccess();

  return (
    <SimplePageLayout contentPadding="px-[10px] py-3" footerVariant="light">
      <div className="max-w-4xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Home', href: '/' },
          { label: 'Government', href: '/gov' },
          { label: 'Admin', href: null },
        ]} />

        <div className="mb-3 space-y-1.5">
          <h1 className="text-sm font-semibold text-gray-900">
            Payroll Import Admin
          </h1>
          <p className="text-xs text-gray-600">
            Import payroll data by fiscal year
          </p>
        </div>

        <PayrollImportAdmin />
      </div>
    </SimplePageLayout>
  );
}

