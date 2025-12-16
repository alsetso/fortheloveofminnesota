import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { Database } from '@/types/supabase';
import { createServerClient as createPublicClient } from '@/lib/supabaseServer';

/**
 * GET /api/businesses
 * Fetch all pages (public)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createPublicClient();

    const { data: pages, error } = await supabase
      .from('pages')
      .select(`
        *,
        category:categories(id, name)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching pages:', error);
      return NextResponse.json({ error: 'Failed to fetch pages' }, { status: 500 });
    }

    // Get all unique city IDs from service_areas arrays
    const cityIds = new Set<string>();
    (pages || []).forEach((page: Page) => {
      if (page.service_areas && Array.isArray(page.service_areas)) {
        page.service_areas.forEach((id: string) => cityIds.add(id));
      }
    });

    // Fetch cities in one query
    const citiesMap = new Map<string, { id: string; name: string }>();
    if (cityIds.size > 0) {
      const { data: cities } = await supabase
        .from('cities')
        .select('id, name')
        .in('id', Array.from(cityIds));
      
      if (cities) {
        cities.forEach((city) => citiesMap.set(city.id, city));
      }
    }

    // Transform the data to include cities and category
    const pagesList = (pages || []).map((page: Page) => {
      let citiesArray: Array<{ id: string; name: string }> | null = null;
      
      if (page.service_areas && Array.isArray(page.service_areas) && page.service_areas.length > 0) {
        citiesArray = page.service_areas
          .map((id: string) => citiesMap.get(id))
          .filter((city): city is { id: string; name: string } => city !== undefined);
      }

      // Extract category from join (Supabase returns it as an array)
      const category = page.category && Array.isArray(page.category) && page.category.length > 0
        ? page.category[0]
        : null;

      return {
        ...page,
        category: category ? { id: category.id, name: category.name } : null,
        cities: citiesArray && citiesArray.length > 0 ? citiesArray : null,
      };
    });

    return NextResponse.json({ businesses: pagesList });
  } catch (error) {
    console.error('Error in businesses GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/businesses
 * Create a new page (authenticated)
 */
export async function POST(request: NextRequest) {
  try {
    // Create response to hold cookies
    const response = new NextResponse();
    const cookieStore = await cookies();
    
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set({ name, value, ...options });
            });
          },
        },
      }
    );
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      const cookieNames = cookieStore.getAll().map(c => c.name);
      console.error('Auth failed in POST /api/businesses');
      console.error('  Error:', authError?.message || 'No user found');
      console.error('  Cookies received:', cookieNames);
      
      return NextResponse.json(
        { error: 'Unauthorized', details: authError?.message || 'No user found' },
        { status: 401, headers: response.headers }
      );
    }
    
    console.log('Auth successful in POST /api/businesses for user:', user.id);

    // Get user's account
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (accountError || !account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404, headers: response.headers }
      );
    }

    // Parse body
    const body = await request.json();
    const {
      name,
      category_id,
      address,
      lat,
      lng,
      email,
      phone,
      hours,
      service_areas,
      logo_url,
    } = body;

    // Validate required fields
    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'Page name is required' },
        { status: 400, headers: response.headers }
      );
    }

    // Validate category_id is UUID if provided
    if (category_id && typeof category_id === 'string') {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(category_id)) {
        return NextResponse.json(
          { error: 'Invalid category_id format' },
          { status: 400, headers: response.headers }
        );
      }
    }

    // Validate service_areas are UUIDs if provided
    if (service_areas && Array.isArray(service_areas)) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const invalidIds = service_areas.filter((id: string) => !uuidRegex.test(id));
      if (invalidIds.length > 0) {
        return NextResponse.json(
          { error: 'Invalid city IDs in service_areas' },
          { status: 400, headers: response.headers }
        );
      }
    }

    // Insert page
    const { data: newPage, error: insertError } = await supabase
      .from('pages')
      .insert({
        account_id: account.id,
        name: name.trim(),
        category_id: category_id || null,
        address: address?.trim() || null,
        lat: lat || null,
        lng: lng || null,
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        hours: hours?.trim() || null,
        service_areas: service_areas && service_areas.length > 0 ? service_areas : null,
        logo_url: logo_url?.trim() || null,
      })
      .select('*')
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to create page', details: insertError.message },
        { status: 500, headers: response.headers }
      );
    }

    // Fetch cities for service_areas
    let citiesArray: Array<{ id: string; name: string }> | null = null;
    if (newPage.service_areas && Array.isArray(newPage.service_areas) && newPage.service_areas.length > 0) {
      const { data: cities } = await supabase
        .from('cities')
        .select('id, name')
        .in('id', newPage.service_areas);
      
      if (cities && cities.length > 0) {
        citiesArray = cities;
      }
    }

    // Fetch category if category_id exists
    let category: { id: string; name: string } | null = null;
    if (newPage.category_id) {
      const { data: categoryData } = await supabase
        .from('categories')
        .select('id, name')
        .eq('id', newPage.category_id)
        .single();
      
      if (categoryData) {
        category = categoryData;
      }
    }

    const enrichedPage = {
      ...newPage,
      category,
      cities: citiesArray,
    };

    return NextResponse.json(
      { business: enrichedPage },
      { 
        status: 201,
        headers: response.headers 
      }
    );
  } catch (error) {
    console.error('Error in businesses POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

