import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { z } from 'zod';
import { commonSchemas, validateQueryParams } from '@/lib/security/validation';

const toggleSchema = z.object({
  school_district_id: z.string().uuid(),
});

const querySchema = z.object({
  school_district_id: commonSchemas.uuid.optional(),
});

export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async (req, ctx) => {
      const body = await req.json();
      const parsed = toggleSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }

      const { school_district_id } = parsed.data;
      const userId = ctx.userId!;

      const { createSupabaseClient } = await import('@/lib/supabase/unified');
      const supabase = await createSupabaseClient({ service: true });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const layers = supabase.schema('layers' as any);

      const { data: existing } = await layers
        .from('school_district_follows' as any)
        .select('user_id')
        .eq('user_id', userId)
        .eq('school_district_id', school_district_id)
        .maybeSingle();

      if (existing) {
        await layers
          .from('school_district_follows' as any)
          .delete()
          .eq('user_id', userId)
          .eq('school_district_id', school_district_id);

        return NextResponse.json({ following: false });
      }

      const { error } = await layers
        .from('school_district_follows' as any)
        .insert({ user_id: userId, school_district_id });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ following: true }, { status: 201 });
    },
    { requireAuth: true, rateLimit: 'public' }
  );
}

export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req, ctx) => {
      const url = new URL(req.url);
      const validation = validateQueryParams(url.searchParams, querySchema);
      if (!validation.success) return validation.error;

      const userId = ctx.userId;
      if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const { createSupabaseClient } = await import('@/lib/supabase/unified');
      const supabase = await createSupabaseClient({ service: true });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const layers = supabase.schema('layers' as any);
      const districtId = validation.data.school_district_id;

      if (districtId) {
        const { data } = await layers
          .from('school_district_follows' as any)
          .select('user_id')
          .eq('user_id', userId)
          .eq('school_district_id', districtId)
          .maybeSingle();

        return NextResponse.json({ following: !!data });
      }

      const { data, error } = await layers
        .from('school_district_follows' as any)
        .select('school_district_id, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data ?? []);
    },
    { requireAuth: true, rateLimit: 'public' }
  );
}
