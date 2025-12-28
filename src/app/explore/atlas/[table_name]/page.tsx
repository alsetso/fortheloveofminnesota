import { notFound, redirect } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import SimplePageLayout from '@/components/layout/SimplePageLayout';
import { createServerClient } from '@/lib/supabaseServer';
import { getServerAuth } from '@/lib/authServer';
import AtlasTableSearch from '@/features/atlas/components/AtlasTableSearch';
import { getAtlasTypeBySlug } from '@/features/atlas/services/atlasTypesService';
import AtlasComingSoonModal from '@/features/atlas/components/AtlasComingSoonModal';

export const revalidate = 3600;

// Valid atlas table names
const VALID_TABLES = [
  'cities',
  'neighborhoods',
  'parks',
  'schools',
  'lakes',
  'churches',
  'hospitals',
  'golf_courses',
  'municipals',
  'watertowers',
  'cemeteries',
  'airports',
  'roads',
  'radio_and_news',
];

// Table configuration
const TABLE_CONFIG: Record<string, { label: string; icon: string | null; description: string }> = {
  cities: { label: 'Cities', icon: '/city.png', description: 'Complete directory of all Minnesota cities' },
  neighborhoods: { label: 'Neighborhoods', icon: '/neighborhood.png', description: 'Neighborhoods and districts across Minnesota' },
  parks: { label: 'Parks', icon: '/park_like.png', description: 'Parks and recreational areas' },
  schools: { label: 'Schools', icon: '/education.png', description: 'K-12 schools, universities, and colleges' },
  lakes: { label: 'Lakes', icon: '/lakes.png', description: 'Lakes and water bodies' },
  churches: { label: 'Churches', icon: '/churches.png', description: 'Churches and places of worship' },
  hospitals: { label: 'Hospitals', icon: '/hospital.png', description: 'Hospitals and medical facilities' },
  golf_courses: { label: 'Golf Courses', icon: '/golf courses.png', description: 'Golf courses and clubs' },
  municipals: { label: 'Municipals', icon: '/municiples.png', description: 'Municipal buildings and facilities' },
  watertowers: { label: 'Watertowers', icon: null, description: 'Water towers across Minnesota' },
  cemeteries: { label: 'Cemeteries', icon: null, description: 'Cemeteries and memorial sites' },
  airports: { label: 'Airports', icon: null, description: 'Airports and aviation facilities' },
  roads: { label: 'Roads', icon: null, description: 'Roads, highways, and transportation routes' },
  radio_and_news: { label: 'Radio & News', icon: null, description: 'Radio stations and news outlets' },
};

type Props = {
  params: Promise<{ table_name: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { table_name } = await params;
  
  if (!VALID_TABLES.includes(table_name)) {
    return {
      title: 'Atlas Table Not Found',
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const config = TABLE_CONFIG[table_name];
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com';
  const url = `${baseUrl}/explore/atlas/${table_name}`;
  
  return {
    title: `Minnesota ${config.label} Directory | Complete List`,
    description: `${config.description}. Browse the complete directory of ${config.label.toLowerCase()} in Minnesota.`,
    keywords: [`Minnesota ${config.label.toLowerCase()}`, `MN ${config.label.toLowerCase()}`, `${config.label.toLowerCase()} directory`, 'Minnesota locations', 'Minnesota geographic data'],
    openGraph: {
      title: `Minnesota ${config.label} Directory | Complete List`,
      description: `${config.description}. Browse the complete directory of ${config.label.toLowerCase()} in Minnesota.`,
      url,
      siteName: 'For the Love of Minnesota',
      images: [
        {
          url: '/logo.png',
          width: 1200,
          height: 630,
          type: 'image/png',
          alt: `Minnesota ${config.label} Directory`,
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

  if (!VALID_TABLES.includes(table_name)) {
    notFound();
  }

  // Fetch atlas type configuration
  const atlasType = await getAtlasTypeBySlug(table_name);
  
  // Use atlas type config if available, otherwise fallback to hardcoded config
  const config = atlasType ? {
    label: atlasType.name,
    icon: atlasType.icon_path,
    description: atlasType.description || TABLE_CONFIG[table_name]?.description || '',
  } : TABLE_CONFIG[table_name];

  if (!config) {
    notFound();
  }

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

  if (error) {
    console.error(`[AtlasTablePage] Error fetching ${table_name}:`, error);
  }

  const allRecords = (records || []) as Record<string, any>[];

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
      {atlasType?.status === 'coming_soon' && (
        <AtlasComingSoonModal typeName={atlasType.name} />
      )}
      <SimplePageLayout contentPadding="px-[10px] py-3" footerVariant="light">
        <div className="max-w-4xl mx-auto">
        {/* Breadcrumb Navigation */}
        <nav className="mb-3" aria-label="Breadcrumb">
          <ol className="flex items-center gap-2 text-xs text-gray-600">
            <li>
              <Link href="/" className="hover:text-gray-900 transition-colors">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href="/explore" className="hover:text-gray-900 transition-colors">
                Explore
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href="/explore/atlas" className="hover:text-gray-900 transition-colors">
                Atlas
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-gray-900 font-medium" aria-current="page">{config.label}</li>
          </ol>
        </nav>

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

