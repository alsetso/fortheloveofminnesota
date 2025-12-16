import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from '@/types/supabase';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const response = new NextResponse();

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

    const body = await request.json();
    const { name } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Category name is required' },
        { status: 400, headers: response.headers }
      );
    }

    // Check if category already exists
    const { data: existing } = await supabase
      .from('categories')
      .select('id, name')
      .ilike('name', name.trim())
      .single();

    if (existing) {
      return NextResponse.json(existing, { headers: response.headers });
    }

    // Create new category (created_by will be set by trigger)
    const { data: newCategory, error: insertError } = await supabase
      .from('categories')
      .insert({ name: name.trim() } as any)
      .select('id, name')
      .single();

    if (insertError) {
      console.error('Error creating category:', insertError);
      return NextResponse.json(
        { error: 'Failed to create category', details: insertError.message },
        { status: 500, headers: response.headers }
      );
    }

    return NextResponse.json(newCategory, {
      status: 201,
      headers: response.headers,
    });
  } catch (error) {
    console.error('Error in categories POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

