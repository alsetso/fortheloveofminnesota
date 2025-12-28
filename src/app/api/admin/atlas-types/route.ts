import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/adminHelpers';

export async function GET() {
  try {
    await requireAdmin();
    const supabase = createServiceClient();
    
    const { data, error } = await (supabase as any)
      .schema('atlas')
      .from('atlas_types')
      .select('*')
      .order('display_order', { ascending: true });
    
    if (error) {
      console.error('[Admin Atlas Types API] Error fetching:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to fetch atlas types' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(data || []);
  } catch (error) {
    console.error('[Admin Atlas Types API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    
    const supabase = createServiceClient();
    
    const { data, error } = await (supabase as any)
      .schema('atlas')
      .from('atlas_types')
      .insert(body)
      .select()
      .single();
    
    if (error) {
      console.error('[Admin Atlas Types API] Error creating:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to create atlas type' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('[Admin Atlas Types API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

