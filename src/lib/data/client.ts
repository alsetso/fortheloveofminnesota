/**
 * React Query Client Configuration
 * Centralized query client with optimized defaults for data caching
 * 
 * Note: Create instance in Providers component (singleton pattern)
 */

import { QueryClient } from '@tanstack/react-query';

/**
 * Create a new QueryClient instance
 * Call this once in Providers component
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,        // 1 min - data considered fresh
        gcTime: 10 * 60 * 1000,      // 10 min - cache retention (formerly cacheTime)
        refetchOnWindowFocus: false, // Don't refetch on tab switch
        retry: 1,                     // Fail fast (only retry once)
        refetchOnMount: false,        // Use cache if fresh
      },
    },
  });
}
