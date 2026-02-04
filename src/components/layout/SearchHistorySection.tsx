'use client';

import { useState, useEffect } from 'react';
import { ClockIcon } from '@heroicons/react/24/outline';
import { useSearchState } from '@/contexts/SearchStateContext';

interface SearchHistoryItem {
  query: string;
  timestamp: number;
}

const SEARCH_HISTORY_KEY = 'live_map_search_history';
const MAX_HISTORY_ITEMS = 10;

export default function SearchHistorySection() {
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const { searchQuery, updateQuery, activateSearch } = useSearchState();

  // Load search history from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as SearchHistoryItem[];
        setHistory(parsed.slice(0, MAX_HISTORY_ITEMS));
      }
    } catch (err) {
      console.error('Error loading search history:', err);
    }
  }, []);

  // Save search query to history when search is performed
  useEffect(() => {
    if (!searchQuery.trim() || typeof window === 'undefined') return;
    
    try {
      const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
      const existing = stored ? (JSON.parse(stored) as SearchHistoryItem[]) : [];
      
      // Remove duplicate and add to front
      const filtered = existing.filter(item => item.query.toLowerCase() !== searchQuery.toLowerCase());
      const updated = [
        { query: searchQuery, timestamp: Date.now() },
        ...filtered,
      ].slice(0, MAX_HISTORY_ITEMS);
      
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
      setHistory(updated);
    } catch (err) {
      console.error('Error saving search history:', err);
    }
  }, [searchQuery]);

  const handleHistoryClick = (query: string) => {
    updateQuery(query);
    activateSearch();
  };

  const clearHistory = () => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(SEARCH_HISTORY_KEY);
      setHistory([]);
    } catch (err) {
      console.error('Error clearing search history:', err);
    }
  };

  if (history.length === 0) return null;

  return (
    <div 
      className="flex-shrink-0 px-[10px] py-3 border-b border-gray-200"
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(2px)',
        WebkitBackdropFilter: 'blur(2px)',
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <ClockIcon className="w-3 h-3 text-gray-500" />
          <h3 className="text-xs font-semibold text-gray-900">Recent Searches</h3>
        </div>
        <button
          type="button"
          onClick={clearHistory}
          className="text-[10px] text-gray-500 hover:text-gray-700 transition-colors"
        >
          Clear
        </button>
      </div>
      <div className="space-y-1">
        {history.map((item, index) => (
          <button
            key={`${item.query}-${item.timestamp}`}
            type="button"
            onClick={() => handleHistoryClick(item.query)}
            className="w-full text-left px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-50 rounded transition-colors"
          >
            {item.query}
          </button>
        ))}
      </div>
    </div>
  );
}
