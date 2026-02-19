import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';

export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (_req, ctx) => {
      const userId = ctx.userId;
      if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const { createSupabaseClient } = await import('@/lib/supabase/unified');
      const supabase = await createSupabaseClient({ service: true });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const atlas = supabase.schema('atlas' as any);

      const { data: follows, error: followsError } = await atlas
        .from('school_follows' as never)
        .select('school_id, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (followsError) {
        return NextResponse.json({ error: followsError.message }, { status: 500 });
      }

      if (!follows || follows.length === 0) {
        return NextResponse.json({ schools: [] });
      }

      const schoolIds = (follows as { school_id: string }[]).map((f) => f.school_id);

      const { data: schools, error: schoolsError } = await atlas
        .from('schools' as never)
        .select('id, name, slug, address, school_type, enrollment, grade_low, grade_high, phone, website_url, district_id, primary_color, secondary_color, mascot_name, tagline')
        .in('id', schoolIds);

      if (schoolsError) {
        return NextResponse.json({ error: schoolsError.message }, { status: 500 });
      }

      const idOrder = new Map(schoolIds.map((id, i) => [id, i]));
      const sorted = (schools as { id: string }[]).sort(
        (a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0)
      );

      return NextResponse.json({ schools: sorted });
    },
    { requireAuth: true, rateLimit: 'public' }
  );
}
