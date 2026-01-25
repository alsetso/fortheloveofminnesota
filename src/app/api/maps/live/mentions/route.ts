import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { withSecurity } from '@/lib/security/middleware';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';
import { cache } from 'react';

// Cache the most recent 100 mentions for the live map
// Revalidates every 5 minutes (300 seconds) for freshness
export const revalidate = 300; // 5 minutes
export const dynamic = 'force-dynamic'; // Allow dynamic params but cache responses

/**
 * Cached function to fetch the 100 most recent public mentions for the live map
 * This includes mentions with NULL map_id or explicitly linked to the live map
 */
const getCachedLiveMentions = cache(async () => {
  const supabase = createServerClient();
  
  // Get the live map ID first
  const { data: liveMap, error: mapError } = await supabase
    .from('map')
    .select('id')
    .eq('custom_slug', 'live')
    .eq('is_primary', true)
    .single();
  
  if (mapError || !liveMap) {
    throw new Error('Live map not found');
  }
  
  const liveMapId = (liveMap as { id: string }).id;
  
  // Fetch the 100 most recent public mentions
  // Include mentions with NULL map_id OR explicitly linked to live map
  const { data: mentions, error } = await supabase
    .from('mentions')
    .select(`
      id,
      lat,
      lng,
      description,
      image_url,
      video_url,
      media_type,
      account_id,
      city_id,
      collection_id,
      mention_type_id,
      visibility,
      archived,
      post_date,
      created_at,
      updated_at,
      view_count,
      accounts!inner(
        image_url
      ),
      mention_type:mention_types(
        id,
        emoji,
        name
      )
    `)
    .eq('archived', false)
    .eq('visibility', 'public')
    .or(`map_id.eq.${liveMapId},map_id.is.null`)
    .order('created_at', { ascending: false })
    .limit(100);
  
  if (error) {
    throw error;
  }
  
  return mentions || [];
});

/**
 * GET /api/maps/live/mentions
 * Get the 100 most recent public mentions for the live map
 * 
 * Caching:
 * - Server-side: React cache() with 5-minute revalidation
 * - HTTP: Cache-Control headers for CDN/edge caching
 * - Client-side: Should use sessionStorage (handled in MentionsLayer)
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated) or 100/min (public)
 * - Public endpoint (no auth required)
 * - Only returns public mentions
 */
export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      try {
        // Fetch cached mentions
        const mentions = await getCachedLiveMentions();
        
        // Create response with cache headers
        const response = NextResponse.json({
          mentions,
          count: mentions.length,
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
          console.error('[Live Map Mentions API] Error:', error);
        }
        return createErrorResponse(
          error instanceof Error ? error.message : 'Failed to fetch live map mentions',
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
