import { Metadata } from 'next';
import Link from 'next/link';
import SimplePageLayout from '@/components/SimplePageLayout';
import { createServerClient } from '@/lib/supabaseServer';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Minnesota Elected Officials Directory | All MN Government Leaders & Representatives',
  description: 'Complete list of Minnesota elected officials including Governor, U.S. Senators, Representatives, state legislators, and local leaders. Find who represents you in MN government.',
  keywords: [
    'Minnesota elected officials list',
    'MN government officials',
    'Minnesota politicians',
    'who is my representative Minnesota',
    'Minnesota state legislators',
    'MN senators and representatives',
    'Minnesota DFL Republican officials',
  ],
};

export default async function LeadersPage() {
  const supabase = createServerClient();

  const { data: leaders } = await supabase
    .from('leaders')
    .select('id, mn_id, full_name, slug, party, is_active, notes')
    .eq('is_active', true)
    .order('full_name');

  // Group by party
  const dflLeaders = leaders?.filter(l => l.party === 'DFL') || [];
  const republicanLeaders = leaders?.filter(l => l.party === 'Republican') || [];
  const otherLeaders = leaders?.filter(l => !l.party || (l.party !== 'DFL' && l.party !== 'Republican')) || [];

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
            <li className="text-gray-900 font-medium" aria-current="page">Leaders</li>
          </ol>
        </nav>

        {/* Header */}
        <div className="mb-3">
          <h1 className="text-sm font-semibold text-gray-900 mb-1.5">Minnesota Elected Officials</h1>
          <p className="text-xs text-gray-600 mb-1.5">
            Meet the {leaders?.length || 0} officials currently serving Minnesota—from the Governor&apos;s office 
            and U.S. Congress to the State Legislature and beyond.
          </p>
          <p className="text-xs text-gray-500">
            Click any name to see their current position, jurisdiction, term dates, and official website.
          </p>
        </div>

        {/* Party Summary */}
        <div className="flex gap-3 mb-3 text-xs">
          <span className="text-gray-600">
            <span className="font-medium text-blue-700">DFL:</span> {dflLeaders.length}
          </span>
          <span className="text-gray-600">
            <span className="font-medium text-red-700">Republican:</span> {republicanLeaders.length}
          </span>
          {otherLeaders.length > 0 && (
            <span className="text-gray-600">
              <span className="font-medium">Other/Nonpartisan:</span> {otherLeaders.length}
            </span>
          )}
        </div>

        {/* Leaders List */}
        <div className="bg-white rounded-md border border-gray-200">
          {leaders && leaders.length > 0 ? (
            <ul className="divide-y divide-gray-200">
              {leaders.map((leader) => (
                <li key={leader.id}>
                  <Link
                    href={`/civic/leader/${leader.slug}`}
                    className="flex items-start justify-between p-[10px] hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-medium text-gray-900">{leader.full_name}</span>
                        {leader.party && (
                          <span className={`text-xs ${leader.party === 'DFL' ? 'text-blue-600' : leader.party === 'Republican' ? 'text-red-600' : 'text-gray-500'}`}>
                            ({leader.party})
                          </span>
                        )}
                      </div>
                      {leader.notes && (
                        <p className="text-xs text-gray-500 line-clamp-1">{leader.notes}</p>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-[10px] text-xs text-gray-500">No leaders found.</p>
          )}
        </div>

        {/* Related */}
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="flex flex-wrap gap-2">
            <Link href="/civic/positions" className="text-xs text-gray-600 hover:text-gray-900 underline transition-colors">
              Positions
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

