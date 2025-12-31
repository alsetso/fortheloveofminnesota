import { Metadata } from 'next';
import { generateBranchMetadata } from '@/features/civic/utils/metadata';
import SimplePageLayout from '@/components/layout/SimplePageLayout';
import GovPageViewTracker from '../components/GovPageViewTracker';
import OrgChart from '@/features/civic/components/OrgChart';
import { getCivicOrgBySlug } from '@/features/civic/services/civicService';
import Breadcrumbs from '@/components/civic/Breadcrumbs';
import { ScaleIcon } from '@heroicons/react/24/outline';

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  return generateBranchMetadata(
    'Legislative',
    'Minnesota Legislative Branch structure including the Senate and House of Representatives.',
    ['Minnesota legislature', 'Minnesota Senate', 'Minnesota House of Representatives', 'Minnesota legislative branch']
  );
}

export default async function LegislativePage() {
  const org = await getCivicOrgBySlug('legislative');

  return (
    <SimplePageLayout contentPadding="px-[10px] py-3" footerVariant="light">
      <div className="max-w-4xl mx-auto">
        {/* Breadcrumb Navigation */}
        <Breadcrumbs items={[
          { label: 'Home', href: '/' },
          { label: 'Government', href: '/gov' },
          { label: 'Legislative', href: null },
        ]} />

        {/* Header */}
        <div className="mb-3 space-y-1.5">
          <h1 className="text-sm font-semibold text-gray-900">
            Minnesota Legislative Branch
          </h1>
          <p className="text-xs text-gray-600">
            The Minnesota Legislature is a bicameral body consisting of the Senate and House of Representatives.
          </p>
        </div>

        {/* Legislative Chart */}
        <OrgChart org={org} icon={<ScaleIcon className="w-4 h-4 text-gray-500" />} />
      </div>
      <GovPageViewTracker />
    </SimplePageLayout>
  );
}

