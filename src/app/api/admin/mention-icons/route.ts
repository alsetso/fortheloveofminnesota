import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validateRequestBody } from '@/lib/security/validation';
import { z } from 'zod';

const createMentionIconSchema = z.record(z.string(), z.unknown());

/**
 * GET /api/admin/mention-icons
 * List mention icons
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
    
    const { data, error } = await supabase
      .from('mention_icons')
      .select('*')
      .order('display_order', { ascending: true });
    
        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Admin Mention Icons API] Error fetching:', error);
          }
          return createErrorResponse('Failed to fetch mention icons', 500);
        }
        
        return createSuccessResponse(data || []);
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
 * POST /api/admin/mention-icons
 * Create mention icon
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
        const validation = await validateRequestBody(req, createMentionIconSchema, REQUEST_SIZE_LIMITS.json);
        if (!validation.success) {
          return validation.error;
        }
        
        const body = validation.data;
        
        const supabase = createServiceClient();
        
        const { data, error } = await supabase
          .from('mention_icons')
          .insert(body as any)
          .select()
          .single();
        
        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Admin Mention Icons API] Error creating:', error);
          }
          return createErrorResponse('Failed to create mention icon', 500);
        }
        
        return createSuccessResponse(data, 201);
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

