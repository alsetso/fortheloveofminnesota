'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  NewspaperIcon,
  BuildingOfficeIcon,
  GlobeAltIcon,
  ArrowTopRightOnSquareIcon,
  ChevronRightIcon,
  TableCellsIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  AcademicCapIcon,
} from '@heroicons/react/24/outline';

/* ───── types ───── */

interface NewsArticle {
  id: string;
  title: string;
  link: string;
  snippet: string | null;
  source_name: string | null;
  published_at: string;
}

interface City {
  id: string;
  feature_name: string;
  ctu_class: string;
  county_name: string;
  population?: number;
  acres?: number;
}

/* ───── search types ───── */

interface SearchResult {
  id: string;
  type: 'school' | 'place';
  title: string;
  subtitle: string | null;
  slug: string | null;
  lat: number | null;
  lng: number | null;
  score: number;
}

interface SearchResponse {
  query: string;
  results: SearchResult[];
  counts: Record<string, number>;
}

/* ───── search sub-components ───── */

function SearchSkeletonCard() {
  return (
    <div className="flex items-center gap-2 px-3 py-2 animate-pulse">
      <div className="w-8 h-8 rounded-md bg-surface-accent flex-shrink-0" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="h-3 bg-surface-accent rounded w-3/4" />
        <div className="h-2.5 bg-surface-accent rounded w-1/2" />
      </div>
    </div>
  );
}

function SearchResultCard({ result }: { result: SearchResult }) {
  const isSchool = result.type === 'school';
  const href = isSchool
    ? `/school/${result.slug}`
    : `/map?lat=${result.lat}&lng=${result.lng}&zoom=12`;
  const Icon = isSchool ? AcademicCapIcon : MapPinIcon;

  return (
    <Link
      href={href}
      className="flex items-center gap-2 px-3 py-2 rounded-md border border-transparent hover:bg-surface-accent hover:border-border transition-colors"
    >
      <div className="w-8 h-8 rounded-md bg-surface border border-border flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-foreground-muted" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground truncate">{result.title}</p>
        {result.subtitle && (
          <p className="text-[10px] text-foreground-muted truncate">{result.subtitle}</p>
        )}
      </div>
      <span className="text-[10px] text-foreground-subtle flex-shrink-0 capitalize">{result.type}</span>
    </Link>
  );
}

function SearchResultGroup({ label, results }: { label: string; results: SearchResult[] }) {
  if (results.length === 0) return null;
  return (
    <div>
      <div className="flex items-center justify-between px-3 pb-1">
        <p className="text-xs font-semibold text-foreground">{label}</p>
        <span className="text-[10px] text-foreground-muted">{results.length}</span>
      </div>
      <div className="space-y-0.5">
        {results.map((r) => (
          <SearchResultCard key={`${r.type}-${r.id}`} result={r} />
        ))}
      </div>
    </div>
  );
}

/* ───── helpers ───── */

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return 'Just now';
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return '1d ago';
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function StatBlock({ label, value, href, loading }: { label: string; value: string; href?: string; loading?: boolean }) {
  if (loading) {
    return (
      <div className="p-3 rounded-md bg-surface border border-border">
        <div className="h-2.5 w-12 rounded bg-surface-accent animate-pulse" />
        <div className="h-4 w-16 rounded bg-surface-accent animate-pulse mt-1.5" />
      </div>
    );
  }
  const inner = (
    <>
      <div className="text-[10px] text-foreground-muted uppercase tracking-wider">{label}</div>
      <div className="text-sm font-semibold text-foreground mt-0.5">{value}</div>
    </>
  );
  if (href) {
    return (
      <Link href={href} className="p-3 rounded-md bg-surface border border-border hover:bg-surface-accent hover:border-gray-300 transition-colors group">
        {inner}
        <div className="text-[9px] text-foreground-subtle mt-1 group-hover:text-lake-blue transition-colors">View map →</div>
      </Link>
    );
  }
  return (
    <div className="p-3 rounded-md bg-surface border border-border">
      {inner}
    </div>
  );
}

/* ───── component ───── */

export default function ExploreContent() {
  const searchParams = useSearchParams();
  const selectedCounty = searchParams.get('county');

  const [layerCounts, setLayerCounts] = useState<Record<string, number> | null>(null);
  const [atlasCounts, setAtlasCounts] = useState<Record<string, number> | null>(null);
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [loadingNews, setLoadingNews] = useState(true);
  const [loadingCities, setLoadingCities] = useState(true);

  /* ── search state ── */
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const searchAbortRef = useRef<AbortController | null>(null);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const runSearch = useCallback(async (term: string) => {
    const trimmed = term.trim();
    if (trimmed.length < 2) {
      setSearchResponse(null);
      setHasSearched(false);
      return;
    }
    searchAbortRef.current?.abort();
    searchAbortRef.current = new AbortController();
    setIsSearching(true);
    try {
      const res = await fetch(
        `/api/search/unified?q=${encodeURIComponent(trimmed)}&limit=20`,
        { signal: searchAbortRef.current.signal },
      );
      if (!res.ok) throw new Error('Search failed');
      const data: SearchResponse = await res.json();
      setSearchResponse(data);
      setHasSearched(true);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setSearchResponse(null);
      setHasSearched(true);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (searchQuery.trim().length >= 2) {
      searchDebounceRef.current = setTimeout(() => runSearch(searchQuery), 200);
    } else {
      setSearchResponse(null);
      setHasSearched(false);
    }
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery, runSearch]);

  const searchSchools = searchResponse?.results.filter((r) => r.type === 'school') ?? [];
  const searchPlaces = searchResponse?.results.filter((r) => r.type === 'place') ?? [];
  const searchNoResults = hasSearched && !isSearching && searchResponse?.results.length === 0;
  const showSearchResults = searchQuery.trim().length >= 2;

  /* layer counts (once) */
  useEffect(() => {
    fetch('/api/civic/layers')
      .then((r) => (r.ok ? r.json() : {}))
      .then(setLayerCounts)
      .catch(() => setLayerCounts({}));
  }, []);

  /* atlas counts (once) */
  useEffect(() => {
    fetch('/api/atlas/counts')
      .then((r) => (r.ok ? r.json() : {}))
      .then(setAtlasCounts)
      .catch(() => setAtlasCounts({}));
  }, []);

  /* news (once — not county‑scoped, API doesn't support it) */
  useEffect(() => {
    setLoadingNews(true);
    fetch('/api/news?limit=8')
      .then((r) => (r.ok ? r.json() : { articles: [] }))
      .then((d) => setNews(d.articles || []))
      .catch(() => setNews([]))
      .finally(() => setLoadingNews(false));
  }, []);

  /* cities — re‑fetches when county changes */
  useEffect(() => {
    setLoadingCities(true);
    const params = new URLSearchParams({ limit: '200' });
    if (selectedCounty) params.set('county_name', selectedCounty);
    fetch(`/api/civic/ctu-boundaries?${params}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: City[]) => {
        const sorted = (Array.isArray(data) ? data : [])
          .filter((c) => c.population && c.population > 0)
          .sort((a, b) => (b.population ?? 0) - (a.population ?? 0));
        setCities(sorted);
      })
      .catch(() => setCities([]))
      .finally(() => setLoadingCities(false));
  }, [selectedCounty]);

  /* derived stats */
  const stats = useMemo(() => {
    if (selectedCounty) {
      const pop = cities.reduce((s, c) => s + (c.population ?? 0), 0);
      const acresTot = cities.reduce((s, c) => s + (c.acres ?? 0), 0);
      return {
        label: `${selectedCounty} County`,
        population: pop || null,
        area: acresTot ? `${Math.round(acresTot / 640).toLocaleString()} sq mi` : null,
        placeCount: cities.length,
      };
    }
    return {
      label: 'Minnesota',
      population: 5_706_494,
      area: '86,936 sq mi',
      placeCount: layerCounts?.cities_and_towns ?? 0,
    };
  }, [selectedCounty, cities, layerCounts]);

  const visibleCities = cities.slice(0, selectedCounty ? 25 : 12);

  return (
    <div className="max-w-[960px] mx-auto w-full px-4 py-4 space-y-5">
      {/* ── search input ── */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <MagnifyingGlassIcon className="w-4 h-4 text-foreground-muted" />
        </div>
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search schools, cities, and towns..."
          className="w-full py-2 pl-10 pr-3 text-sm text-foreground placeholder-foreground-muted bg-surface border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-foreground focus:border-transparent transition-colors"
        />
        {isSearching && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <div className="w-4 h-4 border-2 border-border border-t-foreground rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* ── search results overlay ── */}
      {showSearchResults && (
        <div className="space-y-3">
          {isSearching && !searchResponse && (
            <div className="space-y-3">
              <div>
                <div className="px-3 pb-1"><div className="h-3 w-16 bg-surface-accent rounded animate-pulse" /></div>
                <SearchSkeletonCard /><SearchSkeletonCard /><SearchSkeletonCard />
              </div>
            </div>
          )}
          {searchResponse && searchResponse.results.length > 0 && (
            <div className="space-y-3">
              <SearchResultGroup label="Schools" results={searchSchools} />
              <SearchResultGroup label="Places" results={searchPlaces} />
            </div>
          )}
          {searchNoResults && (
            <div className="text-center py-8">
              <p className="text-xs text-foreground-muted">
                No results for &lsquo;{searchQuery.trim()}&rsquo;
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── location anchor ── */}
      {!showSearchResults && <div className="border-b border-border pb-3">
        <h1 className="text-lg font-bold text-foreground">{stats.label}</h1>
        <p className="text-xs text-foreground-muted mt-0.5">
          {selectedCounty
            ? `What's happening in ${selectedCounty} County`
            : "What's actually happening — and what do people do here"}
        </p>
      </div>}

      {/* ── stats grid ── */}
      {!showSearchResults && <div className={`grid gap-2 ${selectedCounty ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-3 sm:grid-cols-4'}`}>
        {stats.population != null && (
          <StatBlock label="Population" value={stats.population.toLocaleString()} loading={selectedCounty ? loadingCities : false} />
        )}
        {!selectedCounty && (
          <StatBlock label="Counties" value={String(layerCounts?.counties ?? 87)} href="/explore/counties" loading={layerCounts === null} />
        )}
        {selectedCounty ? (
          <StatBlock
            label="Places"
            value={String(stats.placeCount)}
            href="/explore/cities-and-towns"
            loading={loadingCities}
          />
        ) : (
          <>
            <StatBlock
              label="Cities"
              value={String(layerCounts?.cities ?? 0)}
              href="/explore/cities"
              loading={layerCounts === null}
            />
            <StatBlock
              label="Towns"
              value={String(layerCounts?.towns ?? 0)}
              href="/explore/towns"
              loading={layerCounts === null}
            />
          </>
        )}
        {(stats.area || layerCounts === null) && (
          <StatBlock label="Area" value={stats.area ?? ''} href="/explore/state" loading={selectedCounty ? loadingCities : false} />
        )}
        {!selectedCounty && (
          <StatBlock label="Districts" value={String(layerCounts?.districts ?? 8)} href="/explore/congressional-districts" loading={layerCounts === null} />
        )}
        {!selectedCounty && (
          <StatBlock label="School Districts" value={String(layerCounts?.school_districts ?? 0)} href="/explore/school-districts" loading={layerCounts === null} />
        )}
      </div>}

      {/* ── atlas data ── */}
      {!showSearchResults && <section>
        <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
          <TableCellsIcon className="w-4 h-4 text-foreground-muted" />
          Atlas Data
        </h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {[
            { label: 'Schools', key: 'schools', slug: 'schools' },
            { label: 'Parks', key: 'parks', slug: 'parks' },
            { label: 'Hospitals', key: 'hospitals', slug: 'hospitals' },
            { label: 'Churches', key: 'churches', slug: 'churches' },
            { label: 'Airports', key: 'airports', slug: 'airports' },
            { label: 'Cemeteries', key: 'cemeteries', slug: 'cemeteries' },
            { label: 'Golf Courses', key: 'golf_courses', slug: 'golf-courses' },
            { label: 'Water Towers', key: 'watertowers', slug: 'watertowers' },
            { label: 'Neighborhoods', key: 'neighborhoods', slug: 'neighborhoods' },
            { label: 'Municipal Bldgs', key: 'municipals', slug: 'municipals' },
            { label: 'Roads', key: 'roads', slug: 'roads' },
            { label: 'Radio & News', key: 'radio_and_news', slug: 'radio-and-news' },
            { label: 'Lakes', key: 'lakes', slug: 'lakes' },
          ].map((item) => {
            const isLoading = atlasCounts === null;
            const count = atlasCounts?.[item.key];
            return (
              <Link
                key={item.key}
                href={`/explore/${item.slug}`}
                className="p-2.5 rounded-md bg-surface border border-border text-center hover:bg-surface-accent hover:border-gray-300 transition-colors group"
              >
                <div className="text-xs font-medium text-foreground group-hover:text-lake-blue transition-colors">{item.label}</div>
                {isLoading ? (
                  <div className="h-3 w-8 mx-auto rounded bg-surface-accent animate-pulse mt-1" />
                ) : (
                  <div className="text-[10px] text-foreground-muted mt-0.5">
                    {(count ?? 0).toLocaleString()}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </section>}

      {/* ── right now — news ── */}
      {!showSearchResults && <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <NewspaperIcon className="w-4 h-4 text-foreground-muted" />
            Right Now
          </h2>
          <Link href="/news" className="text-[10px] text-lake-blue hover:underline">
            All News →
          </Link>
        </div>

        {loadingNews ? (
          <Skeleton rows={4} />
        ) : news.length === 0 ? (
          <Empty>No recent news</Empty>
        ) : (
          <div className="border border-border rounded-md divide-y divide-border">
            {news.map((a) => (
              <a
                key={a.id}
                href={a.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 p-2.5 hover:bg-surface-accent transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground group-hover:text-lake-blue transition-colors line-clamp-2">
                    {a.title}
                  </p>
                  {a.snippet && (
                    <p className="text-[10px] text-foreground-muted mt-0.5 line-clamp-1">
                      {a.snippet}
                    </p>
                  )}
                  <div className="flex items-center gap-1.5 mt-1 text-[10px] text-foreground-subtle">
                    {a.source_name && <span>{a.source_name}</span>}
                    {a.source_name && <span aria-hidden>·</span>}
                    <span>{timeAgo(a.published_at)}</span>
                  </div>
                </div>
                <ArrowTopRightOnSquareIcon className="w-3 h-3 text-foreground-subtle flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            ))}
          </div>
        )}
      </section>}

      {/* ── largest cities ── */}
      {!showSearchResults && <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <BuildingOfficeIcon className="w-4 h-4 text-foreground-muted" />
            {selectedCounty ? `Places in ${selectedCounty}` : 'Largest Cities'}
          </h2>
          <Link
            href="/explore/cities"
            className="text-[10px] text-lake-blue hover:underline"
          >
            All Cities →
          </Link>
        </div>

        {loadingCities ? (
          <Skeleton rows={6} />
        ) : visibleCities.length === 0 ? (
          <Empty>No places with population data</Empty>
        ) : (
          <div className="border border-border rounded-md divide-y divide-border">
            {visibleCities.map((city, i) => (
              <Link
                key={city.id}
                href={`/explore/cities-and-towns/${city.id}`}
                className="flex items-center justify-between px-2.5 py-2 hover:bg-surface-accent transition-colors group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] text-foreground-subtle w-5 text-right tabular-nums">
                    {i + 1}
                  </span>
                  <span className="text-xs text-foreground group-hover:text-lake-blue transition-colors truncate">
                    {city.feature_name}
                  </span>
                  {city.ctu_class && city.ctu_class !== 'CITY' && (
                    <span className="text-[9px] text-foreground-subtle uppercase tracking-wide">
                      {city.ctu_class.toLowerCase()}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {!selectedCounty && (
                    <span className="text-[10px] text-foreground-subtle hidden sm:inline">
                      {city.county_name}
                    </span>
                  )}
                  <span className="text-[10px] text-foreground-muted tabular-nums">
                    {city.population?.toLocaleString()}
                  </span>
                  <ChevronRightIcon className="w-3 h-3 text-foreground-subtle" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>}

      {/* ── explore on map ── */}
      {!showSearchResults && <section>
        <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
          <GlobeAltIcon className="w-4 h-4 text-foreground-muted" />
          Explore on Map
        </h2>
        {layerCounts === null ? (
          <Skeleton rows={6} />
        ) : (
          <div className="border border-border rounded-md divide-y divide-border">
            {[
              { label: 'Counties', href: '/explore/counties', count: layerCounts.counties },
              { label: 'Cities', href: '/explore/cities', count: layerCounts.cities },
              { label: 'Towns', href: '/explore/towns', count: layerCounts.towns },
              { label: 'Congressional Districts', href: '/explore/congressional-districts', count: layerCounts.districts },
              { label: 'Water Bodies', href: '/explore/water', count: layerCounts.water },
              { label: 'School Districts', href: '/explore/school-districts', count: layerCounts.school_districts },
              { label: 'State Boundary', href: '/explore/state', count: 1 },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center justify-between px-3 py-2.5 hover:bg-surface-accent transition-colors group"
              >
                <span className="text-xs font-medium text-foreground group-hover:text-lake-blue transition-colors">
                  {item.label}
                </span>
                <div className="flex items-center gap-2">
                  {item.count != null && (
                    <span className="text-[10px] text-foreground-muted tabular-nums">
                      {item.count.toLocaleString()}
                    </span>
                  )}
                  <ChevronRightIcon className="w-3 h-3 text-foreground-subtle" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>}
    </div>
  );
}

/* ── tiny utility components ── */

function Skeleton({ rows }: { rows: number }) {
  return (
    <div className="border border-border rounded-md divide-y divide-border">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 px-2.5 flex items-center">
          <div className="h-3 w-2/3 rounded bg-surface-accent animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs text-foreground-muted py-6 text-center border border-border rounded-md">
      {children}
    </div>
  );
}
