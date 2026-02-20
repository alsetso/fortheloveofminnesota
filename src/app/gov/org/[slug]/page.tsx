import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import OrgChart from '@/features/civic/components/OrgChart';
import { getCivicOrgBySlug, getCivicOrgWithBuilding, getDepartmentBudget, type DepartmentBudgetRow } from '@/features/civic/services/civicService';
import { buildOrgBreadcrumbs } from '@/features/civic/utils/breadcrumbs';
import Breadcrumbs from '@/components/civic/Breadcrumbs';
import { BuildingOfficeIcon, ScaleIcon } from '@heroicons/react/24/outline';
import OrgPageClient from './OrgPageClient';
import LastEditedIndicator from '@/features/civic/components/LastEditedIndicator';
import EntityEditHistory from '@/features/civic/components/EntityEditHistory';
import { getServerAuth } from '@/lib/authServer';
import NewPageWrapper from '@/components/layout/NewPageWrapper';

export const revalidate = 3600;

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const org = await getCivicOrgBySlug(slug);

  if (!org) {
    return {
      title: 'Organization Not Found',
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com';
  const url = `${baseUrl}/gov/org/${slug}`;
  const title = `${org.name} | Minnesota Government`;
  const description = org.description || `${org.name} - ${org.org_type} in Minnesota state government.`;

  return {
    title,
    description,
    keywords: [org.name, 'Minnesota government', org.org_type, 'Minnesota state'],
    openGraph: {
      title,
      description,
      url,
      siteName: 'For the Love of Minnesota',
      images: [
        {
          url: '/seo_share_public_image.png',
          width: 1200,
          height: 630,
          type: 'image/png',
          alt: org.name,
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

function getIconForOrgType(orgType: string) {
  switch (orgType) {
    case 'branch':
      return <BuildingOfficeIcon className="w-4 h-4 text-gray-500" />;
    case 'court':
      return <ScaleIcon className="w-4 h-4 text-gray-500" />;
    default:
      return <BuildingOfficeIcon className="w-4 h-4 text-gray-500" />;
  }
}

function formatBudget(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount);
}

function formatBudgetFull(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatPercent(part: number, total: number): string {
  if (!total) return '—';
  return `${((part / total) * 100).toFixed(1)}%`;
}

// Aggregate budget rows for a single fiscal year into totals
function aggregateBudget(rows: DepartmentBudgetRow[], year: number) {
  const yr = rows.filter(r => r.budget_period === year);
  if (!yr.length) return null;
  return yr.reduce(
    (acc, r) => ({
      budget_amount: acc.budget_amount + Number(r.budget_amount),
      spend_amount: acc.spend_amount + Number(r.spend_amount),
      remaining_amount: acc.remaining_amount + Number(r.remaining_amount),
      obligated_amount: acc.obligated_amount + Number(r.obligated_amount),
    }),
    { budget_amount: 0, spend_amount: 0, remaining_amount: 0, obligated_amount: 0 }
  );
}

// Get all unique fiscal years from budget rows, descending
function getBudgetYears(rows: DepartmentBudgetRow[]): number[] {
  return [...new Set(rows.map(r => r.budget_period))].sort((a, b) => b - a);
}

const TRANSITION_DEPTS = new Set(['dept-children-youth-families', 'dept-direct-care-treatment']);

export default async function OrgPage({ params }: Props) {
  const { slug } = await params;
  const [org, orgWithBuilding] = await Promise.all([
    getCivicOrgBySlug(slug),
    getCivicOrgWithBuilding(slug),
  ]);
  const auth = await getServerAuth();
  const isAdmin = auth?.role === 'admin';

  if (!org) {
    notFound();
  }

  const breadcrumbs = await buildOrgBreadcrumbs(org);
  const icon = getIconForOrgType(org.org_type);
  const building = orgWithBuilding?.building ?? null;
  const parentOrg = orgWithBuilding?.parent ?? null;

  // Leadership — people with roles at this org
  const leaders = org.roles?.filter(r => r.is_current && r.person) ?? [];

  // Budget — only fetch for executive departments
  const isDepartment = org.gov_type === 'department' && org.branch === 'executive';
  const budgetRows = isDepartment ? await getDepartmentBudget(slug) : null;
  const isTransitionDept = TRANSITION_DEPTS.has(slug);

  // Find most recent year with non-zero budget data as the hero
  const budgetYears = budgetRows ? getBudgetYears(budgetRows) : [];
  const heroYear = budgetYears.find(yr => {
    const agg = aggregateBudget(budgetRows!, yr);
    return agg && agg.budget_amount > 0;
  }) ?? null;
  const budgetDisplay = heroYear !== null ? aggregateBudget(budgetRows!, heroYear) : null;

  return (
    <NewPageWrapper>
      <div className="max-w-4xl mx-auto px-[10px] py-3">
        <Breadcrumbs items={breadcrumbs} />

        {/* Header */}
        <div className="mb-3 space-y-1.5">
          <div className="flex items-center gap-2 justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              {icon}
              <h1 className="text-sm font-semibold text-gray-900">{org.name}</h1>
              {org.gov_type && (
                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded border bg-green-50 text-green-700 border-green-200">
                  {org.gov_type}
                </span>
              )}
              {org.branch && (
                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded border bg-blue-50 text-blue-700 border-blue-200">
                  {org.branch}
                </span>
              )}
            </div>
            <OrgPageClient org={org} isAdmin={isAdmin} />
          </div>

          {/* Parent breadcrumb */}
          {parentOrg && (
            <p className="text-[10px] text-gray-500">
              Part of{' '}
              <Link href={`/gov/org/${parentOrg.slug}`} className="text-blue-600 hover:underline">
                {parentOrg.name}
              </Link>
            </p>
          )}

          {org.description && (
            <p className="text-xs text-gray-600">{org.description}</p>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            {org.website && (
              <a
                href={org.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline"
              >
                Official Website →
              </a>
            )}
            <LastEditedIndicator tableName="orgs" recordId={org.id} />
          </div>
        </div>

        {/* Building block */}
        {building && (
          <div className="mb-3">
            <h2 className="text-xs font-semibold text-gray-900 mb-1.5">Location</h2>
            <div className="border border-gray-200 rounded-md p-3">
              <Link href={`/gov/building/${building.slug ?? building.id}`} className="text-xs font-medium text-blue-600 hover:underline">
                {building.name}
              </Link>
              {building.full_address && (
                <p className="text-[10px] text-gray-500 mt-0.5">{building.full_address}</p>
              )}
            </div>
          </div>
        )}

        {/* Leadership section */}
        <div className="mb-3">
          <h2 className="text-xs font-semibold text-gray-900 mb-1.5">Leadership</h2>
          {leaders.length > 0 ? (
            <div className="space-y-2">
              {leaders.map((role, idx) => {
                const person = role.person!;
                const partyColor = person.party === 'DFL' ? 'text-blue-600' :
                                   person.party === 'R' || person.party === 'Republican' ? 'text-red-600' :
                                   person.party ? 'text-gray-600' : '';
                return (
                  <div key={idx} className="border border-gray-200 rounded-md p-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-200 border border-gray-300 flex-shrink-0 flex items-center justify-center overflow-hidden">
                      {person.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={person.photo_url} alt={person.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[10px] font-medium text-gray-600">
                          {person.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                        </span>
                      )}
                    </div>
                    <div>
                      <Link href={`/gov/person/${person.slug ?? person.id}`} className="text-xs font-medium text-gray-900 hover:underline">
                        {person.name}
                      </Link>
                      <p className="text-[10px] text-gray-500">{role.title}</p>
                      {person.party && (
                        <span className={`text-[10px] font-medium ${partyColor}`}>{person.party}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="border border-gray-200 rounded-md p-3">
              <p className="text-[10px] text-gray-400">Leadership data coming soon.</p>
            </div>
          )}
        </div>

        {/* Budget block — executive departments only */}
        {isDepartment && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <h2 className="text-xs font-semibold text-gray-900">
                Budget{heroYear ? ` (FY${heroYear})` : ''}
              </h2>
              <span className="text-[10px] text-gray-400">Minnesota State Budget</span>
            </div>

            {budgetDisplay ? (
              <div className="border border-gray-200 rounded-md p-3 space-y-3">
                {/* Hero figures — most recent year with data */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">Total Budget</p>
                    <p className="text-sm font-semibold text-gray-900">{formatBudget(budgetDisplay.budget_amount)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">Spent</p>
                    <p className="text-sm font-semibold text-gray-900">{formatBudget(budgetDisplay.spend_amount)}</p>
                    <p className="text-[10px] text-gray-400">{formatPercent(budgetDisplay.spend_amount, budgetDisplay.budget_amount)} of budget</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">Obligated</p>
                    <p className="text-sm font-semibold text-gray-900">{formatBudget(budgetDisplay.obligated_amount)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">Remaining</p>
                    <p className="text-sm font-semibold text-gray-900">{formatBudget(budgetDisplay.remaining_amount)}</p>
                  </div>
                </div>

                {/* Spend bar */}
                {budgetDisplay.budget_amount > 0 && (
                  <div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-blue-500 h-1.5 rounded-full"
                        style={{ width: `${Math.min((budgetDisplay.spend_amount / budgetDisplay.budget_amount) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                {isTransitionDept && (
                  <p className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                    Budget data reflects agency transition — full figures available in FY2026.
                  </p>
                )}

                {/* Year-over-year history table */}
                {budgetYears.length > 1 && (
                  <div>
                    <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wide mb-1">Year-over-Year History</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[10px]">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="text-left text-gray-500 font-medium pb-1 pr-3">Fiscal Year</th>
                            <th className="text-right text-gray-500 font-medium pb-1 pr-3">Budget</th>
                            <th className="text-right text-gray-500 font-medium pb-1 pr-3">Spent</th>
                            <th className="text-right text-gray-500 font-medium pb-1">Remaining</th>
                          </tr>
                        </thead>
                        <tbody>
                          {budgetYears.map(yr => {
                            const agg = aggregateBudget(budgetRows!, yr);
                            const isHero = yr === heroYear;
                            if (!agg) return null;
                            if (agg.budget_amount === 0) {
                              return (
                                <tr key={yr} className="border-b border-gray-50">
                                  <td className="py-1 pr-3 text-gray-500 font-medium">FY{yr}</td>
                                  <td colSpan={3} className="py-1 text-amber-600 italic">Agency established mid-cycle</td>
                                </tr>
                              );
                            }
                            return (
                              <tr key={yr} className={`border-b border-gray-50 ${isHero ? 'font-semibold' : ''}`}>
                                <td className="py-1 pr-3 text-gray-700">
                                  FY{yr}
                                  {isHero && <span className="ml-1 text-[9px] text-blue-500 font-normal">(current)</span>}
                                </td>
                                <td className="py-1 pr-3 text-right text-gray-700 tabular-nums">{formatBudgetFull(agg.budget_amount)}</td>
                                <td className="py-1 pr-3 text-right text-gray-700 tabular-nums">{formatBudgetFull(agg.spend_amount)}</td>
                                <td className="py-1 text-right text-gray-700 tabular-nums">{formatBudgetFull(agg.remaining_amount)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="border border-gray-200 rounded-md p-3">
                {isTransitionDept ? (
                  <p className="text-[10px] text-amber-600">
                    Budget data reflects agency transition — full figures available in FY2026.
                  </p>
                ) : (
                  <p className="text-[10px] text-gray-400">Budget data not available.</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Org chart (children) */}
        {(org.children?.length ?? 0) > 0 && (
          <div className="mb-3">
            <h2 className="text-xs font-semibold text-gray-900 mb-1.5">
              Sub-organizations ({org.children!.length})
            </h2>
            <OrgChart org={{ ...org, roles: [] }} icon={icon} />
          </div>
        )}

        {(org.children?.length ?? 0) === 0 && leaders.length === 0 && (
          <OrgChart org={org} icon={icon} />
        )}

        {isAdmin && (
          <div className="mt-6 pt-6 border-t border-gray-300">
            <EntityEditHistory tableName="orgs" recordId={org.id} recordName={org.name} showHeader={true} />
          </div>
        )}
      </div>
    </NewPageWrapper>
  );
}

