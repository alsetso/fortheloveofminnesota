import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import OrgChart from '@/features/civic/components/OrgChart';
import PersonAvatar from '@/features/civic/components/PersonAvatar';
import { getCivicOrgBySlug, getCivicOrgWithBuilding, getDepartmentBudget, getOrgContracts, getOrgJurisdictions, type DepartmentBudgetRow, type OrgContractRow, type OrgJurisdiction } from '@/features/civic/services/civicService';
import { buildOrgBreadcrumbs } from '@/features/civic/utils/breadcrumbs';
import Breadcrumbs from '@/components/civic/Breadcrumbs';
import GovBadge from '@/components/gov/GovBadge';
import PartyBadge from '@/components/gov/PartyBadge';
import { BuildingOfficeIcon, ScaleIcon } from '@heroicons/react/24/outline';
import OrgPageClient from './OrgPageClient';
import LastEditedIndicator from '@/features/civic/components/LastEditedIndicator';
import EntityEditHistory from '@/features/civic/components/EntityEditHistory';
import { getServerAuth } from '@/lib/authServer';
import GovSidebarBroadcaster from '@/components/gov/GovSidebarBroadcaster';

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
      return <BuildingOfficeIcon className="w-4 h-4 text-foreground-muted" />;
    case 'court':
      return <ScaleIcon className="w-4 h-4 text-foreground-muted" />;
    default:
      return <BuildingOfficeIcon className="w-4 h-4 text-foreground-muted" />;
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

function formatContractAmount(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount);
}

function formatContractDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
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

  // Budget — fetch for any org that has a checkbook_agency_name (not just executive departments)
  const needsJurisdictions = org.branch === 'judicial' || org.branch === 'legislative';
  const [budgetRows, contractRows, jurisdictions] = await Promise.all([
    getDepartmentBudget(slug),
    getOrgContracts(slug, 10),
    needsJurisdictions ? getOrgJurisdictions(org.id) : Promise.resolve([] as OrgJurisdiction[]),
  ]);
  const isTransitionDept = TRANSITION_DEPTS.has(slug);

  // Find most recent year with non-zero budget data as the hero
  const budgetYears = budgetRows ? getBudgetYears(budgetRows) : [];
  const heroYear = budgetYears.find(yr => {
    const agg = aggregateBudget(budgetRows!, yr);
    return agg && agg.budget_amount > 0;
  }) ?? null;
  const budgetDisplay = heroYear !== null ? aggregateBudget(budgetRows!, heroYear) : null;

  return (
    <>
      <GovSidebarBroadcaster
        data={{
          orgName: org.name,
          orgSlug: org.slug,
          parentOrg: parentOrg ? { name: parentOrg.name, slug: parentOrg.slug } : null,
          leaders: leaders.map(r => ({
            name: r.person!.name,
            slug: r.person!.slug ?? null,
            title: r.title,
            photoUrl: r.person!.photo_url ?? null,
          })),
          building: building ? { name: building.name, slug: building.slug ?? null } : null,
          budgetAmount: budgetDisplay?.budget_amount ?? null,
          budgetYear: heroYear ?? null,
          website: org.website ?? null,
        }}
      />
      <div className="max-w-4xl mx-auto px-[10px] py-3">
        <Breadcrumbs items={breadcrumbs} />

        {/* Header */}
        <div className="mb-3 space-y-1.5">
          <div className="flex items-center gap-2 justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              {icon}
              <h1 className="text-sm font-semibold text-foreground">{org.name}</h1>
              {org.gov_type && <GovBadge label={org.gov_type} />}
              {org.branch && <GovBadge label={org.branch} />}
            </div>
            <OrgPageClient org={org} isAdmin={isAdmin} />
          </div>

          {/* Parent breadcrumb */}
          {parentOrg && (
            <p className="text-[10px] text-foreground-muted">
              Part of{' '}
              <Link href={`/gov/org/${parentOrg.slug}`} className="text-accent hover:underline">
                {parentOrg.name}
              </Link>
            </p>
          )}

          {org.description && (
            <p className="text-xs text-foreground-muted">{org.description}</p>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            {org.website && (
              <a
                href={org.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-accent hover:underline"
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
            <h2 className="text-xs font-semibold text-foreground mb-1.5">Location</h2>
            <div className="border border-border rounded-md p-3 bg-surface">
              <Link href={`/gov/building/${building.slug ?? building.id}`} className="text-xs font-medium text-accent hover:underline">
                {building.name}
              </Link>
              {building.full_address && (
                <p className="text-[10px] text-foreground-muted mt-0.5">{building.full_address}</p>
              )}
            </div>
          </div>
        )}

        {/* Leadership section */}
        <div className="mb-3">
          <h2 className="text-xs font-semibold text-foreground mb-1.5">Leadership</h2>
          {leaders.length > 0 ? (
            <div className="space-y-2">
              {leaders.map((role, idx) => {
                const person = role.person!;
                return (
                  <div key={idx} className="border border-border rounded-md p-3 flex items-center gap-3 bg-surface">
                    <PersonAvatar name={person.name} photoUrl={person.photo_url} size="sm" />
                    <div>
                      <Link href={`/gov/person/${person.slug ?? person.id}`} className="text-xs font-medium text-foreground hover:underline">
                        {person.name}
                      </Link>
                      <p className="text-[10px] text-foreground-muted">{role.title}</p>
                      <PartyBadge party={person.party} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="border border-border rounded-md p-3 bg-surface">
              <p className="text-[10px] text-foreground-muted">Leadership data coming soon.</p>
            </div>
          )}
        </div>

        {/* Budget block — any org with a checkbook_agency_name mapping */}
        {(budgetRows !== null || isTransitionDept) && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <h2 className="text-xs font-semibold text-foreground">
                Budget{heroYear ? ` (FY${heroYear})` : ''}
              </h2>
              <span className="text-[10px] text-foreground-muted">Minnesota State Budget</span>
            </div>

            {budgetDisplay ? (
              <div className="border border-border rounded-md p-3 space-y-3 bg-surface">
                {/* Hero figures — most recent year with data */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                  <div>
                    <p className="text-[10px] text-foreground-muted uppercase tracking-wide font-medium">Total Budget</p>
                    <p className="text-sm font-semibold text-foreground">{formatBudget(budgetDisplay.budget_amount)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-foreground-muted uppercase tracking-wide font-medium">Spent</p>
                    <p className="text-sm font-semibold text-foreground">{formatBudget(budgetDisplay.spend_amount)}</p>
                    <p className="text-[10px] text-foreground-muted">{formatPercent(budgetDisplay.spend_amount, budgetDisplay.budget_amount)} of budget</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-foreground-muted uppercase tracking-wide font-medium">Obligated</p>
                    <p className="text-sm font-semibold text-foreground">{formatBudget(budgetDisplay.obligated_amount)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-foreground-muted uppercase tracking-wide font-medium">Remaining</p>
                    <p className="text-sm font-semibold text-foreground">{formatBudget(budgetDisplay.remaining_amount)}</p>
                  </div>
                </div>

                {/* Spend bar */}
                {budgetDisplay.budget_amount > 0 && (
                  <div>
                    <div className="w-full bg-surface-muted rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-blue-500 h-1.5 rounded-full"
                        style={{ width: `${Math.min((budgetDisplay.spend_amount / budgetDisplay.budget_amount) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                {isTransitionDept && (
                  <p className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded px-2 py-1">
                    Budget data reflects agency transition — full figures available in FY2026.
                  </p>
                )}

                {/* Year-over-year history table */}
                {budgetYears.length > 1 && (
                  <div>
                    <p className="text-[10px] text-foreground-muted font-medium uppercase tracking-wide mb-1">Year-over-Year History</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[10px]">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left text-foreground-muted font-medium pb-1 pr-3">Fiscal Year</th>
                            <th className="text-right text-foreground-muted font-medium pb-1 pr-3">Budget</th>
                            <th className="text-right text-foreground-muted font-medium pb-1 pr-3">Spent</th>
                            <th className="text-right text-foreground-muted font-medium pb-1">Remaining</th>
                          </tr>
                        </thead>
                        <tbody>
                          {budgetYears.map(yr => {
                            const agg = aggregateBudget(budgetRows!, yr);
                            const isHero = yr === heroYear;
                            if (!agg) return null;
                            if (agg.budget_amount === 0) {
                              return (
                                <tr key={yr} className="border-b border-border">
                                  <td className="py-1 pr-3 text-foreground-muted font-medium">FY{yr}</td>
                                  <td colSpan={3} className="py-1 text-amber-600 italic">Agency established mid-cycle</td>
                                </tr>
                              );
                            }
                            return (
                              <tr key={yr} className={`border-b border-border ${isHero ? 'font-semibold' : ''}`}>
                                <td className="py-1 pr-3 text-foreground">
                                  FY{yr}
                                  {isHero && <span className="ml-1 text-[9px] text-blue-500 font-normal">(current)</span>}
                                </td>
                                <td className="py-1 pr-3 text-right text-foreground tabular-nums">{formatBudgetFull(agg.budget_amount)}</td>
                                <td className="py-1 pr-3 text-right text-foreground tabular-nums">{formatBudgetFull(agg.spend_amount)}</td>
                                <td className="py-1 text-right text-foreground tabular-nums">{formatBudgetFull(agg.remaining_amount)}</td>
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
              <div className="border border-border rounded-md p-3 bg-surface">
                {isTransitionDept ? (
                  <p className="text-[10px] text-amber-600">
                    Budget data reflects agency transition — full figures available in FY2026.
                  </p>
                ) : (
                  <p className="text-[10px] text-foreground-muted">Budget data not available.</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Top Contracts block — only when data exists */}
        {contractRows && contractRows.length > 0 && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <h2 className="text-xs font-semibold text-foreground">Top Contracts</h2>
              <span className="text-[10px] text-foreground-muted">Minnesota OpenCheckbook</span>
            </div>
            <div className="border border-border rounded-md overflow-hidden bg-surface">
              <div className="overflow-x-auto">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="border-b border-border bg-surface-muted">
                      <th className="text-left text-foreground-muted font-medium px-3 py-1.5">Payee</th>
                      <th className="text-left text-foreground-muted font-medium px-3 py-1.5 hidden sm:table-cell">Type</th>
                      <th className="text-right text-foreground-muted font-medium px-3 py-1.5">Amount</th>
                      <th className="text-right text-foreground-muted font-medium px-3 py-1.5 hidden sm:table-cell">Start</th>
                      <th className="text-right text-foreground-muted font-medium px-3 py-1.5 hidden sm:table-cell">End</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contractRows.map((row: OrgContractRow) => (
                      <tr key={row.contract_id} className="border-b border-border last:border-0">
                        <td className="px-3 py-1.5 text-foreground max-w-[160px] truncate">{row.payee}</td>
                        <td className="px-3 py-1.5 text-foreground-muted hidden sm:table-cell">{row.contract_type}</td>
                        <td className="px-3 py-1.5 text-right text-foreground tabular-nums font-medium">{formatContractAmount(row.total_contract_amount)}</td>
                        <td className="px-3 py-1.5 text-right text-foreground-muted hidden sm:table-cell">{formatContractDate(row.start_date)}</td>
                        <td className="px-3 py-1.5 text-right text-foreground-muted hidden sm:table-cell">{formatContractDate(row.end_date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-3 py-1.5 border-t border-border">
                <Link
                  href={
                    (org as any).checkbook_agency_name
                      ? `/gov/checkbook/contracts?agency=${encodeURIComponent((org as any).checkbook_agency_name)}`
                      : '/gov/checkbook/contracts'
                  }
                  className="text-[10px] text-accent hover:underline"
                >
                  View all contracts →
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Org chart (children) */}
        {(org.children?.length ?? 0) > 0 && (
          <div className="mb-3">
            <h2 className="text-xs font-semibold text-foreground mb-1.5">
              Sub-organizations ({org.children!.length})
            </h2>
            <OrgChart org={{ ...org, roles: [] }} icon={icon} />
          </div>
        )}

        {(org.children?.length ?? 0) === 0 && leaders.length === 0 && (
          <OrgChart org={org} icon={icon} />
        )}

        {/* Jurisdictions block — for judicial/legislative orgs */}
        {jurisdictions.length > 0 && (
          <div className="mb-3">
            <h2 className="text-xs font-semibold text-foreground mb-1.5">
              Districts ({jurisdictions.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {jurisdictions.map((j) => (
                <Link
                  key={j.slug}
                  href={j.slug ? `/gov/jurisdictions/${j.slug}` : `/gov/${org.branch ?? 'gov'}`}
                  className="block border border-border rounded-md p-3 bg-surface hover:bg-surface-muted transition-colors"
                >
                  <div className="flex items-baseline gap-2">
                    {j.district_number != null && (
                      <span className="text-xs font-semibold text-foreground font-mono w-5 shrink-0">
                        {j.district_number}
                      </span>
                    )}
                    <span className="text-xs font-medium text-foreground">{j.name}</span>
                  </div>
                  {j.description && (
                    <p className="text-[10px] text-foreground-muted mt-1 leading-relaxed pl-7 line-clamp-2">
                      {j.description}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        {isAdmin && (
          <div className="mt-6 pt-6 border-t border-border">
            <EntityEditHistory tableName="orgs" recordId={org.id} recordName={org.name} showHeader={true} />
          </div>
        )}
      </div>
    </>
  );
}

