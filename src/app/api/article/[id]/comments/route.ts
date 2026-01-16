import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithAuth, createServiceClient } from '@/lib/supabaseServer';
import { cookies } from 'next/headers';
import { getGeneratedIdFromArticleId } from '@/features/news/services/newsCommentService';
import { handleApiError } from '@/lib/apiErrorHandler';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validatePathParams, validateRequestBody, commonSchemas } from '@/lib/security/validation';
import { z } from 'zod';

const articleIdPathSchema = z.object({
  id: z.string().min(1).max(200),
});

/**
 * GET /api/article/[id]/comments
 * Get comments for an article
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
        const { id: articleId } = await params;
        
        // Validate path parameters
        const pathValidation = validatePathParams({ id: articleId }, articleIdPathSchema);
        if (!pathValidation.success) {
          return pathValidation.error;
        }
        
        const { id: validatedArticleId } = pathValidation.data;
        const supabase = createServiceClient();

        // Get generated_id from article_id
        const generatedId = await getGeneratedIdFromArticleId(validatedArticleId);

        if (!generatedId) {
          return createSuccessResponse({
            success: true,
            data: [], // No article found, return empty comments
          });
        }

        // Fetch comments using generated_id
        const { data: comments, error } = await (supabase as any)
          .schema('news')
          .from('comments')
          .select('*')
          .eq('generated_id', generatedId)
          .order('created_at', { ascending: true });

        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('Error fetching comments:', error);
          }
          return createErrorResponse('Failed to fetch comments', 500);
        }

        // Fetch all unique account IDs
        const accountIds = [...new Set((comments || []).map((c: any) => c.account_id))];
        
        // Use RPC function to fetch accounts (bypasses RLS via SECURITY DEFINER)
        const { data: allAccounts, error: accountsError } = await (supabase as any)
          .rpc('get_accounts_for_comments', { p_account_ids: accountIds });
        
        if (accountsError && process.env.NODE_ENV === 'development') {
          console.error('Error fetching accounts:', accountsError);
        }
        
        // Create a map for quick lookup
        const accountMap = new Map((allAccounts || []).map((acc: any) => [acc.id, acc]));
        
        // Attach account data to each comment
        const commentsWithAccounts = (comments || []).map((comment: any) => ({
          ...comment,
          accounts: accountMap.get(comment.account_id) || null,
        }));

        return createSuccessResponse({
          success: true,
          data: commentsWithAccounts || [],
        });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error in GET /api/article/[id]/comments:', error);
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

const createCommentSchema = z.object({
  content: z.string().min(1).max(2000).trim(),
  parent_comment_id: commonSchemas.uuid.optional().nullable(),
});

/**
 * POST /api/article/[id]/comments
 * Create comment on article
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated)
 * - Request size limit: 1MB
 * - Input validation with Zod
 * - Requires authentication
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const { id: articleId } = await params;
        
        // Validate path parameters
        const pathValidation = validatePathParams({ id: articleId }, articleIdPathSchema);
        if (!pathValidation.success) {
          return pathValidation.error;
        }
        
        const { id: validatedArticleId } = pathValidation.data;
        
        if (!userId || !accountId) {
          return createErrorResponse('You must be signed in to comment', 401);
        }

        const supabase = await createServerClientWithAuth(cookies());
        
        // Validate request body
        const validation = await validateRequestBody(req, createCommentSchema, REQUEST_SIZE_LIMITS.json);
        if (!validation.success) {
          return validation.error;
        }
        
        const { content, parent_comment_id } = validation.data;

        // Get generated_id from article_id
        const generatedId = await getGeneratedIdFromArticleId(validatedArticleId);

        if (!generatedId) {
          return createErrorResponse('Article not found', 404);
        }

        // Insert comment into news.comments using generated_id
        const { data: comment, error } = await (supabase as any)
          .schema('news')
          .from('comments')
          .insert({
            generated_id: generatedId,
            account_id: accountId,
            content: content,
            parent_comment_id: parent_comment_id || null,
          })
          .select('*')
          .single();

        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('Error creating comment:', error);
          }
          return createErrorResponse('Failed to create comment', 500);
        }

        // Fetch account info using RPC function (bypasses RLS)
        const { data: accountData, error: accountsError } = await (supabase as any)
          .rpc('get_accounts_for_comments', { p_account_ids: [accountId] });

        if (accountsError && process.env.NODE_ENV === 'development') {
          console.error('Error fetching account:', accountsError);
        }

        const account = accountData && accountData.length > 0 ? accountData[0] : null;

        const data = {
          ...comment,
          accounts: account || null,
        };

        return createSuccessResponse({
          success: true,
          data,
        });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error in POST /api/article/[id]/comments:', error);
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

