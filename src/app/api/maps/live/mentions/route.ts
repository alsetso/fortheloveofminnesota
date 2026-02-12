import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { withSecurity } from '@/lib/security/middleware';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';
import { cache } from 'react';

// Cache the most recent 100 pins for the live map
// Revalidates every 5 minutes (300 seconds) for freshness
export const revalidate = 300; // 5 minutes
export const dynamic = 'force-dynamic'; // Allow dynamic params but cache responses

/**
 * Cached function to fetch the 100 most recent public pins for the live map
 */
const getCachedLivePins = cache(async () => {
  // Use createServerClientWithAuth with empty cookies to ensure schema access
  // This works for both anonymous and authenticated users
  const { cookies } = await import('next/headers');
  const supabase = await createServerClientWithAuth(cookies());
  
  // Get the live map ID first
  // Use slug (new system) or custom_slug (legacy fallback)
  // Try slug first, then fallback to custom_slug
  let liveMap: { id: string } | null = null;
  
  // Get live map by slug
  const { data: slugMap, error: slugError } = await (supabase as any)
    .schema('maps')
    .from('maps')
    .select('id')
    .eq('slug', 'live')
    .eq('is_active', true)
    .maybeSingle();
  
  if (slugMap && !slugError) {
    liveMap = slugMap;
  } else {
    // Log detailed error for debugging
    if (process.env.NODE_ENV === 'development') {
      console.error('[Live Map Pins API] Live map lookup failed:', {
        slugError,
        slugMap,
      });
    }
    throw new Error('Live map not found');
  }
  
  if (!liveMap) {
    throw new Error('Live map not found');
  }
  
  const liveMapId = (liveMap as { id: string }).id;
  
  // Fetch the 100 most recent public pins from live map
  // Extract lat/lng from PostGIS geometry
  // Note: Cannot join accounts across schemas, so fetch pins first, then accounts separately
  const { data: pins, error } = await (supabase as any)
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
    .eq('map_id', liveMapId)
    .eq('archived', false)
    .eq('visibility', 'public')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(100);
  
  if (error) {
    throw error;
  }
  
  // Fetch account images separately (cross-schema join not supported)
  const accountIds = [...new Set((pins || [])
    .map((p: any) => p.author_account_id)
    .filter((id: any) => id !== null))];
  
  let accountImages: Record<string, string | null> = {};
  if (accountIds.length > 0) {
    const { data: accounts } = await supabase
      .from('accounts')
      .select('id, image_url')
      .in('id', accountIds);
    
    if (accounts) {
      accountImages = accounts.reduce((acc: Record<string, string | null>, account: any) => {
        acc[account.id] = account.image_url || null;
        return acc;
      }, {});
    }
  }
  
  // Transform pins to include lat/lng from geometry
  const transformedPins = (pins || []).map((pin: any) => {
    let lat: number | null = null;
    let lng: number | null = null;
    
    if (pin.geometry) {
      try {
        // Parse GeoJSON format
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
        // Geometry parsing failed
        if (process.env.NODE_ENV === 'development') {
          console.warn('[Live Map Pins API] Failed to parse geometry:', e);
        }
      }
    }
    
    return {
      ...pin,
      lat,
      lng,
      description: pin.body || null,
      account_id: pin.author_account_id || null,
      // Add account image_url from separate query
      account: pin.author_account_id ? {
        image_url: accountImages[pin.author_account_id] || null
      } : null,
    };
  });
  
  return transformedPins;
});

/**
 * GET /api/maps/live/mentions (kept for backward compatibility)
 * GET /api/maps/live/pins (new endpoint name)
 * Get the 100 most recent public pins for the live map
 * 
 * Caching:
 * - Server-side: React cache() with 5-minute revalidation
 * - HTTP: Cache-Control headers for CDN/edge caching
 * - Client-side: Should use sessionStorage (handled in MentionsLayer)
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated) or 100/min (public)
 * - Public endpoint (no auth required)
 * - Only returns public pins
 */
export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      try {
        // Fetch cached pins
        const pins = await getCachedLivePins();
        
        // Create response with cache headers
        const response = NextResponse.json({
          pins, // New field name
          mentions: pins, // Keep for backward compatibility
          count: pins.length,
          cached: true,
          timestamp: new Date().toISOString(),
        });
        
        // HTTP cache headers:
        // - s-maxage=300: CDN/edge caches for 5 minutes
        // - stale-while-revalidate=600: Serve stale content for 10 minutes while revalidating
        // - public: Can be cached by CDN and browsers
        response.headers.set(
          'Cache-Control',
          'public, s-maxage=300, stale-while-revalidate=600'
        );
        
        return response;
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[Live Map Pins API] Error:', error);
        }
        return createErrorResponse(
          error instanceof Error ? error.message : 'Failed to fetch live map pins',
          500
        );
      }
    },
    {
      rateLimit: 'authenticated', // Higher limit for authenticated, falls back to public
      requireAuth: false, // Public endpoint
      maxRequestSize: 1024, // Small response, 1KB limit
    }
  );
}
