'use client';

import Link from 'next/link';
import Breadcrumbs from '@/components/civic/Breadcrumbs';
import GovBadge from '@/components/gov/GovBadge';
import type { CivicOrg } from '@/features/civic/services/civicService';

const BRANCHES = ['executive', 'legislative', 'judicial'] as const;
type BranchSlug = (typeof BRANCHES)[number];

interface BranchPageClientProps {
  branch: BranchSlug;
  orgs: (CivicOrg & { gov_type?: string | null })[];
}

export default function BranchPageClient({ branch, orgs }: BranchPageClientProps) {
  const branchLabel = branch.charAt(0).toUpperCase() + branch.slice(1);
  return (
    <div className="max-w-4xl mx-auto px-[10px] py-3">
      <Breadcrumbs
        items={[
          { label: 'Minnesota', href: '/' },
          { label: 'Government', href: '/gov' },
          { label: `${branchLabel} Branch`, href: null },
        ]}
      />
      <h1 className="text-sm font-semibold text-foreground mt-2">{branchLabel} Branch</h1>
      <p className="text-xs text-foreground-muted mt-1">
        Organizations in the Minnesota state {branch} branch.
      </p>
      <ul className="mt-3 space-y-1.5">
        {orgs.map((org) => (
          <li key={org.id} className="flex items-center gap-2">
            <Link href={`/gov/org/${org.slug}`} className="text-xs text-accent hover:underline">
              {org.name}
            </Link>
            {org.gov_type && <GovBadge label={org.gov_type} />}
          </li>
        ))}
      </ul>
    </div>
  );
}
