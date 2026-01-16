import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validatePathParams, validateRequestBody } from '@/lib/security/validation';
import { z } from 'zod';
import { commonSchemas } from '@/lib/security/validation';

const mentionIconIdPathSchema = z.object({
  id: commonSchemas.uuid,
});

const updateMentionIconSchema = z.record(z.unknown());

/**
 * PUT /api/admin/mention-icons/[id]
 * Update mention icon
 * 
 * Security:
 * - Rate limited: 100 requests/minute (admin)
 * - Request size limit: 1MB
 * - Input validation with Zod
 * - Requires admin role
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
        const pathValidation = validatePathParams({ id }, mentionIconIdPathSchema);
        if (!pathValidation.success) {
          return pathValidation.error;
        }
        
        const { id: validatedId } = pathValidation.data;
        
        // Validate request body
        const validation = await validateRequestBody(req, updateMentionIconSchema, REQUEST_SIZE_LIMITS.json);
        if (!validation.success) {
          return validation.error;
        }
        
        const body = validation.data;
    
        const supabase = createServiceClient();
        
        const { data, error } = await (supabase as any)
          .from('mention_icons')
          .update(body)
          .eq('id', validatedId)
          .select()
          .single();
        
        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Admin Mention Icons API] Error updating:', error);
          }
          return createErrorResponse('Failed to update mention icon', 500);
        }
        
        return createSuccessResponse(data);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[Admin Mention Icons API] Error:', error);
        }
        return createErrorResponse('Internal server error', 500);
      }
    },
    {
      rateLimit: 'admin',
      requireAdmin: true,
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}

/**
 * DELETE /api/admin/mention-icons/[id]
 * Delete mention icon
 * 
 * Security:
 * - Rate limited: 100 requests/minute (admin)
 * - Path parameter validation
 * - Requires admin role
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
        const pathValidation = validatePathParams({ id }, mentionIconIdPathSchema);
        if (!pathValidation.success) {
          return pathValidation.error;
        }
        
        const { id: validatedId } = pathValidation.data;
        
        const supabase = createServiceClient();
        
        const { error } = await supabase
          .from('mention_icons')
          .delete()
          .eq('id', validatedId);
        
        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Admin Mention Icons API] Error deleting:', error);
          }
          return createErrorResponse('Failed to delete mention icon', 500);
        }
        
        return createSuccessResponse({ success: true });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[Admin Mention Icons API] Error:', error);
        }
        return createErrorResponse('Internal server error', 500);
      }
    },
    {
      rateLimit: 'admin',
      requireAdmin: true,
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}

