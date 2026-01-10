import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(request.url);
    
    // Optional filters
    const countyName = searchParams.get('county_name');
    const limit = searchParams.get('limit');
    
    // Type assertion needed: Supabase TypeScript types only support 'public' schema,
    // but we need to query from 'civic' schema. The schema() method exists at runtime.
    let query = (supabase as any)
      .schema('civic')
      .from('county_boundaries')
      .select('id, county_name, county_code, county_gnis_feature_id, county_id, description, publisher, source_date, geometry')
      .order('county_name', { ascending: true });
    
    // Apply filters
    if (countyName) {
      query = query.eq('county_name', countyName);
    }
    
    if (limit) {
      const limitNum = parseInt(limit, 10);
      if (!isNaN(limitNum) && limitNum > 0) {
        query = query.limit(limitNum);
      }
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('[County Boundaries API] Error:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to fetch county boundaries' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(data || []);
  } catch (error) {
    console.error('[County Boundaries API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

