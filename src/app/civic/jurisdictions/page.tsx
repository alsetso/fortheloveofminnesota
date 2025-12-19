import { Metadata } from 'next';
import Link from 'next/link';
import SimplePageLayout from '@/components/SimplePageLayout';
import { createServerClient } from '@/lib/supabaseServer';
import JurisdictionsFilter from './JurisdictionsFilter';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Minnesota Jurisdictions | 87 Counties, 850+ Cities & Government Districts',
  description: 'Complete directory of Minnesota jurisdictions—87 counties, 850+ cities, congressional districts, and judicial districts. Explore how the North Star State is governed from state to local level.',
  keywords: [
    'Minnesota jurisdictions',
    'MN counties list',
    'Minnesota cities directory',
    'Minnesota congressional districts',
    'MN judicial districts',
    'Minnesota government structure',
    'Hennepin County',
    'Ramsey County',
    'Minneapolis jurisdiction',
    'St Paul jurisdiction',
  ],
};

type Props = {
  searchParams: Promise<{ type?: string }>;
};

export default async function JurisdictionsPage({ searchParams }: Props) {
  const { type: typeParam } = await searchParams;
  const supabase = createServerClient();

  const { data: jurisdictions } = await supabase
    .from('jurisdictions')
    .select('id, name, slug, type, parent_id')
    .order('type')
    .order('name');

  // Group by type
  const grouped = (jurisdictions || []).reduce((acc, j) => {
    const type = j.type || 'Other';
    if (!acc[type]) acc[type] = [];
    acc[type].push(j);
    return acc;
  }, {} as Record<string, typeof jurisdictions>);

  // Get all types and counts
  const allTypes = ['Federal', 'State', 'County', 'City', 'Congressional District', 'Legislative', 'Executive', 'Judicial', 'Judicial District', 'District', 'Other'];
  const availableTypes = allTypes.filter(t => grouped[t] && grouped[t].length > 0);
  const counts = Object.fromEntries(
    availableTypes.map(t => [t, grouped[t]?.length || 0])
  );

  // Filter by selected types from URL
  const selectedTypes = typeParam?.split(',').filter(Boolean) || [];
  const showAll = selectedTypes.length === 0;
  const typesToShow = showAll ? availableTypes : selectedTypes.filter(t => availableTypes.includes(t));

  // Calculate visible count
  const visibleCount = typesToShow.reduce((sum, t) => sum + (grouped[t]?.length || 0), 0);

  return (
    <SimplePageLayout contentPadding="px-[10px] py-3" footerVariant="light">
      <div className="max-w-4xl mx-auto">
        {/* Breadcrumb */}
        <nav className="mb-3" aria-label="Breadcrumb">
          <ol className="flex items-center gap-2 text-xs text-gray-600">
            <li>
              <Link href="/" className="hover:text-gray-900 transition-colors">Home</Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href="/civic" className="hover:text-gray-900 transition-colors">Civic</Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-gray-900 font-medium" aria-current="page">Jurisdictions</li>
          </ol>
        </nav>

        {/* Header */}
        <div className="mb-3">
          <h1 className="text-sm font-semibold text-gray-900 mb-1.5">Where Power Resides in Minnesota</h1>
          <p className="text-xs text-gray-600 mb-1">
            {showAll ? (
              <>Explore {jurisdictions?.length || 0} jurisdictions that govern Minnesota—from the state capitol to your local city hall.</>
            ) : (
              <>Showing {visibleCount} of {jurisdictions?.length || 0} jurisdictions.</>
            )}
          </p>
          <p className="text-xs text-gray-500">
            Use the filters to focus on counties, cities, or specific districts. Click any jurisdiction to see current officials.
          </p>
        </div>

        {/* Filter */}
        <JurisdictionsFilter types={availableTypes} counts={counts} />

        {/* Jurisdictions by Type */}
        <div className="space-y-3">
          {typesToShow.map((type) => {
            const items = grouped[type];
            if (!items || items.length === 0) return null;

            return (
              <div key={type}>
                <h2 className="text-xs font-semibold text-gray-900 mb-1.5">{type} ({items.length})</h2>
                <div className="bg-white rounded-md border border-gray-200">
                  <ul className="divide-y divide-gray-200">
                    {items.map((jurisdiction: any) => (
                      <li key={jurisdiction.id}>
                        <Link
                          href={`/civic/jurisdiction/${jurisdiction.slug}`}
                          className="flex items-center justify-between p-[10px] hover:bg-gray-50 transition-colors"
                        >
                          <span className="text-xs font-medium text-gray-900">{jurisdiction.name}</span>
                          <span className="text-xs text-gray-400">{jurisdiction.type}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>

        {typesToShow.length === 0 && (
          <div className="bg-white rounded-md border border-gray-200 p-[10px]">
            <p className="text-xs text-gray-500">No jurisdictions match the selected filters.</p>
          </div>
        )}

        {/* Related */}
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="flex flex-wrap gap-2">
            <Link href="/civic/leaders" className="text-xs text-gray-600 hover:text-gray-900 underline transition-colors">
              Leaders
            </Link>
            <span className="text-gray-300">•</span>
            <Link href="/civic/positions" className="text-xs text-gray-600 hover:text-gray-900 underline transition-colors">
              Positions
            </Link>
            <span className="text-gray-300">•</span>
            <Link href="/explore" className="text-xs text-gray-600 hover:text-gray-900 underline transition-colors">
              Explore Minnesota
            </Link>
            <span className="text-gray-300">•</span>
            <Link href="/explore/cities" className="text-xs text-gray-600 hover:text-gray-900 underline transition-colors">
              Cities
            </Link>
            <span className="text-gray-300">•</span>
            <Link href="/explore/counties" className="text-xs text-gray-600 hover:text-gray-900 underline transition-colors">
              Counties
            </Link>
          </div>
        </div>
      </div>
    </SimplePageLayout>
  );
}

