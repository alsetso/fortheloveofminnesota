import { Metadata } from 'next';
import Breadcrumbs from '@/components/civic/Breadcrumbs';
import PayrollCharts from '@/features/civic/components/charts/PayrollCharts';

export const revalidate = 3600;

const yearlyData = [
  { year: '2020', employees: 64964, total_wages: 4387365752, avg_wages: 59816, overtime: 107001746 },
  { year: '2021', employees: 62830, total_wages: 4680593923, avg_wages: 64259, overtime: 118899774 },
  { year: '2022', employees: 64294, total_wages: 4826631667, avg_wages: 64658, overtime: 129859981 },
  { year: '2023', employees: 64697, total_wages: 5280690810, avg_wages: 70585, overtime: 154368217 },
  { year: '2024', employees: 65523, total_wages: 5445405629, avg_wages: 72473, overtime: 155311345 },
  { year: '2025', employees: 68923, total_wages: 5822789012, avg_wages: 76397, overtime: 152984262 },
];

const topAgencies = [
  { name: 'MN St Colleges & Universities', employees: 17412, total_wages: 1728915194 },
  { name: 'Transportation Dept', employees: 6022, total_wages: 459723337 },
  { name: 'Direct Care and Treatment Dept', employees: 5455, total_wages: 424875053 },
  { name: 'Corrections Dept', employees: 4976, total_wages: 374455036 },
  { name: 'Natural Resources Dept', employees: 3526, total_wages: 233113175 },
  { name: 'Human Services Dept', employees: 3122, total_wages: 231376776 },
  { name: 'Trial Courts', employees: 3116, total_wages: 225100982 },
  { name: 'Minnesota IT Services', employees: 3021, total_wages: 346453285 },
  { name: 'Public Safety Dept', employees: 2414, total_wages: 197398061 },
  { name: 'Health Department', employees: 2238, total_wages: 195192240 },
  { name: 'Veterans Affairs Dept', employees: 2034, total_wages: 119194926 },
  { name: 'Employ & Econ Development Dept', employees: 1732, total_wages: 136920664 },
  { name: 'Revenue Dept', employees: 1629, total_wages: 124974633 },
  { name: 'Pollution Control Agency', employees: 1192, total_wages: 94550287 },
  { name: 'Public Defense Board', employees: 1087, total_wages: 110082179 },
];

function formatWage(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount);
}

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com';
  
  return {
    title: 'Payroll | State Checkbook | Minnesota Government | For the Love of Minnesota',
    description: 'View government payroll data in Minnesota.',
    keywords: ['Minnesota payroll', 'government payroll', 'state employee salaries', 'Minnesota spending'],
    openGraph: {
      title: 'Payroll | State Checkbook | Minnesota Government',
      description: 'View government payroll data in Minnesota.',
      url: `${baseUrl}/gov/checkbook/payroll`,
      siteName: 'For the Love of Minnesota',
      locale: 'en_US',
      type: 'website',
    },
    alternates: {
      canonical: `${baseUrl}/gov/checkbook/payroll`,
    },
  };
}

export default async function PayrollPage() {
  const fy2025 = yearlyData.find((d) => d.year === '2025')!;
  const maxEmployees = Math.max(...topAgencies.map((a) => a.employees));

  return (
    <div className="max-w-4xl mx-auto px-[10px] py-3">
      {/* Breadcrumb Navigation */}
      <Breadcrumbs items={[
        { label: 'Government', href: '/gov' },
        { label: 'State Checkbook', href: '/gov/checkbook' },
        { label: 'Payroll', href: null },
      ]} />

      {/* Header */}
      <div className="mb-3 space-y-1.5">
        <h1 className="text-sm font-semibold text-foreground">
          Payroll
        </h1>
        <p className="text-xs text-foreground-muted">
          Government employee payroll and compensation data in Minnesota
        </p>
      </div>

      {/* Section 1 — Hero Stats (FY2025) */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <h2 className="text-xs font-semibold text-foreground">
            Overview (FY2025)
          </h2>
          <span className="text-[10px] text-foreground-muted">Minnesota OpenCheckbook</span>
        </div>
        <div className="border border-border rounded-md p-3 bg-surface">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
            <div>
              <p className="text-[10px] text-foreground-muted uppercase tracking-wide font-medium">Total Employees</p>
              <p className="text-sm font-semibold text-foreground">
                {fy2025.employees.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-foreground-muted uppercase tracking-wide font-medium">Total Wages</p>
              <p className="text-sm font-semibold text-foreground">
                {formatWage(fy2025.total_wages)}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-foreground-muted uppercase tracking-wide font-medium">Avg Salary</p>
              <p className="text-sm font-semibold text-foreground">
                {formatWage(fy2025.avg_wages)}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-foreground-muted uppercase tracking-wide font-medium">Overtime Paid</p>
              <p className="text-sm font-semibold text-foreground">
                {formatWage(fy2025.overtime)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2 — Trends */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <h2 className="text-xs font-semibold text-foreground">
            Trends
          </h2>
          <span className="text-[10px] text-foreground-muted">FY2020–2025</span>
        </div>
        <PayrollCharts yearlyData={yearlyData} />
      </div>

      {/* Section 3 — Top Agencies Table */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <h2 className="text-xs font-semibold text-foreground">
            Top Agencies by Headcount (FY2025)
          </h2>
          <span className="text-[10px] text-foreground-muted">Minnesota OpenCheckbook</span>
        </div>
        <div className="border border-border rounded-md overflow-hidden bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="border-b border-border bg-surface-muted">
                  <th className="text-left text-foreground-muted font-medium px-3 py-1.5 w-12">Rank</th>
                  <th className="text-left text-foreground-muted font-medium px-3 py-1.5">Agency</th>
                  <th className="text-right text-foreground-muted font-medium px-3 py-1.5">Employees</th>
                  <th className="text-right text-foreground-muted font-medium px-3 py-1.5">Total Wages</th>
                </tr>
              </thead>
              <tbody>
                {topAgencies.map((agency, idx) => {
                  const employeePercent = (agency.employees / maxEmployees) * 100;
                  return (
                    <tr key={idx} className="border-b border-border last:border-0">
                      <td className="px-3 py-1.5 text-foreground-muted font-medium">{idx + 1}</td>
                      <td className="px-3 py-1.5 text-foreground">{agency.name}</td>
                      <td className="px-3 py-1.5 text-right text-foreground tabular-nums">
                        <div className="relative">
                          <div
                            className="absolute inset-0 bg-blue-500/20 rounded"
                            style={{ width: `${employeePercent}%`, right: 0 }}
                          />
                          <span className="relative z-10 font-medium">{agency.employees.toLocaleString()}</span>
                        </div>
                      </td>
                      <td className="px-3 py-1.5 text-right text-foreground tabular-nums font-medium">
                        {formatWage(agency.total_wages)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Section 4 — Data Source Note */}
      <div className="mb-3">
        <p className="text-[10px] text-foreground-muted">
          Data from Minnesota Management & Budget OpenCheckbook. FY2020–2025.
        </p>
      </div>
    </div>
  );
}
