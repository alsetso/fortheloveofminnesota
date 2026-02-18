'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronRightIcon } from '@heroicons/react/24/outline';

interface City {
  id: string;
  feature_name: string;
  population?: number;
  acres?: number;
}

/**
 * Right sidebar — contextual facts for the selected scope.
 * State‑level: static Minnesota facts.
 * County‑level: aggregated from CTU data.
 */
export default function ExploreRightSidebar() {
  const searchParams = useSearchParams();
  const selectedCounty = searchParams.get('county');

  const [countyPlaces, setCountyPlaces] = useState<City[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedCounty) {
      setCountyPlaces([]);
      return;
    }
    setLoading(true);
    fetch(
      `/api/civic/ctu-boundaries?county_name=${encodeURIComponent(selectedCounty)}&limit=500`,
    )
      .then((r) => (r.ok ? r.json() : []))
      .then((data: City[]) => setCountyPlaces(Array.isArray(data) ? data : []))
      .catch(() => setCountyPlaces([]))
      .finally(() => setLoading(false));
  }, [selectedCounty]);

  const countyPop = countyPlaces.reduce((s, c) => s + (c.population ?? 0), 0);
  const countyAcres = countyPlaces.reduce((s, c) => s + (c.acres ?? 0), 0);

  return (
    <div className="h-full flex flex-col overflow-y-auto scrollbar-hide">
      {/* Header */}
      <div className="p-[10px] border-b border-border flex-shrink-0">
        <h2 className="text-sm font-semibold text-foreground">
          {selectedCounty ? `${selectedCounty} County` : 'At a Glance'}
        </h2>
        <p className="text-[10px] text-foreground-muted mt-0.5">
          {selectedCounty ? 'County overview' : 'Minnesota overview'}
        </p>
      </div>

      {/* Facts */}
      <div className="p-[10px] border-b border-border flex-shrink-0 space-y-1.5">
        {selectedCounty ? (
          loading ? (
            <div className="text-xs text-foreground-muted py-2">Loading…</div>
          ) : (
            <>
              <Row label="County" value={selectedCounty} />
              <Row label="Places" value={String(countyPlaces.length)} />
              {countyPop > 0 && <Row label="Population" value={countyPop.toLocaleString()} />}
              {countyAcres > 0 && (
                <Row
                  label="Area"
                  value={`${Math.round(countyAcres / 640).toLocaleString()} sq mi`}
                />
              )}
            </>
          )
        ) : (
          <>
            <Row label="State" value="Minnesota" />
            <Row label="Capital" value="Saint Paul" />
            <Row label="Largest City" value="Minneapolis" />
            <Row label="Population" value="5,706,494" />
            <Row label="Area" value="86,936 sq mi" />
            <Row label="Counties" value="87" />
            <Row label="Admitted" value="May 11, 1858" />
            <Row label="Nickname" value="North Star State" />
          </>
        )}
      </div>

      {/* Quick Links */}
      <div className="p-[10px] flex-shrink-0">
        <h3 className="text-xs font-semibold text-foreground mb-2">Quick Links</h3>
        <nav className="space-y-0.5">
          {[
            { label: 'Browse Counties', href: '/explore/counties' },
            { label: 'Browse Cities', href: '/explore/cities' },
            { label: 'Browse Towns', href: '/explore/towns' },
            { label: 'Congressional Districts', href: '/explore/congressional-districts' },
            { label: 'Minnesota News', href: '/news' },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center justify-between px-2 py-1.5 rounded text-xs text-foreground-muted hover:bg-surface-accent hover:text-foreground transition-colors"
            >
              {link.label}
              <ChevronRightIcon className="w-3 h-3" />
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-foreground-muted uppercase tracking-wider">{label}</span>
      <span className="text-xs font-medium text-foreground">{value}</span>
    </div>
  );
}
