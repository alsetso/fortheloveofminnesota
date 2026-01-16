import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, createServerClientWithAuth } from '@/lib/supabaseServer';
import { getServerAuth } from '@/lib/authServer';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validateQueryParams, validateRequestBody } from '@/lib/security/validation';
import { z } from 'zod';
import { commonSchemas } from '@/lib/security/validation';

/**
 * GET /api/feed
 * List posts with pagination and filters
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated) or 100/min (public)
 * - Query parameter validation
 * - Optional authentication (RLS handles permissions)
 */
const feedQuerySchema = z.object({
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(100)).default(20),
  offset: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(0)).default(0),
  city: z.string().max(200).optional(),
  county: z.string().max(200).optional(),
  state: z.string().max(50).optional(),
  visibility: z.enum(['public', 'draft']).optional(),
});

/**
 * POST /api/feed
 * Create a new post
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated)
 * - Request size limit: 10MB (for media uploads)
 * - Input validation with Zod
 * - Requires authentication
 * - Ownership check (RLS handles this)
 */
const createPostSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(10000),
  images: z.array(z.object({
    url: z.string().url().max(2000),
    filename: z.string().max(500).optional(),
    type: z.string().max(100).optional(),
  })).max(20).optional(),
  visibility: z.enum(['public', 'draft']).default('public'),
  account_id: commonSchemas.uuid,
  type: z.enum(['simple']).default('simple'),
  city: z.string().max(200).optional().nullable(),
  state: z.string().max(50).optional().nullable(),
  zip: z.string().max(20).optional().nullable(),
  county: z.string().max(200).optional().nullable(),
  full_address: z.string().max(500).optional().nullable(),
  map_data: z.record(z.string(), z.unknown()).optional().nullable(),
});

export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const url = new URL(req.url);
        const validation = validateQueryParams(url.searchParams, feedQuerySchema);
        if (!validation.success) {
          return validation.error;
        }
        
        const { limit, offset, city, county, state, visibility } = validation.data;
        
        const auth = await getServerAuth();
        const supabase = auth 
          ? await createServerClientWithAuth(cookies())
          : createServerClient();

        // Build query
        let query = supabase
          .from('posts')
          .select(`
            id,
            account_id,
            title,
            content,
            images,
            visibility,
            type,
            city,
            state,
            zip,
            county,
            full_address,
            map_data,
            created_at,
            updated_at,
            account:accounts!inner(
              id,
              username,
              first_name,
              last_name,
              image_url
            )
          `)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        // Apply filters
        if (city) {
          query = query.eq('city', city);
        }
        if (county) {
          query = query.eq('county', county);
        }
        if (state) {
          query = query.eq('state', state);
        }
        if (visibility) {
          query = query.eq('visibility', visibility);
        }

        const { data: posts, error } = await query;

        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Feed API] Error fetching posts:', error);
          }
          return createErrorResponse('Failed to fetch posts', 500);
        }

        // Check if there are more posts
        const hasMore = posts && posts.length === limit;

        return createSuccessResponse({
          posts: posts || [],
          hasMore: hasMore || false,
        });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[Feed API] Error:', error);
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

export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        if (!userId || !accountId) {
          return createErrorResponse('Unauthorized - authentication required', 401);
        }

        const supabase = await createServerClientWithAuth(cookies());
        
        // Validate request body
        const validation = await validateRequestBody(req, createPostSchema, 10 * 1024 * 1024); // 10MB for media
        if (!validation.success) {
          return validation.error;
        }
        
        const body = validation.data;

        // Verify account ownership (RLS will also enforce this)
        if (body.account_id !== accountId) {
          return createErrorResponse('Forbidden - you can only create posts for your own account', 403);
        }

        // Prepare insert data
        const insertData = {
          account_id: body.account_id,
          title: body.title || body.content.split('\n')[0].substring(0, 200) || 'Untitled',
          content: body.content,
          images: body.images || null,
          visibility: body.visibility,
          type: body.type,
          city: body.city || null,
          state: body.state || null,
          zip: body.zip || null,
          county: body.county || null,
          full_address: body.full_address || null,
          map_data: body.map_data || null,
        };

        const { data: post, error } = await supabase
          .from('posts')
          .insert(insertData as any)
          .select(`
            id,
            account_id,
            title,
            content,
            images,
            visibility,
            type,
            city,
            state,
            zip,
            county,
            full_address,
            map_data,
            created_at,
            updated_at
          `)
          .single();

        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Feed API] Error creating post:', error);
          }
          return createErrorResponse('Failed to create post', 500);
        }

        return createSuccessResponse({ post }, 201);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[Feed API] Error:', error);
        }
        return createErrorResponse('Internal server error', 500);
      }
    },
    {
      rateLimit: 'authenticated',
      requireAuth: true,
      maxRequestSize: 10 * 1024 * 1024, // 10MB for media uploads
    }
  );
}
