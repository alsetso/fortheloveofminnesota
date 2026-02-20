'use client';

import Link from 'next/link';
import Breadcrumbs from '@/components/civic/Breadcrumbs';
import PersonAvatar from '@/features/civic/components/PersonAvatar';
import type { CivicPerson, CivicRole, CivicOrg } from '@/features/civic/services/civicService';

interface Officer {
  person: CivicPerson;
  role: CivicRole;
  org: CivicOrg & { gov_type?: string | null };
}

interface Props {
  officers: Officer[];
  departments: (CivicOrg & { gov_type?: string | null })[];
  agencies: (CivicOrg & { gov_type?: string | null })[];
  boards: (CivicOrg & { gov_type?: string | null })[];
}

function OrgCard({ org, basePath }: { org: CivicOrg & { gov_type?: string | null }; basePath: string }) {
  return (
    <Link
      href={`${basePath}/${org.slug}`}
      className="block border border-gray-200 rounded-md p-3 hover:border-gray-300 hover:bg-gray-50 transition-colors"
    >
      <div className="text-xs font-medium text-gray-900 leading-snug">{org.name}</div>
      {org.description && (
        <p className="text-[10px] text-gray-500 mt-1 line-clamp-2">{org.description}</p>
      )}
    </Link>
  );
}

export default function ExecutivePageClient({ officers, departments, agencies, boards }: Props) {
  const governor = officers[0];
  const otherOfficers = officers.slice(1);

  return (
    <div className="max-w-4xl mx-auto px-[10px] py-3">
        <Breadcrumbs
          items={[
            { label: 'Minnesota', href: '/' },
            { label: 'Government', href: '/gov' },
            { label: 'Executive Branch', href: null },
          ]}
        />

        <h1 className="text-sm font-semibold text-gray-900 mt-2">Executive Branch</h1>
        <p className="text-xs text-gray-600 mt-1">
          Constitutional officers and state departments of Minnesota.
        </p>

        {/* Section 1: Constitutional Officers */}
        <div className="mt-4">
          <h2 className="text-xs font-semibold text-gray-900 mb-2">Constitutional Officers</h2>

          {/* Governor — featured card */}
          {governor && (
            <Link
              href={`/gov/executive/${governor.org.slug}`}
              className="block border border-gray-200 rounded-md p-4 hover:border-gray-300 hover:bg-gray-50 transition-colors mb-2"
            >
              <div className="flex items-center gap-3">
                <PersonAvatar
                  name={governor.person.name}
                  photoUrl={governor.person.photo_url}
                  size="lg"
                />
                <div>
                  <div className="text-sm font-semibold text-gray-900">{governor.person.name}</div>
                  <div className="text-xs text-gray-600">{governor.role.title}</div>
                  {governor.person.party && (
                    <span className={`text-[10px] font-medium mt-0.5 inline-block ${
                      governor.person.party === 'DFL' ? 'text-blue-600' : 'text-red-600'
                    }`}>
                      {governor.person.party}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          )}

          {/* Other 4 officers — grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {otherOfficers.map((officer) => (
              <Link
                key={officer.org.id}
                href={`/gov/executive/${officer.org.slug}`}
                className="block border border-gray-200 rounded-md p-3 hover:border-gray-300 hover:bg-gray-50 transition-colors"
              >
                <div className="flex flex-col items-center text-center gap-1.5">
                  <PersonAvatar
                    name={officer.person.name}
                    photoUrl={officer.person.photo_url}
                    size="md"
                  />
                  <div>
                    <div className="text-xs font-medium text-gray-900 leading-tight">{officer.person.name}</div>
                    <div className="text-[10px] text-gray-500 leading-tight mt-0.5">{officer.role.title}</div>
                    {officer.person.party && (
                      <span className={`text-[10px] font-medium mt-0.5 inline-block ${
                        officer.person.party === 'DFL' ? 'text-blue-600' : 'text-red-600'
                      }`}>
                        {officer.person.party}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Section 2: Departments */}
        <div className="mt-6">
          <h2 className="text-xs font-semibold text-gray-900 mb-2">
            Departments ({departments.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {departments.map((dept) => (
              <OrgCard key={dept.id} org={dept} basePath="/gov/executive/departments" />
            ))}
          </div>
        </div>

        {/* Section 3: Agencies */}
        {agencies.length > 0 && (
          <div className="mt-6">
            <h2 className="text-xs font-semibold text-gray-900 mb-2">
              Agencies ({agencies.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {agencies.map((org) => (
                <OrgCard key={org.id} org={org} basePath="/gov/org" />
              ))}
            </div>
          </div>
        )}

        {/* Section 4: Boards, Commissions & Councils */}
        {boards.length > 0 && (
          <div className="mt-6">
            <h2 className="text-xs font-semibold text-gray-900 mb-2">
              Boards, Commissions &amp; Councils ({boards.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {boards.map((org) => (
                <OrgCard key={org.id} org={org} basePath="/gov/org" />
              ))}
            </div>
          </div>
        )}
    </div>
  );
}
