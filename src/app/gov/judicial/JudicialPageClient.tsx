'use client';

import Link from 'next/link';
import Breadcrumbs from '@/components/civic/Breadcrumbs';
import PersonCard from '@/components/gov/PersonCard';
import type { CivicOrg, JudicialLeader, JudicialDistrict } from '@/features/civic/services/civicService';

interface Props {
  courts: (CivicOrg & { gov_type?: string | null })[];
  leaders: JudicialLeader[];
  districts: JudicialDistrict[];
}

const COURT_ORDER: Record<string, number> = {
  'mn-supreme-court': 1,
  'mn-court-appeals': 2,
  'mn-district-court': 3,
};

export default function JudicialPageClient({ courts, leaders, districts }: Props) {
  const sortedCourts = [...courts].sort(
    (a, b) => (COURT_ORDER[a.slug] ?? 9) - (COURT_ORDER[b.slug] ?? 9)
  );

  const supremeCourt = sortedCourts.find(c => c.slug === 'mn-supreme-court');
  const otherCourts = sortedCourts.filter(c => c.slug !== 'mn-supreme-court');

  const leadersByCourtSlug = leaders.reduce<Record<string, JudicialLeader[]>>((acc, l) => {
    if (!acc[l.court_slug]) acc[l.court_slug] = [];
    acc[l.court_slug].push(l);
    return acc;
  }, {});

  const supremeLeaders = leadersByCourtSlug['mn-supreme-court'] ?? [];
  const chiefJustice = supremeLeaders.find(l => l.title === 'Chief Justice');
  const associateJustices = supremeLeaders.filter(l => l.title !== 'Chief Justice');
  const appealsLeaders = leadersByCourtSlug['mn-court-appeals'] ?? [];

  return (
    <div className="max-w-4xl mx-auto px-[10px] py-3">
      <Breadcrumbs
        items={[
          { label: 'Minnesota', href: '/' },
          { label: 'Government', href: '/gov' },
          { label: 'Judicial Branch', href: null },
        ]}
      />

      <h1 className="text-sm font-semibold text-foreground mt-2">Judicial Branch</h1>
      <p className="text-xs text-foreground-muted mt-1">
        Minnesota&apos;s court system — Supreme Court, Court of Appeals, and District Courts across 10 judicial districts.
      </p>

      {/* Section 1 — Courts */}
      <div className="mt-4">
        <h2 className="text-xs font-semibold text-foreground mb-2">Courts</h2>

        {supremeCourt && (
          <Link
            href={`/gov/judicial/agency/${supremeCourt.slug}`}
            className="block border border-border rounded-md p-4 hover:bg-surface-muted transition-colors mb-2 bg-surface"
          >
            <div className="text-sm font-semibold text-foreground">{supremeCourt.name}</div>
            <div className="text-xs text-foreground-muted mt-0.5">Highest court in Minnesota</div>
          </Link>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {otherCourts.map(court => (
            <Link
              key={court.id}
              href={`/gov/judicial/agency/${court.slug}`}
              className="block border border-border rounded-md p-3 hover:bg-surface-muted transition-colors bg-surface"
            >
              <div className="text-xs font-medium text-foreground">{court.name}</div>
              {court.description && (
                <p className="text-[10px] text-foreground-muted mt-1 line-clamp-2">{court.description}</p>
              )}
            </Link>
          ))}
        </div>
      </div>

      {/* Section 2 — Leadership */}
      <div className="mt-6">
        <h2 className="text-xs font-semibold text-foreground mb-2">Leadership</h2>

        {supremeLeaders.length > 0 && (
          <div className="mb-4">
            <div className="text-[10px] font-semibold text-foreground-muted uppercase tracking-wide mb-1.5">
              Minnesota Supreme Court
            </div>

            {chiefJustice && (
              <PersonCard
                name={chiefJustice.name}
                photoUrl={chiefJustice.photo_url}
                title={chiefJustice.title}
                href={`/gov/judicial/person/${chiefJustice.slug ?? ''}`}
                avatarSize="md"
                className="mb-2"
              />
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {associateJustices.map(j => (
                <PersonCard
                  key={j.slug ?? j.name}
                  name={j.name}
                  photoUrl={j.photo_url}
                  title="Associate Justice"
                  href={`/gov/judicial/person/${j.slug ?? ''}`}
                  avatarSize="xs"
                />
              ))}
            </div>
          </div>
        )}

        {appealsLeaders.length > 0 && (
          <div>
            <div className="text-[10px] font-semibold text-foreground-muted uppercase tracking-wide mb-1.5">
              Minnesota Court of Appeals
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {appealsLeaders.map(j => (
                <PersonCard
                  key={j.slug ?? j.name}
                  name={j.name}
                  photoUrl={j.photo_url}
                  title={j.title}
                  href={`/gov/judicial/person/${j.slug ?? ''}`}
                  avatarSize="xs"
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Section 3 — Judicial Districts */}
      <div className="mt-6">
        <h2 className="text-xs font-semibold text-foreground mb-2">
          Judicial Districts ({districts.length})
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {districts.map(d => {
            const href = d.slug ? `/gov/jurisdictions/${d.slug}` : '/gov/judicial';
            return (
              <Link
                key={d.slug ?? d.district_number}
                href={href}
                className="block border border-border rounded-md p-3 bg-surface hover:bg-surface-muted transition-colors"
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold text-foreground font-mono w-5 shrink-0">
                    {d.district_number}
                  </span>
                  <span className="text-xs font-medium text-foreground">{d.name}</span>
                </div>
                {d.description && (
                  <p className="text-[10px] text-foreground-muted mt-1 leading-relaxed pl-7">
                    {d.description}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* District Courts note */}
      <div className="mt-6 border border-border rounded-md p-3 bg-surface-muted">
        <p className="text-xs text-foreground-muted">
          Minnesota has 87 county district courts across 10 judicial districts. Individual court data coming soon.
        </p>
      </div>
    </div>
  );
}
