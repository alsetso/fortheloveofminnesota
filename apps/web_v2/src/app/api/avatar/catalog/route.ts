import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';

export const dynamic = 'force-dynamic';

/**
 * GET /api/avatar/catalog
 * Returns all active avatar world_models (category = 'avatar').
 * Used by AvatarPickerModal to populate the carousel.
 */
export async function GET() {
  try {
    const session = await getSessionAccount();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .schema('world' as never)
      .from('world_models')
      .select('id, slug, name, file_path, real_world_meters, sort_order')
      .eq('category', 'avatar')
      .eq('active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ avatars: data ?? [] });
  } catch (err) {
    if (process.env.NODE_ENV === 'development') console.error('[avatar/catalog]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
