import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { getAtlasTypeBySlug } from '@/features/atlas/services/atlasTypesService';
import { handleQueryError } from '@/lib/utils/errorHandling';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validatePathParams } from '@/lib/security/validation';
import { z } from 'zod';
import { commonSchemas } from '@/lib/security/validation';

export const revalidate = 3600;

/**
 * GET /api/atlas/[table]/[id]
 * Get a single atlas entity by ID
 * 
 * Security:
 * - Rate limited: 100 requests/minute (public)
 * - Path parameter validation
 * - Public endpoint - no authentication required
 */
const atlasEntityPathSchema = z.object({
  table: z.string().min(1).max(100),
  id: z.string().uuid(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ table: string; id: string }> }
) {
  return withSecurity(
    request,
    async (req) => {
      try {
        const { table, id } = await params;
        
        // Validate path parameters
        const pathValidation = validatePathParams({ table, id }, atlasEntityPathSchema);
        if (!pathValidation.success) {
          return pathValidation.error;
        }
        
        const { table: validatedTable, id: validatedId } = pathValidation.data;

        // Validate table exists
        const atlasType = await getAtlasTypeBySlug(validatedTable);
        if (!atlasType) {
          return NextResponse.json(
            { error: 'Atlas type not found' },
            { status: 404 }
          );
        }

        const supabase = createServerClient();

        // Fetch the record
        const result = await (supabase as any)
          .schema('atlas')
          .from(validatedTable)
          .select('*')
          .eq('id', validatedId)
          .single();

        if (result.error || !result.data) {
          return NextResponse.json(
            { error: 'Entity not found' },
            { status: 404 }
          );
        }

        const record = handleQueryError(
          result.error,
          `AtlasEntityAPI: ${validatedTable}/${validatedId}`,
          result.data as Record<string, any>
        );

        // Fetch city name if city_id exists
        let cityName: string | null = null;
        if (record.city_id) {
          const cityResult = await (supabase as any)
            .schema('atlas')
            .from('cities')
            .select('id, name')
            .eq('id', record.city_id)
            .single();
          
          if (cityResult.data) {
            cityName = (cityResult.data as { name: string }).name;
          }
        }

        return NextResponse.json({
          entity: {
            ...record,
            city_name: cityName,
          },
        });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[AtlasEntityAPI] Error:', error);
        }
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    },
    {
      rateLimit: 'public',
      requireAuth: false,
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}
