import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validateQueryParams, validateRequestBody } from '@/lib/security/validation';
import { z } from 'zod';

const buildingsQuerySchema = z.object({
  minLng: z.string().regex(/^-?\d+\.?\d*$/).transform(Number).pipe(z.number().min(-180).max(180)).optional(),
  maxLng: z.string().regex(/^-?\d+\.?\d*$/).transform(Number).pipe(z.number().min(-180).max(180)).optional(),
  minLat: z.string().regex(/^-?\d+\.?\d*$/).transform(Number).pipe(z.number().min(-90).max(90)).optional(),
  maxLat: z.string().regex(/^-?\d+\.?\d*$/).transform(Number).pipe(z.number().min(-90).max(90)).optional(),
});

const createBuildingSchema = z.object({
  type: z.string().max(100),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
  full_address: z.string().max(500).optional().nullable(),
  website: z.string().url().max(500).optional().nullable(),
  cover_images: z.array(z.string().url()).optional().nullable(),
});

/**
 * GET /api/admin/buildings
 * List buildings with optional bounding box filter
 * 
 * Security:
 * - Rate limited: 100 requests/minute (admin)
 * - Query parameter validation
 * - Requires admin role
 */
export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const url = new URL(req.url);
        const validation = validateQueryParams(url.searchParams, buildingsQuerySchema);
        if (!validation.success) {
          return validation.error;
        }
        
        const { minLng, maxLng, minLat, maxLat } = validation.data;
        
        const supabase = createServiceClient();
    
        let query = (supabase as any)
          .schema('civic')
          .from('buildings')
          .select('*');
        
        // Apply bounding box filter if provided (spatial query)
        if (minLng !== undefined && maxLng !== undefined && minLat !== undefined && maxLat !== undefined) {
          query = query
            .gte('lng', minLng)
            .lte('lng', maxLng)
            .gte('lat', minLat)
            .lte('lat', maxLat);
        }
        
        query = query.order('created_at', { ascending: false });
        
        const { data, error } = await query;
        
        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Admin Buildings API] Error fetching:', error);
          }
          return createErrorResponse('Failed to fetch buildings', 500);
        }
        
        return createSuccessResponse(data || []);
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
 * POST /api/admin/buildings
 * Create building
 * 
 * Security:
 * - Rate limited: 100 requests/minute (admin)
 * - Request size limit: 1MB
 * - Input validation with Zod
 * - Requires admin role
 */
export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        // Validate request body
        const validation = await validateRequestBody(req, createBuildingSchema, REQUEST_SIZE_LIMITS.json);
        if (!validation.success) {
          return validation.error;
        }
        
        const body = validation.data;
        
        const supabase = createServiceClient();
        
        const { data, error } = await (supabase as any)
          .schema('civic')
          .from('buildings')
          .insert({
            type: body.type,
            name: body.name,
            description: body.description || null,
            lat: body.lat || null,
            lng: body.lng || null,
            full_address: body.full_address || null,
            website: body.website || null,
            cover_images: body.cover_images || null,
          })
          .select()
          .single();
        
        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Admin Buildings API] Error creating:', error);
          }
          return createErrorResponse('Failed to create building', 500);
        }
        
        return createSuccessResponse(data, 201);
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

