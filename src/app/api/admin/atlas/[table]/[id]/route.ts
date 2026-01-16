import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validatePathParams } from '@/lib/security/validation';
import { z } from 'zod';
import { commonSchemas } from '@/lib/security/validation';

// Valid atlas table names (matching URL parameter)
const VALID_TABLES = [
  'cities',
  'neighborhoods',
  'parks',
  'schools',
  'lakes',
  'churches',
  'hospitals',
  'golf_courses',
  'municipals',
  'watertowers',
  'cemeteries',
  'airports',
  'roads',
  'radio_and_news',
] as const;

const atlasTableIdPathSchema = z.object({
  table: z.enum(VALID_TABLES),
  id: commonSchemas.uuid,
});

/**
 * DELETE /api/admin/atlas/[table]/[id]
 * Delete atlas entity
 * 
 * Security:
 * - Rate limited: 100 requests/minute (admin)
 * - Path parameter validation
 * - Requires admin role
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ table: string; id: string }> }
) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const { table, id } = await params;
        
        // Validate path parameters
        const pathValidation = validatePathParams({ table, id }, atlasTableIdPathSchema);
        if (!pathValidation.success) {
          return pathValidation.error;
        }
        
        const { table: validatedTable, id: validatedId } = pathValidation.data;

        // Use service role client to bypass RLS
        const supabase = createServiceClient();

        // Delete from atlas schema table
        const { error } = await (supabase as any)
          .schema('atlas')
          .from(validatedTable)
          .delete()
          .eq('id', validatedId);

        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error(`[Admin Atlas API] Error deleting ${validatedTable}:`, error);
          }
          return createErrorResponse(`Failed to delete ${validatedTable}`, 500);
        }

        return createSuccessResponse({ success: true });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[Admin Atlas API] Error:', error);
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

