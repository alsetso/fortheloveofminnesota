'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { useGovSidebar } from '@/contexts/GovSidebarContext';

// ─── Shared primitives ───────────────────────────────────────────────────────

function SidebarSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-medium text-foreground-muted uppercase tracking-wider px-2 mb-1">
        {label}
      </p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function SidebarLink({ href, children, muted }: { href: string; children: React.ReactNode; muted?: boolean }) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + '/');
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 px-2 py-1.5 text-xs rounded-md transition-colors ${
        isActive
          ? 'bg-surface-accent text-foreground font-medium'
          : muted
          ? 'text-foreground-muted/70 hover:bg-surface-accent hover:text-foreground'
          : 'text-foreground-muted hover:bg-surface-accent hover:text-foreground'
      }`}
    >
      {children}
    </Link>
  );
}

function CollapsibleSection({
  label,
  count,
  children,
  defaultOpen = false,
}: {
  label: string;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full px-2 py-1.5 text-xs text-foreground-muted hover:text-foreground hover:bg-surface-accent rounded-md transition-colors"
      >
        <span>
          {label}
          {count !== undefined && (
            <span className="ml-1 text-[10px] text-foreground-muted/60">({count})</span>
          )}
        </span>
        {open ? (
          <ChevronDownIcon className="w-3 h-3 flex-shrink-0" />
        ) : (
          <ChevronRightIcon className="w-3 h-3 flex-shrink-0" />
        )}
      </button>
      {open && <div className="ml-2 mt-0.5 space-y-0.5 border-l border-border-muted dark:border-white/10 pl-2">{children}</div>}
    </div>
  );
}

function Divider() {
  return <div className="border-t border-border-muted dark:border-white/10 my-2" />;
}

// ─── Route panels ────────────────────────────────────────────────────────────

/** /gov/executive */
function ExecutivePanel() {
  return (
    <div className="p-2 space-y-3">
      <SidebarSection label="Constitutional Officers">
        <SidebarLink href="/gov/executive/agency/governor">Governor</SidebarLink>
        <SidebarLink href="/gov/executive/agency/lieutenant-governor">Lt. Governor</SidebarLink>
        <SidebarLink href="/gov/executive/agency/attorney-general">Attorney General</SidebarLink>
        <SidebarLink href="/gov/executive/agency/secretary-of-state">Secretary of State</SidebarLink>
        <SidebarLink href="/gov/executive/agency/state-auditor">State Auditor</SidebarLink>
      </SidebarSection>
      <Divider />
      <SidebarSection label="Agencies">
        <CollapsibleSection label="Departments" defaultOpen={false}>
          <SidebarLink href="/gov/executive/agency/dept-administration">Administration</SidebarLink>
          <SidebarLink href="/gov/executive/agency/dept-agriculture">Agriculture</SidebarLink>
          <SidebarLink href="/gov/executive/agency/dept-commerce">Commerce</SidebarLink>
          <SidebarLink href="/gov/executive/agency/dept-corrections">Corrections</SidebarLink>
          <SidebarLink href="/gov/executive/agency/dept-education">Education</SidebarLink>
          <SidebarLink href="/gov/executive/agency/dept-employment-economic-development">Employment &amp; Economic Dev.</SidebarLink>
          <SidebarLink href="/gov/executive/agency/dept-health">Health</SidebarLink>
          <SidebarLink href="/gov/executive/agency/dept-human-rights">Human Rights</SidebarLink>
          <SidebarLink href="/gov/executive/agency/dept-human-services">Human Services</SidebarLink>
          <SidebarLink href="/gov/executive/agency/dept-labor-industry">Labor &amp; Industry</SidebarLink>
          <SidebarLink href="/gov/executive/agency/dept-management-budget">Management &amp; Budget</SidebarLink>
          <SidebarLink href="/gov/executive/agency/dept-military-affairs">Military Affairs</SidebarLink>
          <SidebarLink href="/gov/executive/agency/dept-natural-resources">Natural Resources</SidebarLink>
          <SidebarLink href="/gov/executive/agency/dept-public-safety">Public Safety</SidebarLink>
          <SidebarLink href="/gov/executive/agency/dept-revenue">Revenue</SidebarLink>
          <SidebarLink href="/gov/executive/agency/dept-transportation">Transportation</SidebarLink>
          <SidebarLink href="/gov/executive/agency/dept-veterans-affairs">Veterans Affairs</SidebarLink>
          <SidebarLink href="/gov/executive/agency/office-mnit">MN.IT Services</SidebarLink>
          <SidebarLink href="/gov/executive/agency/dept-children-youth-families">Children, Youth &amp; Families</SidebarLink>
          <SidebarLink href="/gov/executive/agency/dept-direct-care-treatment">Direct Care &amp; Treatment</SidebarLink>
        </CollapsibleSection>
        <CollapsibleSection label="Agencies &amp; Boards">
          <SidebarLink href="/gov/directory">View all →</SidebarLink>
        </CollapsibleSection>
      </SidebarSection>
    </div>
  );
}

/** /gov/executive/agency/governor */
function GovernorPanel() {
  return (
    <div className="p-2 space-y-3">
      <SidebarSection label="Office">
        <SidebarLink href="/gov/executive/person/tim-walz">Tim Walz</SidebarLink>
        <SidebarLink href="/gov/executive/agency/governor">Governor&apos;s Office</SidebarLink>
      </SidebarSection>
      <Divider />
      <SidebarSection label="Departments">
        <CollapsibleSection label="All Departments (20)" defaultOpen={true}>
          <SidebarLink href="/gov/executive/agency/dept-administration">Administration</SidebarLink>
          <SidebarLink href="/gov/executive/agency/dept-agriculture">Agriculture</SidebarLink>
          <SidebarLink href="/gov/executive/agency/dept-commerce">Commerce</SidebarLink>
          <SidebarLink href="/gov/executive/agency/dept-corrections">Corrections</SidebarLink>
          <SidebarLink href="/gov/executive/agency/dept-education">Education</SidebarLink>
          <SidebarLink href="/gov/executive/agency/dept-employment-economic-development">Employment &amp; Econ. Dev.</SidebarLink>
          <SidebarLink href="/gov/executive/agency/dept-health">Health</SidebarLink>
          <SidebarLink href="/gov/executive/agency/dept-human-rights">Human Rights</SidebarLink>
          <SidebarLink href="/gov/executive/agency/dept-human-services">Human Services</SidebarLink>
          <SidebarLink href="/gov/executive/agency/dept-labor-industry">Labor &amp; Industry</SidebarLink>
          <SidebarLink href="/gov/executive/agency/dept-management-budget">Management &amp; Budget</SidebarLink>
          <SidebarLink href="/gov/executive/agency/dept-military-affairs">Military Affairs</SidebarLink>
          <SidebarLink href="/gov/executive/agency/dept-natural-resources">Natural Resources</SidebarLink>
          <SidebarLink href="/gov/executive/agency/dept-public-safety">Public Safety</SidebarLink>
          <SidebarLink href="/gov/executive/agency/dept-revenue">Revenue</SidebarLink>
          <SidebarLink href="/gov/executive/agency/dept-transportation">Transportation</SidebarLink>
          <SidebarLink href="/gov/executive/agency/dept-veterans-affairs">Veterans Affairs</SidebarLink>
          <SidebarLink href="/gov/executive/agency/office-mnit">MN.IT Services</SidebarLink>
          <SidebarLink href="/gov/executive/agency/dept-children-youth-families">Children, Youth &amp; Families</SidebarLink>
          <SidebarLink href="/gov/executive/agency/dept-direct-care-treatment">Direct Care &amp; Treatment</SidebarLink>
        </CollapsibleSection>
      </SidebarSection>
      <Divider />
      <SidebarSection label="More">
        <SidebarLink href="/gov/directory">All Agencies &amp; Boards</SidebarLink>
      </SidebarSection>
    </div>
  );
}

/** /gov/executive/agency/:slug (constitutional officer agency pages) */
function OfficerPanel({ slug }: { slug: string }) {
  const officerLabels: Record<string, string> = {
    'lieutenant-governor': 'Lt. Governor',
    'attorney-general': 'Attorney General',
    'secretary-of-state': 'Secretary of State',
    'state-auditor': 'State Auditor',
  };
  const label = officerLabels[slug] ?? slug;
  return (
    <div className="p-2 space-y-3">
      <SidebarSection label="This Office">
        <SidebarLink href={`/gov/executive/agency/${slug}`}>{label}</SidebarLink>
      </SidebarSection>
      <Divider />
      <SidebarSection label="Executive Branch">
        <SidebarLink href="/gov/executive">← All Officers</SidebarLink>
        <SidebarLink href="/gov/executive/agency/governor">Governor</SidebarLink>
        <SidebarLink href="/gov/executive/agency/lieutenant-governor">Lt. Governor</SidebarLink>
        <SidebarLink href="/gov/executive/agency/attorney-general">Attorney General</SidebarLink>
        <SidebarLink href="/gov/executive/agency/secretary-of-state">Secretary of State</SidebarLink>
        <SidebarLink href="/gov/executive/agency/state-auditor">State Auditor</SidebarLink>
      </SidebarSection>
    </div>
  );
}

/** /gov/judicial */
function JudicialPanel() {
  return (
    <div className="p-2 space-y-3">
      <SidebarSection label="Courts">
        <SidebarLink href="/gov/judicial/agency/mn-supreme-court">Supreme Court</SidebarLink>
        <SidebarLink href="/gov/judicial/agency/mn-court-appeals">Court of Appeals</SidebarLink>
        <SidebarLink href="/gov/judicial/agency/mn-district-court">District Court</SidebarLink>
      </SidebarSection>
      <Divider />
      <SidebarSection label="Judicial Districts">
        <CollapsibleSection label="10 Districts" defaultOpen={false}>
          <SidebarLink href="/gov/judicial/agency/judicial-district-1">District 1</SidebarLink>
          <SidebarLink href="/gov/judicial/agency/judicial-district-2">District 2</SidebarLink>
          <SidebarLink href="/gov/judicial/agency/judicial-district-3">District 3</SidebarLink>
          <SidebarLink href="/gov/judicial/agency/judicial-district-4">District 4</SidebarLink>
          <SidebarLink href="/gov/judicial/agency/judicial-district-5">District 5</SidebarLink>
          <SidebarLink href="/gov/judicial/agency/judicial-district-6">District 6</SidebarLink>
          <SidebarLink href="/gov/judicial/agency/judicial-district-7">District 7</SidebarLink>
          <SidebarLink href="/gov/judicial/agency/judicial-district-8">District 8</SidebarLink>
          <SidebarLink href="/gov/judicial/agency/judicial-district-9">District 9</SidebarLink>
          <SidebarLink href="/gov/judicial/agency/judicial-district-10">District 10</SidebarLink>
        </CollapsibleSection>
      </SidebarSection>
    </div>
  );
}

/** /gov/[branch]/agency/:slug */
function OrgPanel() {
  const { data } = useGovSidebar();
  const branch = data.branch ?? 'executive';
  const {
    orgName,
    orgSlug,
    parentOrg,
    leaders,
    building,
    budgetAmount,
    budgetYear,
    website,
  } = data;

  const formatBudget = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount);

  if (!orgSlug) return null;

  return (
    <div className="p-2 space-y-3">
      {/* Header */}
      <div className="px-2 pt-1">
        {parentOrg && (
          <Link
            href={`/gov/${branch}/agency/${parentOrg.slug}`}
            className="text-[10px] text-foreground-muted hover:text-foreground hover:underline block mb-1"
          >
            ← {parentOrg.name ?? 'Parent'}
          </Link>
        )}
        {!parentOrg && (
          <Link
            href={`/gov/${branch}`}
            className="text-[10px] text-foreground-muted hover:text-foreground hover:underline block mb-1"
          >
            ← {branch === 'executive' ? 'Executive' : branch === 'legislative' ? 'Legislative' : 'Judicial'} Branch
          </Link>
        )}
        {orgName && (
          <p className="text-xs font-semibold text-foreground leading-snug">{orgName}</p>
        )}
      </div>

      <Divider />

      {/* Leadership */}
      {leaders && leaders.length > 0 && (
        <SidebarSection label="Leadership">
          {leaders.map((l) => (
            <SidebarLink key={l.slug ?? l.name} href={l.slug ? `/gov/${branch}/person/${l.slug}` : '#'}>
              <span className="truncate">{l.name}</span>
              <span className="text-[10px] text-foreground-muted/70 ml-auto truncate">{l.title}</span>
            </SidebarLink>
          ))}
        </SidebarSection>
      )}

      {/* Building */}
      {building && (
        <SidebarSection label="Location">
          <SidebarLink href={`/gov/${branch}/building/${building.slug ?? ''}`}>
            {building.name ?? 'Building'}
          </SidebarLink>
        </SidebarSection>
      )}

      {/* Budget */}
      {budgetAmount !== undefined && budgetAmount !== null && budgetAmount > 0 && (
        <SidebarSection label={`Budget${budgetYear ? ` FY${budgetYear}` : ''}`}>
          <div className="px-2 py-1 text-xs text-foreground">
            {formatBudget(budgetAmount)}
          </div>
        </SidebarSection>
      )}

      {/* Website */}
      {website && (
        <SidebarSection label="Links">
          <a
            href={website}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-2 py-1.5 text-xs rounded-md text-foreground-muted hover:bg-surface-accent hover:text-foreground transition-colors"
          >
            Official Website →
          </a>
        </SidebarSection>
      )}
    </div>
  );
}

/** /gov/[branch]/person/:slug */
function PersonPanel() {
  const { data } = useGovSidebar();
  const branch = data.branch ?? 'executive';
  const { personName, primaryOrg, roleTitle, contact, personBuilding } = data;

  if (!personName) return null;

  return (
    <div className="p-2 space-y-3">
      <div className="px-2 pt-1">
        {primaryOrg && (
          <Link
            href={`/gov/${branch}/agency/${primaryOrg.slug}`}
            className="text-[10px] text-foreground-muted hover:text-foreground hover:underline block mb-1"
          >
            ← {primaryOrg.name ?? 'Organization'}
          </Link>
        )}
        <p className="text-xs font-semibold text-foreground leading-snug">{personName}</p>
        {roleTitle && (
          <p className="text-[10px] text-foreground-muted mt-0.5">{roleTitle}</p>
        )}
      </div>

      <Divider />

      {/* Contact */}
      {contact && (contact.email || contact.phone) && (
        <SidebarSection label="Contact">
          {contact.email && (
            <a
              href={`mailto:${contact.email}`}
              className="flex items-center gap-2 px-2 py-1.5 text-xs rounded-md text-foreground-muted hover:bg-surface-accent hover:text-foreground transition-colors break-all"
            >
              {contact.email}
            </a>
          )}
          {contact.phone && (
            <a
              href={`tel:${contact.phone.replace(/[^+\d]/g, '')}`}
              className="flex items-center gap-2 px-2 py-1.5 text-xs rounded-md text-foreground-muted hover:bg-surface-accent hover:text-foreground transition-colors"
            >
              {contact.phone}
            </a>
          )}
        </SidebarSection>
      )}

      {/* Building */}
      {personBuilding && (
        <SidebarSection label="Location">
          <SidebarLink href={`/gov/${branch}/building/${personBuilding.slug ?? ''}`}>
            {personBuilding.name ?? 'Building'}
          </SidebarLink>
        </SidebarSection>
      )}

      {/* Org link */}
      {primaryOrg && (
        <SidebarSection label="Organization">
          <SidebarLink href={`/gov/${branch}/agency/${primaryOrg.slug}`}>
            {primaryOrg.name ?? 'Organization'}
          </SidebarLink>
        </SidebarSection>
      )}
    </div>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * GovContextSidebar — route-aware contextual panel rendered below GovSubNav
 * within the sub-sidebar. Uses usePathname() to detect the current route and
 * useGovSidebar() to read page-specific data broadcast by server pages.
 */
export default function GovContextSidebar() {
  const pathname = usePathname();

  if (pathname === '/gov') return null;

  // /gov/executive/agency/governor
  if (pathname === '/gov/executive/agency/governor') {
    return (
      <>
        <Divider />
        <GovernorPanel />
      </>
    );
  }

  // /gov/executive/agency/:slug (constitutional officer agency pages)
  const execAgencyMatch = pathname.match(/^\/gov\/executive\/agency\/([^/]+)$/);
  if (execAgencyMatch) {
    const slug = execAgencyMatch[1];
    if (['lieutenant-governor', 'attorney-general', 'secretary-of-state', 'state-auditor'].includes(slug)) {
      return (
        <>
          <Divider />
          <OfficerPanel slug={slug} />
        </>
      );
    }
  }

  // /gov/executive (index)
  if (pathname === '/gov/executive') {
    return (
      <>
        <Divider />
        <ExecutivePanel />
      </>
    );
  }

  // /gov/judicial
  if (pathname === '/gov/judicial' || pathname.startsWith('/gov/judicial/')) {
    return (
      <>
        <Divider />
        <JudicialPanel />
      </>
    );
  }

  // /gov/[branch]/agency/:slug
  if (/^\/gov\/(executive|legislative|judicial)\/agency\//.test(pathname)) {
    return (
      <>
        <Divider />
        <OrgPanel />
      </>
    );
  }

  // /gov/[branch]/person/:slug
  if (/^\/gov\/(executive|legislative|judicial)\/person\//.test(pathname)) {
    return (
      <>
        <Divider />
        <PersonPanel />
      </>
    );
  }

  return null;
}
