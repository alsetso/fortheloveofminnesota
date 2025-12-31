import { notFound, redirect } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import SimplePageLayout from '@/components/layout/SimplePageLayout';
import { createServerClient } from '@/lib/supabaseServer';
import { getServerAuth } from '@/lib/authServer';
import AtlasTableSearch from '@/features/atlas/components/AtlasTableSearch';
import { getAtlasTypeBySlug } from '@/features/atlas/services/atlasTypesService';
import AtlasComingSoonModal from '@/features/atlas/components/AtlasComingSoonModal';
import PageViewTracker from '@/components/analytics/PageViewTracker';
import ExploreBreadcrumbs from '@/components/navigation/ExploreBreadcrumbs';

export const revalidate = 3600;

type Props = {
  params: Promise<{ table_name: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { table_name } = await params;
  
  // Fetch atlas type configuration from database
  const atlasType = await getAtlasTypeBySlug(table_name);
  
  if (!atlasType) {
    return {
      title: 'Atlas Table Not Found',
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com';
  const url = `${baseUrl}/explore/atlas/${table_name}`;
  
  return {
    title: `Minnesota ${atlasType.name} Directory | Complete List`,
    description: `${atlasType.description || `Complete directory of ${atlasType.name.toLowerCase()} in Minnesota`}. Browse the complete directory of ${atlasType.name.toLowerCase()} in Minnesota.`,
    keywords: [`Minnesota ${atlasType.name.toLowerCase()}`, `MN ${atlasType.name.toLowerCase()}`, `${atlasType.name.toLowerCase()} directory`, 'Minnesota locations', 'Minnesota geographic data'],
    openGraph: {
      title: `Minnesota ${atlasType.name} Directory | Complete List`,
      description: `${atlasType.description || `Complete directory of ${atlasType.name.toLowerCase()} in Minnesota`}. Browse the complete directory of ${atlasType.name.toLowerCase()} in Minnesota.`,
      url,
      siteName: 'For the Love of Minnesota',
      images: [
        {
          url: '/logo.png',
          width: 1200,
          height: 630,
          type: 'image/png',
          alt: `Minnesota ${atlasType.name} Directory`,
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

export default async function AtlasTablePage({ params }: Props) {
  const { table_name } = await params;

  // Fetch atlas type configuration from database
  const atlasType = await getAtlasTypeBySlug(table_name);
  
  if (!atlasType) {
    notFound();
  }

  const config = {
    label: atlasType.name,
    icon: atlasType.icon_path,
    description: atlasType.description || '',
  };

  // Check status and control access
  if (atlasType?.status === 'coming_soon') {
    // Show coming soon modal (handled by client component)
  }
  const supabase = createServerClient();
  const auth = await getServerAuth();
  // Only show admin actions if accounts.role is exactly 'admin'
  const isAdmin = auth?.role === 'admin';

  // Fetch all records from the atlas table
  // All tables are in atlas schema (cities was moved to atlas schema)
  const result = await (supabase as any)
    .schema('atlas')
    .from(table_name)
    .select('*')
    .order('name', { ascending: true });
  const records = result.data;
  const error = result.error;

  const allRecords = handleQueryError(
    error,
    `AtlasTablePage: ${table_name}`,
    (records || []) as Record<string, any>[]
  );

  // Fetch city names for records with city_id
  const cityIds = [...new Set(allRecords.map(r => r.city_id).filter(Boolean))] as string[];
  const cityMap: Record<string, string> = {};
  
  if (cityIds.length > 0) {
    const { data: cities } = await (supabase as any)
      .schema('atlas')
      .from('cities')
      .select('id, name')
      .in('id', cityIds);
    
    if (cities) {
      cities.forEach((city: { id: string; name: string }) => {
        cityMap[city.id] = city.name;
      });
    }
  }

  // Add city name to each record
  const recordsWithCityNames = allRecords.map(record => ({
    ...record,
    city_name: record.city_id ? cityMap[record.city_id] || null : null,
  }));

  return (
    <>
      <PageViewTracker page_url={`/explore/atlas/${table_name}`} />
      {atlasType?.status === 'coming_soon' && (
        <AtlasComingSoonModal typeName={atlasType.name} />
      )}
      <SimplePageLayout contentPadding="px-[10px] py-3" footerVariant="light">
        <div className="max-w-4xl mx-auto">
        <ExploreBreadcrumbs
          items={[
            { name: 'Home', href: '/' },
            { name: 'Explore', href: '/explore' },
            { name: 'Atlas', href: '/explore/atlas' },
            { name: config.label, href: `/explore/atlas/${table_name}`, isCurrentPage: true },
          ]}
        />

        {/* Admin Label */}
        {isAdmin && (
          <div className="mb-2 bg-gray-100 border border-gray-300 rounded-md px-2 py-1">
            <p className="text-xs font-medium text-gray-700">Admin View</p>
          </div>
        )}

        {/* Header */}
        <div className="mb-3 space-y-1.5">
          <div className="flex items-center gap-2">
            {config.icon && (
              <img
                src={config.icon}
                alt={config.label}
                className="w-4 h-4 flex-shrink-0"
              />
            )}
            <h1 className="text-sm font-semibold text-gray-900">
              {config.label} Directory
            </h1>
          </div>
          <p className="text-xs text-gray-600">
            {config.description}. Complete directory of all <strong>{allRecords.length} {config.label.toLowerCase()}</strong> in Minnesota.
          </p>
        </div>

        {/* Records List with Search */}
        <div className="mb-3">
          <AtlasTableSearch
            tableName={table_name}
            records={recordsWithCityNames}
            isAdmin={isAdmin}
          />
        </div>

        {/* Summary Stats */}
        <div className="bg-white rounded-md border border-gray-200 p-[10px]">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">Summary Statistics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                Total {config.label}
              </p>
              <p className="text-sm font-semibold text-gray-900">{allRecords.length}</p>
              <p className="text-xs text-gray-600 mt-0.5">Records in database</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                With Coordinates
              </p>
              <p className="text-sm font-semibold text-gray-900">
                {allRecords.filter((r) => r.lat && r.lng).length}
              </p>
              <p className="text-xs text-gray-600 mt-0.5">Records with location data</p>
            </div>
          </div>
        </div>
      </div>
    </SimplePageLayout>
    </>
  );
}

