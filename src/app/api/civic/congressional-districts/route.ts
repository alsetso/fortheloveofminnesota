import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    
    const { data, error } = await (supabase as any)
      .schema('civic')
      .from('congressional_districts')
      .select('id, district_number, name, geometry')
      .order('district_number', { ascending: true });
    
    if (error) {
      console.error('[Congressional Districts API] Error:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to fetch districts' },
        { status: 500 }
      );
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

