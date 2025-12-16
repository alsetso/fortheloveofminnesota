import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { Database } from '@/types/supabase';

/**
 * GET /api/businesses/[id]
 * Get a single page by ID (public)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return [];
          },
          setAll() {
            // Route handlers can set cookies, but this endpoint doesn't need to
          },
        },
      }
    );

    const { data: page, error } = await supabase
      .from('pages')
      .select(`
        *,
        category:categories(id, name)
      `)
      .eq('id', id)
      .single();

    if (error || !page) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      );
    }

    // Fetch cities for service_areas
    let citiesArray: Array<{ id: string; name: string }> | null = null;
    if (page.service_areas && Array.isArray(page.service_areas) && page.service_areas.length > 0) {
      const { data: cities } = await supabase
        .from('cities')
        .select('id, name')
        .in('id', page.service_areas);
      
      if (cities && cities.length > 0) {
        citiesArray = cities;
      }
    }

    // Extract category from join (Supabase returns it as an array)
    const category = page.category && Array.isArray(page.category) && page.category.length > 0
      ? page.category[0]
      : null;

    const enrichedPage = {
      ...page,
      category: category ? { id: category.id, name: category.name } : null,
      cities: citiesArray,
    };

    return NextResponse.json({ business: enrichedPage });
  } catch (error) {
    console.error('Error in businesses GET [id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/businesses/[id]
 * Update a business (authenticated, owner only)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: response.headers }
      );
    }

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

    // Check if page exists and user owns it
    const { data: existingPage, error: pageError } = await supabase
      .from('pages')
      .select('account_id')
      .eq('id', id)
      .single();

    if (pageError || !existingPage) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404, headers: response.headers }
      );
    }

    if (existingPage.account_id !== account.id) {
      return NextResponse.json(
        { error: 'You do not have permission to edit this page' },
        { status: 403, headers: response.headers }
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
    if (name !== undefined && !name?.trim()) {
      return NextResponse.json(
        { error: 'Page name is required' },
        { status: 400, headers: response.headers }
      );
    }

    // Validate category_id is UUID if provided
    if (category_id !== undefined && category_id !== null && typeof category_id === 'string') {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(category_id)) {
        return NextResponse.json(
          { error: 'Invalid category_id format' },
          { status: 400, headers: response.headers }
        );
      }
    }

    // Validate service_areas are UUIDs if provided
    if (service_areas !== undefined && Array.isArray(service_areas)) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const invalidIds = service_areas.filter((id: string) => !uuidRegex.test(id));
      if (invalidIds.length > 0) {
        return NextResponse.json(
          { error: 'Invalid city IDs in service_areas' },
          { status: 400, headers: response.headers }
        );
      }
    }

    // Build update object (only include provided fields)
    const updateData: PageUpdateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (category_id !== undefined) updateData.category_id = category_id || null;
    if (address !== undefined) updateData.address = address?.trim() || null;
    if (lat !== undefined) updateData.lat = lat || null;
    if (lng !== undefined) updateData.lng = lng || null;
    if (email !== undefined) updateData.email = email?.trim() || null;
    if (phone !== undefined) updateData.phone = phone?.trim() || null;
    if (hours !== undefined) updateData.hours = hours?.trim() || null;
    if (service_areas !== undefined) {
      updateData.service_areas = service_areas && service_areas.length > 0 ? service_areas : null;
    }
    if (logo_url !== undefined) updateData.logo_url = logo_url?.trim() || null;

    // Update page
    const { data: updatedPage, error: updateError } = await supabase
      .from('pages')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update page', details: updateError.message },
        { status: 500, headers: response.headers }
      );
    }

    // Fetch cities for service_areas
    let citiesArray: Array<{ id: string; name: string }> | null = null;
    if (updatedPage.service_areas && Array.isArray(updatedPage.service_areas) && updatedPage.service_areas.length > 0) {
      const { data: cities } = await supabase
        .from('cities')
        .select('id, name')
        .in('id', updatedPage.service_areas);
      
      if (cities && cities.length > 0) {
        citiesArray = cities;
      }
    }

    // Fetch category if category_id exists
    let category: { id: string; name: string } | null = null;
    if (updatedPage.category_id) {
      const { data: categoryData } = await supabase
        .from('categories')
        .select('id, name')
        .eq('id', updatedPage.category_id)
        .single();
      
      if (categoryData) {
        category = categoryData;
      }
    }

    const enrichedPage = {
      ...updatedPage,
      category,
      cities: citiesArray,
    };

    return NextResponse.json(
      { business: enrichedPage },
      { headers: response.headers }
    );
  } catch (error) {
    console.error('Error in businesses PUT [id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/businesses/[id]
 * Delete a page (authenticated, owner only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: response.headers }
      );
    }

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

    // Check if page exists and user owns it
    const { data: existingPage, error: pageError } = await supabase
      .from('pages')
      .select('account_id')
      .eq('id', id)
      .single();

    if (pageError || !existingPage) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404, headers: response.headers }
      );
    }

    if (existingPage.account_id !== account.id) {
      return NextResponse.json(
        { error: 'You do not have permission to delete this page' },
        { status: 403, headers: response.headers }
      );
    }

    // Delete page
    const { error: deleteError } = await supabase
      .from('pages')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Delete error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete page', details: deleteError.message },
        { status: 500, headers: response.headers }
      );
    }

    return NextResponse.json(
      { message: 'Page deleted successfully' },
      { headers: response.headers }
    );
  } catch (error) {
    console.error('Error in businesses DELETE [id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

