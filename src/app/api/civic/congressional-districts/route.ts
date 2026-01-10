import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(request.url);
    
    const id = searchParams.get('id');
    
    let query = (supabase as any)
      .schema('civic')
      .from('congressional_districts')
      .select('id, district_number, name, geometry')
      .order('district_number', { ascending: true });
    
    // Apply filters
    if (id) {
      query = query.eq('id', id);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('[Congressional Districts API] Error:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to fetch districts' },
        { status: 500 }
      );
    }
    
    // If querying by ID, return single object; otherwise return array
    if (id) {
      return NextResponse.json(Array.isArray(data) && data.length > 0 ? data[0] : data);
    }
    
    return NextResponse.json(data || []);
  } catch (error) {
    console.error('[Congressional Districts API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

