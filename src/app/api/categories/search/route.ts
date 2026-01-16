import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from '@/types/supabase';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validateQueryParams } from '@/lib/security/validation';
import { z } from 'zod';

const categorySearchQuerySchema = z.object({
  q: z.string().max(200).default(''),
});

/**
 * GET /api/categories/search
 * Search categories
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated) or 100/min (public)
 * - Query parameter validation
 * - Optional authentication
 */
export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const url = new URL(req.url);
        const validation = validateQueryParams(url.searchParams, categorySearchQuerySchema);
        if (!validation.success) {
          return validation.error;
        }
        
        const { q: query } = validation.data;
        
        const cookieStore = await cookies();

        const supabase = createServerClient<Database>(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            cookies: {
              getAll() {
                return cookieStore.getAll();
              },
              setAll() {
                // Route handlers can set cookies, but this endpoint doesn't need to
              },
            },
          }
        );

        if (!query.trim()) {
          return createSuccessResponse({ categories: [] });
        }

        // Fuzzy search: use ilike for case-insensitive partial matching
        const { data: categories, error } = await supabase
          .from('categories')
          .select('id, name')
          .ilike('name', `%${query}%`)
          .order('name', { ascending: true })
          .limit(20) as { data: Array<{ id: string; name: string }> | null; error: any };

        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('Error searching categories:', error);
          }
          return createErrorResponse('Failed to search categories', 500);
        }

        // Sort results: exact matches first, then by relevance
        const sortedCategories = (categories || []).sort((a, b) => {
          const aLower = a.name.toLowerCase();
          const bLower = b.name.toLowerCase();
          const queryLower = query.toLowerCase();

          // Exact match first
          if (aLower === queryLower) return -1;
          if (bLower === queryLower) return 1;

          // Starts with query
          const aStarts = aLower.startsWith(queryLower);
          const bStarts = bLower.startsWith(queryLower);
          if (aStarts && !bStarts) return -1;
          if (!aStarts && bStarts) return 1;

          // Alphabetical
          return aLower.localeCompare(bLower);
        });

        return createSuccessResponse({ categories: sortedCategories });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error in categories search:', error);
        }
        return createErrorResponse('Internal server error', 500);
      }
    },
    {
      rateLimit: 'authenticated',
      requireAuth: false,
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}

