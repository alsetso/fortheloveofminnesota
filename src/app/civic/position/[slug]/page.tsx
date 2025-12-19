import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import SimplePageLayout from '@/components/SimplePageLayout';
import { createServerClient } from '@/lib/supabaseServer';

type Props = {
  params: Promise<{ slug: string }>;
};

export const revalidate = 3600;

export async function generateStaticParams() {
  const supabase = createServerClient();
  const { data: positions } = await supabase
    .from('positions')
    .select('slug')
    .not('slug', 'is', null);

  return (positions || []).map((position) => ({
    slug: position.slug!,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = createServerClient();

  const { data: position } = await supabase
    .from('positions')
    .select('title, branch, level')
    .eq('slug', slug)
    .single();

  if (!position) {
    return { title: 'Position Not Found | Minnesota Civic Directory' };
  }

  const levelText = position.level === 'Federal' ? 'federal' : position.level === 'State' ? 'Minnesota state' : position.level?.toLowerCase() || '';
  
  return {
    title: `${position.title} | ${levelText ? `${levelText.charAt(0).toUpperCase() + levelText.slice(1)} ` : ''}Government Position in Minnesota`,
    description: `Learn about the ${position.title} position in Minnesota${position.level ? ` at the ${position.level} level` : ''}. See who currently holds this office, their responsibilities, and term information.`,
    keywords: [
      position.title,
      `Minnesota ${position.title}`,
      `${position.title} duties`,
      `who is the ${position.title}`,
      position.branch || '',
      'Minnesota government',
    ].filter(Boolean),
  };
}

export default async function PositionPage({ params }: Props) {
  const { slug } = await params;
  const supabase = createServerClient();

  const { data: position, error } = await supabase
    .from('positions')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !position) {
    notFound();
  }

  // Fetch current holders
  const { data: currentTerms } = await supabase
    .from('terms')
    .select(`
      id,
      start_date,
      end_date,
      is_leadership,
      leader:leaders(id, full_name, slug, party),
      jurisdiction:jurisdictions(id, name, slug, type)
    `)
    .eq('position_id', position.id)
    .eq('is_current', true)
    .order('start_date', { ascending: false });

  const holderCount = currentTerms?.length || 0;

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
            <li>
              <Link href="/civic/positions" className="hover:text-gray-900 transition-colors">Positions</Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-gray-900 font-medium" aria-current="page">{position.title}</li>
          </ol>
        </nav>

        {/* Header */}
        <div className="mb-3 pb-3 border-b border-gray-200">
          <h1 className="text-sm font-semibold text-gray-900 mb-1">{position.title}</h1>
          <div className="flex items-center gap-2 text-xs">
            {position.branch && (
              <span className={`px-1.5 py-0.5 rounded ${
                position.branch === 'Executive' ? 'bg-blue-100 text-blue-700' :
                position.branch === 'Legislative' ? 'bg-green-100 text-green-700' :
                position.branch === 'Judicial' ? 'bg-purple-100 text-purple-700' :
                'bg-gray-100 text-gray-600'
              }`}>
                {position.branch}
              </span>
            )}
            {position.level && (
              <span className="text-gray-500">{position.level} level</span>
            )}
          </div>
        </div>

        {/* Quick Facts */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
          {position.branch && (
            <div className="bg-white rounded-md border border-gray-200 p-[10px]">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Branch</p>
              <p className="text-sm font-semibold text-gray-900">{position.branch}</p>
            </div>
          )}
          {position.level && (
            <div className="bg-white rounded-md border border-gray-200 p-[10px]">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Level</p>
              <p className="text-sm font-semibold text-gray-900">{position.level}</p>
            </div>
          )}
          <div className="bg-white rounded-md border border-gray-200 p-[10px]">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Current Holders</p>
            <p className="text-sm font-semibold text-gray-900">{holderCount}</p>
          </div>
        </div>

        {/* Current Holders */}
        {currentTerms && currentTerms.length > 0 ? (
          <div className="mb-3">
            <h2 className="text-xs font-semibold text-gray-900 mb-1.5">
              Who Holds This Position
            </h2>
            <div className="bg-white rounded-md border border-gray-200 divide-y divide-gray-200">
              {currentTerms.map((term: any) => (
                <div key={term.id} className="p-[10px]">
                  <div className="flex items-center gap-2 mb-0.5">
                    {term.leader && (
                      <Link
                        href={`/civic/leader/${term.leader.slug}`}
                        className="text-xs font-medium text-gray-900 underline hover:text-gray-700"
                      >
                        {term.leader.full_name}
                      </Link>
                    )}
                    {term.leader?.party && (
                      <span className={`text-xs ${
                        term.leader.party === 'DFL' ? 'text-blue-600' : 
                        term.leader.party === 'Republican' ? 'text-red-600' : 
                        'text-gray-500'
                      }`}>
                        ({term.leader.party})
                      </span>
                    )}
                    {term.is_leadership && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Leadership</span>
                    )}
                  </div>
                  {term.jurisdiction && (
                    <Link
                      href={`/civic/jurisdiction/${term.jurisdiction.slug}`}
                      className="text-xs text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      {term.jurisdiction.name}
                    </Link>
                  )}
                  <p className="text-xs text-gray-500 mt-0.5">
                    Serving since {term.start_date ? new Date(term.start_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Unknown'}
                    {term.end_date && ` · Term ends ${new Date(term.end_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-md border border-gray-200 p-[10px] mb-3">
            <p className="text-xs text-gray-600">No current officeholders on record for this position.</p>
          </div>
        )}

        {/* Related */}
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="flex flex-wrap gap-2">
            <Link href="/civic/positions" className="text-xs text-gray-600 hover:text-gray-900 underline transition-colors">
              All Positions
            </Link>
            <span className="text-gray-300">•</span>
            <Link href="/civic/leaders" className="text-xs text-gray-600 hover:text-gray-900 underline transition-colors">
              Leaders
            </Link>
            <span className="text-gray-300">•</span>
            <Link href="/civic/jurisdictions" className="text-xs text-gray-600 hover:text-gray-900 underline transition-colors">
              Jurisdictions
            </Link>
          </div>
        </div>
      </div>
    </SimplePageLayout>
  );
}

