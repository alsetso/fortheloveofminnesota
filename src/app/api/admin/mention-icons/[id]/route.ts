import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/adminHelpers';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    
    const supabase = createServiceClient();
    
    const { data, error } = await (supabase as any)
      .from('mention_icons')
      .update(body)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('[Admin Mention Icons API] Error updating:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to update mention icon' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Admin Mention Icons API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    
    const supabase = createServiceClient();
    
    const { error } = await supabase
      .from('mention_icons')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('[Admin Mention Icons API] Error deleting:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to delete mention icon' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Admin Mention Icons API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

