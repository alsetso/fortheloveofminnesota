import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import OrgChart from '@/features/civic/components/OrgChart';
import PersonAvatar from '@/features/civic/components/PersonAvatar';
import {
  getAgencyPayroll,
  getCivicAgencyBySlug,
  getCivicAgencyWithBuilding,
  getDepartmentBudget,
  getOrgContracts,
  getOrgJurisdictions,
  type DepartmentBudgetRow,
  type OrgContractRow,
  type OrgJurisdiction,
} from '@/features/civic/services/civicService';
import { buildOrgBreadcrumbs } from '@/features/civic/utils/breadcrumbs';
import Breadcrumbs from '@/components/civic/Breadcrumbs';
import GovBadge from '@/components/gov/GovBadge';
import PartyBadge from '@/components/gov/PartyBadge';
import { BuildingOfficeIcon, ScaleIcon } from '@heroicons/react/24/outline';
import OrgPageClient from '@/app/gov/org/[slug]/OrgPageClient';
import LastEditedIndicator from '@/features/civic/components/LastEditedIndicator';
import EntityEditHistory from '@/features/civic/components/EntityEditHistory';
import { getServerAuth } from '@/lib/authServer';
import GovSidebarBroadcaster from '@/components/gov/GovSidebarBroadcaster';

export const revalidate = 3600;

const BRANCHES = ['executive', 'legislative', 'judicial'] as const;
type BranchSlug = (typeof BRANCHES)[number];

type Props = { params: Promise<{ branch: string; slug: string }> };

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

function formatWage(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount);
}

function aggregateBudget(rows: DepartmentBudgetRow[], year: number) {
  const yr = rows.filter((r) => r.budget_period === year);
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

function getBudgetYears(rows: DepartmentBudgetRow[]): number[] {
  return [...new Set(rows.map((r) => r.budget_period))].sort((a, b) => b - a);
}

const TRANSITION_DEPTS = new Set(['dept-children-youth-families', 'dept-direct-care-treatment']);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { branch, slug } = await params;
  if (!BRANCHES.includes(branch as BranchSlug)) return { title: 'Not Found' };
  const org = await getCivicAgencyBySlug(slug);
  if (!org) {
    return { title: 'Agency Not Found', robots: { index: false, follow: false } };
  }
  if (org.branch !== branch) {
    return { title: 'Not Found', robots: { index: false, follow: false } };
  }
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com';
  const url = `${baseUrl}/gov/${branch}/agency/${slug}`;
  const title = `${org.name} | Minnesota Government`;
  const description = org.description || `${org.name} - ${org.org_type} in Minnesota state government.`;
  return {
    title,
    description,
    openGraph: { title, description, url },
    alternates: { canonical: url },
  };
}

export default async function BranchAgencyPage({ params }: Props) {
  const { branch, slug } = await params;
  if (!BRANCHES.includes(branch as BranchSlug)) notFound();

  const [org, orgWithBuilding] = await Promise.all([
    getCivicAgencyBySlug(slug),
    getCivicAgencyWithBuilding(slug),
  ]);
  const auth = await getServerAuth();
  const isAdmin = auth?.role === 'admin';

  if (!org) notFound();
  if (org.branch !== branch) notFound();

  const branchLabel =
    branch === 'executive' ? 'Executive' : branch === 'legislative' ? 'Legislative' : 'Judicial';
  const baseCrumbs = await buildOrgBreadcrumbs(org, branch);
  const breadcrumbItems = [
    { label: 'Government', href: '/gov' as string | null },
    { label: `${branchLabel} Branch`, href: `/gov/${branch}` as string | null },
    ...baseCrumbs.slice(2, -1),
    { label: org.name, href: null },
  ];

  const icon = getIconForOrgType(org.org_type);
  const building = orgWithBuilding?.building ?? null;
  const parentOrg = orgWithBuilding?.parent ?? null;
  const leaders = org.roles?.filter((r) => r.is_current && r.person) ?? [];
  const needsJurisdictions = org.branch === 'judicial' || org.branch === 'legislative';
  const [budgetRows, contractRows, jurisdictions, payrollData] = await Promise.all([
    getDepartmentBudget(slug),
    getOrgContracts(slug, 10),
    needsJurisdictions ? getOrgJurisdictions(org.id) : Promise.resolve([] as OrgJurisdiction[]),
    getAgencyPayroll(slug, 2025),
  ]);
  const isTransitionDept = TRANSITION_DEPTS.has(slug);
  const budgetYears = budgetRows ? getBudgetYears(budgetRows) : [];
  const heroYear =
    budgetYears.find((yr) => {
      const agg = aggregateBudget(budgetRows!, yr);
      return agg && agg.budget_amount > 0;
    }) ?? null;
  const budgetDisplay = heroYear !== null ? aggregateBudget(budgetRows!, heroYear) : null;

  return (
    <>
      <GovSidebarBroadcaster
        data={{
          branch,
          orgName: org.name,
          orgSlug: org.slug,
          parentOrg: parentOrg ? { name: parentOrg.name, slug: parentOrg.slug } : null,
          leaders: leaders.map((r) => ({
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
        <Breadcrumbs items={breadcrumbItems} />

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
          {parentOrg && (
            <p className="text-[10px] text-foreground-muted">
              Part of{' '}
              <Link
                href={`/gov/${branch}/agency/${parentOrg.slug}`}
                className="text-accent hover:underline"
              >
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
            <LastEditedIndicator tableName="agencies" recordId={org.id} />
          </div>
        </div>

        {building && (
          <div className="mb-3">
            <h2 className="text-xs font-semibold text-foreground mb-1.5">Location</h2>
            <div className="border border-border rounded-md p-3 bg-surface">
              <Link
                href={`/gov/${branch}/building/${building.slug ?? building.id}`}
                className="text-xs font-medium text-accent hover:underline"
              >
                {building.name}
              </Link>
              {building.full_address && (
                <p className="text-[10px] text-foreground-muted mt-0.5">{building.full_address}</p>
              )}
            </div>
          </div>
        )}

        <div className="mb-3">
          <h2 className="text-xs font-semibold text-foreground mb-1.5">Leadership</h2>
          {leaders.length > 0 ? (
            <div className="space-y-2">
              {leaders.map((role, idx) => {
                const person = role.person!;
                return (
                  <div
                    key={idx}
                    className="border border-border rounded-md p-3 flex items-center gap-3 bg-surface"
                  >
                    <PersonAvatar name={person.name} photoUrl={person.photo_url} size="sm" />
                    <div>
                      <Link
                        href={`/gov/${branch}/person/${person.slug ?? person.id}`}
                        className="text-xs font-medium text-foreground hover:underline"
                      >
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
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                  <div>
                    <p className="text-[10px] text-foreground-muted uppercase tracking-wide font-medium">Total Budget</p>
                    <p className="text-sm font-semibold text-foreground">{formatBudget(budgetDisplay.budget_amount)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-foreground-muted uppercase tracking-wide font-medium">Spent</p>
                    <p className="text-sm font-semibold text-foreground">{formatBudget(budgetDisplay.spend_amount)}</p>
                    <p className="text-[10px] text-foreground-muted">
                      {formatPercent(budgetDisplay.spend_amount, budgetDisplay.budget_amount)} of budget
                    </p>
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
                {budgetDisplay.budget_amount > 0 && (
                  <div className="w-full bg-surface-muted rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full"
                      style={{
                        width: `${Math.min((budgetDisplay.spend_amount / budgetDisplay.budget_amount) * 100, 100)}%`,
                      }}
                    />
                  </div>
                )}
                {isTransitionDept && (
                  <p className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded px-2 py-1">
                    Budget data reflects agency transition — full figures available in FY2026.
                  </p>
                )}
                {budgetYears.length > 1 && (
                  <div>
                    <p className="text-[10px] text-foreground-muted font-medium uppercase tracking-wide mb-1">
                      Year-over-Year History
                    </p>
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
                          {budgetYears.map((yr) => {
                            const agg = aggregateBudget(budgetRows!, yr);
                            const isHero = yr === heroYear;
                            if (!agg) return null;
                            if (agg.budget_amount === 0) {
                              return (
                                <tr key={yr} className="border-b border-border">
                                  <td className="py-1 pr-3 text-foreground-muted font-medium">FY{yr}</td>
                                  <td colSpan={3} className="py-1 text-amber-600 italic">
                                    Agency established mid-cycle
                                  </td>
                                </tr>
                              );
                            }
                            return (
                              <tr
                                key={yr}
                                className={`border-b border-border ${isHero ? 'font-semibold' : ''}`}
                              >
                                <td className="py-1 pr-3 text-foreground">
                                  FY{yr}
                                  {isHero && (
                                    <span className="ml-1 text-[9px] text-blue-500 font-normal">(current)</span>
                                  )}
                                </td>
                                <td className="py-1 pr-3 text-right text-foreground tabular-nums">
                                  {formatBudgetFull(agg.budget_amount)}
                                </td>
                                <td className="py-1 pr-3 text-right text-foreground tabular-nums">
                                  {formatBudgetFull(agg.spend_amount)}
                                </td>
                                <td className="py-1 text-right text-foreground tabular-nums">
                                  {formatBudgetFull(agg.remaining_amount)}
                                </td>
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
                <p className="text-[10px] text-foreground-muted">Budget data not available.</p>
              </div>
            )}
          </div>
        )}

        {payrollData && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <h2 className="text-xs font-semibold text-foreground">
                Workforce (FY{payrollData.fiscal_year})
              </h2>
              <span className="text-[10px] text-foreground-muted">Minnesota OpenCheckbook</span>
            </div>
            <div className="border border-border rounded-md p-3 bg-surface">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                <div>
                  <p className="text-[10px] text-foreground-muted uppercase tracking-wide font-medium">Employees</p>
                  <p className="text-sm font-semibold text-foreground">
                    {payrollData.total_employees.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-foreground-muted uppercase tracking-wide font-medium">Total Wages</p>
                  <p className="text-sm font-semibold text-foreground">
                    {formatWage(payrollData.total_wages)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-foreground-muted uppercase tracking-wide font-medium">Avg Salary</p>
                  <p className="text-sm font-semibold text-foreground">
                    {formatWage(payrollData.average_wages)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-foreground-muted uppercase tracking-wide font-medium">Overtime</p>
                  <p className="text-sm font-semibold text-foreground">
                    {formatWage(payrollData.total_overtime)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

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
                        <td className="px-3 py-1.5 text-right text-foreground tabular-nums font-medium">
                          {formatContractAmount(row.total_contract_amount)}
                        </td>
                        <td className="px-3 py-1.5 text-right text-foreground-muted hidden sm:table-cell">
                          {formatContractDate(row.start_date)}
                        </td>
                        <td className="px-3 py-1.5 text-right text-foreground-muted hidden sm:table-cell">
                          {formatContractDate(row.end_date)}
                        </td>
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

        {jurisdictions.length > 0 && (
          <div className="mb-3">
            <h2 className="text-xs font-semibold text-foreground mb-1.5">
              Districts ({jurisdictions.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {jurisdictions.map((j) => (
                <Link
                  key={j.slug}
                  href={j.slug ? `/gov/jurisdictions/${j.slug}` : `/gov/${branch}`}
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
            <EntityEditHistory tableName="agencies" recordId={org.id} recordName={org.name} showHeader={true} />
          </div>
        )}
      </div>
    </>
  );
}
