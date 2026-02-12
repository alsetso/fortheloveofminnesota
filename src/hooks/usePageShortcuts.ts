'use client';

import { useEffect, useState } from 'react';
import { useSupabaseClient } from './useSupabaseClient';
import { useAuthStateSafe } from '@/features/auth';

export interface PageShortcut {
  id: string;
  title: string;
  icon: string | null;
  shortcut_color: string | null;
  slug: string | null;
}

/**
 * Hook to fetch user's page shortcuts from pages.pages
 * Returns shortcuts where is_shortcut = true, ordered by shortcut_order
 */
export function usePageShortcuts() {
  const supabase = useSupabaseClient();
  const { account } = useAuthStateSafe();
  const [shortcuts, setShortcuts] = useState<PageShortcut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!account?.id) {
      setShortcuts([]);
      setLoading(false);
      return;
    }

    async function fetchShortcuts() {
      try {
        setLoading(true);
        setError(null);

        // Type assertion needed: Supabase TypeScript types only support 'public' schema,
        // but we need to query from 'pages' schema. The schema() method exists at runtime.
        const { data, error: fetchError } = await (supabase as any)
          .schema('pages')
          .from('pages')
          .select('id, title, icon, shortcut_color, slug')
          .eq('is_shortcut', true)
          .eq('owner_id', account.id)
          .order('shortcut_order', { ascending: true, nullsLast: true })
          .order('created_at', { ascending: false });

        if (fetchError) {
          console.error('Supabase error fetching page shortcuts:', {
            message: fetchError.message,
            details: fetchError.details,
            hint: fetchError.hint,
            code: fetchError.code,
          });
          throw fetchError;
        }

        setShortcuts(data || []);
      } catch (err: any) {
        console.error('Error fetching page shortcuts:', {
          error: err,
          message: err?.message,
          details: err?.details,
          hint: err?.hint,
          code: err?.code,
          accountId: account?.id,
        });
        setError(err?.message || err?.details || 'Failed to load shortcuts');
        setShortcuts([]);
      } finally {
        setLoading(false);
      }
    }

    fetchShortcuts();
  }, [supabase, account?.id]);

  return { shortcuts, loading, error };
}
