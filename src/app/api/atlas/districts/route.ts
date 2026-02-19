import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';

export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async () => {
      try {
        const { createSupabaseClient } = await import('@/lib/supabase/unified');
        const supabase = await createSupabaseClient({ service: true });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const atlas = supabase.schema('atlas' as any);

        const { data, error } = await atlas
          .from('districts' as never)
          .select('id, name')
          .order('name', { ascending: true });

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const { data: counts, error: countError } = await atlas
          .from('schools' as never)
          .select('district_id')
          .eq('is_active', true);

        let schoolCounts: Record<string, number> = {};
        if (!countError && counts) {
          schoolCounts = (counts as { district_id: string }[]).reduce<Record<string, number>>((acc, s) => {
            if (s.district_id) {
              acc[s.district_id] = (acc[s.district_id] ?? 0) + 1;
            }
            return acc;
          }, {});
        }

        const districts = (data as { id: string; name: string }[]).map((d) => ({
          ...d,
          school_count: schoolCounts[d.id] ?? 0,
        }));

        return NextResponse.json({ districts });
      } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }
    },
    { rateLimit: 'public', requireAuth: false },
  );
}
