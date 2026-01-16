import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validatePathParams, validateRequestBody } from '@/lib/security/validation';
import { z } from 'zod';
import type { AtlasEntityType } from '@/features/atlas/services/atlasService';

// Map table name to schema.table
const TABLE_MAP: Record<AtlasEntityType, string> = {
  neighborhood: 'atlas.neighborhoods',
  school: 'atlas.schools',
  park: 'atlas.parks',
  lake: 'atlas.lakes',
  watertower: 'atlas.watertowers',
  cemetery: 'atlas.cemeteries',
  golf_course: 'atlas.golf_courses',
  hospital: 'atlas.hospitals',
  airport: 'atlas.airports',
  church: 'atlas.churches',
  municipal: 'atlas.municipals',
  road: 'atlas.roads',
  radio_and_news: 'atlas.radio_and_news',
};

const VALID_TABLES = Object.keys(TABLE_MAP);

const atlasTablePathSchema = z.object({
  table: z.enum(VALID_TABLES as [string, ...string[]]),
});

const createAtlasEntitySchema = z.record(z.string(), z.unknown());

/**
 * POST /api/admin/atlas/[table]
 * Create atlas entity
 * 
 * Security:
 * - Rate limited: 100 requests/minute (admin)
 * - Request size limit: 1MB
 * - Input validation with Zod
 * - Requires admin role
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const { table } = await params;
        
        // Validate path parameters
        const pathValidation = validatePathParams({ table }, atlasTablePathSchema);
        if (!pathValidation.success) {
          return pathValidation.error;
        }
        
        const { table: validatedTable } = pathValidation.data;
        
        // Validate request body
        const validation = await validateRequestBody(req, createAtlasEntitySchema, REQUEST_SIZE_LIMITS.json);
        if (!validation.success) {
          return validation.error;
        }
        
        const body = validation.data;

        // Use service role client to bypass RLS
        const supabase = createServiceClient();

        // Use RPC function to insert into atlas schema tables
        const { data, error } = await supabase
          .rpc('insert_atlas_entity' as any, {
            p_table_name: validatedTable,
            p_data: body,
          } as any);

        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error(`[Admin Atlas API] Error creating ${validatedTable}:`, error);
          }
          return createErrorResponse(`Failed to create ${validatedTable}`, 500);
        }

        // RPC returns JSONB, extract the record
        const record = data as any;
        return createSuccessResponse(record, 201);
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

