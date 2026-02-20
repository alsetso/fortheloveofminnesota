'use client';

import Link from 'next/link';
import Breadcrumbs from '@/components/civic/Breadcrumbs';
import PersonAvatar from '@/features/civic/components/PersonAvatar';
import PartyBadge from '@/components/gov/PartyBadge';
import type { CivicPerson } from '@/features/civic/services/civicService';

interface Props {
  orgName: string;
  orgSlug: string;
  person: CivicPerson | null;
  roleTitle: string;
}

export default function OfficerPageClient({ orgName, person, roleTitle }: Props) {
  return (
    <div className="max-w-4xl mx-auto px-[10px] py-3">
      <Breadcrumbs
        items={[
          { label: 'Minnesota', href: '/' },
          { label: 'Government', href: '/gov' },
          { label: 'Executive Branch', href: '/gov/executive' },
          { label: orgName, href: null },
        ]}
      />

      {/* Profile Card */}
      <div className="mt-2 border border-border rounded-md p-4 bg-surface">
        {person ? (
          <div className="flex items-center gap-4">
            <PersonAvatar name={person.name} photoUrl={person.photo_url} size="lg" />
            <div>
              <h1 className="text-sm font-semibold text-foreground">{person.name}</h1>
              <p className="text-xs text-foreground-muted mt-0.5">{roleTitle}</p>
              <PartyBadge party={person.party} className="mt-1 inline-block" />
              {person.email && (
                <div className="mt-1.5">
                  <a href={`mailto:${person.email}`} className="text-[10px] text-accent hover:underline">
                    {person.email}
                  </a>
                </div>
              )}
              {person.slug && (
                <div className="mt-1.5">
                  <Link href={`/gov/person/${person.slug}`} className="text-[10px] text-accent hover:underline">
                    View full profile →
                  </Link>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div>
            <h1 className="text-sm font-semibold text-foreground">{orgName}</h1>
            <p className="text-xs text-foreground-muted mt-1">No officeholder on record.</p>
          </div>
        )}
      </div>

      <div className="mt-4 text-[10px] text-foreground-muted">
        No sub-organizations on record for this office.
      </div>

      <div className="mt-4">
        <Link href="/gov/executive" className="text-xs text-accent hover:underline">
          ← Back to Executive Branch
        </Link>
      </div>
    </div>
  );
}
