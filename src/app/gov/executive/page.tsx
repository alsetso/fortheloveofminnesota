import { Metadata } from 'next';
import { generateBranchMetadata } from '@/features/civic/utils/metadata';
import SimplePageLayout from '@/components/layout/SimplePageLayout';
import GovPageViewTracker from '../components/GovPageViewTracker';
import OrgChart from '@/features/civic/components/OrgChart';
import { getCivicOrgBySlug } from '@/features/civic/services/civicService';
import Breadcrumbs from '@/components/civic/Breadcrumbs';
import { BuildingOfficeIcon } from '@heroicons/react/24/outline';

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  return generateBranchMetadata(
    'Executive',
    'Minnesota Executive Branch structure including the Governor, Lieutenant Governor, and state departments.',
    ['Minnesota governor', 'Tim Walz', 'Minnesota executive branch', 'Minnesota state departments']
  );
}

export default async function ExecutivePage() {
  const org = await getCivicOrgBySlug('executive');

  return (
    <SimplePageLayout contentPadding="px-[10px] py-3" footerVariant="light">
      <div className="max-w-4xl mx-auto">
        {/* Breadcrumb Navigation */}
        <Breadcrumbs items={[
          { label: 'Home', href: '/' },
          { label: 'Government', href: '/gov' },
          { label: 'Executive', href: null },
        ]} />

        {/* Header */}
        <div className="mb-3 space-y-1.5">
          <h1 className="text-sm font-semibold text-gray-900">
            Minnesota Executive Branch
          </h1>
          <p className="text-xs text-gray-600">
            The Executive Branch is headed by the Governor and includes constitutional officers and state departments.
          </p>
        </div>

        {/* Executive Chart */}
        <OrgChart org={org} icon={<BuildingOfficeIcon className="w-4 h-4 text-gray-500" />} />
      </div>
      <GovPageViewTracker />
    </SimplePageLayout>
  );
}

