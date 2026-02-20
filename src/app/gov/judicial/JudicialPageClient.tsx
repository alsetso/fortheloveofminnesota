'use client';

import Link from 'next/link';
import Breadcrumbs from '@/components/civic/Breadcrumbs';
import PersonAvatar from '@/features/civic/components/PersonAvatar';
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

  // Group leaders by court
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

        <h1 className="text-sm font-semibold text-gray-900 mt-2">Judicial Branch</h1>
        <p className="text-xs text-gray-600 mt-1">
          Minnesota&apos;s court system — Supreme Court, Court of Appeals, and District Courts across 10 judicial districts.
        </p>

        {/* Section 1 — Courts */}
        <div className="mt-4">
          <h2 className="text-xs font-semibold text-gray-900 mb-2">Courts</h2>

          {/* Supreme Court — featured */}
          {supremeCourt && (
            <Link
              href={`/gov/org/${supremeCourt.slug}`}
              className="block border border-gray-200 rounded-md p-4 hover:border-gray-300 hover:bg-gray-50 transition-colors mb-2"
            >
              <div className="text-sm font-semibold text-gray-900">{supremeCourt.name}</div>
              <div className="text-xs text-gray-500 mt-0.5">Highest court in Minnesota</div>
            </Link>
          )}

          {/* Court of Appeals + District Court */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {otherCourts.map(court => (
              <Link
                key={court.id}
                href={`/gov/org/${court.slug}`}
                className="block border border-gray-200 rounded-md p-3 hover:border-gray-300 hover:bg-gray-50 transition-colors"
              >
                <div className="text-xs font-medium text-gray-900">{court.name}</div>
                {court.description && (
                  <p className="text-[10px] text-gray-500 mt-1 line-clamp-2">{court.description}</p>
                )}
              </Link>
            ))}
          </div>
        </div>

        {/* Section 2 — Leadership */}
        <div className="mt-6">
          <h2 className="text-xs font-semibold text-gray-900 mb-2">Leadership</h2>

          {/* Supreme Court group */}
          {supremeLeaders.length > 0 && (
            <div className="mb-4">
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Minnesota Supreme Court
              </div>

              {/* Chief Justice — featured */}
              {chiefJustice && (
                <Link
                  href={`/gov/person/${chiefJustice.slug ?? ''}`}
                  className="flex items-center gap-3 border border-gray-200 rounded-md p-3 hover:border-gray-300 hover:bg-gray-50 transition-colors mb-2"
                >
                  <PersonAvatar name={chiefJustice.name} photoUrl={chiefJustice.photo_url} size="md" />
                  <div>
                    <div className="text-xs font-semibold text-gray-900">{chiefJustice.name}</div>
                    <div className="text-[10px] text-gray-500">{chiefJustice.title}</div>
                  </div>
                </Link>
              )}

              {/* Associate Justices grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {associateJustices.map(j => (
                  <Link
                    key={j.slug ?? j.name}
                    href={`/gov/person/${j.slug ?? ''}`}
                    className="flex items-center gap-2 border border-gray-200 rounded-md p-2.5 hover:border-gray-300 hover:bg-gray-50 transition-colors"
                  >
                    <PersonAvatar name={j.name} photoUrl={j.photo_url} size="xs" />
                    <div>
                      <div className="text-xs font-medium text-gray-900 leading-tight">{j.name}</div>
                      <div className="text-[10px] text-gray-500">Associate Justice</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Court of Appeals group */}
          {appealsLeaders.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Minnesota Court of Appeals
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {appealsLeaders.map(j => (
                  <Link
                    key={j.slug ?? j.name}
                    href={`/gov/person/${j.slug ?? ''}`}
                    className="flex items-center gap-2 border border-gray-200 rounded-md p-2.5 hover:border-gray-300 hover:bg-gray-50 transition-colors"
                  >
                    <PersonAvatar name={j.name} photoUrl={j.photo_url} size="xs" />
                    <div>
                      <div className="text-xs font-medium text-gray-900 leading-tight">{j.name}</div>
                      <div className="text-[10px] text-gray-500">{j.title}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Section 3 — Judicial Districts */}
        <div className="mt-6">
          <h2 className="text-xs font-semibold text-gray-900 mb-2">
            Judicial Districts ({districts.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {districts.map(d => (
              <div
                key={d.slug}
                className="border border-gray-200 rounded-md p-3"
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold text-gray-900 font-mono w-5 shrink-0">{d.district_number}</span>
                  <span className="text-xs font-medium text-gray-900">{d.name}</span>
                </div>
                {d.description && (
                  <p className="text-[10px] text-gray-500 mt-1 leading-relaxed pl-7">{d.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Section 4 — District Courts note */}
        <div className="mt-6 border border-gray-200 rounded-md p-3 bg-gray-50">
          <p className="text-xs text-gray-600">
            Minnesota has 87 county district courts across 10 judicial districts. Individual court data coming soon.
          </p>
        </div>
    </div>
  );
}
