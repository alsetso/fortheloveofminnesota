import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validatePathParams, validateRequestBody } from '@/lib/security/validation';
import { z } from 'zod';
import { commonSchemas } from '@/lib/security/validation';
import { getAccountFeatureLimit } from '@/lib/billing/featureLimits';
import { Database } from '@/types/supabase';

/**
 * PATCH /api/maps/[id]/publish
 * Toggle publish to community status for a map
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated)
 * - Requires authentication
 * - Only owner can publish/unpublish
 * - Requires map_publish_to_community feature (Contributor+)
 */
const mapIdPathSchema = z.object({
  id: z.string().min(1).max(200),
});

// Helper to check if string is a valid UUID
function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

const publishMapSchema = z.object({
  published: z.boolean(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const { id } = await params;
        
        if (!userId || !accountId) {
          return createErrorResponse('Unauthorized - authentication required', 401);
        }

        const pathValidation = validatePathParams({ id }, mapIdPathSchema);
        if (!pathValidation.success) {
          return pathValidation.error;
        }
        
        const { id: identifier } = pathValidation.data;
        const supabase = await createServerClientWithAuth(cookies());

        // Validate request body
        const validation = await validateRequestBody(req, publishMapSchema, REQUEST_SIZE_LIMITS.json);
        if (!validation.success) {
          return validation.error;
        }
        
        const { published } = validation.data;

        // Resolve identifier to map_id
        let mapQuery = supabase
          .from('map')
          .select('id, account_id, published_to_community')
          .eq('is_active', true);
        
        if (isUUID(identifier)) {
          mapQuery = mapQuery.eq('id', identifier);
        } else {
          mapQuery = mapQuery.eq('slug', identifier);
        }

        const { data: map, error: mapError } = await mapQuery.single();
        
        if (mapError || !map) {
          return createErrorResponse('Map not found', 404);
        }

        // Check ownership
        const mapData = map as { account_id: string; id: string; published_to_community: boolean };
        if (mapData.account_id !== accountId) {
          return createErrorResponse('Forbidden - only map owner can publish', 403);
        }

        // Check billing feature if publishing
        if (published) {
          const featureLimit = await getAccountFeatureLimit(accountId, 'map_publish_to_community');
          if (!featureLimit.has_feature) {
            return createErrorResponse(
              'Publishing maps to community requires Contributor plan or higher. Upgrade to publish your maps.',
              403
            );
          }
        }

        // Update publish status
        const updateData: Partial<Database['public']['Tables']['map']['Update']> = {
          published_to_community: published,
          published_at: published ? new Date().toISOString() : null,
        };

        const { data: updatedMap, error: updateError } = await (supabase
          .from('map') as any)
          .update(updateData)
          .eq('id', mapData.id)
          .select('id, published_to_community, published_at')
          .single();

        if (updateError) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Maps API] Error updating publish status:', updateError);
          }
          return createErrorResponse('Failed to update publish status', 500);
        }

        return createSuccessResponse({
          id: updatedMap.id,
          published_to_community: updatedMap.published_to_community,
          published_at: updatedMap.published_at,
        });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[Maps API] Error:', error);
        }
        return createErrorResponse('Internal server error', 500);
      }
    },
    {
      rateLimit: 'authenticated',
      requireAuth: true,
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}
