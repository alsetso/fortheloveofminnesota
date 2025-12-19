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
  const { data: leaders } = await supabase
    .from('leaders')
    .select('slug')
    .not('slug', 'is', null);

  return (leaders || []).map((leader) => ({
    slug: leader.slug!,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = createServerClient();

  const { data: leader } = await supabase
    .from('leaders')
    .select('full_name, party, notes')
    .eq('slug', slug)
    .single();

  if (!leader) {
    return { title: 'Official Not Found | Minnesota Civic Directory' };
  }

  const partyLabel = leader.party === 'DFL' ? 'DFL' : leader.party === 'Republican' ? 'R' : '';
  const title = `${leader.full_name}${partyLabel ? ` (${partyLabel})` : ''} | Minnesota Elected Official`;
  
  return {
    title,
    description: leader.notes || `Profile and current positions for ${leader.full_name}, Minnesota elected official${leader.party ? ` (${leader.party})` : ''}. Find contact information, term dates, and official website.`,
    keywords: [
      leader.full_name,
      `${leader.full_name} Minnesota`,
      leader.party || '',
      'Minnesota elected official',
      'MN government',
    ].filter(Boolean),
    openGraph: {
      title,
      description: leader.notes || `Profile for ${leader.full_name}, Minnesota elected official.`,
      type: 'profile',
    },
  };
}

export default async function LeaderPage({ params }: Props) {
  const { slug } = await params;
  const supabase = createServerClient();

  const { data: leader, error } = await supabase
    .from('leaders')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !leader) {
    notFound();
  }

  // Fetch current terms
  const { data: terms } = await supabase
    .from('terms')
    .select(`
      id,
      start_date,
      end_date,
      is_current,
      is_leadership,
      position:positions(id, title, slug, branch, level),
      jurisdiction:jurisdictions(id, name, slug, type)
    `)
    .eq('leader_id', leader.id)
    .order('is_current', { ascending: false })
    .order('start_date', { ascending: false });

  const currentTerms = terms?.filter((t: any) => t.is_current) || [];
  const pastTerms = terms?.filter((t: any) => !t.is_current) || [];

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
              <Link href="/civic/leaders" className="hover:text-gray-900 transition-colors">Leaders</Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-gray-900 font-medium" aria-current="page">{leader.full_name}</li>
          </ol>
        </nav>

        {/* Header */}
        <div className="mb-3 pb-3 border-b border-gray-200">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-sm font-semibold text-gray-900">{leader.full_name}</h1>
            {leader.party && (
              <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                leader.party === 'DFL' ? 'bg-blue-100 text-blue-700' : 
                leader.party === 'Republican' ? 'bg-red-100 text-red-700' : 
                'bg-gray-100 text-gray-600'
              }`}>
                {leader.party}
              </span>
            )}
            {!leader.is_active && (
              <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Former</span>
            )}
          </div>
          {currentTerms.length > 0 && (
            <p className="text-xs text-gray-600">
              {currentTerms.map((t: any) => t.position?.title).filter(Boolean).join(', ')}
            </p>
          )}
        </div>

        {/* Bio/Notes */}
        {leader.notes && (
          <div className="bg-gray-50 rounded-md border border-gray-200 p-[10px] mb-3">
            <p className="text-xs text-gray-700 leading-relaxed">{leader.notes}</p>
          </div>
        )}

        {/* Quick Facts */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {leader.party && (
            <div className="bg-white rounded-md border border-gray-200 p-[10px]">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Party</p>
              <p className="text-sm font-semibold text-gray-900">
                {leader.party === 'DFL' ? 'Democratic-Farmer-Labor (DFL)' : leader.party}
              </p>
            </div>
          )}
          <div className="bg-white rounded-md border border-gray-200 p-[10px]">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Status</p>
            <p className="text-sm font-semibold text-gray-900">
              {leader.is_active ? 'Currently Serving' : 'Former Official'}
            </p>
          </div>
        </div>

        {/* Official Website */}
        {leader.official_url && (
          <div className="mb-3">
            <a
              href={leader.official_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-gray-700 hover:text-gray-900 underline transition-colors"
            >
              Visit Official Website
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        )}

        {/* Current Positions */}
        {currentTerms.length > 0 && (
          <div className="mb-3">
            <h2 className="text-xs font-semibold text-gray-900 mb-1.5">Current Positions</h2>
            <div className="bg-white rounded-md border border-gray-200 divide-y divide-gray-200">
              {currentTerms.map((term: any) => (
                <div key={term.id} className="p-[10px]">
                  <div className="flex items-center gap-2 mb-0.5">
                    {term.position && (
                      <Link
                        href={`/civic/position/${term.position.slug}`}
                        className="text-xs font-medium text-gray-900 underline hover:text-gray-700"
                      >
                        {term.position.title}
                      </Link>
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
                    Since {term.start_date ? new Date(term.start_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Unknown'}
                    {term.end_date && ` · Term ends ${new Date(term.end_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Past Positions */}
        {pastTerms.length > 0 && (
          <div className="mb-3">
            <h2 className="text-xs font-semibold text-gray-900 mb-1.5">Previous Positions</h2>
            <div className="bg-white rounded-md border border-gray-200 divide-y divide-gray-200">
              {pastTerms.map((term: any) => (
                <div key={term.id} className="p-[10px] opacity-75">
                  <div className="flex items-center gap-2 mb-0.5">
                    {term.position && (
                      <span className="text-xs font-medium text-gray-700">
                        {term.position.title}
                      </span>
                    )}
                  </div>
                  {term.jurisdiction && (
                    <span className="text-xs text-gray-500">{term.jurisdiction.name}</span>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">
                    {term.start_date || '?'} — {term.end_date || '?'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Related */}
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="flex flex-wrap gap-2">
            <Link href="/civic/leaders" className="text-xs text-gray-600 hover:text-gray-900 underline transition-colors">
              All Leaders
            </Link>
            <span className="text-gray-300">•</span>
            <Link href="/civic/positions" className="text-xs text-gray-600 hover:text-gray-900 underline transition-colors">
              Positions
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

