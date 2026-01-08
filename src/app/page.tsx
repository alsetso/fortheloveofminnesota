import { Metadata } from 'next';
import SimplePageLayout from '@/components/layout/SimplePageLayout';
import {
  BuildingLibraryIcon,
  UserGroupIcon,
  ScaleIcon,
  CurrencyDollarIcon,
  EyeIcon,
  DocumentTextIcon,
  MapIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import Image from 'next/image';
import HomepageViewTracker from '@/components/analytics/HomepageViewTracker';
import { createServerClient } from '@/lib/supabaseServer';
import HeroSignInForm from '@/components/homepage/HeroSignInForm';

export const metadata: Metadata = {
  title: 'For the Love of Minnesota',
  description: "For the Love of Minnesota connects residents, neighbors, and professionals across the state. Drop a pin to archive a special part of your life in Minnesota.",
  keywords: 'Minnesota, Minnesota residents, Minnesota neighbors, Minnesota community, Minnesota locations, Minnesota cities, Minnesota counties, archive Minnesota, Minnesota memories, Minnesota stories',
  openGraph: {
    title: 'For the Love of Minnesota',
    description: "For the Love of Minnesota connects residents, neighbors, and professionals across the state. Drop a pin to archive a special part of your life in Minnesota.",
    url: 'https://fortheloveofminnesota.com',
    siteName: 'For the Love of Minnesota',
    images: [
      {
        url: '/logo.png',
        width: 1200,
        height: 630,
        type: 'image/png',
        alt: 'For the Love of Minnesota',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function Home() {
  const supabase = createServerClient();
  
  // Fetch realtime counts from civic tables - type budgetStatsResult as any to avoid complex type inference
  const [peopleResult, orgsResult, rolesResult, buildingsResult, budgetStatsResult]: [any, any, any, any, any] = await Promise.all([
    supabase.from('people').select('*', { count: 'exact', head: true }),
    supabase.from('orgs').select('*', { count: 'exact', head: true }),
    supabase.from('roles').select('*', { count: 'exact', head: true }).eq('is_current', true),
    supabase.from('buildings').select('*', { count: 'exact', head: true }),
    supabase.rpc('get_budget_stats', { p_period: null } as any),
  ]);

  const peopleTotal = peopleResult.count || 0;
  const orgsTotal = orgsResult.count || 0;
  const rolesTotal = rolesResult.count || 0;
  const buildingsTotal = buildingsResult.count || 0;
  
  // Extract budget stats with proper type handling
  const budgetStats = budgetStatsResult.data && Array.isArray(budgetStatsResult.data) && budgetStatsResult.data.length > 0 
    ? (budgetStatsResult.data[0] as any)
    : { total_budget: 0, total_spend: 0 };
  const totalBudget = Number(budgetStats.total_budget) || 0;
  const totalSpend = Number(budgetStats.total_spend) || 0;
  const remaining = totalBudget - totalSpend;

  return (
    <SimplePageLayout containerMaxWidth="full" backgroundColor="bg-[#f4f2ef]" contentPadding="py-3">
      <HomepageViewTracker />
      <div className="px-[10px]">
        {/* Main Content */}
        <div className="max-w-4xl mx-auto">
          <div className="space-y-6">
            {/* Hero Section */}
            <section className="space-y-4 py-8">
              <div className="flex justify-center mb-4">
                <Image
                  src="/mid_text For the love of mn.png"
                  alt="For the Love of Minnesota"
                  width={600}
                  height={200}
                  className="w-full max-w-2xl h-auto"
                  priority
                  unoptimized
                />
              </div>
              <div className="max-w-md mx-auto space-y-3">
                {/* Sign In Form */}
                <HeroSignInForm />
              </div>
            </section>

            {/* Government Section */}
            <section className="space-y-3 pt-6 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <BuildingLibraryIcon className="w-4 h-4 text-gray-700" />
                <h2 className="text-sm font-semibold text-gray-900">GOVERNMENT</h2>
              </div>
              <p className="text-xs text-gray-600">
                Understand how Minnesota government works, who holds power, and where citizens can engage effectively.
              </p>
              
              {/* Budget Summary */}
              <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <CurrencyDollarIcon className="w-4 h-4 text-gray-700" />
                  <h3 className="text-xs font-semibold text-gray-900">Minnesota Budget & Spending</h3>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-0.5">
                    <p className="text-xs text-gray-500">Total Budget</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {formatCurrency(totalBudget)}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-gray-500">Total Spent</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {formatCurrency(totalSpend)}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-gray-500">Remaining</p>
                    <p className={`text-sm font-semibold ${
                      remaining >= 0 ? 'text-green-700' : 'text-red-700'
                    }`}>
                      {formatCurrency(remaining)}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-600 pt-1">
                  See detailed budget breakdowns, spending by agency, and financial transparency data in the{' '}
                  <Link href="/gov/checkbook" className="text-red-600 hover:text-red-700 underline">
                    Checkbook
                  </Link>.
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                <Link
                  href="/gov"
                  className="bg-white border border-gray-200 rounded-md p-[10px] hover:bg-gray-50 hover:border-gray-300 transition-all space-y-2 group"
                >
                  <div className="flex items-start gap-2">
                    <UserGroupIcon className="w-4 h-4 text-gray-700 flex-shrink-0 mt-0.5 group-hover:text-gray-900 transition-colors" />
                    <div className="space-y-0.5 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-gray-900 group-hover:text-gray-700 transition-colors">People</p>
                        <span className="text-[10px] text-gray-500">({peopleTotal.toLocaleString()})</span>
                      </div>
                      <p className="text-xs text-gray-600">
                        Government officials, elected leaders, and public servants across Minnesota.
                      </p>
                    </div>
                  </div>
                </Link>
                <Link
                  href="/gov"
                  className="bg-white border border-gray-200 rounded-md p-[10px] hover:bg-gray-50 hover:border-gray-300 transition-all space-y-2 group"
                >
                  <div className="flex items-start gap-2">
                    <BuildingLibraryIcon className="w-4 h-4 text-gray-700 flex-shrink-0 mt-0.5 group-hover:text-gray-900 transition-colors" />
                    <div className="space-y-0.5 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-gray-900 group-hover:text-gray-700 transition-colors">Organizations</p>
                        <span className="text-[10px] text-gray-500">({orgsTotal.toLocaleString()})</span>
                      </div>
                      <p className="text-xs text-gray-600">
                        Government agencies, departments, branches, and courts across Minnesota.
                      </p>
                    </div>
                  </div>
                </Link>
                <Link
                  href="/gov"
                  className="bg-white border border-gray-200 rounded-md p-[10px] hover:bg-gray-50 hover:border-gray-300 transition-all space-y-2 group"
                >
                  <div className="flex items-start gap-2">
                    <ScaleIcon className="w-4 h-4 text-gray-700 flex-shrink-0 mt-0.5 group-hover:text-gray-900 transition-colors" />
                    <div className="space-y-0.5 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-gray-900 group-hover:text-gray-700 transition-colors">Current Roles</p>
                        <span className="text-[10px] text-gray-500">({rolesTotal.toLocaleString()})</span>
                      </div>
                      <p className="text-xs text-gray-600">
                        Active positions and roles connecting people to organizations in government.
                      </p>
                    </div>
                  </div>
                </Link>
                <Link
                  href="/gov"
                  className="bg-white border border-gray-200 rounded-md p-[10px] hover:bg-gray-50 hover:border-gray-300 transition-all space-y-2 group"
                >
                  <div className="flex items-start gap-2">
                    <BuildingLibraryIcon className="w-4 h-4 text-gray-700 flex-shrink-0 mt-0.5 group-hover:text-gray-900 transition-colors" />
                    <div className="space-y-0.5 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-gray-900 group-hover:text-gray-700 transition-colors">Buildings</p>
                        <span className="text-[10px] text-gray-500">({buildingsTotal.toLocaleString()})</span>
                      </div>
                      <p className="text-xs text-gray-600">
                        Government buildings and facilities across state, city, and town levels.
                      </p>
                    </div>
                  </div>
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                <Link
                  href="/gov/checkbook"
                  className="bg-white border border-gray-200 rounded-md p-[10px] hover:bg-gray-50 hover:border-gray-300 transition-all space-y-2 group"
                >
                  <div className="flex items-start gap-2">
                    <CurrencyDollarIcon className="w-4 h-4 text-gray-700 flex-shrink-0 mt-0.5 group-hover:text-gray-900 transition-colors" />
                    <div className="space-y-0.5 flex-1">
                      <p className="text-xs font-semibold text-gray-900 group-hover:text-gray-700 transition-colors">Checkbook</p>
                      <p className="text-xs text-gray-600">
                        Access government financial data including contracts, payments, budgets, and state payroll for transparency and accountability.
                      </p>
                    </div>
                  </div>
                </Link>
                <Link
                  href="/gov"
                  className="bg-white border border-gray-200 rounded-md p-[10px] hover:bg-gray-50 hover:border-gray-300 transition-all space-y-2 group"
                >
                  <div className="flex items-start gap-2">
                    <UserGroupIcon className="w-4 h-4 text-gray-700 flex-shrink-0 mt-0.5 group-hover:text-gray-900 transition-colors" />
                    <div className="space-y-0.5 flex-1">
                      <p className="text-xs font-semibold text-gray-900 group-hover:text-gray-700 transition-colors">Power of Citizens</p>
                      <p className="text-xs text-gray-600">
                        Minnesota citizens hold ultimate power through voting, public participation, and direct engagement with government.
                      </p>
                    </div>
                  </div>
                </Link>
              </div>
            </section>

            {/* Real People, Real Stories */}
            <section className="space-y-3 pt-6 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <UserGroupIcon className="w-4 h-4 text-gray-700" />
                <h2 className="text-sm font-semibold text-gray-900">REAL PEOPLE, REAL STORIES</h2>
              </div>
              <p className="text-xs text-gray-600">
                Minnesota is built by its people. Share what's happening in your community—the places you love, the issues you care about, the experiences that matter. Your stories help officials understand what real Minnesotans see, feel, and experience every day.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-2">
                  <div className="flex items-start gap-2">
                    <MapIcon className="w-4 h-4 text-gray-700 flex-shrink-0 mt-0.5" />
                    <div className="space-y-0.5 flex-1">
                      <p className="text-xs font-semibold text-gray-900">Document What Matters</p>
                      <p className="text-xs text-gray-600">
                        Drop pins, share photos, and tell stories about places and events in your community. Your contributions create a living map of what's happening across Minnesota, by real people, for real people.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-2">
                  <div className="flex items-start gap-2">
                    <DocumentTextIcon className="w-4 h-4 text-gray-700 flex-shrink-0 mt-0.5" />
                    <div className="space-y-0.5 flex-1">
                      <p className="text-xs font-semibold text-gray-900">Share Your Perspective</p>
                      <p className="text-xs text-gray-600">
                        Your voice matters. Document meetings, events, and community happenings from your perspective. When officials see what real people experience, they can make better decisions that reflect community needs.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-2">
                  <div className="flex items-start gap-2">
                    <UserGroupIcon className="w-4 h-4 text-gray-700 flex-shrink-0 mt-0.5" />
                    <div className="space-y-0.5 flex-1">
                      <p className="text-xs font-semibold text-gray-900">Connect Communities</p>
                      <p className="text-xs text-gray-600">
                        Build connections across neighborhoods, cities, and counties. See what others are sharing, discover new places, and understand how different communities experience life in Minnesota.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* How This Helps Everyone */}
            <section className="space-y-3 pt-6 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <MapIcon className="w-4 h-4 text-gray-700" />
                <h2 className="text-sm font-semibold text-gray-900">HOW THIS HELPS EVERYONE</h2>
              </div>
              <p className="text-xs text-gray-600">
                When real people share what's happening in their communities, everyone benefits. Officials get authentic insights into what matters to Minnesotans, and communities gain visibility into how decisions affect real neighborhoods and families.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-2">
                  <div className="flex items-start gap-2">
                    <UserGroupIcon className="w-4 h-4 text-gray-700 flex-shrink-0 mt-0.5" />
                    <div className="space-y-0.5 flex-1">
                      <p className="text-xs font-semibold text-gray-900">For Communities</p>
                      <p className="text-xs text-gray-600">
                        See what's happening across Minnesota through the eyes of real people. Discover places, events, and stories that matter to your neighbors. Build a shared understanding of life in Minnesota.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-2">
                  <div className="flex items-start gap-2">
                    <BuildingLibraryIcon className="w-4 h-4 text-gray-700 flex-shrink-0 mt-0.5" />
                    <div className="space-y-0.5 flex-1">
                      <p className="text-xs font-semibold text-gray-900">For Officials</p>
                      <p className="text-xs text-gray-600">
                        Understand what real Minnesotans see, feel, and experience. Access authentic community perspectives to make better decisions. See how policies and actions affect real neighborhoods and families.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* All Inquiries, Ideas, Feedback, and Business */}
            <section className="space-y-3 pt-6 border-t border-gray-200">
              <div className="bg-white rounded-md border border-gray-200 p-[10px]">
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-gray-900">All Inquiries, Ideas, Feedback, and Business</h3>
                  <p className="text-xs text-gray-600">
                    We welcome all inquiries, ideas, feedback, and business collaborations. Interested in working together or sharing your thoughts?
                  </p>
                  <a
                    href="mailto:loveofminnesota@gmail.com"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                  >
                    <span>loveofminnesota@gmail.com</span>
                  </a>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </SimplePageLayout>
  );
}
