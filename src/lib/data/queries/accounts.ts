/**
 * Account Queries
 * Unified queries for accounts + profiles (single source of truth)
 */

export interface AccountWithProfile {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  role: 'general' | 'admin';
  username?: string;
  profile_image?: string;
  profile_type?: string;
}

export const accountQueries = {
  /**
   * Current authenticated user's account
   * Includes profile data if available
   */
  current: () => ({
    queryKey: ['account', 'current'],
    queryFn: async (): Promise<AccountWithProfile | null> => {
      const res = await fetch('/api/accounts/current', {
        credentials: 'include',
      });
      if (!res.ok) {
        if (res.status === 401) {
          return null; // Not authenticated
        }
        throw new Error(`Failed to fetch account: ${res.statusText}`);
      }
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 min - account data doesn't change often
  }),

  /**
   * Account by ID
   * Includes profile data
   */
  byId: (id: string) => ({
    queryKey: ['account', id],
    queryFn: async (): Promise<AccountWithProfile> => {
      const res = await fetch(`/api/accounts/${id}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch account: ${res.statusText}`);
      }
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 min
  }),

  /**
   * Account by username (includes profile)
   * Used for profile pages
   */
  byUsername: (username: string) => ({
    queryKey: ['account', 'username', username],
    queryFn: async (): Promise<AccountWithProfile> => {
      const res = await fetch(`/api/accounts/username/${username}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch account by username: ${res.statusText}`);
      }
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 min
  }),

  /**
   * List accounts (with filters)
   * Used for search, admin, etc.
   */
  list: (filters?: { search?: string; limit?: number }) => ({
    queryKey: ['accounts', 'list', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.search) params.set('search', filters.search);
      if (filters?.limit) params.set('limit', String(filters.limit));

      const res = await fetch(`/api/accounts?${params.toString()}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch accounts: ${res.statusText}`);
      }
      return res.json();
    },
    staleTime: 2 * 60 * 1000, // 2 min
  }),
};
