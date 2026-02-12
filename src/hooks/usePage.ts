'use client';

import { useEffect, useState } from 'react';
import { useSupabaseClient } from './useSupabaseClient';
import { useAuthStateSafe } from '@/features/auth';

export interface PageData {
  id: string;
  title: string;
  slug: string | null;
  icon: string | null;
  cover_url: string | null;
  owner_id: string;
  visibility: 'private' | 'public' | 'shared';
  description: string | null;
  tags: string[] | null;
  is_shortcut: boolean;
  shortcut_color: string | null;
  shortcut_order: number | null;
  created_at: string;
  updated_at: string;
  last_edited_at: string;
  owner: {
    id: string;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
  };
}

export interface PageBlock {
  id: string;
  page_id: string;
  type: string;
  content: Record<string, any>;
  parent_id: string | null;
  prev_id: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

/**
 * Hook to fetch a single page by ID or slug
 * Handles visibility checks (owner can see all, public can see public pages)
 */
export function usePage(pageIdOrSlug: string) {
  const supabase = useSupabaseClient();
  const { account } = useAuthStateSafe();
  const [page, setPage] = useState<PageData | null>(null);
  const [blocks, setBlocks] = useState<PageBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    if (!pageIdOrSlug) {
      setPage(null);
      setBlocks([]);
      setLoading(false);
      return;
    }

    async function fetchPage() {
      try {
        setLoading(true);
        setError(null);

        // Determine if identifier is UUID or slug
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pageIdOrSlug);
        
        // Build query - try both id and slug
        // Note: We'll fetch owner separately due to cross-schema foreign key limitations
        let query = (supabase as any)
          .schema('pages')
          .from('pages')
          .select(`
            id,
            title,
            slug,
            icon,
            cover_url,
            owner_id,
            visibility,
            description,
            tags,
            is_shortcut,
            shortcut_color,
            shortcut_order,
            created_at,
            updated_at,
            last_edited_at
          `);

        if (isUUID) {
          query = query.eq('id', pageIdOrSlug);
        } else {
          query = query.eq('slug', pageIdOrSlug);
        }

        const { data: pageData, error: pageError } = await query.single();

        if (pageError) {
          console.error('Supabase error fetching page:', {
            message: pageError.message,
            details: pageError.details,
            hint: pageError.hint,
            code: pageError.code,
            pageIdOrSlug,
            isUUID,
          });
          throw pageError;
        }

        if (!pageData) {
          throw new Error(`Page not found: ${pageIdOrSlug}`);
        }

        // Fetch owner account separately (cross-schema foreign key joins don't work well)
        const { data: ownerData, error: ownerError } = await supabase
          .from('accounts')
          .select('id, username, first_name, last_name, image_url')
          .eq('id', pageData.owner_id)
          .single();

        if (ownerError) {
          console.error('Error fetching owner:', ownerError);
          // Don't throw - page can exist without owner data
        }

        // Combine page data with owner
        const pageWithOwner = {
          ...pageData,
          owner: ownerData || {
            id: pageData.owner_id,
            username: null,
            first_name: null,
            last_name: null,
            image_url: null,
          },
        };

        // Check if current user is owner
        const ownerCheck = account?.id === pageData.owner_id;
        setIsOwner(ownerCheck);

        // Check visibility permissions
        // Owner can always see their pages
        // Public pages are visible to all
        // Private/shared pages require owner or explicit permission
        if (!ownerCheck && pageWithOwner.visibility !== 'public') {
          // For non-public pages, check if user has permission
          if (account?.id) {
            const { data: permission } = await (supabase as any)
              .schema('pages')
              .from('permissions')
              .select('level')
              .eq('page_id', pageWithOwner.id)
              .eq('account_id', account.id)
              .single();

            if (!permission) {
              throw new Error('You do not have permission to view this page');
            }
          } else {
            throw new Error('This page is private');
          }
        }

        setPage(pageWithOwner);

        // Fetch blocks for this page
        const { data: blocksData, error: blocksError } = await (supabase as any)
          .schema('pages')
          .from('blocks')
          .select('*')
          .eq('page_id', pageData.id)
          .order('position', { ascending: true });

        if (blocksError) {
          console.error('Error fetching blocks:', blocksError);
          // Don't throw - page can exist without blocks
          setBlocks([]);
        } else {
          setBlocks(blocksData || []);
        }
      } catch (err: any) {
        console.error('Error fetching page:', {
          error: err,
          message: err?.message,
          details: err?.details,
          hint: err?.hint,
          code: err?.code,
          pageIdOrSlug,
          accountId: account?.id,
        });
        setError(err?.message || err?.details || err?.hint || 'Failed to load page');
        setPage(null);
        setBlocks([]);
      } finally {
        setLoading(false);
      }
    }

    fetchPage();
  }, [supabase, pageIdOrSlug, account?.id]);

  return { page, blocks, loading, error, isOwner };
}
