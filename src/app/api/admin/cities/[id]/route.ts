import { NextRequest, NextResponse } from 'next/server';
import { CityAdminService } from '@/features/admin/services/cityAdminService';
import { UpdateCityData } from '@/features/admin/services/cityAdminService';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validatePathParams, validateRequestBody } from '@/lib/security/validation';
import { z } from 'zod';
import { commonSchemas } from '@/lib/security/validation';

const cityIdPathSchema = z.object({
  id: commonSchemas.uuid,
});

const updateCitySchema = z.record(z.string(), z.unknown());

/**
 * GET /api/admin/cities/[id]
 * Get city by ID
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
        const pathValidation = validatePathParams({ id }, cityIdPathSchema);
        if (!pathValidation.success) {
          return pathValidation.error;
        }
        
        const { id: validatedId } = pathValidation.data;
        const service = new CityAdminService();
        const city = await service.getById(validatedId);

        if (!city) {
          return createErrorResponse('City not found', 404);
        }

        return createSuccessResponse(city);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error fetching city:', error);
        }
        return createErrorResponse('Failed to fetch city', 500);
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
 * PATCH /api/admin/cities/[id]
 * Update city
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
        const pathValidation = validatePathParams({ id }, cityIdPathSchema);
        if (!pathValidation.success) {
          return pathValidation.error;
        }
        
        const { id: validatedId } = pathValidation.data;
        
        // Validate request body
        const validation = await validateRequestBody(req, updateCitySchema, REQUEST_SIZE_LIMITS.json);
        if (!validation.success) {
          return validation.error;
        }
        
        const body: UpdateCityData = validation.data as UpdateCityData;

        const service = new CityAdminService();
        const city = await service.update(validatedId, body);

        return createSuccessResponse(city);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error updating city:', error);
        }
        return createErrorResponse('Failed to update city', 500);
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
 * DELETE /api/admin/cities/[id]
 * Delete city
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
        const pathValidation = validatePathParams({ id }, cityIdPathSchema);
        if (!pathValidation.success) {
          return pathValidation.error;
        }
        
        const { id: validatedId } = pathValidation.data;
        
        const service = new CityAdminService();
        await service.delete(validatedId);

        return createSuccessResponse({ success: true });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error deleting city:', error);
        }
        return createErrorResponse('Failed to delete city', 500);
      }
    },
    {
      rateLimit: 'admin',
      requireAdmin: true,
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}



