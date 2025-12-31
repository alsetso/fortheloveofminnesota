import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import SimplePageLayout from '@/components/layout/SimplePageLayout';
import { createServerClient } from '@/lib/supabaseServer';
import { getServerAuth } from '@/lib/authServer';
import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import AtlasRecordDetailClient from '@/features/atlas/components/AtlasRecordDetailClient';
import AtlasRecordMap from '@/features/atlas/components/AtlasRecordMap';
import { getAtlasTypeBySlug } from '@/features/atlas/services/atlasTypesService';
import PageViewTracker from '@/components/analytics/PageViewTracker';
import { formatNumber } from '@/lib/utils/formatting';
import ExploreBreadcrumbs from '@/components/navigation/ExploreBreadcrumbs';

export const revalidate = 3600;

type Props = {
  params: Promise<{ table_name: string; id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { table_name, id } = await params;
  
  // Fetch atlas type configuration from database
  const atlasType = await getAtlasTypeBySlug(table_name);
  
  if (!atlasType) {
    return {
      title: 'Atlas Record Not Found',
      robots: {
        index: false,
        follow: false,
      },
    };
  }
  const supabase = createServerClient();

  // Fetch record for metadata
  // All tables are in atlas schema
  const { data: record } = await (supabase as any)
    .schema('atlas')
    .from(table_name)
    .select('name, meta_title, meta_description')
    .eq('id', id)
    .single();

  if (!record) {
    return {
      title: `${config.label} Record Not Found`,
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com';
  const url = `${baseUrl}/explore/atlas/${table_name}/${id}`;
  const recordName = (record as { name: string }).name || 'Record';
  const title = (record as { meta_title: string | null }).meta_title || `${recordName} | ${config.label}`;
  const description = (record as { meta_description: string | null }).meta_description || `${recordName} - ${config.description}`;

  return {
    title,
    description,
    keywords: [recordName, `${recordName} Minnesota`, config.label.toLowerCase(), 'Minnesota locations'],
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
          alt: `${recordName} - ${config.label}`,
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

function formatDate(date: string | null | undefined): string {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default async function AtlasRecordPage({ params }: Props) {
  const { table_name, id } = await params;

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
  
  const supabase = createServerClient();
  const auth = await getServerAuth();
  const isAdmin = auth?.role === 'admin';

  // Fetch the record - all tables are in atlas schema
  const { data: record, error } = await (supabase as any)
    .schema('atlas')
    .from(table_name)
    .select('*')
    .eq('id', id)
    .single();

  if (error || !record) {
    notFound();
  }

  const recordData = record as Record<string, any>;

  // Get displayable fields (exclude internal fields)
  const excludeFields = ['id', 'created_at', 'updated_at', 'polygon', 'boundary_lines'];
  const displayFields = Object.keys(recordData)
    .filter((key) => !excludeFields.includes(key) && !key.startsWith('_'))
    .sort((a, b) => {
      // Priority order
      const priority = ['name', 'slug', 'description', 'address', 'lat', 'lng', 'city_id'];
      const aIndex = priority.indexOf(a);
      const bIndex = priority.indexOf(b);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return a.localeCompare(b);
    });

  return (
    <>
      <PageViewTracker page_url={`/explore/atlas/${table_name}/${id}`} />
      <AtlasRecordDetailClient recordId={id} tableName={table_name} />
      <SimplePageLayout contentPadding="px-[10px] py-3" footerVariant="light">
        <div className="max-w-4xl mx-auto">
          <ExploreBreadcrumbs
            items={[
              { name: 'Home', href: '/' },
              { name: 'Explore', href: '/explore' },
              { name: 'Atlas', href: '/explore/atlas' },
              { name: config.label, href: `/explore/atlas/${table_name}` },
              { name: recordData.name || 'Record', href: `/explore/atlas/${table_name}/${id}`, isCurrentPage: true },
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {config.icon && (
                  <img
                    src={config.icon}
                    alt={config.label}
                    className="w-4 h-4 flex-shrink-0"
                  />
                )}
                <h1 className="text-sm font-semibold text-gray-900">
                  {recordData.name || 'Unnamed Record'}
                </h1>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-1">
                  <Link
                    href={`/admin/atlas/${table_name}/${id}`}
                    className="p-1 text-gray-500 hover:text-gray-900 transition-colors"
                    title="Edit record"
                  >
                    <PencilIcon className="w-3 h-3" />
                  </Link>
                </div>
              )}
            </div>
            {recordData.description && (
              <p className="text-xs text-gray-600">{recordData.description}</p>
            )}
          </div>

          {/* Map */}
          {recordData.lat && recordData.lng && (
            <div className="mb-3">
              <AtlasRecordMap
                lat={parseFloat(recordData.lat)}
                lng={parseFloat(recordData.lng)}
                name={recordData.name || 'Record'}
                tableName={table_name}
                height="300px"
              />
            </div>
          )}

          {/* Record Details */}
          <div className="space-y-2 mb-3">
            {displayFields.map((key) => {
              const value = recordData[key];
              if (value === null || value === undefined || value === '') return null;

              let displayValue: string | React.ReactElement = String(value);
              
              // Format special fields
              if (key === 'lat' || key === 'lng') {
                displayValue = parseFloat(value).toFixed(6);
              } else if (key === 'population' || key === 'enrollment' || key === 'area_acres' || key === 'mile_marker') {
                displayValue = formatNumber(value);
              } else if (key === 'created_at' || key === 'updated_at') {
                displayValue = formatDate(value);
              } else if (typeof value === 'boolean') {
                displayValue = value ? 'Yes' : 'No';
              } else if (typeof value === 'object') {
                displayValue = JSON.stringify(value, null, 2);
              }

              // Special handling for city_id - could link to city page
              if (key === 'city_id' && typeof value === 'string') {
                return (
                  <div key={key} className="bg-white rounded-md border border-gray-200 p-[10px]">
                    <div className="flex items-start gap-2 text-xs">
                      <span className="text-gray-500 font-medium min-w-[100px] capitalize">
                        {key.replace(/_/g, ' ')}:
                      </span>
                      <span className="text-gray-600 flex-1">{value}</span>
                    </div>
                  </div>
                );
              }

              return (
                <div key={key} className="bg-white rounded-md border border-gray-200 p-[10px]">
                  <div className="flex items-start gap-2 text-xs">
                    <span className="text-gray-500 font-medium min-w-[100px] capitalize">
                      {key.replace(/_/g, ' ')}:
                    </span>
                    <span className="text-gray-600 flex-1 break-words">
                      {displayValue}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Coordinates */}
          {recordData.lat && recordData.lng && (
            <div className="bg-white rounded-md border border-gray-200 p-[10px] mb-3">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                Location
              </p>
              <p className="text-xs text-gray-600">
                {parseFloat(recordData.lat).toFixed(6)}, {parseFloat(recordData.lng).toFixed(6)}
              </p>
              <Link
                href={`/map?lat=${recordData.lat}&lng=${recordData.lng}&zoom=15`}
                className="text-xs text-gray-700 underline hover:text-gray-900 transition-colors mt-1 inline-block"
              >
                View on map
              </Link>
            </div>
          )}

          {/* Back Link */}
          <div className="mb-3">
            <Link
              href={`/explore/atlas/${table_name}`}
              className="text-xs text-gray-600 hover:text-gray-900 underline transition-colors"
            >
              ← Back to {config.label} directory
            </Link>
          </div>
        </div>
      </SimplePageLayout>
    </>
  );
}

