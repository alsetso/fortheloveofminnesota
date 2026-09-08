'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { IconCheck, IconSearch, IconX } from '@/features/map/dockCore/core/icons';
import {
  MAP_DOCK_GLASS_BORDER_CLASS,
  MAP_DOCK_GLASS_FILL_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';
import { formatBusinessCategoryName } from '@/lib/directory/businessCategoryText';
import {
  PAGE_CATEGORY_PARENT_CONFIG,
  type PageCategoryParent,
} from '@/lib/directory/pageCategoryParents';

export type CategoryOption = {
  id: string;
  slug: string;
  name: string;
};

type DockCategorySearchFieldProps = {
  parentSlug: PageCategoryParent;
  categoryId: string;
  categoryName: string;
  onSelect: (category: CategoryOption | null) => void;
};

/**
 * Semi-controlled category picker — search existing or add your own.
 * Mirrors web BusinessCategorySearchField for dock create.
 */
export default function DockCategorySearchField({
  parentSlug,
  categoryId,
  categoryName,
  onSelect,
}: DockCategorySearchFieldProps) {
  const copy = PAGE_CATEGORY_PARENT_CONFIG[parentSlug];
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CategoryOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const formattedQuery = formatBusinessCategoryName(query);
  const normalizedQuery = formattedQuery.toLowerCase();
  const exactMatch = results.some((r) => r.name.toLowerCase() === normalizedQuery);
  const canAddCustom = formattedQuery.length >= 2 && !exactMatch;

  const runSearch = useCallback(
    async (q: string) => {
      setSearching(true);
      setError(null);
      try {
        const params = new URLSearchParams({ parent: parentSlug, limit: '12' });
        if (q.trim()) params.set('q', q.trim());
        const res = await fetch(`/api/directory/categories?${params.toString()}`, {
          credentials: 'include',
        });
        const data = (await res.json()) as {
          categories?: CategoryOption[];
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? 'Search failed');
        setResults(data.categories ?? []);
        setShowResults(true);
      } catch {
        setResults([]);
        setError('Could not load categories.');
      } finally {
        setSearching(false);
      }
    },
    [parentSlug],
  );

  useEffect(() => {
    setQuery('');
    setResults([]);
    setShowResults(false);
    setError(null);
  }, [parentSlug]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runSearch(query);
    }, 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  const selectCategory = (category: CategoryOption) => {
    onSelect(category);
    setQuery('');
    setShowResults(false);
    setError(null);
  };

  const addCustomCategory = async () => {
    if (!canAddCustom || creating) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/directory/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ parent: parentSlug, name: formattedQuery }),
      });
      const data = (await res.json()) as {
        category?: CategoryOption;
        error?: string;
      };
      if (!res.ok || !data.category) {
        throw new Error(data.error ?? 'Could not add category');
      }
      selectCategory(data.category);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add category');
    } finally {
      setCreating(false);
    }
  };

  if (categoryId && categoryName) {
    return (
      <div
        className={`flex items-center gap-2 rounded-2xl px-3.5 py-3 ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
      >
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-lake-blue/15 text-lake-blue">
          <IconCheck className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
            {copy.label}
          </span>
          <span className="block truncate text-[15px] font-semibold text-foreground">
            {categoryName}
          </span>
        </span>
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="rounded-full p-1.5 text-foreground-muted transition hover:bg-map-glass-hover hover:text-foreground"
          aria-label={copy.clearLabel}
        >
          <IconX className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="px-0.5 text-[12px] font-semibold text-foreground-muted">{copy.label}</p>
      <div
        className={`flex items-center gap-2 rounded-2xl px-3.5 py-2.5 ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
      >
        <IconSearch className="h-4 w-4 shrink-0 text-foreground-muted" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (results.length || query.trim()) setShowResults(true);
          }}
          placeholder={copy.placeholder}
          className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-foreground-muted"
          autoCapitalize="words"
          autoCorrect="off"
          spellCheck={false}
        />
      </div>
      <p className="px-0.5 text-[11px] leading-snug text-foreground-muted">{copy.hint}</p>
      {error ? (
        <p className="px-0.5 text-[12px] text-red-600">{error}</p>
      ) : null}

      {showResults ? (
        <div
          className={`overflow-hidden rounded-2xl ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
        >
          {searching ? (
            <p className="px-3.5 py-3 text-[13px] text-foreground-muted">Searching…</p>
          ) : null}
          {!searching && results.length === 0 && !canAddCustom ? (
            <p className="px-3.5 py-3 text-[13px] text-foreground-muted">
              No matches — type at least 2 characters to add your own.
            </p>
          ) : null}
          {results.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => selectCategory(row)}
              className="flex w-full items-center px-3.5 py-3 text-left text-[15px] font-medium text-foreground transition hover:bg-map-glass-hover"
            >
              {row.name}
            </button>
          ))}
          {canAddCustom ? (
            <button
              type="button"
              disabled={creating}
              onClick={() => void addCustomCategory()}
              className="flex w-full items-center gap-2 border-t border-[rgb(var(--map-ink-subtle))] px-3.5 py-3 text-left text-[14px] font-semibold text-lake-blue transition hover:bg-map-glass-hover disabled:opacity-50"
            >
              {creating ? 'Adding…' : `Add “${formattedQuery}”`}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
