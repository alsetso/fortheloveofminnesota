import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';

const VALID_TABLES = [
  'cities',
  'neighborhoods',
  'parks',
  'schools',
  'lakes',
  'watertowers',
  'cemeteries',
  'golf_courses',
  'hospitals',
  'airports',
  'churches',
  'municipals',
  'roads',
  'radio_and_news',
];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ table: string; id: string }> }
) {
  try {
    const { table, id } = await params;

    if (!table || !id) {
      return NextResponse.json(
        { error: 'Table name and ID are required' },
        { status: 400 }
      );
    }

    if (!VALID_TABLES.includes(table)) {
      return NextResponse.json(
        { error: `Invalid table name: ${table}` },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    const { data, error } = await (supabase as any)
      .schema('atlas')
      .from(table)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('[AtlasEntityAPI] Error:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to fetch entity' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[AtlasEntityAPI] Unexpected error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}


