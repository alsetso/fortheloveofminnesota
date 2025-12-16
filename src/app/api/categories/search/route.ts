import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from '@/types/supabase';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';

    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {
            // Route handlers can set cookies, but this endpoint doesn't need to
          },
        },
      }
    );

    if (!query.trim()) {
      return NextResponse.json({ categories: [] });
    }

    // Fuzzy search: use ilike for case-insensitive partial matching
    // Order by exact match first, then by name
    const { data: categories, error } = await supabase
      .from('categories')
      .select('id, name')
      .ilike('name', `%${query}%`)
      .order('name', { ascending: true })
      .limit(20) as { data: Array<{ id: string; name: string }> | null; error: any };

    if (error) {
      console.error('Error searching categories:', error);
      return NextResponse.json(
        { error: 'Failed to search categories' },
        { status: 500 }
      );
    }

    // Sort results: exact matches first, then by relevance
    const sortedCategories = (categories || []).sort((a, b) => {
      const aLower = a.name.toLowerCase();
      const bLower = b.name.toLowerCase();
      const queryLower = query.toLowerCase();

      // Exact match first
      if (aLower === queryLower) return -1;
      if (bLower === queryLower) return 1;

      // Starts with query
      const aStarts = aLower.startsWith(queryLower);
      const bStarts = bLower.startsWith(queryLower);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;

      // Alphabetical
      return aLower.localeCompare(bLower);
    });

    return NextResponse.json({ categories: sortedCategories });
  } catch (error) {
    console.error('Error in categories search:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

