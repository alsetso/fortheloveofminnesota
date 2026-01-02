import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { getAtlasTypeBySlug } from '@/features/atlas/services/atlasTypesService';
import { handleQueryError } from '@/lib/utils/errorHandling';

export const revalidate = 3600;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ table: string; id: string }> }
) {
  try {
    const { table, id } = await params;

    // Validate table exists
    const atlasType = await getAtlasTypeBySlug(table);
    if (!atlasType) {
      return NextResponse.json(
        { error: 'Atlas type not found' },
        { status: 404 }
      );
    }

    const supabase = createServerClient();

    // Fetch the record
    const result = await (supabase as any)
      .schema('atlas')
      .from(table)
      .select('*')
      .eq('id', id)
      .single();

    if (result.error || !result.data) {
      return NextResponse.json(
        { error: 'Entity not found' },
        { status: 404 }
      );
    }

    const record = handleQueryError(
      result.error,
      `AtlasEntityAPI: ${table}/${id}`,
      result.data as Record<string, any>
    );

    // Fetch city name if city_id exists
    let cityName: string | null = null;
    if (record.city_id) {
      const cityResult = await (supabase as any)
        .schema('atlas')
        .from('cities')
        .select('id, name')
        .eq('id', record.city_id)
        .single();
      
      if (cityResult.data) {
        cityName = (cityResult.data as { name: string }).name;
      }
    }

    return NextResponse.json({
      entity: {
        ...record,
        city_name: cityName,
      },
    });
  } catch (error) {
    console.error('[AtlasEntityAPI] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
