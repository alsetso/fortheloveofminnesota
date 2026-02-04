'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';

interface SearchStateContextValue {
  isSearchActive: boolean;
  isSearching: boolean; // True when user is actively typing (overlay should show)
  searchQuery: string;
  activateSearch: () => void;
  deactivateSearch: () => void;
  clearSearch: () => void;
  updateQuery: (query: string) => void;
}

const SearchStateContext = createContext<SearchStateContextValue | null>(null);

/**
 * Search state provider - manages search state (no hash dependency)
 * Shared across AppFooter and MapSidebar
 */
export function SearchStateProvider({ children }: { children: ReactNode }) {
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [isSearching, setIsSearching] = useState(false); // True when actively typing
  const [searchQuery, setSearchQuery] = useState('');
  const previousQueryRef = useRef<string>('');

  // Activate search mode (state-based, no hash)
  const activateSearch = useCallback(() => {
    setIsSearchActive(true);
    // Set searching state to show overlay
    setIsSearching(true);
    
    // Restore previous query if available and current query is empty
    if (previousQueryRef.current && !searchQuery.trim()) {
      setSearchQuery(previousQueryRef.current);
    }
  }, [searchQuery]);

  // Deactivate search mode (state-based, no hash)
  const deactivateSearch = useCallback(() => {
    // Save current query before closing
    if (searchQuery.trim()) {
      previousQueryRef.current = searchQuery;
    }
    
    setIsSearchActive(false);
    // Hide overlay (stop searching state)
    setIsSearching(false);
  }, [searchQuery]);

  // Clear search query and deactivate
  const clearSearch = useCallback(() => {
    previousQueryRef.current = '';
    setSearchQuery('');
    setIsSearchActive(false);
    setIsSearching(false);
    window.dispatchEvent(new CustomEvent('search-state-updated'));
  }, []);

  // Update search query
  const updateQuery = useCallback((query: string) => {
    setSearchQuery(query);
    // When user types, show overlay (searching state)
    if (query.trim().length >= 2) {
      setIsSearching(true);
    } else {
      setIsSearching(false);
    }
  }, []);

  return (
    <SearchStateContext.Provider
      value={{
        isSearchActive,
        isSearching,
        searchQuery,
        activateSearch,
        deactivateSearch,
        clearSearch,
        updateQuery,
      }}
    >
      {children}
    </SearchStateContext.Provider>
  );
}

export function useSearchState(): SearchStateContextValue {
  const context = useContext(SearchStateContext);
  if (!context) {
    // Fallback for components outside provider
    return {
      isSearchActive: false,
      isSearching: false,
      searchQuery: '',
      activateSearch: () => {},
      deactivateSearch: () => {},
      clearSearch: () => {},
      updateQuery: () => {},
    };
  }
  return context;
}
