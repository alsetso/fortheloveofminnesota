import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase/unified';

export async function GET() {
  const supabase = await createSupabaseClient({ service: true });
  const { data, error } = await supabase.rpc('get_transit_route_lines');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
  });
}
