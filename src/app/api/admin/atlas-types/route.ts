import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validateRequestBody } from '@/lib/security/validation';
import { z } from 'zod';

const createAtlasTypeSchema = z.record(z.string(), z.unknown());

/**
 * GET /api/admin/atlas-types
 * List atlas types
 * 
 * Security:
 * - Rate limited: 100 requests/minute (admin)
 * - Requires admin role
 */
export async function GET() {
  return withSecurity(
    {} as NextRequest,
    async () => {
      try {
        const supabase = createServiceClient();
    
    const { data, error } = await (supabase as any)
      .schema('atlas')
      .from('atlas_types')
      .select('*')
      .order('display_order', { ascending: true });
    
        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Admin Atlas Types API] Error fetching:', error);
          }
          return createErrorResponse('Failed to fetch atlas types', 500);
        }
        
        return createSuccessResponse(data || []);
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
 * POST /api/admin/atlas-types
 * Create atlas type
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
        const validation = await validateRequestBody(req, createAtlasTypeSchema, REQUEST_SIZE_LIMITS.json);
        if (!validation.success) {
          return validation.error;
        }
        
        const body = validation.data;
        
        const supabase = createServiceClient();
        
        const { data, error } = await (supabase as any)
          .schema('atlas')
          .from('atlas_types')
          .insert(body)
          .select()
          .single();
        
        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Admin Atlas Types API] Error creating:', error);
          }
          return createErrorResponse('Failed to create atlas type', 500);
        }
        
        return createSuccessResponse(data, 201);
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

