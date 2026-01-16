import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, createServerClientWithAuth } from '@/lib/supabaseServer';
import { getServerAuth } from '@/lib/authServer';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validatePathParams, validateRequestBody } from '@/lib/security/validation';
import { z } from 'zod';
import { commonSchemas } from '@/lib/security/validation';

/**
 * GET /api/feed/[id]
 * Get a single post by ID
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated) or 100/min (public)
 * - Path parameter validation
 * - Optional authentication (RLS handles permissions)
 */
const postIdPathSchema = z.object({
  id: commonSchemas.uuid,
});

const updatePostSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(10000).optional(),
  images: z.array(z.object({
    url: z.string().url().max(2000),
    filename: z.string().max(500).optional(),
    type: z.string().max(100).optional(),
  })).max(20).optional(),
  visibility: z.enum(['public', 'draft']).optional(),
  city: z.string().max(200).optional().nullable(),
  state: z.string().max(50).optional().nullable(),
  zip: z.string().max(20).optional().nullable(),
  county: z.string().max(200).optional().nullable(),
  full_address: z.string().max(500).optional().nullable(),
  map_data: z.record(z.string(), z.unknown()).optional().nullable(),
});

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
        const pathValidation = validatePathParams({ id }, postIdPathSchema);
        if (!pathValidation.success) {
          return pathValidation.error;
        }
        
        const { id: validatedId } = pathValidation.data;
        
        const auth = await getServerAuth();
        const supabase = auth 
          ? await createServerClientWithAuth(cookies())
          : createServerClient();

        const { data: post, error } = await supabase
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
          .eq('id', validatedId)
          .single();

        if (error || !post) {
          if (error?.code === 'PGRST116' || error?.message?.includes('row-level security')) {
            return createErrorResponse('You do not have access to this post', 403);
          }
          return createErrorResponse('Post not found', 404);
        }

        return createSuccessResponse({ post });
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

/**
 * PUT /api/feed/[id]
 * Update a post (owner only)
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated)
 * - Request size limit: 10MB (for media uploads)
 * - Input validation with Zod
 * - Requires authentication
 * - Ownership check (RLS handles this)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const { id } = await params;
        
        // Validate path parameters
        const pathValidation = validatePathParams({ id }, postIdPathSchema);
        if (!pathValidation.success) {
          return pathValidation.error;
        }
        
        const { id: validatedId } = pathValidation.data;
        
        if (!userId || !accountId) {
          return createErrorResponse('Unauthorized - authentication required', 401);
        }

        const supabase = await createServerClientWithAuth(cookies());
        
        // Verify post exists and user owns it
        const { data: existingPost, error: fetchError } = await supabase
          .from('posts')
          .select('account_id')
          .eq('id', validatedId)
          .single();

        if (fetchError || !existingPost) {
          return createErrorResponse('Post not found', 404);
        }

        // Verify ownership (RLS will also enforce this)
        const postData = existingPost as { account_id: string };
        if (postData.account_id !== accountId) {
          return createErrorResponse('Forbidden - you can only update your own posts', 403);
        }

        // Validate request body
        const validation = await validateRequestBody(req, updatePostSchema, 10 * 1024 * 1024); // 10MB
        if (!validation.success) {
          return validation.error;
        }
        
        const body = validation.data;

        // Build update data
        const updateData: Record<string, unknown> = {};
        if (body.title !== undefined) {
          updateData.title = body.title;
        }
        if (body.content !== undefined) {
          updateData.content = body.content;
        }
        if (body.images !== undefined) {
          updateData.images = body.images;
        }
        if (body.visibility !== undefined) {
          updateData.visibility = body.visibility;
        }
        if (body.city !== undefined) {
          updateData.city = body.city;
        }
        if (body.state !== undefined) {
          updateData.state = body.state;
        }
        if (body.zip !== undefined) {
          updateData.zip = body.zip;
        }
        if (body.county !== undefined) {
          updateData.county = body.county;
        }
        if (body.full_address !== undefined) {
          updateData.full_address = body.full_address;
        }
        if (body.map_data !== undefined) {
          updateData.map_data = body.map_data;
        }

        const { data: post, error } = await supabase
          .from('posts')
          .update(updateData as any)
          .eq('id', validatedId)
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
            console.error('[Feed API] Error updating post:', error);
          }
          return createErrorResponse('Failed to update post', 500);
        }

        return createSuccessResponse({ post });
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

/**
 * DELETE /api/feed/[id]
 * Delete a post (owner only)
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated)
 * - Path parameter validation
 * - Requires authentication
 * - Ownership check (RLS handles this)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const { id } = await params;
        
        // Validate path parameters
        const pathValidation = validatePathParams({ id }, postIdPathSchema);
        if (!pathValidation.success) {
          return pathValidation.error;
        }
        
        const { id: validatedId } = pathValidation.data;
        
        if (!userId || !accountId) {
          return createErrorResponse('Unauthorized - authentication required', 401);
        }

        const supabase = await createServerClientWithAuth(cookies());

        // Verify post exists and user owns it
        const { data: existingPost, error: fetchError } = await supabase
          .from('posts')
          .select('account_id')
          .eq('id', validatedId)
          .single();

        if (fetchError || !existingPost) {
          return createErrorResponse('Post not found', 404);
        }

        // Verify ownership (RLS will also enforce this)
        const postData = existingPost as { account_id: string };
        if (postData.account_id !== accountId) {
          return createErrorResponse('Forbidden - you can only delete your own posts', 403);
        }

        // Delete post
        const { error: deleteError } = await supabase
          .from('posts')
          .delete()
          .eq('id', validatedId);

        if (deleteError) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Feed API] Error deleting post:', deleteError);
          }
          return createErrorResponse('Failed to delete post', 500);
        }

        return createSuccessResponse({ success: true });
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
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}
