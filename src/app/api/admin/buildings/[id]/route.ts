import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validatePathParams, validateRequestBody } from '@/lib/security/validation';
import { z } from 'zod';
import { commonSchemas } from '@/lib/security/validation';

const buildingIdPathSchema = z.object({
  id: commonSchemas.uuid,
});

const updateBuildingSchema = z.object({
  type: z.string().max(100).optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
  full_address: z.string().max(500).optional().nullable(),
  website: z.string().url().max(500).optional().nullable(),
  cover_images: z.array(z.string().url()).optional().nullable(),
});

/**
 * PUT /api/admin/buildings/[id]
 * Update building
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
        const pathValidation = validatePathParams({ id }, buildingIdPathSchema);
        if (!pathValidation.success) {
          return pathValidation.error;
        }
        
        const { id: validatedId } = pathValidation.data;
        
        // Validate request body
        const validation = await validateRequestBody(req, updateBuildingSchema, REQUEST_SIZE_LIMITS.json);
        if (!validation.success) {
          return validation.error;
        }
        
        const body = validation.data;
    
        const supabase = createServiceClient();
        
        const { data, error } = await (supabase as any)
          .schema('civic')
          .from('buildings')
          .update({
            type: body.type,
            name: body.name,
            description: body.description || null,
            lat: body.lat || null,
            lng: body.lng || null,
            full_address: body.full_address || null,
            website: body.website || null,
            cover_images: body.cover_images || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', validatedId)
          .select()
          .single();
        
        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Admin Buildings API] Error updating:', error);
          }
          return createErrorResponse('Failed to update building', 500);
        }
        
        return createSuccessResponse(data);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[Admin Buildings API] Error:', error);
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
 * DELETE /api/admin/buildings/[id]
 * Delete building
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
        const pathValidation = validatePathParams({ id }, buildingIdPathSchema);
        if (!pathValidation.success) {
          return pathValidation.error;
        }
        
        const { id: validatedId } = pathValidation.data;
        
        const supabase = createServiceClient();
        
        const { error } = await (supabase as any)
          .schema('civic')
          .from('buildings')
          .delete()
          .eq('id', validatedId);
        
        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Admin Buildings API] Error deleting:', error);
          }
          return createErrorResponse('Failed to delete building', 500);
        }
        
        return createSuccessResponse({ success: true });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[Admin Buildings API] Error:', error);
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

