/**
 * Social Graph Queries
 * Unified queries for social graph edges (follows, friends, blocks)
 */

export interface Edge {
  id: string;
  from_account_id: string;
  to_account_id: string;
  relationship: 'follow' | 'block';
  status: 'pending' | 'accepted';
  created_at: string;
}

export interface EdgesResponse {
  edges: Edge[];
}

export const socialGraphQueries = {
  /**
   * Get all edges for an account (incoming and outgoing)
   * Single source of truth - cached and shared across components
   */
  edges: (accountId: string) => ({
    queryKey: ['social-graph', 'edges', accountId],
    queryFn: async (): Promise<EdgesResponse> => {
      const res = await fetch(`/api/social/edges/${accountId}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch edges: ${res.statusText}`);
      }
      return res.json();
    },
    staleTime: 30 * 1000, // 30 seconds - edges change frequently but not instantly
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  }),
};
