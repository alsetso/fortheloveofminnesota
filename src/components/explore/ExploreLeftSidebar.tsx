'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

interface County {
  id: string;
  county_name: string;
}

/**
 * Spatial navigator — 87 counties, click to scope the dashboard.
 * Reads/writes ?county= URL param.
 */
export default function ExploreLeftSidebar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedCounty = searchParams.get('county');

  const [counties, setCounties] = useState<County[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    fetch('/api/civic/county-boundaries?limit=87')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: County[]) => {
        const sorted = (Array.isArray(data) ? data : []).sort((a, b) =>
          (a.county_name || '').localeCompare(b.county_name || ''),
        );
        setCounties(sorted);
      })
      .catch(() => setCounties([]))
      .finally(() => setLoading(false));
  }, []);

  const visible = filter
    ? counties.filter((c) => c.county_name?.toLowerCase().includes(filter.toLowerCase()))
    : counties;

  function select(countyName: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (countyName) {
      params.set('county', countyName);
    } else {
      params.delete('county');
    }
    router.push(`/explore?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="h-full flex flex-col overflow-y-auto scrollbar-hide">
      {/* Header */}
      <div className="p-[10px] border-b border-border flex-shrink-0">
        <h2 className="text-sm font-semibold text-foreground">Navigate</h2>
        <p className="text-[10px] text-foreground-muted mt-0.5">87 counties</p>
      </div>

      {/* Filter */}
      <div className="p-[10px] border-b border-border flex-shrink-0">
        <div className="relative">
          <input
            type="text"
            placeholder="Filter counties…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full h-8 px-2.5 pl-8 bg-surface-accent rounded text-xs text-foreground placeholder:text-foreground-muted border-none focus:outline-none focus:ring-1 focus:ring-lake-blue"
          />
          <MagnifyingGlassIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground-muted" />
        </div>
      </div>

      {/* All Minnesota */}
      <button
        onClick={() => select(null)}
        className={`w-full text-left px-[10px] py-2 text-xs border-b border-border transition-colors ${
          !selectedCounty
            ? 'bg-surface-accent font-semibold text-foreground'
            : 'text-foreground-muted hover:bg-surface-accent hover:text-foreground'
        }`}
      >
        All Minnesota
      </button>

      {/* County list — hidden scrollbar for app-like feel */}
      <div className="flex-1 overflow-y-auto scrollbar-hide min-h-0">
        {loading ? (
          <div className="p-[10px] text-xs text-foreground-muted">Loading…</div>
        ) : visible.length === 0 ? (
          <div className="p-[10px] text-xs text-foreground-muted">No match</div>
        ) : (
          visible.map((county) => (
            <button
              key={county.id}
              onClick={() => select(county.county_name)}
              className={`w-full text-left px-[10px] py-1.5 text-xs transition-colors ${
                selectedCounty === county.county_name
                  ? 'bg-surface-accent font-medium text-foreground'
                  : 'text-foreground-muted hover:bg-surface-accent hover:text-foreground'
              }`}
            >
              {county.county_name}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
