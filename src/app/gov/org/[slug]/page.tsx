import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import SimplePageLayout from '@/components/layout/SimplePageLayout';
import OrgChart from '@/features/civic/components/OrgChart';
import { getCivicOrgBySlug } from '@/features/civic/services/civicService';
import { buildOrgBreadcrumbs } from '@/features/civic/utils/breadcrumbs';
import Breadcrumbs from '@/components/civic/Breadcrumbs';
import { BuildingOfficeIcon, ScaleIcon } from '@heroicons/react/24/outline';
import OrgPageClient from './OrgPageClient';
import LastEditedIndicator from '@/features/civic/components/LastEditedIndicator';
import EntityEditHistory from '@/features/civic/components/EntityEditHistory';
import { getServerAuth } from '@/lib/authServer';

export const revalidate = 3600;

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const org = await getCivicOrgBySlug(slug);

  if (!org) {
    return {
      title: 'Organization Not Found',
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com';
  const url = `${baseUrl}/gov/org/${slug}`;
  const title = `${org.name} | Minnesota Government`;
  const description = org.description || `${org.name} - ${org.org_type} in Minnesota state government.`;

  return {
    title,
    description,
    keywords: [org.name, 'Minnesota government', org.org_type, 'Minnesota state'],
    openGraph: {
      title,
      description,
      url,
      siteName: 'For the Love of Minnesota',
      images: [
        {
          url: '/logo.png',
          width: 1200,
          height: 630,
          type: 'image/png',
          alt: org.name,
        },
      ],
      locale: 'en_US',
      type: 'website',
    },
    alternates: {
      canonical: url,
    },
  };
}

function getIconForOrgType(orgType: string) {
  switch (orgType) {
    case 'branch':
      return <BuildingOfficeIcon className="w-4 h-4 text-gray-500" />;
    case 'court':
      return <ScaleIcon className="w-4 h-4 text-gray-500" />;
    default:
      return <BuildingOfficeIcon className="w-4 h-4 text-gray-500" />;
  }
}

export default async function OrgPage({ params }: Props) {
  const { slug } = await params;
  const org = await getCivicOrgBySlug(slug);
  const auth = await getServerAuth();
  const isAdmin = auth?.role === 'admin';

  if (!org) {
    notFound();
  }

  const breadcrumbs = await buildOrgBreadcrumbs(org);
  const icon = getIconForOrgType(org.org_type);

  return (
    <SimplePageLayout contentPadding="px-[10px] py-3">
      <div className="max-w-4xl mx-auto">
        {/* Breadcrumb Navigation */}
        <Breadcrumbs items={breadcrumbs} />

        {/* Header */}
        <div className="mb-3 space-y-1.5">
          <div className="flex items-center gap-2 justify-between">
            <div className="flex items-center gap-2">
              {icon}
              <h1 className="text-sm font-semibold text-gray-900">
                {org.name}
              </h1>
            </div>
            <OrgPageClient org={org} isAdmin={isAdmin} />
          </div>
          {org.description && (
            <p className="text-xs text-gray-600">{org.description}</p>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            {org.website && (
              <a
                href={org.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-gray-500 hover:text-gray-900 transition-colors"
              >
                Official Website →
              </a>
            )}
            <LastEditedIndicator tableName="orgs" recordId={org.id} />
          </div>
        </div>

        {/* Organizational Chart */}
        <OrgChart org={org} icon={icon} />

        {/* Page Break */}
        <div className="mt-6 pt-6 border-t border-gray-300">
          {/* Edit History */}
          <EntityEditHistory 
            tableName="orgs" 
            recordId={org.id} 
            recordName={org.name}
            showHeader={true}
          />
        </div>
      </div>
    </SimplePageLayout>
  );
}

