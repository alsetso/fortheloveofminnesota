import { NextRequest, NextResponse } from 'next/server';
import { CountyAdminService } from '@/features/admin/services/countyAdminService';
import { UpdateCountyData } from '@/features/admin/services/countyAdminService';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validatePathParams, validateRequestBody } from '@/lib/security/validation';
import { z } from 'zod';
import { commonSchemas } from '@/lib/security/validation';

const countyIdPathSchema = z.object({
  id: commonSchemas.uuid,
});

const updateCountySchema = z.record(z.unknown());

/**
 * GET /api/admin/counties/[id]
 * Get county by ID
 * 
 * Security:
 * - Rate limited: 100 requests/minute (admin)
 * - Path parameter validation
 * - Requires admin role
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
        const pathValidation = validatePathParams({ id }, countyIdPathSchema);
        if (!pathValidation.success) {
          return pathValidation.error;
        }
        
        const { id: validatedId } = pathValidation.data;
        const service = new CountyAdminService();
        const county = await service.getById(validatedId);

        if (!county) {
          return createErrorResponse('County not found', 404);
        }

        return createSuccessResponse(county);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error fetching county:', error);
        }
        return createErrorResponse('Failed to fetch county', 500);
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
 * PATCH /api/admin/counties/[id]
 * Update county
 * 
 * Security:
 * - Rate limited: 100 requests/minute (admin)
 * - Request size limit: 1MB
 * - Input validation with Zod
 * - Requires admin role
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const { id } = await params;
        
        // Validate path parameters
        const pathValidation = validatePathParams({ id }, countyIdPathSchema);
        if (!pathValidation.success) {
          return pathValidation.error;
        }
        
        const { id: validatedId } = pathValidation.data;
        
        // Validate request body
        const validation = await validateRequestBody(req, updateCountySchema, REQUEST_SIZE_LIMITS.json);
        if (!validation.success) {
          return validation.error;
        }
        
        const body: UpdateCountyData = validation.data as UpdateCountyData;

        const service = new CountyAdminService();
        const county = await service.update(validatedId, body);

        return createSuccessResponse(county);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error updating county:', error);
        }
        return createErrorResponse('Failed to update county', 500);
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
 * DELETE /api/admin/counties/[id]
 * Delete county
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
        const pathValidation = validatePathParams({ id }, countyIdPathSchema);
        if (!pathValidation.success) {
          return pathValidation.error;
        }
        
        const { id: validatedId } = pathValidation.data;
        
        const service = new CountyAdminService();
        await service.delete(validatedId);

        return createSuccessResponse({ success: true });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error deleting county:', error);
        }
        return createErrorResponse('Failed to delete county', 500);
      }
    },
    {
      rateLimit: 'admin',
      requireAdmin: true,
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}



