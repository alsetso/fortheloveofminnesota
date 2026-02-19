'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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

export default function HeaderSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const search = useCallback(async (term: string) => {
    const trimmed = term.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setIsLoading(true);

    try {
      const res = await fetch(
        `/api/search/unified?q=${encodeURIComponent(trimmed)}&limit=5`,
        { signal: abortRef.current.signal },
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      setResults(data.results ?? []);
      setIsOpen((data.results ?? []).length > 0);
      setSelectedIndex(-1);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length >= 2) {
      debounceRef.current = setTimeout(() => search(query), 200);
    } else {
      setResults([]);
      setIsOpen(false);
    }

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
    return undefined;
  }, [isOpen]);

  const navigateToResult = useCallback((result: SearchResult) => {
    setIsOpen(false);
    setQuery('');
    setResults([]);
    if (result.type === 'school' && result.slug) {
      router.push(`/school/${result.slug}`);
    } else if (result.lat != null && result.lng != null) {
      router.push(`/map?lat=${result.lat}&lng=${result.lng}&zoom=12`);
    }
  }, [router]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        navigateToResult(results[selectedIndex]);
      } else if (query.trim().length >= 2) {
        setIsOpen(false);
        router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setQuery('');
      setResults([]);
      inputRef.current?.blur();
    }
  }, [results, selectedIndex, query, navigateToResult, router]);

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none">
          <MagnifyingGlassIcon className="w-3.5 h-3.5 text-gray-400" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value.trim().length > 0) setIsOpen(true);
          }}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search Minnesota..."
          className="w-full py-1.5 pl-8 pr-3 text-xs text-gray-900 placeholder-gray-400 bg-gray-100 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-transparent transition-colors"
        />
        {isLoading && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-2.5 pointer-events-none">
            <div className="w-3 h-3 border-[1.5px] border-gray-300 border-t-gray-700 rounded-full animate-spin" />
          </div>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 overflow-hidden">
          <div className="py-1">
            {results.map((result, index) => {
              const Icon = result.type === 'school' ? AcademicCapIcon : MapPinIcon;
              return (
                <button
                  key={`${result.type}-${result.id}`}
                  type="button"
                  onClick={() => navigateToResult(result)}
                  className={`w-full text-left px-3 py-1.5 flex items-center gap-2 transition-colors ${
                    index === selectedIndex ? 'bg-gray-100' : 'hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-900 truncate">{result.title}</p>
                    {result.subtitle && (
                      <p className="text-[10px] text-gray-500 truncate">{result.subtitle}</p>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-400 flex-shrink-0 capitalize">{result.type}</span>
                </button>
              );
            })}
          </div>
          <Link
            href={`/search?q=${encodeURIComponent(query.trim())}`}
            className="block px-3 py-1.5 text-[10px] text-gray-500 hover:bg-gray-50 border-t border-gray-100 transition-colors text-center"
            onClick={() => setIsOpen(false)}
          >
            See all results
          </Link>
        </div>
      )}
    </div>
  );
}
