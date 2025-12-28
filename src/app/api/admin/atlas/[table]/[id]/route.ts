import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/adminHelpers';

// Valid atlas table names (matching URL parameter)
const VALID_TABLES = [
  'cities',
  'neighborhoods',
  'parks',
  'schools',
  'lakes',
  'churches',
  'hospitals',
  'golf_courses',
  'municipals',
  'watertowers',
  'cemeteries',
  'airports',
  'roads',
  'radio_and_news',
];

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ table: string; id: string }> }
) {
  try {
    const auth = await requireAdmin();
    const { table, id } = await params;

    if (!table || !id) {
      return NextResponse.json(
        { error: 'Table name and ID are required' },
        { status: 400 }
      );
    }

    if (!VALID_TABLES.includes(table)) {
      return NextResponse.json(
        { error: `Invalid table: ${table}` },
        { status: 400 }
      );
    }

    // Use service role client to bypass RLS
    const supabase = createServiceClient();

    // Delete from atlas schema table
    const { error } = await (supabase as any)
      .schema('atlas')
      .from(table)
      .delete()
      .eq('id', id);

    if (error) {
      console.error(`[Admin Atlas API] Error deleting ${table}:`, error);
      return NextResponse.json(
        { error: error.message || `Failed to delete ${table}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Admin Atlas API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

