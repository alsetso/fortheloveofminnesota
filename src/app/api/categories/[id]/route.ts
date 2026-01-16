import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from '@/types/supabase';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validatePathParams } from '@/lib/security/validation';
import { z } from 'zod';
import { commonSchemas } from '@/lib/security/validation';

const categoryIdPathSchema = z.object({
  id: commonSchemas.uuid,
});

/**
 * GET /api/categories/[id]
 * Get category by ID
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated) or 100/min (public)
 * - Path parameter validation
 * - Optional authentication
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const { id } = await params;
        
        // Validate path parameters
        const pathValidation = validatePathParams({ id }, categoryIdPathSchema);
        if (!pathValidation.success) {
          return pathValidation.error;
        }
        
        const { id: categoryId } = pathValidation.data;
        
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

        const { data: category, error } = await supabase
          .from('categories')
          .select('id, name')
          .eq('id', categoryId)
          .single();

        if (error || !category) {
          return createErrorResponse('Category not found', 404);
        }

        return createSuccessResponse(category);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error fetching category:', error);
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

