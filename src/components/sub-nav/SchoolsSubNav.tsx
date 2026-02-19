'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  MagnifyingGlassIcon,
  AcademicCapIcon,
  BuildingOfficeIcon,
  MapIcon,
} from '@heroicons/react/24/outline';

interface SearchResult {
  id: string;
  type: 'school' | 'place';
  title: string;
  subtitle: string | null;
  slug: string | null;
  score: number;
}

interface District {
  id: string;
  name: string;
  school_count: number;
}

export default function SchoolsSubNav() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [districts, setDistricts] = useState<District[]>([]);
  const [districtsLoading, setDistrictsLoading] = useState(true);
  const [districtFilter, setDistrictFilter] = useState('');

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/atlas/districts');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setDistricts(data.districts ?? []);
      } catch {
        /* noop */
      } finally {
        if (!cancelled) setDistrictsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const search = useCallback(async (term: string) => {
    const trimmed = term.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setIsSearching(true);

    try {
      const res = await fetch(
        `/api/search/unified?q=${encodeURIComponent(trimmed)}&limit=8`,
        { signal: abortRef.current.signal },
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      const schoolResults = (data.results ?? []).filter(
        (r: SearchResult) => r.type === 'school',
      );
      setResults(schoolResults);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length >= 2) {
      debounceRef.current = setTimeout(() => search(query), 200);
    } else {
      setResults([]);
    }

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  const filteredDistricts = districtFilter.trim()
    ? districts.filter((d) =>
        d.name.toLowerCase().includes(districtFilter.toLowerCase()),
      )
    : districts;

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-border-muted dark:border-white/10">
        <Link href="/schools" className="block">
          <h2 className="text-xs font-semibold text-foreground">Schools</h2>
          <p className="text-[10px] text-foreground-muted mt-0.5">Search & browse MN schools</p>
        </Link>
      </div>

      {/* School search */}
      <div className="p-2 border-b border-border-muted dark:border-white/10">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none">
            <MagnifyingGlassIcon className="w-3 h-3 text-foreground-muted" />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a school..."
            className="w-full py-1.5 pl-7 pr-2 text-xs text-foreground placeholder:text-foreground-muted bg-surface-accent rounded-md border-none focus:outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-white/20"
          />
          {isSearching && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
              <div className="w-3 h-3 border-[1.5px] border-gray-300 border-t-gray-700 rounded-full animate-spin" />
            </div>
          )}
        </div>

        {results.length > 0 && (
          <div className="mt-1 space-y-0.5">
            {results.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setQuery('');
                  setResults([]);
                  if (r.slug) router.push(`/school/${r.slug}`);
                }}
                className="w-full text-left flex items-center gap-2 px-2 py-1.5 text-xs rounded-md hover:bg-surface-accent transition-colors"
              >
                <AcademicCapIcon className="w-3.5 h-3.5 text-foreground-muted flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground truncate">{r.title}</p>
                  {r.subtitle && (
                    <p className="text-[10px] text-foreground-muted truncate">{r.subtitle}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {query.trim().length >= 2 && !isSearching && results.length === 0 && (
          <p className="mt-1 px-2 text-[10px] text-foreground-muted">No schools found</p>
        )}
      </div>

      {/* Browse links */}
      <div className="p-2 border-b border-border-muted dark:border-white/10 space-y-0.5">
        <p className="text-[10px] font-medium text-foreground-muted uppercase tracking-wider px-2 mb-1">
          Browse
        </p>
        <Link
          href="/explore/schools"
          className="flex items-center gap-2 px-2 py-1.5 text-xs rounded-md text-foreground-muted hover:bg-surface-accent hover:text-foreground transition-colors"
        >
          <AcademicCapIcon className="w-3.5 h-3.5 flex-shrink-0" />
          <span>All Schools</span>
          <span className="ml-auto text-[10px] text-foreground-muted">1,184</span>
        </Link>
        <Link
          href="/explore/school-districts"
          className="flex items-center gap-2 px-2 py-1.5 text-xs rounded-md text-foreground-muted hover:bg-surface-accent hover:text-foreground transition-colors"
        >
          <MapIcon className="w-3.5 h-3.5 flex-shrink-0" />
          <span>District Map</span>
        </Link>
      </div>

      {/* Districts list */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="p-2 pb-0">
          <div className="flex items-center justify-between px-2 mb-1">
            <p className="text-[10px] font-medium text-foreground-muted uppercase tracking-wider">
              Districts
            </p>
            <span className="text-[10px] text-foreground-muted">{districts.length}</span>
          </div>
          <div className="relative mb-1">
            <div className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none">
              <MagnifyingGlassIcon className="w-3 h-3 text-foreground-muted" />
            </div>
            <input
              type="text"
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              placeholder="Filter districts..."
              className="w-full py-1 pl-7 pr-2 text-[11px] text-foreground placeholder:text-foreground-muted bg-surface-accent rounded-md border-none focus:outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-white/20"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide px-2 pb-2">
          {districtsLoading ? (
            <div className="space-y-1 px-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2 py-1.5">
                  <div className="w-3.5 h-3.5 rounded bg-surface-accent animate-pulse flex-shrink-0" />
                  <div className="h-3 rounded bg-surface-accent animate-pulse" style={{ width: `${60 + (i % 3) * 20}%` }} />
                </div>
              ))}
            </div>
          ) : filteredDistricts.length === 0 ? (
            <p className="px-2 py-2 text-[10px] text-foreground-muted">
              {districtFilter ? 'No matching districts' : 'No districts loaded'}
            </p>
          ) : (
            <div className="space-y-0.5">
              {filteredDistricts.map((d) => (
                <Link
                  key={d.id}
                  href={`/explore/school-districts`}
                  className="flex items-center gap-2 px-2 py-1.5 text-xs rounded-md text-foreground-muted hover:bg-surface-accent hover:text-foreground transition-colors"
                >
                  <BuildingOfficeIcon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="flex-1 min-w-0 truncate">{d.name}</span>
                  {d.school_count > 0 && (
                    <span className="text-[10px] text-foreground-muted flex-shrink-0">
                      {d.school_count}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
