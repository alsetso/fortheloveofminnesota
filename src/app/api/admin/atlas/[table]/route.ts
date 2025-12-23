import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/adminHelpers';
import type { AtlasEntityType } from '@/features/atlas/services/atlasService';

// Map table name to schema.table
const TABLE_MAP: Record<AtlasEntityType, string> = {
  neighborhood: 'atlas.neighborhoods',
  school: 'atlas.schools',
  park: 'atlas.parks',
  lake: 'atlas.lakes',
  watertower: 'atlas.watertowers',
  cemetery: 'atlas.cemeteries',
  golf_course: 'atlas.golf_courses',
  hospital: 'atlas.hospitals',
  airport: 'atlas.airports',
  church: 'atlas.churches',
  municipal: 'atlas.municipals',
  road: 'atlas.roads',
  radio_and_news: 'atlas.radio_and_news',
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  try {
    const auth = await requireAdmin();
    const { table } = await params;

    if (!table || !(table in TABLE_MAP)) {
      return NextResponse.json(
        { error: `Invalid table: ${table}` },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Use service role client to bypass RLS
    const supabase = createServiceClient();

    // Use RPC function to insert into atlas schema tables
    const { data, error } = await supabase
      .rpc('insert_atlas_entity' as any, {
        p_table_name: table,
        p_data: body,
      } as any);

    if (error) {
      console.error(`[Admin Atlas API] Error creating ${table}:`, error);
      return NextResponse.json(
        { error: error.message || `Failed to create ${table}` },
        { status: 500 }
      );
    }

    // RPC returns JSONB, extract the record
    const record = data as any;
    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    console.error('[Admin Atlas API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

