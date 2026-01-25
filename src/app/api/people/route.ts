import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validateQueryParams } from '@/lib/security/validation';
import { z } from 'zod';

const peopleQuerySchema = z.object({
  q: z.string().max(80).optional(),
});

/**
 * GET /api/people
 * Returns searchable public accounts
 * Requires authentication
 */
export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      try {
        const { searchParams } = new URL(req.url);
        const validation = validateQueryParams(searchParams, peopleQuerySchema);
        
        if (!validation.success) {
          return validation.error;
        }

        const { q } = validation.data;
        const qNormalized = q ? q.replaceAll(',', ' ').trim() : '';
        const qEscaped = qNormalized
          .replaceAll('\\', '\\\\')
          .replaceAll('%', '\\%')
          .replaceAll('_', '\\_');

        const supabase = createServerClient();
        let query = supabase
          .from('accounts')
          .select('id,username,first_name,last_name,image_url,bio,created_at,plan,traits')
          .not('username', 'is', null)
          .eq('search_visibility', true)
          .order('created_at', { ascending: false });

        if (qEscaped) {
          const pattern = `%${qEscaped}%`;
          query = query.or(
            [
              `username.ilike.${pattern}`,
              `first_name.ilike.${pattern}`,
              `last_name.ilike.${pattern}`,
            ].join(',')
          );
        }

        const { data, error } = await query.limit(500);

        if (error) {
          return NextResponse.json(
            { error: error.message },
            { status: 500 }
          );
        }

        return NextResponse.json({
          people: data || [],
        });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error in GET /api/people:', error);
        }
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    },
    {
      rateLimit: 'public',
      requireAuth: true,
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}
