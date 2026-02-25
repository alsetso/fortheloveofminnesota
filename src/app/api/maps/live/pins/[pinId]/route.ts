import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, createServerClientWithAuth } from '@/lib/supabaseServer';
import { getServerAuth } from '@/lib/authServer';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';
import { withSecurity } from '@/lib/security/middleware';
import { validatePathParams } from '@/lib/security/validation';
import { z } from 'zod';

const pinIdPathSchema = z.object({
  pinId: z.string().uuid(),
});

/**
 * GET /api/maps/live/pins/[pinId]
 * Get a single pin from the live map
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated) or 100/min (public)
 * - Path parameter validation
 * - Optional authentication (RLS handles permissions)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pinId: string }> }
) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const { pinId } = await params;
        
        // Validate path parameters
        const pathValidation = validatePathParams({ pinId }, pinIdPathSchema);
        if (!pathValidation.success) {
          return pathValidation.error;
        }
        
        const { pinId: validatedPinId } = pathValidation.data;

        const auth = await getServerAuth();
        const supabase = auth 
          ? await createServerClientWithAuth(cookies())
          : await createServerClient();

        // Get live map ID
        const { data: liveMap, error: mapError } = await supabase
          .schema('maps')
          .from('maps')
          .select('id')
          .eq('slug', 'live')
          .eq('is_active', true)
          .maybeSingle();
        
        if (mapError || !liveMap) {
          return createErrorResponse('Live map not found', 404);
        }

        const liveMapId = (liveMap as { id: string }).id;

        // Fetch pin from live map (no cross-schema join - accounts is in public)
        const { data: pin, error } = await (supabase as any)
          .schema('maps')
          .from('pins')
          .select(`
            id,
            map_id,
            geometry,
            body,
            caption,
            emoji,
            image_url,
            video_url,
            icon_url,
            media_type,
            full_address,
            map_meta,
            atlas_meta,
            view_count,
            tagged_account_ids,
            visibility,
            archived,
            is_active,
            post_date,
            created_at,
            updated_at,
            author_account_id,
            tag_id,
            mention_type:tags(
              id,
              emoji,
              name
            )
          `)
          .eq('id', validatedPinId)
          .eq('map_id', liveMapId)
          .eq('is_active', true)
          .single() as { data: Record<string, unknown> | null; error: unknown };

        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Live Map Pins API] Error fetching pin:', error);
          }
          return createErrorResponse('Pin not found', 404);
        }

        if (!pin) {
          return createErrorResponse('Pin not found', 404);
        }

        // Extract lat/lng from PostGIS geometry
        // Geometry comes as GeoJSON: { type: 'Point', coordinates: [lng, lat] }
        let lat: number | null = null;
        let lng: number | null = null;
        
        if (pin.geometry) {
          try {
            // Try parsing as GeoJSON
            const geom = typeof pin.geometry === 'string' ? JSON.parse(pin.geometry) : pin.geometry;
            if (geom && geom.type === 'Point' && Array.isArray(geom.coordinates) && geom.coordinates.length >= 2) {
              lng = geom.coordinates[0];
              lat = geom.coordinates[1];
            } else if (typeof pin.geometry === 'string') {
              // Fallback: parse WKT format "POINT(lng lat)"
              const match = pin.geometry.match(/POINT\(([-\d.]+)\s+([-\d.]+)\)/);
              if (match) {
                lng = parseFloat(match[1]);
                lat = parseFloat(match[2]);
              }
            }
          } catch (e) {
            // Geometry parsing failed, will use 0,0 as fallback
            if (process.env.NODE_ENV === 'development') {
              console.warn('[Live Map Pins API] Failed to parse geometry:', e);
            }
          }
        }

        // Fetch account from public schema (cross-schema join not supported by PostgREST)
        let account: { id: string; username: string | null; first_name: string | null; last_name: string | null; image_url: string | null } | null = null;
        if (pin.author_account_id) {
          const { data: acc } = await supabase
            .from('accounts')
            .select('id, username, first_name, last_name, image_url')
            .eq('id', pin.author_account_id)
            .single() as { data: { id: string; username: string | null; first_name: string | null; last_name: string | null; image_url: string | null } | null };
          if (acc) account = acc;
        }

        // Resolve tagged accounts if needed
        let tagged_accounts: { id: string; username: string | null }[] | null = null;
        if (pin.tagged_account_ids && Array.isArray(pin.tagged_account_ids) && pin.tagged_account_ids.length > 0) {
          const taggedIds = pin.tagged_account_ids.filter((id): id is string => typeof id === 'string');
          if (taggedIds.length > 0) {
            const { data: taggedRows } = await supabase
              .from('accounts')
              .select('id, username')
              .in('id', taggedIds);
            tagged_accounts = (taggedRows || []).map((r: { id: string; username: string | null }) => ({
              id: r.id,
              username: r.username ?? null,
            }));
            if (tagged_accounts.length === 0) tagged_accounts = null;
          }
        }

        // Transform to LivePinData format
        const pinData = {
          id: pin.id,
          map_id: pin.map_id,
          lat: lat ?? 0,
          lng: lng ?? 0,
          description: pin.body || null,
          caption: pin.caption || null,
          emoji: pin.emoji || null,
          image_url: pin.image_url || null,
          video_url: pin.video_url || null,
          account_id: pin.author_account_id || null,
          created_at: pin.created_at,
          account: account ? {
            id: account.id,
            username: account.username,
            first_name: account.first_name,
            last_name: account.last_name,
            image_url: account.image_url,
          } : null,
          mention_type: (() => {
            const mt = pin.mention_type;
            const obj = Array.isArray(mt) ? (mt as any[])[0] : mt;
            return obj ? { id: obj.id, emoji: obj.emoji, name: obj.name } : null;
          })(),
          tagged_accounts,
        };

        if (!lat || !lng) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[Live Map Pins API] Pin missing coordinates:', { pinId: validatedPinId, lat, lng });
          }
        }

        return createSuccessResponse(pinData);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[Live Map Pins API] Error:', error);
        }
        return createErrorResponse('Internal server error', 500);
      }
    },
    {
      rateLimit: 'authenticated',
      requireAuth: false,
    }
  );
}
