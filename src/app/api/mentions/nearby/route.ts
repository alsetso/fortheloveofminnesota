import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createServerClientWithAuth } from '@/lib/supabaseServer';
import { getServerAuth } from '@/lib/authServer';
import { getAccountIdForUser } from '@/lib/server/getAccountId';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = parseFloat(searchParams.get('lat') || '0');
    const lng = parseFloat(searchParams.get('lng') || '0');
    const radius = parseFloat(searchParams.get('radius') || '0.5'); // km
    const includeId = searchParams.get('include'); // Optional mention ID to include

    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        { error: 'Invalid coordinates' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const auth = await getServerAuth();
    let accountId: string | null = null;
    
    if (auth) {
      const supabaseWithAuth = await createServerClientWithAuth();
      accountId = await getAccountIdForUser(auth, supabaseWithAuth);
    }
    const isAuthenticated = !!accountId;

    // Calculate bounding box (approximate)
    // 1 degree latitude ≈ 111 km
    // For Minnesota (~45°N): 1 degree longitude ≈ 78 km
    const latDelta = radius / 111;
    const lngDelta = radius / 78;

    const bbox = {
      minLat: lat - latDelta,
      maxLat: lat + latDelta,
      minLng: lng - lngDelta,
      maxLng: lng + lngDelta,
    };

    // Build base query
    const essentialColumns = `id,
      lat,
      lng,
      description,
      image_url,
      video_url,
      media_type,
      account_id,
      collection_id,
      mention_type_id,
      visibility,
      archived,
      post_date,
      created_at,
      updated_at,
      view_count`;

    // Get live map ID first - try slug first, then fallback to custom_slug
    let liveMapId: string | null = null;
    
    // Try slug first
    const { data: slugMap, error: slugError } = await supabase
      .from('map')
      .select('id')
      .eq('slug', 'live')
      .maybeSingle();
    
    if (slugMap && !slugError) {
      const typedSlugMap = slugMap as { id: string };
      if (typedSlugMap.id) {
        liveMapId = typedSlugMap.id;
      }
    }
    
    if (!liveMapId) {
      // Fallback to custom_slug (legacy)
      const { data: customSlugMap, error: customSlugError } = await supabase
        .from('map')
        .select('id')
        .eq('custom_slug', 'live')
        .maybeSingle();
      
      if (customSlugMap && !customSlugError) {
        const typedCustomSlugMap = customSlugMap as { id: string };
        if (typedCustomSlugMap.id) {
          liveMapId = typedCustomSlugMap.id;
        }
      }
    }

    if (!liveMapId) {
      console.error('[API] Live map not found:', { slugError });
      return NextResponse.json(
        { error: 'Live map not found', details: 'No map with slug or custom_slug="live" found' },
        { status: 500 }
      );
    }

    let query = supabase
      .from('map_pins')
      .select(isAuthenticated
        ? `${essentialColumns},
          accounts(
            id,
            username,
            first_name,
            image_url,
            plan
          ),
          collections(
            id,
            emoji,
            title
          ),
          mention_type:mention_types(
            id,
            emoji,
            name
          )`
        : `${essentialColumns},
          accounts(
            image_url
          ),
          mention_type:mention_types(
            id,
            emoji,
            name
          )`
      )
      .eq('map_id', liveMapId)
      .eq('archived', false)
      .eq('is_active', true)
      .gte('lat', bbox.minLat)
      .lte('lat', bbox.maxLat)
      .gte('lng', bbox.minLng)
      .lte('lng', bbox.maxLng)
      .order('created_at', { ascending: false });

    // For anonymous users, filter to public only
    if (!isAuthenticated) {
      query = query.eq('visibility', 'public');
    }

    const { data: mentions, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Filter by distance and sort (client-side for now - can be optimized with PostGIS)
    const mentionsWithDistance = ((mentions || []) as any[]).map((mention: any) => {
      const distance = Math.sqrt(
        Math.pow(mention.lat - lat, 2) + Math.pow(mention.lng - lng, 2)
      );
      return { ...mention, distance };
    });

    // Filter to radius (in degrees - approximate)
    const radiusInDegrees = radius / 111;
    const filtered = mentionsWithDistance
      .filter((m: any) => m.distance <= radiusInDegrees)
      .sort((a: any, b: any) => a.distance - b.distance);

    // If includeId is provided, ensure it's in the results (even if outside radius)
    let result = filtered;
    if (includeId) {
      const included = mentions?.find((m: any) => m.id === includeId);
      if (included) {
        const alreadyIncluded = result.find((m: any) => m.id === includeId);
        if (!alreadyIncluded) {
          result = [included, ...result];
        } else {
          // Move to front
          result = [
            included,
            ...result.filter((m: any) => m.id !== includeId),
          ];
        }
      }
    }

    // Transform to match frontend expectations
    const transformed = result.map((mention: any) => ({
      ...mention,
      account: mention.accounts,
      collection: mention.collections,
      distance: mention.distance,
    }));

    // Cache headers
    const headers = new Headers();
    headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');

    return NextResponse.json({ mentions: transformed }, { headers });
  } catch (error) {
    console.error('[API] Error fetching nearby mentions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
