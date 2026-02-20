'use client';

import { useState } from 'react';
import Link from 'next/link';
import NewPageWrapper from '@/components/layout/NewPageWrapper';
import LeftSidebar from '@/components/layout/LeftSidebar';
import GovSubNav from '@/components/sub-nav/GovSubNav';
import Breadcrumbs from '@/components/civic/Breadcrumbs';
import PersonAvatar from '@/features/civic/components/PersonAvatar';
import type { CivicPerson, CivicOrg } from '@/features/civic/services/civicService';

interface Props {
  person: CivicPerson | null;
  roleTitle: string;
  departments: (CivicOrg & { gov_type?: string | null })[];
  agencies: (CivicOrg & { gov_type?: string | null })[];
  boards: (CivicOrg & { gov_type?: string | null })[];
}

function OrgCard({
  org,
  href,
}: {
  org: CivicOrg & { gov_type?: string | null };
  href: string;
}) {
  return (
    <Link
      href={href}
      className="block border border-gray-200 rounded-md p-3 hover:border-gray-300 hover:bg-gray-50 transition-colors"
    >
      <div className="text-xs font-medium text-gray-900 leading-snug">{org.name}</div>
      {org.description && (
        <p className="text-[10px] text-gray-500 mt-1 line-clamp-2">{org.description}</p>
      )}
    </Link>
  );
}

export default function GovernorPageClient({ person, roleTitle, departments, agencies, boards }: Props) {
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
            { label: 'Executive Branch', href: '/gov/executive' },
            { label: 'Governor', href: null },
          ]}
        />

        {/* Section 1 — Governor Profile */}
        <div className="mt-2 border border-gray-200 rounded-md p-4">
          {person ? (
            <div className="flex items-center gap-4">
              <PersonAvatar
                name={person.name}
                photoUrl={person.photo_url}
                size="lg"
              />
              <div>
                <h1 className="text-sm font-semibold text-gray-900">{person.name}</h1>
                <p className="text-xs text-gray-600 mt-0.5">{roleTitle}</p>
                {person.party && (
                  <span className={`text-[10px] font-medium mt-1 inline-block ${
                    person.party === 'DFL' ? 'text-blue-600' : 'text-red-600'
                  }`}>
                    {person.party}
                  </span>
                )}
                {person.slug && (
                  <div className="mt-2">
                    <Link
                      href={`/gov/person/${person.slug}`}
                      className="text-[10px] text-blue-600 hover:underline"
                    >
                      View full profile →
                    </Link>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400">Governor profile not available.</p>
          )}
        </div>

        {/* Section 2 — Departments */}
        <div className="mt-6">
          <h2 className="text-xs font-semibold text-gray-900 mb-2">
            Departments ({departments.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {departments.map((dept) => (
              <OrgCard
                key={dept.id}
                org={dept}
                href={`/gov/executive/departments/${dept.slug}`}
              />
            ))}
          </div>
        </div>

        {/* Section 3 — Agencies */}
        {agencies.length > 0 && (
          <div className="mt-6">
            <h2 className="text-xs font-semibold text-gray-900 mb-2">
              Agencies ({agencies.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {agencies.map((org) => (
                <OrgCard key={org.id} org={org} href={`/gov/org/${org.slug}`} />
              ))}
            </div>
          </div>
        )}

        {/* Section 3 — Boards, Commissions & Councils */}
        {boards.length > 0 && (
          <div className="mt-6">
            <h2 className="text-xs font-semibold text-gray-900 mb-2">
              Boards, Commissions &amp; Councils ({boards.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {boards.map((org) => (
                <OrgCard key={org.id} org={org} href={`/gov/org/${org.slug}`} />
              ))}
            </div>
          </div>
        )}
      </div>
    </NewPageWrapper>
  );
}
