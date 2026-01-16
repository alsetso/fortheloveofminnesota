import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase';
import type { Visitor } from '@/types/analytics';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validateQueryParams } from '@/lib/security/validation';
import { z } from 'zod';
import { commonSchemas } from '@/lib/security/validation';

/**
 * GET /api/analytics/visitors
 * Get visitors for a page or mention
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated)
 * - Requires authentication
 * - Query parameter validation
 */
const visitorsQuerySchema = z.object({
  page_url: z.string().url().max(2000).optional(),
  mention_id: commonSchemas.uuid.optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
}).refine(
  (data) => data.page_url || data.mention_id,
  { message: 'Either page_url or mention_id is required' }
);

export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const url = new URL(req.url);
        const validation = validateQueryParams(url.searchParams, visitorsQuerySchema);
        if (!validation.success) {
          return validation.error;
        }
        
        const { page_url, mention_id, limit, offset } = validation.data;
        const cookieStore = await cookies();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }
    
    const supabase = createServerClient<Database>(
      supabaseUrl,
      supabaseAnonKey,
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

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get account
    const { data: account } = await supabase
      .from('accounts')
      .select('id, username')
      .eq('user_id', user.id)
      .single() as { data: { id: string; username: string | null } | null; error: any };

    if (!account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    let isOwner = false;
    if (page_url) {
      // For page URLs, check if it's the user's profile page
      const profileUrl = account.username ? `/profile/${account.username}` : `/account/settings`;
      isOwner = page_url === profileUrl;
      
      // Could also check other owned pages here (e.g., user-created pages)
    } else if (mention_id) {
      // For mentions, check if user owns the mention
      const { data: mention } = await supabase
        .from('mentions')
        .select('account_id')
        .eq('id', mention_id)
        .single() as { data: { account_id: string } | null; error: any };
      isOwner = (mention as { account_id: string } | null)?.account_id === account.id;
    }

    if (!isOwner) {
      return NextResponse.json(
        { error: 'You can only view visitors to your own content' },
        { status: 403 }
      );
    }

    // Get visitors using the new functions
    let visitors: Visitor[] | null = null;
    let error: any = null;

    if (page_url) {
      const result = await supabase.rpc('get_page_viewers', {
        p_page_url: page_url,
        p_limit: limit,
        p_offset: offset,
      } as any);
      visitors = result.data as Visitor[] | null;
      error = result.error;
    } else if (mention_id) {
      // Note: get_pin_viewers function may need to be updated to get_mention_viewers
      // For now, returning empty array as mentions don't have view tracking yet
      visitors = [];
      error = null;
    }

    if (error) {
      console.error('Error getting visitors:', error);
      return NextResponse.json(
        { error: 'Failed to get visitors', details: error.message },
        { status: 500 }
      );
    }

        const visitorsArray = (visitors || []) as Visitor[];
        return NextResponse.json({
          visitors: visitorsArray,
          total: visitorsArray.length,
        });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error in GET /api/analytics/visitors:', error);
        }
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    },
    {
      rateLimit: 'authenticated',
      requireAuth: true,
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}

