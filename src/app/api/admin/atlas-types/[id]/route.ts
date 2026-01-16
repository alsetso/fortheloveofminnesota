import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validatePathParams, validateRequestBody } from '@/lib/security/validation';
import { z } from 'zod';
import { commonSchemas } from '@/lib/security/validation';

const atlasTypeIdPathSchema = z.object({
  id: commonSchemas.uuid,
});

const updateAtlasTypeSchema = z.record(z.string(), z.unknown());

/**
 * PUT /api/admin/atlas-types/[id]
 * Update atlas type
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
        const pathValidation = validatePathParams({ id }, atlasTypeIdPathSchema);
        if (!pathValidation.success) {
          return pathValidation.error;
        }
        
        const { id: validatedId } = pathValidation.data;
        
        // Validate request body
        const validation = await validateRequestBody(req, updateAtlasTypeSchema, REQUEST_SIZE_LIMITS.json);
        if (!validation.success) {
          return validation.error;
        }
        
        const body = validation.data;
    
        const supabase = createServiceClient();
        
        const { data, error } = await (supabase as any)
          .schema('atlas')
          .from('atlas_types')
          .update(body)
          .eq('id', validatedId)
          .select()
          .single();
        
        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Admin Atlas Types API] Error updating:', error);
          }
          return createErrorResponse('Failed to update atlas type', 500);
        }
        
        return createSuccessResponse(data);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[Admin Atlas Types API] Error:', error);
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
 * DELETE /api/admin/atlas-types/[id]
 * Delete atlas type
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
        const pathValidation = validatePathParams({ id }, atlasTypeIdPathSchema);
        if (!pathValidation.success) {
          return pathValidation.error;
        }
        
        const { id: validatedId } = pathValidation.data;
        
        const supabase = createServiceClient();
        
        const { error } = await (supabase as any)
          .schema('atlas')
          .from('atlas_types')
          .delete()
          .eq('id', validatedId);
        
        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Admin Atlas Types API] Error deleting:', error);
          }
          return createErrorResponse('Failed to delete atlas type', 500);
        }
        
        return createSuccessResponse({ success: true });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[Admin Atlas Types API] Error:', error);
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

