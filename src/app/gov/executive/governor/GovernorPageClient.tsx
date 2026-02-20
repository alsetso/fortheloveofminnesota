'use client';

import Link from 'next/link';
import Breadcrumbs from '@/components/civic/Breadcrumbs';
import PersonAvatar from '@/features/civic/components/PersonAvatar';
import OrgCard from '@/components/gov/OrgCard';
import PartyBadge from '@/components/gov/PartyBadge';
import type { CivicPerson, OrgWithBudget } from '@/features/civic/services/civicService';

interface Props {
  person: CivicPerson | null;
  roleTitle: string;
  departments: OrgWithBudget[];
  agencies: OrgWithBudget[];
  boards: OrgWithBudget[];
}

export default function GovernorPageClient({ person, roleTitle, departments, agencies, boards }: Props) {
  return (
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
      <div className="mt-2 border border-border rounded-md p-4 bg-surface">
        {person ? (
          <div className="flex items-center gap-4">
            <PersonAvatar name={person.name} photoUrl={person.photo_url} size="lg" />
            <div>
              <h1 className="text-sm font-semibold text-foreground">{person.name}</h1>
              <p className="text-xs text-foreground-muted mt-0.5">{roleTitle}</p>
              <PartyBadge party={person.party} className="mt-1 inline-block" />
              {person.slug && (
                <div className="mt-2">
                  <Link href={`/gov/person/${person.slug}`} className="text-[10px] text-accent hover:underline">
                    View full profile →
                  </Link>
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs text-foreground-muted">Governor profile not available.</p>
        )}
      </div>

      {/* Section 2 — Departments */}
      <div className="mt-6">
        <h2 className="text-xs font-semibold text-foreground mb-2">
          Departments ({departments.length})
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {departments.map((dept) => (
            <OrgCard
              key={dept.id}
              name={dept.name}
              slug={dept.slug}
              href={`/gov/executive/departments/${dept.slug}`}
              description={dept.description}
              govType={dept.gov_type}
              budgetAmount={dept.budget_amount}
              budgetYear={dept.budget_year}
            />
          ))}
        </div>
      </div>

      {/* Section 3 — Agencies */}
      {agencies.length > 0 && (
        <div className="mt-6">
          <h2 className="text-xs font-semibold text-foreground mb-2">
            Agencies ({agencies.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {agencies.map((org) => (
              <OrgCard
                key={org.id}
                name={org.name}
                slug={org.slug}
                href={`/gov/org/${org.slug}`}
                description={org.description}
                govType={org.gov_type}
              />
            ))}
          </div>
        </div>
      )}

      {/* Section 4 — Boards, Commissions & Councils */}
      {boards.length > 0 && (
        <div className="mt-6">
          <h2 className="text-xs font-semibold text-foreground mb-2">
            Boards, Commissions &amp; Councils ({boards.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {boards.map((org) => (
              <OrgCard
                key={org.id}
                name={org.name}
                slug={org.slug}
                href={`/gov/org/${org.slug}`}
                description={org.description}
                govType={org.gov_type}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
