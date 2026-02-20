'use client';

import { useState } from 'react';
import Link from 'next/link';
import NewPageWrapper from '@/components/layout/NewPageWrapper';
import LeftSidebar from '@/components/layout/LeftSidebar';
import GovSubNav from '@/components/sub-nav/GovSubNav';
import Breadcrumbs from '@/components/civic/Breadcrumbs';
import type { CivicOrg } from '@/features/civic/services/civicService';

const BRANCHES = ['executive', 'legislative', 'judicial'] as const;
type BranchSlug = (typeof BRANCHES)[number];

interface BranchPageClientProps {
  branch: BranchSlug;
  orgs: (CivicOrg & { gov_type?: string | null })[];
}

export default function BranchPageClient({ branch, orgs }: BranchPageClientProps) {
  const [subSidebarOpen, setSubSidebarOpen] = useState(true);

  return (
    <NewPageWrapper
      leftSidebar={<LeftSidebar />}
      subSidebar={<GovSubNav />}
      subSidebarLabel="Government"
      subSidebarOpen={subSidebarOpen}
      onSubSidebarOpenChange={setSubSidebarOpen}
    >
      <div className="max-w-4xl mx-auto px-[10px] py-3">
        <Breadcrumbs
          items={[
            { label: 'Minnesota', href: '/' },
            { label: 'Government', href: '/gov' },
            { label: `${branch.charAt(0).toUpperCase() + branch.slice(1)} Branch`, href: null },
          ]}
        />
        <h1 className="text-sm font-semibold text-gray-900 mt-2">
          {branch.charAt(0).toUpperCase() + branch.slice(1)} Branch
        </h1>
        <p className="text-xs text-gray-600 mt-1">
          Organizations in the Minnesota state {branch} branch.
        </p>
        <ul className="mt-3 space-y-1">
          {orgs.map((org) => (
            <li key={org.id}>
              <Link
                href={`/gov/org/${org.slug}`}
                className="text-xs text-blue-600 hover:underline"
              >
                {org.name}
              </Link>
              {org.gov_type && (
                <span className="text-[10px] text-gray-500 ml-1.5">({org.gov_type})</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </NewPageWrapper>
  );
}
