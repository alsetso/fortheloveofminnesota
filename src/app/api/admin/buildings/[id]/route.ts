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
      .schema('civic')
      .from('buildings')
      .update({
        type: body.type,
        name: body.name,
        description: body.description || null,
        lat: body.lat || null,
        lng: body.lng || null,
        full_address: body.full_address || null,
        website: body.website || null,
        cover_images: body.cover_images || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('[Admin Buildings API] Error updating:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to update building' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Admin Buildings API] Error:', error);
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
    
    const { error } = await (supabase as any)
      .schema('civic')
      .from('buildings')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('[Admin Buildings API] Error deleting:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to delete building' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Admin Buildings API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

