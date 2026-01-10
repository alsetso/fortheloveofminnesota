import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';

export async function GET(_request: NextRequest) {
  try {
    const supabase = createServerClient();
    
    // Type assertion needed: Supabase TypeScript types only support 'public' schema,
    // but we need to query from 'civic' schema. The schema() method exists at runtime.
    const { data, error } = await (supabase as any)
      .schema('civic')
      .from('state_boundary')
      .select('id, name, description, publisher, source_date, geometry')
      .single();
    
    if (error) {
      console.error('[State Boundary API] Error:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to fetch state boundary' },
        { status: 500 }
      );
    }
    
    if (!data) {
      return NextResponse.json(
        { error: 'State boundary not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('[State Boundary API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

