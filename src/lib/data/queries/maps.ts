/**
 * Map Queries
 * Uses aggregate endpoint `/api/maps/[id]/data` for optimal performance
 * Returns: map + stats + pins + areas + members in single call
 */

export interface MapDataResponse {
  map: any;
  stats: {
    success: boolean;
    stats: {
      total_views: number;
      unique_viewers: number;
      accounts_viewed: number;
    };
  };
  pins: any[];
  areas: any[];
  members: any[] | null;
}

export const mapQueries = {
  /**
   * Single map with all related data (uses aggregate endpoint)
   * Reduces 6 API calls to 1
   */
  byId: (id: string) => ({
    queryKey: ['map', id],
    queryFn: async (): Promise<MapDataResponse> => {
      const res = await fetch(`/api/maps/${id}/data`, {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch map: ${res.statusText}`);
      }
      const data = await res.json();
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 min - maps don't change frequently
  }),

  /**
   * List maps with filters
   */
  list: (filters?: {
    view?: string;
    search?: string;
    account_id?: string;
    community?: boolean;
  }) => ({
    queryKey: ['maps', 'list', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.view) params.set('view', filters.view);
      if (filters?.search) params.set('search', filters.search);
      if (filters?.account_id) params.set('account_id', filters.account_id);
      if (filters?.community) params.set('community', 'true');

      const res = await fetch(`/api/maps?${params.toString()}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch maps: ${res.statusText}`);
      }
      return res.json();
    },
    staleTime: 2 * 60 * 1000, // 2 min - list can change more frequently
  }),

  /**
   * Infinite scroll feed for maps
   */
  feed: () => ({
    queryKey: ['maps', 'feed'],
    queryFn: async ({ pageParam = 0 }: { pageParam: number }) => {
      const res = await fetch(`/api/maps?offset=${pageParam}&limit=20`, {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch maps feed: ${res.statusText}`);
      }
      const data = await res.json();
      return {
        ...data,
        nextOffset: data.maps?.length === 20 ? pageParam + 20 : null,
      };
    },
    getNextPageParam: (lastPage: any) => lastPage.nextOffset,
    initialPageParam: 0,
    staleTime: 2 * 60 * 1000, // 2 min
  }),
};
