'use client';

import { useEffect, useState } from 'react';
import { useSupabaseClient } from './useSupabaseClient';
import { useAuthStateSafe } from '@/features/auth';

export interface Page {
  id: string;
  title: string;
  icon: string | null;
  shortcut_color: string | null;
  slug: string | null;
}

/**
 * Hook to fetch user's pages from pages.pages
 * Returns all pages owned by the user, ordered by created_at
 */
export function usePages() {
  const supabase = useSupabaseClient();
  const { account } = useAuthStateSafe();
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!account?.id) {
      setPages([]);
      setLoading(false);
      return;
    }

    async function fetchPages() {
      try {
        setLoading(true);
        setError(null);

        // Type assertion needed: Supabase TypeScript types only support 'public' schema,
        // but we need to query from 'pages' schema. The schema() method exists at runtime.
        const { data, error: fetchError } = await (supabase as any)
          .schema('pages')
          .from('pages')
          .select('id, title, icon, shortcut_color, slug')
          .eq('owner_id', account.id)
          .order('created_at', { ascending: false });

        if (fetchError) {
          console.error('Supabase error fetching pages:', {
            message: fetchError.message,
            details: fetchError.details,
            hint: fetchError.hint,
            code: fetchError.code,
          });
          throw fetchError;
        }

        setPages(data || []);
      } catch (err: any) {
        console.error('Error fetching pages:', {
          error: err,
          message: err?.message,
          details: err?.details,
          hint: err?.hint,
          code: err?.code,
          accountId: account?.id,
        });
        setError(err?.message || err?.details || 'Failed to load pages');
        setPages([]);
      } finally {
        setLoading(false);
      }
    }

    fetchPages();
  }, [supabase, account?.id]);

  return { pages, loading, error };
}
