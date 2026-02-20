'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import GovBadge from '@/components/gov/GovBadge';
import PartyBadge from '@/components/gov/PartyBadge';
import type { DirectorySearchResult, DirectoryOverview } from '@/features/civic/services/civicService';

const DEBOUNCE_MS = 300;

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

interface DirectoryPageClientProps {
  overview: DirectoryOverview;
}

export default function DirectoryPageClient({ overview }: DirectoryPageClientProps) {
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DirectorySearchResult | null>(null);
  const debouncedQuery = useDebouncedValue(searchInput.trim(), DEBOUNCE_MS);

  const fetchSearch = useCallback(async (q: string) => {
    if (!q) {
      setResult(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/gov/directory/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (res.ok) setResult(data as DirectorySearchResult);
      else setResult({ agencies: [], people: [], roles: [] });
    } catch {
      setResult({ agencies: [], people: [], roles: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debouncedQuery) fetchSearch(debouncedQuery);
    else setResult(null);
  }, [debouncedQuery, fetchSearch]);

  const isSearching = !!searchInput.trim();
  const hasResults =
    result &&
    (result.agencies.length > 0 || result.people.length > 0 || result.roles.length > 0);
  const showEmptyState = isSearching && result && !loading && !hasResults;

  const { counts, branchSummaries } = overview;
  const exec = branchSummaries.executive;
  const leg = branchSummaries.legislative;
  const jud = branchSummaries.judicial;

  return (
    <div className="space-y-4">
      {/* Hero */}
      <div className="hero rounded-lg border border-border bg-surface p-4 md:p-5">
        <h1 className="text-base font-semibold text-foreground">
          Minnesota Government Directory
        </h1>
        <p className="text-xs text-foreground-muted mt-1">
          Search across all agencies, people, and roles in Minnesota state government.
        </p>
        <div className="mt-3 relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted pointer-events-none" />
          <input
            type="search"
            placeholder="Search agencies, commissioners, legislators, judges..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-9 pr-9 py-2 text-sm border border-border rounded-md bg-white dark:bg-surface focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
            aria-label="Search directory"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-foreground-muted hover:bg-surface-accent hover:text-foreground"
              aria-label="Clear search"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          )}
          {loading && (
            <div className="absolute right-10 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <span className="inline-block w-3 h-3 border-2 border-foreground-muted border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>

      {/* Overview: 4 cards + 3 branch rows — visible when search empty, fade/collapse when typing */}
      <div
        className="overflow-hidden transition-[opacity,max-height] duration-300 ease-out"
        style={{
          opacity: isSearching ? 0 : 1,
          maxHeight: isSearching ? 0 : 1500,
        }}
      >
        {/* Four summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <Link
            href="/gov/executive"
            className="rounded-lg border border-border bg-surface p-4 hover:bg-surface-muted transition-colors block"
          >
            <p className="text-lg font-semibold text-foreground">{counts.agencyCount} Agencies</p>
            <p className="text-xs text-foreground-muted mt-0.5">across 3 branches</p>
            <span className="text-xs text-accent font-medium mt-2 inline-block">→ Browse</span>
          </Link>
          <Link
            href="/gov/legislative"
            className="rounded-lg border border-border bg-surface p-4 hover:bg-surface-muted transition-colors block"
          >
            <p className="text-lg font-semibold text-foreground">{counts.peopleCount} People</p>
            <p className="text-xs text-foreground-muted mt-0.5">legislators, commissioners, judges</p>
            <span className="text-xs text-accent font-medium mt-2 inline-block">→ Browse</span>
          </Link>
          <Link
            href="/gov/directory"
            className="rounded-lg border border-border bg-surface p-4 hover:bg-surface-muted transition-colors block"
          >
            <p className="text-lg font-semibold text-foreground">{counts.roleCount} Roles</p>
            <p className="text-xs text-foreground-muted mt-0.5">active across all branches</p>
            <span className="text-xs text-accent font-medium mt-2 inline-block">→ Browse</span>
          </Link>
          <Link
            href="/gov/executive"
            className="rounded-lg border border-border bg-surface p-4 hover:bg-surface-muted transition-colors block"
          >
            <p className="text-lg font-semibold text-foreground">{counts.buildingCount} Buildings</p>
            <p className="text-xs text-foreground-muted mt-0.5">state government locations</p>
            <span className="text-xs text-accent font-medium mt-2 inline-block">→ Browse</span>
          </Link>
        </div>

        {/* Three branch summary rows */}
        <div className="space-y-2">
          <Link
            href="/gov/executive"
            className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2.5 hover:bg-surface-muted transition-colors text-sm text-foreground"
          >
            <span className="font-medium">Executive Branch</span>
            <span className="text-foreground-muted">——</span>
            <span className="text-foreground-muted">
              {exec.agencyCount} agencies · {exec.peopleCount} people · {exec.budgetLabel ?? '$171B+ budget'}
            </span>
          </Link>
          <Link
            href="/gov/legislative"
            className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2.5 hover:bg-surface-muted transition-colors text-sm text-foreground"
          >
            <span className="font-medium">Legislative Branch</span>
            <span className="text-foreground-muted">——</span>
            <span className="text-foreground-muted">
              2 chambers · {leg.peopleCount} members · {leg.senateCount ?? 67} senate · {leg.houseCount ?? 134} house
            </span>
          </Link>
          <Link
            href="/gov/judicial"
            className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2.5 hover:bg-surface-muted transition-colors text-sm text-foreground"
          >
            <span className="font-medium">Judicial Branch</span>
            <span className="text-foreground-muted">——</span>
            <span className="text-foreground-muted">
              {jud.courtCount ?? 3} courts · {jud.peopleCount} justices &amp; judges · {jud.districtCount ?? 10} districts
            </span>
          </Link>
        </div>
      </div>

      {/* Loading skeleton when search active and loading */}
      {isSearching && loading && (
        <div className="rounded-lg border border-border bg-surface p-4 animate-pulse">
          <div className="h-4 bg-foreground-muted/20 rounded w-1/3 mb-3" />
          <div className="h-3 bg-foreground-muted/20 rounded w-2/3 mb-4" />
          <div className="h-8 bg-foreground-muted/20 rounded w-full" />
        </div>
      )}

      {/* Empty state */}
      {showEmptyState && (
        <div className="rounded-lg border border-border bg-surface p-6 text-center">
          <p className="text-sm text-foreground-muted">
            No results found for &quot;{searchInput.trim()}&quot;
          </p>
          <p className="text-xs text-foreground-muted mt-1">
            Try a different term or browse the cards above.
          </p>
        </div>
      )}

      {/* Grouped search results */}
      {isSearching && !loading && result && hasResults && (
        <div className="space-y-4">
          {result.agencies.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
                Agencies
              </h2>
              <ul className="rounded-lg border border-border divide-y divide-border overflow-hidden bg-surface">
                {result.agencies.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/gov/${a.branch ?? 'executive'}/agency/${a.slug}`}
                      className="block px-3 py-2.5 text-sm text-foreground hover:bg-surface-muted transition-colors"
                    >
                      <span className="font-medium">{a.name}</span>
                      <span className="ml-2 inline-flex flex-wrap gap-1">
                        {a.gov_type && <GovBadge label={a.gov_type} />}
                        {a.branch && <GovBadge label={a.branch} />}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {result.people.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
                People
              </h2>
              <ul className="rounded-lg border border-border divide-y divide-border overflow-hidden bg-surface">
                {result.people.map((p) => {
                  const branch =
                    p.roles?.[0]?.agencies?.branch ?? 'executive';
                  const title = p.roles?.[0]?.title ?? p.title ?? null;
                  const orgName = p.roles?.[0]?.agencies?.name ?? null;
                  const slug = p.slug ?? p.id;
                  return (
                    <li key={p.id}>
                      <Link
                        href={`/gov/${branch}/person/${slug}`}
                        className="block px-3 py-2.5 text-sm text-foreground hover:bg-surface-muted transition-colors"
                      >
                        <span className="font-medium">{p.name}</span>
                        {(title || orgName) && (
                          <span className="text-foreground-muted text-xs block mt-0.5">
                            {[title, orgName].filter(Boolean).join(' · ')}
                          </span>
                        )}
                        {p.party && (
                          <PartyBadge party={p.party} className="mt-1 inline-block" />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          {result.roles.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
                Roles
              </h2>
              <ul className="rounded-lg border border-border divide-y divide-border overflow-hidden bg-surface">
                {result.roles.map((r) => {
                  const branch = r.agencies?.branch ?? 'executive';
                  const personSlug = r.people?.slug ?? r.person_id;
                  const personName = r.people?.name ?? 'Unknown';
                  const orgName = r.agencies?.name ?? null;
                  return (
                    <li key={r.id}>
                      <Link
                        href={`/gov/${branch}/person/${personSlug}`}
                        className="block px-3 py-2.5 text-sm text-foreground hover:bg-surface-muted transition-colors"
                      >
                        <span className="font-medium">{personName}</span>
                        <span className="text-foreground-muted"> — {r.title}</span>
                        {orgName && (
                          <span className="text-foreground-muted text-xs block mt-0.5">
                            {orgName}
                          </span>
                        )}
                        {r.people?.party && (
                          <PartyBadge party={r.people.party} className="mt-1 inline-block" />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
