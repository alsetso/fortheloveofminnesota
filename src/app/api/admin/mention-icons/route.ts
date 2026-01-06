import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/adminHelpers';

export async function GET() {
  try {
    await requireAdmin();
    const supabase = createServiceClient();
    
    const { data, error } = await supabase
      .from('mention_icons')
      .select('*')
      .order('display_order', { ascending: true });
    
    if (error) {
      console.error('[Admin Mention Icons API] Error fetching:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to fetch mention icons' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(data || []);
  } catch (error) {
    console.error('[Admin Mention Icons API] Error:', error);
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
    
    const { data, error } = await supabase
      .from('mention_icons')
      .insert(body)
      .select()
      .single();
    
    if (error) {
      console.error('[Admin Mention Icons API] Error creating:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to create mention icon' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('[Admin Mention Icons API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

