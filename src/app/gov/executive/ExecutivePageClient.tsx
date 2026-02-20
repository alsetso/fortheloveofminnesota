'use client';

import Breadcrumbs from '@/components/civic/Breadcrumbs';
import PersonCard from '@/components/gov/PersonCard';
import OrgCard from '@/components/gov/OrgCard';
import type { CivicPerson, CivicRole, OrgWithBudget, CivicOrg } from '@/features/civic/services/civicService';

interface Officer {
  person: CivicPerson;
  role: CivicRole;
  org: CivicOrg & { gov_type?: string | null };
}

interface Props {
  officers: Officer[];
  departments: OrgWithBudget[];
  agencies: OrgWithBudget[];
  boards: OrgWithBudget[];
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

      <h1 className="text-sm font-semibold text-foreground mt-2">Executive Branch</h1>
      <p className="text-xs text-foreground-muted mt-1">
        Constitutional officers and state departments of Minnesota.
      </p>

      {/* Section 1: Constitutional Officers */}
      <div className="mt-4">
        <h2 className="text-xs font-semibold text-foreground mb-2">Constitutional Officers</h2>

        {/* Governor — featured card */}
        {governor && (
          <PersonCard
            name={governor.person.name}
            photoUrl={governor.person.photo_url}
            title={governor.role.title}
            party={governor.person.party}
            href={`/gov/executive/${governor.org.slug}`}
            avatarSize="lg"
            layout="row"
            className="mb-2 p-4"
          />
        )}

        {/* Other 4 officers — grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {otherOfficers.map((officer) => (
            <PersonCard
              key={officer.org.id}
              name={officer.person.name}
              photoUrl={officer.person.photo_url}
              title={officer.role.title}
              party={officer.person.party}
              href={`/gov/executive/${officer.org.slug}`}
              avatarSize="md"
              layout="col"
            />
          ))}
        </div>
      </div>

      {/* Section 2: Departments */}
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
                href={`/gov/executive/agency/${dept.slug}`}
                description={dept.description}
                govType={dept.gov_type}
                budgetAmount={dept.budget_amount}
                budgetYear={dept.budget_year}
              />
            ))}
        </div>
      </div>

      {/* Section 3: Agencies */}
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
                href={`/gov/executive/agency/${org.slug}`}
                description={org.description}
                govType={org.gov_type}
              />
            ))}
          </div>
        </div>
      )}

      {/* Section 4: Boards, Commissions & Councils */}
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
                href={`/gov/executive/agency/${org.slug}`}
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
