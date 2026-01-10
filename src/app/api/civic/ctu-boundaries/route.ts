import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(request.url);
    
    // Optional filters
    const id = searchParams.get('id');
    const ctuClass = searchParams.get('ctu_class'); // CITY, TOWNSHIP, UNORGANIZED TERRITORY
    const countyName = searchParams.get('county_name');
    const limit = searchParams.get('limit');
    
    let query = (supabase as any)
      .schema('civic')
      .from('ctu_boundaries')
      .select('id, ctu_class, feature_name, gnis_feature_id, county_name, county_code, county_gnis_feature_id, population, acres, geometry')
      .order('ctu_class', { ascending: true })
      .order('feature_name', { ascending: true });
    
    // Apply filters
    if (id) {
      query = query.eq('id', id);
    }
    
    if (ctuClass) {
      query = query.eq('ctu_class', ctuClass);
    }
    
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
      console.error('[CTU Boundaries API] Error:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to fetch CTU boundaries' },
        { status: 500 }
      );
    }
    
    // If querying by ID, return single object; otherwise return array
    if (id) {
      return NextResponse.json(Array.isArray(data) && data.length > 0 ? data[0] : data);
    }
    
    return NextResponse.json(data || []);
  } catch (error) {
    console.error('[CTU Boundaries API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

