'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { MagnifyingGlassIcon, MapPinIcon, AcademicCapIcon } from '@heroicons/react/24/outline';

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

function SkeletonCard() {
  return (
    <div className="flex items-center gap-2 px-3 py-2 animate-pulse">
      <div className="w-8 h-8 rounded-md bg-gray-100 flex-shrink-0" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="h-3 bg-gray-100 rounded w-3/4" />
        <div className="h-2.5 bg-gray-100 rounded w-1/2" />
      </div>
    </div>
  );
}

function ResultCard({ result }: { result: SearchResult }) {
  const isSchool = result.type === 'school';
  const href = isSchool
    ? `/school/${result.slug}`
    : `/map?lat=${result.lat}&lng=${result.lng}&zoom=12`;

  const Icon = isSchool ? AcademicCapIcon : MapPinIcon;

  return (
    <Link
      href={href}
      className="flex items-center gap-2 px-3 py-2 rounded-md border border-transparent hover:bg-gray-50 hover:border-gray-200 transition-colors"
    >
      <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-gray-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-900 truncate">{result.title}</p>
        {result.subtitle && (
          <p className="text-[10px] text-gray-500 truncate">{result.subtitle}</p>
        )}
      </div>
      <span className="text-[10px] text-gray-400 flex-shrink-0 capitalize">{result.type}</span>
    </Link>
  );
}

function ResultGroup({ type, label, results }: { type: string; label: string; results: SearchResult[] }) {
  if (results.length === 0) return null;
  return (
    <div>
      <div className="flex items-center justify-between px-3 pb-1">
        <p className="text-xs font-semibold text-gray-900">{label}</p>
        <span className="text-[10px] text-gray-500">{results.length}</span>
      </div>
      <div className="space-y-0.5">
        {results.map((r) => (
          <ResultCard key={`${r.type}-${r.id}`} result={r} />
        ))}
      </div>
    </div>
  );
}

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';

  const [query, setQuery] = useState(initialQuery);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const search = useCallback(async (term: string) => {
    const trimmed = term.trim();
    if (trimmed.length < 2) {
      setResponse(null);
      setHasSearched(false);
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setIsSearching(true);

    try {
      const res = await fetch(
        `/api/search/unified?q=${encodeURIComponent(trimmed)}&limit=20`,
        { signal: abortRef.current.signal },
      );
      if (!res.ok) throw new Error('Search failed');
      const data: SearchResponse = await res.json();
      setResponse(data);
      setHasSearched(true);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setResponse(null);
      setHasSearched(true);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length >= 2) {
      debounceRef.current = setTimeout(() => search(query), 200);
    } else {
      setResponse(null);
      setHasSearched(false);
    }

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  // Run initial search from ?q= param
  useEffect(() => {
    if (initialQuery.trim().length >= 2) {
      search(initialQuery);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length >= 2) {
      router.replace(`/search?q=${encodeURIComponent(trimmed)}`, { scroll: false });
      search(trimmed);
    }
  };

  const schools = response?.results.filter((r) => r.type === 'school') ?? [];
  const places = response?.results.filter((r) => r.type === 'place') ?? [];
  const noResults = hasSearched && !isSearching && response?.results.length === 0;

  return (
    <div className="min-h-screen bg-white flex flex-col items-center px-3 pt-12 pb-6">
      <div className="w-full max-w-xl space-y-3">
        {/* Search Input */}
        <form onSubmit={handleSubmit}>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <MagnifyingGlassIcon className="w-4 h-4 text-gray-500" />
            </div>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search schools, cities, and towns..."
              className="w-full py-2 pl-10 pr-3 text-sm text-gray-900 placeholder-gray-500 bg-white border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-colors"
            />
            {isSearching && (
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
              </div>
            )}
          </div>
        </form>

        {/* Loading Skeletons */}
        {isSearching && !response && (
          <div className="space-y-3">
            <div>
              <div className="px-3 pb-1"><div className="h-3 w-16 bg-gray-100 rounded animate-pulse" /></div>
              <SkeletonCard /><SkeletonCard /><SkeletonCard />
            </div>
            <div>
              <div className="px-3 pb-1"><div className="h-3 w-16 bg-gray-100 rounded animate-pulse" /></div>
              <SkeletonCard /><SkeletonCard /><SkeletonCard />
            </div>
          </div>
        )}

        {/* Results */}
        {response && response.results.length > 0 && (
          <div className="space-y-3">
            <ResultGroup type="school" label="Schools" results={schools} />
            <ResultGroup type="place" label="Places" results={places} />
          </div>
        )}

        {/* Empty State */}
        {noResults && (
          <div className="text-center py-8">
            <p className="text-xs text-gray-500">
              No results for &lsquo;{query.trim()}&rsquo;
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
