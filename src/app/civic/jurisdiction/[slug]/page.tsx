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
  const { data: jurisdictions } = await supabase
    .from('jurisdictions')
    .select('slug')
    .not('slug', 'is', null);

  return (jurisdictions || []).map((jurisdiction) => ({
    slug: jurisdiction.slug!,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = createServerClient();

  const { data: jurisdiction } = await supabase
    .from('jurisdictions')
    .select('name, type')
    .eq('slug', slug)
    .single();

  if (!jurisdiction) {
    return { title: 'Jurisdiction Not Found | Minnesota Civic Directory' };
  }

  const typeLabel = jurisdiction.type === 'County' ? 'County' : 
                    jurisdiction.type === 'City' ? 'City' : 
                    jurisdiction.type || 'Jurisdiction';

  return {
    title: `${jurisdiction.name} Government Officials | ${typeLabel} Leaders & Representatives`,
    description: `See who governs ${jurisdiction.name}, Minnesota. Find current elected officials, government leaders, and representatives for this ${typeLabel.toLowerCase()}.`,
    keywords: [
      jurisdiction.name,
      `${jurisdiction.name} government`,
      `${jurisdiction.name} officials`,
      `${jurisdiction.name} Minnesota`,
      `who represents ${jurisdiction.name}`,
      jurisdiction.type || '',
    ].filter(Boolean),
    openGraph: {
      title: `${jurisdiction.name} Government | Minnesota ${typeLabel}`,
      description: `Current officials and representatives for ${jurisdiction.name}, Minnesota.`,
      type: 'website',
    },
  };
}

export default async function JurisdictionPage({ params }: Props) {
  const { slug } = await params;
  const supabase = createServerClient();

  const { data: jurisdiction, error } = await supabase
    .from('jurisdictions')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !jurisdiction) {
    notFound();
  }

  // Fetch parent jurisdiction if exists
  let parent = null;
  if (jurisdiction.parent_id) {
    const { data } = await supabase
      .from('jurisdictions')
      .select('id, name, slug, type')
      .eq('id', jurisdiction.parent_id)
      .single();
    parent = data;
  }

  // Fetch child jurisdictions
  const { data: children } = await supabase
    .from('jurisdictions')
    .select('id, name, slug, type')
    .eq('parent_id', jurisdiction.id)
    .order('type')
    .order('name');

  // Fetch current officials
  const { data: currentTerms } = await supabase
    .from('terms')
    .select(`
      id,
      start_date,
      is_leadership,
      leader:leaders(id, full_name, slug, party),
      position:positions(id, title, slug, authority_rank)
    `)
    .eq('jurisdiction_id', jurisdiction.id)
    .eq('is_current', true)
    .order('is_leadership', { ascending: false });

  // Sort by authority_rank
  const sortedTerms = (currentTerms || []).sort((a: any, b: any) => {
    const rankA = a.position?.authority_rank ?? 999;
    const rankB = b.position?.authority_rank ?? 999;
    return rankA - rankB;
  });

  // Group children by type
  const childrenByType = (children || []).reduce((acc, child) => {
    const type = child.type || 'Other';
    if (!acc[type]) acc[type] = [];
    acc[type].push(child);
    return acc;
  }, {} as Record<string, typeof children>);

  const childTypeOrder = ['County', 'City', 'Congressional District', 'Judicial District', 'Legislative', 'Executive', 'Judicial', 'Other'];

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
              <Link href="/civic/jurisdictions" className="hover:text-gray-900 transition-colors">Jurisdictions</Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-gray-900 font-medium" aria-current="page">{jurisdiction.name}</li>
          </ol>
        </nav>

        {/* Header */}
        <div className="mb-3 pb-3 border-b border-gray-200">
          <h1 className="text-sm font-semibold text-gray-900 mb-1">{jurisdiction.name}</h1>
          <div className="flex items-center gap-2 text-xs">
            {jurisdiction.type && (
              <span className={`px-1.5 py-0.5 rounded ${
                jurisdiction.type === 'State' ? 'bg-blue-100 text-blue-700' :
                jurisdiction.type === 'County' ? 'bg-amber-100 text-amber-700' :
                jurisdiction.type === 'City' ? 'bg-green-100 text-green-700' :
                jurisdiction.type === 'Federal' ? 'bg-purple-100 text-purple-700' :
                'bg-gray-100 text-gray-600'
              }`}>
                {jurisdiction.type}
              </span>
            )}
            {parent && (
              <>
                <span className="text-gray-400">in</span>
                <Link
                  href={`/civic/jurisdiction/${parent.slug}`}
                  className="text-gray-600 underline hover:text-gray-900"
                >
                  {parent.name}
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
          <div className="bg-white rounded-md border border-gray-200 p-[10px]">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Type</p>
            <p className="text-sm font-semibold text-gray-900">{jurisdiction.type || 'Jurisdiction'}</p>
          </div>
          <div className="bg-white rounded-md border border-gray-200 p-[10px]">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Current Officials</p>
            <p className="text-sm font-semibold text-gray-900">{sortedTerms.length}</p>
          </div>
          {children && children.length > 0 && (
            <div className="bg-white rounded-md border border-gray-200 p-[10px]">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Sub-Jurisdictions</p>
              <p className="text-sm font-semibold text-gray-900">{children.length}</p>
            </div>
          )}
        </div>

        {/* Current Officials */}
        {sortedTerms.length > 0 ? (
          <div className="mb-3">
            <h2 className="text-xs font-semibold text-gray-900 mb-1.5">
              Who Governs {jurisdiction.name}
            </h2>
            <div className="bg-white rounded-md border border-gray-200 divide-y divide-gray-200">
              {sortedTerms.map((term: any) => (
                <div key={term.id} className="p-[10px]">
                  <div className="flex items-center gap-2 mb-0.5">
                    {term.position && (
                      <Link
                        href={`/civic/position/${term.position.slug}`}
                        className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        {term.position.title}
                      </Link>
                    )}
                    {term.is_leadership && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Leadership</span>
                    )}
                  </div>
                  {term.leader && (
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/civic/leader/${term.leader.slug}`}
                        className="text-xs font-medium text-gray-900 underline hover:text-gray-700"
                      >
                        {term.leader.full_name}
                      </Link>
                      {term.leader.party && (
                        <span className={`text-xs ${
                          term.leader.party === 'DFL' ? 'text-blue-600' : 
                          term.leader.party === 'Republican' ? 'text-red-600' : 
                          'text-gray-500'
                        }`}>
                          ({term.leader.party})
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-md border border-gray-200 p-[10px] mb-3">
            <p className="text-xs text-gray-600">
              No officials currently on record for {jurisdiction.name}. 
              {jurisdiction.type === 'City' && ' City officials are being added.'}
            </p>
          </div>
        )}

        {/* Child Jurisdictions */}
        {children && children.length > 0 && (
          <div className="mb-3">
            <h2 className="text-xs font-semibold text-gray-900 mb-1.5">
              Within {jurisdiction.name} ({children.length})
            </h2>
            {childTypeOrder.map(type => {
              const items = childrenByType[type];
              if (!items || items.length === 0) return null;
              
              return (
                <div key={type} className="mb-2">
                  <p className="text-xs text-gray-500 mb-1">{type} ({items.length})</p>
                  <div className="bg-white rounded-md border border-gray-200">
                    <ul className="divide-y divide-gray-200">
                      {items.slice(0, 10).map((child: any) => (
                        <li key={child.id}>
                          <Link
                            href={`/civic/jurisdiction/${child.slug}`}
                            className="flex items-center justify-between p-[10px] hover:bg-gray-50 transition-colors"
                          >
                            <span className="text-xs font-medium text-gray-900">{child.name}</span>
                          </Link>
                        </li>
                      ))}
                      {items.length > 10 && (
                        <li className="p-[10px]">
                          <Link
                            href={`/civic/jurisdictions?type=${type}`}
                            className="text-xs text-gray-600 hover:text-gray-900 underline transition-colors"
                          >
                            View all {items.length} {type.toLowerCase()}s →
                          </Link>
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Related */}
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="flex flex-wrap gap-2">
            <Link href="/civic/jurisdictions" className="text-xs text-gray-600 hover:text-gray-900 underline transition-colors">
              All Jurisdictions
            </Link>
            <span className="text-gray-300">•</span>
            <Link href="/civic/leaders" className="text-xs text-gray-600 hover:text-gray-900 underline transition-colors">
              Leaders
            </Link>
            <span className="text-gray-300">•</span>
            <Link href="/civic/positions" className="text-xs text-gray-600 hover:text-gray-900 underline transition-colors">
              Positions
            </Link>
            {jurisdiction.type === 'County' && (
              <>
                <span className="text-gray-300">•</span>
                <Link href={`/explore/county/${jurisdiction.slug}`} className="text-xs text-gray-600 hover:text-gray-900 underline transition-colors">
                  Explore {jurisdiction.name}
                </Link>
              </>
            )}
            {jurisdiction.type === 'City' && (
              <>
                <span className="text-gray-300">•</span>
                <Link href={`/explore/city/${jurisdiction.slug}`} className="text-xs text-gray-600 hover:text-gray-900 underline transition-colors">
                  Explore {jurisdiction.name}
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </SimplePageLayout>
  );
}

