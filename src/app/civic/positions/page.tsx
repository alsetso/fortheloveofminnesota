import { Metadata } from 'next';
import Link from 'next/link';
import SimplePageLayout from '@/components/SimplePageLayout';
import { createServerClient } from '@/lib/supabaseServer';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Minnesota Government Positions & Offices | Governor, Senator, Representative Roles',
  description: 'Understand Minnesota government positions from Governor to City Council. Learn about state, county, and local offices, their responsibilities, and who currently holds them.',
  keywords: [
    'Minnesota government positions',
    'MN elected offices',
    'Minnesota Governor role',
    'state senator responsibilities',
    'county commissioner duties',
    'Minnesota Attorney General',
    'Secretary of State Minnesota',
  ],
};

export default async function PositionsPage() {
  const supabase = createServerClient();

  const { data: positions } = await supabase
    .from('positions')
    .select('id, title, slug, branch, level, authority_rank')
    .order('authority_rank', { ascending: true, nullsFirst: false })
    .order('level')
    .order('title') as { data: { id: string; title: string; slug: string; branch: string | null; level: string | null; authority_rank: number | null }[] | null; error: any };

  // Group by level
  const positionsArray = (positions || []) as { id: string; title: string; slug: string; branch: string | null; level: string | null; authority_rank: number | null }[];
  const federalPositions = positionsArray.filter(p => p.level === 'Federal');
  const statePositions = positionsArray.filter(p => p.level === 'State');
  const otherPositions = positionsArray.filter(p => p.level !== 'Federal' && p.level !== 'State');

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
            <li className="text-gray-900 font-medium" aria-current="page">Positions</li>
          </ol>
        </nav>

        {/* Header */}
        <div className="mb-3">
          <h1 className="text-sm font-semibold text-gray-900 mb-1.5">Government Positions in Minnesota</h1>
          <p className="text-xs text-gray-600 mb-1.5">
            {positionsArray.length} elected and appointed offices that govern the North Star State. 
            From federal representatives in Washington to local officials in your city, these positions shape policy and serve Minnesotans.
          </p>
          <p className="text-xs text-gray-500">
            Positions are ranked by authority level—lower numbers indicate higher authority within their branch.
          </p>
        </div>

        {/* Federal Positions */}
        {federalPositions.length > 0 && (
          <div className="mb-3">
            <h2 className="text-xs font-semibold text-gray-900 mb-1.5">
              Federal Positions ({federalPositions.length})
            </h2>
            <p className="text-xs text-gray-500 mb-1.5">Minnesota&apos;s voice in Washington, D.C.</p>
            <div className="bg-white rounded-md border border-gray-200">
              <ul className="divide-y divide-gray-200">
                {federalPositions.map((position) => (
                  <li key={position.id}>
                    <Link
                      href={`/civic/position/${position.slug}`}
                      className="flex items-center justify-between p-[10px] hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-900">{position.title}</span>
                        {position.branch && (
                          <span className="text-xs text-gray-400">{position.branch}</span>
                        )}
                      </div>
                      {position.authority_rank && (
                        <span className="text-xs text-gray-300">#{position.authority_rank}</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* State Positions */}
        {statePositions.length > 0 && (
          <div className="mb-3">
            <h2 className="text-xs font-semibold text-gray-900 mb-1.5">
              State Positions ({statePositions.length})
            </h2>
            <p className="text-xs text-gray-500 mb-1.5">Leadership serving all of Minnesota from St. Paul.</p>
            <div className="bg-white rounded-md border border-gray-200">
              <ul className="divide-y divide-gray-200">
                {statePositions.map((position) => (
                  <li key={position.id}>
                    <Link
                      href={`/civic/position/${position.slug}`}
                      className="flex items-center justify-between p-[10px] hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-900">{position.title}</span>
                        {position.branch && (
                          <span className="text-xs text-gray-400">{position.branch}</span>
                        )}
                      </div>
                      {position.authority_rank && (
                        <span className="text-xs text-gray-300">#{position.authority_rank}</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Other Positions */}
        {otherPositions.length > 0 && (
          <div className="mb-3">
            <h2 className="text-xs font-semibold text-gray-900 mb-1.5">
              Other Positions ({otherPositions.length})
            </h2>
            <div className="bg-white rounded-md border border-gray-200">
              <ul className="divide-y divide-gray-200">
                {otherPositions.map((position) => (
                  <li key={position.id}>
                    <Link
                      href={`/civic/position/${position.slug}`}
                      className="flex items-center justify-between p-[10px] hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-900">{position.title}</span>
                        {position.branch && (
                          <span className="text-xs text-gray-400">{position.branch}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {position.level && (
                          <span className="text-xs text-gray-400">{position.level}</span>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {positionsArray.length === 0 && (
          <div className="bg-white rounded-md border border-gray-200 p-[10px]">
            <p className="text-xs text-gray-500">No positions found.</p>
          </div>
        )}

        {/* Related */}
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="flex flex-wrap gap-2">
            <Link href="/civic/leaders" className="text-xs text-gray-600 hover:text-gray-900 underline transition-colors">
              Leaders
            </Link>
            <span className="text-gray-300">•</span>
            <Link href="/civic/jurisdictions" className="text-xs text-gray-600 hover:text-gray-900 underline transition-colors">
              Jurisdictions
            </Link>
            <span className="text-gray-300">•</span>
            <Link href="/explore" className="text-xs text-gray-600 hover:text-gray-900 underline transition-colors">
              Explore Minnesota
            </Link>
          </div>
        </div>
      </div>
    </SimplePageLayout>
  );
}

