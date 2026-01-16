import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from '@/types/supabase';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validateRequestBody } from '@/lib/security/validation';
import { z } from 'zod';

const createCategorySchema = z.object({
  name: z.string().min(1).max(200).trim(),
});

/**
 * POST /api/categories
 * Create category
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated)
 * - Request size limit: 1MB
 * - Input validation with Zod
 * - Requires authentication
 */
export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        if (!userId || !accountId) {
          return createErrorResponse('Unauthorized', 401);
        }

        const cookieStore = await cookies();
        const response = new NextResponse();
        
        // Validate request body
        const validation = await validateRequestBody(req, createCategorySchema, REQUEST_SIZE_LIMITS.json);
        if (!validation.success) {
          return validation.error;
        }
        
        const { name } = validation.data;

        const supabase = createServerClient<Database>(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            cookies: {
              getAll() {
                return cookieStore.getAll();
              },
              setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value, options }) => {
                  response.cookies.set({ name, value, ...options });
                });
              },
            },
          }
        );

        // Get authenticated user
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
          return createErrorResponse('Unauthorized', 401);
        }

        // Check if category already exists
        const { data: existing } = await supabase
          .from('categories')
          .select('id, name')
          .ilike('name', name)
          .single();

        if (existing) {
          return createSuccessResponse(existing);
        }

        // Create new category (created_by will be set by trigger)
        const { data: newCategory, error: insertError } = await supabase
          .from('categories')
          .insert({ name } as any)
          .select('id, name')
          .single();

        if (insertError) {
          if (process.env.NODE_ENV === 'development') {
            console.error('Error creating category:', insertError);
          }
          return createErrorResponse('Failed to create category', 500);
        }

        return createSuccessResponse(newCategory, 201);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error in categories POST:', error);
        }
        return createErrorResponse('Internal server error', 500);
      }
    },
    {
      rateLimit: 'authenticated',
      requireAuth: true,
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}

