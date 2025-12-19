import { Metadata } from 'next';
import Link from 'next/link';
import SimplePageLayout from '@/components/SimplePageLayout';
import { createServerClient } from '@/lib/supabaseServer';
import { UserGroupIcon, BriefcaseIcon, BuildingLibraryIcon } from '@heroicons/react/24/outline';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Minnesota Government Officials & Elected Leaders Directory | Who Represents You in MN',
  description: 'Find your Minnesota elected officials from Governor Tim Walz to local city council. Complete directory of MN senators, representatives, county commissioners, mayors, and civic leaders serving the North Star State.',
  keywords: [
    'Minnesota elected officials',
    'MN government directory',
    'who represents me Minnesota',
    'Minnesota senators',
    'Minnesota representatives',
    'Tim Walz',
    'Amy Klobuchar',
    'Minnesota state government',
    'MN county commissioners',
    'Minnesota mayors',
    'Twin Cities officials',
    'Minneapolis government',
    'St Paul government',
  ],
  openGraph: {
    title: 'Minnesota Government Officials & Elected Leaders | Who Represents You',
    description: 'Find your Minnesota elected officials from Governor to local city council. Complete directory of MN senators, representatives, and civic leaders.',
    type: 'website',
  },
};

export default async function CivicPage() {
  const supabase = createServerClient();

  const [
    { count: leaderCount },
    { count: positionCount },
    { count: jurisdictionCount },
  ] = await Promise.all([
    supabase.from('leaders').select('*', { count: 'exact', head: true }),
    supabase.from('positions').select('*', { count: 'exact', head: true }),
    supabase.from('jurisdictions').select('*', { count: 'exact', head: true }),
  ]);

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
            <li className="text-gray-900 font-medium" aria-current="page">Civic</li>
          </ol>
        </nav>

        {/* Header */}
        <div className="mb-3">
          <h1 className="text-sm font-semibold text-gray-900 mb-1.5">Who Represents Minnesota</h1>
          <p className="text-xs text-gray-600 mb-1.5">
            Your guide to the people serving the North Star State. From the Governor&apos;s office in St. Paul to your local city hall, 
            find the elected officials and civic leaders who represent you across Minnesota&apos;s 87 counties and 850+ cities.
          </p>
          <p className="text-xs text-gray-500">
            Explore current officeholders, their positions, and the jurisdictions they serve—whether that&apos;s the whole state, 
            your county, or your hometown.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <Link href="/civic/leaders" className="bg-white rounded-md border border-gray-200 p-[10px] hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-1.5 mb-1">
              <UserGroupIcon className="w-4 h-4 text-gray-600" />
              <h3 className="text-xs font-semibold text-gray-900">Leaders</h3>
            </div>
            <p className="text-sm font-semibold text-gray-900">{leaderCount || 0}</p>
            <p className="text-xs text-gray-500">Officials tracked</p>
          </Link>
          <Link href="/civic/positions" className="bg-white rounded-md border border-gray-200 p-[10px] hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-1.5 mb-1">
              <BriefcaseIcon className="w-4 h-4 text-gray-600" />
              <h3 className="text-xs font-semibold text-gray-900">Positions</h3>
            </div>
            <p className="text-sm font-semibold text-gray-900">{positionCount || 0}</p>
            <p className="text-xs text-gray-500">Roles & offices</p>
          </Link>
          <Link href="/civic/jurisdictions" className="bg-white rounded-md border border-gray-200 p-[10px] hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-1.5 mb-1">
              <BuildingLibraryIcon className="w-4 h-4 text-gray-600" />
              <h3 className="text-xs font-semibold text-gray-900">Jurisdictions</h3>
            </div>
            <p className="text-sm font-semibold text-gray-900">{jurisdictionCount || 0}</p>
            <p className="text-xs text-gray-500">Places governed</p>
          </Link>
        </div>

        {/* Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <Link
            href="/civic/leaders"
            className="group bg-white rounded-md border border-gray-200 p-[10px] hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <UserGroupIcon className="w-4 h-4 text-gray-700" />
              <h2 className="text-xs font-semibold text-gray-900">Browse Leaders</h2>
            </div>
            <p className="text-xs text-gray-600 mb-1.5">
              Find your elected officials—from Governor Walz and U.S. Senators to state legislators and local representatives.
            </p>
            <span className="text-xs text-gray-700 font-medium group-hover:underline">
              View all leaders →
            </span>
          </Link>

          <Link
            href="/civic/positions"
            className="group bg-white rounded-md border border-gray-200 p-[10px] hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <BriefcaseIcon className="w-4 h-4 text-gray-700" />
              <h2 className="text-xs font-semibold text-gray-900">Browse Positions</h2>
            </div>
            <p className="text-xs text-gray-600 mb-1.5">
              Understand the roles that shape Minnesota—Governor, Attorney General, State Senator, County Commissioner, Mayor, and more.
            </p>
            <span className="text-xs text-gray-700 font-medium group-hover:underline">
              View all positions →
            </span>
          </Link>

          <Link
            href="/civic/jurisdictions"
            className="group bg-white rounded-md border border-gray-200 p-[10px] hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <BuildingLibraryIcon className="w-4 h-4 text-gray-700" />
              <h2 className="text-xs font-semibold text-gray-900">Browse Jurisdictions</h2>
            </div>
            <p className="text-xs text-gray-600 mb-1.5">
              Explore how Minnesota is governed—from statewide offices to county boards, city councils, and special districts.
            </p>
            <span className="text-xs text-gray-700 font-medium group-hover:underline">
              View all jurisdictions →
            </span>
          </Link>
        </div>

        {/* Quick Links to Key Officials */}
        <div className="bg-white rounded-md border border-gray-200 p-[10px] mb-3">
          <h2 className="text-xs font-semibold text-gray-900 mb-2">Quick Links</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <Link href="/civic/leader/tim-walz" className="text-gray-600 hover:text-gray-900 underline transition-colors">
              Governor Walz
            </Link>
            <Link href="/civic/leader/amy-klobuchar" className="text-gray-600 hover:text-gray-900 underline transition-colors">
              Sen. Klobuchar
            </Link>
            <Link href="/civic/leader/tina-smith" className="text-gray-600 hover:text-gray-900 underline transition-colors">
              Sen. Smith
            </Link>
            <Link href="/civic/leader/keith-ellison" className="text-gray-600 hover:text-gray-900 underline transition-colors">
              AG Ellison
            </Link>
            <Link href="/civic/jurisdiction/minnesota" className="text-gray-600 hover:text-gray-900 underline transition-colors">
              State of Minnesota
            </Link>
            <Link href="/civic/jurisdictions?type=County" className="text-gray-600 hover:text-gray-900 underline transition-colors">
              All 87 Counties
            </Link>
            <Link href="/civic/jurisdictions?type=City" className="text-gray-600 hover:text-gray-900 underline transition-colors">
              Cities & Towns
            </Link>
            <Link href="/civic/jurisdiction/mn-senate" className="text-gray-600 hover:text-gray-900 underline transition-colors">
              MN Senate
            </Link>
          </div>
        </div>

        {/* About Section */}
        <div className="space-y-2 text-xs text-gray-600 mb-3">
          <h2 className="text-xs font-semibold text-gray-900">About This Directory</h2>
          <p>
            Minnesota&apos;s government operates at multiple levels—federal, state, county, and city. Each level has elected and appointed 
            officials who make decisions affecting your daily life, from roads and schools to taxes and public safety.
          </p>
          <p>
            This directory helps you understand who holds power in Minnesota, what positions they serve, and how the state&apos;s 
            jurisdictions—from the Capitol in St. Paul to your local city hall—fit together.
          </p>
        </div>

        {/* Related Sections */}
        <div className="pt-3 border-t border-gray-200">
          <h2 className="text-xs font-semibold text-gray-900 mb-2">Related</h2>
          <div className="flex flex-wrap gap-2">
            <Link href="/explore" className="text-xs text-gray-600 hover:text-gray-900 underline transition-colors">
              Explore Minnesota
            </Link>
            <span className="text-gray-300">•</span>
            <Link href="/explore/cities" className="text-xs text-gray-600 hover:text-gray-900 underline transition-colors">
              Cities Directory
            </Link>
            <span className="text-gray-300">•</span>
            <Link href="/explore/counties" className="text-xs text-gray-600 hover:text-gray-900 underline transition-colors">
              Counties Directory
            </Link>
            <span className="text-gray-300">•</span>
            <Link href="/faqs" className="text-xs text-gray-600 hover:text-gray-900 underline transition-colors">
              FAQs
            </Link>
          </div>
        </div>
      </div>
    </SimplePageLayout>
  );
}

