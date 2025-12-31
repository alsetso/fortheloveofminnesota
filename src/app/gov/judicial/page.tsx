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
    'Judicial',
    'Minnesota Judicial Branch structure including the Supreme Court, Court of Appeals, and District Courts.',
    ['Minnesota courts', 'Minnesota Supreme Court', 'Minnesota judicial branch', 'Minnesota court system']
  );
}

export default async function JudicialPage() {
  const org = await getCivicOrgBySlug('judicial');

  return (
    <SimplePageLayout contentPadding="px-[10px] py-3" footerVariant="light">
      <div className="max-w-4xl mx-auto">
        {/* Breadcrumb Navigation */}
        <Breadcrumbs items={[
          { label: 'Home', href: '/' },
          { label: 'Government', href: '/gov' },
          { label: 'Judicial', href: null },
        ]} />

        {/* Header */}
        <div className="mb-3 space-y-1.5">
          <h1 className="text-sm font-semibold text-gray-900">
            Minnesota Judicial Branch
          </h1>
          <p className="text-xs text-gray-600">
            The Minnesota Judicial Branch consists of the Supreme Court, Court of Appeals, and District Courts.
          </p>
        </div>

        {/* Judicial Chart */}
        <OrgChart org={org} icon={<ScaleIcon className="w-4 h-4 text-gray-500" />} />
      </div>
      <GovPageViewTracker />
    </SimplePageLayout>
  );
}

