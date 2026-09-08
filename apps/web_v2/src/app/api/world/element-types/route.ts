import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  ELEMENT_TYPE_FALLBACKS,
  type ElementType,
} from '@/features/map/game/world/elementTypes';

export const dynamic = 'force-dynamic';

/**
 * GET /api/world/element-types
 * Live category → label/color registry from world.element_types.
 */
export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .schema('world')
      .from('element_types')
      .select('slug, label, color, sort_order')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('element_types', error.message);
      return NextResponse.json({ types: ELEMENT_TYPE_FALLBACKS });
    }

    const types = (data ?? []) as ElementType[];
    return NextResponse.json({
      types: types.length > 0 ? types : ELEMENT_TYPE_FALLBACKS,
    });
  } catch (err) {
    console.error('element-types GET', err);
    return NextResponse.json({ types: ELEMENT_TYPE_FALLBACKS });
  }
}
